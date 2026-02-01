// 全Zoomアカウントの録画を確認
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function checkAllRecordings() {
  console.log('=== 全Zoomアカウントの録画確認 ===\n')

  // 全アカウント取得
  const accRes = await fetch(
    SUPABASE_URL + '/rest/v1/zoom_accounts?select=id,display_name,zoom_account_id,client_id,client_secret&is_active=eq.true',
    {
      headers: {
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'apikey': SUPABASE_KEY
      }
    }
  )
  const accounts = await accRes.json()
  console.log('アカウント数:', accounts.length, '\n')

  let totalRecordings = 0
  const accountsWithRecordings = []

  for (const acc of accounts) {
    if (!acc.client_id || !acc.client_secret) {
      continue
    }

    try {
      // OAuth認証
      const credentials = Buffer.from(acc.client_id + ':' + acc.client_secret).toString('base64')
      const tokenRes = await fetch(
        'https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + acc.zoom_account_id,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + credentials,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )

      if (!tokenRes.ok) {
        console.log('❌', acc.display_name, '- 認証失敗')
        continue
      }

      const token = await tokenRes.json()

      // 過去3ヶ月の録画を取得
      const from = new Date()
      from.setMonth(from.getMonth() - 3)
      const to = new Date()

      const recordingsRes = await fetch(
        `https://api.zoom.us/v2/users/me/recordings?from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}`,
        {
          headers: {
            'Authorization': 'Bearer ' + token.access_token
          }
        }
      )

      if (!recordingsRes.ok) {
        console.log('⚠️', acc.display_name, '- 録画取得エラー')
        continue
      }

      const recordings = await recordingsRes.json()
      const count = recordings.total_records || 0

      if (count > 0) {
        console.log('✅', acc.display_name, '-', count, '件の録画')
        totalRecordings += count
        accountsWithRecordings.push({
          name: acc.display_name,
          count: count,
          meetings: recordings.meetings
        })
      } else {
        console.log('○', acc.display_name, '- 録画なし')
      }

    } catch (e) {
      console.log('❌', acc.display_name, '-', e.message)
    }
  }

  console.log('\n========================================')
  console.log('合計録画数:', totalRecordings)
  console.log('録画があるアカウント:', accountsWithRecordings.length)

  if (accountsWithRecordings.length > 0) {
    console.log('\n=== 録画の詳細 ===')
    for (const acc of accountsWithRecordings) {
      console.log('\n【' + acc.name + '】')
      acc.meetings.slice(0, 3).forEach(m => {
        console.log('  -', m.topic, '(' + m.start_time.split('T')[0] + ')')
      })
      if (acc.count > 3) {
        console.log('  ... 他', acc.count - 3, '件')
      }
    }
  }
}

checkAllRecordings()
