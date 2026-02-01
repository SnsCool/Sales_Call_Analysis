const SUPABASE_URL = 'https://fpgitbbtawpuiwtjlipk.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZ2l0YmJ0YXdwdWl3dGpsaXBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTgzNTMyNCwiZXhwIjoyMDg1NDExMzI0fQ.M7IZPUNocJxJA7KTIH7v9tq7uOCgKMj_QudmsjV4jnQ';

async function createUser(email, password, fullName, role) {
  const authRes = await fetch(SUPABASE_URL + '/auth/v1/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + SERVICE_ROLE_KEY,
      'apikey': SERVICE_ROLE_KEY
    },
    body: JSON.stringify({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })
  });

  const result = await authRes.json();

  if (result.id) {
    if (role === 'admin') {
      await fetch(SUPABASE_URL + '/rest/v1/profiles?id=eq.' + result.id, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SERVICE_ROLE_KEY,
          'apikey': SERVICE_ROLE_KEY
        },
        body: JSON.stringify({ role: 'admin', full_name: fullName })
      });
    }
    console.log('Created: ' + email + ' (' + role + ')');
  } else {
    console.log('Error for ' + email + ': ' + JSON.stringify(result));
  }
  return result;
}

async function main() {
  console.log('Creating test users...\n');

  await createUser('admin@example.com', 'Admin123!', '管理者', 'admin');
  await createUser('sales1@example.com', 'Sales123!', '営業太郎', 'sales');
  await createUser('sales2@example.com', 'Sales123!', '営業花子', 'sales');

  const res = await fetch(SUPABASE_URL + '/rest/v1/profiles?select=email,full_name,role', {
    headers: {
      'Authorization': 'Bearer ' + SERVICE_ROLE_KEY,
      'apikey': SERVICE_ROLE_KEY
    }
  });

  console.log('\nProfiles:');
  console.log(JSON.stringify(await res.json(), null, 2));

  console.log('\nLogin credentials:');
  console.log('  Admin:  admin@example.com / Admin123!');
  console.log('  Sales1: sales1@example.com / Sales123!');
  console.log('  Sales2: sales2@example.com / Sales123!');
}

main().catch(console.error);
