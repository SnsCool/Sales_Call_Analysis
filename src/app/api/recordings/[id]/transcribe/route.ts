import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { transcribeFromUrl } from "@/lib/groq"

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

  // 録画を取得
  const { data: recording, error: recError } = await supabase
    .from("recordings")
    .select("*")
    .eq("id", id)
    .single() as { data: { id: string; video_url: string | null; status: string } | null; error: unknown }

  if (recError || !recording) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 })
  }

  if (!recording.video_url) {
    return NextResponse.json({ error: "Video URL not found" }, { status: 400 })
  }

  try {
    // ステータス更新
    await supabase
      .from("recordings")
      .update({ status: "transcribing" } as never)
      .eq("id", id)

    // Groq Whisperで文字起こし
    const transcript = await transcribeFromUrl(recording.video_url)

    // analysesテーブルに保存（なければ作成）
    const { data: existingAnalysis } = await supabase
      .from("analyses")
      .select("id")
      .eq("recording_id", id)
      .single() as { data: { id: string } | null }

    if (existingAnalysis) {
      await supabase
        .from("analyses")
        .update({ transcript_json: transcript } as never)
        .eq("recording_id", id)
    } else {
      await supabase
        .from("analyses")
        .insert({ recording_id: id, transcript_json: transcript } as never)
    }

    // ステータス更新
    await supabase
      .from("recordings")
      .update({ status: "transcribed" } as never)
      .eq("id", id)

    return NextResponse.json({
      data: {
        segments: transcript.length,
        transcript: transcript,
      },
    })
  } catch (error) {
    // エラー時はステータスを失敗に
    await supabase
      .from("recordings")
      .update({ status: "failed" } as never)
      .eq("id", id)

    const message = error instanceof Error ? error.message : "Transcription failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
