import { NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server"
import { getZoomAccessToken, getZoomRecordings } from "@/lib/zoom"

export async function POST() {
  // 認証チェック
  const authSupabase = await createServerSupabaseClient()
  const { data: { user } } = await authSupabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 管理者チェック
  const { data: profile } = await authSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as { data: { role?: string } | null }

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // サービスロールで操作
  const supabase = createServiceClient()

  // 全てのアクティブなZoomアカウントを取得（認証情報付き）
  const { data: accounts, error: accError } = await supabase
    .from("zoom_accounts")
    .select("id, display_name, zoom_account_id, client_id, client_secret")
    .eq("is_active", true) as {
      data: {
        id: string
        display_name: string
        zoom_account_id: string
        client_id: string | null
        client_secret: string | null
      }[] | null
      error: unknown
    }

  if (accError || !accounts) {
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 })
  }

  const results = {
    synced: 0,
    newRecordings: 0,
    skipped: 0,
    errors: [] as string[],
  }

  // 過去30日間の録画を取得
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 30)
  const from = fromDate.toISOString().split("T")[0]

  for (const account of accounts) {
    try {
      // 認証情報がない場合はスキップ
      if (!account.client_id || !account.client_secret || !account.zoom_account_id) {
        results.skipped++
        continue
      }

      // アクセストークンを取得
      const accessToken = await getZoomAccessToken(
        account.zoom_account_id,
        account.client_id,
        account.client_secret
      )

      // 録画を取得
      const recordings = await getZoomRecordings(accessToken, "me", from)

      // 各録画をDBに保存
      for (const recording of recordings) {
        const videoFile = recording.recording_files?.find(
          (f) => f.file_type === "MP4"
        )

        if (!videoFile) continue

        // 既存チェック（zoom_recording_idで重複確認）
        const { data: existing } = await supabase
          .from("recordings")
          .select("id")
          .eq("zoom_recording_id", recording.uuid)
          .maybeSingle()

        if (existing) {
          // 既に登録済みなのでスキップ
          continue
        }

        // 新規録画を保存
        const { error: insertError } = await supabase.from("recordings").insert({
          zoom_account_id: account.id,
          zoom_recording_id: recording.uuid,
          topic: recording.topic,
          start_time: recording.start_time,
          duration: recording.duration,
          video_url: videoFile.download_url,
          status: "ready",
        } as never)

        if (!insertError) {
          results.newRecordings++
        }
      }

      results.synced++

      // 最終同期時刻を更新
      await supabase
        .from("zoom_accounts")
        .update({ last_synced_at: new Date().toISOString() } as never)
        .eq("id", account.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      results.errors.push(`${account.display_name}: ${message}`)
    }
  }

  return NextResponse.json({ data: results })
}
