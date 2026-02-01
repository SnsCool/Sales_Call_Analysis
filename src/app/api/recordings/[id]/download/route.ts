import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server"
import { downloadVideo, cleanupFiles } from "@/lib/ffmpeg"
import { randomUUID } from "crypto"
import { createReadStream } from "fs"
import fs from "fs/promises"

// UUID形式の正規表現
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

// POST: 録画をダウンロードしてSupabase Storageに保存
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordingId } = await params

  if (!isValidUUID(recordingId)) {
    return NextResponse.json({ error: "Invalid recording ID format" }, { status: 400 })
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

    const serviceSupabase = createServiceClient()

    // 3. 録画データの取得
    const { data: recording, error: fetchError } = await serviceSupabase
      .from("recordings")
      .select("id, video_url, storage_path, topic")
      .eq("id", recordingId)
      .single() as { data: { id: string; video_url: string | null; storage_path: string | null; topic: string } | null; error: unknown }

    if (fetchError || !recording) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 })
    }

    // 既にストレージに保存済みの場合はスキップ
    if (recording.storage_path) {
      return NextResponse.json({
        data: {
          message: "Recording already downloaded",
          storage_path: recording.storage_path,
        },
      })
    }

    if (!recording.video_url) {
      return NextResponse.json({ error: "No video URL available" }, { status: 400 })
    }

    // 4. 動画をダウンロード
    const uniqueId = randomUUID()
    const tempPath = `/tmp/download-${recordingId}-${uniqueId}.mp4`
    const storagePath = `recordings/${recordingId}/${uniqueId}.mp4`

    try {
      await downloadVideo(recording.video_url, tempPath)

      // 5. Supabase Storageにアップロード
      const fileStream = createReadStream(tempPath)
      const fileStat = await fs.stat(tempPath)

      const { error: uploadError } = await serviceSupabase.storage
        .from("recordings")
        .upload(storagePath, fileStream, {
          contentType: "video/mp4",
          upsert: false,
          duplex: "half",
        } as never)

      if (uploadError) {
        console.error("Upload error:", uploadError)
        throw new Error("Failed to upload to storage")
      }

      // 6. DBを更新
      const { error: updateError } = await serviceSupabase
        .from("recordings")
        .update({ storage_path: storagePath } as never)
        .eq("id", recordingId)

      if (updateError) {
        console.error("DB update error:", updateError)
        throw new Error("Failed to update recording")
      }

      return NextResponse.json({
        data: {
          message: "Recording downloaded successfully",
          storage_path: storagePath,
          size_bytes: fileStat.size,
        },
      })

    } finally {
      await cleanupFiles([tempPath])
    }

  } catch (error) {
    console.error("Download error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
