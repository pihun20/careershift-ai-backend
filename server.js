import "dotenv/config";
import express from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import OpenAI from "openai";

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.MODEL || "gpt-6-luna";
const MAX_RESUME_CHARS = Number(process.env.MAX_RESUME_CHARS || 30000);

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "CareerShift AI",
    aiConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
});

async function extractResumeText(file) {
  if (!file) return "";

  const name = (file.originalname || "").toLowerCase();
  const type = (file.mimetype || "").toLowerCase();

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    const parser = new PDFParse({ data: file.buffer });

    try {
      const result = await parser.getText();
      return result.text || "";
    } finally {
      await parser.destroy();
    }
  }

  if (
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({
      buffer: file.buffer
    });

    return result.value || "";
  }

  return file.buffer.toString("utf8");
}

async function analyzeWithOpenAI({ role, target, years, resume }) {
  if (!client) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const instructions = `
You are CareerShift AI, an AI career-transition copilot.

Analyze a person's current or most recent role and their target role.
Use only the information provided. Never invent experience, credentials,
employers, metrics, certifications, or achievements.

Return ONLY valid JSON with exactly these keys:
{
  "fit_score": 0,
  "summary": "",
  "transferable_skills": [],
  "skill_gaps": [],
  "resume_changes": [],
  "interview_questions": [],
  "seven_day_plan": [],
  "pro_next_step": ""
}

Rules:
- fit_score must be an integer from 0 to 100.
- Keep recommendations practical and concise.
- Do not promise a job or interview.
- Do not make unsupported salary claims.
`;

  const input = `
Current / most recent role: ${role}
Target role: ${target}
Years of experience: ${years || "Not specified"}

Resume:
${resume.slice(0, MAX_RESUME_CHARS)}
`;

  const response = await client.responses.create({
    model: MODEL,
    instructions,
    input
  });

  const raw = (response.output_text || "").trim();

  if (!raw) {
    throw new Error("OpenAI returned no text.");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return JSON.parse(cleaned);
  }
}

app.post("/api/analyze", upload.single("resumeFile"), async (req, res) => {
  try {
    const role = String(req.body?.role || "").trim();
    const target = String(req.body?.target || "").trim();
    const years = String(req.body?.years || "").trim();
    const pastedResume = String(req.body?.resume || "").trim();

    const uploadedResume = await extractResumeText(req.file);

    const resume = (pastedResume || uploadedResume).slice(
      0,
      MAX_RESUME_CHARS
    );

    if (!role || !target || !resume) {
      return res.status(400).json({
        error: "Current role, target role, and resume are required."
      });
    }

    const report = await analyzeWithOpenAI({
      role,
      target,
      years,
      resume
    });

    res.json(report);
  } catch (error) {
    console.error("Analysis error:", error);

    res.status(500).json({
      error: "Could not generate the career report.",
      detail:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message || "Unknown error"
    });
  }
});

app.listen(PORT, () => {
  console.log(`CareerShift AI backend listening on port ${PORT}`);
});
