import { useEffect } from 'react';

import { ensurePrivacySettings, isPrivacyBackendConfigured } from '../services/supabasePrivacy';

export function PrivacyBootstrap() {
  useEffect(() => {
    if (!isPrivacyBackendConfigured()) return;

    ensurePrivacySettings().catch((error) => {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[K-SCAN] privacy settings bootstrap failed:', error);
      }
    });
  }, []);

  return null;
}
