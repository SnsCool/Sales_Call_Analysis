import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function GET() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ユーザーのロールを取得
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as { data: { role?: string } | null }

  const isAdmin = profile?.role === "admin"

  // 今月の範囲を計算
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  // 録画数
  const { count: totalRecordings } = await supabase
    .from("recordings")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfMonth.toISOString())
    .lte("created_at", endOfMonth.toISOString())
    .is("deleted_at", null)

  // 分析完了数
  const { count: completedAnalyses } = await supabase
    .from("recordings")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("created_at", startOfMonth.toISOString())
    .lte("created_at", endOfMonth.toISOString())

  // フィードバック数
  const { count: totalFeedbacks } = await supabase
    .from("feedbacks")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfMonth.toISOString())

  // 検出された問題数（analysesのissues_jsonから集計）
  const { data: analyses } = await supabase
    .from("analyses")
    .select("issues_json")
    .gte("created_at", startOfMonth.toISOString()) as { data: { issues_json: unknown }[] | null }

  let totalIssues = 0
  if (analyses) {
    for (const analysis of analyses) {
      const issues = analysis.issues_json as { issues?: unknown[] } | null
      if (issues?.issues) {
        totalIssues += issues.issues.length
      }
    }
  }

  // 未分析の録画
  const { data: pendingRecordings } = await supabase
    .from("recordings")
    .select(`
      id, topic, start_time, status,
      zoom_accounts(display_name)
    `)
    .in("status", ["pending", "ready", "transcribed", "analyzing"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5)

  // 最近のフィードバック
  const { data: recentFeedbacks } = await supabase
    .from("feedbacks")
    .select(`
      id, content, created_at,
      recordings(topic),
      profiles!feedbacks_target_user_id_fkey(full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(5)

  return NextResponse.json({
    stats: {
      totalRecordings: totalRecordings || 0,
      completedAnalyses: completedAnalyses || 0,
      totalFeedbacks: totalFeedbacks || 0,
      totalIssues,
    },
    pendingRecordings: pendingRecordings || [],
    recentFeedbacks: recentFeedbacks || [],
  })
}
