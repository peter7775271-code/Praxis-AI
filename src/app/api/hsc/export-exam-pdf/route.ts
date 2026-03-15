import { access, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { execFile } from 'child_process';
import { constants } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { supabaseAdmin } from '@/lib/db';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);
const PDFLATEX_PATH = process.env.PDFLATEX_PATH ?? '/usr/bin/pdflatex';
const LATEX_TO_PDF_API_URL = process.env.LATEX_TO_PDF_API_URL ?? 'https://latex.ytotech.com/builds/sync';
const LATEX_TO_PDF_API_MODE = (process.env.LATEX_TO_PDF_API_MODE ?? 'auto').toLowerCase();
const IS_VERCEL_RUNTIME = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
const IMAGE_FETCH_TIMEOUT_MS = Number(process.env.IMAGE_FETCH_TIMEOUT_MS ?? 15000);
const PDF_COMPILE_TIMEOUT_MS = Number(process.env.PDF_COMPILE_TIMEOUT_MS ?? 120000);
const MAX_IMAGE_BYTES = Number(process.env.MAX_IMAGE_BYTES ?? 10 * 1024 * 1024);
const MAX_GET_TEX_LENGTH = Number(process.env.MAX_GET_TEX_LENGTH ?? 1800);
const ENABLE_PLAIN_TEXT_PDF_FALLBACK = String(process.env.ENABLE_PLAIN_TEXT_PDF_FALLBACK ?? '').toLowerCase() === 'true';
const LOCAL_TEX_FILENAME = 'exam.tex';
const LOCAL_PDFLATEX_MISSING_SENTINEL = 'LOCAL_PDFLATEX_MISSING';

type ExportQuestion = {
  question_number?: string | null;
  question_text?: string | null;
  topic?: string | null;
  marks?: number | null;
  question_type?: 'written' | 'multiple_choice' | null;
  sample_answer?: string | null;
  sample_answer_image?: string | null;
  sample_answer_image_size?: 'small' | 'medium' | 'large' | null;
  marking_criteria?: string | null;
  graph_image_data?: string | null;
  graph_image_size?: 'small' | 'medium' | 'large' | 'missing' | null;
  mcq_option_a?: string | null;
  mcq_option_b?: string | null;
  mcq_option_c?: string | null;
  mcq_option_d?: string | null;
  mcq_option_a_image?: string | null;
  mcq_option_b_image?: string | null;
  mcq_option_c_image?: string | null;
  mcq_option_d_image?: string | null;
  mcq_correct_answer?: 'A' | 'B' | 'C' | 'D' | null;
  mcq_explanation?: string | null;
  graph_image_file?: string | null;
  sample_answer_image_file?: string | null;
  mcq_option_a_image_file?: string | null;
  mcq_option_b_image_file?: string | null;
  mcq_option_c_image_file?: string | null;
  mcq_option_d_image_file?: string | null;
};

const escapeLatexText = (value: string) =>
  value
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}%$&#_])/g, '\\$1')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}');

const stripInvalidControlChars = (value: string) =>
  String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

const normalizeEscapedLatexArtifacts = (value: string) =>
  value
    // Recover JSON-escaped inline math delimiters that arrive as \\( and \\).
    .replace(/\\\\\(/g, '\\(')
    .replace(/\\\\\)/g, '\\)')
    // Recover commands that were escaped as \{}command in degraded output paths.
    .replace(/\\\{\}\s*([A-Za-z]+)/g, '\\$1')
    .replace(/\\\{\}\s*([!,:;])/g, '\\$1')
    .replace(/\\dfrac/g, '\\frac')
    // Split fused command+word like \thetain → \theta in, \alphax → \alpha x.
    // Uses a function to pick the longest matching command, and skips splitting
    // when the full token is itself a valid LaTeX command (e.g. \left, \cosec).
    .replace(/\\([a-zA-Z]+)/g, (_match, letters) => {
      const SPLITTABLE = [
        'alpha', 'beta', 'gamma', 'delta', 'theta', 'lambda', 'mu', 'sigma', 'phi', 'omega',
        'pi', 'Delta', 'Sigma', 'Omega',
        'sin', 'cos', 'tan', 'sec', 'cot', 'log', 'ln', 'exp', 'lim',
        'infty', 'angle', 'quad', 'qquad', 'cdot', 'times', 'div',
        'leq', 'geq', 'neq', 'le', 'ge', 'pm', 'mp', 'approx', 'to',
        'vec', 'hat', 'bar', 'dot', 'tilde',
      ];
      // Commands that must never be split even though a prefix matches SPLITTABLE.
      const KNOWN_COMMANDS = new Set([
        ...SPLITTABLE,
        'left', 'right', 'frac', 'dfrac', 'sqrt', 'begin', 'end',
        'text', 'textbf', 'textit', 'mathrm', 'mathit', 'mathbf', 'mathbb', 'mathcal',
        'operatorname', 'ensuremath',
        'cosec', 'arcsin', 'arccos', 'arctan',
        'overrightarrow', 'overleftarrow', 'overline', 'underline',
        'overbrace', 'underbrace', 'widehat', 'widetilde',
        'noindent', 'newline', 'hspace', 'vspace', 'hline',
        'includegraphics', 'section', 'subsection', 'subsubsection',
        'item', 'itemsep', 'centering', 'label', 'ref', 'url', 'href',
        'pmatrix', 'bmatrix', 'vmatrix', 'smallmatrix',
        'textbackslash', 'textasciicircum', 'textasciitilde', 'textdegree',
        'phantom', 'limits', 'nolimits', 'displaystyle', 'textstyle',
        'parallel', 'perp', 'therefore', 'because',
        'in', 'notin', 'subset', 'supset', 'subseteq', 'supseteq',
        'cup', 'cap', 'exists', 'forall', 'implies', 'iff', 'neg', 'land', 'lor',
      ]);
      // If the full token is a known command, don't split
      if (KNOWN_COMMANDS.has(letters)) return _match;
      // Find the longest splittable command that is a prefix of letters
      let best: string | null = null;
      for (const cmd of SPLITTABLE) {
        if (letters.startsWith(cmd) && (!best || cmd.length > best.length)) {
          best = cmd;
        }
      }
      if (best && best.length < letters.length) {
        return `\\${best} ${letters.slice(best.length)}`;
      }
      return _match;
    })
    // Drop stray backslashes that are not starting a command/escape and can crash pdflatex.
    .replace(/\\(?![A-Za-z]+|[%$&#_{}~^\\()\[\],;:! ])/g, '');

/** Inside matrix environments, repair single-backslash + letter that should be \\ (row separator). */
const repairMatrixRowSeparators = (value: string) =>
  value.replace(
    /\\begin\{([pbBvV]?matrix|smallmatrix)\}([\s\S]*?)\\end\{\1\}/g,
    (_match, env: string, body: string) => {
      const repaired = body.replace(/(?<!\\)\\([a-zA-Z])(?![a-zA-Z])/g, (_m, letter) => `\\\\${letter}`);
      return `\\begin{${env}}${repaired}\\end{${env}}`;
    }
  );

const wrapParenthesizedMathLikeSegments = (value: string) =>
  value.replace(/(^|[\s,:;])\(([^()\n]*\\(?:d?frac|sqrt)[^()\n]*)\)/g, (_match, prefix, expr) => {
    const candidate = String(expr || '').trim();
    if (!candidate) return _match;
    return `${prefix}\\(${candidate}\\)`;
  });

const normalizeLatexBody = (value: string) =>
  wrapParenthesizedMathLikeSegments(
    repairMatrixRowSeparators(normalizeEscapedLatexArtifacts(applyOcrMathRepairs(stripInvalidControlChars(value))))
    .replace(/\[\[PART_DIVIDER:([^\]]+)\]\]/g, (_match, label) => `\n\n\\noindent\\textbf{(${label})} `)
    .replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/gi, '')
    .replace(/\\includegraphics\*?\s*(?:\[[^\]]*\])?\s*\{[^}]+\}/gi, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\\graphicspath\{[^}]*\}/gi, '')
    .replace(/\[\s*beginaligned/gi, '')
    .replace(/\[\s*endaligned\s*\]/gi, '')
    .replace(/\bbeginaligned\b/gi, '')
    .replace(/\bendaligned\b/gi, '')
    .replace(/(?<!\\)&/g, '\\&')
    .replace(/\bMARKS_(\d+)\b/g, 'MARKS\\_$1')
    .replace(/\bQUESTION_(\d+)\b/g, 'QUESTION\\_$1')
    .replace(/(^|\s)([0-9]*[A-Za-z]+)\^\(([^)]+)\)/g, (_match, prefix, base, powerExpr) => `${prefix}\\ensuremath{${base}^{(${powerExpr})}}`)
    .replace(/(^|\s)([0-9]*[A-Za-z]+)\^([A-Za-z])(?![A-Za-z0-9{])/g, (_match, prefix, base, power) => `${prefix}\\ensuremath{${base}^{${power}}}`)
    .replace(/(^|\s)([0-9]*[A-Za-z]+)\^([0-9]+)(?=\b)/g, (_match, prefix, base, power) => `${prefix}\\ensuremath{${base}^{${power}}}`)
    .replace(/∠/g, '\\ensuremath{\\angle}')
    .replace(/≤/g, '\\ensuremath{\\le}')
    .replace(/≥/g, '\\ensuremath{\\ge}')
    .replace(/≠/g, '\\ensuremath{\\neq}')
    .replace(/⇒/g, '\\ensuremath{\\Rightarrow}')
    .replace(/→/g, '\\ensuremath{\\to}')
    .replace(/↔/g, '\\ensuremath{\\leftrightarrow}')
    .replace(/×/g, '\\ensuremath{\\times}')
    .replace(/÷/g, '\\ensuremath{\\div}')
    .replace(/π/g, '\\ensuremath{\\pi}')
    .replace(/α/g, '\\ensuremath{\\alpha}')
    .replace(/β/g, '\\ensuremath{\\beta}')
    .replace(/γ/g, '\\ensuremath{\\gamma}')
    .replace(/δ/g, '\\ensuremath{\\delta}')
    .replace(/θ/g, '\\ensuremath{\\theta}')
    .replace(/λ/g, '\\ensuremath{\\lambda}')
    .replace(/μ/g, '\\ensuremath{\\mu}')
    .replace(/σ/g, '\\ensuremath{\\sigma}')
    .replace(/φ/g, '\\ensuremath{\\phi}')
    .replace(/ω/g, '\\ensuremath{\\omega}')
    .replace(/Δ/g, '\\ensuremath{\\Delta}')
    .replace(/Σ/g, '\\ensuremath{\\Sigma}')
    .replace(/Ω/g, '\\ensuremath{\\Omega}')
    .replace(/√/g, '\\ensuremath{\\surd}')
    .replace(/°/g, '\\ensuremath{^{\\circ}}')
    .replace(/±/g, '\\ensuremath{\\pm}')
    .replace(/∞/g, '\\ensuremath{\\infty}')
    .replace(/−/g, '\\ensuremath{-}')
    .replace(/′/g, '\\ensuremath{^{\\prime}}')
    .replace(/″/g, '\\ensuremath{^{\\prime\\prime}}')
    .replace(/…/g, '\\ldots{}')
    .replace(/—/g, '---')
    .replace(/–/g, '--')
    .replace(/\u201C/g, '``')
    .replace(/\u201D/g, "''")
    .replace(/\u2018/g, '`')
    .replace(/\u2019/g, "'")
    .replace(/•/g, '\\textbullet{}')
    .replace(/∈/g, '\\ensuremath{\\in}')
    .replace(/∴/g, '\\ensuremath{\\therefore}')
    .replace(/⊥/g, '\\ensuremath{\\perp}')
    .replace(/∥/g, '\\ensuremath{\\parallel}')
    .replace(/²/g, '\\ensuremath{^{2}}')
    .replace(/³/g, '\\ensuremath{^{3}}')
    .replace(/¹/g, '\\ensuremath{^{1}}')
    .replace(/½/g, '\\ensuremath{\\frac{1}{2}}')
    .replace(/¼/g, '\\ensuremath{\\frac{1}{4}}')
    .replace(/¾/g, '\\ensuremath{\\frac{3}{4}}')
    .replace(/∑/g, '\\ensuremath{\\sum}')
    .replace(/∫/g, '\\ensuremath{\\int}')
    .replace(/∂/g, '\\ensuremath{\\partial}')
    .replace(/∇/g, '\\ensuremath{\\nabla}')
    .replace(/⊂/g, '\\ensuremath{\\subset}')
    .replace(/⊃/g, '\\ensuremath{\\supset}')
    .replace(/⊆/g, '\\ensuremath{\\subseteq}')
    .replace(/⊇/g, '\\ensuremath{\\supseteq}')
    .replace(/∪/g, '\\ensuremath{\\cup}')
    .replace(/∩/g, '\\ensuremath{\\cap}')
    .replace(/∅/g, '\\ensuremath{\\emptyset}')
    .replace(/∀/g, '\\ensuremath{\\forall}')
    .replace(/∃/g, '\\ensuremath{\\exists}')
    .replace(/¬/g, '\\ensuremath{\\neg}')
    .replace(/∧/g, '\\ensuremath{\\land}')
    .replace(/∨/g, '\\ensuremath{\\lor}')
    .trim()
  );

