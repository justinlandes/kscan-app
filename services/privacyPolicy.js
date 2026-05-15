const MINOR_AGE_GROUPS = new Set(['under_13', 'age_13_to_15']);

function isKnownMinor(ageGroup) {
  return MINOR_AGE_GROUPS.has(ageGroup);
}

function canToggleSaleSharing(ageGroup) {
  return !isKnownMinor(ageGroup);
}

function normalizePrivacySettings(settings, profile) {
  const ageGroup = profile?.age_group ?? 'unknown';
  return {
    user_id: settings?.user_id ?? null,
    opt_out_of_sale: isKnownMinor(ageGroup) ? true : Boolean(settings?.opt_out_of_sale),
    limit_sensitive_processing: Boolean(settings?.limit_sensitive_processing),
    gdpr_consent_given: settings?.gdpr_consent_given ?? null,
    gdpr_consent_timestamp: settings?.gdpr_consent_timestamp ?? null,
    gdpr_consent_version: settings?.gdpr_consent_version ?? null,
    consent_version: settings?.consent_version ?? 'ccpa_cpra_mobile_v1',
    last_request_source: settings?.last_request_source ?? null,
    last_processed_at: settings?.last_processed_at ?? null,
    updated_at: settings?.updated_at ?? null,
    age_group: ageGroup,
    sale_sharing_locked_reason: isKnownMinor(ageGroup)
      ? 'Sale or sharing of personal information is disabled for users under 16 unless legally valid authorization is obtained.'
      : null,
  };
}

function buildPrivacyUpdatePatch(nextSettings, profile) {
  const normalized = normalizePrivacySettings(nextSettings, profile);
  return {
    opt_out_of_sale: normalized.opt_out_of_sale,
    limit_sensitive_processing: normalized.limit_sensitive_processing,
    last_request_source: 'mobile_app',
    last_processed_at: new Date().toISOString(),
  };
}

/**
 * Merges local device preferences with remote account preferences.
 * Always preserves the more privacy-protective choice.
 * Local OFF never overwrites remote ON.
 */
function mergePrivacyPreferences(local, remote) {
  return {
    opt_out_of_sale: Boolean(local.opt_out_of_sale) || Boolean(remote.opt_out_of_sale),
    limit_sensitive_processing:
      Boolean(local.limit_sensitive_processing) || Boolean(remote.limit_sensitive_processing),
  };
}

/**
 * Returns true when merging local into remote would change the remote values,
 * indicating a write is needed to persist the merge outcome.
 */
function mergeNeedsWrite(local, remote) {
  const merged = mergePrivacyPreferences(local, remote);
  return (
    merged.opt_out_of_sale !== Boolean(remote.opt_out_of_sale) ||
    merged.limit_sensitive_processing !== Boolean(remote.limit_sensitive_processing)
  );
}

module.exports = {
  isKnownMinor,
  canToggleSaleSharing,
  normalizePrivacySettings,
  buildPrivacyUpdatePatch,
  mergePrivacyPreferences,
  mergeNeedsWrite,
};
