import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'kscan.privacy_preferences.v1';

export const LOCAL_PRIVACY_DEFAULTS = {
  opt_out_of_sale: false,
  limit_sensitive_processing: false,
};

/**
 * Device-local privacy preferences (AsyncStorage).
 * Used when there is no authenticated Supabase session — never presented as account-level.
 */
export async function readPrivacyLocal() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...LOCAL_PRIVACY_DEFAULTS };
  try {
    const parsed = JSON.parse(raw);
    return {
      opt_out_of_sale: Boolean(parsed.opt_out_of_sale),
      limit_sensitive_processing: Boolean(parsed.limit_sensitive_processing),
    };
  } catch {
    return { ...LOCAL_PRIVACY_DEFAULTS };
  }
}

export async function writePrivacyLocal(partial) {
  const prev = await readPrivacyLocal();
  const next = {
    opt_out_of_sale:
      partial.opt_out_of_sale !== undefined ? Boolean(partial.opt_out_of_sale) : prev.opt_out_of_sale,
    limit_sensitive_processing:
      partial.limit_sensitive_processing !== undefined
        ? Boolean(partial.limit_sensitive_processing)
        : prev.limit_sensitive_processing,
    updated_at: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export { STORAGE_KEY as LOCAL_PRIVACY_STORAGE_KEY };
