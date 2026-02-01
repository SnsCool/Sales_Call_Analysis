// 分析パイプラインのテスト（モックデータ使用）
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY

// モック文字起こしデータ（コンプライアンス違反を含む）
const mockTranscript = [
  { start: 0, end: 5000, text: "はい、本日はお時間いただきありがとうございます。", speaker: "営業" },
  { start: 5000, end: 12000, text: "まずは弊社のサービスについてご説明させていただきますね。", speaker: "営業" },
  { start: 12000, end: 20000, text: "このサービスを使えば、絶対に成果が出ます。月100万円は確実に稼げますよ。", speaker: "営業" },
  { start: 20000, end: 28000, text: "本当ですか？でも初期費用が高いですよね...", speaker: "顧客" },
  { start: 28000, end: 38000, text: "大丈夫です！消費者金融で借りれば問題ありません。皆さんそうしてますよ。", speaker: "営業" },
  { start: 38000, end: 48000, text: "うーん、少し考えさせてください。", speaker: "顧客" },
  { start: 48000, end: 58000, text: "今ここで決めないと、もう二度と入会できませんよ。一生このチャンスを逃すことになります。", speaker: "営業" },
  { start: 58000, end: 65000, text: "わかりました...じゃあ申し込みます。", speaker: "顧客" },
  { start: 65000, end: 75000, text: "ありがとうございます！保証制度の詳細はあとでLINEで送りますね。", speaker: "営業" },
]

async function getKnowledgeRules() {
  console.log('=== ナレッジルール取得 ===')
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/knowledge_rules?is_active=eq.true&select=id,title,content,prompt_instructions',
    {
      headers: {
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'apikey': SUPABASE_KEY
      }
    }
  )
  const rules = await res.json()
  console.log('取得件数:', rules.length)
  return rules
}

async function analyzeWithGemini(transcript, rules) {
  console.log('\n=== Gemini分析実行 ===')

  const transcriptText = transcript
    .map(seg => `[${formatTime(seg.start)} - ${formatTime(seg.end)}] ${seg.speaker}: ${seg.text}`)
    .join('\n')

  const rulesText = rules
    .map(r => `- ${r.title}: ${r.content}`)
    .join('\n')

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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_AI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048
        }
      })
    }
  )

  if (!res.ok) {
    throw new Error('Gemini API error: ' + await res.text())
  }

  const data = await res.json()
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // JSONを抽出
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.log('Raw response:', responseText)
    throw new Error('Failed to parse JSON from response')
  }

  return JSON.parse(jsonMatch[0])
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

async function runTest() {
  console.log('========================================')
  console.log('  分析パイプラインテスト')
  console.log('========================================')
  console.log('モック文字起こしを使用（意図的にコンプラ違反を含む）\n')

  try {
    // ナレッジルール取得
    const rules = await getKnowledgeRules()

    // Gemini分析
    const result = await analyzeWithGemini(mockTranscript, rules)

    console.log('\n=== 分析結果 ===')
    console.log('検出された問題:', result.issues.length, '件\n')

    result.issues.forEach((issue, i) => {
      console.log(`--- 問題 ${i + 1} ---`)
      console.log(`時間: ${formatTime(issue.start_ms)} - ${formatTime(issue.end_ms)}`)
      console.log(`ルール: ${issue.rule_name}`)
      console.log(`重大度: ${issue.severity}`)
      console.log(`理由: ${issue.reason}`)
      console.log(`提案: ${issue.suggestion}`)
      console.log('')
    })

    console.log('=== 通話サマリー ===')
    console.log(result.summary)

    console.log('\n✅ 分析パイプラインテスト成功!')

  } catch (e) {
    console.log('\n❌ テスト失敗:', e.message)
  }
}

runTest()
