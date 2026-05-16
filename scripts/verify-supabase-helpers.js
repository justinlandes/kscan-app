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

function classifySchemaObjectProbe(status, { label, required }) {
  if (status >= 200 && status < 300) {
    return { level: 'PASS', detail: `${label} is visible through PostgREST.` };
  }
  if (status === 400) {
    // PostgREST returns 400 (not 404) when a select= query references columns that
    // do not exist in the live table. For required probes this is a schema-parity
    // BLOCKER — check the body preview for the exact missing column name.
    return {
      level: required ? 'BLOCKER' : 'WARN',
      detail: `${label} returned HTTP 400 — PostgREST rejected the column selection. One or more required columns are missing from the live schema. Apply the indicated migration and check the body preview for the exact error.`,
    };
  }
  if (status === 404) {
    return {
      level: required ? 'BLOCKER' : 'WARN',
      detail: `${label} is missing from the live PostgREST schema cache.`,
    };
  }
  if (status === 401 || status === 403) {
    return {
      level: required ? 'WARN' : 'INFO',
      detail: `${label} exists or is protected, but live visibility is restricted (HTTP ${status}). Confirm in Dashboard SQL/Table Editor.`,
    };
  }
  return {
    level: required ? 'WARN' : 'INFO',
    detail: `${label} returned HTTP ${status}. Confirm in Dashboard SQL/Table Editor.`,
  };
}

function classifyEdgeOptionsProbe(status, { label, required }) {
  if (status >= 200 && status < 300) {
    return { level: 'PASS', detail: `${label} Edge Function responded to OPTIONS.` };
  }
  if (status === 404) {
    return {
      level: required ? 'BLOCKER' : 'WARN',
      detail: `${label} Edge Function is not deployed or not reachable at the expected path.`,
    };
  }
  if (status === 401 || status === 403) {
    return {
      level: 'INFO',
      detail: `${label} Edge Function path exists but requires auth for this probe (HTTP ${status}).`,
    };
  }
  return {
    level: required ? 'WARN' : 'INFO',
    detail: `${label} Edge Function returned HTTP ${status}. Confirm deployment logs before treating it as live.`,
  };
}

module.exports = {
  classifyRestV1RootResponse,
  classifyEnsurePrivacySettingsUnauthenticated,
  classifySchemaObjectProbe,
  classifyEdgeOptionsProbe,
};
