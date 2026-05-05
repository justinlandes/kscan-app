/**
 * K-SCAN service layer. All backend communication lives here.
 *
 * Base URL resolution (in priority order):
 *   1. EXPO_PUBLIC_API_URL in .env (set per environment — see README)
 *   2. Android emulator default: http://10.0.2.2:3001
 *   3. Fallback: http://localhost:3001 (iOS simulator only)
 *
 * Environment guide:
 *   Local dev (iOS sim):    EXPO_PUBLIC_API_URL=http://localhost:3001
 *   Local dev (Android em): EXPO_PUBLIC_API_URL=http://10.0.2.2:3001
 *   Physical device:        EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3001
 *   Hosted beta backend:    EXPO_PUBLIC_API_URL=https://api.yourdomain.com
 */

import { Platform } from 'react-native';

// 25 seconds — must exceed the server's 15-second AI timeout plus network
// round-trip, so the client waits for the server's own error response rather
// than timing out first and showing a generic network error.
const ANALYZE_TIMEOUT_MS = 25000;

function resolveBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim()) return envUrl.trim();
  // Android emulator loopback — 10.0.2.2 maps to the host machine
  if (Platform.OS === 'android') return 'http://10.0.2.2:3001';
  return 'http://localhost:3001';
}

/**
 * POST image to /api/analyze.
 * Returns one of:
 *   { type: 'fashion', result, metadata, products }
 *   { type: 'non-fashion', message }
 * Throws on network failure, server error, or timeout.
 */
export async function analyzeImage(base64) {
  const base = resolveBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);

  try {
    const response = await fetch(`${base}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Guard: try parsing JSON; surface a clean error if the server sent garbage
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Server returned an unreadable response (${response.status}).`);
    }

    if (!response.ok) {
      // Server sent a structured error message — surface it
      throw new Error(data?.result || `Server error (${response.status}). Please try again.`);
    }

    // Non-fashion: return a distinct result type so the UI can show a tailored message
    if (data.type === 'non-fashion') {
      return {
        type: 'non-fashion',
        message: data.message || "This doesn't appear to be a fashion item.",
      };
    }

    return {
      type: 'fashion',
      result: data.result ?? '',
      metadata: data.metadata ?? { category: '', color: '', silhouette: '' },
      products: Array.isArray(data.products) ? data.products : [],
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(
        'Analysis timed out. Check your Wi-Fi and make sure the K-Scan server is running.'
      );
    }
    throw err;
  }
}
