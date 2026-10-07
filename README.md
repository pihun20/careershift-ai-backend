# CareerShift AI — Real AI Backend

This backend replaces the browser-only rule-based demo with a real OpenAI-powered career report.

## What it does

- Accepts current role, target role, experience, and resume
- Accepts PDF, DOCX, or TXT resume uploads
- Extracts resume text server-side
- Sends the analysis request to the OpenAI Responses API
- Returns structured career-transition results
- Keeps the OpenAI secret key on the server

## 1. Install Node.js

Install a current Node.js LTS release.

## 2. Install dependencies

From this folder:

```bash
npm install
```

## 3. Add your API key

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Then open `.env` and replace:

```text
PASTE_YOUR_SECRET_KEY_HERE
```

with your API secret key.

NEVER put the key in `index.html`, GitHub, or a browser JavaScript file.
NEVER send the key in chat.

## 4. Start the server

```bash
npm start
```

Test:

```text
http://localhost:3000/health
```

You should see JSON showing `ok: true`.

## 5. Frontend request

The frontend should POST a `multipart/form-data` request to:

```text
/api/analyze
```

Fields:

- `role`
- `target`
- `years`
- `resume` (optional if a file is supplied)
- `resumeFile` (PDF/DOCX/TXT)

Example browser code:

```js
const fd = new FormData();
fd.append("role", role);
fd.append("target", target);
fd.append("years", years);
fd.append("resume", resumeText);

const response = await fetch("/api/analyze", {
  method: "POST",
  body: fd
});

const report = await response.json();
```

## Production checklist

Before accepting real customers:

- Put backend behind HTTPS.
- Keep API key in hosting environment variables.
- Add authentication and rate limiting.
- Add payment verification before paid reports.
- Add secure storage only if reports need to be saved.
- Add delete/export controls for user data.
- Add privacy policy and terms.
- Add logging that does not store raw resumes unnecessarily.
- Set a spending limit/alert in the API account.
- Test prompt quality on many real-world resume/role combinations.

This starter does NOT include payment processing or user accounts yet.
