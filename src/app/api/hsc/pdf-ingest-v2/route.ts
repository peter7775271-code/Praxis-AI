import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import OpenAI from 'openai';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

export const runtime = 'nodejs';
const execFileAsync = promisify(execFile);
const MODEL_NAME = 'gpt-5.4';
const ROMAN_REGEX = '(?:ix|iv|v?i{0,3}|x)';
const ROMAN_NUMERAL_TOKEN_RE = /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv)$/i;

const normalizeOptionImageRefs = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const toNullableString = (entry: unknown) => {
    const text = String(entry ?? '').trim();
    return text ? text : null;
  };

  return {
    A: toNullableString(record.A),
    B: toNullableString(record.B),
    C: toNullableString(record.C),
    D: toNullableString(record.D),
  };
};

const CleanedQuestionSchema = z.object({
  questionText: z.preprocess((value) => String(value ?? ''), z.string()).default(''),
  sampleSolution: z.preprocess((value) => String(value ?? ''), z.string()).default(''),
  marks: z.preprocess((value) => {
    if (value == null || value === '') return null;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }, z.number().int().min(0).nullable()).default(null),
  questionType: z.preprocess((value) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'multiple_choice' ? 'multiple_choice' : 'written';
  }, z.enum(['written', 'multiple_choice'])).default('written'),
  mcqOptions: z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((item) => item != null) : []),
    z.array(
      z.object({
        label: z.preprocess((value) => {
          const normalized = String(value ?? '').trim().toUpperCase();
          return ['A', 'B', 'C', 'D'].includes(normalized) ? normalized : 'A';
        }, z.enum(['A', 'B', 'C', 'D'])),
        text: z.preprocess((value) => {
          const text = String(value ?? '').trim();
          return text || null;
        }, z.string().nullable()),
        imageRef: z.preprocess((value) => {
          const text = String(value ?? '').trim();
          return text || null;
        }, z.string().nullable()),
      })
    )
  ).default([]),
  mcqCorrectAnswer: z.preprocess((value) => {
    const normalized = String(value ?? '').trim().toUpperCase();
    return ['A', 'B', 'C', 'D'].includes(normalized) ? normalized : null;
  }, z.enum(['A', 'B', 'C', 'D']).nullable()).default(null),
  questionImageRefs: z.preprocess(
    (value) => (Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []),
    z.array(z.string())
  ).default([]),
  optionImageRefs: z.preprocess(
    (value) => normalizeOptionImageRefs(value),
    z.object({
      A: z.string().nullable().optional(),
      B: z.string().nullable().optional(),
      C: z.string().nullable().optional(),
      D: z.string().nullable().optional(),
    })
  ).default({}),
});

type CleanedQuestion = z.infer<typeof CleanedQuestionSchema>;

type ParsedQuestion = {
  index: number;
  label: string;
  questionNumber: string | null;
  latex: string;
  imageRefs: string[];
  isLikelyMcq: boolean;
};

type ParsedQuestionBatch = {
  index: number;
  key: string;
  label: string;
  questionNumber: string | null;
  latex: string;
  imageRefs: string[];
  isLikelyMcq: boolean;
  questions: ParsedQuestion[];
};

type McqOptionLabel = 'A' | 'B' | 'C' | 'D';

type ParsedMcqOption = {
  label: McqOptionLabel;
  text: string | null;
  imageRef: string | null;
};

type GroupingMode = 'main_question' | 'letter_subpart';

type MathpixCredentials = {
  appId: string;
  appKey: string;
};

type MathpixResult = {
  pdfId: string;
  status: string;
  percentDone: number | null;
  mmdText: string;
  usedConversionFormats: string[];
  texZipPath: string | null;
  extractedDir: string | null;
  texFilePath: string | null;
  texContent: string | null;
  imagesDir: string | null;
  imageFiles: string[];
};

type InsertFailure = {
  questionIndex: number;
  questionLabel: string;
  reason: string;
};

type BatchSolvedQuestion = {
  sourceQuestion: ParsedQuestion;
  cleaned: CleanedQuestion;
};

type BatchPromptDebug = {
  batchIndex: number;
  batchLabel: string;
  groupedCount: number;
  usedGroupedPrompt: boolean;
  systemPrompt: string;
  userPrompt: string;
  inputQuestions: Array<{
    index: number;
    label: string;
    questionNumber: string | null;
  }>;
};

// Shared prompt fragments to reduce duplication
const SHARED_STEM_RULE = 'Shared stem rule: For multi-part questions, include shared context only in the first subpart (e.g., 11 (a) or 11 (a)(i)). For later subparts (11 (b), 11 (c), 11 (a)(ii)), include only text specific to that subpart.';
const NO_REPEAT_SUBPART_RULE = 'No repetition rule for subparts: never duplicate shared stem/context across sibling subparts. If part (a) contains a shared table/graph/diagram/data block or long setup text, keep it only in the first relevant subpart and do NOT copy it into (b), (c), or later roman subparts unless a tiny reference phrase is strictly needed for clarity.';
const CRITICAL_SPLITTING_RULE = [
  'CRITICAL - Question splitting (follow exactly):',
  '- Split at BOTH lettered parts and Roman numeral subparts. Each of these gets its own QUESTION_NUMBER block.',
  '- Lettered parts: (a), (b), (c), (d), etc. - e.g. 11 (a), 11 (b) are separate questions.',
  '- Roman numeral subparts: (i), (ii), (iii), (iv), (v), (vi), (vii), (viii), (ix), (x) - e.g. 11 (a) (i) and 11 (a) (ii) are two separate questions. Use QUESTION_NUMBER like "11 (a)(i)" and "11 (a)(ii)".',
  '- So "Question 11 (a)" with parts (i) and (ii) becomes two blocks: QUESTION_NUMBER 11 (a)(i) and QUESTION_NUMBER 11 (a)(ii), each with its own QUESTION_CONTENT and SAMPLE_ANSWER.',
].join(' ');
const MCQ_RULES = 'For MCQ: keep options only in mcqOptions array. Remove option lines from questionText. Do not use display math delimiters in option text.';
const LATEX_RULES = 'All mathematics must have explicit delimiters: $...$ for inline, \\[...\\] for display. Do not output plain-text math like "1/2 + 1/x^2 - 5" outside math mode.';
const TABLE_RULES = 'For tables: Do NOT use \\begin{table}...\\end{table} floating environments. Instead, output tables using only \\begin{center}\\begin{tabular}{...}...\\end{tabular}\\end{center} for inline rendering. Remove \\caption, \\captionsetup, and other table metadata commands.';

const classifyIngestError = (message: string) => {
  const normalized = String(message || '').toLowerCase();

  if (normalized.includes('mathpix request failed')) {
    return {
      code: 'MATHPIX_NETWORK_ERROR',
      hint: 'Mathpix request could not be reached. Check internet/DNS access from the server and verify MATHPIX_API_BASE_URL if overridden.',
      status: 502,
    };
  }

  if (normalized.includes('missing mathpix credentials')) {
    return {
      code: 'MATHPIX_CREDENTIALS_MISSING',
      hint: 'Set MATHPIX_APP_ID and MATHPIX_APP_KEY in .env.local and restart the server.',
      status: 500,
    };
  }

  if (normalized.includes('missing openai_api_key')) {
    return {
      code: 'OPENAI_KEY_MISSING',
      hint: 'Set OPENAI_API_KEY in .env.local and restart the server.',
      status: 500,
    };
  }

  if (normalized.includes('failed to extract tex.zip') || normalized.includes('unzip')) {
    return {
      code: 'TEX_ZIP_EXTRACT_FAILED',
      hint: 'Install unzip on the host runtime (for Ubuntu/WSL: sudo apt install unzip).',
      status: 500,
    };
  }

  if (normalized.includes('mathpix submit failed')) {
    return {
      code: 'MATHPIX_SUBMIT_FAILED',
      hint: 'Check MathPix credentials and that the uploaded file is a readable PDF.',
      status: 502,
    };
  }

  if (normalized.includes('mathpix markdown download failed')) {
    return {
      code: 'MATHPIX_MARKDOWN_MISSING',
      hint: 'Mathpix completed but no .mmd markdown could be downloaded. Check Mathpix conversion formats and retry.',
      status: 502,
    };
  }

  if (normalized.includes('mathpix polling timed out')) {
    return {
      code: 'MATHPIX_TIMEOUT',
      hint: 'Try again with a smaller PDF or increase MathPix max wait time.',
      status: 504,
    };
  }

  if (normalized.includes('did not contain a .tex file') || normalized.includes('extracted .tex file is empty')) {
    return {
      code: 'MATHPIX_TEX_MISSING',
      hint: 'MathPix completed but no usable .tex was extracted. Try a cleaner PDF or check MathPix output settings.',
      status: 502,
    };
  }

  if (normalized.includes('dev-only endpoint')) {
    return {
      code: 'DEV_ONLY_ENDPOINT',
      hint: 'Use /dashboard/settings/dev in development, or set ENABLE_PDF_INGEST_V2_DEV=true for production testing.',
      status: 403,
    };
  }

  return {
    code: 'INGEST_RUNTIME_ERROR',
    hint: 'Open the ingest response payload and inspect details + stage to pinpoint the failure.',
    status: 500,
  };
};

const parseBoolean = (value: FormDataEntryValue | null, fallback = false) => {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
};

const normalizePositiveInteger = (value: unknown, fallback = 0) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const getMathpixCredentials = (): MathpixCredentials => {
  const appId = (process.env.MATHPIX_APP_ID || process.env.MATHPIX_APPID || '').trim();
  const appKey = (process.env.MATHPIX_APP_KEY || process.env.MATHPIX_APPKEY || '').trim();
  return { appId, appKey };
};

const getMathpixBaseUrl = () => (process.env.MATHPIX_API_BASE_URL || 'https://api.mathpix.com').trim();

