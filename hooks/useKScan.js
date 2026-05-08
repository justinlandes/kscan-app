import { useState, useCallback, useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { analyzeImage } from '../services/api';
import { compressForUpload } from '../services/imageUtils';

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

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const capturePhoto = useCallback(
    async (cameraRef) => {
      if (status !== 'idle') {
        warnInvalidTransition(status, 'capturing');
        return;
      }
      if (!cameraRef?.current) return;

      setStatus('capturing');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
      }
    },
    [status]
  );

  const runAnalysis = useCallback(
    async () => {
      if (__DEV__) console.log('[DEBUG] ANALYZE_TAP status=' + status);

      if (status !== 'preview') {
        warnInvalidTransition(status, 'processing');
        return;
      }
      if (!photo?.uri) return;

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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setNonFashionMessage(data.message);
          setAnalysis(null);
          if (__DEV__) console.log('[DEBUG] SET_RESULT status=non-fashion');
          setStatus('non-fashion');
          return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAnalysis(data);
        setNonFashionMessage(null);
        if (__DEV__) console.log('[DEBUG] SET_RESULT status=result');
        setStatus('result');
      } catch (err) {
        if (__DEV__) console.error('[DEBUG] ANALYZE_ERROR', err?.message);
        if (isMounted.current) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError(
            err?.message || 'Could not reach the server. Check your Wi-Fi.'
          );
          setStatus('error');
        }
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
  };
}
