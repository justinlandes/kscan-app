function parseParamString(value) {
  const params = {};
  if (!value) return params;
  const trimmed = value.replace(/^[?#]/, '');
  if (!trimmed) return params;

  for (const pair of trimmed.split('&')) {
    if (!pair) continue;
    const [rawKey, ...rawValue] = pair.split('=');
    const key = decodeURIComponent(rawKey || '');
    if (!key) continue;
    params[key] = decodeURIComponent(rawValue.join('=') || '');
  }
  return params;
}

function parseAuthCallbackUrl(url) {
  const source = String(url || '');
  const hashIndex = source.indexOf('#');
  const queryIndex = source.indexOf('?');

  const hashParams = hashIndex >= 0 ? parseParamString(source.slice(hashIndex + 1)) : {};
  const queryEnd = hashIndex >= 0 ? hashIndex : source.length;
  const queryParams =
    queryIndex >= 0 && queryIndex < queryEnd
      ? parseParamString(source.slice(queryIndex + 1, queryEnd))
      : {};

  const params = { ...queryParams, ...hashParams };
  const accessToken = params.access_token || null;
  const refreshToken = params.refresh_token || null;
  const type = params.type || null;
  const code = params.code || null;
  const error = params.error_description || params.error || null;

  return {
    accessToken,
    refreshToken,
    type,
    code,
    error,
    hasSessionTokens: Boolean(accessToken && refreshToken),
    isRecovery: type === 'recovery',
  };
}

function getAuthCallbackRedirect(parsed) {
  if (parsed.isRecovery) return '/auth/update-password';
  return '/privacy';
}

module.exports = {
  parseAuthCallbackUrl,
  getAuthCallbackRedirect,
};
