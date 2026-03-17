#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const os = require('os');
const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');
const { access, constants } = require('fs');
const { appendFile, mkdtemp, readFile, rm, writeFile } = require('fs/promises');
const { Pool } = require('pg');

const execFileAsync = promisify(execFile);

const databaseUrl = process.env.DATABASE_URL;
const pdflatexPath = process.env.PDFLATEX_PATH ?? '/usr/bin/pdflatex';
const pdfCompileTimeoutMs = Number(process.env.PDF_COMPILE_TIMEOUT_MS ?? 30000);
const batchSize = Number(process.env.LATEX_CHECK_BATCH_SIZE ?? 100);
const texFilename = 'question.tex';

if (!databaseUrl) {
  console.error('Missing DATABASE_URL.');
  console.error('Set DATABASE_URL in .env.local');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

const cliArgs = process.argv.slice(2);
const limitArg = cliArgs.find((arg) => arg.startsWith('--limit='));
const outputArg = cliArgs.find((arg) => arg.startsWith('--output='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : null;
const outputPath = outputArg
  ? path.resolve(process.cwd(), outputArg.split('=')[1])
  : path.resolve(__dirname, 'latex-broken-question-ids.txt');

const escapeLatexText = (value) =>
  String(value || '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}%$&#_])/g, '\\$1')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}');

const normalizeKnownTextArtifacts = (value) =>
  String(value || '')
    .replace(/\bMARKS_(\d+)\b/g, 'MARKS\\_$1')
    .replace(/\bQUESTION_(\d+)\b/g, 'QUESTION\\_$1');

const tailLines = (value, maxLines = 25) => {
  const lines = String(value || '').split(/\r?\n/);
  return lines.slice(-maxLines).join('\n').trim();
};

const extractTexLineNumber = (text) => {
  const match = String(text || '').match(/question\.tex:(\d+):/i);
  const fallback = String(text || '').match(/\bl\.(\d+)\b/i);
  const line = match?.[1] ?? fallback?.[1];
  if (!line) return null;

  const parsed = Number(line);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const extractLatexErrorContext = (logRaw) => {
  const lines = String(logRaw || '').split(/\r?\n/);
  let bangIndex = lines.findIndex((line) => /^!\s(?!==>)/.test(line));

  if (bangIndex < 0) {
    bangIndex = lines.findIndex((line) => /^!\s/.test(line));
  }

  if (bangIndex < 0) {
    return lines.slice(-20).join('\n').trim();
  }

  const start = Math.max(0, bangIndex - 4);
  const end = Math.min(lines.length, bangIndex + 10);
  return lines.slice(start, end).join('\n').trim();
};

const readTexContext = async (texPath, lineNumber) => {
  if (!lineNumber) return '';

  try {
    const raw = await readFile(texPath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const start = Math.max(1, lineNumber - 3);
    const end = Math.min(lines.length, lineNumber + 3);
    const snippet = [];

    for (let line = start; line <= end; line += 1) {
      const marker = line === lineNumber ? '>' : ' ';
      snippet.push(`${marker} ${line}: ${lines[line - 1] || ''}`);
    }

    return snippet.join('\n');
  } catch {
    return '';
  }
};

const buildDocument = (title, sections) => {
  const sectionBlocks = sections
    .map((section) => {
      return [
        `\\subsection*{${escapeLatexText(section.label)}}`,
        normalizeKnownTextArtifacts(section.content),
        '',
      ].join('\n');
    })
    .join('\n');

  return [
    '\\documentclass[12pt]{article}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage{amsmath,amssymb,amsfonts,amsthm,mathtools,array,enumitem,graphicx,textcomp}',
    '\\usepackage[margin=1in]{geometry}',
    '\\pagestyle{empty}',
    '\\setlength{\\parindent}{0pt}',
    '\\DeclareMathOperator{\\cosec}{cosec}',
    '\\providecommand{\\undertilde}[1]{\\underset{\\sim}{#1}}',
    '\\providecommand{\\utilde}[1]{\\undertilde{#1}}',
    '\\begin{document}',
    `\\section*{${escapeLatexText(title)}}`,
    sectionBlocks,
    '\\end{document}',
    '',
  ].join('\n');
};

const compileLatexDocument = async (workDir, texSource) => {
  const texPath = path.join(workDir, texFilename);
  const logPath = path.join(workDir, 'question.log');

  await writeFile(texPath, texSource, 'utf8');

  try {
    await execFileAsync(
      pdflatexPath,
      ['-interaction=nonstopmode', '-halt-on-error', texFilename],
      { cwd: workDir, timeout: pdfCompileTimeoutMs }
    );

    return { ok: true, lineNumber: null, logContext: '', texContext: '', stderrTail: '', stdoutTail: '' };
  } catch (error) {
    let logRaw = '';

    try {
      logRaw = await readFile(logPath, 'utf8');
    } catch {
      logRaw = '';
    }

    const stdout = String(error.stdout || '');
    const stderr = String(error.stderr || '');
    const lineNumber = extractTexLineNumber(logRaw || stdout || stderr);
    const texContext = await readTexContext(texPath, lineNumber);

    return {
      ok: false,
      lineNumber,
      logContext: extractLatexErrorContext(logRaw || stdout || stderr),
      texContext,
      stderrTail: tailLines(stderr),
      stdoutTail: tailLines(stdout),
    };
  }
};

const getQuestionFields = (row) => {
  const fields = [
    ['question_text', row.question_text],
    ['sample_answer', row.sample_answer],
    ['mcq_option_a', row.mcq_option_a],
    ['mcq_option_b', row.mcq_option_b],
    ['mcq_option_c', row.mcq_option_c],
    ['mcq_option_d', row.mcq_option_d],
    ['mcq_explanation', row.mcq_explanation],
  ];

  return fields
    .map(([label, value]) => ({ label, content: String(value || '').trim() }))
    .filter((field) => field.content.length > 0);
};

const fetchBatch = async (offset) => {
  const result = await pool.query(
    `
      SELECT
        id,
        question_number,
        question_type,
        question_text,
        marking_criteria,
        sample_answer,
        mcq_option_a,
        mcq_option_b,
        mcq_option_c,
        mcq_option_d,
        mcq_explanation
      FROM hsc_questions
      ORDER BY id
      OFFSET $1
      LIMIT $2
    `,
    [offset, batchSize]
  );

  return result.rows || [];
};

const fetchTotalCount = async () => {
  const result = await pool.query('SELECT COUNT(*)::int AS count FROM hsc_questions');
  return Number(result.rows?.[0]?.count || 0);
};

const printQuestionFailure = (row, fieldFailures) => {
  const questionLabel = row.question_number ? `Question ${row.question_number}` : 'Question (no number)';
  console.log('');
  console.log('='.repeat(80));
  console.log(`${questionLabel} | id=${row.id} | type=${row.question_type || 'unknown'}`);

  for (const failure of fieldFailures) {
    console.log(`\nField: ${failure.field}`);
    if (failure.lineNumber) {
      console.log(`Line: ${failure.lineNumber}`);
    }
    if (failure.logContext) {
      console.log('LaTeX log:');
      console.log(failure.logContext);
    }
    if (failure.texContext) {
      console.log('Context:');
      console.log(failure.texContext);
    }
    if (!failure.logContext && failure.stderrTail) {
      console.log('stderr:');
      console.log(failure.stderrTail);
    }
    if (!failure.logContext && !failure.stderrTail && failure.stdoutTail) {
      console.log('stdout:');
      console.log(failure.stdoutTail);
    }
  }
};

const ensurePdflatexExists = async () => {
  await new Promise((resolve, reject) => {
    access(pdflatexPath, constants.X_OK, (error) => {
      if (error) {
        reject(new Error(`pdflatex is not executable at ${pdflatexPath}`));
        return;
      }
      resolve(undefined);
    });
  });
};

async function run() {
  await ensurePdflatexExists();

  const totalRows = await fetchTotalCount();
  const maxRows = limit != null && Number.isFinite(limit) && limit > 0 ? Math.min(totalRows, limit) : totalRows;
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'question-latex-check-'));
  const failedQuestionIds = new Set();

  let offset = 0;
  let scanned = 0;
  let failedQuestions = 0;
  let failedFields = 0;

  try {
    console.log(`Checking LaTeX for ${maxRows} question(s)...`);
    console.log(`Writing failing question IDs to ${outputPath}`);
    await writeFile(outputPath, '', 'utf8');

    while (scanned < maxRows) {
      const rows = await fetchBatch(offset);
      if (!rows.length) break;

      for (const row of rows) {
        if (scanned >= maxRows) break;

        scanned += 1;
        const fields = getQuestionFields(row);
        if (!fields.length) continue;

        const title = row.question_number ? `Question ${row.question_number}` : `Question ${row.id}`;
        const combinedResult = await compileLatexDocument(workDir, buildDocument(title, fields));

        if (!combinedResult.ok) {
          const fieldFailures = [];

          for (const field of fields) {
            const result = await compileLatexDocument(workDir, buildDocument(title, [field]));
            if (result.ok) continue;

            fieldFailures.push({ field: field.label, ...result });
          }

          if (!fieldFailures.length) {
            fieldFailures.push({ field: 'combined_question_content', ...combinedResult });
          }

          failedQuestions += 1;
          failedFields += fieldFailures.length;
          if (!failedQuestionIds.has(row.id)) {
            failedQuestionIds.add(row.id);
            await appendFile(outputPath, `${row.id}\n`, 'utf8');
          }
          printQuestionFailure(row, fieldFailures);
        }

        if (scanned % 25 === 0 || scanned === maxRows) {
          console.log(`Progress: ${scanned}/${maxRows} scanned, ${failedQuestions} question(s) with errors.`);
        }
      }

      offset += batchSize;
    }

    console.log('');
    console.log('Finished LaTeX check.');
    console.log(`Questions scanned: ${scanned}`);
    console.log(`Questions with errors: ${failedQuestions}`);
    console.log(`Failing fields: ${failedFields}`);
    console.log(`Question ID file: ${outputPath}`);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
}

run().catch(async (error) => {
  console.error('Script failed:', error.message || error);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
