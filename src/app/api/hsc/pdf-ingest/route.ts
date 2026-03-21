import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import OpenAI from 'openai';
import { promises as fs, constants } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);
const PDFTOCAIRO_PATH = process.env.PDFTOCAIRO_PATH ?? '/usr/bin/pdftocairo';

const MIN_PAPER_YEAR = 2017;
const MAX_PAPER_YEAR = new Date().getFullYear();

const TOPIC_LISTS = {
  'Year 12': {
    standard: [
      'Algebraic relationships',
      'Investment and loans',
      'Annuities',
      'Trigonometry',
      'Ratios and rates',
      'Network flow',
      'Critical path analysis',
      'Bivariate data analysis',
      'Relative frequency and probability',
      'The normal distribution',
    ],
    advanced: [
      'Further graph transformations',
      'Sequences and series',
      'Differential calculus',
      'Integral calculus',
      'Applications of calculus',
      'Random variables',
      'Financial mathematics',
    ],
    'extension 1': [
      'Proof by mathematical induction',
      'Vectors',
      'Inverse trigonometric functions',
      'Further calculus skills',
      'Further applications of calculus',
      'The binomial distribution and sampling distribution of the mean',
    ],
    'extension 2': [
      'The nature of proof',
      'Further work with vectors',
      'Introduction to complex numbers',
      'Further integration',
      'Applications of calculus to mechanics',
    ],
  },
  'Year 11': {
    standard: [
      'Algebraic relationships',
      'Investment and loans',
      'Annuities',
      'Trigonometry',
      'Ratios and rates',
      'Network flow',
      'Critical path analysis',
      'Bivariate data analysis',
      'Relative frequency and probability',
      'The normal distribution',
    ],
    advanced: [
      'Working with functions',
      'Trigonometry and measure of angles',
      'Trigonometric identities and equations',
      'Differentiation',
      'Exponential and logarithmic functions',
      'Graph transformations',
      'Probability and data',
    ],
    'extension 1': [
      'Further work with functions',
      'Polynomials',
      'Further trigonometry',
      'Permutations and combinations',
      'The binomial theorem',
    ],
  },
  'Year 10': {
    mathematics: [
      'Financial mathematics',
      'Algebraic techniques',
      'Indices',
      'Equations',
      'Linear relationships',
      'Non-linear relationships',
      'Numbers of any magnitude',
      'Trigonometry',
      'Area and surface area',
      'Volume',
      'Properties of geometrical figures',
      'Data analysis',
      'Probability',
      'Variation and rates of change',
      'Polynomials',
      'Logarithms',
      'Functions and other graphs',
      'Circle geometry',
      'Introduction to networks',
    ],
  },
  'Year 9': {
    mathematics: [
      'Financial mathematics',
      'Algebraic techniques',
      'Indices',
      'Equations',
      'Linear relationships',
      'Non-linear relationships',
      'Numbers of any magnitude',
      'Trigonometry',
      'Area and surface area',
      'Volume',
      'Properties of geometrical figures',
      'Data analysis',
      'Probability',
      'Variation and rates of change',
      'Polynomials',
      'Logarithms',
      'Functions and other graphs',
      'Circle geometry',
      'Introduction to networks',
    ],
  },
  'Year 8': {
    mathematics: [
      'Computation with integers',
      'Fractions, decimals and percentages',
      'Ratios and rates',
      'Algebraic techniques',
      'Indices',
      'Equations',
      'Linear relationships',
      'Length',
      'Right-angled triangles (Pythagoras\' theorem)',
      'Area',
      'Volume',
      'Angle relationships',
      'Properties of geometrical figures',
      'Data classification and visualisation',
      'Data analysis',
      'Probability',
    ],
  },
  'Year 7': {
    mathematics: [
      'Computation with integers',
      'Fractions, decimals and percentages',
      'Ratios and rates',
      'Algebraic techniques',
      'Indices',
      'Equations',
      'Linear relationships',
      'Length',
      'Right-angled triangles (Pythagoras\' theorem)',
      'Area',
      'Volume',
      'Angle relationships',
      'Properties of geometrical figures',
      'Data classification and visualisation',
      'Data analysis',
      'Probability',
    ],
  },
} as const;

const normalizeYearKey = (grade: string) => {
  const value = String(grade || '').toLowerCase();
  if (value.includes('12')) return 'Year 12';
  if (value.includes('11')) return 'Year 11';
  if (value.includes('10')) return 'Year 10';
  if (value.includes('9')) return 'Year 9';
  if (value.includes('8')) return 'Year 8';
  if (value.includes('7')) return 'Year 7';
  return 'Year 12';
};

const normalizeSubjectKey = (subject: string) => {
  const value = String(subject || '').toLowerCase();
  if (value.includes('standard')) return 'standard';
  if (value.includes('extension 2') || value.includes('ext 2')) return 'extension 2';
  if (value.includes('extension 1') || value.includes('ext 1')) return 'extension 1';
  if (value.includes('advanced')) return 'advanced';
  if (value.includes('mathematics') || value.includes('maths')) return 'mathematics';
  return 'extension 1';
};

const getTopicOptions = (grade: string, subject: string) => {
  const yearKey = normalizeYearKey(grade);
  const subjectKey = normalizeSubjectKey(subject);
  if (yearKey === 'Year 11' && subjectKey === 'extension 2') {
    return null;
  }
  const yearTopics = TOPIC_LISTS[yearKey] as Record<string, ReadonlyArray<string>>;
  const selectedTopics =
    yearTopics[subjectKey] || yearTopics.mathematics || TOPIC_LISTS['Year 12']['extension 1'];

  if (yearKey !== 'Year 12') {
    return selectedTopics;
  }

  const year11Topics = TOPIC_LISTS['Year 11'] as Record<string, ReadonlyArray<string>>;
  const matchingYear11Topics = year11Topics[subjectKey] || year11Topics.mathematics;

  if (!matchingYear11Topics) {
    return selectedTopics;
  }

  return Array.from(new Set([...selectedTopics, ...matchingYear11Topics]));
};

const buildPdfPrompt = (
  _topics: ReadonlyArray<string>,
  includeMarkingCriteria: boolean,
  includeTopicIdentify: boolean
) => buildExamImagePrompt(includeMarkingCriteria, includeTopicIdentify);

