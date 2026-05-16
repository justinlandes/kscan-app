const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getAuthCallbackRedirect,
  parseAuthCallbackUrl,
} = require('../services/authDeepLink');

test('parseAuthCallbackUrl reads Supabase tokens from hash fragment', () => {
  const parsed = parseAuthCallbackUrl(
    'kscan://auth/callback#access_token=access123&refresh_token=refresh456&type=signup',
  );

  assert.equal(parsed.accessToken, 'access123');
  assert.equal(parsed.refreshToken, 'refresh456');
  assert.equal(parsed.type, 'signup');
  assert.equal(parsed.hasSessionTokens, true);
  assert.equal(getAuthCallbackRedirect(parsed), '/privacy');
});

test('parseAuthCallbackUrl falls back to query string tokens', () => {
  const parsed = parseAuthCallbackUrl(
    'kscan://auth/callback?access_token=access123&refresh_token=refresh456&type=email_change',
  );

  assert.equal(parsed.accessToken, 'access123');
  assert.equal(parsed.refreshToken, 'refresh456');
  assert.equal(parsed.type, 'email_change');
  assert.equal(parsed.hasSessionTokens, true);
  assert.equal(getAuthCallbackRedirect(parsed), '/privacy');
});

test('parseAuthCallbackUrl routes recovery links to update password', () => {
  const parsed = parseAuthCallbackUrl(
    'kscan://auth/callback#access_token=access123&refresh_token=refresh456&type=recovery',
  );

  assert.equal(parsed.isRecovery, true);
  assert.equal(getAuthCallbackRedirect(parsed), '/auth/update-password');
});

test('parseAuthCallbackUrl detects code-based callbacks', () => {
  const parsed = parseAuthCallbackUrl('kscan://auth/callback?code=abc123&type=recovery');

  assert.equal(parsed.code, 'abc123');
  assert.equal(parsed.hasSessionTokens, false);
  assert.equal(getAuthCallbackRedirect(parsed), '/auth/update-password');
});

test('parseAuthCallbackUrl handles malformed tokenless links safely', () => {
  const parsed = parseAuthCallbackUrl('kscan://auth/callback#invalid');

  assert.equal(parsed.hasSessionTokens, false);
  assert.equal(parsed.accessToken, null);
  assert.equal(parsed.refreshToken, null);
});
