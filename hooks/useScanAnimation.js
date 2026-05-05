import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

/**
 * Hardware-accelerated scanning line animation (useNativeDriver: true).
 * Returns ref to drive translateY in the viewfinder.
 */
export function useScanAnimation(isActive) {
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation;

    if (isActive) {
      scanAnim.setValue(0);
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1600,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    }

    return () => {
      if (animation) animation.stop();
    };
  }, [isActive, scanAnim]);

  return scanAnim;
}
