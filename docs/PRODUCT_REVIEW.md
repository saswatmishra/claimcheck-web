# ClaimCheck product review

Audience: everyday vehicle owners in India checking an RC and insurance policy.

## Changes delivered

- Missing essential fields now produce an incomplete-check warning instead of a green result. Critical mismatches take precedence in the explanation.
- Reject impossible dates; compare policy and DL expiry by the Indian calendar date. A DL is no longer marked expired at the start of its final day. Birth and issue dates are no longer substituted for DL expiry.
- Normalize registration spacing/hyphens and support BH registration patterns. Normalize name titles, case and whitespace before comparison.
- Recognize explicitly labelled standalone own-damage policies separately from comprehensive policies. Permit and fitness requirements are shown as unverified rather than assumed unnecessary.
- Enforce the advertised 8 MB limit in both the interface and API; validate MIME types, empty files and file signatures. Return actionable JSON errors for upload failures.
- Read every page of text PDFs up to 30 pages instead of stopping at page two. Give recovery instructions for scanned, encrypted, corrupt and oversized PDFs.
- Clear the optional DL when deselected; invalidate old results when files change; prevent edits during analysis. Add cancellation, a two-minute client timeout, accessible progress/error messages and result focus.
- Bound OCR and AI requests. Disable Responses API storage using `store: false`; exclude AI diagnostic payloads from reports; keep provider error details out of client responses. This is not a zero-retention guarantee for service providers: see [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).
- Improve saved-vehicle consistency, report validation, storage-error feedback, modal keyboard behavior and shared-link retry behavior. Both results pages now write to the same current saved-vehicle store.
- Explain browser-only reminders and public-link visibility next to their controls; align the expired-policy demo with real analysis.
- Load PDF export libraries on demand and exclude nested backend dependencies from Tailwind scanning. The measured initial application JS chunk fell from about 948 KB to 364 KB before gzip.
- Extend lint to backend/shared JavaScript, add regression coverage and add CI for tests, lint and production build.

## Still needed before a broad public launch

1. **Measure extraction accuracy with consented, representative documents.** Synthetic tests do not establish accuracy for real insurers, regional languages, name variants, rotated photos, or multi-column PDFs. Build a redacted fixture set with expected fields and review false green, false mismatch and unreadable rates. Do not store real document contents in analytics.
2. **Model policy periods explicitly.** The current report uses one expiry date. Separate own-damage and third-party periods, future policy start dates, incident dates and reinstatements need their own fields and rules. Generic policy-type keyword matching still needs evidence from labelled schedule sections. Have an insurance-domain reviewer validate the rules and product language.
3. **Protect public provider-backed endpoints.** Add host-appropriate rate limits, concurrency limits, spend monitoring and abuse controls for `/analyze`, `/extract-policy-ai` and `/shares`. Verify reverse-proxy configuration before relying on client IPs. CORS is not authentication or rate limiting. Review both npm dependency trees and update them with regression tests.
4. **Complete sharing lifecycle controls.** Links expire on read after the configured TTL, but expired database rows need a scheduled deletion job. Add a practical revocation/deletion mechanism and settle retention/contact policy. Older embedded links cannot be centrally revoked. Existing reports are snapshots, not continuously refreshed checks.
5. **Test the product with owners on their phones.** Observe five to ten people using their own consented documents. Measure whether they complete an upload, understand what was and was not verified, find the next action and successfully set a calendar reminder. Include slow connections, storage-disabled browsers, PDF downloads, WhatsApp sharing and keyboard/screen-reader use. The WhatsApp popup is still opened after asynchronous link creation and needs validation on Safari/mobile popup policies.

## Next usability iteration

Prioritize an extracted-details review step that shows source values and allows a user to identify incorrect extraction without silently turning uncertain fields into a passed check. Then prioritize scanned-PDF support, separate coverage dates, and the most requested language based on observed upload failures. Regional languages and automatic background notifications are not implemented.

## Verification and limits

All 80 tests pass, along with lint and the production build. Regression tests cover API multipart uploads, real generated text/encrypted PDFs, missing fields, date boundaries, optional DL consent, invalid report payloads, cancellation, saved-vehicle consistency and retry behavior. OCR and AI are mocked, and the API tests do not load local credentials or use the production database. A local loopback port is needed for API tests.

A local Chrome smoke check at 390 px and 1440 px confirmed the upload/demo layouts fit without horizontal scrolling, the save dialog contains focus and restores it on Escape, and unknown routes show recovery navigation. No browser runtime exceptions occurred in those flows. Mobile Safari and real-device document uploads remain untested.

Production deployment and real-provider accuracy validation remain separate tasks. CI has been added locally and has not yet run on GitHub.
