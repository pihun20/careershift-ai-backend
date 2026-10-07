import "dotenv/config";
import express from "express";
import multer from "multer";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import OpenAI from "openai";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const port = Number(process.env.PORT || 3000);
const model = process.env.MODEL || "gpt-6-luna";
const maxChars = Number(process.env.MAX_RESUME_CHARS || 30000);

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not set. Add it to .env before starting.");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "CareerShift AI", aiConfigured: Boolean(process.env.OPENAI_API_KEY) });
});

async function extractResume(file) {
  if (!file) return "";
  const name = (file.originalname || "").toLowerCase();

  if (name.endsWith(".pdf")) {
    const result = await pdf(file.buffer);
    return result.text || "";
  }

  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value || "";
  }

  if (name.endsWith(".txt")) {
    return file.buffer.toString("utf8");
  }

  throw new Error("Only PDF, DOCX, and TXT resumes are supported.");
}

const instructions = `
You are CareerShift AI, a practical career-transition coach for job seekers.

Analyze the user's current/most recent role, target role, experience, and resume.
Never invent employers, degrees, certifications, metrics, achievements, or skills.
If evidence is missing, say it is missing and suggest how the user can verify or add it.
Do not guarantee employment, interviews, salary, immigration outcomes, or hiring decisions.
Give concrete, concise, useful recommendations.

Return valid JSON with exactly these keys:
fit_score (integer 0-100),
summary (string),
transferable_skills (array of strings),
skill_gaps (array of strings),
resume_changes (array of strings),
interview_questions (array of strings),
seven_day_plan (array of 7 strings),
pro_next_step (string).

fit_score is an estimate, not a hiring prediction.
`;

app.post("/api/analyze", upload.single("resumeFile"), async (req, res) => {
  try {
    const role = String(req.body.role || "").trim();
    const target = String(req.body.target || "").trim();
    const years = String(req.body.years || "").trim();
    const pastedResume = String(req.body.resume || "").trim();

    let uploadedResume = "";
    if (req.file) uploadedResume = await extractResume(req.file);

    const resume = (pastedResume || uploadedResume).slice(0, maxChars);

    if (!role || !target || !resume) {
      return res.status(400).json({
        error: "Current role, target role, and resume are required."
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "AI is not configured. Add OPENAI_API_KEY to the server .env file."
      });
    }

    const userInput = `
Current / most recent role: ${role}
Target role: ${target}
Years of experience: ${years || "Not specified"}

Resume:
${resume}
`;

    const response = await client.responses.create({
      model,
      instructions,
      input: userInput
    });

    const raw = response.output_text.trim();

    let report;
    try {
      report = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        error: "The AI returned an unexpected format. Please try again."
      });
    }

    res.json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Could not generate the career report.",
      detail: error?.message || "Unknown error"
    });
  }
});

app.listen(port, () => {
  console.log(`CareerShift AI backend running at http://localhost:${port}`);
});