const fetchMathpix = async (
  endpoint: string,
  init: RequestInit,
  credentials: MathpixCredentials
) => {
  const baseUrl = getMathpixBaseUrl();
  const method = (init.method || 'GET').toUpperCase();

  try {
    return await fetch(`${baseUrl}${endpoint}`, {
      ...init,
      headers: {
        app_id: credentials.appId,
        app_key: credentials.appKey,
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Mathpix request failed: ${method} ${baseUrl}${endpoint} :: ${message}`);
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const pollMathpixUntilComplete = async (
  pdfId: string,
  pollIntervalMs: number,
  maxWaitMs: number,
  credentials: MathpixCredentials
) => {
  const startedAt = Date.now();

  while (true) {
    const response = await fetchMathpix(
      `/v3/pdf/${encodeURIComponent(pdfId)}`,
      { method: 'GET' },
      credentials
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`Mathpix status check failed: ${response.status} ${JSON.stringify(payload)}`);
    }

    const status = String(payload?.status || '').toLowerCase();
    if (status === 'completed') {
      return {
        status,
        percentDone: typeof payload?.percent_done === 'number' ? payload.percent_done : null,
      };
    }

    if (status === 'error' || status === 'failed') {
      throw new Error(`Mathpix processing failed: ${JSON.stringify(payload)}`);
    }

    if (Date.now() - startedAt > maxWaitMs) {
      throw new Error(`Mathpix polling timed out after ${maxWaitMs}ms`);
    }

    await sleep(pollIntervalMs);
  }
};

const downloadMathpixMmd = async (pdfId: string, credentials: MathpixCredentials) => {
  const response = await fetchMathpix(
    `/v3/pdf/${encodeURIComponent(pdfId)}.mmd`,
    { method: 'GET' },
    credentials
  );

  const text = await response.text();
  if (!response.ok || !text.trim()) {
    throw new Error(`Mathpix .mmd download failed: ${response.status} ${text.slice(0, 200)}`);
  }
  return text;
};

const downloadMathpixTexZip = async (pdfId: string, credentials: MathpixCredentials) => {
  const response = await fetchMathpix(
    `/v3/pdf/${encodeURIComponent(pdfId)}.tex.zip`,
    { method: 'GET' },
    credentials
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Mathpix .tex.zip download failed: ${response.status} ${text.slice(0, 200)}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) {
    throw new Error('Mathpix .tex.zip download returned empty body');
  }

  return bytes;
};

const listFilesRecursive = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFilesRecursive(absolutePath);
      }
      return [absolutePath];
    })
  );
  return nested.flat();
};

const extractZip = async (zipPath: string, targetDir: string) => {
  await fs.mkdir(targetDir, { recursive: true });
  try {
    await execFileAsync('unzip', ['-o', zipPath, '-d', targetDir]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to extract tex.zip using unzip: ${message}`);
  }
};

const findBestTexFile = (files: string[]) => {
  const texFiles = files.filter((filePath) => path.extname(filePath).toLowerCase() === '.tex');
  if (!texFiles.length) return null;

  const scored = texFiles.map((filePath) => {
    const lower = filePath.toLowerCase();
    const score =
      (lower.includes('main') ? 20 : 0) +
      (lower.includes('question') ? 10 : 0) +
      (lower.includes('exam') ? 8 : 0) +
      (path.basename(filePath).length < 24 ? 2 : 0);
    return { filePath, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.filePath || texFiles[0];
};

const findImagesDir = (files: string[]) => {
  const imageFiles = files.filter((filePath) => /\.(png|jpg|jpeg|webp|gif)$/i.test(filePath));
  if (!imageFiles.length) return null;

  const byDir = new Map<string, number>();
  for (const imageFile of imageFiles) {
    const dir = path.dirname(imageFile);
    byDir.set(dir, (byDir.get(dir) || 0) + 1);
  }

  return Array.from(byDir.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
};

const findImageFiles = (files: string[]) => {
  return files.filter((filePath) => /\.(png|jpg|jpeg|webp|gif)$/i.test(filePath));
};

const extractQuestionImageRefs = (latex: string) => {
  const refs: string[] = [];
  const texRegex = /\\includegraphics\*?(?:\[[^\]]*\])?\{([^}]+)\}/g;
  for (const match of latex.matchAll(texRegex)) {
    const raw = String(match[1] || '').trim();
    if (raw) refs.push(raw);
  }

  const markdownRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of latex.matchAll(markdownRegex)) {
    const raw = String(match[1] || '').trim();
    if (raw) refs.push(raw);
  }

  return Array.from(new Set(refs));
};

const normalizeLatexInputForSplit = (raw: string) => {
  const value = String(raw || '');

  const hasRealNewlines = value.includes('\n');
  const looksEscapedLatex = /\\\\documentclass|\\\\begin\{document\}|\\\\section\*/.test(value);
  const hasLiteralNewlineEscapes = value.includes('\\n');

  if (hasRealNewlines || !looksEscapedLatex || !hasLiteralNewlineEscapes) {
    return value;
  }

  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
  } catch {
    return value;
  }
};

const extractDocumentBody = (latex: string) => {
  const source = String(latex || '');
  const beginMatch = source.match(/\\begin\{document\}/i);
  const endMatch = source.match(/\\end\{document\}/i);

  if (!beginMatch || !endMatch) {
    return source;
  }

  const beginIndex = typeof beginMatch.index === 'number' ? beginMatch.index : 0;
  const endIndex = typeof endMatch.index === 'number' ? endMatch.index : source.length;
  return source.slice(beginIndex + beginMatch[0].length, endIndex);
};

const compactContent = (value: string) =>
  String(value || '')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\n{3,}/g, '\n\n');

const isLikelyMcqMainQuestion = (questionNumber: string | null | undefined) => {
  const mainMatch = String(questionNumber || '').trim().match(/^(\d+)/);
  if (!mainMatch) return false;
  const main = Number.parseInt(mainMatch[1], 10);
  return Number.isFinite(main) && main >= 1 && main <= 10;
};

const getQuestionNumberFromSection = (text: string) => {
  const match = String(text || '').match(/Question\s+(\d+)/i);
  return match ? match[1] : null;
};

const toQuestionNumber = (question: string | null, part: string | null, subpart: string | null) => {
  if (!question) return null;
  return `${question}${part ? ` (${part})` : ''}${subpart ? `(${subpart})` : ''}`;
};

const toQuestionLabel = (question: string | null, part: string | null, subpart: string | null) => {
  const number = toQuestionNumber(question, part, subpart);
  return number ? `Question ${number}` : 'Question X';
};

const splitLatexQuestionSubparts = (latex: string): ParsedQuestion[] => {
  const normalized = normalizeLatexInputForSplit(latex);
  const body = extractDocumentBody(normalized).replace(/\r\n/g, '\n');
  const lines = body.split('\n');

  const chunks: Array<{
    question: string | null;
    part: string | null;
    subpart: string | null;
    content: string;
  }> = [];

  let currentQuestion: string | null = null;
  let questionIntroLines: string[] = [];
  let currentPart:
    | {
        letter: string;
        preambleLines: string[];
        hasSubparts: boolean;
        subparts: Array<{ roman: string; lines: string[] }>;
      }
    | null = null;

  const flushQuestionIntro = () => {
    const content = compactContent(questionIntroLines.join('\n'));
    if (content) {
      chunks.push({ question: currentQuestion, part: null, subpart: null, content });
    }
    questionIntroLines = [];
  };

  const flushPart = () => {
    if (!currentPart) return;

    if (!currentPart.hasSubparts) {
      const content = compactContent(currentPart.preambleLines.join('\n'));
      if (content) {
        chunks.push({
          question: currentQuestion,
          part: currentPart.letter,
          subpart: null,
          content,
        });
      }
      currentPart = null;
      return;
    }

    for (const sub of currentPart.subparts) {
      const content = compactContent(sub.lines.join('\n'));
      if (!content) continue;
      chunks.push({
        question: currentQuestion,
        part: currentPart.letter,
        subpart: sub.roman,
        content,
      });
    }

    currentPart = null;
  };

  const flushAll = () => {
    flushPart();
    flushQuestionIntro();
  };

  const startNewPart = (letter: string, remainder: string) => {
    flushPart();
    flushQuestionIntro();
    currentPart = {
      letter: letter.toLowerCase(),
      preambleLines: remainder ? [remainder] : [],
      hasSubparts: false,
      subparts: [],
    };
  };

  const startSubpart = (roman: string, remainder: string) => {
    if (!currentPart) {
      questionIntroLines.push(remainder || `(${roman})`);
      return;
    }

    if (!currentPart.hasSubparts) {
      currentPart.hasSubparts = true;
    }

    const seedLines: string[] = [];
    if (currentPart.subparts.length === 0 && currentPart.preambleLines.length > 0) {
      seedLines.push(...currentPart.preambleLines);
      currentPart.preambleLines = [];
    }
    if (remainder) seedLines.push(remainder);

    currentPart.subparts.push({ roman: roman.toLowerCase(), lines: seedLines });
  };

  const appendRegularLine = (line: string) => {
    if (currentPart) {
      if (currentPart.hasSubparts && currentPart.subparts.length > 0) {
        currentPart.subparts[currentPart.subparts.length - 1].lines.push(line);
        return;
      }
      currentPart.preambleLines.push(line);
      return;
    }
    questionIntroLines.push(line);
  };

  for (const line of lines) {
    const sectionMatch = line.match(/\\section\*\{([^}]*)\}/i);
    if (sectionMatch) {
      const sectionText = sectionMatch[1] || '';
      const nextQuestion = getQuestionNumberFromSection(sectionText);

      if (/^\s*End\s+of\s+Question/i.test(sectionText)) {
        flushAll();
        continue;
      }

      if (nextQuestion && nextQuestion !== currentQuestion) {
        flushAll();
        currentQuestion = nextQuestion;
      }
      continue;
    }

    const continuedMatch = line.match(/^\s*Question\s+(\d+)\s*\(continued\)/i);
    if (continuedMatch) {
      const nextQuestion = continuedMatch[1];
      if (nextQuestion !== currentQuestion) {
        flushAll();
        currentQuestion = nextQuestion;
      }
      continue;
    }

    const tokenMatch = line.match(/^\s*\(([a-z]+)\)\s*(.*)$/i);
    if (tokenMatch) {
      const token = tokenMatch[1];
      const remainder = tokenMatch[2] || '';

      if (ROMAN_NUMERAL_TOKEN_RE.test(token)) {
        startSubpart(token, remainder);
      } else if (token.length === 1) {
        startNewPart(token, remainder);
      } else {
        appendRegularLine(line);
      }
      continue;
    }

    appendRegularLine(line);
  }

  flushAll();

  return chunks
    .map((chunk, index) => {
      const questionNumber = toQuestionNumber(chunk.question, chunk.part, chunk.subpart);
      return {
        index: index + 1,
        label: toQuestionLabel(chunk.question, chunk.part, chunk.subpart),
        questionNumber,
        latex: chunk.content,
        imageRefs: extractQuestionImageRefs(chunk.content),
        isLikelyMcq: isLikelyMcqMainQuestion(questionNumber),
      } satisfies ParsedQuestion;
    })
    .filter((item) => item.latex.trim().length > 0);
};

const parseWrittenHeader = (line: string) => {
  const regex = new RegExp(
    `^\\s*Question\\s+(\\d+)(?:\\s*\\(([a-z])\\))?(?:\\s*\\((${ROMAN_REGEX})\\))?\\b`,
    'i'
  );

  const match = line.match(regex);
  if (!match) return null;

  const mainNumber = match[1];
  const part = match[2] ? match[2].toLowerCase() : null;
  const subpart = match[3] ? match[3].toLowerCase() : null;
  const questionNumber =
    `${mainNumber}` +
    (part ? ` (${part})` : '') +
    (subpart ? `(${subpart})` : '');

  return {
    label: `Question ${questionNumber}`,
    questionNumber,
    isMcq: isLikelyMcqMainQuestion(questionNumber),
  };
};

