/**
 * Pure helpers for Supabase connectivity classification (unit-tested).
 * Keep logic free of I/O so CI can validate diagnostics without env vars.
 */

/**
 * PostgREST often returns 401 for GET /rest/v1/ when the `Authorization`
 * header is omitted — even if `apikey` is present. That is not evidence that
 * the project URL is wrong or that the anon key is invalid.
 */
function classifyRestV1RootResponse(status, { hadAuthorizationBearer }) {
  if (status >= 200 && status < 300) {
    return { level: 'PASS', detail: 'PostgREST root responded successfully.' };
  }
  if (status === 401 && !hadAuthorizationBearer) {
    return {
      level: 'INFO',
      detail:
        'HTTP 401 without Authorization — expected for many PostgREST configs. Real clients send apikey + `Authorization: Bearer <anon JWT>`.',
    };
  }
  if (status === 401 && hadAuthorizationBearer) {
    return {
      level: 'WARN',
      detail:
        'HTTP 401 even with Bearer anon — verify EXPO_PUBLIC_SUPABASE_ANON_KEY matches Project Settings → API (JWT role should be `anon`).',
    };
  }
  if (status === 404) {
    return {
      level: 'WARN',
      detail:
        'HTTP 404 on PostgREST root — unusual for Supabase hosted; confirm EXPO_PUBLIC_SUPABASE_URL (no trailing junk path).',
    };
  }
  return {
    level: 'WARN',
    detail: `HTTP ${status} — see Supabase dashboard / network tab for details.`,
  };
}

/**
 * Unauthenticated RPC call: no user JWT. Expect rejection if RPC is deployed and locked down.
 */
function classifyEnsurePrivacySettingsUnauthenticated(status) {
  if (status === 401 || status === 403) {
    return {
      level: 'PASS',
      detail:
        `HTTP ${status} without a user session — correct: ensure_privacy_settings() requires an authenticated user (not anon browsing).`,
    };
  }
  if (status === 404) {
    return {
      level: 'BLOCKER',
      detail:
        'HTTP 404 — RPC missing or wrong path. Apply supabase/migrations/202605130001_privacy_settings.sql (and dependency migrations).',
    };
  }
  if (status === 200) {
    return {
      level: 'WARN',
      detail:
        'HTTP 200 without auth — unexpected for ensure_privacy_settings; confirm grants are restricted to `authenticated`.',
    };
  }
  return { level: 'WARN', detail: `HTTP ${status} — inspect response body in dashboard logs.` };
}

module.exports = {
  classifyRestV1RootResponse,
  classifyEnsurePrivacySettingsUnauthenticated,
};
