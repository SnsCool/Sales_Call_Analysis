require('dotenv').config({ path: '.env.local' })
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function testZoomAuth() {
  // Zoomアカウント取得
  const accRes = await fetch(SUPABASE_URL + '/rest/v1/zoom_accounts?select=*&limit=1', {
    headers: {
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'apikey': SUPABASE_KEY
    }
  });
  const accounts = await accRes.json();
  const acc = accounts[0];

  console.log('=== Zoom API認証テスト ===');
  console.log('アカウント:', acc.display_name);
  console.log('Account ID:', acc.zoom_account_id);
  console.log('Client ID:', acc.client_id ? acc.client_id.substring(0, 8) + '...' : '未設定');

  if (!acc.client_id || !acc.client_secret) {
    console.log('❌ 認証情報が未設定');
    return;
  }

  // Server-to-Server OAuth
  const credentials = Buffer.from(acc.client_id + ':' + acc.client_secret).toString('base64');
  const tokenRes = await fetch(
    'https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + acc.zoom_account_id,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + credentials,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.log('❌ 認証失敗:', err);
    return;
  }

  const token = await tokenRes.json();
  console.log('✅ 認証成功!');
  console.log('   有効期限:', token.expires_in, '秒');

  // 録画一覧を取得テスト
  console.log('\n=== 録画一覧取得テスト ===');
  const recordingsRes = await fetch(
    'https://api.zoom.us/v2/users/me/recordings?from=2025-01-01&to=2025-01-31',
    {
      headers: {
        'Authorization': 'Bearer ' + token.access_token
      }
    }
  );

  if (!recordingsRes.ok) {
    const err = await recordingsRes.text();
    console.log('❌ 録画取得失敗:', err);
    return;
  }

  const recordings = await recordingsRes.json();
  console.log('✅ 録画取得成功!');
  console.log('   件数:', recordings.total_records || 0);
  if (recordings.meetings && recordings.meetings.length > 0) {
    console.log('   最新:', recordings.meetings[0].topic);
  }
}

testZoomAuth().catch(e => console.log('エラー:', e.message));
