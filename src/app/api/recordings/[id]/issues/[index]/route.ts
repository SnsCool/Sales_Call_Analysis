import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server"

interface Issue {
  start_ms: number
  end_ms: number
  rule_name: string
  severity: "error" | "warning" | "info"
  reason: string
  suggestion: string
  approved?: boolean
}

interface IssuesJson {
  issues: Issue[]
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id: recordingId, index: indexStr } = await params
  const issueIndex = parseInt(indexStr, 10)

  if (isNaN(issueIndex) || issueIndex < 0) {
    return NextResponse.json({ error: "Invalid issue index" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  try {
    // 1. 認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. 管理者チェック
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: { role?: string } | null; error: unknown }

    if (profileError) {
      console.error("Failed to fetch user profile:", profileError)
      return NextResponse.json({ error: "Failed to verify user role" }, { status: 500 })
    }

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    // 3. リクエストボディの取得
    let body: { approved?: boolean }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { approved } = body

    if (typeof approved !== "boolean") {
      return NextResponse.json({ error: "approved must be a boolean" }, { status: 400 })
    }

    const serviceSupabase = createServiceClient()

    // 4. 録画の分析データを取得
    const { data: analysis, error: fetchError } = await serviceSupabase
      .from("analyses")
      .select("id, issues_json")
      .eq("recording_id", recordingId)
      .single() as { data: { id: string; issues_json: IssuesJson | null } | null; error: unknown }

    if (fetchError || !analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 })
    }

    const issuesData = analysis.issues_json
    if (!issuesData?.issues || !Array.isArray(issuesData.issues)) {
      return NextResponse.json({ error: "Invalid issues data structure" }, { status: 500 })
    }

    // 5. インデックスの範囲チェック
    if (issueIndex >= issuesData.issues.length) {
      return NextResponse.json({ error: "Issue index out of range" }, { status: 400 })
    }

    // 6. issueのapprovedフィールドを更新
    issuesData.issues[issueIndex].approved = approved

    // 7. データベースを更新
    const { error: updateError } = await serviceSupabase
      .from("analyses")
      .update({ issues_json: issuesData } as never)
      .eq("id", analysis.id)

    if (updateError) {
      console.error("Update error:", updateError)
      return NextResponse.json({ error: "Failed to update issue" }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        index: issueIndex,
        issue: issuesData.issues[issueIndex],
      },
    })
  } catch (error) {
    console.error("Issue update error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
