// 各コンポーネントのテストスクリプト
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY

async function testSupabase() {
  console.log('\n=== 1. Supabase接続テスト ===')
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_rules?select=count&is_active=eq.true`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=exact'
      }
    })
    const count = res.headers.get('content-range')
    console.log('✅ Supabase接続成功')
    console.log(`   ナレッジルール数: ${count}`)
    return true
  } catch (e) {
    console.log('❌ Supabase接続失敗:', e.message)
    return false
  }
}

async function testZoomAccounts() {
  console.log('\n=== 2. Zoomアカウント確認 ===')
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/zoom_accounts?select=id,account_id,email,is_active`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    })
    const accounts = await res.json()
    console.log(`✅ Zoomアカウント: ${accounts.length}件登録済み`)
    const active = accounts.filter(a => a.is_active).length
    console.log(`   有効: ${active}件`)
    return accounts[0] // 最初のアカウントを返す
  } catch (e) {
    console.log('❌ Zoomアカウント取得失敗:', e.message)
    return null
  }
}

async function testZoomAuth(account) {
  console.log('\n=== 3. Zoom API認証テスト ===')
  if (!account) {
    console.log('⏭️  アカウント情報なし、スキップ')
    return false
  }

  try {
    // Server-to-Server OAuth token取得
    const credentials = Buffer.from(`${account.client_id}:${account.client_secret}`).toString('base64')
    const tokenRes = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${account.account_id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.log('❌ Zoom認証失敗:', err)
      return false
    }

    const token = await tokenRes.json()
    console.log('✅ Zoom API認証成功')
    console.log(`   トークン有効期限: ${token.expires_in}秒`)
    return token.access_token
  } catch (e) {
    console.log('❌ Zoom API認証エラー:', e.message)
    return false
  }
}

async function testGroq() {
  console.log('\n=== 4. Groq API テスト ===')
  if (!GROQ_API_KEY) {
    console.log('❌ GROQ_API_KEY が設定されていません')
    return false
  }

  try {
    // Groq APIのモデル一覧を取得してテスト
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`
      }
    })

    if (!res.ok) {
      console.log('❌ Groq API接続失敗:', await res.text())
      return false
    }

    const data = await res.json()
    const whisperModel = data.data.find(m => m.id.includes('whisper'))
    console.log('✅ Groq API接続成功')
    console.log(`   Whisperモデル: ${whisperModel ? whisperModel.id : '利用可能'}`)
    return true
  } catch (e) {
    console.log('❌ Groq APIエラー:', e.message)
    return false
  }
}

async function testGemini() {
  console.log('\n=== 5. Gemini API テスト ===')
  if (!GOOGLE_AI_API_KEY) {
    console.log('❌ GOOGLE_AI_API_KEY が設定されていません')
    return false
  }

  try {
    // 簡単なテストプロンプト
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_AI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Say "API OK" in 2 words' }]
        }]
      })
    })

    if (!res.ok) {
      const err = await res.text()
      console.log('❌ Gemini API接続失敗:', err)
      return false
    }

    const data = await res.json()
    const response = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    console.log('✅ Gemini API接続成功')
    console.log(`   レスポンス: ${response.trim()}`)
    return true
  } catch (e) {
    console.log('❌ Gemini APIエラー:', e.message)
    return false
  }
}

async function testTranscription() {
  console.log('\n=== 6. 文字起こしテスト（サンプル音声） ===')
  // 実際の音声ファイルがないのでスキップ
  console.log('⏭️  実際のZoom録画が必要なためスキップ')
  console.log('   → Zoom同期後に再テスト可能')
  return true
}

async function runAllTests() {
  console.log('========================================')
  console.log('  Sales Call Analysis コンポーネントテスト')
  console.log('========================================')

  const results = {
    supabase: await testSupabase(),
    zoomAccounts: await testZoomAccounts(),
    groq: await testGroq(),
    gemini: await testGemini(),
  }

  // Zoomアカウントの詳細を取得してZoom API認証テスト
  if (results.zoomAccounts) {
    const accountRes = await fetch(`${SUPABASE_URL}/rest/v1/zoom_accounts?select=*&limit=1`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    })
    const accounts = await accountRes.json()
    if (accounts[0]) {
      results.zoomAuth = await testZoomAuth(accounts[0])
    }
  }

  await testTranscription()

  console.log('\n========================================')
  console.log('  テスト結果サマリー')
  console.log('========================================')
  console.log(`Supabase:     ${results.supabase ? '✅' : '❌'}`)
  console.log(`Zoomアカウント: ${results.zoomAccounts ? '✅' : '❌'}`)
  console.log(`Zoom API認証:  ${results.zoomAuth ? '✅' : '❌'}`)
  console.log(`Groq API:     ${results.groq ? '✅' : '❌'}`)
  console.log(`Gemini API:   ${results.gemini ? '✅' : '❌'}`)
}

runAllTests()
