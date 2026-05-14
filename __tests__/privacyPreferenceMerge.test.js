const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizePrivacySettings } = require('../services/privacyPolicy');

test('device-local fallback row normalizes like partial settings', () => {
  const normalized = normalizePrivacySettings(
    {
      user_id: null,
      opt_out_of_sale: true,
      limit_sensitive_processing: false,
    },
    { age_group: 'unknown', account_status: 'active' },
  );
  assert.equal(normalized.opt_out_of_sale, true);
  assert.equal(normalized.limit_sensitive_processing, false);
});

test('minors still force sale opt-out when local row is off', () => {
  const normalized = normalizePrivacySettings(
    {
      user_id: null,
      opt_out_of_sale: false,
      limit_sensitive_processing: false,
    },
    { age_group: 'age_13_to_15', account_status: 'active' },
  );
  assert.equal(normalized.opt_out_of_sale, true);
});
