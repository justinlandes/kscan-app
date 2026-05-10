import * as Haptics from 'expo-haptics';

function fire(effect) {
  try {
    const result = effect();
    if (result?.catch) result.catch(() => {});
  } catch (_) {
    // Haptics are enhancement-only; unsupported devices should stay silent.
  }
}

export function softImpact() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function selectionTick() {
  fire(() => Haptics.selectionAsync());
}

export function successPulse() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function warningPulse() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function errorPulse() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
