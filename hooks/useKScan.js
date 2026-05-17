import { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeImage } from '../services/api';
import { compressForUpload } from '../services/imageUtils';
import {
  errorPulse,
  softImpact,
  successPulse,
  warningPulse,
} from '../services/haptics';

// ── E2E / Simulator mock ──────────────────────────────────────────────────────
// When EXPO_PUBLIC_E2E_MOCK_SCAN=true, capturePhoto bypasses the hardware
// camera so the full IDLE→CAPTURING→PREVIEW→PROCESSING→RESULT flow can be
// exercised on the iOS Simulator (where the camera is unavailable).
// All three layers (capture, compression, API) must have the flag set to true
// for a fully mocked end-to-end flow. Each layer is independently guarded.
const IS_E2E_MOCK = process.env.EXPO_PUBLIC_E2E_MOCK_SCAN === 'true';

// Placeholder URI — the value is ignored by the also-mocked compressForUpload.
const MOCK_PHOTO_URI = 'kscan-e2e-mock';
// ── End mock section ──────────────────────────────────────────────────────────

// Minimum time to stay in 'processing' so the PerceptionLayer HUD has time to
// complete its entry animation (~730ms) before the result card appears.
const MIN_ANALYSIS_MS = 600;

const VALID_TRANSITIONS = {
  idle: ['capturing'],
  capturing: ['preview', 'error'],
  preview: ['processing', 'idle'],
  // 'non-fashion' is a distinct success state — same visual path as result
  // but with a different message and no product shelf.
  processing: ['result', 'non-fashion', 'error'],
  result: ['idle'],
  'non-fashion': ['idle'],
  error: ['idle', 'preview'],
};

