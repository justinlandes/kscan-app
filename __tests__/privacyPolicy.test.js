const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPrivacyUpdatePatch,
  canToggleSaleSharing,
  isKnownMinor,
  normalizePrivacySettings,
} = require('../services/privacyPolicy');

test('known under-16 age groups force sale/sharing opt-out', () => {
  assert.equal(isKnownMinor('under_13'), true);
  assert.equal(isKnownMinor('age_13_to_15'), true);
  assert.equal(canToggleSaleSharing('under_13'), false);

  const normalized = normalizePrivacySettings(
    { opt_out_of_sale: false, limit_sensitive_processing: false },
    { age_group: 'age_13_to_15' },
  );

  assert.equal(normalized.opt_out_of_sale, true);
  assert.match(normalized.sale_sharing_locked_reason, /under 16/);
});

test('age 16 plus and unknown users may control sale/sharing opt-out', () => {
  assert.equal(canToggleSaleSharing('age_16_plus'), true);
  assert.equal(canToggleSaleSharing('unknown'), true);

  const normalized = normalizePrivacySettings(
    { opt_out_of_sale: false, limit_sensitive_processing: true },
    { age_group: 'age_16_plus' },
  );

  assert.equal(normalized.opt_out_of_sale, false);
  assert.equal(normalized.limit_sensitive_processing, true);
});

test('privacy update patch records mobile source and does not let minors opt back in', () => {
  const patch = buildPrivacyUpdatePatch(
    { opt_out_of_sale: false, limit_sensitive_processing: true },
    { age_group: 'under_13' },
  );

  assert.equal(patch.opt_out_of_sale, true);
  assert.equal(patch.limit_sensitive_processing, true);
  assert.equal(patch.last_request_source, 'mobile_app');
  assert.ok(Date.parse(patch.last_processed_at));
});
