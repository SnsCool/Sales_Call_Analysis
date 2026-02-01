import { NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server"

export async function GET() {
  const supabase = await createServerSupabaseClient()

  try {
    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 管理者チェック
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: { role?: string } | null }

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Zoomアカウント一覧を取得
    const serviceSupabase = createServiceClient()
    const { data: accounts, error } = await serviceSupabase
      .from("zoom_accounts")
      .select("id, display_name, zoom_account_id, is_active, last_synced_at")
      .order("display_name", { ascending: true })

    if (error) {
      console.error("Failed to fetch zoom accounts:", error)
      return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 })
    }

    return NextResponse.json({ data: accounts || [] })
  } catch (error) {
    console.error("Zoom accounts API error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
