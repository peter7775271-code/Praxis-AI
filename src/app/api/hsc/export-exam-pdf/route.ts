import { access, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { execFile } from 'child_process';
import { constants } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

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

const decodeEscapedNewlineTokens = (value: string) =>
  String(value || '')
    // Convert explicit double-escaped sequences first (\\n -> newline).
    .replace(/\\\\n/g, '\n')
    // Convert single escaped newline tokens only when they are not LaTeX commands.
    // This avoids corrupting commands like \neq or \noindent.
    .replace(/\\n(?![a-z])/g, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\r(?![a-z])/g, '\n');

const normalizeEscapedLatexArtifacts = (value: string) =>
  decodeEscapedNewlineTokens(value)
    // OCR/model output sometimes emits \[4pt] as a line break. In LaTeX this is
    // a display-math opener; line breaks require \\[...]. Repair only length-like payloads.
    .replace(/(?<!\\)\\\[\s*(-?[0-9]+(?:\.[0-9]+)?\s*(?:pt|mm|cm|in|ex|em|bp|pc|dd|cc|sp))\s*\]/gi, (_match, length) => `\\\\[${String(length).trim()}]`)
    // Recover JSON-escaped inline math delimiters that arrive as \\( and \\).
    .replace(/\\\\\(/g, '\\(')
    .replace(/\\\\\)/g, '\\)')
    // Recover commands that were escaped as \{}command in degraded output paths.
    .replace(/\\\{\}\s*([A-Za-z]+)/g, '\\$1')
    .replace(/\\\{\}\s*([!,:;])/g, '\\$1')
    // Normalize uncommon Arg commands to a compile-safe operator form.
    .replace(/\\Arg\b/g, '\\operatorname{Arg}')
    .replace(/\\arg\b/g, '\\operatorname{arg}')
    // Repair malformed \left/\right tokens only when the delimiter is truly missing.
    // Do not touch valid delimiters like \left\{, \left(, \right\}, etc.
    .replace(/\\left(?=\s*(?:\\\]|\\\)|\\end\{|$))/g, '\\left.')
    .replace(/\\right(?=\s*(?:\\\]|\\\)|\\end\{|$))/g, '\\right.')
    .replace(/\\dfrac/g, '\\frac')
    // Repair fused command pairs from OCR/model output, e.g. \pidisplaystyle -> \pi\displaystyle.
    .replace(/\\(pi|alpha|beta|gamma|delta|theta|lambda|mu|sigma|phi|omega)(displaystyle|textstyle)\b/g, '\\$1\\$2')
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
        'multirow', 'multicolumn',
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

const normalizeGreekWordTokens = (value: string) =>
  String(value || '')
    .replace(/(?<!\\)\btheta\b/gi, '\\theta')
    .replace(/(?<!\\)\bpi\b/gi, '\\pi');

const ENSUREMATH_PREFIX_LENGTH = '\\ensuremath{'.length;
// Allow for minor spacing/noise between prefix and token in generated fragments
// (e.g., whitespace/newlines and small formatting tokens inserted by cleanup steps).
// 24 chars covers common cases seen in generated content (newlines/indent + short tokens),
// while keeping the lookback bounded for performance.
const ENSUREMATH_NOISE_LOOKBACK = 24;
const ENSUREMATH_PREFIX_LOOKBACK = ENSUREMATH_PREFIX_LENGTH + ENSUREMATH_NOISE_LOOKBACK;
const BARE_MATH_COMMAND_PATTERN = /\\(?:Rightarrow|leftrightarrow|to|perp|boxed|prime|not|mid|stackrel)(?![A-Za-z])/g;

const wrapBareMathCommandsOutsideMath = (value: string) =>
  String(value || '').replace(BARE_MATH_COMMAND_PATTERN, (match, offset, source) => {
    if (source.slice(Math.max(0, offset - ENSUREMATH_PREFIX_LOOKBACK), offset).endsWith('\\ensuremath{')) return match;
    if (isInsideMathAt(source, offset)) return match;
    return `\\ensuremath{${match}}`;
  });

