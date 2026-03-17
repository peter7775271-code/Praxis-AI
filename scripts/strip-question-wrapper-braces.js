#!/usr/bin/env node

/**
 * Strip outer wrapper braces from hsc_questions.question_text.
 *
 * Example transformed value:
 *   {What is 2 + 4?} -> What is 2 + 4?
 *
 * Only rows whose question_text is wrapped by exactly one outer pair
 * of braces (ignoring surrounding whitespace) are updated.
 *
 * Usage:
 *   node scripts/strip-question-wrapper-braces.js
 *   node scripts/strip-question-wrapper-braces.js --dry-run
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL.');
  console.error('Set DATABASE_URL in .env.local');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes('--dry-run');

function stripOuterCurlyBraces(text) {
  if (typeof text !== 'string') return { changed: false, value: text };

  const match = text.match(/^\s*\{([\s\S]*)\}\s*$/);
  if (!match) return { changed: false, value: text };

  const inner = match[1].trim();
  if (!inner) {
    return { changed: false, value: text };
  }

  return { changed: true, value: inner };
}

async function fetchBatch(offset) {
  const result = await pool.query(
    `
      SELECT id, question_text
      FROM hsc_questions
      ORDER BY id
      OFFSET $1
      LIMIT $2
    `,
    [offset, BATCH_SIZE]
  );

  return result.rows || [];
}

async function updateQuestion(id, questionText) {
  await pool.query(
    `
      UPDATE hsc_questions
      SET question_text = $1
      WHERE id = $2
    `,
    [questionText, id]
  );
}

async function run() {
  console.log(DRY_RUN ? 'Running in DRY-RUN mode (no updates will be written).' : 'Running in WRITE mode.');

  let offset = 0;
  let scanned = 0;
  let matched = 0;
  let updated = 0;
  let page = 0;

  while (true) {
    page += 1;
    const rows = await fetchBatch(offset);
    if (!rows.length) break;

    scanned += rows.length;
    const updates = [];

    for (const row of rows) {
      const original = typeof row.question_text === 'string' ? row.question_text : '';
      const result = stripOuterCurlyBraces(original);

      if (!result.changed) continue;

      matched += 1;
      updates.push({ id: row.id, question_text: result.value });
    }

    if (!DRY_RUN && updates.length) {
      for (const patch of updates) {
        await updateQuestion(patch.id, patch.question_text);
      }

      updated += updates.length;
    }

    if (DRY_RUN) {
      console.log(`Page ${page}: scanned ${rows.length}, matches ${updates.length}`);
    } else {
      console.log(`Page ${page}: scanned ${rows.length}, updated ${updates.length}`);
    }

    offset += BATCH_SIZE;
  }

  console.log('');
  console.log('Completed.');
  console.log(`Scanned: ${scanned}`);
  console.log(`Matched wrapper braces: ${matched}`);
  console.log(`Updated: ${updated}`);

  await pool.end();
}

run().catch((error) => {
  console.error('Script failed:', error.message || error);
  pool.end().catch(() => undefined);
  process.exit(1);
});
