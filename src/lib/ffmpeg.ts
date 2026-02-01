import ffmpeg from "fluent-ffmpeg"
import fs from "fs/promises"
import { createWriteStream } from "fs"
import { pipeline } from "stream/promises"
import { Readable } from "stream"

// 最大ファイルサイズ: 2GB
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024

// 許可されたドメインリスト
const ALLOWED_DOMAINS = [
  "zoom.us",
  "zoomgov.com",
  "supabase.co",
  "supabase.com",
]

/**
 * URLが許可されたドメインかチェックする
 */
function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    // HTTPSのみ許可
    if (url.protocol !== "https:") {
      return false
    }
    // プライベートIPを拒否
    const hostname = url.hostname
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
    ) {
      return false
    }
    // 許可されたドメインかチェック
    return ALLOWED_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

// ダウンロードタイムアウト: 30分
const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000

/**
 * 指定されたURLの動画をストリーミングでダウンロードする
 * @param url 動画のURL
 * @param outputPath 保存先のパス
 * @param accessToken オプションのアクセストークン（Zoom API用）
 */
export async function downloadVideo(
  url: string,
  outputPath: string,
  accessToken?: string
): Promise<void> {
  // SSRF対策: URLを検証
  if (!isAllowedUrl(url)) {
    throw new Error("Invalid or disallowed URL")
  }

  const headers: Record<string, string> = {}
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`
  }

  // タイムアウト付きfetch
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

  let writeStream: ReturnType<typeof createWriteStream> | null = null
  let readable: Readable | null = null

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`)
    }

    // Content-Lengthでサイズチェック
    const contentLength = response.headers.get("content-length")
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${contentLength} bytes exceeds ${MAX_FILE_SIZE} bytes limit`)
    }

    if (!response.body) {
      throw new Error("No response body")
    }

    // ストリーミングでファイルに書き込み
    writeStream = createWriteStream(outputPath)
    readable = Readable.fromWeb(response.body as import("stream/web").ReadableStream)

    let downloadedSize = 0
    readable.on("data", (chunk: Buffer) => {
      downloadedSize += chunk.length
      if (downloadedSize > MAX_FILE_SIZE) {
        readable?.destroy(new Error(`Download exceeded ${MAX_FILE_SIZE} bytes limit`))
        writeStream?.destroy()
      }
    })

    await pipeline(readable, writeStream)
  } catch (error) {
    clearTimeout(timeoutId)
    // ストリームをクリーンアップ
    readable?.destroy()
    writeStream?.destroy()
    // 部分的にダウンロードされたファイルを削除
    try {
      await fs.unlink(outputPath)
    } catch {
      // ファイルが存在しない場合は無視
    }
    throw error
  }
}

// 最大クリップ時間: 10分
const MAX_CLIP_DURATION_MS = 10 * 60 * 1000
// FFmpegタイムアウト: 5分
const FFMPEG_TIMEOUT_MS = 5 * 60 * 1000

/**
 * FFmpegを使用して動画から指定した時間範囲を切り出す
 * @param inputPath 元動画のファイルパス
 * @param startMs 開始時間（ミリ秒）
 * @param endMs 終了時間（ミリ秒）
 * @param outputPath 出力ファイルパス
 * @returns 出力ファイルパス
 */
export async function extractVideoClip(
  inputPath: string,
  startMs: number,
  endMs: number,
  outputPath: string
): Promise<string> {
  // バリデーション
  if (startMs < 0) {
    throw new Error("startMs must be >= 0")
  }
  if (endMs <= startMs) {
    throw new Error("endMs must be greater than startMs")
  }
  const durationMs = endMs - startMs
  if (durationMs > MAX_CLIP_DURATION_MS) {
    throw new Error(`Clip duration ${durationMs}ms exceeds maximum ${MAX_CLIP_DURATION_MS}ms`)
  }

  // 入力と出力が同じパスでないことを確認
  if (inputPath === outputPath) {
    throw new Error("Input and output paths must be different")
  }

  return new Promise((resolve, reject) => {
    const durationSec = durationMs / 1000
    const startTimeSec = startMs / 1000

    let timeoutHandle: NodeJS.Timeout | null = null

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
        timeoutHandle = null
      }
    }

    const command = ffmpeg(inputPath)
      .setStartTime(startTimeSec)
      .setDuration(durationSec)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-preset ultrafast",
        "-crf 23",
        "-movflags +faststart"
      ])
      .save(outputPath)
      .on("end", () => {
        cleanup()
        resolve(outputPath)
      })
      .on("error", (err) => {
        cleanup()
        console.error("FFmpeg processing error:", err)
        reject(err)
      })

    // タイムアウト処理
    timeoutHandle = setTimeout(() => {
      command.kill("SIGKILL")
      reject(new Error(`FFmpeg timed out after ${FFMPEG_TIMEOUT_MS}ms`))
    }, FFMPEG_TIMEOUT_MS)
  })
}

/**
 * 一時ファイルをクリーンアップする
 * @param filePaths 削除するファイルパスの配列
 */
export async function cleanupFiles(filePaths: string[]): Promise<void> {
  await Promise.allSettled(
    filePaths.map(async (path) => {
      try {
        await fs.unlink(path)
      } catch (err) {
        console.warn(`Failed to delete temp file: ${path}`, err)
      }
    })
  )
}