const parseMcqHeader = (line: string) => {
  const match = line.match(/^\s*(\d{1,3})(?:\s*[.)])?\s+(.+)$/);
  if (!match) return null;

  const questionNumber = match[1];
  const trailingText = String(match[2] || '').trim();
  if (!trailingText) return null;

  const isLikelyInstruction = /^(marks?|attempt|allow|use|section|minutes?)\b/i.test(trailingText);
  if (isLikelyInstruction) return null;

  const hasExplicitDelimiter = /\d\s*[.)]\s+/.test(String(match[0] || ''));
  const wordCount = trailingText.split(/\s+/).filter(Boolean).length;
  if (!hasExplicitDelimiter && wordCount < 4) return null;

  return {
    label: questionNumber,
    questionNumber,
    isMcq: true,
  };
};

const parseLetterSubpartHeader = (line: string, currentMainNumber: string | null) => {
  // Match patterns like: "a) ...", "(a) ...", "a. ..."
  const match = line.match(/^\s*\(?\s*([a-z])\s*\)?(?:\s*[.)])?\s+(.+)$/i);
  if (!match) return null;

  const letter = String(match[1] || '').toLowerCase();
  const trailingText = String(match[2] || '').trim();

  if (!trailingText || !currentMainNumber) return null;

  // Don't treat instructions as subpart markers
  const isLikelyInstruction = /^(marks?|attempt|allow|use|section|minutes?|begin|end)/i.test(trailingText);
  if (isLikelyInstruction) return null;

  // Extract main number from currentMainNumber (e.g., "11" from "11")
  const mainMatch = String(currentMainNumber).match(/^(\d+)/);
  if (!mainMatch) return null;

  const mainNumber = mainMatch[1];
  const questionNumber = `${mainNumber} (${letter})`;

  return {
    label: `Question ${mainNumber} (${letter})`,
    questionNumber,
    letter,
  };
};

const parseRomanSubpartHeader = (line: string, currentMainNumber: string | null, currentLetterPart: string | null) => {
  // Match patterns like: "i) ...", "(i) ...", "ii. ..."
  const match = line.match(/^\s*\(?\s*((?:ix|iv|v?i{0,3}|x))\s*\)?(?:\s*[.)])?\s+(.+)$/i);
  if (!match) return null;

  const roman = String(match[1] || '').toLowerCase();
  const trailingText = String(match[2] || '').trim();

  if (!trailingText) return null;

  // Don't treat instructions as subpart markers
  const isLikelyInstruction = /^(marks?|attempt|allow|use|section|minutes?|begin|end)/i.test(trailingText);
  if (isLikelyInstruction) return null;

  // If we have both main and letter parts, create a composite question number
  if (currentMainNumber && currentLetterPart) {
    const mainMatch = String(currentMainNumber).match(/^(\d+)/);
    if (mainMatch) {
      const mainNumber = mainMatch[1];
      const questionNumber = `${mainNumber} (${currentLetterPart})(${roman})`;
      return {
        label: `Question ${mainNumber} (${currentLetterPart})(${roman})`,
        questionNumber,
      };
    }
  }

  return null;
};

const parseQuestionStarts = (content: string) => {
  const lines = content.split(/\r?\n/);
  const starts: Array<{
    lineIndex: number;
    label: string;
    questionNumber: string;
    isMcq: boolean;
  }> = [];

  let currentMainNumber: string | null = null;
  let currentLetterPart: string | null = null;

  lines.forEach((line, lineIndex) => {
    const written = parseWrittenHeader(line);
    if (written) {
      currentMainNumber = written.questionNumber;
      currentLetterPart = null;
      starts.push({
        lineIndex,
        label: written.label,
        questionNumber: written.questionNumber,
        isMcq: written.isMcq,
      });
      return;
    }

    // Try to parse letter subpart headers (a), b), etc.)
    const letterSubpart = parseLetterSubpartHeader(line, currentMainNumber);
    if (letterSubpart) {
      currentLetterPart = letterSubpart.letter;
      starts.push({
        lineIndex,
        label: letterSubpart.label,
        questionNumber: letterSubpart.questionNumber,
        isMcq: false,
      });
      return;
    }

    // Try to parse roman subpart headers (i), ii), etc.)
    const romanSubpart = parseRomanSubpartHeader(line, currentMainNumber, currentLetterPart);
    if (romanSubpart) {
      starts.push({
        lineIndex,
        label: romanSubpart.label,
        questionNumber: romanSubpart.questionNumber,
        isMcq: false,
      });
      return;
    }

    const mcq = parseMcqHeader(line);
    if (mcq) {
      currentMainNumber = mcq.questionNumber;
      currentLetterPart = null;
      starts.push({
        lineIndex,
        label: mcq.label,
        questionNumber: mcq.questionNumber,
        isMcq: mcq.isMcq,
      });
    }
  });

  return { lines, starts };
};

const splitQuestions = (content: string): ParsedQuestion[] => {
  const { lines, starts } = parseQuestionStarts(content);

  if (!starts.length) {
    const fallback = content.trim();
    if (!fallback) return [];
    return [
      {
        index: 1,
        label: 'Question 1',
        questionNumber: '1',
        latex: fallback,
        imageRefs: extractQuestionImageRefs(fallback),
        isLikelyMcq: false,
      },
    ];
  }

  const questions: ParsedQuestion[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const current = starts[i];
    const next = starts[i + 1];
    const chunk = lines.slice(current.lineIndex, next ? next.lineIndex : lines.length).join('\n').trim();
    if (!chunk) continue;

    questions.push({
      index: questions.length + 1,
      label: current.label,
      questionNumber: current.questionNumber,
      latex: chunk,
      imageRefs: extractQuestionImageRefs(chunk),
      isLikelyMcq: current.isMcq,
    });
  }

  return questions;
};

const parseQuestionNumberParts = (value: string | null | undefined) => {
  const raw = String(value || '').trim();
  if (!raw) return { main: null, part: null, roman: null };

  const match = raw.match(/^(\d+)(?:\s*\(([a-z])\))?(?:\s*\(((?:ix|iv|v?i{0,3}|x))\))?$/i);
  if (!match) return { main: null, part: null, roman: null };

  return {
    main: match[1] || null,
    part: match[2] ? match[2].toLowerCase() : null,
    roman: match[3] ? match[3].toLowerCase() : null,
  };
};

const groupParsedQuestions = (questions: ParsedQuestion[], mode: GroupingMode): ParsedQuestionBatch[] => {
  const grouped = new Map<string, ParsedQuestion[]>();
  const order: string[] = [];

  const mainsWithLetterSubparts = new Set<string>();
  for (const question of questions) {
    const parts = parseQuestionNumberParts(question.questionNumber);
    if (parts.main && parts.part) {
      mainsWithLetterSubparts.add(parts.main);
    }
  }

  for (const question of questions) {
    const parts = parseQuestionNumberParts(question.questionNumber);

    // In letter_subpart mode, if a main question has lettered children,
    // do not send the whole parent chunk to OpenAI.
    if (mode === 'letter_subpart' && parts.main && mainsWithLetterSubparts.has(parts.main) && !parts.part) {
      continue;
    }

    let key = `single:${question.index}`;

    if (mode === 'main_question' && parts.main) {
      key = `main:${parts.main}`;
    } else if (mode === 'letter_subpart' && parts.main && parts.part) {
      key = `letter:${parts.main}:${parts.part}`;
    }

    if (!grouped.has(key)) {
      grouped.set(key, []);
      order.push(key);
    }
    grouped.get(key)?.push(question);
  }

  return order.map((key, groupIndex) => {
    const entries = grouped.get(key) || [];
    const first = entries[0];
    const firstParts = parseQuestionNumberParts(first?.questionNumber || null);

    let mergedLabel = first?.label || `Question ${groupIndex + 1}`;
    let mergedQuestionNumber = first?.questionNumber || null;

    if (key.startsWith('main:') && firstParts.main) {
      mergedLabel = `Question ${firstParts.main}`;
      mergedQuestionNumber = firstParts.main;
    } else if (key.startsWith('letter:') && firstParts.main && firstParts.part) {
      mergedLabel = `Question ${firstParts.main} (${firstParts.part})`;
      mergedQuestionNumber = `${firstParts.main} (${firstParts.part})`;
    }

    const mergedLatex = entries.map((entry) => entry.latex).join('\n\n').trim();
    const mergedImageRefs = Array.from(new Set(entries.flatMap((entry) => entry.imageRefs)));

    return {
      index: groupIndex + 1,
      key,
      label: mergedLabel,
      questionNumber: mergedQuestionNumber,
      latex: mergedLatex,
      imageRefs: mergedImageRefs,
      isLikelyMcq: entries.some((entry) => entry.isLikelyMcq),
      questions: entries,
    };
  });
};

const inferMarksFromLatex = (latex: string) => {
  const marksMatch = latex.match(/\(?\s*(\d{1,2})\s*marks?\s*\)?/i) || latex.match(/\[(\d{1,2})\]/);
  if (!marksMatch) return 0;
  const parsed = Number.parseInt(marksMatch[1], 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const inferMimeFromPath = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
};

const normalizeRef = (reference: string) =>
  String(reference || '')
    .trim()
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .replace(/\\/g, '/')
    .toLowerCase();

const resolveImageFromReference = (
  reference: string,
  imageFiles: string[]
): string | null => {
  const normalized = normalizeRef(reference);
  if (!normalized) return null;

  const basename = path.basename(normalized);
  const basenameNoExt = basename.replace(/\.[a-z0-9]+$/i, '');

  let exact = imageFiles.find((candidate) => normalizeRef(candidate).endsWith(normalized));
  if (exact) return exact;

  exact = imageFiles.find((candidate) => path.basename(candidate).toLowerCase() === basename);
  if (exact) return exact;

  return (
    imageFiles.find((candidate) => path.basename(candidate).toLowerCase().replace(/\.[a-z0-9]+$/i, '') === basenameNoExt) ||
    null
  );
};

const toDataUrl = async (filePath: string) => {
  const bytes = await fs.readFile(filePath);
  const mime = inferMimeFromPath(filePath);
  return `data:${mime};base64,${bytes.toString('base64')}`;
};

const asImageDataUrlOrNull = (value: string | null | undefined) => {
  const text = String(value || '').trim();
  if (!text) return null;
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(text) ? text : null;
};

const getCompletionText = (content: unknown): string => {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && 'text' in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      }
      return '';
    })
    .join('')
    .trim();
};

const extractFirstJsonObject = (text: string) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Model did not return JSON object');
  }
  return text.slice(start, end + 1);
};

const isHexChar = (char: string) => /[0-9a-f]/i.test(char);