const buildExamImagePrompt = (
  includeMarkingCriteria: boolean,
  includeTopicIdentify: boolean
) => `You will receive HSC Mathematics exam JPEGs one at a time in multiple requests If you don't see any questions in the JPG file, just ignore it and output NO TEXT. NOTHING.
Your task is to extract every exam question (including multiple-choice and written-response questions) from the image and convert it into clean, well-structured LaTeX code with a fully worked sample solution for each question.
${includeMarkingCriteria ? "Generate a concise marking criteria for each written-response question based on the mark count." : ''}

CRITICAL — Question splitting (follow exactly):
- Split at BOTH lettered parts and Roman numeral subparts. Each of these gets its own QUESTION_NUMBER block.
- Lettered parts: (a), (b), (c), (d), etc. — e.g. 11 (a), 11 (b) are separate questions.
- Roman numeral subparts: (i), (ii), (iii), (iv), (v), (vi), (vii), (viii), (ix), (x) — e.g. 11 (a) (i) and 11 (a) (ii) are two separate questions. Use QUESTION_NUMBER like "11 (a)(i)" and "11 (a)(ii)".
- So "Question 11 (a)" with parts (i) and (ii) becomes two blocks: QUESTION_NUMBER 11 (a)(i) and QUESTION_NUMBER 11 (a)(ii), each with its own QUESTION_CONTENT and SAMPLE_ANSWER.

Shared stem rule for multi-part questions (critical):
- If a question has a common stem/context before (a)/(b)/(c), include that shared stem only once for the first extracted subpart in that chain (usually 11 (a) or 11 (a)(i)).
- For later subparts in the same chain (e.g. 11 (b), 11 (c), 11 (a)(ii), 11 (a)(iii)), include only the text specific to that subpart.
- Do NOT copy-paste shared stem/context into later subparts.

If it seems like a question doesn't have enough context for you to solve it. It may be the case that the question has gone over the page. Just put NOT_ENOUGH_CONTEXT as the solution. 

For each NON-multiple-choice (written-response) question, you must follow this exact structure:

QUESTION_NUMBER X
NUM_MARKS X
TOPIC X
HAS_IMAGE <TRUE/FALSE>

QUESTION_CONTENT
<question written in LaTeX code...>

SAMPLE_ANSWER
<fully worked solution written in LaTeX code...>
${includeMarkingCriteria ? "\nMARKING_CRITERIA\n{Use one line per mark: MARKS_1 ... MARKS_2 ... based on the total marks. Keep it concise and aligned to the question.}\n" : ''}

For each MULTIPLE-CHOICE question you must follow this structure instead:

QUESTION_NUMBER X
NUM_MARKS X
TOPIC X
HAS_IMAGE {TRUE/FALSE}
QUESTION_TYPE MULTIPLE_CHOICE

QUESTION_CONTENT
<question stem written in LaTeX code...>

MCQ_OPTION_A <text for option A in LaTeX, dont use display math mode \[ \]>
MCQ_OPTION_B <text for option B in LaTeX, dont use display math mode \[ \]>
MCQ_OPTION_C <text for option C in LaTeX, dont use display math mode \[ \]>
MCQ_OPTION_D <text for option D in LaTeX, dont use display math mode \[ \]>

MCQ_EXPLANATION <detailed LaTeX explanation: why the correct option is right, why the others are wrong; format in clear steps with blank lines between ideas so a student can follow easily>

MCQ_CORRECT_ANSWER {A|B|C|D}
  

READABILITY RULES:
Add newlines where appropriate. Include one blank line between the header section and QUESTION_CONTENT and one blank line between each completed question block.

SAMPLE ANSWER REQUIREMENTS (format so a student can follow easily):
- Show every step of the working; do not skip steps. A student should be able to follow the logic from start to finish.
- Put each major step on its own line or in a small block. Use blank lines between distinct steps so the solution is not a wall of text.
- For algebraic manipulation: show one transformation per line (e.g. one line per "add 2 to both sides") where it helps clarity.
- Label the answer clearly (e.g. "(i)" or "Part (i)" if the question number includes a roman part) with a blank line before it where helpful.
- After working, state the final answer clearly (e.g. "Therefore ..." or "Hence the answer is ...").
- Use short, clear sentences. Prefer "We have" / "So" / "Thus" to connect steps.
- Use display math ($$...$$ or \\[ ... \\]) for important equations on their own line; use inline math ($...$) for brief expressions in prose.
- The solution should look like a model answer a teacher would write on the board: neat, well-spaced, and easy to read.

${includeTopicIdentify ? '' : `Do NOT try to infer or assign a topic for each question. For the TOPIC field, always output exactly:
TOPIC Unspecified
Topics will be provided separately from a dedicated topic-mapping table at the end of the marking criteria PDF.`}

Output raw text only. Do not add commentary, explanations, or extra formatting. Return only the converted LaTeX content.`;


const CRITERIA_PROMPT = `I have provided one PDF which is a HSC mathematics marking criteria.

Extract all the marking criteria from the marking criteria tables into this format:

MARKING_QUESTION_NUMBER X
MARKS_X {criteria text}
MARKS_Y {criteria text}

Rules:
- A question may contain multiple parts. Each main subpart should be treated and counted as an individual question. For example, 11(a) and 11(b) should each be counted separately.
- If the marking criteria shows roman subparts like (i), (ii), include them in MARKING_QUESTION_NUMBER (e.g., 13(a)(i)).
- Only extract the marking criteria from the marking criteria tables.
- Ignore all sample answers.
- Skip all multiple choice questions.
- Use the question number exactly as shown in the marking criteria.
- Use one criterion per line.
- Each criterion line must start with MARKS_X followed by the criteria text.
- Do not add any extra text outside the format.
- Escape currency and percent as \\$ and \\%.

At the very end of the PDF there is also a table that maps each question to its topic. After you finish all MARKING_QUESTION_NUMBER blocks, append one additional topic-mapping block in this format:

QUESTION_TOPIC X {topic text}

Rules for topic mapping:
- Use QUESTION_TOPIC for every question that appears in the topic table at the end of the PDF.
- The X label must match the question number format used in MARKING_QUESTION_NUMBER, including any lettered and roman subparts (e.g. 13(a), 13(a)(i)).
- The {topic text} must be the topic name from the table (e.g. Vectors, Proof by mathematical induction).
- One QUESTION_TOPIC line per question.
- Do not add any other lines or commentary in the topic-mapping section.`;

const getHeaderValue = (line: string) => {
  const parts = line.split(/\s+/).slice(1);
  return parts.join(' ').trim();
};

const stripOuterBraces = (s: string): string => {
  const t = s.trim();
  if (t.startsWith('{') && t.endsWith('}') && t.length >= 2) return t.slice(1, -1).trim();
  return s;
};

type ParsedQuestion = {
  questionNumber: string | null;
  marks: number | null;
  topic: string | null;
  hasImage: boolean;
  questionText: string;
  sampleAnswer: string;
  markingCriteria: string;
  questionType: 'written' | 'multiple_choice' | null;
  mcqOptionA: string | null;
  mcqOptionB: string | null;
  mcqOptionC: string | null;
  mcqOptionD: string | null;
  mcqCorrectAnswer: 'A' | 'B' | 'C' | 'D' | null;
  mcqExplanation: string | null;
};

const MCQ_HEADER_PREFIXES = [
  'QUESTION_NUMBER', 'NUM_MARKS', 'TOPIC', 'HAS_IMAGE', 'QUESTION_TYPE',
  'MCQ_OPTION_A', 'MCQ_OPTION_B', 'MCQ_OPTION_C', 'MCQ_OPTION_D',
  'MCQ_CORRECT_ANSWER', 'MCQ_EXPLANATION', 'QUESTION_CONTENT', 'SAMPLE_ANSWER', 'MARKING_CRITERIA',
];

const extractMcqCorrectAnswer = (line: string): 'A' | 'B' | 'C' | 'D' | null => {
  const match = line.match(/MCQ_CORRECT_ANSWER\s*[:\-]?\s*\{?\s*([A-D])\s*\}?/i);
  if (!match?.[1]) return null;
  const value = match[1].toUpperCase();
  return value === 'A' || value === 'B' || value === 'C' || value === 'D'
    ? (value as 'A' | 'B' | 'C' | 'D')
    : null;
};

