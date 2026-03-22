#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const { Client } = require('pg');

const getArgValue = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) return null;
  return value;
};

const hasFlag = (name) => process.argv.includes(name);

const normalizeQuestionNumber = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const usage = () => {
  console.log(`Usage:\n  node scripts/dedupe-exam-questions-by-number.js --year <year> --subject <subject> --school <school> --paper <paper_number> [--apply]\n\nDefaults to dry-run unless --apply is provided.\n\nExample:\n  node scripts/dedupe-exam-questions-by-number.js --year 2024 --subject "Mathematics Advanced" --school "Sydney Boys" --paper 2 --apply`);
};

const run = async () => {
  const yearRaw = getArgValue('--year');
  const subject = getArgValue('--subject');
  const school = getArgValue('--school');
  const paperRaw = getArgValue('--paper');
  const apply = hasFlag('--apply');

  if (!yearRaw || !subject || !school || !paperRaw) {
    usage();
    process.exit(1);
  }

  const year = Number(yearRaw);
  const paperNumber = Number(paperRaw);

  if (!Number.isInteger(year) || !Number.isInteger(paperNumber)) {
    console.error('Invalid --year or --paper. Both must be integers.');
    process.exit(1);
  }

  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.NEON_CONNECTION_STRING;

  if (!dbUrl) {
    console.error('No database URL found in environment.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const rowsResult = await client.query(
      `
      SELECT id, question_number, created_at
      FROM hsc_questions
      WHERE year = $1
        AND lower(subject) = lower($2)
        AND lower(coalesce(school_name, '')) = lower($3)
        AND paper_number = $4
      ORDER BY created_at ASC NULLS LAST, id ASC
      `,
      [year, subject, school, paperNumber]
    );

    const rows = rowsResult.rows || [];

    if (!rows.length) {
      console.log('No rows found for the specified exam filter.');
      return;
    }

    const groups = new Map();

    for (const row of rows) {
      const key = normalizeQuestionNumber(row.question_number);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }

    const deleteIds = [];
    const duplicateGroups = [];

    for (const [questionNumberKey, groupRows] of groups.entries()) {
      if (groupRows.length <= 1) continue;

      const keepRow = groupRows[0];
      const removeRows = groupRows.slice(1);
      deleteIds.push(...removeRows.map((r) => r.id));

      duplicateGroups.push({
        questionNumber: groupRows[0].question_number,
        normalizedKey: questionNumberKey,
        keepId: keepRow.id,
        removeIds: removeRows.map((r) => r.id),
      });
    }

    console.log('Exam filter:');
    console.log(`  year=${year}, subject=${subject}, school=${school}, paper=${paperNumber}`);
    console.log(`  total rows scanned: ${rows.length}`);
    console.log(`  duplicate groups: ${duplicateGroups.length}`);
    console.log(`  rows to delete: ${deleteIds.length}`);

    if (!duplicateGroups.length) {
      console.log('No duplicates by question number were found.');
      return;
    }

    console.log('\nDuplicate groups preview:');
    for (const group of duplicateGroups) {
      console.log(`  q="${group.questionNumber}" keep=${group.keepId} delete=${group.removeIds.join(',')}`);
    }

    if (!apply) {
      console.log('\nDry run only. Re-run with --apply to perform deletion.');
      return;
    }

    await client.query('BEGIN');

    const deleteResult = await client.query(
      `DELETE FROM hsc_questions WHERE id = ANY($1::uuid[])`,
      [deleteIds]
    );

    const remainingDupes = await client.query(
      `
      SELECT COUNT(*)::int AS duplicate_group_count
      FROM (
        SELECT lower(trim(question_number)) AS key, COUNT(*)
        FROM hsc_questions
        WHERE year = $1
          AND lower(subject) = lower($2)
          AND lower(coalesce(school_name, '')) = lower($3)
          AND paper_number = $4
          AND question_number IS NOT NULL
          AND trim(question_number) <> ''
        GROUP BY lower(trim(question_number))
        HAVING COUNT(*) > 1
      ) d
      `,
      [year, subject, school, paperNumber]
    );

    await client.query('COMMIT');

    console.log('\nDeletion complete.');
    console.log(`  rows deleted: ${deleteResult.rowCount || 0}`);
    console.log(`  remaining duplicate groups: ${remainingDupes.rows[0]?.duplicate_group_count || 0}`);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // no-op
    }

    console.error('Failed to dedupe exam questions:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
};

run();
