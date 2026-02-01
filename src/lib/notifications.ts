import { createServiceClient } from "./supabase-server"

export type NotificationType = "analysis_complete" | "feedback_shared"

interface SendNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
}

interface SendEmailParams {
  to: string
  subject: string
  html: string
}

/**
 * Resend APIでメールを送信する
 */
async function sendEmail(params: SendEmailParams): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.log("[Notifications] RESEND_API_KEY not configured, skipping email")
    return
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@example.com"

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[Notifications] Email send failed:", error)
    }
  } catch (error) {
    console.error("[Notifications] Email send error:", error)
  }
}

/**
 * 通知を送信する（DB保存 + オプションでメール送信）
 */
export async function sendNotification(params: SendNotificationParams): Promise<void> {
  const supabase = createServiceClient()

  try {
    // DBに通知を保存
    const { error } = await supabase
      .from("notifications")
      .insert({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        is_read: false,
      } as never)

    if (error) {
      console.error("[Notifications] Failed to save notification:", error)
    }
  } catch (error) {
    console.error("[Notifications] Error:", error)
  }
}

/**
 * 分析完了時に管理者へ通知を送信
 */
export async function notifyAnalysisComplete(
  recordingId: string,
  recordingTopic: string
): Promise<void> {
  const supabase = createServiceClient()

  // 全管理者を取得
  const { data: admins } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("role", "admin") as { data: { id: string; email: string; full_name: string }[] | null }

  if (!admins || admins.length === 0) {
    return
  }

  const title = "分析が完了しました"
  const message = `録画「${recordingTopic}」の分析が完了しました。結果を確認してください。`

  for (const admin of admins) {
    await sendNotification({
      userId: admin.id,
      type: "analysis_complete",
      title,
      message,
    })

    // メール送信（オプション）
    if (admin.email) {
      await sendEmail({
        to: admin.email,
        subject: `[営業コール分析] ${title}`,
        html: `
          <h2>${title}</h2>
          <p>こんにちは、${admin.full_name || "管理者"}さん</p>
          <p>${message}</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/recordings/${recordingId}">分析結果を確認する</a></p>
        `,
      })
    }
  }
}

/**
 * フィードバック共有時に対象ユーザーへ通知を送信
 */
export async function notifyFeedbackShared(
  feedbackId: string,
  targetUserId: string,
  recordingTopic: string
): Promise<void> {
  const supabase = createServiceClient()

  // 対象ユーザーを取得
  const { data: user } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", targetUserId)
    .single() as { data: { id: string; email: string; full_name: string } | null }

  if (!user) {
    return
  }

  const title = "新しいフィードバックが共有されました"
  const message = `録画「${recordingTopic}」に関するフィードバックがあなたに共有されました。`

  await sendNotification({
    userId: user.id,
    type: "feedback_shared",
    title,
    message,
  })

  // メール送信（オプション）
  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: `[営業コール分析] ${title}`,
      html: `
        <h2>${title}</h2>
        <p>こんにちは、${user.full_name || ""}さん</p>
        <p>${message}</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/my-feedbacks">フィードバックを確認する</a></p>
      `,
    })
  }
}