/** Convert malformed \left\{ ... \right. piecewise blocks into a proper cases environment. */
const normalizeMalformedPiecewiseBlocks = (value: string) =>
  String(value || '').replace(/\\left\\\{([\s\S]*?)\\right\./g, (_match, rawBody: string) => {
    const body = String(rawBody || '');
    if (/\\begin\{(?:cases|dcases|rcases|drcases|array|aligned)\}/.test(body)) {
      return _match;
    }

    const compact = body
      // Common OCR breakage: split "2" and "theta" across two lines.
      .replace(/([0-9])\s*\n\s*(\\?[A-Za-z])/g, '$1 $2')
      .replace(/\n{3,}/g, '\n\n');

    const sourceLines = compact
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (sourceLines.length < 2) return _match;

    const mergedLines: string[] = [];
    for (let index = 0; index < sourceLines.length; index += 1) {
      const line = sourceLines[index];
      if (/^[+-]?\d+(?:\.\d+)?$/.test(line) && index + 1 < sourceLines.length) {
        sourceLines[index + 1] = `${line} ${sourceLines[index + 1]}`.trim();
        continue;
      }
      mergedLines.push(line);
    }

    const rows: string[] = [];
    for (const line of mergedLines) {
      const cleaned = line.replace(/[.;]\s*$/, '').trim();
      if (!cleaned) continue;

      const split = cleaned.match(/^(.+?),\s*(.+)$/);
      if (split) {
        const expr = normalizeGreekWordTokens(split[1].trim());
        const cond = normalizeGreekWordTokens(split[2].trim());
        rows.push(`${expr} & ${cond} \\\\`);
      } else {
        rows.push(`${normalizeGreekWordTokens(cleaned)} \\\\`);
      }
    }

    if (rows.length < 2) return _match;

    return `\\begin{cases}\n${rows.join('\n')}\n\\end{cases}`;
  });

/** Inside matrix environments, repair single-backslash + letter that should be \\ (row separator). */
const repairMatrixRowSeparators = (value: string) =>
  value.replace(
    /\\begin\{([pbBvV]?matrix|smallmatrix)\}([\s\S]*?)\\end\{\1\}/g,
    (_match, env: string, body: string) => {
      const repaired = body
        // Single-backslash + letter inside matrix body is usually a broken row separator.
        .replace(/(?<!\\)\\([a-zA-Z])(?![a-zA-Z])/g, (_m, letter) => `\\\\${letter}`)
        // Repair single-backslash row separators before signed command-leading entries (e.g. \-\sqrt6).
        .replace(/(?<!\\)\\(?=\s*[-+]\s*\\[A-Za-z])/g, '\\\\')
        // Also repair single-backslash row separators before numeric/sign-leading entries.
        .replace(/(?<!\\)\\(?=\s*[-+]?\d)/g, '\\\\');
      return `\\begin{${env}}${repaired}\\end{${env}}`;
    }
  );

/** In array/tabular-like environments, repair single-backslash row endings before rules/line breaks. */
const repairTableRowSeparators = (value: string) =>
  value.replace(
    /\\begin\{(array|tabular\*?|tabularx|longtable)\}(\[[^\]]*\])?(\{[^}]*\})?([\s\S]*?)\\end\{\1\}/g,
    (_match, env: string, optArg: string, colSpec: string, body: string) => {
      const repaired = String(body || '')
        // A lone backslash before \hline/\cline/\end is almost always a broken row separator.
        .replace(/(?<!\\)\\(?=\s*\\(?:hline|cline|end\{))/g, '\\\\')
        // Also repair lone row-ending backslashes before a newline when the row contains table alignment.
        .replace(/(^|[^\\])\\(?=\s*\n)/gm, (rowMatch) => {
          return `${rowMatch.slice(0, -1)}\\\\`;
        });
      const optional = optArg || '';
      const columns = colSpec || '';
      return `\\begin{${env}}${optional}${columns}${repaired}\\end{${env}}`;
    }
  );

/** Inside cases-like environments, repair lone row-ending backslashes to \\ separators. */
const repairCasesRowSeparators = (value: string) =>
  value.replace(
    /\\begin\{(cases|dcases|rcases|drcases)\}([\s\S]*?)\\end\{\1\}/g,
    (_match, env: string, body: string) => {
      const repaired = String(body || '')
        // Common OCR/model breakage: a single trailing backslash before newline.
        .replace(/(^|[^\\])\\(?=\s*\n)/gm, (rowMatch) => `${rowMatch.slice(0, -1)}\\\\`)
        // Also repair single row-ending backslashes before a following aligned entry (contains &).
        .replace(/(^|[^\\])\\(?=\s*[^\n]*&)/gm, (rowMatch) => `${rowMatch.slice(0, -1)}\\\\`);
      return `\\begin{${env}}${repaired}\\end{${env}}`;
    }
  );

const wrapParenthesizedMathLikeSegments = (value: string) =>
  value.replace(/(^|[\s,:;])\(([^()\n]*\\(?:d?frac|sqrt)[^()\n]*)\)/g, (_match, prefix, expr) => {
    const candidate = String(expr || '').trim();
    if (!candidate) return _match;
    return `${prefix}\\(${candidate}\\)`;
  });

const sanitizeMisplacedTableRules = (value: string) => {
  const tableLikeEnvironments = new Set(['tabular', 'tabular*', 'array', 'tabularx', 'longtable']);
  let tableDepth = 0;

  return value.replace(/\\begin\{([^}]+)\}|\\end\{([^}]+)\}|\\hline\b/g, (token, beginEnv, endEnv) => {
    if (beginEnv) {
      if (tableLikeEnvironments.has(String(beginEnv).trim())) {
        tableDepth += 1;
      }
      return token;
    }

    if (endEnv) {
      if (tableLikeEnvironments.has(String(endEnv).trim())) {
        tableDepth = Math.max(0, tableDepth - 1);
      }
      return token;
    }

    return tableDepth > 0 ? token : '';
  });
};

