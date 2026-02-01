import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server"
import { extractVideoClip, downloadVideo, cleanupFiles } from "@/lib/ffmpeg"
import { randomUUID } from "crypto"
import fs from "fs/promises"

// UUID形式の正規表現
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

// POST: クリップを生成
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordingId } = await params

  // recordingIdのバリデーション（パストラバーサル対策）
  if (!isValidUUID(recordingId)) {
    return NextResponse.json({ error: "Invalid recording ID format" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  try {
    // 1. 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
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
    let body: { issue_index?: number; start_ms?: number; end_ms?: number; analysis_id?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { issue_index, start_ms, end_ms, analysis_id } = body

    if (typeof start_ms !== "number" || typeof end_ms !== "number") {
      return NextResponse.json({ error: "Invalid time range" }, { status: 400 })
    }

    if (start_ms >= end_ms) {
      return NextResponse.json({ error: "start_ms must be less than end_ms" }, { status: 400 })
    }

    // 4. 録画データの取得
    const serviceSupabase = createServiceClient()
    const { data: recording, error: recordError } = await serviceSupabase
      .from("recordings")
      .select("video_url, topic, storage_path")
      .eq("id", recordingId)
      .single() as { data: { video_url: string | null; topic: string; storage_path: string | null } | null; error: unknown }

    if (recordError || !recording) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 })
    }

    // 動画URLまたはストレージパスが必要
    const videoSource = recording.storage_path || recording.video_url
    if (!videoSource) {
      return NextResponse.json({ error: "No video source available" }, { status: 400 })
    }

    // 5. 動画の処理（UUIDで一意性を確保）
    const uniqueId = randomUUID()
    const tempInputPath = `/tmp/recording-${recordingId}-${uniqueId}.mp4`
    const clipFileName = `${recordingId}/${uniqueId}.mp4`
    const tempOutputPath = `/tmp/clip-${uniqueId}.mp4`

    try {
      // 動画をダウンロード
      if (recording.storage_path) {
        // Supabase Storageから取得
        const { data: signedUrlData } = await serviceSupabase.storage
          .from("recordings")
          .createSignedUrl(recording.storage_path, 3600)

        if (!signedUrlData?.signedUrl) {
          return NextResponse.json({ error: "Failed to get signed URL" }, { status: 500 })
        }
        await downloadVideo(signedUrlData.signedUrl, tempInputPath)
      } else if (recording.video_url) {
        // 外部URL（Zoom等）からダウンロード
        await downloadVideo(recording.video_url, tempInputPath)
      }

      // クリップを切り出し
      await extractVideoClip(tempInputPath, start_ms, end_ms, tempOutputPath)

      // 6. Supabase Storageにアップロード
      // Note: クリップは最大10分に制限されているため、メモリ使用量は許容範囲内
      const fileBuffer = await fs.readFile(tempOutputPath)
      const { error: uploadError } = await serviceSupabase.storage
        .from("clips")
        .upload(clipFileName, fileBuffer, {
          contentType: "video/mp4",
          upsert: false,
        })

      if (uploadError) throw uploadError

      // 7. データベースにクリップ情報を保存
      const { data: newClip, error: dbError } = await serviceSupabase
        .from("clips")
        .insert({
          recording_id: recordingId,
          analysis_id: analysis_id || null,
          issue_index: issue_index ?? 0,
          start_ms: start_ms,
          end_ms: end_ms,
          storage_path: clipFileName,
        } as never)
        .select()
        .single()

      if (dbError) throw dbError

      return NextResponse.json({ data: newClip }, { status: 201 })

    } finally {
      // 8. 一時ファイルのクリーンアップ
      await cleanupFiles([tempInputPath, tempOutputPath])
    }

  } catch (error) {
    console.error("Clip creation error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// GET: 録画に紐づくクリップ一覧を取得
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordingId } = await params

  // recordingIdのバリデーション
  if (!isValidUUID(recordingId)) {
    return NextResponse.json({ error: "Invalid recording ID format" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  try {
    // 認証チェック
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

    const serviceSupabase = createServiceClient()

    // 録画へのアクセス権をチェック
    if (!isAdmin) {
      // 一般ユーザーは自分の録画のみアクセス可能
      const { data: recording, error: recordingError } = await serviceSupabase
        .from("recordings")
        .select(`
          id,
          zoom_accounts!inner(owner_id)
        `)
        .eq("id", recordingId)
        .single() as { data: { id: string; zoom_accounts: { owner_id: string } } | null; error: unknown }

      if (recordingError || !recording) {
        return NextResponse.json({ error: "Recording not found" }, { status: 404 })
      }

      if (recording.zoom_accounts.owner_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const { data, error } = await serviceSupabase
      .from("clips")
      .select("*")
      .eq("recording_id", recordingId)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Signed URLを付与して返す（公開URLではなく署名付きURL）
    const clipsWithUrls = await Promise.all(
      (data || []).map(async (clip: { storage_path: string; [key: string]: unknown }) => {
        const { data: signedUrlData } = await serviceSupabase.storage
          .from("clips")
          .createSignedUrl(clip.storage_path, 3600) // 1時間有効
        return {
          ...clip,
          url: signedUrlData?.signedUrl || null
        }
      })
    )

    return NextResponse.json({ data: clipsWithUrls })

  } catch (error) {
    console.error("Clip fetch error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
