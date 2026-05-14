const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let accessToken = process.env.EXPO_PUBLIC_SUPABASE_ACCESS_TOKEN;

export function setPrivacyAccessToken(token) {
  accessToken = token;
}

function getSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    accessToken,
    configured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && accessToken),
  };
}

function assertConfigured() {
  const config = getSupabaseConfig();
  if (!config.configured) {
    throw new Error('Supabase privacy controls require EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, and an authenticated access token.');
  }
  return config;
}

async function supabaseFetch(path, options = {}) {
  const config = assertConfigured();
  const response = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(typeof data === 'string' ? data : data?.error || data?.message || `Supabase request failed (${response.status})`);
  }

  return data;
}

export function isPrivacyBackendConfigured() {
  return getSupabaseConfig().configured;
}

export async function ensurePrivacySettings() {
  return supabaseFetch('/rest/v1/rpc/ensure_privacy_settings', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchProfile() {
  const rows = await supabaseFetch('/rest/v1/profiles?select=id,account_status,age_group,deletion_requested_at,account_locked_at', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  return Array.isArray(rows) ? rows[0] ?? { age_group: 'unknown', account_status: 'active' } : rows;
}

export async function updatePrivacySettings(patch) {
  const rows = await supabaseFetch('/rest/v1/privacy_settings?select=*', {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function requestDeletion() {
  return supabaseFetch('/functions/v1/handle-user-deletion', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function requestDataExport() {
  return supabaseFetch('/functions/v1/privacy-data-export', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function requestCorrection(requestedChanges) {
  return supabaseFetch('/functions/v1/privacy-correction-request', {
    method: 'POST',
    body: JSON.stringify({ requested_changes: requestedChanges }),
  });
}
