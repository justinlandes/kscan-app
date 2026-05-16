const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyRestV1RootResponse,
  classifyEnsurePrivacySettingsUnauthenticated,
} = require('../scripts/verify-supabase-helpers');

test('REST root: 401 without Bearer is INFO not credential failure', () => {
  const r = classifyRestV1RootResponse(401, { hadAuthorizationBearer: false });
  assert.equal(r.level, 'INFO');
  assert.match(r.detail, /Authorization/i);
});

test('REST root: 401 with Bearer anon is WARN (possible bad key)', () => {
  const r = classifyRestV1RootResponse(401, { hadAuthorizationBearer: true });
  assert.equal(r.level, 'WARN');
});

test('REST root: 200 is PASS', () => {
  const r = classifyRestV1RootResponse(200, { hadAuthorizationBearer: true });
  assert.equal(r.level, 'PASS');
});

test('ensure_privacy_settings unauthenticated: 403 is PASS', () => {
  const r = classifyEnsurePrivacySettingsUnauthenticated(403);
  assert.equal(r.level, 'PASS');
});

test('ensure_privacy_settings unauthenticated: 401 is PASS', () => {
  const r = classifyEnsurePrivacySettingsUnauthenticated(401);
  assert.equal(r.level, 'PASS');
});

test('ensure_privacy_settings unauthenticated: 404 is BLOCKER', () => {
  const r = classifyEnsurePrivacySettingsUnauthenticated(404);
  assert.equal(r.level, 'BLOCKER');
});

test('ensure_privacy_settings unauthenticated: 200 is WARN', () => {
  const r = classifyEnsurePrivacySettingsUnauthenticated(200);
  assert.equal(r.level, 'WARN');
});
