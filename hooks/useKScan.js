import { useState, useCallback, useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { analyzeImage } from '../services/api';
import { compressForUpload } from '../services/imageUtils';

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
      if (status !== 'preview') {
        warnInvalidTransition(status, 'processing');
        return;
      }
      if (!photo?.uri) return;

      setStatus('processing');
      setError(null);
      setAnalysis(null);

      try {
        const compressed = await compressForUpload(photo.uri);
        const data = await analyzeImage(compressed);
        if (!isMounted.current) return;

        if (data.type === 'non-fashion') {
          // Graceful non-fashion path — not an error
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setNonFashionMessage(data.message);
          setAnalysis(null);
          setStatus('non-fashion');
          return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAnalysis(data);
        setNonFashionMessage(null);
        setStatus('result');
      } catch (err) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.error('Analysis failed:', err);
        }
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
