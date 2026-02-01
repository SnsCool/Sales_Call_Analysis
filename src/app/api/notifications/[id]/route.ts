import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

// PATCH: 通知を既読にする
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: notificationId } = await params
  const supabase = await createServerSupabaseClient()

  try {
    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 自分の通知のみ更新可能
    const { data, error } = await supabase
      .from("notifications")
      .update({ is_read: true } as never)
      .eq("id", notificationId)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      console.error("Failed to update notification:", error)
      return NextResponse.json({ error: "Failed to update" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Notification update error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