const normalizePlainBody = (value: string) =>
  normalizeEscapedLatexArtifacts(stripInvalidControlChars(value))
    .replace(/\[\[PART_DIVIDER:([^\]]+)\]\]/g, (_match, label) => `\n\n(${label}) `)
    .replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/gi, '')
    .replace(/\\includegraphics\*?\s*(?:\[[^\]]*\])?\s*\{[^}]+\}/gi, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\\graphicspath\{[^}]*\}/gi, '')
    .replace(/\[\s*beginaligned/gi, '')
    .replace(/\[\s*endaligned\s*\]/gi, '')
    .replace(/\bbeginaligned\b/gi, '')
    .replace(/\bendaligned\b/gi, '')
    .replace(/(?<!\\)&/g, ' and ')
    .replace(/\bMARKS_(\d+)\b/g, 'MARKS $1')
    .replace(/\bQUESTION_(\d+)\b/g, 'QUESTION $1')
    .replace(/\\dfrac/g, '\\frac')
    .replace(/\s+/g, ' ')
    .trim();

const imageWidthBySize = (size: string | null | undefined) => {
  if (size === 'small') return '0.38\\textwidth';
  if (size === 'large') return '0.85\\textwidth';
  return '0.62\\textwidth';
};

const detectImageExt = (mimeOrPath: string) => {
  const value = mimeOrPath.toLowerCase();
  if (value.includes('jpeg') || value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'jpg';
  if (value.includes('png') || value.endsWith('.png')) return 'png';
  if (value.includes('webp') || value.endsWith('.webp')) return 'webp';
  if (value.includes('gif') || value.endsWith('.gif')) return 'gif';
  return 'png';
};

const isPdflatexImageExt = (ext: string) => ext === 'jpg' || ext === 'png';

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      lastError = error;
      const code = String((error as { cause?: { code?: string } })?.cause?.code || '');
      const name = String((error as { name?: string })?.name || '');
      const isTimeoutLike = code === 'ETIMEDOUT' || name === 'AbortError';
      if (!isTimeoutLike || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('fetch failed');
};

const isPdfBuffer = (buffer: Buffer) => buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';

const safeUtf8Preview = (buffer: Buffer, maxLength = 500) =>
  buffer.toString('utf8').replace(/\s+/g, ' ').slice(0, maxLength);

const normalizeTrigCommands = (value: string) =>
  value
    .replace(/(?<!\\)\bcosec\b/gi, '\\operatorname{cosec}')
    .replace(/(?<!\\)\b(sec|sin|cos|tan|cot)\b/gi, (_match, fn) => `\\${String(fn).toLowerCase()}`);

const ocrMathTokenRepair = (value: string) => {
  const repairedFracWithSpace = value
    .replace(/\bfrac\s+(sin|cos|tan|sec|cosec|cot)\s+([A-Za-z0-9]+)\s+([^\n]+)/gi, (_match, fn, arg, denominator) => {
      return `\\frac{${fn} ${arg}}{${denominator.trim()}}`;
    })
    .replace(/\bfrac\s+([^\s]+)\s+([^\n]+)/gi, (_match, numerator, denominator) => {
      return `\\frac{${numerator}}{${denominator.trim()}}`;
    });

  const repairedFracWithoutSlash = repairedFracWithSpace
    .replace(/\\dfrac/g, '\\frac')
    .replace(/\bfrac(\d+)([A-Za-z][A-Za-z0-9()+\-*/.]*)/g, (_match, numerator, denominator) => {
      return `\\frac{${numerator}}{${denominator}}`;
    })
    .replace(/\bfrac([A-Za-z]+)(\d+[A-Za-z0-9()+\-*/.]*)/g, (_match, numerator, denominator) => {
      return `\\frac{${numerator}}{${denominator}}`;
    });

  return normalizeTrigCommands(repairedFracWithoutSlash)
    .replace(/([A-Za-z0-9()]+)\s+to the power of\s+([A-Za-z0-9()+\-*/.]+)/gi, (_match, base, exponent) => {
      return `${base}^{${exponent}}`;
    })
    .replace(/\bto the power of\b/gi, '^')
    .replace(/\bsec\s*\^\s*2\s*([A-Za-z])/gi, 'sec^2 $1')
    .replace(/\s+/g, ' ')
    .trim();
};

const applyOcrMathRepairs = (value: string) =>
  value
    .replace(/\\dfrac/g, '\\frac')
    .replace(/([A-Za-z0-9()]+)\s+to the power of\s+([A-Za-z0-9()+\-*/.]+)/gi, (_match, base, exponent) => {
      return `${base}^{${exponent}}`;
    })
    .replace(/\[\s*([^\]]+)\s*\]/g, (match, candidate, offset, source) => {
      const raw = String(candidate || '').trim();
      if (!raw) return match;
      // Don't convert brackets that are part of \left[...\right] or after a LaTeX command
      const before = source.slice(Math.max(0, offset - 10), offset);
      if (/\\(left|right|begin|sqrt|operatorname)\s*$/.test(before)) return match;
      if (/\\right\b/.test(raw)) return match;
      if (!/(=|\^|\\frac|\bfrac\b|\bto the power of\b|\b(sin|cos|tan|sec|cosec|cot)\b|\d)/i.test(raw)) {
        return match;
      }
      const repaired = ocrMathTokenRepair(raw);
      return `\\(${repaired}\\)`;
    })
    .replace(/(^|[^\\])\bfrac\s+([^\s]+)\s+([^\n]+)/gi, (_match, prefix, numerator, denominator) => {
      return `${prefix}\\frac{${numerator}}{${denominator.trim()}}`;
    })
    .replace(/(^|[^\\])\bfrac(\d+)([A-Za-z][A-Za-z0-9()+\-*/.]*)/g, (_match, prefix, numerator, denominator) => {
      return `${prefix}\\frac{${numerator}}{${denominator}}`;
    });

const isEscapedInStringAt = (value: string, index: number) => {
  let backslashes = 0;
  for (let scan = index - 1; scan >= 0 && value[scan] === '\\'; scan -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
};

const isInsideMathAt = (value: string, offset: number) => {
  let inInlineDollar = false;
  let inDisplayDollar = false;
  let inParenMath = false;
  let inBracketMath = false;

  for (let index = 0; index < offset; index += 1) {
    const current = value[index];
    if (current === '\\' && !isEscapedInStringAt(value, index)) {
      const next = value[index + 1];
      if (next === '(') {
        inParenMath = true;
      } else if (next === ')') {
        inParenMath = false;
      } else if (next === '[') {
        inBracketMath = true;
      } else if (next === ']') {
        inBracketMath = false;
      }
      continue;
    }

    if (current === '$' && !isEscapedInStringAt(value, index)) {
      const next = value[index + 1];
      if (next === '$' && !isEscapedInStringAt(value, index + 1)) {
        inDisplayDollar = !inDisplayDollar;
        index += 1;
        continue;
      }
      inInlineDollar = !inInlineDollar;
    }
  }

  return inInlineDollar || inDisplayDollar || inParenMath || inBracketMath;
};

const applyCompileSafeLatexRepairs = (value: string) =>
  stripInvalidControlChars(value)
    .replace(/\[\s*([^\]]+)\s*\]/g, (match, candidate, offset, source) => {
      const raw = String(candidate || '').trim();
      if (!raw) return match;
      // Don't convert brackets that are part of \left[...\right] or after a LaTeX command
      const before = source.slice(Math.max(0, offset - 10), offset);
      if (/\\(left|right|begin|sqrt|operatorname)\s*$/.test(before)) return match;
      if (/\\right\b/.test(raw)) return match;
      if (!/(=|\^|\\frac|\bfrac\b|\b(sin|cos|tan|sec|cosec|cot)\b|\d)/i.test(raw)) {
        return match;
      }
      const repaired = ocrMathTokenRepair(raw);
      return `\\(${repaired}\\)`;
    })
    .replace(/(?<!\\)&/g, '\\&')
    .replace(/(?<!\\)_/g, (_match, offset, source) => (isInsideMathAt(source, offset) ? '_' : '\\_'))
    .replace(/(?<!\\)%/g, '\\%')
    .replace(/(?<!\\)#/g, '\\#');

const isEscapedAt = (chars: string[], index: number) => {
  let backslashes = 0;
  for (let scan = index - 1; scan >= 0 && chars[scan] === '\\'; scan -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
};

const balanceLatexBraces = (value: string) => {
  const chars = Array.from(value);
  let openCount = 0;

  for (let index = 0; index < chars.length; index += 1) {
    const current = chars[index];
    if (isEscapedAt(chars, index)) continue;

    if (current === '{') {
      openCount += 1;
      continue;
    }

    if (current === '}') {
      if (openCount > 0) {
        openCount -= 1;
      } else {
        chars[index] = '\\}';
      }
    }
  }

  return `${chars.join('')}${'}'.repeat(openCount)}`;
};

const normalizeInlineDollarMath = (value: string) => {
  const chars = Array.from(value);
  const unescapedDollarIndexes: number[] = [];
  for (let index = 0; index < chars.length; index += 1) {
    if (chars[index] !== '$') continue;
    if (isEscapedAt(chars, index)) continue;
    unescapedDollarIndexes.push(index);
  }

  if (unescapedDollarIndexes.length % 2 === 0) return value;

  // Escape only the trailing unmatched inline dollar; preserve existing valid math pairs.
  const unmatchedIndex = unescapedDollarIndexes[unescapedDollarIndexes.length - 1];
  chars[unmatchedIndex] = '\\$';
  return chars.join('');
};

const finalizeCompileSafeBody = (value: string) =>
  neutralizeUnknownLatexCommands(normalizeInlineDollarMath(balanceLatexBraces(repairMatrixRowSeparators(normalizeEscapedLatexArtifacts(value)))));

const SAFE_LATEX_COMMANDS = new Set([
  'frac', 'dfrac', 'sqrt', 'left', 'right', 'cdot', 'times', 'div',
  'le', 'leq', 'ge', 'geq', 'neq', 'pm', 'mp', 'infty',
  'sum', 'int', 'lim', 'log', 'ln', 'exp',
  'sin', 'cos', 'tan', 'sec', 'cosec', 'cot', 'operatorname',
  'alpha', 'beta', 'gamma', 'delta', 'theta', 'lambda', 'mu', 'sigma', 'phi', 'omega',
  'pi', 'angle', 'to', 'Rightarrow', 'leftrightarrow', 'approx',
  'in', 'notin', 'subset', 'supset', 'subseteq', 'supseteq', 'cup', 'cap',
  'exists', 'forall', 'implies', 'iff', 'neg', 'land', 'lor',
  'Delta', 'Sigma', 'Omega',
  'vec', 'overrightarrow', 'overleftarrow', 'overline', 'underline',
  'hat', 'bar', 'dot', 'ddot', 'tilde', 'widehat', 'widetilde',
  'overbrace', 'underbrace', 'mathbb', 'mathcal',
  'text', 'textbf', 'mathrm', 'mathit', 'mathbf', 'ensuremath',
  'quad', 'qquad', 'dots', 'ldots', 'cdots',
  'noindent', 'newline', 'par', 'vspace', 'hspace', 'textbackslash', 'textasciicircum', 'textasciitilde', 'textdegree',
  'begin', 'end', 'item', 'itemsep', 'centering', 'hline',
  'section', 'subsection', 'subsubsection',
  'includegraphics', 'url', 'href', 'label', 'ref',
]);

const neutralizeUnknownLatexCommands = (value: string) =>
  value.replace(/(?<!\\)\\([A-Za-z]+)\b/g, (_match, command) => {
    if (SAFE_LATEX_COMMANDS.has(command)) return `\\${command}`;
    return command;
  });

const extractTexLineNumber = (text: string) => {
  const match = text.match(/exam\.tex:(\d+):/i);
  const fallback = text.match(/\bl\.(\d+)\b/i);
  const line = match?.[1] ?? fallback?.[1];
  if (!line) return null;
  const parsed = Number(line);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const tailLines = (value: string, maxLines = 80) => {
  const lines = String(value || '').split(/\r?\n/);
  return lines.slice(-maxLines).join('\n').trim();
};

const truncateDiagnostic = (value: string, maxLength = 8000) => {
  if (value.length <= maxLength) return value;
  const headLen = Math.floor(maxLength * 0.65);
  const tailLen = maxLength - headLen - 40;
  return `${value.slice(0, headLen)}\n\n... diagnostic truncated ...\n\n${value.slice(-tailLen)}`;
};

const composePdflatexDiagnostic = ({
  stderr,
  stdout,
  logTail,
}: {
  stderr: string;
  stdout: string;
  logTail: string;
}) => {
  const sections: string[] = [];
  if (logTail) sections.push(`log context:\n${logTail}`);
  if (stderr) sections.push(`stderr tail:\n${tailLines(stderr)}`);
  if (stdout) sections.push(`stdout tail:\n${tailLines(stdout)}`);
  return sections.filter(Boolean).join('\n\n');
};

const readTexContext = async (texPath: string, lineNumber: number) => {
  try {
    const raw = await readFile(texPath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const start = Math.max(1, lineNumber - 3);
    const end = Math.min(lines.length, lineNumber + 3);
    const snippet: string[] = [];
    for (let line = start; line <= end; line += 1) {
      const marker = line === lineNumber ? '>' : ' ';
      snippet.push(`${marker} ${line}: ${lines[line - 1] ?? ''}`);
    }
    return snippet.join('\n');
  } catch {
    return '';
  }
};

const extractLatexErrorContext = (logRaw: string) => {
  const lines = logRaw.split(/\r?\n/);
  let bangIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (/^!\s/.test(lines[index])) {
      bangIndex = index;
      break;
    }
  }

  if (bangIndex < 0) {
    return lines.slice(-80).join('\n');
  }

  const start = Math.max(0, bangIndex - 4);
  const end = Math.min(lines.length, bangIndex + 12);
  return lines.slice(start, end).join('\n');
};

const parseQuestionNumberForDisplay = (questionNumber: string | null | undefined) => {
  const raw = String(questionNumber || '').trim();
  const compact = raw.replace(/\s+/g, '');
  const mainMatch = compact.match(/^(\d+)/);
  if (!mainMatch) {
    return { baseKey: null as string | null, subPart: null as string | null, roman: null as string | null, firstSuffix: null as string | null };
  }

  const baseKey = mainMatch[1];
  const remainder = compact.slice(mainMatch[0].length);

  // Try to extract letter sub-part (a/b/c) and roman numeral:  "a(ii)" or "(a)(ii)" or "a ii"
  let subPart: string | null = null;
  let roman: string | null = null;

  // Match patterns like: a(i), (a)(i), a(ii), (b)(iii), a, (a), etc.
  const fullMatch = remainder.match(/^\(?([a-zA-Z])\)?\s*\(?((?:ix|iv|v?i{0,3}|x{1,3}))\)?$/i);
  if (fullMatch) {
    subPart = fullMatch[1].toLowerCase();
    roman = fullMatch[2].toLowerCase();
  } else {
    // Just a letter sub-part, no roman: "a", "(a)", "b"
    const letterOnly = remainder.match(/^\(?([a-zA-Z])\)?$/i);
    if (letterOnly) {
      subPart = letterOnly[1].toLowerCase();
    } else {
      // Parenthetical groups fallback
      const parentheticalGroups = Array.from(remainder.matchAll(/\(([A-Za-z0-9]+)\)/g)).map((match) => match[1]);
      if (parentheticalGroups.length >= 2) {
        subPart = parentheticalGroups[0].toLowerCase();
        roman = parentheticalGroups[1].toLowerCase();
      } else if (parentheticalGroups.length === 1) {
        subPart = parentheticalGroups[0].toLowerCase();
      } else {
        const fallback = remainder.match(/^([A-Za-z0-9]+)/);
        if (fallback?.[1]) {
          subPart = fallback[1].toLowerCase();
        }
      }
    }
  }

  // firstSuffix: legacy compat — first meaningful suffix token
  const firstSuffix = roman ?? subPart;

  return { baseKey, subPart, roman, firstSuffix };
};

const getRomanDisplayBase = (questionNumber: string | null | undefined) => {
  const raw = String(questionNumber || '').trim();
  const withRoman = raw.match(/^(\d+)\s*\(?([a-z])\)?\s*\(?((?:ix|iv|v?i{0,3}|x))\)?/i);
  if (!withRoman) return null;
  return `${withRoman[1]}(${withRoman[2].toLowerCase()})`;
};

const writeQuestionImageAsset = async (tempDir: string, baseName: string, source: string) => {
  const trimmed = String(source || '').trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:image/')) {
    const dataMatch = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!dataMatch) return null;
    const mime = dataMatch[1];
    const base64 = dataMatch[2];
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      console.warn('[export-exam-pdf] Skipping invalid base64 image payload');
      return null;
    }
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
      console.warn('[export-exam-pdf] Skipping embedded image due to size constraints');
      return null;
    }
    const ext = detectImageExt(mime);
    if (!isPdflatexImageExt(ext)) {
      console.warn(`[export-exam-pdf] Skipping unsupported embedded image format for pdflatex: ${ext}`);
      return null;
    }
    const filename = `${baseName}.${ext}`;
    await writeFile(path.join(tempDir, filename), buffer);
    return filename;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const response = await fetchWithTimeout(trimmed, {}, IMAGE_FETCH_TIMEOUT_MS);
    if (!response.ok) return null;
    const contentLength = Number(response.headers.get('content-length') || '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      console.warn('[export-exam-pdf] Skipping remote image that exceeds size limit');
      return null;
    }
    const contentType = response.headers.get('content-type') || '';
    const ext = detectImageExt(contentType || trimmed);
    if (!isPdflatexImageExt(ext)) {
      console.warn(`[export-exam-pdf] Skipping remote image format unsupported by pdflatex: ${ext}`);
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
      console.warn('[export-exam-pdf] Skipping remote image due to size constraints');
      return null;
    }
    const filename = `${baseName}.${ext}`;
    await writeFile(path.join(tempDir, filename), buffer);
    return filename;
  }

  return null;
};