const escapeInvalidBackslashesInJsonStrings = (jsonText: string) => {
  let output = '';
  let inString = false;
  const validSimpleEscapes = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't']);

  const escapeControlChar = (char: string) => {
    if (char === '\n') return '\\n';
    if (char === '\r') return '\\r';
    if (char === '\t') return '\\t';
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
  };

  for (let i = 0; i < jsonText.length; i += 1) {
    const char = jsonText[i];

    if (char === '"') {
      // Count preceding backslashes to determine whether quote is escaped.
      let slashCount = 0;
      for (let j = i - 1; j >= 0 && jsonText[j] === '\\'; j -= 1) {
        slashCount += 1;
      }
      if (slashCount % 2 === 0) {
        inString = !inString;
      }
      output += char;
      continue;
    }

    if (inString && char === '\\') {
      const next = jsonText[i + 1];
      if (!next) {
        // Trailing backslash is invalid in JSON strings; preserve it as literal.
        output += '\\\\';
        continue;
      }

      if (validSimpleEscapes.has(next)) {
        output += `\\${next}`;
        i += 1;
        continue;
      }

      if (next === 'u') {
        const h1 = jsonText[i + 2] || '';
        const h2 = jsonText[i + 3] || '';
        const h3 = jsonText[i + 4] || '';
        const h4 = jsonText[i + 5] || '';
        const isValidUnicodeEscape = isHexChar(h1) && isHexChar(h2) && isHexChar(h3) && isHexChar(h4);

        if (isValidUnicodeEscape) {
          output += `\\u${h1}${h2}${h3}${h4}`;
          i += 5;
        } else {
          // Invalid \u escape from model output (common with OCR LaTeX like \underset).
          output += '\\\\';
        }
        continue;
      }

      // Invalid escaped character inside string; keep literal backslash.
      output += '\\\\';
      continue;
    }

    if (inString && char < ' ') {
      output += escapeControlChar(char);
      continue;
    }

    output += char;
  }

  return output;
};

const parseJsonErrorPosition = (errorMessage: string) => {
  const match = String(errorMessage || '').match(/position\s+(\d+)/i);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
};

const parseModelJsonObject = (rawText: string, contextLabel: string) => {
  const extracted = extractFirstJsonObject(rawText);

  try {
    return JSON.parse(extracted);
  } catch (initialError) {
    const repaired = escapeInvalidBackslashesInJsonStrings(extracted);
    try {
      return JSON.parse(repaired);
    } catch (repairedError) {
      const aggressiveRepaired = repaired.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
      try {
        return JSON.parse(aggressiveRepaired);
      } catch (aggressiveError) {
        const message = aggressiveError instanceof Error ? aggressiveError.message : String(aggressiveError);
        const position = parseJsonErrorPosition(message);
        const snippet =
          typeof position === 'number'
            ? aggressiveRepaired.slice(Math.max(0, position - 40), Math.min(aggressiveRepaired.length, position + 40))
            : aggressiveRepaired.slice(0, 120);

        throw new Error(
          `Model JSON parse failed in ${contextLabel}: ${message}. Snippet: ${JSON.stringify(snippet)}`
        );
      }
    }
  }
};

const escapeRegExp = (value: string) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseDelimitedFormattedQuestions = (content: string): ParsedQuestion[] => {
  const source = String(content || '');
  const blockRegex = /\[\[QSTART\|([^\]]+)\]\]([\s\S]*?)\[\[QEND\]\]/g;
  const parsed: ParsedQuestion[] = [];

  for (const match of source.matchAll(blockRegex)) {
    const metaRaw = String(match[1] || '').trim();
    const body = String(match[2] || '').trim();
    if (!body) continue;

    const meta: Record<string, string> = {};
    for (const token of metaRaw.split('|')) {
      const [rawKey, ...rest] = token.split('=');
      const key = String(rawKey || '').trim().toLowerCase();
      const value = rest.join('=').trim();
      if (key) meta[key] = value;
    }

    const questionNumber = String(meta.questionnumber || meta.qn || '').trim() || null;
    const label = String(meta.label || '').trim() || (questionNumber ? `Question ${questionNumber}` : `Question ${parsed.length + 1}`);
    const section = String(meta.section || '').trim().toLowerCase();

    parsed.push({
      index: parsed.length + 1,
      label,
      questionNumber,
      latex: body,
      imageRefs: extractQuestionImageRefs(body),
      isLikelyMcq: section === 'mcq' || isLikelyMcqMainQuestion(questionNumber),
    });
  }

  return parsed;
};

const filterNonEmptyQuestions = (questions: ParsedQuestion[]) => {
  return questions.filter((question) => {
    const stripped = stripEmbeddedImageCommands(question.latex);
    const withoutLabel = stripped
      .replace(new RegExp(`^\\s*${escapeRegExp(question.label)}\\s*[:.)-]*\\s*`, 'i'), '')
      .replace(new RegExp(`^\\s*Question\\s+${escapeRegExp(String(question.questionNumber || ''))}\\s*[:.)-]*\\s*`, 'i'), '')
      .trim();

    if (!withoutLabel) return false;
    return withoutLabel.length > 12 || /[0-9A-Za-z\\]/.test(withoutLabel);
  });
};

const stripEmbeddedImageCommands = (latex: string) => {
  const source = String(latex || '');
  if (!source.trim()) return '';

  // Remove TeX image includes such as: \includegraphics[...]{...}
  const noTexGraphics = source.replace(/\\includegraphics\*?(?:\[[^\]]*\])?\{[^}]*\}/g, '');
  // Remove markdown-style image embeds that sometimes leak through OCR/cleanup output.
  const noMarkdownImages = noTexGraphics.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  // Normalize excessive blank lines after stripping image commands.
  return noMarkdownImages.replace(/\n{3,}/g, '\n\n').trim();
};

