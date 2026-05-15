/**
 * K Scan AI — Supabase Auth Verification
 *
 * Run: node scripts/verify-supabase.js
 *
 * Checks that the required Supabase env vars are present and that the project
 * URL is reachable before you attempt a live auth + privacy persistence test.
 */

require('dotenv').config();

const REQUIRED_VARS = [
  ['EXPO_PUBLIC_SUPABASE_URL', 'Supabase project URL (e.g. https://xxx.supabase.co)'],
  ['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'Supabase anon/public key'],
];

const OPTIONAL_VARS = [
  ['EXPO_PUBLIC_SUPABASE_ACCESS_TOKEN', 'DEV-ONLY token override (not needed for normal auth)'],
];

console.log('\n── K Scan AI Supabase Verification ──────────────────────────────────────\n');

let allPresent = true;

for (const [key, description] of REQUIRED_VARS) {
  const val = process.env[key];
  if (!val) {
    console.error(`  ✗ ${key} — MISSING`);
    console.error(`    ${description}`);
    allPresent = false;
  } else {
    const masked = val.length > 12 ? val.slice(0, 8) + '...' + val.slice(-4) : '***';
    console.log(`  ✓ ${key} = ${masked}`);
  }
}

for (const [key, description] of OPTIONAL_VARS) {
  const val = process.env[key];
  if (val) {
    const masked = val.length > 12 ? val.slice(0, 8) + '...' + val.slice(-4) : '***';
    console.warn(`  ! ${key} = ${masked}  (DEV token override is active)`);
  } else {
    console.log(`  – ${key} = not set  (${description})`);
  }
}

if (!allPresent) {
  console.error('\n✗ Required Supabase env vars are missing. Add them to your .env file:');
  console.error('\n  EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.error('  EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key\n');
  console.error('  Find these in: Supabase Dashboard → Project Settings → API\n');
  process.exit(1);
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('\n── Connectivity Check ───────────────────────────────────────────────────\n');

async function checkHealth() {
  // Hit the Supabase REST root — should return a JSON response even unauthenticated
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: anonKey },
  });
  return { ok: res.ok, status: res.status };
}

async function checkRpc() {
  // Call ensure_privacy_settings without a token — expect 401 (auth required), NOT 404
  const res = await fetch(`${url}/rest/v1/rpc/ensure_privacy_settings`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const text = await res.text();
  return { status: res.status, body: text.slice(0, 200) };
}

(async () => {
  try {
    const health = await checkHealth();
    if (health.ok || health.status === 400) {
      console.log(`  ✓ Supabase REST endpoint reachable (HTTP ${health.status})`);
    } else {
      console.warn(`  ! Supabase REST returned HTTP ${health.status} — check your URL`);
    }
  } catch (err) {
    console.error(`  ✗ Cannot reach Supabase URL: ${err.message}`);
    console.error('    Check EXPO_PUBLIC_SUPABASE_URL and your network connection.');
    process.exit(1);
  }

  try {
    const rpc = await checkRpc();
    if (rpc.status === 401 || rpc.status === 403) {
      console.log(`  ✓ ensure_privacy_settings RPC exists and requires auth (HTTP ${rpc.status}) — RLS is active`);
    } else if (rpc.status === 200) {
      console.warn(`  ! ensure_privacy_settings returned 200 without auth — check RLS policies`);
    } else {
      console.warn(`  ! ensure_privacy_settings returned HTTP ${rpc.status}: ${rpc.body}`);
      if (rpc.status === 404) {
        console.error('    The RPC may not be deployed. Run supabase/migrations/202605130001_privacy_settings.sql.');
      }
    }
  } catch (err) {
    console.error(`  ✗ RPC check failed: ${err.message}`);
  }

  console.log('\n── Next Steps ───────────────────────────────────────────────────────────\n');
  console.log('  1. Start the Expo dev server:');
  console.log('     npm start  (or: EXPO_PUBLIC_API_URL=https://kscan-app-1.onrender.com npm start)');
  console.log('  2. Open the app in the Android emulator or on-device.');
  console.log('  3. Tap PRIVACY CONTROL on the home screen.');
  console.log('     → Sync status chip should show "Saved to Device" (signed out).');
  console.log('     → "SIGN IN TO SYNC" banner should appear.');
  console.log('  4. Tap the sign-in banner → /auth screen opens.');
  console.log('  5. Enter credentials for a test Supabase user.');
  console.log('     (Create one at: Supabase Dashboard → Authentication → Users → Add user)');
  console.log('  6. After sign-in, Privacy screen should show:');
  console.log('     → Sync status chip: "Saved to Account"');
  console.log('     → Toggle subtitle: "linked to your K Scan account and saved securely"');
  console.log('  7. Toggle "Do Not Sell or Share" ON.');
  console.log('     → Check Supabase Dashboard → Table Editor → privacy_settings');
  console.log('     → Row for your user should have opt_out_of_sale = true');
  console.log('  8. Close and reopen the app.');
  console.log('     → Privacy screen should reload with opt_out_of_sale = true from Supabase.');
  console.log('  9. Sign out → chip shows "Saved to Device", sign-in CTA reappears.');
  console.log(' 10. Sign back in → prior remote preference (opt_out_of_sale = true) is preserved.');
  console.log('\n─────────────────────────────────────────────────────────────────────────\n');
})();
