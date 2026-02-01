// Zoom Server-to-Server OAuth API

interface ZoomToken {
  access_token: string
  expires_at: number
}

const tokenCache = new Map<string, ZoomToken>()

export async function getZoomAccessToken(
  accountId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const cacheKey = `${accountId}:${clientId}`
  const cached = tokenCache.get(cacheKey)

  // キャッシュが有効なら返す（5分前に期限切れとみなす）
  if (cached && cached.expires_at > Date.now() + 5 * 60 * 1000) {
    return cached.access_token
  }

  // 新しいトークンを取得
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=account_credentials&account_id=${accountId}`,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Zoom OAuth failed: ${error}`)
  }

  const data = await response.json()

  // キャッシュに保存
  tokenCache.set(cacheKey, {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in * 1000),
  })

  return data.access_token
}

export interface ZoomRecordingFile {
  id: string
  file_type: string
  download_url: string
  play_url: string
  file_size: number
  status: string
}

export interface ZoomRecording {
  id: string
  uuid: string
  topic: string
  start_time: string
  duration: number
  recording_files: ZoomRecordingFile[]
}

export interface ZoomRecordingsResponse {
  meetings: ZoomRecording[]
  next_page_token?: string
}

export async function getZoomRecordings(
  accessToken: string,
  userId: string = "me",
  from?: string,
  to?: string
): Promise<ZoomRecording[]> {
  const params = new URLSearchParams()
  if (from) params.set("from", from)
  if (to) params.set("to", to)

  const url = `https://api.zoom.us/v2/users/${userId}/recordings?${params}`

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Zoom API failed: ${error}`)
  }

  const data: ZoomRecordingsResponse = await response.json()
  return data.meetings || []
}

export async function downloadZoomRecording(
  accessToken: string,
  downloadUrl: string
): Promise<Buffer> {
  // Zoomのダウンロードリンクにはトークンが必要
  const urlWithToken = `${downloadUrl}?access_token=${accessToken}`

  const response = await fetch(urlWithToken)

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