const attachQuestionImageAssets = async (questions: ExportQuestion[], tempDir: string, includeSolutions: boolean) => {
  const enriched: ExportQuestion[] = [];
  const emittedRomanDiagramByBase = new Set<string>();

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const romanBase = getRomanDisplayBase(question.question_number);
    let graphImage: string | null = null;

    if (question.graph_image_data) {
      if (romanBase && emittedRomanDiagramByBase.has(romanBase)) {
        graphImage = null;
      } else {
        graphImage = await writeQuestionImageAsset(tempDir, `q-${index + 1}-diagram`, question.graph_image_data);
        if (romanBase && graphImage) {
          emittedRomanDiagramByBase.add(romanBase);
        }
      }
    }

    const solutionImage = includeSolutions && question.sample_answer_image
      ? await writeQuestionImageAsset(tempDir, `q-${index + 1}-solution`, question.sample_answer_image)
      : null;

    const optionAImage = question.mcq_option_a_image
      ? await writeQuestionImageAsset(tempDir, `q-${index + 1}-opt-a`, question.mcq_option_a_image)
      : null;
    const optionBImage = question.mcq_option_b_image
      ? await writeQuestionImageAsset(tempDir, `q-${index + 1}-opt-b`, question.mcq_option_b_image)
      : null;
    const optionCImage = question.mcq_option_c_image
      ? await writeQuestionImageAsset(tempDir, `q-${index + 1}-opt-c`, question.mcq_option_c_image)
      : null;
    const optionDImage = question.mcq_option_d_image
      ? await writeQuestionImageAsset(tempDir, `q-${index + 1}-opt-d`, question.mcq_option_d_image)
      : null;

    enriched.push({
      ...question,
      graph_image_file: graphImage,
      sample_answer_image_file: solutionImage,
      mcq_option_a_image_file: optionAImage,
      mcq_option_b_image_file: optionBImage,
      mcq_option_c_image_file: optionCImage,
      mcq_option_d_image_file: optionDImage,
    });
  }

  return enriched;
};

