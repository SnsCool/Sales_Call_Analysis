import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-server"
import { getZoomAccessToken, getZoomRecordings } from "@/lib/zoom"

/**
 * Zoom録画同期のメインロジック
 */
async function syncZoomRecordings() {
  const supabase = createServiceClient()

  const { data: accounts, error: accError } = await supabase
    .from("zoom_accounts")
    .select("id, display_name, zoom_account_id, client_id, client_secret")
    .eq("is_active", true) as {
      data: {
        id: string
        display_name: string
        zoom_account_id: string
        client_id: string | null
        client_secret: string | null
      }[] | null
      error: unknown
    }

  if (accError || !accounts) {
    throw new Error("Failed to fetch accounts")
  }

  const results = {
    synced: 0,
    newRecordings: 0,
    skipped: 0,
    errors: [] as string[],
  }

  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 30)
  const from = fromDate.toISOString().split("T")[0]

  for (const account of accounts) {
    try {
      if (!account.client_id || !account.client_secret || !account.zoom_account_id) {
        results.skipped++
        continue
      }

      const accessToken = await getZoomAccessToken(
        account.zoom_account_id,
        account.client_id,
        account.client_secret
      )

      const recordings = await getZoomRecordings(accessToken, "me", from)

      for (const recording of recordings) {
        const videoFile = recording.recording_files?.find(
          (f) => f.file_type === "MP4"
        )

        if (!videoFile) continue

        const { data: existing } = await supabase
          .from("recordings")
          .select("id")
          .eq("zoom_recording_id", recording.uuid)
          .maybeSingle()

        if (existing) {
          continue
        }

        const { error: insertError } = await supabase.from("recordings").insert({
          zoom_account_id: account.id,
          zoom_recording_id: recording.uuid,
          topic: recording.topic,
          start_time: recording.start_time,
          duration: recording.duration,
          video_url: videoFile.download_url,
          status: "ready",
        } as never)

        if (!insertError) {
          results.newRecordings++
        }
      }

      results.synced++

      await supabase
        .from("zoom_accounts")
        .update({ last_synced_at: new Date().toISOString() } as never)
        .eq("id", account.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      results.errors.push(`${account.display_name}: ${message}`)
      console.error(`[Cron Sync Error] ${account.display_name}:`, message)
    }
  }

  return results
}

export async function POST(request: Request) {
  // 1. 環境変数のチェック
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET not configured")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  // 2. 認証ヘッダーのチェック
  const authHeader = request.headers.get("Authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 3. Vercel Cron 署名のチェック（本番環境のみ）
  const vercelSignature = request.headers.get("x-vercel-cron-signature")
  const isDev = process.env.NODE_ENV !== "production"

  if (!isDev && !vercelSignature) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    console.log("[Cron] Starting Zoom sync...")
    const startTime = Date.now()
    const data = await syncZoomRecordings()
    const duration = Date.now() - startTime

    console.log(`[Cron] Sync completed in ${duration}ms:`, data)

    return NextResponse.json({
      success: true,
      data,
      duration_ms: duration,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown internal error"
    console.error("[Cron Sync Fatal Error]", message)

    return NextResponse.json({
      success: false,
      error: message,
    }, { status: 500 })
  }
}

// VercelはGETでもCronを実行できるようにする
export async function GET(request: Request) {
  return POST(request)
}