const parseQuestions = (content: string) => {
  const lines = content.split(/\r?\n/);

  const questions: ParsedQuestion[] = [];
  let current: ParsedQuestion | null = null;
  let mode: 'question' | 'answer' | 'mcq_explanation' | 'criteria' | null = null;
  let activeMcqOption: 'A' | 'B' | 'C' | 'D' | null = null;

  const setMcqOptionValue = (option: 'A' | 'B' | 'C' | 'D', value: string | null) => {
    if (!current) return;
    if (option === 'A') current.mcqOptionA = value;
    else if (option === 'B') current.mcqOptionB = value;
    else if (option === 'C') current.mcqOptionC = value;
    else if (option === 'D') current.mcqOptionD = value;
  };

  const getMcqOptionValue = (option: 'A' | 'B' | 'C' | 'D') => {
    if (!current) return null;
    if (option === 'A') return current.mcqOptionA;
    if (option === 'B') return current.mcqOptionB;
    if (option === 'C') return current.mcqOptionC;
    return current.mcqOptionD;
  };

  const pushCurrent = () => {
    activeMcqOption = null;
    if (!current) return;
    const trimmedQuestion = current.questionText.trim();
    const trimmedAnswer = current.sampleAnswer.trim();
    const trimmedCriteria = current.markingCriteria.trim();
    if (!trimmedQuestion) return;
    const hasAllMcqOptions =
      current.mcqOptionA != null &&
      current.mcqOptionB != null &&
      current.mcqOptionC != null &&
      current.mcqOptionD != null &&
      current.mcqCorrectAnswer != null;
    const inferredType: ParsedQuestion['questionType'] =
      current.questionType === 'multiple_choice' || hasAllMcqOptions ? 'multiple_choice' : current.questionType;
    questions.push({
      ...current,
      questionType: inferredType,
      questionText: trimmedQuestion,
      sampleAnswer: trimmedAnswer,
      markingCriteria: trimmedCriteria,
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (activeMcqOption && current) {
      const isHeaderLine = line && MCQ_HEADER_PREFIXES.some((prefix) => line.startsWith(prefix));
      if (!isHeaderLine) {
        const existing = getMcqOptionValue(activeMcqOption);
        const chunk = line ? stripOuterBraces(rawLine.trim()) : '';
        const next = existing ? `${existing}\n${chunk}` : chunk;
        setMcqOptionValue(activeMcqOption, next);
        continue;
      }
      activeMcqOption = null;
    }

    if (!line) continue;

    if (line.startsWith('QUESTION_NUMBER')) {
      pushCurrent();
      current = {
        questionNumber: getHeaderValue(line) || null,
        marks: null,
        topic: null,
        hasImage: false,
        questionText: '',
        sampleAnswer: '',
        markingCriteria: '',
        questionType: null,
        mcqOptionA: null,
        mcqOptionB: null,
        mcqOptionC: null,
        mcqOptionD: null,
        mcqCorrectAnswer: null,
        mcqExplanation: null,
      };
      mode = null;
      continue;
    }

    if (!current) continue;

    if (line.startsWith('NUM_MARKS')) {
      const value = parseInt(getHeaderValue(line), 10);
      current.marks = Number.isNaN(value) ? null : value;
      continue;
    }

    if (line.startsWith('TOPIC')) {
      const value = getHeaderValue(line);
      current.topic = value || null;
      continue;
    }

    if (line.startsWith('HAS_IMAGE')) {
      const value = getHeaderValue(line).toUpperCase();
      current.hasImage = value === 'TRUE';
      continue;
    }

    if (line.toUpperCase().startsWith('QUESTION_TYPE')) {
      const value = getHeaderValue(line).toLowerCase();
      current.questionType = value.includes('multiple') ? 'multiple_choice' : 'written';
      continue;
    }

    if (line.startsWith('MCQ_OPTION_A')) {
      mode = null;
      const v = stripOuterBraces(getHeaderValue(line).trim());
      current.mcqOptionA = v || null;
      activeMcqOption = 'A';
      continue;
    }
    if (line.startsWith('MCQ_OPTION_B')) {
      mode = null;
      const v = stripOuterBraces(getHeaderValue(line).trim());
      current.mcqOptionB = v || null;
      activeMcqOption = 'B';
      continue;
    }
    if (line.startsWith('MCQ_OPTION_C')) {
      mode = null;
      const v = stripOuterBraces(getHeaderValue(line).trim());
      current.mcqOptionC = v || null;
      activeMcqOption = 'C';
      continue;
    }
    if (line.startsWith('MCQ_OPTION_D')) {
      mode = null;
      const v = stripOuterBraces(getHeaderValue(line).trim());
      current.mcqOptionD = v || null;
      activeMcqOption = 'D';
      continue;
    }
    if (line.startsWith('MCQ_CORRECT_ANSWER')) {
      mode = null;
      const extracted = extractMcqCorrectAnswer(line);
      if (extracted) {
        current.mcqCorrectAnswer = extracted;
      } else {
        const value = stripOuterBraces(getHeaderValue(line).trim()).toUpperCase();
        current.mcqCorrectAnswer =
          value === 'A' || value === 'B' || value === 'C' || value === 'D' ? (value as 'A' | 'B' | 'C' | 'D') : null;
      }
      continue;
    }
    if (line.startsWith('MCQ_EXPLANATION')) {
      const sameLine = stripOuterBraces(getHeaderValue(line).trim());
      current.mcqExplanation = sameLine || '';
      mode = 'mcq_explanation';
      continue;
    }

    if (line.startsWith('QUESTION_CONTENT')) {
      mode = 'question';
      continue;
    }

    if (line.startsWith('SAMPLE_ANSWER')) {
      mode = 'answer';
      continue;
    }

    if (line.startsWith('MARKING_CRITERIA')) {
      const sameLine = stripOuterBraces(getHeaderValue(line).trim());
      current.markingCriteria = sameLine || '';
      mode = 'criteria';
      continue;
    }

    if (mode === 'question') {
      current.questionText += `${current.questionText ? '\n' : ''}${rawLine}`;
    } else if (mode === 'answer') {
      current.sampleAnswer += `${current.sampleAnswer ? '\n' : ''}${rawLine}`;
    } else if (mode === 'mcq_explanation') {
      const embeddedAnswer = extractMcqCorrectAnswer(line);
      if (embeddedAnswer) {
        current.mcqCorrectAnswer = embeddedAnswer;
        mode = null;
        continue;
      }
      current.mcqExplanation = (current.mcqExplanation || '') + (current.mcqExplanation ? '\n' : '') + rawLine;
    } else if (mode === 'criteria') {
      current.markingCriteria += `${current.markingCriteria ? '\n' : ''}${rawLine}`;
    }
  }

  pushCurrent();

  return { questions };
};

const ROMAN_SUBPART_REGEX = '(?:ix|iv|v?i{0,3}|x)';

const normalizeQuestionNumbersWithCarry = (
  questions: ParsedQuestion[],
  startingBaseNumber: string | null
) => {
  let latestBaseNumber = startingBaseNumber;

  const normalizedQuestions = questions.map((question) => {
    const rawNumber = String(question.questionNumber || '').trim();
    if (!rawNumber) {
      return question;
    }

    const withBaseMatch = rawNumber.match(
      new RegExp(`(\\d+)\\s*(?:\\(?([a-z])\\)?)?\\s*(?:\\(?(${ROMAN_SUBPART_REGEX})\\)?)?`, 'i')
    );
    if (withBaseMatch?.[1]) {
      latestBaseNumber = withBaseMatch[1];
      return question;
    }

    const letterOnlyMatch = rawNumber.match(/^\(?([a-z])\)?$/i);
    if (letterOnlyMatch && latestBaseNumber) {
      const part = letterOnlyMatch[1].toLowerCase();
      return {
        ...question,
        questionNumber: `${latestBaseNumber} (${part})`,
      };
    }

    const letterAndRomanOnlyMatch = rawNumber.match(
      new RegExp(`^\\(?([a-z])\\)?\\s*\\(?(${ROMAN_SUBPART_REGEX})\\)?$`, 'i')
    );
    if (letterAndRomanOnlyMatch && latestBaseNumber) {
      const part = letterAndRomanOnlyMatch[1].toLowerCase();
      const subpart = letterAndRomanOnlyMatch[2].toLowerCase();
      return {
        ...question,
        questionNumber: `${latestBaseNumber} (${part})(${subpart})`,
      };
    }

    return question;
  });

  return { questions: normalizedQuestions, latestBaseNumber };
};

type ParsedCriteria = {
  key: string;
  rawLabel: string;
  criteriaLines: string[];
};

const normalizeQuestionKey = (raw: string) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { base: '', part: null as string | null, subpart: null as string | null, key: '' };

  const match = trimmed.match(/(\d+)\s*(?:\(?([a-z])\)?)?\s*(?:\(?((?:ix|iv|v?i{0,3}|x))\)?)?/i);
  const base = match?.[1] || trimmed;
  const part = match?.[2] ? match[2].toLowerCase() : null;
  const subpart = match?.[3] ? match[3].toLowerCase() : null;

  const key = base + (part ? `(${part})` : '');
  return { base, part, subpart, key };
};

const romanToNumber = (roman: string | null) => {
  if (!roman) return null;
  const normalized = roman.toLowerCase();
  const values: Record<string, number> = {
    i: 1,
    v: 5,
    x: 10,
  };
  let total = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const current = values[normalized[i]] || 0;
    const next = values[normalized[i + 1]] || 0;
    if (current < next) {
      total -= current;
    } else {
      total += current;
    }
  }
  return total || null;
};