const getReferencedAssetFilenames = (questions: ExportQuestion[]) => {
  const filenames = new Set<string>();
  for (const question of questions) {
    const candidates = [
      question.graph_image_file,
      question.sample_answer_image_file,
      question.mcq_option_a_image_file,
      question.mcq_option_b_image_file,
      question.mcq_option_c_image_file,
      question.mcq_option_d_image_file,
    ];
    for (const candidate of candidates) {
      const name = String(candidate || '').trim();
      if (name) filenames.add(name);
    }
  }
  return Array.from(filenames);
};

const buildExamLatex = ({
  title,
  subtitle,
  includeSolutions,
  questions,
  compileSafeMode = false,
  plainTextMode = false,
}: {
  title: string;
  subtitle: string;
  includeSolutions: boolean;
  questions: ExportQuestion[];
  compileSafeMode?: boolean;
  plainTextMode?: boolean;
}) => {
  const normalizeBody = plainTextMode ? normalizePlainBody : normalizeLatexBody;
  const renderBody = (value: string) => {
    const normalized = normalizeBody(String(value || ''));
    if (plainTextMode) {
      return escapeLatexText(normalized);
    }
    if (compileSafeMode) {
      return finalizeCompileSafeBody(applyCompileSafeLatexRepairs(normalized));
    }
    return normalized;
  };

  const renumberMap = new Map<string, number>();
  let nextQuestionNumber = 1;
  const parsedDetails = questions.map((question, index) => {
    const details = parseQuestionNumberForDisplay(question.question_number);
    const baseKey = details.baseKey ?? `__row_${index}`;
    if (!renumberMap.has(baseKey)) {
      renumberMap.set(baseKey, nextQuestionNumber);
      nextQuestionNumber += 1;
    }
    const mappedMain = renumberMap.get(baseKey) as number;
    return { ...details, mappedMain };
  });

  const renderQuestionContent = (question: ExportQuestion, lines: string[], inlinePrefix = '') => {
    const questionType = question.question_type || 'written';
    const questionText = renderBody(String(question.question_text || ''));

    lines.push(`${inlinePrefix}${questionText || 'No question text provided.'}`);
    lines.push('');
    if (question.graph_image_file) {
      lines.push('\\begin{center}');
      lines.push(`\\includegraphics[draft=false,width=${imageWidthBySize(question.graph_image_size)}]{${question.graph_image_file}}`);
      lines.push('\\end{center}');
      lines.push('');
    }

    if (questionType === 'multiple_choice') {
      const options: Array<{ label: 'A' | 'B' | 'C' | 'D'; value: string; imageFile?: string | null }> = [
        {
          label: 'A',
          value: renderBody(String(question.mcq_option_a || '').trim()),
          imageFile: question.mcq_option_a_image_file,
        },
        {
          label: 'B',
          value: renderBody(String(question.mcq_option_b || '').trim()),
          imageFile: question.mcq_option_b_image_file,
        },
        {
          label: 'C',
          value: renderBody(String(question.mcq_option_c || '').trim()),
          imageFile: question.mcq_option_c_image_file,
        },
        {
          label: 'D',
          value: renderBody(String(question.mcq_option_d || '').trim()),
          imageFile: question.mcq_option_d_image_file,
        },
      ];
      lines.push('\\begin{enumerate}[label=\\textbf{(\\Alph*)}]');
      for (const option of options) {
        lines.push('\\item');
        if (option.value) {
          lines.push(option.value);
        }
        if (option.imageFile) {
          lines.push('\\begin{center}');
          lines.push(`\\includegraphics[draft=false,width=0.30\\textwidth]{${option.imageFile}}`);
          lines.push('\\end{center}');
        }
        if (!option.value && !option.imageFile) {
          lines.push(' ');
        }
      }
      lines.push('\\end{enumerate}');
      lines.push('');

      if (includeSolutions) {
        lines.push('\\subsection*{Solution}');
        if (question.mcq_correct_answer) {
          lines.push(`\\textbf{Correct Answer:} ${escapeLatexText(String(question.mcq_correct_answer))}`);
          lines.push('');
        }
        if (question.mcq_explanation) {
          lines.push(renderBody(String(question.mcq_explanation)));
          lines.push('');
        }
      }
    } else if (includeSolutions) {
      lines.push('\\subsection*{Solution}');
      if (question.sample_answer) {
        lines.push(renderBody(String(question.sample_answer)));
        lines.push('');
      }
      if (question.sample_answer_image_file) {
        lines.push('\\begin{center}');
        lines.push(`\\includegraphics[draft=false,width=${imageWidthBySize(question.sample_answer_image_size)}]{${question.sample_answer_image_file}}`);
        lines.push('\\end{center}');
        lines.push('');
      }
    }
  };

  // Group consecutive questions that share the same base+subPart and have roman numerals.
  const bodyParts: string[] = [];
  let cursor = 0;
  while (cursor < questions.length) {
    const question = questions[cursor];
    const details = parsedDetails[cursor];
    const marks = Number(question.marks || 0);
    const marksLabel = marks > 0 ? `${marks} ${marks === 1 ? 'mark' : 'marks'}` : '';

    // Determine if this starts a roman-numeral group: same base + subPart, with roman
    if (details.roman && details.subPart) {
      const groupKey = `${details.mappedMain}_${details.subPart}`;
      // Collect consecutive questions with the same group
      const groupStart = cursor;
      while (cursor < questions.length) {
        const d = parsedDetails[cursor];
        if (!d.roman || !d.subPart || `${d.mappedMain}_${d.subPart}` !== groupKey) break;
        cursor += 1;
      }
      const groupQuestions = questions.slice(groupStart, cursor);
      const groupDetails = parsedDetails.slice(groupStart, cursor);

      // Compute total marks for the group header
      const totalMarks = groupQuestions.reduce((sum, q) => sum + Number(q.marks || 0), 0);
      const totalMarksLabel = totalMarks > 0 ? `${totalMarks} ${totalMarks === 1 ? 'mark' : 'marks'}` : '';

      const lines: string[] = [];
      // Group header: "Question N (a)"
      const groupLabel = `Question ${details.mappedMain} (${details.subPart})`;
      lines.push('\\noindent\\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r@{}}');
      lines.push(`\\textbf{${escapeLatexText(groupLabel)}}${totalMarksLabel ? ` & \\textbf{${escapeLatexText(totalMarksLabel)}}` : ' & '}\\\\[0.5em]`);
      lines.push('\\end{tabular*}');

      // Render each sub-item with roman label
      for (let gi = 0; gi < groupQuestions.length; gi += 1) {
        const subQ = groupQuestions[gi];
        const subD = groupDetails[gi];
        const subMarks = Number(subQ.marks || 0);

        lines.push('\\noindent\\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r@{}}');
        lines.push(`\\textbf{(${escapeLatexText(subD.roman || '')})}${subMarks > 0 ? ` & \\textbf{${subMarks}}` : ' & '}\\\\`);        lines.push('\\end{tabular*}');
        renderQuestionContent(subQ, lines);
        if (gi < groupQuestions.length - 1) {
          lines.push('\\vspace{0.5em}');
        }
      }

      lines.push('\\vspace{0.9em}');
      bodyParts.push(lines.join('\n'));
    } else {
      // Standalone question (no roman sub-parts)
      const questionLabel = `Question ${details.mappedMain}${details.subPart ? ` (${details.subPart})` : ''}`;
      const lines: string[] = [];
      lines.push('\\noindent\\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r@{}}');
      lines.push(`\\textbf{${escapeLatexText(questionLabel)}}${marksLabel ? ` & \\textbf{${escapeLatexText(marksLabel)}}` : ' & '}\\\\[0.5em]`);
      lines.push('\\end{tabular*}');
      renderQuestionContent(question, lines);
      lines.push('\\vspace{0.9em}');
      bodyParts.push(lines.join('\n'));
      cursor += 1;
    }
  }

  const body = bodyParts.join('\n\n');

  return `\\documentclass[11pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[a4paper,margin=1in]{geometry}
\\usepackage{lmodern}
\\usepackage{microtype}
\\usepackage{amsmath,amssymb,mathtools}
\\usepackage[final]{graphicx}
\\usepackage{enumitem}
\\usepackage{xcolor}
\\usepackage{textcomp}
\\usepackage[strings]{underscore}
\\setkeys{Gin}{draft=false}
\\DeclareMathOperator{\\cosec}{cosec}
\\DeclareUnicodeCharacter{2220}{\\ensuremath{\\angle}}
\\DeclareUnicodeCharacter{2264}{\\ensuremath{\\leq}}
\\DeclareUnicodeCharacter{2265}{\\ensuremath{\\geq}}
\\DeclareUnicodeCharacter{2260}{\\ensuremath{\\neq}}
\\DeclareUnicodeCharacter{21D2}{\\ensuremath{\\Rightarrow}}
\\DeclareUnicodeCharacter{2192}{\\ensuremath{\\to}}
\\DeclareUnicodeCharacter{2194}{\\ensuremath{\\leftrightarrow}}
\\DeclareUnicodeCharacter{00D7}{\\ensuremath{\\times}}
\\DeclareUnicodeCharacter{00F7}{\\ensuremath{\\div}}
\\DeclareUnicodeCharacter{2212}{\\ensuremath{-}}
\\DeclareUnicodeCharacter{03C0}{\\ensuremath{\\pi}}
\\DeclareUnicodeCharacter{03B1}{\\ensuremath{\\alpha}}
\\DeclareUnicodeCharacter{03B2}{\\ensuremath{\\beta}}
\\DeclareUnicodeCharacter{03B3}{\\ensuremath{\\gamma}}
\\DeclareUnicodeCharacter{03B4}{\\ensuremath{\\delta}}
\\DeclareUnicodeCharacter{03B8}{\\ensuremath{\\theta}}
\\DeclareUnicodeCharacter{03BB}{\\ensuremath{\\lambda}}
\\DeclareUnicodeCharacter{03BC}{\\ensuremath{\\mu}}
\\DeclareUnicodeCharacter{03C3}{\\ensuremath{\\sigma}}
\\DeclareUnicodeCharacter{03C6}{\\ensuremath{\\phi}}
\\DeclareUnicodeCharacter{03C9}{\\ensuremath{\\omega}}
\\DeclareUnicodeCharacter{0394}{\\ensuremath{\\Delta}}
\\DeclareUnicodeCharacter{03A3}{\\ensuremath{\\Sigma}}
\\DeclareUnicodeCharacter{03A9}{\\ensuremath{\\Omega}}
\\DeclareUnicodeCharacter{221A}{\\ensuremath{\\surd}}
\\DeclareUnicodeCharacter{00B0}{\\ensuremath{^{\\circ}}}
\\DeclareUnicodeCharacter{00B1}{\\ensuremath{\\pm}}
\\DeclareUnicodeCharacter{221E}{\\ensuremath{\\infty}}
\\DeclareUnicodeCharacter{2032}{\\ensuremath{^{\\prime}}}
\\DeclareUnicodeCharacter{2033}{\\ensuremath{^{\\prime\\prime}}}
\\DeclareUnicodeCharacter{2026}{\\ldots}
\\DeclareUnicodeCharacter{2014}{---}
\\DeclareUnicodeCharacter{2013}{--}
\\DeclareUnicodeCharacter{2022}{\\textbullet}
\\DeclareUnicodeCharacter{2208}{\\ensuremath{\\in}}
\\DeclareUnicodeCharacter{2234}{\\ensuremath{\\therefore}}
\\DeclareUnicodeCharacter{22A5}{\\ensuremath{\\perp}}
\\DeclareUnicodeCharacter{2225}{\\ensuremath{\\parallel}}
\\DeclareUnicodeCharacter{00B2}{\\ensuremath{^{2}}}
\\DeclareUnicodeCharacter{00B3}{\\ensuremath{^{3}}}
\\DeclareUnicodeCharacter{00B9}{\\ensuremath{^{1}}}
\\DeclareUnicodeCharacter{00BD}{\\ensuremath{\\frac{1}{2}}}
\\DeclareUnicodeCharacter{00BC}{\\ensuremath{\\frac{1}{4}}}
\\DeclareUnicodeCharacter{00BE}{\\ensuremath{\\frac{3}{4}}}
\\DeclareUnicodeCharacter{2211}{\\ensuremath{\\sum}}
\\DeclareUnicodeCharacter{222B}{\\ensuremath{\\int}}
\\DeclareUnicodeCharacter{2202}{\\ensuremath{\\partial}}
\\DeclareUnicodeCharacter{2207}{\\ensuremath{\\nabla}}
\\DeclareUnicodeCharacter{2282}{\\ensuremath{\\subset}}
\\DeclareUnicodeCharacter{2283}{\\ensuremath{\\supset}}
\\DeclareUnicodeCharacter{2286}{\\ensuremath{\\subseteq}}
\\DeclareUnicodeCharacter{2287}{\\ensuremath{\\supseteq}}
\\DeclareUnicodeCharacter{222A}{\\ensuremath{\\cup}}
\\DeclareUnicodeCharacter{2229}{\\ensuremath{\\cap}}
\\DeclareUnicodeCharacter{2205}{\\ensuremath{\\emptyset}}
\\DeclareUnicodeCharacter{2200}{\\ensuremath{\\forall}}
\\DeclareUnicodeCharacter{2203}{\\ensuremath{\\exists}}
\\DeclareUnicodeCharacter{00AC}{\\ensuremath{\\neg}}
\\DeclareUnicodeCharacter{2227}{\\ensuremath{\\land}}
\\DeclareUnicodeCharacter{2228}{\\ensuremath{\\lor}}
\\setlength{\\parskip}{0.6em}
\\setlength{\\parindent}{0pt}

\\begin{document}
\\begin{center}
{\\LARGE \\textbf{${escapeLatexText(title)}}}\\\\[0.35em]
{\\large ${escapeLatexText(subtitle)}}
\\end{center}
\\vspace{0.5em}
\\hrule
\\vspace{1em}

${body}

\\end{document}`;
};

