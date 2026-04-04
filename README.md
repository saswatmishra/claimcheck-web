🚗 ClaimCheck — Insurance Claim Readiness Checker (India)

ClaimCheck helps vehicle owners in India verify whether their insurance claim is likely to be accepted before they file it.

By analyzing documents like RC, insurance policy, and optionally driving license, ClaimCheck flags common claim-blocking issues such as:

Expired policies

Owner / policyholder mismatches

Vehicle number mismatches

Renewal risk (expiring soon)

The goal: prevent surprise claim rejections and fines using a simple, privacy-first check.

✨ What ClaimCheck Does
✅ Core checks (MVP)

RC Owner vs Policyholder name match

Policy expiry detection

Vehicle number consistency

Policy type detection (Comprehensive / Act Only / Third Party)

Renewal risk banner:

🔴 Expired

🟠 Expiring soon (≤ 15 days)

🟢 Safe

➕ Optional checks

Driving License (DL) holder name & expiry
(only when user chooses to upload DL)

📄 Supported file types

Images: JPG / PNG (OCR via Google Vision)

PDFs:

Text-based PDFs → direct text extraction

Scanned PDFs → upload images instead (recommended)

🧠 How It Works (High Level)

User uploads documents in the browser

Files are sent to a lightweight Express API

Text is extracted using:

Google Vision OCR (images)

pdf.js (text-based PDFs)

Deterministic rules + heuristics extract:

Names

Dates

Vehicle numbers

Risk is computed and explained in plain English

User can:

Download a shareable result card

Share result via WhatsApp

Save vehicle locally for reminders

⚠️ No documents are stored on a server
All analysis is stateless. Saved vehicles live in browser localStorage only.

🧪 Demo Mode

You can explore ClaimCheck without uploading files using built-in demo scenarios:

✅ All Good

❌ Owner mismatch

❌ Vehicle number mismatch

Perfect for demos, testing, and screenshots.

🖼️ Viral Feature: Shareable Result Card

ClaimCheck generates a visual result card that users can:

Download as an image

Share on WhatsApp

Forward to family / friends

This enables organic growth without logins or accounts.

🛠️ Tech Stack
Frontend

React + TypeScript

Vite

Tailwind CSS

html2canvas (for result card export)

Backend

Node.js + Express

Multer (file uploads)

Google Vision OCR

pdfjs-dist (PDF text extraction)

📂 Project Structure

claimcheck-web/
├── src/
│ ├── pages/
│ │ ├── Check.tsx
│ │ └── Result.tsx
│ ├── components/
│ │ ├── UploadCard.tsx
│ │ ├── RiskBadge.tsx
│ │ └── ShareCard.tsx
│ ├── services/
│ │ ├── storage.ts
│ │ └── vehicles.ts
│ └── types/
│ └── analysis.ts
│
└── claimcheck-api/
├── server.js
├── extract.js
├── ocr.js
└── package.json

🚀 Running Locally
1️⃣ Frontend
npm install
npm run dev

Runs on: http://localhost:5173

2️⃣ Backend
cd claimcheck-api
npm install
node server.js

Runs on: http://localhost:3001

3️⃣ Google Vision Setup

You’ll need a Google Cloud project with Vision API enabled.

export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"

🔐 Privacy & Safety

No user accounts

No document storage

No insurance selling

Read-only analysis

Designed to be advisory, not authoritative

⚠️ Disclaimer

ClaimCheck provides document consistency checks and general guidance only.
Actual claim decisions depend on insurer verification, policy terms, and additional factors such as:

Late intimation

Driving license validity

Policy exclusions

🧭 Roadmap (Next)

Challan (traffic fine) check via official aggregators

AI-assisted OCR confidence scoring

Regional language support

Email / WhatsApp renewal reminders

Hosted backend + auth (optional)

🤝 Contributing

This project is currently in active MVP development.
PRs, ideas, and discussions are welcome.

⭐ Why ClaimCheck Exists

Many claim rejections and fines in India happen not because of accidents, but because of:

Expired insurance

Name mismatches

Forgotten renewals

ClaimCheck exists to catch these issues early — before they cost you time, money, or peace of mind.