const countUnescapedAmpersands = (line: string) => {
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== '&') continue;
    if (index > 0 && line[index - 1] === '\\') continue;
    count += 1;
  }
  return count;
};

const convertPlainAmpersandTables = (value: string) => {
  const lines = String(value || '').split(/\r?\n/);
  const converted: string[] = [];
  let index = 0;
  const guardedEnvironments = new Set([
    'array', 'tabular', 'tabular*', 'tabularx', 'longtable',
    'align', 'align*', 'aligned', 'alignedat', 'alignedat*',
    'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'smallmatrix',
    'cases', 'split',
  ]);
  let guardedDepth = 0;

  const updateGuardedDepth = (line: string) => {
    const normalizedLine = String(line || '');
    const tokenRegex = /\\begin\{([^}]+)\}|\\end\{([^}]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(normalizedLine))) {
      const beginEnv = String(match[1] || '').trim();
      const endEnv = String(match[2] || '').trim();
      if (beginEnv && guardedEnvironments.has(beginEnv)) {
        guardedDepth += 1;
        continue;
      }
      if (endEnv && guardedEnvironments.has(endEnv)) {
        guardedDepth = Math.max(0, guardedDepth - 1);
      }
    }
  };

  const isPlainTableRow = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('\\')) return false;
    if (/\b(begin|end)\{/.test(trimmed)) return false;
    const ampCount = countUnescapedAmpersands(trimmed);
    return ampCount >= 1;
  };

  while (index < lines.length) {
    const currentLine = lines[index];
    if (guardedDepth > 0 || !isPlainTableRow(currentLine)) {
      converted.push(currentLine);
      updateGuardedDepth(currentLine);
      index += 1;
      continue;
    }

    const blockStart = index;
    while (index < lines.length && isPlainTableRow(lines[index])) {
      index += 1;
    }

    const block = lines.slice(blockStart, index);
    const colCounts = block.map((line) => countUnescapedAmpersands(line) + 1);
    const firstCols = colCounts[0] || 0;
    const allSameCols = firstCols >= 2 && colCounts.every((cols) => cols === firstCols);

    if (block.length >= 2 && allSameCols) {
      const colSpec = `|${Array.from({ length: firstCols }).map(() => 'c').join('|')}|`;
      converted.push(`\\begin{tabular}{${colSpec}}`);
      converted.push('\\hline');
      block.forEach((row, rowIndex) => {
        const cleanedRow = row.trim().replace(/([A-Za-z])\\([A-Za-z])/g, '$1/$2');
        converted.push(`${cleanedRow} \\\\`);
        if (rowIndex === 0) converted.push('\\hline');
      });
      converted.push('\\hline');
      converted.push('\\end{tabular}');
      continue;
    }

    converted.push(...block);
  }

  return converted.join('\n');
};

const escapeAmpersandsOutsideAlignment = (value: string) => {
  const alignmentEnvironments = new Set([
    'array', 'tabular', 'tabular*', 'tabularx', 'longtable',
    'align', 'align*', 'aligned', 'alignedat', 'alignedat*',
    'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'smallmatrix',
    'cases', 'split',
  ]);
  let alignmentDepth = 0;

  return String(value || '').replace(/\\begin\{([^}]+)\}|\\end\{([^}]+)\}|(?<!\\)&/g, (token, beginEnv, endEnv) => {
    if (beginEnv) {
      if (alignmentEnvironments.has(String(beginEnv).trim())) {
        alignmentDepth += 1;
      }
      return token;
    }

    if (endEnv) {
      if (alignmentEnvironments.has(String(endEnv).trim())) {
        alignmentDepth = Math.max(0, alignmentDepth - 1);
      }
      return token;
    }

    return alignmentDepth > 0 ? '&' : '\\&';
  });
};