export async function POST(request: Request) {
  let tempDir: string | undefined;

  try {
    const body = await request.json();
    const questions = Array.isArray(body?.questions) ? (body.questions as ExportQuestion[]) : [];
    const includeSolutions = Boolean(body?.includeSolutions);
    const title = String(body?.title || 'Custom Exam').trim();
    const subtitle = String(body?.subtitle || '').trim();
    const downloadNameBase = String(body?.downloadName || 'custom-exam').trim() || 'custom-exam';

    if (!questions.length) {
      return Response.json({ error: 'At least one question is required to export a PDF' }, { status: 400 });
    }

    const hasQuestionImages = questions.some((question) => {
      const hasDiagram = Boolean(String(question.graph_image_data || '').trim());
      const hasSolutionImage = includeSolutions && Boolean(String(question.sample_answer_image || '').trim());
      const hasMcqOptionImage = [
        question.mcq_option_a_image,
        question.mcq_option_b_image,
        question.mcq_option_c_image,
        question.mcq_option_d_image,
      ].some((source) => Boolean(String(source || '').trim()));
      return hasDiagram || hasSolutionImage || hasMcqOptionImage;
    });

    const safeBase = downloadNameBase.replace(/[^a-z0-9\-_.]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const filename = `${safeBase || 'custom-exam'}${includeSolutions ? '-with-solutions' : ''}.pdf`;

    let pdfBuffer: Buffer;
    let imagesOmittedInFallback = false;
    let usedApiFallback = false;
    let usedPlainTextFallback = false;
    let apiFallbackImageStats: { mode: 'ytotech' | 'generic'; referenced: number; attached: number } | null = null;
    try {
      try {
        await access(PDFLATEX_PATH, constants.X_OK);
      } catch (missingPdflatexError) {
        if (IS_VERCEL_RUNTIME) {
          console.warn(
            `[export-exam-pdf] Local pdflatex not found on Vercel at "${PDFLATEX_PATH}"; using API fallback via LATEX_TO_PDF_API_URL.`
          );
        } else {
          console.warn(
            `[export-exam-pdf] Local pdflatex not found at "${PDFLATEX_PATH}"; using API fallback via LATEX_TO_PDF_API_URL.`
          );
        }
        const sentinel = new Error(LOCAL_PDFLATEX_MISSING_SENTINEL);
        (sentinel as Error & { cause?: unknown }).cause = missingPdflatexError;
        throw sentinel;
      }

      tempDir = await mkdtemp(path.join(os.tmpdir(), 'export-exam-'));
      const texPath = path.join(tempDir, LOCAL_TEX_FILENAME);
      const pdfPath = path.join(tempDir, 'exam.pdf');

      const questionsWithAssets = await attachQuestionImageAssets(questions, tempDir, includeSolutions);
      const tex = buildExamLatex({
        title,
        subtitle,
        includeSolutions,
        questions: questionsWithAssets,
      });

      await writeFile(texPath, tex, 'utf8');

      try {
        await execFileAsync(PDFLATEX_PATH, [
          '-interaction=nonstopmode',
          '-file-line-error',
          '-halt-on-error',
          '-output-directory',
          tempDir,
          LOCAL_TEX_FILENAME,
        ], { cwd: tempDir, timeout: PDF_COMPILE_TIMEOUT_MS });
      } catch (compileError: any) {
        // Retry with LaTeX-preserving safe mode for malformed OCR fragments.
        const safeTex = buildExamLatex({
          title,
          subtitle,
          includeSolutions,
          questions: questionsWithAssets,
          compileSafeMode: true,
        });
        await writeFile(texPath, safeTex, 'utf8');
        try {
          await execFileAsync(PDFLATEX_PATH, [
            '-interaction=nonstopmode',
            '-file-line-error',
            '-halt-on-error',
            '-output-directory',
            tempDir,
            LOCAL_TEX_FILENAME,
          ], { cwd: tempDir, timeout: PDF_COMPILE_TIMEOUT_MS });
        } catch (safeCompileError: any) {
          if (ENABLE_PLAIN_TEXT_PDF_FALLBACK) {
            const plainTex = buildExamLatex({
              title,
              subtitle,
              includeSolutions,
              questions: questionsWithAssets,
              compileSafeMode: true,
              plainTextMode: true,
            });
            usedPlainTextFallback = true;
            await writeFile(texPath, plainTex, 'utf8');
            try {
              await execFileAsync(PDFLATEX_PATH, [
                '-interaction=nonstopmode',
                '-file-line-error',
                '-halt-on-error',
                '-output-directory',
                tempDir,
                LOCAL_TEX_FILENAME,
              ], { cwd: tempDir, timeout: PDF_COMPILE_TIMEOUT_MS });
            } catch {
              const stderr = String(safeCompileError?.stderr || compileError?.stderr || '').trim();
              const stdout = String(safeCompileError?.stdout || compileError?.stdout || '').trim();
              let logTail = '';
              try {
                const logPath = path.join(tempDir, 'exam.log');
                const logRaw = await readFile(logPath, 'utf8');
                logTail = extractLatexErrorContext(logRaw);
              } catch {
                // ignore log extraction failures
              }
              const details = composePdflatexDiagnostic({ stderr, stdout, logTail }) || String(safeCompileError || compileError);
                const lineNumber = extractTexLineNumber(details);
                const texContext = lineNumber ? await readTexContext(texPath, lineNumber) : '';
                const diagnostic = texContext ? `${details}\n\n--- exam.tex context ---\n${texContext}` : details;
                throw new Error(`pdflatex failed: ${truncateDiagnostic(diagnostic)}`);
            }
          } else {
            const stderr = String(safeCompileError?.stderr || compileError?.stderr || '').trim();
            const stdout = String(safeCompileError?.stdout || compileError?.stdout || '').trim();
            let logTail = '';
            try {
              const logPath = path.join(tempDir, 'exam.log');
              const logRaw = await readFile(logPath, 'utf8');
              logTail = extractLatexErrorContext(logRaw);
            } catch {
              // ignore log extraction failures
            }
            const details = composePdflatexDiagnostic({ stderr, stdout, logTail }) || String(safeCompileError || compileError);
              const lineNumber = extractTexLineNumber(details);
              const texContext = lineNumber ? await readTexContext(texPath, lineNumber) : '';
              const diagnostic = texContext ? `${details}\n\n--- exam.tex context ---\n${texContext}` : details;
              throw new Error(`pdflatex failed after LaTeX-safe retries: ${truncateDiagnostic(diagnostic)}`);
          }
        }
      }

      pdfBuffer = await readFile(pdfPath);
    } catch (localCompileError: any) {
      usedApiFallback = true;
      const localCompileMessage = String(localCompileError?.message || '');
      const localCompileDiagnostic = truncateDiagnostic(localCompileMessage || String(localCompileError || ''));
      if (localCompileMessage === LOCAL_PDFLATEX_MISSING_SENTINEL) {
        console.warn('[export-exam-pdf] Skipping local compile because pdflatex is unavailable; proceeding with LATEX_TO_PDF_API_URL fallback.');
      } else {
        console.warn('[export-exam-pdf] Local pdflatex failed, falling back to LATEX_TO_PDF_API_URL when possible', localCompileError);
      }
      const isYtoTechApi = LATEX_TO_PDF_API_MODE === 'ytotech' || LATEX_TO_PDF_API_URL.includes('latex.ytotech.com/builds/sync');
      const fallbackImageStats: { mode: 'ytotech' | 'generic'; referenced: number; attached: number } = {
        mode: isYtoTechApi ? 'ytotech' : 'generic',
        referenced: 0,
        attached: 0,
      };
      apiFallbackImageStats = fallbackImageStats;
      if (hasQuestionImages && !isYtoTechApi) {
        imagesOmittedInFallback = true;
        console.warn('[export-exam-pdf] Embedded images are omitted in API fallback unless using YtoTech multipart endpoint.');
      }

      let apiQuestions: ExportQuestion[] = questions;
      if (hasQuestionImages && isYtoTechApi) {
        if (!tempDir) {
          tempDir = await mkdtemp(path.join(os.tmpdir(), 'export-exam-'));
        }
        apiQuestions = await attachQuestionImageAssets(questions, tempDir, includeSolutions);
      }

      const compileViaLatexApi = async (texInput: string, questionsWithAssets?: ExportQuestion[]) => {
        const queryParams = new URLSearchParams({
          command: 'pdflatex',
          force: 'true',
          download: filename,
        });
        const postUrlWithQuery = `${LATEX_TO_PDF_API_URL}${LATEX_TO_PDF_API_URL.includes('?') ? '&' : '?'}${queryParams.toString()}`;
        const postUrl = isYtoTechApi ? LATEX_TO_PDF_API_URL : postUrlWithQuery;

        const parsePdfResponse = async (response: Response) => {
          if (!response.ok) {
            const details = await response.text().catch(() => 'LaTeX API request failed');
            throw new Error(`LaTeX API error (${response.status}): ${details}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          const pdf = Buffer.from(arrayBuffer);
          if (!isPdfBuffer(pdf)) {
            throw new Error(`LaTeX API returned non-PDF payload: ${safeUtf8Preview(pdf)}`);
          }
          return pdf;
        };

        const postAttempts: Array<{ name: string; init: RequestInit }> = [];

        if (isYtoTechApi) {
          const resources: Array<Record<string, unknown>> = [
            {
              main: true,
              path: 'main.tex',
              content: texInput,
            },
          ];

          if (questionsWithAssets && tempDir) {
            const assetNames = getReferencedAssetFilenames(questionsWithAssets);
            fallbackImageStats.referenced = assetNames.length;
            const missingAssets: string[] = [];
            for (const assetName of assetNames) {
              try {
                const fullPath = path.join(tempDir, assetName);
                const data = await readFile(fullPath);
                resources.push({
                  path: assetName,
                  content: data.toString('base64'),
                  encoding: 'base64',
                });
                fallbackImageStats.attached += 1;
              } catch {
                missingAssets.push(assetName);
              }
            }
            if (missingAssets.length) {
              throw new Error(`Failed to attach ${missingAssets.length} image resource(s) for API fallback: ${missingAssets.join(', ')}`);
            }
          }

          postAttempts.push({
            name: 'ytotech-json-resources',
            init: {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                compiler: 'pdflatex',
                resources,
                options: {
                  compiler: {
                    halt_on_error: true,
                    silent: false,
                  },
                  response: {
                    log_files_on_failure: true,
                  },
                },
              }),
            },
          });

          const form = new FormData();
          form.set('compiler', 'pdflatex');
          form.set('main', 'main.tex');
          const mainFile = new File([texInput], 'main.tex', { type: 'application/x-tex' });
          form.append('resources[]', mainFile);
          form.append('resources', mainFile);

          if (questionsWithAssets && tempDir) {
            const assetNames = getReferencedAssetFilenames(questionsWithAssets);
            for (const assetName of assetNames) {
              try {
                const fullPath = path.join(tempDir, assetName);
                const data = await readFile(fullPath);
                const ext = detectImageExt(assetName);
                const mime = ext === 'jpg' ? 'image/jpeg' : 'image/png';
                const file = new File([data], assetName, { type: mime });
                form.append('resources[]', file);
                form.append('resources', file);
              } catch {
                // json-resources path above is authoritative; multipart is best-effort fallback
              }
            }
          }

          postAttempts.push({
            name: 'multipart-ytotech',
            init: {
              method: 'POST',
              body: form,
            },
          });
        }

        postAttempts.push(
          {
            name: 'form-urlencoded',
            init: {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ text: texInput }).toString(),
            },
          },
          {
            name: 'json',
            init: {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: texInput, command: 'pdflatex', force: true, download: filename }),
            },
          },
          {
            name: 'text-plain',
            init: {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
              body: texInput,
            },
          }
        );

        const postUnsupportedStatuses = new Set([404, 405, 415]);
        let lastPostError = '';

        for (const attempt of postAttempts) {
          const response = await fetchWithTimeout(postUrl, attempt.init, PDF_COMPILE_TIMEOUT_MS);
          if (response.ok) {
            return parsePdfResponse(response);
          }

          if (postUnsupportedStatuses.has(response.status)) {
            lastPostError = `${attempt.name} unsupported (${response.status})`;
            continue;
          }

          const details = await response.text().catch(() => 'LaTeX API request failed');
          throw new Error(`LaTeX API error (${response.status}) on ${attempt.name}: ${details}`);
        }

        if (texInput.length > MAX_GET_TEX_LENGTH) {
          throw new Error(`LaTeX API POST not supported (${lastPostError || 'unknown'}), and payload is too large for GET fallback (${texInput.length} chars > ${MAX_GET_TEX_LENGTH}). Configure LATEX_TO_PDF_API_URL to a POST-capable compiler endpoint (for example https://latex.ytotech.com/builds/sync with LATEX_TO_PDF_API_MODE=ytotech).`);
        }

        const getParams = new URLSearchParams({
          text: texInput,
          command: 'pdflatex',
          force: 'true',
          download: filename,
        });
        const getResponse = await fetchWithTimeout(`${LATEX_TO_PDF_API_URL}?${getParams.toString()}`, {}, PDF_COMPILE_TIMEOUT_MS);
        return parsePdfResponse(getResponse);
      };

      const tex = buildExamLatex({
        title,
        subtitle,
        includeSolutions,
        questions: apiQuestions,
      });

      try {
        pdfBuffer = await compileViaLatexApi(tex, apiQuestions);
        if (apiFallbackImageStats) {
          console.warn(
            `[export-exam-pdf] API fallback compile mode=${apiFallbackImageStats.mode}; image resources attached ${apiFallbackImageStats.attached}/${apiFallbackImageStats.referenced}.`
          );
        }
      } catch (apiCompileError: any) {
        console.warn('[export-exam-pdf] API compile failed, retrying LaTeX-preserving safe mode', apiCompileError);
        const safeTex = buildExamLatex({
          title,
          subtitle,
          includeSolutions,
          questions: apiQuestions,
          compileSafeMode: true,
        });
        try {
          pdfBuffer = await compileViaLatexApi(safeTex, apiQuestions);
        } catch (apiSafeCompileError: any) {
          if (ENABLE_PLAIN_TEXT_PDF_FALLBACK) {
            console.warn('[export-exam-pdf] API safe-mode compile failed, retrying plain-text mode', apiSafeCompileError);
            const plainTex = buildExamLatex({
              title,
              subtitle,
              includeSolutions,
              questions: apiQuestions,
              compileSafeMode: true,
              plainTextMode: true,
            });
            usedPlainTextFallback = true;
            pdfBuffer = await compileViaLatexApi(plainTex, apiQuestions);
          } else {
            const apiMessage = String(apiSafeCompileError?.message || apiSafeCompileError);
            throw new Error(
              `API compile failed after LaTeX-safe retries: ${apiMessage}\n\nLocal pdflatex diagnostic:\n${localCompileDiagnostic}`
            );
          }
        }
        if (apiFallbackImageStats) {
          console.warn(
            `[export-exam-pdf] API fallback compile-safe mode=${apiFallbackImageStats.mode}; image resources attached ${apiFallbackImageStats.attached}/${apiFallbackImageStats.referenced}.`
          );
        }
      }
    }

    const pdfBody = new Uint8Array(pdfBuffer);

    return new Response(pdfBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        ...(usedApiFallback ? { 'X-PDF-Compile-Mode': 'api-fallback' } : {}),
        ...(usedPlainTextFallback ? { 'X-PDF-Compile-Warning': 'plain-text-fallback-used' } : {}),
        ...(imagesOmittedInFallback ? { 'X-PDF-Warning': 'Images omitted: local pdflatex unavailable on host runtime' } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[export-exam-pdf] Error:', message);
    const actionable = message.includes('question images/diagrams')
      ? `${message} Set PDFLATEX_PATH to a valid binary (for example /usr/bin/pdflatex) or install TeX Live on the server.`
      : message;
    return Response.json(
      { error: 'Failed to export exam PDF', details: actionable },
      { status: 500 }
    );
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

/* ------------------------------------------------------------------ */
/*  GET  /api/hsc/export-exam-pdf                                     */
/*  Diagnostic endpoint: fetch questions from the database, build     */
/*  LaTeX in all three modes, and report whether each mode succeeded. */
/* ------------------------------------------------------------------ */

const DIAG_SAMPLE_SIZE = 20;

const countUnbalancedBraces = (value: string) => {
  let open = 0;
  const chars = Array.from(value);
  for (let i = 0; i < chars.length; i += 1) {
    if (isEscapedAt(chars, i)) continue;
    if (chars[i] === '{') open += 1;
    if (chars[i] === '}') open -= 1;
  }
  return open;
};

const HANDLED_UNICODE_CODEPOINTS = new Set([
  0x2220, 0x2264, 0x2265, 0x2260, 0x21D2, 0x2192, 0x2194, 0x00D7, 0x00F7,
  0x03C0, 0x03B1, 0x03B2, 0x03B3, 0x03B4, 0x03B8, 0x03BB, 0x03BC, 0x03C3,
  0x03C6, 0x03C9, 0x0394, 0x03A3, 0x03A9, 0x221A, 0x2212, 0x221E, 0x2032,
  0x2033, 0x2026, 0x2014, 0x2013, 0x201C, 0x201D, 0x2018, 0x2019, 0x2022,
  0x2208, 0x2234, 0x22A5, 0x2225, 0x2211, 0x222B, 0x2202, 0x2207, 0x2282,
  0x2283, 0x2286, 0x2287, 0x222A, 0x2229, 0x2205, 0x2200, 0x2203, 0x2227,
  0x2228, 0x00B0, 0x00B1, 0x00B2, 0x00B3, 0x00B9, 0x00AC, 0x00BD, 0x00BC,
  0x00BE,
]);

const detectProblematicUnicode = (value: string) => {
  // Match characters outside Basic Latin, Latin-1 Supplement, and common LaTeX-safe ranges
  // that are NOT already handled by our normalizeLatexBody replacements.
  const suspicious: Array<{ char: string; code: string; position: number }> = [];
  for (let i = 0; i < value.length; i += 1) {
    const code = value.codePointAt(i);
    if (code === undefined) continue;
    // Skip ASCII, Latin-1 Supplement (handled by T1 encoding), and common whitespace
    if (code <= 0x00FF) continue;
    // Skip characters that our normalizeLatexBody already handles
    if (HANDLED_UNICODE_CODEPOINTS.has(code)) continue;
    suspicious.push({ char: value[i], code: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`, position: i });
    // For surrogate pairs
    if (code > 0xFFFF) i += 1;
  }
  return suspicious;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || DIAG_SAMPLE_SIZE), 1), 100);
    const questionType = searchParams.get('type') || null;
    const grade = searchParams.get('grade') || null;
    const subject = searchParams.get('subject') || null;

    // 1. Fetch sample questions from database
    let query = supabaseAdmin
      .from('hsc_questions')
      .select('id, question_number, question_text, question_type, marks, topic, subject, grade, year, sample_answer, marking_criteria, mcq_option_a, mcq_option_b, mcq_option_c, mcq_option_d, mcq_correct_answer, mcq_explanation, graph_image_data, graph_image_size, sample_answer_image, sample_answer_image_size')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (questionType) query = query.eq('question_type', questionType);
    if (grade) query = query.eq('grade', grade);
    if (subject) query = query.eq('subject', subject);

    const { data: questions, error: dbError } = await query;

    if (dbError) {
      return Response.json(
        { error: 'Database query failed', details: dbError.message },
        { status: 500 }
      );
    }

    if (!questions || questions.length === 0) {
      return Response.json(
        { error: 'No questions found in database', hint: 'Check that hsc_questions table has data and DATABASE_URL is set.' },
        { status: 404 }
      );
    }

    // 2. Build LaTeX in three modes and collect diagnostics
    const diagResults: Array<{
      id: string;
      question_number: string | null;
      subject: string | null;
      topic: string | null;
      modes: Record<string, { success: boolean; error?: string; texLength?: number }>;
      warnings: string[];
    }> = [];

    const castQuestions = questions as ExportQuestion[];

    for (const question of castQuestions) {
      const entry: (typeof diagResults)[number] = {
        id: String((question as Record<string, unknown>).id || ''),
        question_number: question.question_number ?? null,
        subject: (question as Record<string, unknown>).subject as string | null,
        topic: question.topic ?? null,
        modes: {},
        warnings: [],
      };

      // Check raw text for issues
      const rawText = String(question.question_text || '');
      const rawAnswer = String(question.sample_answer || '');
      const combinedRaw = `${rawText}\n${rawAnswer}`;

      const problematicChars = detectProblematicUnicode(combinedRaw);
      if (problematicChars.length > 0) {
        const sample = problematicChars.slice(0, 5).map((c) => `${c.char} (${c.code})`).join(', ');
        entry.warnings.push(`Found ${problematicChars.length} potentially problematic Unicode char(s): ${sample}`);
      }

      // Test each mode
      const modes: Array<{ name: string; compileSafeMode: boolean; plainTextMode: boolean }> = [
        { name: 'normal', compileSafeMode: false, plainTextMode: false },
        { name: 'safe', compileSafeMode: true, plainTextMode: false },
        { name: 'plainText', compileSafeMode: true, plainTextMode: true },
      ];

      for (const mode of modes) {
        try {
          const tex = buildExamLatex({
            title: 'Diagnostic Test',
            subtitle: `Question ${question.question_number || 'unknown'}`,
            includeSolutions: true,
            questions: [question],
            compileSafeMode: mode.compileSafeMode,
            plainTextMode: mode.plainTextMode,
          });

          const braceBalance = countUnbalancedBraces(tex);
          if (braceBalance !== 0) {
            entry.warnings.push(`[${mode.name}] Unbalanced braces: ${braceBalance > 0 ? `${braceBalance} unclosed` : `${-braceBalance} extra closing`}`);
          }

          entry.modes[mode.name] = { success: true, texLength: tex.length };
        } catch (err) {
          entry.modes[mode.name] = {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      diagResults.push(entry);
    }

    // 3. Try building a full exam with all questions
    let fullExamDiag: { success: boolean; texLength?: number; error?: string; braceBalance?: number } = { success: false };
    try {
      const fullTex = buildExamLatex({
        title: 'Full Diagnostic Exam',
        subtitle: `${questions.length} questions from database`,
        includeSolutions: true,
        questions: castQuestions,
      });
      const braceBalance = countUnbalancedBraces(fullTex);
      fullExamDiag = { success: true, texLength: fullTex.length, braceBalance };
    } catch (err) {
      fullExamDiag = { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    // 4. Optionally compile if pdflatex is available
    const compileTest: { available: boolean; success?: boolean; error?: string } = { available: false };
    try {
      await access(PDFLATEX_PATH, constants.X_OK);
      compileTest.available = true;

      // Only compile if requested (to avoid slow diagnostic calls)
      if (searchParams.get('compile') === 'true') {
        let compileTempDir: string | undefined;
        try {
          compileTempDir = await mkdtemp(path.join(os.tmpdir(), 'diag-exam-'));
          const texPath = path.join(compileTempDir, LOCAL_TEX_FILENAME);
          const tex = buildExamLatex({
            title: 'Compile Test',
            subtitle: `${questions.length} questions`,
            includeSolutions: false,
            questions: castQuestions,
          });
          await writeFile(texPath, tex, 'utf8');
          await execFileAsync(PDFLATEX_PATH, [
            '-interaction=nonstopmode',
            '-file-line-error',
            '-halt-on-error',
            '-output-directory',
            compileTempDir,
            LOCAL_TEX_FILENAME,
          ], { cwd: compileTempDir, timeout: PDF_COMPILE_TIMEOUT_MS });
          compileTest.success = true;
        } catch (compileErr) {
          compileTest.success = false;
          compileTest.error = compileErr instanceof Error ? compileErr.message : String(compileErr);
        } finally {
          if (compileTempDir) {
            await rm(compileTempDir, { recursive: true, force: true });
          }
        }
      }
    } catch {
      compileTest.available = false;
    }

    // 5. Summary stats
    const totalQuestions = diagResults.length;
    const allNormalOk = diagResults.every((r) => r.modes.normal?.success);
    const allSafeOk = diagResults.every((r) => r.modes.safe?.success);
    const allPlainOk = diagResults.every((r) => r.modes.plainText?.success);
    const questionsWithWarnings = diagResults.filter((r) => r.warnings.length > 0);

    return Response.json({
      summary: {
        questionsAnalyzed: totalQuestions,
        allNormalModeOk: allNormalOk,
        allSafeModeOk: allSafeOk,
        allPlainTextModeOk: allPlainOk,
        questionsWithWarnings: questionsWithWarnings.length,
        fullExamBuild: fullExamDiag,
        pdflatex: compileTest,
      },
      questions: diagResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[export-exam-pdf-diag] Error:', message);
    return Response.json(
      { error: 'Diagnostic failed', details: message },
      { status: 500 }
    );
  }
}
