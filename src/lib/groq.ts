import Groq from "groq-sdk"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export interface TranscriptSegment {
  start: number  // ミリ秒
  end: number    // ミリ秒
  text: string
  speaker?: string
}

interface VerboseTranscription {
  text: string
  segments?: {
    start?: number
    end?: number
    text?: string
  }[]
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string
): Promise<TranscriptSegment[]> {
  // BufferをBlobに変換してからFileを作成
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/mp4" })
  const file = new File([blob], filename, { type: "audio/mp4" })

  const transcription = await groq.audio.transcriptions.create({
    file: file,
    model: "whisper-large-v3",
    response_format: "verbose_json",
    language: "ja",
  }) as unknown as VerboseTranscription

  // セグメントを変換
  const segments: TranscriptSegment[] = []

  if (transcription.segments && transcription.segments.length > 0) {
    for (const seg of transcription.segments) {
      segments.push({
        start: Math.round((seg.start || 0) * 1000),
        end: Math.round((seg.end || 0) * 1000),
        text: seg.text || "",
      })
    }
  } else {
    // セグメントがない場合は全体を1つとして返す
    segments.push({
      start: 0,
      end: 0,
      text: transcription.text || "",
    })
  }

  return segments
}

// URLから音声をダウンロードして文字起こし
export async function transcribeFromUrl(
  audioUrl: string
): Promise<TranscriptSegment[]> {
  const response = await fetch(audioUrl)
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // URLからファイル名を推測
  const filename = audioUrl.split("/").pop() || "audio.mp4"

  return transcribeAudio(buffer, filename)
}
