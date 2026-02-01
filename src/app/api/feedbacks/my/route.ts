import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function GET() {
  const supabase = await createServerSupabaseClient()

  try {
    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 自分宛ての共有済みフィードバックを取得
    const { data: feedbacks, error } = await supabase
      .from("feedbacks")
      .select(`
        id,
        content,
        shared_at,
        created_at,
        recordings(id, topic, start_time)
      `)
      .eq("target_user_id", user.id)
      .eq("is_shared", true)
      .order("shared_at", { ascending: false })

    if (error) {
      console.error("Failed to fetch feedbacks:", error)
      return NextResponse.json({ error: "Failed to fetch feedbacks" }, { status: 500 })
    }

    return NextResponse.json({ data: feedbacks || [] })
  } catch (error) {
    console.error("My feedbacks API error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