const normalizeLatexBody = (value: string) =>
  wrapBareMathCommandsOutsideMath(
    escapeAmpersandsOutsideAlignment(
      wrapParenthesizedMathLikeSegments(
        sanitizeMisplacedTableRules(
          normalizeMalformedPiecewiseBlocks(
          repairCasesRowSeparators(
          repairTableRowSeparators(
            repairMatrixRowSeparators(
              convertPlainAmpersandTables(normalizeEscapedLatexArtifacts(applyOcrMathRepairs(stripInvalidControlChars(value))))
            )
          )
          )
          )
        )
        .replace(/\[\[PART_DIVIDER:([^\]]+)\]\]/g, (_match, label) => `\n\n\\noindent\\textbf{(${label})} `)
        .replace(/\\begin\{table\}[\s\S]*?\\end\{table\}/gi, (match) => {
        // Extract the tabular environment from within the table float
        const tabularMatch = match.match(/\\begin\{tabular\}[\s\S]*?\\end\{tabular\}/i);
        if (tabularMatch) {
          // Wrap the tabular in a center environment instead of the float
          return `\\begin{center}\n${tabularMatch[0]}\n\\end{center}`;
        }
        // If no tabular found, just remove the table wrapper and keep its content
        const contentWithoutWrappers = match
          .replace(/\\begin\{table\}[\s\S]*?\{/, '')
          .replace(/\}[\s\S]*?\\end\{table\}/, '');
        return contentWithoutWrappers || '';
      })
      .replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/gi, '')
      .replace(/\\includegraphics\*?\s*(?:\[[^\]]*\])?\s*\{[^}]+\}/gi, '')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/\\graphicspath\{[^}]*\}/gi, '')
      .replace(/\[\s*beginaligned/gi, '')
      .replace(/\[\s*endaligned\s*\]/gi, '')
      .replace(/\bbeginaligned\b/gi, '')
      .replace(/\bendaligned\b/gi, '')
      .replace(/(?<!\\)%/g, '\\%')
      .replace(/\bMARKS_(\d+)\b/g, 'MARKS\\_$1')
      .replace(/\bQUESTION_(\d+)\b/g, 'QUESTION\\_$1')
      .replace(/(^|[\s([\{\-+*/=,:;|])([0-9]*[A-Za-z]+)\^\(([^)]+)\)/g, (_match, prefix, base, powerExpr) => `${prefix}\\ensuremath{${base}^{(${powerExpr})}}`)
      .replace(/(^|[\s([\{\-+*/=,:;|])([0-9]*[A-Za-z]+)\^([A-Za-z])(?![A-Za-z0-9{])/g, (_match, prefix, base, power) => `${prefix}\\ensuremath{${base}^{${power}}}`)
      .replace(/(^|[\s([\{\-+*/=,:;|])([0-9]*[A-Za-z]+)\^([-+]?[0-9]+)(?=\b)/g, (_match, prefix, base, power) => `${prefix}\\ensuremath{${base}^{${power}}}`)
      .replace(/(^|[\s([\{\-+*/=,:;|])(\|[^|\n]+\|)\^\(([^)]+)\)/g, (_match, prefix, base, powerExpr) => `${prefix}\\ensuremath{${base}^{(${powerExpr})}}`)
      .replace(/(^|[\s([\{\-+*/=,:;|])(\|[^|\n]+\|)\^([A-Za-z])(?![A-Za-z0-9{])/g, (_match, prefix, base, power) => `${prefix}\\ensuremath{${base}^{${power}}}`)
      .replace(/(^|[\s([\{\-+*/=,:;|])(\|[^|\n]+\|)\^([-+]?[0-9]+)(?=\b)/g, (_match, prefix, base, power) => `${prefix}\\ensuremath{${base}^{${power}}}`)
      .replace(/(^|[\s([\{\-+*/=,:;|])(\((?:[^()\n]|\([^()\n]*\))+\))\^\(([^)]+)\)/g, (_match, prefix, base, powerExpr) => `${prefix}\\ensuremath{${base}^{(${powerExpr})}}`)
      .replace(/(^|[\s([\{\-+*/=,:;|])(\((?:[^()\n]|\([^()\n]*\))+\))\^([A-Za-z])(?![A-Za-z0-9{])/g, (_match, prefix, base, power) => `${prefix}\\ensuremath{${base}^{${power}}}`)
      .replace(/(^|[\s([\{\-+*/=,:;|])(\((?:[^()\n]|\([^()\n]*\))+\))\^([-+]?[0-9]+)(?=\b)/g, (_match, prefix, base, power) => `${prefix}\\ensuremath{${base}^{${power}}}`)
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
        .replace(/√/g, '\\ensuremath{\\sqrt{}}')
        .trim()
      )
    )
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

const collapseInternalNewlines = (value: string) => {
  // Replace internal newlines and extra whitespace with single spaces.
  // This prevents embedded newlines from breaking LaTeX commands like \right.
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')  // Replace newlines with spaces
    .replace(/\s+/g, ' ')      // Collapse multiple spaces to single space
    .trim();
};

const ensureMathModeForMcqOption = (value: string) => {
  const collapsed = collapseInternalNewlines(value);
  const trimmed = String(collapsed || '').trim();
  if (!trimmed) return '';

  // Leave values that already declare math/text environments untouched.
  if (/^(?:\\\(|\\\[|\$\$?|\\begin\{)/.test(trimmed)) {
    return trimmed;
  }

  const hasStrongMathSignal =
    /\\(?:frac|dfrac|sqrt|left|right|sum|int|prod|lim|sin|cos|tan|sec|cosec|cot|log|ln|exp|pi|alpha|beta|gamma|delta|theta|lambda|mu|sigma|phi|omega|Delta|Sigma|Omega|cdot|times|div|leq|geq|neq|approx|to)\b/.test(trimmed) ||
    /[_^=<>]/.test(trimmed);

  if (!hasStrongMathSignal) {
    return trimmed;
  }

  const longWordMatches = trimmed.match(/[A-Za-z]{3,}/g) || [];
  const hasSentenceLikeWord = longWordMatches.some((word) => {
    const normalized = word.toLowerCase();
    return !['sin', 'cos', 'tan', 'sec', 'cot', 'log', 'ln', 'exp'].includes(normalized);
  });

  if (hasSentenceLikeWord) {
    return trimmed;
  }

  return `\\(${trimmed}\\)`;
};

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
      // Avoid creating nested delimiters like $\(...\)$ when already in math mode.
      if (isInsideMathAt(source, offset)) return match;
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
  escapeAmpersandsOutsideAlignment(
    stripInvalidControlChars(value)
      .replace(/\[\s*([^\]]+)\s*\]/g, (match, candidate, offset, source) => {
        const raw = String(candidate || '').trim();
        if (!raw) return match;
        // Avoid creating nested delimiters like $\(...\)$ when already in math mode.
        if (isInsideMathAt(source, offset)) return match;
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
      .replace(/(?<!\\)_/g, (_match, offset, source) => (isInsideMathAt(source, offset) ? '_' : '\\_'))
      .replace(/(?<!\\)%/g, '\\%')
      .replace(/(?<!\\)#/g, '\\#')
  );

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

const unwrapInlineMathInsideDisplayMath = (value: string) =>
  value
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, body) => {
      const normalizedBody = String(body || '').replace(/\\\(([\s\S]*?)\\\)/g, '$1');
      return `\\[${normalizedBody}\\]`;
    })
    .replace(/\$\$([\s\S]*?)\$\$/g, (_match, body) => {
      const normalizedBody = String(body || '').replace(/\\\(([\s\S]*?)\\\)/g, '$1');
      return `$$${normalizedBody}$$`;
    });

const unwrapParenMathInsideInlineDollar = (value: string) => {
  const source = String(value || '');
  let output = '';
  let index = 0;

  while (index < source.length) {
    const current = source[index];
    if (current !== '$' || isEscapedInStringAt(source, index)) {
      output += current;
      index += 1;
      continue;
    }

    const next = source[index + 1];
    if (next === '$' && !isEscapedInStringAt(source, index + 1)) {
      output += '$$';
      index += 2;
      continue;
    }

    let closingIndex = -1;
    for (let scan = index + 1; scan < source.length; scan += 1) {
      if (source[scan] !== '$' || isEscapedInStringAt(source, scan)) continue;
      const scanNext = source[scan + 1];
      if (scanNext === '$' && !isEscapedInStringAt(source, scan + 1)) continue;
      closingIndex = scan;
      break;
    }

    if (closingIndex === -1) {
      output += source.slice(index);
      break;
    }

    const body = source
      .slice(index + 1, closingIndex)
      .replace(/\\\(([\s\S]*?)\\\)/g, '$1');
    output += `$${body}$`;
    index = closingIndex + 1;
  }

  return output;
};

const balanceMathDelimiters = (value: string) => {
  const chars = Array.from(value);
  let inlineDollarOpen = false;
  let displayDollarOpen = false;
  let parenMathDepth = 0;
  let bracketMathDepth = 0;

  for (let index = 0; index < chars.length; index += 1) {
    const current = chars[index];
    if (current === '\\' && !isEscapedAt(chars, index)) {
      const next = chars[index + 1];
      if (next === '(') {
        parenMathDepth += 1;
        index += 1;
        continue;
      }
      if (next === ')') {
        if (parenMathDepth > 0) parenMathDepth -= 1;
        index += 1;
        continue;
      }
      if (next === '[') {
        bracketMathDepth += 1;
        index += 1;
        continue;
      }
      if (next === ']') {
        if (bracketMathDepth > 0) bracketMathDepth -= 1;
        index += 1;
        continue;
      }
      continue;
    }

    if (current !== '$' || isEscapedAt(chars, index)) continue;
    const next = chars[index + 1];
    if (next === '$' && !isEscapedAt(chars, index + 1)) {
      displayDollarOpen = !displayDollarOpen;
      index += 1;
    } else {
      inlineDollarOpen = !inlineDollarOpen;
    }
  }

  let output = chars.join('');
  if (inlineDollarOpen) output += '\\$';
  if (displayDollarOpen) output += '$$';
  if (parenMathDepth > 0) output += '\\)'.repeat(parenMathDepth);
  if (bracketMathDepth > 0) output += '\\]'.repeat(bracketMathDepth);
  return output;
};

const finalizeCompileSafeBody = (value: string) =>
  neutralizeUnknownLatexCommands(
    balanceMathDelimiters(
      unwrapParenMathInsideInlineDollar(
        unwrapInlineMathInsideDisplayMath(
        normalizeInlineDollarMath(
          balanceLatexBraces(
            normalizeMalformedPiecewiseBlocks(
              repairCasesRowSeparators(
                repairTableRowSeparators(repairMatrixRowSeparators(normalizeEscapedLatexArtifacts(value)))
              )
            )
          )
        )
      )
      )
    )
  );

const SAFE_LATEX_COMMANDS = new Set([
  'frac', 'dfrac', 'sqrt', 'left', 'right', 'cdot', 'times', 'div',
  'circ', 'triangle',
  'le', 'leq', 'ge', 'geq', 'ne', 'neq', 'pm', 'mp', 'infty',
  'sum', 'int', 'lim', 'log', 'ln', 'exp',
  'sin', 'cos', 'tan', 'sec', 'cosec', 'cot', 'operatorname',
  'alpha', 'beta', 'gamma', 'delta', 'theta', 'lambda', 'mu', 'sigma', 'phi', 'omega',
  'pi', 'angle', 'to', 'Rightarrow', 'leftrightarrow', 'approx',
  'perp', 'boxed', 'prime', 'not', 'mid', 'stackrel',
  'in', 'notin', 'subset', 'supset', 'subseteq', 'supseteq', 'cup', 'cap',
  'exists', 'forall', 'implies', 'iff', 'neg', 'land', 'lor',
  'Delta', 'Sigma', 'Omega',
  'vec', 'overrightarrow', 'overleftarrow', 'overline', 'underline',
  'hat', 'bar', 'dot', 'ddot', 'tilde', 'widehat', 'widetilde',
  'bigl', 'bigr', 'Bigl', 'Bigr', 'biggl', 'biggr', 'Biggl', 'Biggr',
  'overbrace', 'underbrace', 'mathbb', 'mathcal',
  'text', 'textbf', 'mathrm', 'mathit', 'mathbf', 'ensuremath',
  'quad', 'qquad', 'dots', 'ldots', 'cdots',
  'noindent', 'newline', 'par', 'vspace', 'hspace', 'textbackslash', 'textasciicircum', 'textasciitilde', 'textdegree',
  'displaystyle', 'textstyle',
  'begin', 'end', 'item', 'itemsep', 'centering', 'hline',
  'section', 'subsection', 'subsubsection',
  'includegraphics', 'url', 'href', 'label', 'ref',
  'multirow', 'multicolumn',
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
    const displaySafeNormalized = unwrapParenMathInsideInlineDollar(
      unwrapInlineMathInsideDisplayMath(normalized)
    );
    if (compileSafeMode) {
      return finalizeCompileSafeBody(applyCompileSafeLatexRepairs(displaySafeNormalized));
    }
    return balanceMathDelimiters(displaySafeNormalized);
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

  const renderQuestionContent = (
    question: ExportQuestion,
    lines: string[],
    inlinePrefix = '',
    skipQuestionText = false
  ) => {
    const questionType = question.question_type || 'written';
    if (!skipQuestionText) {
      const questionText = renderBody(String(question.question_text || ''));
      lines.push(`${inlinePrefix}${questionText || 'No question text provided.'}`);
      lines.push('');
    }
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
          value: ensureMathModeForMcqOption(renderBody(String(question.mcq_option_a || '').trim())),
          imageFile: question.mcq_option_a_image_file,
        },
        {
          label: 'B',
          value: ensureMathModeForMcqOption(renderBody(String(question.mcq_option_b || '').trim())),
          imageFile: question.mcq_option_b_image_file,
        },
        {
          label: 'C',
          value: ensureMathModeForMcqOption(renderBody(String(question.mcq_option_c || '').trim())),
          imageFile: question.mcq_option_c_image_file,
        },
        {
          label: 'D',
          value: ensureMathModeForMcqOption(renderBody(String(question.mcq_option_d || '').trim())),
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

  // Group consecutive questions by renumbered base so subparts can render under one header.
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
        const subQuestionText = renderBody(String(subQ.question_text || '')) || 'No question text provided.';

        lines.push(`\\noindent\\textbf{(${escapeLatexText(subD.roman || '')})} ${subQuestionText}${subMarks > 0 ? `\\hfill\\textbf{${subMarks}}` : ''}`);
        lines.push('');
        renderQuestionContent(subQ, lines, '', true);
        if (gi < groupQuestions.length - 1) {
          lines.push('\\vspace{0.5em}');
        }
      }

      lines.push('\\vspace{0.9em}');
      bodyParts.push(['\\filbreak', lines.join('\n')].join('\n'));
    } else if (details.subPart && !details.roman) {
      // Group lettered subparts (a), (b), (c) under a single Question N header.
      const groupMappedMain = details.mappedMain;
      const groupStart = cursor;
      while (cursor < questions.length) {
        const d = parsedDetails[cursor];
        if (d.mappedMain !== groupMappedMain || !d.subPart || d.roman) break;
        cursor += 1;
      }

      const groupQuestions = questions.slice(groupStart, cursor);
      const groupDetails = parsedDetails.slice(groupStart, cursor);
      const totalMarks = groupQuestions.reduce((sum, q) => sum + Number(q.marks || 0), 0);
      const totalMarksLabel = totalMarks > 0 ? `${totalMarks} ${totalMarks === 1 ? 'mark' : 'marks'}` : '';

      const lines: string[] = [];
      const groupLabel = `Question ${details.mappedMain}`;
      lines.push('\\noindent\\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r@{}}');
      lines.push(`\\textbf{${escapeLatexText(groupLabel)}}${totalMarksLabel ? ` & \\textbf{${escapeLatexText(totalMarksLabel)}}` : ' & '}\\\\[0.5em]`);
      lines.push('\\end{tabular*}');

      for (let gi = 0; gi < groupQuestions.length; gi += 1) {
        const subQ = groupQuestions[gi];
        const subD = groupDetails[gi];
        const subMarks = Number(subQ.marks || 0);
        const subQuestionText = renderBody(String(subQ.question_text || '')) || 'No question text provided.';

        lines.push(`\\noindent\\textbf{(${escapeLatexText(subD.subPart || '')})} ${subQuestionText}${subMarks > 0 ? `\\hfill\\textbf{${subMarks}}` : ''}`);
        lines.push('');
        renderQuestionContent(subQ, lines, '', true);
        if (gi < groupQuestions.length - 1) {
          lines.push('\\vspace{0.5em}');
        }
      }

      lines.push('\\vspace{0.9em}');
      bodyParts.push(['\\filbreak', lines.join('\n')].join('\n'));
    } else {
      // Standalone question (no roman sub-parts)
      const questionLabel = `Question ${details.mappedMain}${details.subPart ? ` (${details.subPart})` : ''}`;
      const lines: string[] = [];
      lines.push('\\noindent\\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r@{}}');
      lines.push(`\\textbf{${escapeLatexText(questionLabel)}}${marksLabel ? ` & \\textbf{${escapeLatexText(marksLabel)}}` : ' & '}\\\\[0.5em]`);
      lines.push('\\end{tabular*}');
      renderQuestionContent(question, lines);
      lines.push('\\vspace{0.9em}');
      bodyParts.push(['\\filbreak', lines.join('\n')].join('\n'));
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
\\usepackage{multirow}
\\usepackage{xcolor}
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

const compileTexToPdfLocal = async ({ tex, tempDir }: { tex: string; tempDir: string }) => {
  const texPath = path.join(tempDir, LOCAL_TEX_FILENAME);
  const logPath = path.join(tempDir, 'exam.log');
  const pdfPath = path.join(tempDir, 'exam.pdf');

  await writeFile(texPath, tex, 'utf8');

  await access(PDFLATEX_PATH, constants.X_OK);

  try {
    await execFileAsync(
      PDFLATEX_PATH,
      ['-interaction=nonstopmode', '-halt-on-error', LOCAL_TEX_FILENAME],
      {
        cwd: tempDir,
        timeout: PDF_COMPILE_TIMEOUT_MS,
      }
    );
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    let logRaw = '';
    try {
      logRaw = await readFile(logPath, 'utf8');
    } catch {
      logRaw = '';
    }

    const logTail = extractLatexErrorContext(logRaw);
    const lineNumber = extractTexLineNumber(logRaw || execError.stderr || execError.stdout || '');
    const texContext = lineNumber ? await readTexContext(texPath, lineNumber) : '';
    const diagnostic = composePdflatexDiagnostic({
      stderr: String(execError.stderr || ''),
      stdout: String(execError.stdout || ''),
      logTail,
    });

    const details = [
      execError.message || 'pdflatex failed',
      lineNumber ? `line: ${lineNumber}` : '',
      texContext ? `tex context:\n${texContext}` : '',
      diagnostic ? truncateDiagnostic(diagnostic) : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    throw new Error(details || 'pdflatex failed');
  }

  const pdfBuffer = await readFile(pdfPath);
  if (!isPdfBuffer(pdfBuffer)) {
    throw new Error(`Compiled output is not a valid PDF. Preview: ${safeUtf8Preview(pdfBuffer, 240)}`);
  }

  return pdfBuffer;
};

const compileTexToPdfRemote = async ({
  tex,
  tempDir,
  questions,
}: {
  tex: string;
  tempDir: string;
  questions: ExportQuestion[];
}) => {
  const referencedAssets = getReferencedAssetFilenames(questions);
  const resources: Array<Record<string, unknown>> = [
    {
      main: true,
      path: LOCAL_TEX_FILENAME,
      content: tex,
    },
  ];

  for (const filename of referencedAssets) {
    const filePath = path.join(tempDir, filename);
    const fileBuffer = await readFile(filePath);
    resources.push({
      path: filename,
      file: fileBuffer.toString('base64'),
    });
  }

  const response = await fetchWithTimeout(
    LATEX_TO_PDF_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    PDF_COMPILE_TIMEOUT_MS
  );

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const outputBuffer = Buffer.from(await response.arrayBuffer());

  if (response.ok && isPdfBuffer(outputBuffer)) {
    return outputBuffer;
  }

  if (response.ok && contentType.includes('application/pdf')) {
    return outputBuffer;
  }

  const responseBodyText = outputBuffer.toString('utf8');
  throw new Error(
    [
      `Remote compiler failed (${response.status} ${response.statusText}).`,
      responseBodyText ? truncateDiagnostic(responseBodyText) : '',
    ]
      .filter(Boolean)
      .join('\n\n')
  );
};

const resolveCompileOrder = () => {
  // Supported modes:
  // - auto (default): remote first on Vercel, local first elsewhere
  // - local: local only
  // - remote: remote only
  // - local-first: local then remote
  // - remote-first: remote then local
  const mode = LATEX_TO_PDF_API_MODE;
  if (mode === 'local') return ['local'] as const;
  if (mode === 'remote') return ['remote'] as const;
  if (mode === 'local-first') return ['local', 'remote'] as const;
  if (mode === 'remote-first') return ['remote', 'local'] as const;
  return IS_VERCEL_RUNTIME ? (['remote', 'local'] as const) : (['local', 'remote'] as const);
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const questions = Array.isArray(body?.questions) ? (body.questions as ExportQuestion[]) : [];
    const includeSolutions = Boolean(body?.includeSolutions);
    const title = String(body?.title || 'Custom Exam').trim();
    const subtitle = String(body?.subtitle || '').trim();
    const downloadNameBase = String(body?.downloadName || 'custom-exam').trim() || 'custom-exam';
    const outputFormat = String(body?.format || 'pdf').trim().toLowerCase();
    const wantsTex = outputFormat === 'tex';

    if (!questions.length) {
      return Response.json({ error: 'At least one question is required to export TeX' }, { status: 400 });
    }

    const safeBase = downloadNameBase.replace(/[^a-z0-9\-_.]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const baseFilename = `${safeBase || 'custom-exam'}${includeSolutions ? '-with-solutions' : ''}`;

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'export-exam-pdf-'));
    try {
      const enrichedQuestions = await attachQuestionImageAssets(questions, tempDir, includeSolutions);

      const primaryTex = buildExamLatex({
        title,
        subtitle,
        includeSolutions,
        questions: enrichedQuestions,
      });

      if (wantsTex) {
        const filename = `${baseFilename}.tex`;
        return new Response(primaryTex, {
          status: 200,
          headers: {
            'Content-Type': 'application/x-tex; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
          },
        });
      }

      const attempts: Array<{ label: string; tex: string }> = [
        { label: 'standard', tex: primaryTex },
        {
          label: 'compile-safe',
          tex: buildExamLatex({
            title,
            subtitle,
            includeSolutions,
            questions: enrichedQuestions,
            compileSafeMode: true,
          }),
        },
      ];

      if (ENABLE_PLAIN_TEXT_PDF_FALLBACK) {
        attempts.push({
          label: 'plain-text',
          tex: buildExamLatex({
            title,
            subtitle,
            includeSolutions,
            questions: enrichedQuestions,
            compileSafeMode: true,
            plainTextMode: true,
          }),
        });
      }

      const compileErrors: string[] = [];
      const compileOrder = resolveCompileOrder();

      for (const attempt of attempts) {
        for (const compiler of compileOrder) {
          try {
            const pdfBuffer = compiler === 'remote'
              ? await compileTexToPdfRemote({ tex: attempt.tex, tempDir, questions: enrichedQuestions })
              : await compileTexToPdfLocal({ tex: attempt.tex, tempDir });

            const filename = `${baseFilename}.pdf`;
            return new Response(pdfBuffer, {
              status: 200,
              headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
              },
            });
          } catch (attemptError) {
            const message = attemptError instanceof Error ? attemptError.message : String(attemptError);
            compileErrors.push(`[${attempt.label}:${compiler}] ${message}`);
          }
        }
      }

      const preview = primaryTex.slice(0, MAX_GET_TEX_LENGTH);
      throw new Error(
        [
          'Failed to compile exam PDF.',
          ...compileErrors,
          `TeX preview (first ${MAX_GET_TEX_LENGTH} chars):`,
          preview,
          IS_VERCEL_RUNTIME ? `Runtime hint: running on Vercel, local pdflatex path is ${PDFLATEX_PATH}` : '',
          LATEX_TO_PDF_API_MODE ? `LATEX_TO_PDF_API_MODE=${LATEX_TO_PDF_API_MODE}; LATEX_TO_PDF_API_URL=${LATEX_TO_PDF_API_URL}` : '',
          LOCAL_PDFLATEX_MISSING_SENTINEL,
        ]
          .filter(Boolean)
          .join('\n\n')
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[export-exam-pdf] Error:', message);
    return Response.json(
      { error: 'Failed to export exam PDF', details: message },
      { status: 500 }
    );
  }
}
