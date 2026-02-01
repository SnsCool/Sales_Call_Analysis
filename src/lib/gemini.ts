import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"

// 遅延初期化でビルド時のエラーを回避
let geminiModel: GenerativeModel | null = null

function getGeminiModel(): GenerativeModel {
  if (!geminiModel) {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "")
    geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
  }
  return geminiModel
}

export interface AnalysisResult {
  issues: {
    start_ms: number
    end_ms: number
    rule_id: string
    rule_name: string
    severity: "info" | "warning" | "error"
    reason: string
    suggestion: string
  }[]
  summary: string
}

export async function analyzeTranscript(
  transcript: { start: number; end: number; text: string; speaker?: string }[],
  knowledgeRules: { id: string; title: string; content: string; prompt_instructions?: string }[]
): Promise<AnalysisResult> {
  const transcriptText = transcript
    .map((seg) => `[${formatTime(seg.start)} - ${formatTime(seg.end)}] ${seg.speaker || "話者"}: ${seg.text}`)
    .join("\n")

  const rulesText = knowledgeRules
    .map((rule) => `- ${rule.title}: ${rule.content}${rule.prompt_instructions ? ` (${rule.prompt_instructions})` : ""}`)
    .join("\n")

  const prompt = `あなたは営業通話の品質分析AIです。以下の文字起こしを分析し、問題箇所を特定してください。

## 分析ルール
${rulesText}

## 文字起こし
${transcriptText}

## 出力形式（JSON）
以下の形式で出力してください：
{
  "issues": [
    {
      "start_ms": 開始時間（ミリ秒）,
      "end_ms": 終了時間（ミリ秒）,
      "rule_id": "該当ルールID",
      "rule_name": "ルール名",
      "severity": "error" | "warning" | "info",
      "reason": "問題の理由",
      "suggestion": "改善提案"
    }
  ],
  "summary": "通話全体の要約（2-3文）"
}

JSONのみを出力してください。`

  const gemini = getGeminiModel()
  const result = await gemini.generateContent(prompt)
  const response = result.response.text()

  // JSONを抽出
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error("Failed to parse AI response")
  }

  return JSON.parse(jsonMatch[0]) as AnalysisResult
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}
