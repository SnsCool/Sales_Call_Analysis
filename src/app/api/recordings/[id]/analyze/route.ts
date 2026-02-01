import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { analyzeTranscript } from "@/lib/gemini"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 録画と既存の分析を取得
  const { data: recording, error: recError } = await supabase
    .from("recordings")
    .select("*, analyses(*)")
    .eq("id", id)
    .single() as { data: { id: string; analyses: { transcript_json: unknown }[] } | null; error: unknown }

  if (recError || !recording) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 })
  }

  const analysis = recording.analyses?.[0]
  if (!analysis?.transcript_json) {
    return NextResponse.json({ error: "Transcript not found. Run transcription first." }, { status: 400 })
  }

  // ナレッジルールを取得
  const { data: rules } = await supabase
    .from("knowledge_rules")
    .select("id, title, content, prompt_instructions")
    .eq("is_active", true) as { data: { id: string; title: string; content: string; prompt_instructions?: string }[] | null }

  if (!rules || rules.length === 0) {
    return NextResponse.json({ error: "No active knowledge rules found" }, { status: 400 })
  }

  try {
    // ステータス更新
    await supabase
      .from("recordings")
      .update({ status: "analyzing" } as never)
      .eq("id", id)

    // Gemini で分析
    const transcript = analysis.transcript_json as { start: number; end: number; text: string; speaker?: string }[]
    const result = await analyzeTranscript(transcript, rules)

    // 分析結果を保存
    await supabase
      .from("analyses")
      .update({
        issues_json: result.issues,
        summary_text: result.summary,
      } as never)
      .eq("recording_id", id)

    // ステータス更新
    await supabase
      .from("recordings")
      .update({ status: "completed" } as never)
      .eq("id", id)

    return NextResponse.json({ data: result })
  } catch (error) {
    // エラー時はステータスを失敗に
    await supabase
      .from("recordings")
      .update({ status: "failed" } as never)
      .eq("id", id)

    const message = error instanceof Error ? error.message : "Analysis failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
