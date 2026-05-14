# K Scan AI Privacy & Data Management Integration Notes

## Mobile initialization

The app calls `public.ensure_privacy_settings()` from `components/PrivacyBootstrap.tsx` on authenticated app mount and again before `app/privacy.tsx` reads privacy state. The RPC verifies `auth.uid()`, inserts `privacy_settings` with `ON CONFLICT (user_id) DO NOTHING`, applies under-16 sale/sharing defaults, and returns the row.

The current checkout does not include a Supabase Auth client. `services/supabasePrivacy.js` is implemented against Supabase REST and Edge Function endpoints and expects:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- an authenticated access token from the app's Auth session, provided with `setPrivacyAccessToken(session.access_token)`

`EXPO_PUBLIC_SUPABASE_ACCESS_TOKEN` is only a temporary development bridge. Replace it with the real Supabase Auth session token when the app auth provider is wired.

## Data category separation

Personal information subject to sale/sharing controls includes linked style preferences, linked interactions, and account-level behavioral data that may be transferred for monetary or other valuable consideration. `privacy_settings.opt_out_of_sale` applies to these user-linked transfers.

Aggregated or deidentified trend reporting is separate. Aggregation jobs must not treat user-linked monetization as the same thing as deidentified trend reporting.

Internal operational and diagnostic data includes app performance logs, request errors, and security events where permitted. These data flows may have retention/security exceptions and should be documented outside the mobile toggle.

Raw scan and derived fashion metadata require a production storage map. The mobile copy and export manifest intentionally do not assume raw scans are retained. Derived fashion metadata linked to a user should be reviewed for export. Style DNA vectors or embeddings are not assumed exportable until legal review requires it.

## Minor users

When `profiles.age_group` is `under_13` or `age_13_to_15`, `ensure_privacy_settings()` forces `opt_out_of_sale = true`. The mobile UI disables the path that would re-enable sale/sharing and shows:

“Sale or sharing of personal information is disabled for users under 16 unless legally valid authorization is obtained.”

A future parental or teen opt-in flow should be implemented as a separate, auditable authorization system with versioned consent records. Do not add an inline toggle bypass.

## GPC and GDPR

Global Privacy Control from web should write `privacy_settings.opt_out_of_sale = true` with `last_request_source = 'gpc_web'`. Mobile reads the same row and preserves that setting unless a legally valid user action changes it.

California opt-out state is not GDPR consent. The `gdpr_*` columns are placeholders for future EU/UK consent and withdrawal logic after legal review.

## Request workflows

`handle-user-deletion` is idempotent for open requests and marks `profiles.account_status = 'pending_deletion'`. Actual erasure should be performed by a separate service-role workflow that handles retention, fraud/security exceptions, legal holds, confirmation email, and audit logging.

`privacy-data-export` creates a request plus an export manifest. The production export worker should gather profile, privacy settings, linked style preferences, linked interaction data, and legally exportable derived fashion metadata.

`privacy-correction-request` stores structured correction details for review. Direct self-service mutation of legally relevant profile fields should remain narrow and auditable.