const letterToNumber = (letter: string | null) => {
  if (!letter) return null;
  const c = letter.toLowerCase().charCodeAt(0);
  if (c < 97 || c > 122) return null;
  return c - 96;
};

const compareQuestionNumbers = (leftRaw: string | null, rightRaw: string | null) => {
  const left = normalizeQuestionKey(String(leftRaw || ''));
  const right = normalizeQuestionKey(String(rightRaw || ''));

  const leftBase = Number.parseInt(left.base || '', 10);
  const rightBase = Number.parseInt(right.base || '', 10);
  if (!Number.isNaN(leftBase) && !Number.isNaN(rightBase) && leftBase !== rightBase) {
    return leftBase - rightBase;
  }

  const leftPart = letterToNumber(left.part);
  const rightPart = letterToNumber(right.part);
  if (leftPart != null && rightPart != null && leftPart !== rightPart) {
    return leftPart - rightPart;
  }
  if (leftPart == null && rightPart != null) return -1;
  if (leftPart != null && rightPart == null) return 1;

  const leftSubpart = romanToNumber(left.subpart);
  const rightSubpart = romanToNumber(right.subpart);
  if (leftSubpart != null && rightSubpart != null && leftSubpart !== rightSubpart) {
    return leftSubpart - rightSubpart;
  }
  if (leftSubpart == null && rightSubpart != null) return -1;
  if (leftSubpart != null && rightSubpart == null) return 1;

  return String(leftRaw || '').localeCompare(String(rightRaw || ''));
};

const isNotEnoughContextAnswer = (value: unknown) => {
  const text = String(value || '').trim().toUpperCase();
  return text === 'NOT_ENOUGH_CONTEXT';
};

const parseRecoveredAnswer = (content: string) => {
  const lines = String(content || '').split(/\r?\n/);
  let mode: 'answer' | 'criteria' | null = null;
  const answerLines: string[] = [];
  const criteriaLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'SAMPLE_ANSWER') {
      mode = 'answer';
      continue;
    }
    if (line === 'MARKING_CRITERIA') {
      mode = 'criteria';
      continue;
    }
    if (!mode) continue;
    if (mode === 'answer') answerLines.push(rawLine);
    if (mode === 'criteria') criteriaLines.push(rawLine);
  }

  return {
    sampleAnswer: answerLines.join('\n').trim(),
    markingCriteria: criteriaLines.join('\n').trim(),
  };
};

const buildRecoveryPrompt = (args: {
  targetQuestionNumber: string;
  targetQuestionText: string;
  targetMarks: number;
  contextBlocks: string[];
}) => {
  return `You are helping recover an exam sample solution that was previously marked as NOT_ENOUGH_CONTEXT.

Use the related earlier subparts as context and write a high-quality replacement solution.

TARGET QUESTION
QUESTION_NUMBER ${args.targetQuestionNumber}
NUM_MARKS ${args.targetMarks}

QUESTION_CONTENT
${args.targetQuestionText}

RELATED CONTEXT (earlier subparts in same main question)
${args.contextBlocks.join('\n\n')}

Requirements:
- Use the related context only when relevant to infer definitions, intermediate values, or setup from earlier subparts.
- If a needed value is still missing, make the minimum explicit assumption and proceed.
- Produce a clear, fully worked sample solution in LaTeX.
- Also produce concise marking criteria aligned with the mark count.
- Do not include any extra commentary outside the required output format.

Output exactly in this format:
SAMPLE_ANSWER
<fully worked LaTeX solution>

MARKING_CRITERIA
MARKS_1 <criterion>
MARKS_2 <criterion>
...`;
};

const buildAutoGroupMapByQuestionId = (
  questions: Array<{ id: string; question_number: string | null }>,
  context: { schoolName: string; year: number; paperNumber: number; grade: string; subject: string }
) => {
  const groupedByBase = new Map<string, string[]>();

  questions.forEach((question) => {
    const { base, part } = normalizeQuestionKey(String(question.question_number || ''));
    if (!base || !part) return;
    const existing = groupedByBase.get(base) || [];
    existing.push(question.id);
    groupedByBase.set(base, existing);
  });

  const map: Record<string, string> = {};
  groupedByBase.forEach((ids, base) => {
    if (ids.length < 2) return;
    const label = [
      'paper-group',
      context.year,
      context.grade,
      context.subject,
      context.schoolName,
      `paper-${context.paperNumber}`,
      `q${base}`,
    ].join('::');
    ids.forEach((id) => {
      map[id] = label;
    });
  });

  return map;
};

const parseCriteria = (content: string) => {
  const lines = content.split(/\r?\n/);
  const criteria: ParsedCriteria[] = [];
  const topicMap: Record<string, string> = {};
  let currentNumber: string | null = null;
  let buffer: string[] = [];

  const pushCurrent = () => {
    if (!currentNumber) return;
    const normalized = normalizeQuestionKey(currentNumber);
    const subpartPrefix = normalized.subpart ? `(${normalized.subpart}) ` : '';
    const lines = buffer
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^MARKS_([^\s]+)\s*(.*)$/i);
        if (!match) return null;
        const markValue = match[1];
        const criteriaText = match[2].trim();
        const formatted = `${subpartPrefix}MARKS_${markValue} ${criteriaText}`.trim();
        return formatted;
      })
      .filter((line): line is string => Boolean(line));

    if (!lines.length) return;
    criteria.push({ key: normalized.key || currentNumber.trim(), rawLabel: currentNumber.trim(), criteriaLines: lines });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Topic mapping lines: QUESTION_TOPIC X {topic text}
    if (line.startsWith('QUESTION_TOPIC')) {
      const match = line.match(/^QUESTION_TOPIC\s+(\S+)\s+(.+)$/);
      if (match) {
        const rawLabel = match[1];
        const topicText = match[2].trim();
        const normalized = normalizeQuestionKey(rawLabel);
        const key = normalized.key || rawLabel.trim();
        if (key && topicText) {
          topicMap[key] = topicText;
        }
      }
      continue;
    }

    if (line.startsWith('MARKING_QUESTION_NUMBER')) {
      pushCurrent();
      currentNumber = getHeaderValue(line) || null;
      buffer = [];
      continue;
    }

    if (!currentNumber) continue;
    buffer.push(rawLine);
  }

  pushCurrent();

  return { criteria, topicMap };
};

const isRefusal = (text: string) => {
  const lowered = text.toLowerCase();
  return (
    lowered.includes("i'm sorry") ||
    lowered.includes('i cannot assist') ||
    lowered.includes("i can't assist") ||
    lowered.includes('cannot help with that request')
  );
};

const chunkText = (text: string, maxChars: number) => {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    const nextBreak = text.lastIndexOf('\n', end);
    if (nextBreak > start + 200) {
      end = nextBreak;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }

  return chunks.filter((chunk) => chunk.length > 0);
};

const parsePageFromFilename = (filename: string) => {
  const match = filename.match(/(?:page-|page_)(\d+)\.jpe?g$/i);
  if (!match) {
    return 0;
  }
  return parseInt(match[1], 10) || 0;
};

type ConvertedExamImage = {
  name: string;
  mime: string;
  size: number;
  buffer: Buffer;
};