function warnInvalidTransition(from, to) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[useKScan] Invalid transition ignored: ${from} -> ${to}`);
  }
}

/**
 * K-SCAN scan state machine.
 * status: idle | capturing | preview | processing | result | non-fashion | error
 *
 * non-fashion: the AI confirmed the image is not a fashion item.
 *   analysis will be null; nonFashionMessage holds the AI's explanation.
 *   Resets to idle via dismissResult().
 */
export function useKScan() {
  const [status, setStatus] = useState('idle');
  const [photo, setPhoto] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [nonFashionMessage, setNonFashionMessage] = useState(null);
  const isMounted = useRef(true);
  // Synchronous locks — read before state updates propagate, so rapid taps that
  // arrive in the same event loop tick before React re-renders cannot trigger
  // duplicate captures or duplicate API calls.
  const captureInProgressRef = useRef(false);
  const analysisInProgressRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const capturePhoto = useCallback(
    async (cameraRef) => {
      // ── E2E mock capture ─────────────────────────────────────────────────────
      if (IS_E2E_MOCK) {
        if (captureInProgressRef.current || status !== 'idle') {
          warnInvalidTransition(status, 'capturing');
          return;
        }
        captureInProgressRef.current = true;
        setStatus('capturing');
        softImpact();
        try {
          // Brief pause so the "capturing" state renders before transitioning.
          await new Promise(r => setTimeout(r, 500));
          if (!isMounted.current) return;
          setPhoto({ uri: MOCK_PHOTO_URI });
          setError(null);
          setStatus('preview');
        } finally {
          captureInProgressRef.current = false;
        }
        return;
      }
      // ── End mock capture ─────────────────────────────────────────────────────

      if (captureInProgressRef.current || status !== 'idle') {
        warnInvalidTransition(status, 'capturing');
        return;
      }
      if (!cameraRef?.current) return;

      captureInProgressRef.current = true;
      setStatus('capturing');
      softImpact();

      try {
        const result = await cameraRef.current.takePictureAsync({
          quality: 0.7,
        });
        setPhoto(result);
        setError(null);
        setStatus('preview');
      } catch (err) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.error('Capture failed:', err);
        }
        setError('We could not take the photo. Please try again.');
        setStatus('error');
      } finally {
        captureInProgressRef.current = false;
      }
    },
    [status]
  );

  const runAnalysis = useCallback(
    async () => {
      if (__DEV__) console.log('[DEBUG] ANALYZE_TAP status=' + status);

      if (analysisInProgressRef.current || status !== 'preview') {
        warnInvalidTransition(status, 'processing');
        return;
      }
      if (!photo?.uri) return;

      analysisInProgressRef.current = true;
      setStatus('processing');
      setError(null);
      setAnalysis(null);

      if (__DEV__) console.log('[DEBUG] SET_PROCESSING');

      // Yield one frame so React renders the processing UI (PerceptionLayer)
      // before the JS thread is occupied by compression work.
      if (__DEV__) console.log('[DEBUG] PROCESSING_RENDER_WAIT_START');
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (__DEV__) console.log('[DEBUG] PROCESSING_RENDER_WAIT_DONE');

      try {
        const processingStart = Date.now();

        if (__DEV__) console.log('[DEBUG] BEFORE_COMPRESS uri=' + photo.uri.slice(0, 80));
        if (__DEV__ && photo.qaFixtureName) {
          console.log('[K-SCAN QA] Fixture selected: ' + photo.qaFixtureName);
          console.log('[K-SCAN QA] Using compressImage utility: true');
          console.log('[K-SCAN QA] Sending fixture through /api/analyze');
        }
        const compressed = await compressForUpload(photo.uri);
        if (__DEV__) console.log('[DEBUG] AFTER_COMPRESS duration=' + (Date.now() - processingStart) + 'ms payloadLen=' + (compressed?.length ?? 0));

        if (__DEV__) console.log('[DEBUG] BEFORE_API_CALL');
        const data = await analyzeImage(compressed);
        if (__DEV__) console.log('[DEBUG] AFTER_API_CALL duration=' + (Date.now() - processingStart) + 'ms type=' + data?.type);

        // Enforce minimum HUD display time so PerceptionLayer completes its entry
        // animation before we transition to result. Only effective for very fast
        // responses (< MIN_ANALYSIS_MS); longer requests are unaffected.
        const elapsed = Date.now() - processingStart;
        if (elapsed < MIN_ANALYSIS_MS) {
          await new Promise(r => setTimeout(r, MIN_ANALYSIS_MS - elapsed));
        }

        if (!isMounted.current) return;

        if (data.type === 'non-fashion') {
          // Graceful non-fashion path — not an error
          warningPulse();
          setNonFashionMessage(data.message);
          setAnalysis(null);
          if (__DEV__) console.log('[DEBUG] SET_RESULT status=non-fashion');
          setStatus('non-fashion');
          return;
        }

        successPulse();
        setAnalysis(data);
        setNonFashionMessage(null);
        if (__DEV__) console.log('[DEBUG] SET_RESULT status=result');
        setStatus('result');
      } catch (err) {
        if (__DEV__) console.error('[DEBUG] ANALYZE_ERROR', err?.message);
        if (isMounted.current) {
          errorPulse();
          setError(
            err?.userMessage ||
            'Connection issue — Tap to retry'
          );
          setStatus('error');
        }
      } finally {
        analysisInProgressRef.current = false;
      }
    },
    [status, photo]
  );

  const retake = useCallback(() => {
    const canRetakeFromPreview = status === 'preview';
    const canRetakeFromError = status === 'error' && !!photo;

    if (!canRetakeFromPreview && !canRetakeFromError) {
      warnInvalidTransition(status, 'idle');
      return;
    }

    setPhoto(null);
    setAnalysis(null);
    setError(null);
    setNonFashionMessage(null);
    setStatus('idle');
  }, [status, photo]);

  const selectStaticFixture = useCallback(
    (uri, fixtureName) => {
      if (typeof __DEV__ === 'undefined' || !__DEV__) return;

      if (status !== 'idle') {
        warnInvalidTransition(status, 'capturing');
        return;
      }

      if (!uri || typeof uri !== 'string') {
        setError('Static QA fixture could not be loaded.');
        setStatus('error');
        return;
      }

      console.log('[K-SCAN QA] Fixture selected: ' + fixtureName);
      setStatus('capturing');
      setPhoto({ uri, qaFixtureName: fixtureName });
      setError(null);
      setAnalysis(null);
      setNonFashionMessage(null);
      requestAnimationFrame(() => {
        if (isMounted.current) setStatus('preview');
      });
    },
    [status]
  );

  const dismissResult = useCallback(() => {
    if (status !== 'result' && status !== 'error' && status !== 'non-fashion') {
      warnInvalidTransition(status, 'idle');
      return;
    }

    setAnalysis(null);
    setPhoto(null);
    setError(null);
    setNonFashionMessage(null);
    setStatus('idle');
  }, [status]);

  const retry = useCallback(() => {
    if (status !== 'error') {
      warnInvalidTransition(status, 'preview');
      return;
    }

    if (photo) {
      setError(null);
      setAnalysis(null);
      setNonFashionMessage(null);
      setStatus('preview');
    } else {
      setError(null);
      setNonFashionMessage(null);
      setStatus('idle');
    }
  }, [status, photo]);

  return {
    status,
    photo,
    analysis,
    error,
    nonFashionMessage,
    capturePhoto,
    runAnalysis,
    retake,
    dismissResult,
    retry,
    selectStaticFixture,
  };
}