const stripMcqOptionLines = (latex: string) => {
  const source = String(latex || '');
  if (!source.trim()) return '';

  return source
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:\(?[A-D]\)|[A-D][.)])\s+/.test(String(line || '').trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const lineHasMathDelimiters = (line: string) => {
  return /\\\(|\\\[|\$|\\begin\{(?:equation|align\*?|gather\*?|cases|array|matrix|pmatrix|bmatrix|vmatrix|Vmatrix)\}/.test(line);
};

const enforceLatexMathFormatting = (value: string) => {
  const source = String(value || '')
    .replace(/\\\\\(/g, '\\(')
    .replace(/\\\\\)/g, '\\)')
    .replace(/\\\\\[/g, '\\[')
    .replace(/\\\\\]/g, '\\]');

  const lines = source.split(/\r?\n/).map((line) => {
    if (!line.trim() || lineHasMathDelimiters(line)) return line;

    let output = line;

    // Convert simple base^power patterns into inline math.
    output = output
      .replace(/(^|[\s([\{\-+*/=,:;|])([0-9]*[A-Za-z]+)\^([-+]?[0-9]+)(?=\b)/g, (_match, prefix, base, power) => `${prefix}\\(${base}^{${power}}\\)`)
      .replace(/(^|[\s([\{\-+*/=,:;|])([0-9]*[A-Za-z]+)\^([A-Za-z])(?![A-Za-z0-9{])/g, (_match, prefix, base, power) => `${prefix}\\(${base}^{${power}}\\)`)
      .replace(/(^|[\s([\{\-+*/=,:;|])(\((?:[^()\n]|\([^()\n]*\))+\))\^([-+]?[0-9]+|[A-Za-z])(?=\b|\s|[).,;:])/g, (_match, prefix, base, power) => `${prefix}\\(${base}^{${power}}\\)`);

    // Convert plain numeric fractions to \frac.
    output = output.replace(/(^|[\s([\{\-+*=,:;])([0-9]+)\/([0-9]+)(?=$|[\s)\]}.,;:!?])/g, (_match, prefix, num, den) => {
      return `${prefix}\\(\\frac{${num}}{${den}}\\)`;
    });

    // Wrap remaining slash tokens like 1/x^2 or y/(2sqrt3) in inline math.
    output = output.replace(/(^|[\s([\{\-+*=,:;])([A-Za-z0-9][A-Za-z0-9(){}^.+\-]*\/[A-Za-z0-9][A-Za-z0-9(){}^.+\-]*)(?=$|[\s)\]}.,;:!?])/g, (_match, prefix, token) => {
      return `${prefix}\\(${token}\\)`;
    });

    // Wrap obvious equation segments containing '=' when no delimiters are present.
    output = output.replace(/(^|[^\\\w])([A-Za-z0-9(){}^+\-*/.= ]+\s=\s[A-Za-z0-9(){}^+\-*/.= ]+)(?=$|[.,;:!?])/g, (_match, prefix, expr) => {
      const compact = String(expr || '').trim();
      if (!compact) return _match;
      return `${prefix}\\(${compact}\\)`;
    });

    return output;
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const sanitizeMcqOptionText = (value: string | null | undefined) => {
  const source = String(value || '').trim();
  if (!source) return null;

  const normalized = source
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .trim();

  return normalized || null;
};

const parseMcqOptionsFromLatex = (latex: string): ParsedMcqOption[] => {
  const source = String(latex || '');
  if (!source.trim()) return [];

  const optionMatches = Array.from(source.matchAll(/(?:^|\n)\s*([A-D])\s*[.)]\s*/g));
  if (!optionMatches.length) return [];

  const parsed: ParsedMcqOption[] = [];

  for (let i = 0; i < optionMatches.length; i += 1) {
    const match = optionMatches[i];
    const label = String(match[1] || '').toUpperCase() as McqOptionLabel;
    if (!['A', 'B', 'C', 'D'].includes(label)) continue;

    const start = (match.index ?? 0) + String(match[0] || '').length;
    const end = i + 1 < optionMatches.length ? (optionMatches[i + 1].index ?? source.length) : source.length;
    const segment = source.slice(start, end).trim();

    const optionImageRef = extractQuestionImageRefs(segment)[0] || null;
    const optionText = sanitizeMcqOptionText(
      stripEmbeddedImageCommands(segment)
        .replace(/\\\\\s*$/g, '')
        .trim()
    );

    parsed.push({
      label,
      text: optionText,
      imageRef: optionImageRef,
    });
  }

  return parsed;
};

const formatMathpixMarkdownWithOpenAi = async (args: {
  openai: OpenAI;
  rawMarkdown: string;
}) => {
  const { openai, rawMarkdown } = args;

  const cleanedRawMarkdown = stripEmbeddedImageCommands(rawMarkdown);
  const boundedMarkdown = String(cleanedRawMarkdown || '').slice(0, 25000);

  const completion = await openai.chat.completions.create({
    model: MODEL_NAME,
    reasoning_effort: 'high',
    max_completion_tokens: 3000,
    messages: [
      {
        role: 'system',
        content: 'Normalize OCR-extracted exam markdown. Fix artifacts/escapes/duplicates while preserving meaning. Output plain text/markdown only. Do not invent questions. Do not output empty placeholders. Emit only real questions/subparts in deterministic [[QSTART|questionNumber=...|label=...|section=mcq|written]]...[[QEND]] blocks. Use section=mcq for questions 1-10, section=written otherwise. Output no other text.',
      },
      {
        role: 'user',
        content: `Raw markdown from Mathpix (.mmd):\n${boundedMarkdown || '(none)'}`,
      },
    ],
  });

  const text = getCompletionText(completion.choices?.[0]?.message?.content);
  if (text.trim()) {
    return text;
  }

  // Retry once with a simpler instruction set if the first pass returns no content.
  const retryCompletion = await openai.chat.completions.create({
    model: MODEL_NAME,
    reasoning_effort: 'medium',
    max_completion_tokens: 3000,
    messages: [
      {
        role: 'system',
        content: 'Clean and normalize OCR-extracted exam markdown. Preserve meaning and question order. Output plain markdown/text only.',
      },
      {
        role: 'user',
        content: `Normalize this OCR markdown into clean exam-question blocks:\n\n${boundedMarkdown}`,
      },
    ],
  });

  const retryText = getCompletionText(retryCompletion.choices?.[0]?.message?.content);
  if (retryText.trim()) {
    return retryText;
  }

  if (cleanedRawMarkdown.trim()) {
    console.warn('[pdf-ingest-v2] OpenAI markdown normalization returned empty content; falling back to raw markdown');
    return cleanedRawMarkdown;
  }

  const finishReason = String(completion.choices?.[0]?.finish_reason || 'unknown');
  const retryFinishReason = String(retryCompletion.choices?.[0]?.finish_reason || 'unknown');
  throw new Error(
    `OpenAI formatting pass returned empty content (finish_reason=${finishReason}, retry_finish_reason=${retryFinishReason})`
  );
};

const cleanQuestionWithOpenAi = async (args: {
  openai: OpenAI;
  question: ParsedQuestion;
  imageFiles: string[];
}) => {
  const { openai, question, imageFiles } = args;

  const referencedImagePaths = question.imageRefs
    .map((ref) => resolveImageFromReference(ref, imageFiles))
    .filter((value): value is string => Boolean(value));

  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [
    {
      type: 'text',
      text: [
        `Q${question.index}: ${question.label}`,
        'Return JSON: {questionText, sampleSolution, marks, questionType, mcqOptions, mcqCorrectAnswer, questionImageRefs, optionImageRefs}',
        'MCQ: stem only in questionText (no A-D lines), options as mcqOptions array. Estimate marks 1-5.',
        '',
        question.latex,
      ].join('\n'),
    },
  ];

  for (const imagePath of referencedImagePaths) {
    userContent.push({
      type: 'image_url',
      image_url: { url: await toDataUrl(imagePath) },
    });
  }

  const completion = await openai.chat.completions.create({
    model: MODEL_NAME,
    reasoning_effort: 'high',
    max_completion_tokens: 10000,
    messages: [
      {
        role: 'system',
        content: `Clean OCR exam content. JSON only, no markdown. Remove \\includegraphics. Concise LaTeX. ${SHARED_STEM_RULE} ${NO_REPEAT_SUBPART_RULE} ${MCQ_RULES} ${LATEX_RULES} ${TABLE_RULES} Written answers: step-by-step with clear final answer, blank lines between steps. questionType written|multiple_choice. Estimate marks 1-15. Reference MathPix image names in questionImageRefs/optionImageRefs keys.`,
      },
      {
        role: 'user',
        content: userContent,
      },
    ],
  });

  const rawText = getCompletionText(completion.choices?.[0]?.message?.content);
  const parsedJson = parseModelJsonObject(rawText, `single batch ${question.label}`);
  const cleaned = CleanedQuestionSchema.parse(parsedJson);

  return {
    cleaned,
    rawText,
    referencedImagePaths,
  };
};

const cleanQuestionBatchWithOpenAi = async (args: {
  openai: OpenAI;
  batch: ParsedQuestionBatch;
  imageFiles: string[];
}) => {
  const { openai, batch, imageFiles } = args;

  const inputQuestions = batch.questions.map((question) => ({
    index: question.index,
    label: question.label,
    questionNumber: question.questionNumber,
  }));

  if (batch.questions.length === 1) {
    const single = await cleanQuestionWithOpenAi({
      openai,
      question: batch.questions[0],
      imageFiles,
    });

    return {
      solvedQuestions: [
        {
          sourceQuestion: batch.questions[0],
          cleaned: single.cleaned,
        },
      ] satisfies BatchSolvedQuestion[],
      debug: {
        batchIndex: batch.index,
        batchLabel: batch.label,
        groupedCount: batch.questions.length,
        usedGroupedPrompt: false,
        systemPrompt: '',
        userPrompt: '',
        inputQuestions,
      } satisfies BatchPromptDebug,
    };
  }

  const userContent: Array<{ type: 'text'; text: string }> = [
    {
      type: 'text',
      text: [
        `Batch: ${batch.label} (${batch.questions.length} subparts)`,
        'Return {"solutions":[{questionNumber,label,questionText,sampleSolution,marks,questionType,mcqOptions,mcqCorrectAnswer,questionImageRefs,optionImageRefs}...]}',
        `Exactly ${batch.questions.length} solutions in order, one per subpart. No merging.`,
        'Input subparts:',
        ...batch.questions.map((question, index) => [
          `--- ${index + 1}. ${question.label} ---`,
          question.latex,
        ].join('\n')),
      ].join('\n\n'),
    },
  ];

  const systemPrompt = `Solve OCR-extracted exam questions. Output JSON only with key "solutions" containing array of {questionNumber, label, questionText, sampleSolution, marks, questionType, mcqOptions, mcqCorrectAnswer, questionImageRefs, optionImageRefs}. ${SHARED_STEM_RULE} ${NO_REPEAT_SUBPART_RULE} ${MCQ_RULES} ${LATEX_RULES} ${TABLE_RULES} Step-by-step working with clear final answer. Remove image commands. Do not merge subparts.`;

  const userPrompt = userContent
    .map((item) => (item.type === 'text' ? item.text : ''))
    .join('\n\n')
    .trim();

  const completion = await openai.chat.completions.create({
    model: MODEL_NAME,
    reasoning_effort: 'medium',
    max_completion_tokens: 10000,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userContent,
      },
    ],
  });

  const rawText = getCompletionText(completion.choices?.[0]?.message?.content);
  const parsedJson = parseModelJsonObject(rawText, `grouped batch ${batch.label}`) as { solutions?: unknown[] };
  const solutions = Array.isArray(parsedJson?.solutions) ? parsedJson.solutions : [];

  if (solutions.length !== batch.questions.length) {
    throw new Error(
      `Grouped solve returned ${solutions.length} solutions for ${batch.questions.length} inputs in ${batch.label}`
    );
  }

  const solvedQuestions = solutions.map((entry, index) => {
    const record = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    const cleaned = CleanedQuestionSchema.parse(record);
    return {
      sourceQuestion: batch.questions[index],
      cleaned,
    } satisfies BatchSolvedQuestion;
  });

  return {
    solvedQuestions,
    debug: {
      batchIndex: batch.index,
      batchLabel: batch.label,
      groupedCount: batch.questions.length,
      usedGroupedPrompt: true,
      systemPrompt,
      userPrompt,
      inputQuestions,
    } satisfies BatchPromptDebug,
  };
};

const runMathpixPipeline = async (args: {
  pdfBuffer: Buffer;
  pdfFileName: string;
  workDir: string;
  pollIntervalMs: number;
  maxWaitMs: number;
}) => {
  const credentials = getMathpixCredentials();
  if (!credentials.appId || !credentials.appKey) {
    throw new Error('Missing Mathpix credentials. Set MATHPIX_APP_ID and MATHPIX_APP_KEY.');
  }

  const submitToMathpix = async (formats: Record<string, boolean>) => {
    const form = new FormData();
    form.set(
      'file',
      new Blob([new Uint8Array(args.pdfBuffer)], { type: 'application/pdf' }),
      args.pdfFileName || 'exam.pdf'
    );
    form.set(
      'options_json',
      JSON.stringify({
        conversion_formats: formats,
      })
    );

    const response = await fetchMathpix('/v3/pdf', { method: 'POST', body: form }, credentials);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.pdf_id) {
      throw new Error(`Mathpix submit failed: ${response.status} ${JSON.stringify(payload)}`);
    }

    return {
      pdfId: String(payload.pdf_id),
      usedConversionFormats: Object.keys(formats),
    };
  };

  const submitResult = await submitToMathpix({
    'tex.zip': true,
  });

  const pdfId = submitResult.pdfId;
  const status = await pollMathpixUntilComplete(pdfId, args.pollIntervalMs, args.maxWaitMs, credentials);
  const mmdText = '';

  let texZipPath: string | null = null;
  let extractedDir: string | null = null;
  let bestTexFile: string | null = null;
  let texContent: string | null = null;
  let imagesDir: string | null = null;
  let imageFiles: string[] = [];

  try {
    const texZipBytes = await downloadMathpixTexZip(pdfId, credentials);
    texZipPath = path.join(args.workDir, `${randomUUID()}.tex.zip`);
    await fs.writeFile(texZipPath, texZipBytes);

    extractedDir = path.join(args.workDir, `mathpix-tex-${randomUUID()}`);
    await extractZip(texZipPath, extractedDir);
    const extractedFiles = await listFilesRecursive(extractedDir);

    bestTexFile = findBestTexFile(extractedFiles);
    if (bestTexFile) {
      const loadedTex = await fs.readFile(bestTexFile, 'utf8');
      texContent = loadedTex.trim() ? loadedTex : null;
    }

    imagesDir = findImagesDir(extractedFiles);
    imageFiles = findImageFiles(extractedFiles);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pdf-ingest-v2] Optional tex.zip processing skipped: ${message}`);
  }

  return {
    pdfId,
    status: status.status,
    percentDone: status.percentDone,
    mmdText,
    usedConversionFormats: submitResult.usedConversionFormats,
    texZipPath,
    extractedDir,
    texFilePath: bestTexFile,
    texContent,
    imagesDir,
    imageFiles,
  } satisfies MathpixResult;
};

const isDevOnlyAllowed = () => {
  if (process.env.NODE_ENV !== 'production') return true;
  return String(process.env.ENABLE_PDF_INGEST_V2_DEV || '').trim().toLowerCase() === 'true';
};

export async function POST(request: Request) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-ingest-v2-'));
  let stage = 'init';

  try {
    stage = 'dev-gate';
    if (!isDevOnlyAllowed()) {
      return NextResponse.json(
        {
          error: 'pdf-ingest-v2 is a dev-only endpoint',
          code: 'DEV_ONLY_ENDPOINT',
          stage,
        },
        { status: 403 }
      );
    }

    stage = 'read-form-data';
    const formData = await request.formData();
    const pdf = formData.get('pdf');

    if (!(pdf instanceof File)) {
      return NextResponse.json(
        { error: 'Missing PDF upload. Include form-data field "pdf".' },
        { status: 400 }
      );
    }

    const grade = String(formData.get('grade') || '').trim();
    const subject = String(formData.get('subject') || '').trim();
    const schoolName = String(formData.get('school') || formData.get('schoolName') || '').trim();
    const yearRaw = String(formData.get('year') || '').trim();
    const year = Number.parseInt(yearRaw, 10);
    const dryRun = parseBoolean(formData.get('dryRun'), false);

    if (!dryRun && (!grade || !subject || !schoolName || !Number.isFinite(year))) {
      return NextResponse.json(
        { error: 'grade, subject, school/schoolName, and numeric year are required.' },
        { status: 400 }
      );
    }

    const maxQuestions = Math.max(1, Math.min(500, normalizePositiveInteger(formData.get('maxQuestions'), 200)));
    const overwrite = parseBoolean(formData.get('overwrite'), false);
    const groupingModeRaw = String(formData.get('groupingMode') || 'letter_subpart').trim().toLowerCase();
    const groupingMode: GroupingMode = groupingModeRaw === 'letter_subpart' ? 'letter_subpart' : 'main_question';
    const classifyAfterUpload = parseBoolean(formData.get('classifyAfterUpload'), true);
    const pollIntervalMs = Math.max(1000, Math.min(60000, normalizePositiveInteger(formData.get('mathpixPollIntervalMs'), 3000)));
    const maxWaitMs = Math.max(10000, Math.min(7200000, normalizePositiveInteger(formData.get('mathpixMaxWaitMs'), 900000)));

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY server configuration' },
        { status: 500 }
      );
    }

    stage = 'initialize-openai';
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const pdfBuffer = Buffer.from(await pdf.arrayBuffer());

    stage = 'mathpix-pipeline';
    const mathpix = await runMathpixPipeline({
      pdfBuffer,
      pdfFileName: pdf.name || 'exam.pdf',
      workDir,
      pollIntervalMs,
      maxWaitMs,
    });

    stage = 'latex-only-debug';
    const rawLatexContent = String(mathpix.texContent || '').trim();
    const formattedMarkdownContent = rawLatexContent;
    if (!rawLatexContent) {
      return NextResponse.json(
        {
          error: 'Mathpix returned no raw LaTeX content',
          stage,
        },
        { status: 422 }
      );
    }

    stage = 'split-questions-with-openai';
    const splitCompletion = await openai.chat.completions.create({
      model: MODEL_NAME,
      reasoning_effort: 'medium',
      max_completion_tokens: 50000,
      messages: [
        {
          role: 'system',
          content: [
            'Split exam LaTeX into individual question blocks for downstream grouped solving.',
            CRITICAL_SPLITTING_RULE,
            SHARED_STEM_RULE,
            NO_REPEAT_SUBPART_RULE,
            'Keep original order. Do not merge questions.',
            'Always include subparts as separate entries when present.',
            'Return STRICT JSON only: {"questions":[{"questionNumber":"2|11 (a)|11 (a)(i)","label":"Question 11 (a)(i)","latex":"raw latex block","imageRefs":["mathpix-image-ref"]}]}.',
            'The imageRefs field is required for each question entry and must contain image identifiers referenced by that specific question latex when available.',
            'If no image ref exists for a question, return imageRefs as an empty array [].',
          ].join(' '),
        },
        {
          role: 'user',
          content: rawLatexContent,
        },
      ],
    });

    const rawSplitOutput = getCompletionText(splitCompletion.choices?.[0]?.message?.content);
    const splitParsed = parseModelJsonObject(rawSplitOutput, 'split-questions-with-openai') as {
      questions?: Array<Record<string, unknown>>;
    };

    const splitBlocks = (Array.isArray(splitParsed?.questions) ? splitParsed.questions : [])
      .map((entry, index) => {
        const record = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
        const latex = String(record.latex || '').trim();
        if (!latex) return null;

        const questionNumberRaw = String(record.questionNumber || '').trim();
        const questionNumber = questionNumberRaw || null;
        const label = String(record.label || '').trim() || (questionNumber ? `Question ${questionNumber}` : `Question ${index + 1}`);

        const explicitRefs = Array.isArray(record.imageRefs)
          ? record.imageRefs.map((value) => String(value || '').trim()).filter(Boolean)
          : [];
        const imageRefs = Array.from(new Set([...explicitRefs, ...extractQuestionImageRefs(latex)]));

        return {
          index: index + 1,
          label,
          questionNumber,
          latex,
          imageRefs,
        };
      })
      .filter((entry): entry is {
        index: number;
        label: string;
        questionNumber: string | null;
        latex: string;
        imageRefs: string[];
      } => Boolean(entry));

    const questionBlocks = splitBlocks.slice(0, maxQuestions);
    if (!questionBlocks.length) {
      return NextResponse.json(
        {
          error: 'OpenAI splitter returned no question blocks',
          stage,
          rawLatexFromMathpix: rawLatexContent,
          rawSplitOutput,
        },
        { status: 422 }
      );
    }

    stage = 'solve-question-blocks-with-openai';
    const solvedBlocks: Array<{
      index: number;
      label: string;
      questionNumber: string;
      inputLatex: string;
      imageRefs: string[];
      imageCount: number;
      questionImageDataUrls: string[];
      questionType: 'written' | 'multiple_choice';
      mcqOptions: ParsedMcqOption[];
      mcqOptionAImage: string | null;
      mcqOptionBImage: string | null;
      mcqOptionCImage: string | null;
      mcqOptionDImage: string | null;
      mcqCorrectAnswer: 'A' | 'B' | 'C' | 'D' | null;
      formattedQuestionLatex: string;
      solutionLatex: string;
      rawChatGptOutput: Record<string, unknown>;
    }> = [];
    const splitSolveFailures: Array<Record<string, unknown>> = [];

    for (const sourceQuestion of questionBlocks) {
      try {
        const referencedImagePaths = sourceQuestion.imageRefs
          .map((ref) => resolveImageFromReference(ref, mathpix.imageFiles))
          .filter((value): value is string => Boolean(value));

        const userContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
          {
            type: 'text',
            text: [
              `Question label: ${sourceQuestion.label}`,
              `Question number: ${sourceQuestion.questionNumber || sourceQuestion.label}`,
              `Attached image count: ${referencedImagePaths.length}`,
              'Return STRICT JSON only:',
              '{"questionNumber":"2|11 (a)|11 (a)(i)","label":"Question 11 (a)(i)","questionType":"written|multiple_choice","formattedQuestionLatex":"...","mcqOptions":[{"label":"A","text":"...","imageRef":"mathpix-image-ref|null"},{"label":"B","text":"...","imageRef":"mathpix-image-ref|null"},{"label":"C","text":"...","imageRef":"mathpix-image-ref|null"},{"label":"D","text":"...","imageRef":"mathpix-image-ref|null"}],"optionImageRefs":{"A":"mathpix-image-ref|null","B":"mathpix-image-ref|null","C":"mathpix-image-ref|null","D":"mathpix-image-ref|null"},"mcqCorrectAnswer":"A|B|C|D|null","solutionLatex":"...","questionImageRefs":["mathpix-image-ref"]}',
              '',
              CRITICAL_SPLITTING_RULE,
              'Rules:',
              '- Return exactly one solved output for this input question block.',
              '- Do not repeat shared context across sibling subparts. If a shared table/graph/setup appears in one subpart, avoid duplicating it in later subparts.',
              '- Identify whether the question is written or multiple-choice and return it as questionType.',
              '- If questionType is multiple_choice: return all options in mcqOptions and keep formattedQuestionLatex as the question stem only (no options).',
              '- If questionType is written: set mcqOptions to [] and mcqCorrectAnswer to null.',
              '- For MCQ option images, include per-option image refs in optionImageRefs and/or each mcqOptions[].imageRef.',
              '- Include questionImageRefs for each solution so image association is explicit.',
              '- If images are attached, use them for solving but do not describe image content in the output text.',
              '',
              'Input question LaTeX:',
              sourceQuestion.latex,
            ].join('\n'),
          },
        ];

        for (const imagePath of referencedImagePaths) {
          userContent.push({
            type: 'image_url',
            image_url: { url: await toDataUrl(imagePath) },
          });
        }

        const questionImageDataUrls = (
          await Promise.all(referencedImagePaths.map((imagePath) => toDataUrl(imagePath)))
        )
          .map((value) => asImageDataUrlOrNull(value))
          .filter((value): value is string => Boolean(value));

        const solveCompletion = await openai.chat.completions.create({
          model: MODEL_NAME,
          reasoning_effort: 'high',
          max_completion_tokens: 20000,
          messages: [
            {
              role: 'system',
              content: `You are cleaning OCR LaTeX exam questions and producing solved outputs. Preserve math meaning. Return JSON only with questionNumber, questionType, formattedQuestionLatex, mcqOptions, optionImageRefs, questionImageRefs, mcqCorrectAnswer, solutionLatex. questionType must be exactly "written" or "multiple_choice". For multiple_choice, return all options in mcqOptions and keep formattedQuestionLatex as the stem only with no option lines. For written, return mcqOptions as [] and mcqCorrectAnswer as null. ${SHARED_STEM_RULE} ${NO_REPEAT_SUBPART_RULE} If images are provided, do not describe image contents in output text. Use images only to solve. Do not include markdown code fences.`,
            },
            {
              role: 'user',
              content: userContent,
            },
          ],
        });

        const rawSolveOutput = getCompletionText(solveCompletion.choices?.[0]?.message?.content);
        const solveParsedRoot = parseModelJsonObject(rawSolveOutput, `solve-question-${sourceQuestion.index}`) as Record<string, unknown>;
        const solveParsed = solveParsedRoot && typeof solveParsedRoot === 'object'
          ? (Array.isArray(solveParsedRoot.solutions)
              ? (solveParsedRoot.solutions[0] as Record<string, unknown> | undefined) || {}
              : (solveParsedRoot.solution && typeof solveParsedRoot.solution === 'object'
                  ? (solveParsedRoot.solution as Record<string, unknown>)
                  : solveParsedRoot))
          : {};

        const solvedQuestionNumberRaw = String(solveParsed.questionNumber || '').trim();
        const solvedQuestionNumber = solvedQuestionNumberRaw || sourceQuestion.questionNumber || sourceQuestion.label;

        const normalizedQuestionType = String(solveParsed.questionType || '').trim().toLowerCase();
        const questionType: 'written' | 'multiple_choice' = normalizedQuestionType === 'multiple_choice'
          ? 'multiple_choice'
          : 'written';

        const modelOptionImageRefs = normalizeOptionImageRefs(solveParsed.optionImageRefs);
        const parsedModelMcqOptions: ParsedMcqOption[] = Array.isArray(solveParsed.mcqOptions)
          ? solveParsed.mcqOptions
              .map((entry): ParsedMcqOption | null => {
                const record = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null;
                if (!record) return null;

                const labelRaw = String(record.label || '').trim().toUpperCase();
                const label = ['A', 'B', 'C', 'D'].includes(labelRaw) ? (labelRaw as McqOptionLabel) : null;
                if (!label) return null;

                const text = sanitizeMcqOptionText(record.text == null ? null : String(record.text));
                if (!text) return null;

                const optionImageRef = String(record.imageRef || '').trim();
                return {
                  label,
                  text,
                  imageRef: optionImageRef || modelOptionImageRefs[label] || null,
                };
              })
              .filter((entry): entry is ParsedMcqOption => entry !== null)
          : [];

        const formattedQuestionStem = String(solveParsed.formattedQuestionLatex || '').trim();
        const fallbackParsedOptions = parseMcqOptionsFromLatex(formattedQuestionStem);
        const mcqOptions = questionType === 'multiple_choice'
          ? (parsedModelMcqOptions.length ? parsedModelMcqOptions : fallbackParsedOptions)
          : [];

        const optionRefByLabel = new Map<McqOptionLabel, string | null>();
        for (const label of ['A', 'B', 'C', 'D'] as const) {
          const fromModelOption = parsedModelMcqOptions.find((option) => option.label === label)?.imageRef || null;
          const fromFallbackOption = fallbackParsedOptions.find((option) => option.label === label)?.imageRef || null;
          optionRefByLabel.set(label, modelOptionImageRefs[label] || fromModelOption || fromFallbackOption || null);
        }

        const formattedQuestionLatex = questionType === 'multiple_choice'
          ? stripMcqOptionLines(formattedQuestionStem)
          : formattedQuestionStem;

        const mcqCorrectAnswerRaw = String(solveParsed.mcqCorrectAnswer || '').trim().toUpperCase();
        const mcqCorrectAnswer = questionType === 'multiple_choice' && ['A', 'B', 'C', 'D'].includes(mcqCorrectAnswerRaw)
          ? (mcqCorrectAnswerRaw as 'A' | 'B' | 'C' | 'D')
          : null;
        const solutionLatex = String(solveParsed.solutionLatex || '').trim();

        if (!formattedQuestionLatex || !solutionLatex) {
          throw new Error('Solve output missing formattedQuestionLatex or solutionLatex');
        }

        const modelImageRefs = Array.isArray(solveParsed.questionImageRefs)
          ? solveParsed.questionImageRefs.map((value) => String(value || '').trim()).filter(Boolean)
          : [];
        const mergedImageRefs = Array.from(new Set([...modelImageRefs, ...sourceQuestion.imageRefs]));

        const optionImageRefsInUse = new Set(
          (['A', 'B', 'C', 'D'] as const)
            .map((label) => optionRefByLabel.get(label))
            .filter((value): value is string => Boolean(value))
        );

        const questionImagePaths = mergedImageRefs
          .filter((ref) => !optionImageRefsInUse.has(ref))
          .map((ref) => resolveImageFromReference(ref, mathpix.imageFiles))
          .filter((value): value is string => Boolean(value));
        const perQuestionImageDataUrls = (
          await Promise.all(questionImagePaths.map((imagePath) => toDataUrl(imagePath)))
        )
          .map((value) => asImageDataUrlOrNull(value))
          .filter((value): value is string => Boolean(value));

        const resolveOptionImageData = async (label: McqOptionLabel) => {
          const optionRef = optionRefByLabel.get(label);
          if (!optionRef) return null;
          const resolved = resolveImageFromReference(optionRef, mathpix.imageFiles);
          if (!resolved) return null;
          return asImageDataUrlOrNull(await toDataUrl(resolved));
        };

        const mcqOptionAImage = questionType === 'multiple_choice' ? await resolveOptionImageData('A') : null;
        const mcqOptionBImage = questionType === 'multiple_choice' ? await resolveOptionImageData('B') : null;
        const mcqOptionCImage = questionType === 'multiple_choice' ? await resolveOptionImageData('C') : null;
        const mcqOptionDImage = questionType === 'multiple_choice' ? await resolveOptionImageData('D') : null;

        solvedBlocks.push({
          index: sourceQuestion.index,
          label: sourceQuestion.label,
          questionNumber: solvedQuestionNumber,
          inputLatex: sourceQuestion.latex,
          imageRefs: mergedImageRefs,
          imageCount: questionImagePaths.length,
          questionImageDataUrls: perQuestionImageDataUrls,
          questionType,
          mcqOptions,
          mcqOptionAImage,
          mcqOptionBImage,
          mcqOptionCImage,
          mcqOptionDImage,
          mcqCorrectAnswer,
          formattedQuestionLatex,
          solutionLatex,
          rawChatGptOutput: solveParsed,
        });
      } catch (error) {
        splitSolveFailures.push({
          index: sourceQuestion.index,
          label: sourceQuestion.label,
          questionNumber: sourceQuestion.questionNumber,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        debugOnly: true,
        persistence: 'disabled',
        source: {
          type: 'mathpix-tex-only',
          pdfId: mathpix.pdfId,
          status: mathpix.status,
          percentDone: mathpix.percentDone,
          conversionFormats: mathpix.usedConversionFormats,
          texFilePath: mathpix.texFilePath,
          imageCount: mathpix.imageFiles.length,
        },
        rawLatexFromMathpix: rawLatexContent,
        splitQuestionsJson: {
          total: splitBlocks.length,
          processed: questionBlocks.length,
          questions: questionBlocks,
          rawChatGptOutput: splitParsed,
        },
        solvedQuestions: solvedBlocks,
        failed: splitSolveFailures.length,
        failures: splitSolveFailures,
      });
    }

    stage = 'persist-solved-questions';
    if (overwrite) {
      const { error: deleteError } = await supabaseAdmin
        .from('hsc_questions')
        .delete()
        .match({
          grade,
          year,
          subject,
          school_name: schoolName,
        });

      if (deleteError) {
        throw new Error(`Failed to overwrite existing questions: ${deleteError.message}`);
      }
    }

    const uploadableSolvedBlocks = solvedBlocks.filter((entry) => {
      const questionText = stripEmbeddedImageCommands(entry.formattedQuestionLatex).trim();
      return Boolean(questionText);
    });

    const getImageSharingGroupKey = (questionNumber: string) => {
      const parts = parseQuestionNumberParts(questionNumber);
      if (!parts.main) return null;

      if (parts.roman && parts.part) {
        // Roman sibling subparts share the same parent letter part (e.g. 11 (a)(i), 11 (a)(ii)).
        return `roman:${parts.main}:${parts.part}`;
      }

      if (parts.part) {
        // Letter sibling subparts share the same main question (e.g. 11 (a), 11 (b)).
        return `letter:${parts.main}`;
      }

      return null;
    };

    const firstImageCarrierByGroup = new Map<string, string>();
    for (const entry of [...uploadableSolvedBlocks].sort((a, b) => a.index - b.index)) {
      const groupKey = getImageSharingGroupKey(entry.questionNumber);
      if (!groupKey || !entry.questionImageDataUrls.length) continue;
      if (!firstImageCarrierByGroup.has(groupKey)) {
        firstImageCarrierByGroup.set(groupKey, entry.questionNumber);
      }
    }

    const insertPayload = uploadableSolvedBlocks.map((entry) => {
      const optionByLabel = new Map(entry.mcqOptions.map((option) => [option.label, option]));
      const isMultipleChoice = entry.questionType === 'multiple_choice';
      const cleanedQuestionText = enforceLatexMathFormatting(stripEmbeddedImageCommands(entry.formattedQuestionLatex));
      const cleanedSolution = enforceLatexMathFormatting(stripEmbeddedImageCommands(entry.solutionLatex));

      const imageSharingGroupKey = getImageSharingGroupKey(entry.questionNumber);
      const shouldAttachQuestionImages = !imageSharingGroupKey ||
        firstImageCarrierByGroup.get(imageSharingGroupKey) === entry.questionNumber;
      const questionImageDataUrls = shouldAttachQuestionImages ? entry.questionImageDataUrls : [];

      return {
        grade,
        year,
        subject,
        school_name: schoolName,
        paper_number: 1,
        paper_label: `${schoolName} ${year} Paper 1`,
        topic: 'Unspecified',
        subtopic: null,
        syllabus_dot_point: null,
        marks: isMultipleChoice ? 1 : Math.max(1, inferMarksFromLatex(entry.inputLatex)),
        question_number: entry.questionNumber,
        question_text: cleanedQuestionText,
        question_type: isMultipleChoice ? 'multiple_choice' : 'written',
        marking_criteria: null,
        sample_answer: isMultipleChoice ? null : (cleanedSolution || null),
        sample_answer_image: null,
        mcq_option_a: isMultipleChoice ? (optionByLabel.get('A')?.text || null) : null,
        mcq_option_b: isMultipleChoice ? (optionByLabel.get('B')?.text || null) : null,
        mcq_option_c: isMultipleChoice ? (optionByLabel.get('C')?.text || null) : null,
        mcq_option_d: isMultipleChoice ? (optionByLabel.get('D')?.text || null) : null,
        mcq_option_a_image: isMultipleChoice ? (entry.mcqOptionAImage || optionByLabel.get('A')?.imageRef || null) : null,
        mcq_option_b_image: isMultipleChoice ? (entry.mcqOptionBImage || optionByLabel.get('B')?.imageRef || null) : null,
        mcq_option_c_image: isMultipleChoice ? (entry.mcqOptionCImage || optionByLabel.get('C')?.imageRef || null) : null,
        mcq_option_d_image: isMultipleChoice ? (entry.mcqOptionDImage || optionByLabel.get('D')?.imageRef || null) : null,
        mcq_correct_answer: isMultipleChoice ? entry.mcqCorrectAnswer : null,
        mcq_explanation: isMultipleChoice ? (cleanedSolution || null) : null,
        graph_image_data: questionImageDataUrls[0] || null,
        graph_image_data_list: questionImageDataUrls.length ? questionImageDataUrls : null,
        graph_image_size: questionImageDataUrls.length ? 'medium' : 'missing',
        difficulty: null,
      };
    });

    if (!insertPayload.length) {
      return NextResponse.json(
        {
          error: 'No valid solved question payloads generated for database insert',
          stage,
          solved: solvedBlocks.length,
          failed: splitSolveFailures.length,
        },
        { status: 422 }
      );
    }

    const { data: insertedRows, error: insertError } = await supabaseAdmin
      .from('hsc_questions')
      .insert(insertPayload)
      .select('id, question_number, question_type, graph_image_data, graph_image_data_list');

    if (insertError) {
      throw new Error(`Failed to persist questions: ${insertError.message}`);
    }

    let classificationResult: Record<string, unknown> | null = null;
    if (classifyAfterUpload) {
      try {
        const classifyUrl = new URL('/api/hsc/classify-unspecified-topics', request.url).toString();
        const classifyResponse = await fetch(classifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grade,
            year,
            subject,
            school: schoolName,
          }),
        });

        classificationResult = await classifyResponse.json().catch(() => ({
          success: false,
          status: classifyResponse.status,
          error: 'Failed to parse classify-unspecified-topics response',
        }));
      } catch (error) {
        classificationResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return NextResponse.json({
      success: true,
      debugOnly: false,
      persistence: 'enabled',
      source: {
        type: 'mathpix-tex-only',
        pdfId: mathpix.pdfId,
        status: mathpix.status,
        percentDone: mathpix.percentDone,
        conversionFormats: mathpix.usedConversionFormats,
        texFilePath: mathpix.texFilePath,
        imageCount: mathpix.imageFiles.length,
      },
      rawLatexFromMathpix: rawLatexContent,
      splitQuestionsJson: {
        total: splitBlocks.length,
        processed: questionBlocks.length,
        groupedBatches: 0,
        groupingMode,
        questions: questionBlocks,
        rawChatGptOutput: splitParsed,
      },
      solvedQuestions: solvedBlocks,
      uploaded: Array.isArray(insertedRows) ? insertedRows.length : 0,
      insertedRows,
      classifyAfterUpload,
      classificationResult,
      failed: splitSolveFailures.length,
      failures: splitSolveFailures,
    });

    stage = 'split-questions';
    const splitByDelimited = parseDelimitedFormattedQuestions(formattedMarkdownContent);
    const splitByHeaders = splitQuestions(formattedMarkdownContent);
    const splitBySubparts = splitLatexQuestionSubparts(formattedMarkdownContent);

    let split: ParsedQuestion[] = [];
    if (splitByDelimited.length > 0) {
      split = splitByDelimited;
    } else {
      const hasStructuredHeaderSplit =
        splitByHeaders.length > 1 || splitByHeaders.some((item) => Boolean(item.questionNumber));
      split = hasStructuredHeaderSplit
        ? splitByHeaders
        : (splitBySubparts.length ? splitBySubparts : splitByHeaders);
    }

    split = filterNonEmptyQuestions(split);
    const groupedQuestions = groupParsedQuestions(split, groupingMode);
    const parsedBatches = groupedQuestions.slice(0, maxQuestions);
    if (!parsedBatches.length) {
      return NextResponse.json(
        {
          error: 'No questions were detected in Mathpix output',
          source: { pdfId: mathpix.pdfId, status: mathpix.status },
        },
        { status: 422 }
      );
    }

    if (dryRun) {
      stage = 'dry-run-preview';
      const previewQuestions = parsedBatches
        .flatMap((batch) =>
          batch.questions.map((question) => ({
            index: question.index,
            label: question.label,
            questionNumber: question.questionNumber,
            isLikelyMcq: question.isLikelyMcq,
            imageRefs: question.imageRefs,
            latexPreview: question.latex.slice(0, 800),
          }))
        )
        .slice(0, 200);

      return NextResponse.json({
        success: true,
        dryRun: true,
        model: MODEL_NAME,
        groupingMode,
        source: {
          type: 'mathpix',
          pdfId: mathpix.pdfId,
          status: mathpix.status,
          percentDone: mathpix.percentDone,
          conversionFormats: mathpix.usedConversionFormats,
          texZipExtracted: Boolean(mathpix.texZipPath),
          texFilePath: mathpix.texFilePath,
          imagesDir: mathpix.imagesDir,
          imageCount: mathpix.imageFiles.length,
          rawMarkdownContent: mathpix.mmdText,
          formattedMarkdownContent,
          rawTexContent: mathpix.texContent,
        },
        totalDetected: parsedBatches.length,
        processingQueue: parsedBatches.slice(0, 100).map((batch) => ({
          index: batch.index,
          label: batch.label,
          questionNumber: batch.questionNumber,
          groupedCount: batch.questions.length,
          groupedQuestions: batch.questions.map((question) => ({
            index: question.index,
            label: question.label,
            questionNumber: question.questionNumber,
            imageRefs: question.imageRefs,
          })),
        })),
        previewQuestions,
      });
    }

    stage = 'solve-questions';
    const imageFiles = mathpix.imageFiles;

    const failures: InsertFailure[] = [];
    const outputs: Array<Record<string, unknown>> = [];
    const groupedPromptDebug: BatchPromptDebug[] = [];

    for (const batch of parsedBatches) {
      try {
        stage = `clean-question-batch-${batch.index}`;
        const batchCleanResult = await cleanQuestionBatchWithOpenAi({
          openai,
          batch,
          imageFiles,
        });
        groupedPromptDebug.push(batchCleanResult.debug);
        const solvedQuestions = batchCleanResult.solvedQuestions;

        for (const solved of solvedQuestions) {
          const question = solved.sourceQuestion;
          const cleaned = solved.cleaned;
          const cleanedQuestionText = enforceLatexMathFormatting(stripEmbeddedImageCommands(cleaned.questionText));
          const cleanedSampleSolution = enforceLatexMathFormatting(stripEmbeddedImageCommands(cleaned.sampleSolution));

          if (!cleanedQuestionText.trim()) {
            throw new Error('OpenAI returned empty cleaned questionText after image-command removal');
          }

          const inferredMarks = cleaned.marks ?? inferMarksFromLatex(question.latex);

          const parsedOptionFallbacks = parseMcqOptionsFromLatex(question.latex);
          const optionFallbackByLabel = new Map(parsedOptionFallbacks.map((option) => [option.label, option]));
          const optionFallbackImageRefs = new Set(
            parsedOptionFallbacks
              .map((option) => option.imageRef)
              .filter((value): value is string => Boolean(value))
          );

          const optionByLabel = new Map(cleaned.mcqOptions.map((option) => [option.label, option]));
          const resolveImageData = async (ref: string | null | undefined) => {
            if (!ref) return null;
            const resolved = resolveImageFromReference(ref, imageFiles);
            return resolved ? toDataUrl(resolved) : null;
          };

          const fallbackQuestionImageRefs = question.imageRefs.filter((ref) => !optionFallbackImageRefs.has(ref));
          const cleanedQuestionImageRefs = cleaned.questionImageRefs.filter(Boolean);
          const questionImageRefs = Array.from(new Set([
            ...cleanedQuestionImageRefs,
            ...fallbackQuestionImageRefs,
          ])).filter((ref) => !optionFallbackImageRefs.has(ref));
          const questionImageDataUrls = (
            await Promise.all(questionImageRefs.map((ref) => resolveImageData(ref)))
          )
            .map((value) => asImageDataUrlOrNull(value))
            .filter((value): value is string => Boolean(value));

          const resolveOptionText = (label: McqOptionLabel) => {
            return sanitizeMcqOptionText(
              optionByLabel.get(label)?.text || optionFallbackByLabel.get(label)?.text || null
            );
          };

          const resolveOptionImageRef = (label: McqOptionLabel) => {
            return (
              cleaned.optionImageRefs[label] ||
              optionByLabel.get(label)?.imageRef ||
              optionFallbackByLabel.get(label)?.imageRef ||
              null
            );
          };

          const mcqOptionAImage = asImageDataUrlOrNull(await resolveImageData(resolveOptionImageRef('A')));
          const mcqOptionBImage = asImageDataUrlOrNull(await resolveImageData(resolveOptionImageRef('B')));
          const mcqOptionCImage = asImageDataUrlOrNull(await resolveImageData(resolveOptionImageRef('C')));
          const mcqOptionDImage = asImageDataUrlOrNull(await resolveImageData(resolveOptionImageRef('D')));

          const hasMcqSignals =
            cleaned.questionType === 'multiple_choice' ||
            question.isLikelyMcq ||
            cleaned.mcqOptions.length > 0;

          const questionType: 'written' | 'multiple_choice' = hasMcqSignals ? 'multiple_choice' : 'written';
          const marks = questionType === 'multiple_choice' ? 1 : Math.max(1, inferredMarks || 0);

          const basePayload: Record<string, unknown> = {
            grade,
            year,
            subject,
            school_name: schoolName,
            topic: 'Unspecified',
            subtopic: null,
            syllabus_dot_point: null,
            marks,
            question_number: question.questionNumber,
            question_text: cleanedQuestionText,
            question_type: questionType,
            marking_criteria: null,
            sample_answer: questionType === 'written' ? (cleanedSampleSolution || null) : null,
            sample_answer_image: null,
            mcq_option_a: questionType === 'multiple_choice' ? resolveOptionText('A') : null,
            mcq_option_b: questionType === 'multiple_choice' ? resolveOptionText('B') : null,
            mcq_option_c: questionType === 'multiple_choice' ? resolveOptionText('C') : null,
            mcq_option_d: questionType === 'multiple_choice' ? resolveOptionText('D') : null,
            mcq_option_a_image: questionType === 'multiple_choice' ? mcqOptionAImage : null,
            mcq_option_b_image: questionType === 'multiple_choice' ? mcqOptionBImage : null,
            mcq_option_c_image: questionType === 'multiple_choice' ? mcqOptionCImage : null,
            mcq_option_d_image: questionType === 'multiple_choice' ? mcqOptionDImage : null,
            mcq_correct_answer: questionType === 'multiple_choice' ? cleaned.mcqCorrectAnswer : null,
            mcq_explanation: questionType === 'multiple_choice' ? (cleanedSampleSolution || null) : null,
            graph_image_data: questionImageDataUrls[0] || null,
            graph_image_data_list: questionImageDataUrls.length ? questionImageDataUrls : null,
            graph_image_size: questionImageDataUrls.length ? 'medium' : 'missing',
            difficulty: null,
          };

          // Debug-only route: do not persist to the database.
          outputs.push({
            batchIndex: batch.index,
            questionIndex: question.index,
            questionLabel: question.label,
            questionNumber: question.questionNumber,
            questionType,
            marks,
            questionText: cleanedQuestionText,
            sampleSolution: cleanedSampleSolution,
            mcqOptions:
              questionType === 'multiple_choice'
                ? {
                    A: resolveOptionText('A'),
                    B: resolveOptionText('B'),
                    C: resolveOptionText('C'),
                    D: resolveOptionText('D'),
                  }
                : null,
            mcqCorrectAnswer: questionType === 'multiple_choice' ? cleaned.mcqCorrectAnswer : null,
            questionImageCount: questionImageDataUrls.length,
            payloadPreview: {
              question_text: basePayload.question_text,
              sample_answer: basePayload.sample_answer,
            },
          });
        }
      } catch (error: any) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push({
          questionIndex: batch.index,
          questionLabel: batch.label,
          reason,
        });
      }
    }

    return NextResponse.json({
      success: true,
      model: MODEL_NAME,
      groupingMode,
      debugOnly: true,
      persistence: 'disabled',
      source: {
        type: 'mathpix',
        pdfId: mathpix.pdfId,
        status: mathpix.status,
        percentDone: mathpix.percentDone,
        conversionFormats: mathpix.usedConversionFormats,
        texZipExtracted: Boolean(mathpix.texZipPath),
        texFilePath: mathpix.texFilePath,
        imagesDir: mathpix.imagesDir,
        imageCount: mathpix.imageFiles.length,
        rawMarkdownContent: mathpix.mmdText,
        formattedMarkdownContent,
        rawTexContent: mathpix.texContent,
      },
      totalDetected: parsedBatches.length,
      processingQueue: parsedBatches.slice(0, 100).map((batch) => ({
        index: batch.index,
        label: batch.label,
        questionNumber: batch.questionNumber,
        groupedCount: batch.questions.length,
        groupedQuestions: batch.questions.map((question) => ({
          index: question.index,
          label: question.label,
          questionNumber: question.questionNumber,
        })),
      })),
      solved: outputs.length,
      failed: failures.length,
      failures,
      rawMarkdownFile: mathpix.mmdText,
      gptOutput: outputs,
      debug: {
        groupedPromptPayloads: groupedPromptDebug,
      },
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    const classified = classifyIngestError(details);

    return NextResponse.json(
      {
        error: 'pdf-ingest-v2 failed',
        details,
        code: classified.code,
        hint: classified.hint,
        stage,
      },
      { status: classified.status }
    );
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
