# ClaimCheck

ClaimCheck compares an Indian vehicle registration certificate (RC) with its insurance policy and optionally a driving license. It flags document inconsistencies, missing readable fields and expiry warnings, then suggests what to review. A report is a document check, not a prediction or guarantee of a claim decision.

## Run locally

Use Node.js 22 and install both dependency trees:

```sh
npm ci
npm ci --prefix src/claimcheck-api
cp -n .env.example .env
cp -n src/claimcheck-api/.env.example src/claimcheck-api/.env
```

If either `.env` already exists, edit it rather than overwriting its settings. Start the frontend and API in separate terminals:

```sh
npm run dev
```

```sh
npm start --prefix src/claimcheck-api
```

The frontend defaults to `http://localhost:5173`; the API defaults to port 3001. Demo mode at `/check?demo=1` requires neither provider credentials nor a database.

## Configuration

- `VITE_API_BASE_URL`: frontend API URL. Set the deployed HTTPS API URL before building for production; the development default is localhost.
- `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_CREDENTIALS_JSON`: service account credentials for Google Cloud Vision image OCR. JSON credentials are passed directly to the client rather than written to a temporary file.
- `AI_EXTRACTION_ENABLED`: set to `false` to disable the optional AI fallback. Otherwise, fields that were not extracted may use `OPENAI_API_KEY` and `OPENAI_VISION_MODEL` (default `gpt-4o-mini`). No key means the fallback is skipped.
- `DATABASE_URL`: PostgreSQL connection for share links. Apply `src/claimcheck-api/schema.sql` to the intended database. Analysis and browser-only saving do not require PostgreSQL.
- `ALLOWED_ORIGINS`: comma-separated frontend origins for CORS.
- `TRUST_PROXY_HOPS`: number of **known trusted reverse-proxy hops**, default 0. Avoid trusting user-supplied forwarded headers; configure only after verifying the host's proxy chain.
- `API_RATE_WINDOW_MINUTES`, `API_RATE_{ANALYZE,AI,SHARES}_MAX`, and `API_CONCURRENT_{ANALYZE,AI,SHARES}_MAX`: per-process limits on expensive POST endpoints. Defaults are 15 minutes, 12/10/20 requests per IP, and 4/2/8 concurrent requests, respectively. 429 responses include Retry-After; overload returns 503. Deployments with multiple instances require shared/edge controls, plus provider spend alerts.
- `SHARE_REPORT_TTL_DAYS`: share-link lifetime, default 90 days. Expiry blocks reads; schedule `SharedReportsRepository.deleteExpired()` separately to delete expired rows.

Keep real keys and document files out of version control. Example environment files contain no usable credentials.

## Supported documents

Upload one RC, one policy and optionally one DL. Each file must be a PDF, JPG, PNG or WebP of up to 8 MB. Text PDFs may contain up to 30 pages; all pages are read. For scanned or password-protected PDFs, use a clear document photo or an unlocked PDF with selectable text.

Missing essential values result in an incomplete-check warning. Dates and registration numbers are validated before use. Accuracy still depends on document readability and supported formats. The current report does not separately model own-damage and third-party periods or a claim's incident date.

## Saving, sharing and privacy

Uploaded files are processed in server memory. Images use Google Cloud Vision; optional AI extraction can send document text and images to OpenAI. Responses API requests set `store: false`; provider retention policies still apply. See [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

Saving a vehicle stores the generated report in this browser. In-app reminders appear when ClaimCheck is opened; calendar export provides reminders outside the app. Creating a share link stores report details in PostgreSQL. Anyone with that link can view those details until expiry; uploaded files are not included. See the in-app Privacy Policy for the user-facing explanation.

## Checks

```sh
npm run test:run
npm run lint
npm run build
```

API tests use an ephemeral loopback port, generated documents and mocked providers. They do not load local credentials or call the live database, OCR or AI providers. CI runs all three checks on pushes and pull requests.

The React frontend lives in `src/pages`, `src/components` and `src/services`. The Express API is in `src/claimcheck-api`; shared validation is in `src/shared`. Keep `src/shared` alongside the backend when packaging it for deployment.

See [the product review](docs/PRODUCT_REVIEW.md) for the changes, remaining launch priorities and usability validation plan.