const convertPdfPagesToJpg = async (pdfBuffer: Buffer): Promise<ConvertedExamImage[]> => {
  const tmpRoot = path.join(process.cwd(), '.tmp-pdf-images');
  const id = randomUUID();
  const pdfPath = path.join(tmpRoot, `${id}.pdf`);
  const outDir = path.join(tmpRoot, `${id}-images`);
  const outputPrefix = path.join(outDir, 'page');

  await fs.mkdir(tmpRoot, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(pdfPath, pdfBuffer);

  try {
    await fs.access(PDFTOCAIRO_PATH, constants.X_OK);
  } catch {
    throw new Error(`pdftocairo is not executable at ${PDFTOCAIRO_PATH}`);
  }

  const maxPages = Number.parseInt(String(process.env.INGEST_PDF_MAX_PAGES || ''), 10);
  const args = ['-jpeg', '-r', '180'];
  if (Number.isInteger(maxPages) && maxPages > 0) {
    args.push('-f', '1', '-l', String(maxPages));
  }
  args.push(pdfPath, outputPrefix);

  try {
    await execFileAsync(PDFTOCAIRO_PATH, args);
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error
        ? String((error as { stderr?: unknown }).stderr ?? '')
        : '';
    throw new Error(stderr.trim() || 'Failed to convert exam PDF pages to JPG');
  }

  try {
    const files = await fs.readdir(outDir);
    const jpgFiles = files
      .filter((name) => name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg'))
      .sort((a, b) => parsePageFromFilename(a) - parsePageFromFilename(b));

    const converted: ConvertedExamImage[] = [];
    for (const filename of jpgFiles) {
      const fullPath = path.join(outDir, filename);
      const buffer = await fs.readFile(fullPath);
      converted.push({
        name: filename,
        mime: 'image/jpeg',
        size: buffer.length,
        buffer,
      });
    }
    return converted;
  } finally {
    await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
    await fs.unlink(pdfPath).catch(() => {});
  }
};

const getNextPaperNumber = async (schoolName: string, year: number) => {
  const { data, error } = await supabaseAdmin
    .from('hsc_questions')
    .select('paper_number')
    .match({ school_name: schoolName, year })
    .order('paper_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to determine next paper number: ${error.message}`);
  }

  const maxPaperNumber =
    Array.isArray(data) && data.length > 0
      ? Number(data[0]?.paper_number) || 0
      : 0;

  return maxPaperNumber + 1;
};

const getLatestPaperNumber = async (schoolName: string, year: number) => {
  const { data, error } = await supabaseAdmin
    .from('hsc_questions')
    .select('paper_number')
    .match({ school_name: schoolName, year })
    .order('paper_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to determine latest paper number: ${error.message}`);
  }

  const latestPaperNumber =
    Array.isArray(data) && data.length > 0
      ? Number(data[0]?.paper_number) || null
      : null;

  return latestPaperNumber;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const exam = formData.get('exam');
    const examImages = formData.getAll('examImages');
    const criteria = formData.get('criteria');
    const gradeInput = formData.get('grade');
    const yearInput = formData.get('year');
    const subjectInput = formData.get('subject');
    const overwriteInput = formData.get('overwrite');
    const generateCriteriaInput = formData.get('generateMarkingCriteria');
    const autoGroupSubpartsInput = formData.get('autoGroupSubparts');
    const schoolNameInput = formData.get('schoolName');
    const paperNumberInput = formData.get('paperNumber');

    const examFile = exam instanceof File ? exam : null;
    const examImageFiles = examImages.filter((item): item is File => item instanceof File);
    const criteriaFile = criteria instanceof File ? criteria : null;
    const examFileName = examFile?.name?.toLowerCase() || '';
    const examIsPdf = Boolean(examFile && (examFile.type === 'application/pdf' || examFileName.endsWith('.pdf')));
    const examIsLatex = Boolean(examFile && (examFileName.endsWith('.latex') || examFileName.endsWith('.tex')));
    const shouldAutoConvertExamPdf = Boolean(examFile && examIsPdf && !examImageFiles.length);

    if (!examFile && !examImageFiles.length && !criteriaFile) {
      return NextResponse.json({ error: 'Provide exam images or a criteria PDF' }, { status: 400 });
    }

    if (!gradeInput || !yearInput || !subjectInput) {
      return NextResponse.json({ error: 'Grade, year, and subject are required' }, { status: 400 });
    }

    const grade = String(gradeInput).trim();
    const year = parseInt(String(yearInput), 10);
    const subject = String(subjectInput).trim();
    const overwrite = String(overwriteInput || '').toLowerCase() === 'true';
    const generateMarkingCriteria = String(generateCriteriaInput || '').toLowerCase() === 'true';
    const autoGroupSubparts = String(autoGroupSubpartsInput || '').toLowerCase() === 'true';
    const schoolName = String(schoolNameInput || '').trim();
    const schoolNameForDb = schoolName || 'HSC';
    const parsedPaperNumber = Number.parseInt(String(paperNumberInput || ''), 10);
    const hasExplicitPaperNumber = Number.isInteger(parsedPaperNumber) && parsedPaperNumber > 0;
    const allowTopicIdentify = false;

    if (!grade || Number.isNaN(year) || !subject) {
      return NextResponse.json({ error: 'Invalid grade, year, or subject' }, { status: 400 });
    }

    if (year < MIN_PAPER_YEAR || year > MAX_PAPER_YEAR) {
      return NextResponse.json(
        { error: `Year must be between ${MIN_PAPER_YEAR} and ${MAX_PAPER_YEAR}` },
        { status: 400 }
      );
    }

    if (examFile) {
      const lowerName = examFile.name.toLowerCase();
      const isPdf = examFile.type === 'application/pdf' || lowerName.endsWith('.pdf');
      const isLatex = lowerName.endsWith('.latex') || lowerName.endsWith('.tex');
      if (!isPdf && !isLatex) {
        return NextResponse.json({ error: 'Exam file must be a PDF or .latex/.tex file' }, { status: 400 });
      }
    }

    if (examImageFiles.length) {
      const invalidImage = examImageFiles.find((file) => !file.type.startsWith('image/'));
      if (invalidImage) {
        return NextResponse.json({ error: 'All exam images must be image files' }, { status: 400 });
      }
    }

    if (criteriaFile && criteriaFile.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Criteria file must be a PDF' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY server configuration' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const hasExamInputs = Boolean(examFile || examImageFiles.length);
    const paperNumber = hasExplicitPaperNumber
      ? parsedPaperNumber
      : hasExamInputs
        ? await getNextPaperNumber(schoolNameForDb, year)
        : await getLatestPaperNumber(schoolNameForDb, year);

    if (!paperNumber) {
      return NextResponse.json(
        {
          error:
            'No existing paper found for this school/year. Upload exam content first or provide paperNumber explicitly.',
        },
        { status: 400 }
      );
    }
    const paperLabel = `${schoolNameForDb} ${year} Paper ${paperNumber}`;

    const contentParts: Array<{ source: 'exam' | 'criteria'; text: string }> = [];
    const useExamTextPipeline = String(process.env.USE_PDF_TEXT_PIPELINE || '').toLowerCase() === 'true';

    if (examFile && examIsLatex && !examImageFiles.length && !useExamTextPipeline) {
      return NextResponse.json(
        { error: 'For LaTeX exam uploads, enable USE_PDF_TEXT_PIPELINE or upload exam images.' },
        { status: 400 }
      );
    }

    const parsePdf = async (buffer: Buffer) => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.mjs',
        import.meta.url
      ).toString();

      const data = new Uint8Array(buffer);
      const loadingTask = (pdfjs.getDocument as any)({ data, disableWorker: true });
      const pdf = await loadingTask.promise;
      let text = '';

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (pageText) {
          text += `${pageText}\n`;
        }
      }

      return { text };
    };

    if (examFile && !examImageFiles.length && useExamTextPipeline && !shouldAutoConvertExamPdf) {
      const lowerName = examFile.name.toLowerCase();
      const isLatex = lowerName.endsWith('.latex') || lowerName.endsWith('.tex');
      const examBuffer = Buffer.from(await examFile.arrayBuffer());
      const examText = isLatex ? examBuffer.toString('utf8') : (await parsePdf(examBuffer)).text || '';
      contentParts.push({ source: 'exam', text: examText });
    }

    if (criteriaFile) {
      const criteriaBuffer = Buffer.from(await criteriaFile.arrayBuffer());
      const criteriaText = (await parsePdf(criteriaBuffer)).text || '';
      contentParts.push({ source: 'criteria', text: criteriaText });
    }

    if (!contentParts.length && !examImageFiles.length && !shouldAutoConvertExamPdf) {
      return NextResponse.json({ error: 'No extractable text found in uploads' }, { status: 400 });
    }

    const topicOptions: string[] = [];

    const createChatCompletion = async (args: {
      model: string;
      messages: any[];
      temperature?: number;
      maxTokens?: number;
      reasoningEffort?: 'low' | 'medium' | 'high';
    }) => {
      return await openai.chat.completions.create({
        model: args.model,
        // We intentionally keep messages as any[] here to support both
        // plain-text and multimodal (image_url) payloads without over-constraining
        // the type definition.
        messages: args.messages as any,
        reasoning_effort: args.reasoningEffort ?? 'high',
        // Omit temperature: this model only supports the default (1); sending 0 or 0.7 returns 400.
        max_completion_tokens: typeof args.maxTokens === 'number' ? args.maxTokens : 2000,
      });
    };

    const extractMessageContent = (content: unknown): string => {
      if (content == null) return '';
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        const textPart = content.find((p: any) => p?.type === 'text');
        return (textPart?.text != null ? String(textPart.text) : '') || '';
      }
      return String(content);
    };

    // Hard-pin ingest extraction to GPT-5.4 to avoid accidental model drift via env vars.
    const ingestModel = 'gpt-5.4';
    const examTextModel = ingestModel;
    const criteriaTextModel = ingestModel;
    const examVisionModel = ingestModel;

    const chunkResponses: Array<{ source: 'exam' | 'criteria'; index: number; content: string }> = [];
    const refusals: Array<{ source: 'exam' | 'criteria'; index: number; content: string }> = [];
    const rawInputs: Array<{ source: string; index: number; input: string }> = [];
    // Always chunk large documents so each call stays within Grok's comfortable
    // completion limits. This avoids one huge request that gets truncated.
    const chunkMaxChars = Number(process.env.GROK_PDF_CHUNK_MAX_CHARS || 20000);

    for (const part of contentParts) {
      const fullText = String(part.text || '').trim();
      const chunks = chunkText(fullText, chunkMaxChars);
      const totalChunks = chunks.length;

      for (let index = 0; index < totalChunks; index += 1) {
        const chunk = chunks[index];

        const promptBase =
          part.source === 'criteria'
            ? CRITERIA_PROMPT
            : buildPdfPrompt(topicOptions, generateMarkingCriteria, allowTopicIdentify);
        const prompt = `${promptBase}

You will receive the exam text in multiple chunks if the document is long. For EACH chunk:
- Convert every written-response question that is fully contained within THIS chunk.
- Do not repeat questions that were clearly already completed in previous chunks.
- If a question is cut off mid-way at the start or end of this chunk, skip that partial question.
- Do not stop early once you have converted a few questions; keep going until you have processed all complete questions in this chunk.

If the extracted text contains OCR noise, do your best to reconstruct the intended maths faithfully without inventing unseen questions.`;
        const model = part.source === 'criteria' ? criteriaTextModel : examTextModel;
        const userContent = `${prompt}\n\nSOURCE: ${part.source.toUpperCase()}\nCHUNK ${index + 1} of ${totalChunks}\n\n${chunk}`;
        rawInputs.push({ source: part.source, index: index + 1, input: userContent });
        const messages = [
          {
            role: 'system' as const,
            content:
              'You are given user-provided content (OCR / PDF text) and are allowed to transform it. Comply with the requested format.',
          },
          {
            role: 'user' as const,
            content: userContent,
          },
        ];

        const response = await createChatCompletion({
          model,
          messages,
          maxTokens: 10000,
        });

        let chunkContent = response.choices?.[0]?.message?.content || '';

        if (chunkContent.trim() && isRefusal(chunkContent)) {
          const retryResponse = await createChatCompletion({
            model,
            messages,
            maxTokens: 10000,
          });
          chunkContent = retryResponse.choices?.[0]?.message?.content || '';
        }

        if (chunkContent.trim() && !isRefusal(chunkContent)) {
          chunkResponses.push({ source: part.source, index: index + 1, content: chunkContent });
        } else if (chunkContent.trim()) {
          refusals.push({ source: part.source, index: index + 1, content: chunkContent });
        }
      }
    }

    const createdQuestions: any[] = [];
    let updatedCriteriaCount = 0;
    const missingCriteria: string[] = [];
    const imageResponseBodies: string[] = [];
    let latestQuestionBaseNumber: string | null = null;

    if (examFile || examImageFiles.length) {
      if (overwrite) {
        const { error: deleteError } = await supabaseAdmin
          .from('hsc_questions')
          .delete()
          .match({
            grade,
            year,
            subject,
            school_name: schoolNameForDb,
            paper_number: paperNumber,
          });

        if (deleteError) {
          console.error('Overwrite delete error:', deleteError);
          return NextResponse.json(
            { error: 'Failed to overwrite existing questions: ' + deleteError.message },
            { status: 500 }
          );
        }
      }

      // If examFile is provided (PDF / LaTeX), use the existing text-based pipeline when enabled.
      if (examFile && useExamTextPipeline) {
        const examContent = chunkResponses
          .filter((item) => item.source === 'exam')
          .sort((a, b) => a.index - b.index)
          .map((item) => item.content)
          .join('\n\n');

        const { questions } = parseQuestions(examContent);
        const normalized = normalizeQuestionNumbersWithCarry(questions, latestQuestionBaseNumber);
        latestQuestionBaseNumber = normalized.latestBaseNumber;

        if (!normalized.questions.length) {
          return NextResponse.json({ error: 'No questions parsed from ChatGPT response' }, { status: 500 });
        }

        const insertPayload = normalized.questions.map((question) => {
          const topic = 'Unspecified';
          const isMcq = question.questionType === 'multiple_choice';

          return {
            grade,
            year,
            subject,
            school_name: schoolNameForDb,
            paper_number: paperNumber,
            paper_label: paperLabel,
            topic,
            marks: question.marks || 0,
            question_number: question.questionNumber || null,
            question_text: question.questionText,
            question_type: isMcq ? 'multiple_choice' : 'written',
            marking_criteria: isMcq ? null : (question.markingCriteria || null),
            sample_answer: isMcq ? null : (question.sampleAnswer || null),
            mcq_option_a: isMcq ? (question.mcqOptionA ?? null) : null,
            mcq_option_b: isMcq ? (question.mcqOptionB ?? null) : null,
            mcq_option_c: isMcq ? (question.mcqOptionC ?? null) : null,
            mcq_option_d: isMcq ? (question.mcqOptionD ?? null) : null,
            mcq_option_a_image: null,
            mcq_option_b_image: null,
            mcq_option_c_image: null,
            mcq_option_d_image: null,
            mcq_correct_answer: isMcq ? (question.mcqCorrectAnswer ?? null) : null,
            mcq_explanation: isMcq ? (question.mcqExplanation ?? null) : null,
            graph_image_data: null,
            graph_image_size: 'medium',
          };
        });

        const { data, error } = await supabaseAdmin
          .from('hsc_questions')
          .insert(insertPayload)
          .select();

        if (error) {
          console.error('Database error:', error);
          return NextResponse.json({ error: 'Failed to create questions: ' + error.message }, { status: 500 });
        }

        if (Array.isArray(data)) {
          createdQuestions.push(...data);
        }
      }

      // Process exam images one-by-one (uploaded images and/or auto-converted PDF pages).
      type IngestImage = {
        name: string;
        mime: string;
        size: number;
        toBuffer: () => Promise<Buffer>;
      };

      const ingestImages: IngestImage[] = examImageFiles.map((imageFile, idx) => ({
        name: imageFile.name || `exam-image-${idx + 1}.jpg`,
        mime: imageFile.type || 'image/jpeg',
        size: imageFile.size,
        toBuffer: async () => Buffer.from(await imageFile.arrayBuffer()),
      }));

      if (shouldAutoConvertExamPdf && examFile) {
        const examPdfBuffer = Buffer.from(await examFile.arrayBuffer());
        const convertedPages = await convertPdfPagesToJpg(examPdfBuffer);
        if (!convertedPages.length) {
          return NextResponse.json(
            { error: 'Could not convert the uploaded exam PDF into JPG pages.' },
            { status: 400 }
          );
        }

        convertedPages.forEach((page) => {
          ingestImages.push({
            name: page.name,
            mime: page.mime,
            size: page.size,
            toBuffer: async () => page.buffer,
          });
        });
      }

      if (ingestImages.length) {
        // Calculate which images are in the last third
        const lastThirdStart = Math.ceil(ingestImages.length * (2 / 3));
        for (let index = 0; index < ingestImages.length; index += 1) {
          const ingestImage = ingestImages[index];
          const imageBuffer = await ingestImage.toBuffer();
          const imageBase64 = imageBuffer.toString('base64');
          const imageMime = ingestImage.mime || 'image/jpeg';
          const imageUrl = `data:${imageMime};base64,${imageBase64}`;
          // Use high reasoning for last third, medium for the rest
          const reasoningEffort = index >= lastThirdStart ? ('high' as const) : ('medium' as const);

          const imagePrompt = buildExamImagePrompt(generateMarkingCriteria, allowTopicIdentify);
          rawInputs.push({
            source: 'image',
            index: index + 1,
            input: `${imagePrompt}\n\n[image: ${ingestImage.name || 'image'} (${imageMime}, ${ingestImage.size} bytes)]`,
          });
          const messages = [
            {
              role: 'system',
              content:
                'You are given user-provided content (an exam image) and are allowed to transform it. Comply with the requested format.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: imagePrompt,
                },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl, detail: 'high' },
                },
              ],
            },
          ];

          const response = await createChatCompletion({
            model: examVisionModel,
            messages,
            maxTokens: 10000,
            reasoningEffort,
          });

          let chunkContent = extractMessageContent(response.choices?.[0]?.message?.content ?? '');

          // If the first pass looks like a refusal, try once more with the same prompt
          if (chunkContent.trim() && isRefusal(chunkContent)) {
            const retryResponse = await createChatCompletion({
              model: examVisionModel,
              messages,
              maxTokens: 10000,
              reasoningEffort,
            });
            chunkContent = extractMessageContent(retryResponse.choices?.[0]?.message?.content ?? '');
          }

          // If we still have no usable text, run a fallback OCR-style prompt that
          // aggressively extracts whatever text exists on the page (even if mostly diagrams),
          // then pipe THAT extracted text back through the exam conversion prompt so we
          // still get QUESTION_NUMBER / NUM_MARKS / SAMPLE_ANSWER blocks instead of a raw transcript.
          if (!chunkContent.trim() || isRefusal(chunkContent)) {
            const fallbackPrompt = 'Extract all readable text from this exam image. Do not summarise. Preserve mathematical expressions verbatim in LaTeX-friendly form.';
            rawInputs.push({
              source: 'image-ocr',
              index: index + 1,
              input: `${fallbackPrompt}\n\n[image: ${ingestImage.name || 'image'} (${imageMime}, ${ingestImage.size} bytes)]`,
            });
            const fallbackMessages = [
              {
                role: 'system' as const,
                content:
                  'You are performing OCR on a scanned exam page. Extract EVERY piece of readable text you can see (questions, numbers, algebra, labels), formatted as LaTeX-ready plain text. If the page truly has no readable text at all, reply with exactly NO_TEXT_FOUND.',
              },
              {
                role: 'user' as const,
                content: [
                  {
                    type: 'text',
                    text: fallbackPrompt,
                  },
                  {
                    type: 'image_url',
                    image_url: { url: imageUrl, detail: 'high' as const },
                  },
                ],
              },
            ];

            const fallbackResponse = await createChatCompletion({
              model: examVisionModel,
              messages: fallbackMessages,
              maxTokens: 10000,
              reasoningEffort,
            });
            const fallbackContent = extractMessageContent(fallbackResponse.choices?.[0]?.message?.content ?? '');

            // If OCR extracted some text, try once more to convert THAT text into the strict
            // QUESTION_NUMBER / NUM_MARKS / SAMPLE_ANSWER schema using the text model.
            if (fallbackContent.trim() && !isRefusal(fallbackContent) && fallbackContent.trim() !== 'NO_TEXT_FOUND') {
              const structuredPrompt = `${buildExamImagePrompt(generateMarkingCriteria, allowTopicIdentify)}\n\nOCR_EXTRACT:\n\n${fallbackContent}`;
              rawInputs.push({
                source: 'image-ocr-convert',
                index: index + 1,
                input: structuredPrompt,
              });
              const textModelMessages = [
                {
                  role: 'system' as const,
                  content:
                    'You are given OCR text from a HSC exam page and must convert it into the exact structured LaTeX schema requested, not a transcript.',
                },
                {
                  role: 'user' as const,
                  content: structuredPrompt,
                },
              ];

              const structuredResponse = await createChatCompletion({
                model: examTextModel,
                messages: textModelMessages,
                maxTokens: 10000,
                reasoningEffort,
              });
              const structured = extractMessageContent(structuredResponse.choices?.[0]?.message?.content ?? '');
              if (structured.trim() && !isRefusal(structured)) {
                chunkContent = structured;
              } else {
                chunkContent = fallbackContent; // last resort: at least keep OCR text
              }
            }
          }

          const imageLabel = `--- Image ${index + 1} of ${ingestImages.length} (${ingestImage.name}) ---`;
          if (chunkContent.trim() && !isRefusal(chunkContent)) {
            imageResponseBodies.push(`${imageLabel}\n\n${chunkContent}`);
          } else {
            imageResponseBodies.push(
              chunkContent.trim()
                ? `${imageLabel}\n\n(Content was skipped: refusal or invalid.)\n\n${chunkContent}`
                : `${imageLabel}\n\n(No text returned from the model for this image.)`
            );
          }

          if (!chunkContent.trim() || isRefusal(chunkContent)) {
            continue;
          }

          const { questions } = parseQuestions(chunkContent);
          const normalized = normalizeQuestionNumbersWithCarry(questions, latestQuestionBaseNumber);
          latestQuestionBaseNumber = normalized.latestBaseNumber;

          if (!normalized.questions.length) {
            continue;
          }

          const insertPayload = normalized.questions.map((question) => {
            const topic = 'Unspecified';
            const isMcq = question.questionType === 'multiple_choice';

            return {
              grade,
              year,
              subject,
              school_name: schoolNameForDb,
              paper_number: paperNumber,
              paper_label: paperLabel,
              topic,
              marks: question.marks || 0,
              question_number: question.questionNumber || null,
              question_text: question.questionText,
              question_type: isMcq ? 'multiple_choice' : 'written',
              marking_criteria: isMcq ? null : (question.markingCriteria || null),
              sample_answer: isMcq ? null : (question.sampleAnswer || null),
              mcq_option_a: isMcq ? (question.mcqOptionA ?? null) : null,
              mcq_option_b: isMcq ? (question.mcqOptionB ?? null) : null,
              mcq_option_c: isMcq ? (question.mcqOptionC ?? null) : null,
              mcq_option_d: isMcq ? (question.mcqOptionD ?? null) : null,
              mcq_option_a_image: null,
              mcq_option_b_image: null,
              mcq_option_c_image: null,
              mcq_option_d_image: null,
              mcq_correct_answer: isMcq ? (question.mcqCorrectAnswer ?? null) : null,
              mcq_explanation: isMcq ? (question.mcqExplanation ?? null) : null,
              graph_image_data: null,
              graph_image_size: question.hasImage ? 'medium' : 'medium',
            };
          });

          const { data, error } = await supabaseAdmin
            .from('hsc_questions')
            .insert(insertPayload)
            .select();

          if (error) {
            console.error('Database error (image ingest):', error);
            return NextResponse.json({ error: 'Failed to create questions from images: ' + error.message }, { status: 500 });
          }

          if (Array.isArray(data)) {
            createdQuestions.push(...data);
          }
        }
      }
    }

    if (criteriaFile) {
      if (overwrite) {
        const { error: clearError } = await supabaseAdmin
          .from('hsc_questions')
          .update({ marking_criteria: null })
          .match({
            grade,
            year,
            subject,
            school_name: schoolNameForDb,
            paper_number: paperNumber,
          });

        if (clearError) {
          console.error('Overwrite criteria clear error:', clearError);
          return NextResponse.json(
            { error: 'Failed to overwrite existing marking criteria: ' + clearError.message },
            { status: 500 }
          );
        }
      }

      const criteriaContent = chunkResponses
        .filter((item) => item.source === 'criteria')
        .sort((a, b) => a.index - b.index)
        .map((item) => item.content)
        .join('\n\n');

      const { criteria, topicMap } = parseCriteria(criteriaContent);

      const grouped: Record<string, string[]> = {};
      criteria.forEach((entry) => {
        if (!entry.key) return;
        if (!grouped[entry.key]) grouped[entry.key] = [];
        grouped[entry.key].push(...entry.criteriaLines);
      });

      const { data: existingQuestions, error: fetchError } = await supabaseAdmin
        .from('hsc_questions')
        .select('id, question_number, topic')
        .match({
          grade,
          year,
          subject,
          school_name: schoolNameForDb,
          paper_number: paperNumber,
        });

      if (fetchError) {
        console.error('Criteria fetch error:', fetchError);
      }

      const byQuestionKey = new Map<string, { ids: string[]; currentTopic: string | null }>();
      (existingQuestions || []).forEach((q: any) => {
        const normalized = normalizeQuestionKey(String(q.question_number || ''));
        const key = normalized.key || String(q.question_number || '').trim();
        if (!key) return;
        if (!byQuestionKey.has(key)) {
          byQuestionKey.set(key, { ids: [], currentTopic: q.topic ?? null });
        }
        const entry = byQuestionKey.get(key)!;
        entry.ids.push(q.id);
      });

      for (const [questionKey, lines] of Object.entries(grouped)) {
        const criteriaText = lines.join('\n');
        const entry = byQuestionKey.get(questionKey);
        const ids = entry?.ids || [];

        if (!ids.length) {
          missingCriteria.push(questionKey);
          continue;
        }

        if (overwrite) {
          const { error: clearError } = await supabaseAdmin
            .from('hsc_questions')
            .update({ marking_criteria: null })
            .in('id', ids);

          if (clearError) {
            console.error('Criteria clear error:', clearError);
          }
        }

        const { error: updateError } = await supabaseAdmin
          .from('hsc_questions')
          .update({ marking_criteria: criteriaText })
          .in('id', ids);

        if (updateError) {
          console.error('Criteria update error:', updateError);
          continue;
        }
        updatedCriteriaCount += ids.length;
      }

      // Apply topic mappings from the QUESTION_TOPIC lines, if present
      for (const [questionKey, topicText] of Object.entries(topicMap)) {
        const entry = byQuestionKey.get(questionKey);
        const ids = entry?.ids || [];
        if (!ids.length) continue;

        const { error: topicError } = await supabaseAdmin
          .from('hsc_questions')
          .update({ topic: topicText })
          .in('id', ids);

        if (topicError) {
          console.error('Topic update error:', topicError);
        }
      }
    }

    const fromChunks = chunkResponses
      .sort((a, b) => a.source.localeCompare(b.source) || a.index - b.index)
      .map((c) => c.content)
      .join('\n\n');
    const fromImages = imageResponseBodies.join('\n\n');
    const combinedModelOutput = [fromChunks, fromImages].filter(Boolean).join('\n\n') || null;

    let autoGroupsByQuestionId: Record<string, string> = {};
    let updatedQuestions: Array<{ id: string; group_id: string | null }> = [];
    if (autoGroupSubparts) {
      const { data: paperQuestions, error: paperQuestionsError } = await supabaseAdmin
        .from('hsc_questions')
        .select('id, question_number, group_id')
        .match({
          grade,
          year,
          subject,
          school_name: schoolNameForDb,
          paper_number: paperNumber,
        });

      if (paperQuestionsError) {
        console.error('Auto-group fetch error:', paperQuestionsError);
      } else {
        const rows = Array.isArray(paperQuestions) ? paperQuestions as Array<{ id: string; question_number: string | null }> : [];
        autoGroupsByQuestionId = buildAutoGroupMapByQuestionId(rows, {
          schoolName: schoolNameForDb,
          year,
          paperNumber,
          grade,
          subject,
        });

        const idsByGroupId = new Map<string, string[]>();
        Object.entries(autoGroupsByQuestionId).forEach(([questionId, groupId]) => {
          const existing = idsByGroupId.get(groupId) || [];
          existing.push(questionId);
          idsByGroupId.set(groupId, existing);
        });

        for (const [groupId, questionIds] of idsByGroupId.entries()) {
          const update = await supabaseAdmin
            .from('hsc_questions')
            .update({ group_id: groupId })
            .in('id', questionIds);

          if (update.error) {
            console.error('Auto-group update error:', update.error);
          }
        }

        const clearIds = rows
          .filter((question: any) => !autoGroupsByQuestionId[question.id] && String(question.group_id || '').trim())
          .map((question: any) => question.id);

        if (clearIds.length > 0) {
          const clear = await supabaseAdmin
            .from('hsc_questions')
            .update({ group_id: null })
            .in('id', clearIds);

          if (clear.error) {
            console.error('Auto-group clear error:', clear.error);
          }
        }

        const { data: refreshedQuestions, error: refreshedQuestionsError } = await supabaseAdmin
          .from('hsc_questions')
          .select('id, group_id')
          .match({
            grade,
            year,
            subject,
            school_name: schoolNameForDb,
            paper_number: paperNumber,
          });

        if (refreshedQuestionsError) {
          console.error('Auto-group refresh error:', refreshedQuestionsError);
        } else {
          updatedQuestions = Array.isArray(refreshedQuestions)
            ? refreshedQuestions as Array<{ id: string; group_id: string | null }>
            : [];
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdQuestions.length} questions. Updated ${updatedCriteriaCount} marking criteria.`,
      exam: examImageFiles.length
        ? { images: examImageFiles.length, totalBytes: examImageFiles.reduce((sum, file) => sum + file.size, 0) }
        : examFile
          ? { name: examFile.name, size: examFile.size, type: examFile.type || 'unknown' }
          : null,
      criteria: criteriaFile ? { name: criteriaFile.name, size: criteriaFile.size } : null,
      parsed: {
        year,
        grade,
        subject,
        schoolName: schoolNameForDb,
        paperNumber,
        paperLabel,
        questionsCreated: createdQuestions.length,
        criteriaUpdated: updatedCriteriaCount,
        criteriaMissing: missingCriteria.length,
      },
      missingCriteria,
      chunks: chunkResponses,
      refusals,
      autoGroupsByQuestionId,
      updatedQuestions,
      chatgpt: combinedModelOutput,
      modelOutput: combinedModelOutput,
      rawInputs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process PDFs';
    console.error('PDF ingest error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
