import { Pool, type PoolConfig } from 'pg';

type DbRow = Record<string, unknown>;

type QueryResultPayload<T = any> = {
  data: T;
  error: DbClientError | null;
  count?: number | null;
};

type MutationAction = 'insert' | 'update' | 'delete' | 'upsert';
type QueryAction = 'select' | MutationAction;
type OrderClause = { column: string; ascending: boolean };

type BasicFilter = {
  type: 'basic';
  operator: 'eq' | 'neq' | 'in' | 'is' | 'gte';
  column: string;
  value: unknown;
};

type OrClause = {
  column: string;
  operator: 'ilike';
  value: string;
};

type OrFilter = {
  type: 'or';
  clauses: OrClause[];
};

type BuilderFilter = BasicFilter | OrFilter;

type UpsertOptions = {
  onConflict?: string;
  ignoreDuplicates?: boolean;
};

class DbClientError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'DbClientError';
    this.code = code;
  }
}

const DATABASE_URL_ENV_KEYS = [
  'DATABASE_URL',
  'NEON_DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'NEON_CONNECTION_STRING',
] as const;

const databaseUrl = DATABASE_URL_ENV_KEYS
  .map((key) => process.env[key])
  .find((value) => typeof value === 'string' && value.trim().length > 0)
  ?.trim();

const DATABASE_QUERY_RETRIES = Number(process.env.DATABASE_QUERY_RETRIES ?? 3);
const DATABASE_QUERY_RETRY_DELAY_MS = Number(process.env.DATABASE_QUERY_RETRY_DELAY_MS ?? 350);
const DATABASE_POOL_MAX = Number(process.env.DATABASE_POOL_MAX ?? 10);
const RETRYABLE_DB_ERROR = /(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|Connection terminated unexpectedly|fetch failed|timeout|timed out)/i;

let poolInstance: Pool | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const quoteIdentifier = (value: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value}`);
  }

  return `"${value}"`;
};

const splitTopLevelCsv = (input: string) => {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const character of input) {
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);

    if (character === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
};

const stripUndefinedFields = <T extends Record<string, unknown>>(value: T) => {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T;
};

const isRetryableDbError = (error: unknown) => {
  if (!error) return false;

  const message = error instanceof Error ? error.message : String(error);
  if (RETRYABLE_DB_ERROR.test(message)) return true;

  if (typeof error === 'object' && error && 'code' in error) {
    const code = String((error as { code?: unknown }).code || '');
    return ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(code);
  }

  return false;
};

const createDbError = (error: unknown) => {
  if (error instanceof DbClientError) return error;

  const message = error instanceof Error ? error.message : String(error ?? 'Unknown database error');
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '') || undefined
    : undefined;

  return new DbClientError(message, code);
};

const buildSslConfig = (connectionString: string): PoolConfig['ssl'] | undefined => {
  try {
    const parsed = new URL(connectionString);
    const sslMode = parsed.searchParams.get('sslmode');
    if (sslMode === 'disable') return undefined;
    if (sslMode === 'require' || parsed.hostname.endsWith('.neon.tech')) {
      return { rejectUnauthorized: false };
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const getPool = () => {
  if (!databaseUrl) return null;
  if (poolInstance) return poolInstance;

  poolInstance = new Pool({
    connectionString: databaseUrl,
    max: DATABASE_POOL_MAX,
    ssl: buildSslConfig(databaseUrl),
  });

  poolInstance.on('error', (error) => {
    console.error('[database] Pool error:', error.message);
  });

  return poolInstance;
};

const runQueryWithRetry = async (text: string, values: unknown[]) => {
  const pool = getPool();
  if (!pool) {
    throw new DbClientError(
      'Database not initialized. Set DATABASE_URL or NEON_DATABASE_URL in .env.local'
    );
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= DATABASE_QUERY_RETRIES; attempt += 1) {
    try {
      return await pool.query(text, values);
    } catch (error) {
      lastError = error;
      if (!isRetryableDbError(error) || attempt === DATABASE_QUERY_RETRIES) {
        throw error;
      }

      await sleep(DATABASE_QUERY_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
};

const parseOrClauses = (value: string): OrClause[] => {
  const rawClauses: string[] = [];
  let current = '';

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previous = value[index - 1];

    if (character === ',' && previous !== '\\') {
      if (current.trim()) rawClauses.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  if (current.trim()) rawClauses.push(current.trim());

  return rawClauses
    .map((clause) => clause.replace(/\\,/g, ','))
    .map((clause) => {
      const match = clause.match(/^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_]+)\.(.+)$/);
      if (!match) return null;

      const [, column, operator, rawValue] = match;
      if (operator !== 'ilike') return null;

      return {
        column,
        operator: 'ilike' as const,
        value: rawValue,
      };
    })
    .filter((clause): clause is OrClause => Boolean(clause));
};

const buildSelectClause = (table: string, columns: string) => {
  const trimmed = columns.trim();
  if (!trimmed || trimmed === '*') return `${quoteIdentifier(table)}.*`;

  return splitTopLevelCsv(trimmed)
    .map((entry) => {
      if (entry === '*') return `${quoteIdentifier(table)}.*`;
      return quoteIdentifier(entry);
    })
    .join(', ');
};

class PostgresQueryBuilder implements PromiseLike<QueryResultPayload<any>> {
  private action: QueryAction = 'select';
  private filters: BuilderFilter[] = [];
  private orderClauses: OrderClause[] = [];
  private selectColumns = '*';
  private returningColumns: string | null = null;
  private expectSingle = false;
  private countRequested = false;
  private headOnly = false;
  private rangeStart: number | null = null;
  private rangeEnd: number | null = null;
  private limitCount: number | null = null;
  private insertRows: Record<string, unknown>[] = [];
  private updateValues: Record<string, unknown> = {};
  private upsertOptions: UpsertOptions = {};

  constructor(private readonly table: string) {}

  select(columns = '*', options: { count?: 'exact'; head?: boolean } = {}) {
    if (this.action === 'select') {
      this.selectColumns = columns;
      this.countRequested = options.count === 'exact';
      this.headOnly = options.head === true;
      return this;
    }

    this.returningColumns = columns;
    return this;
  }

  insert(values: Record<string, unknown>[] | Record<string, unknown>) {
    this.action = 'insert';
    this.insertRows = (Array.isArray(values) ? values : [values]).map(stripUndefinedFields);
    return this;
  }

  update(values: Record<string, unknown>) {
    this.action = 'update';
    this.updateValues = stripUndefinedFields(values);
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(values: Record<string, unknown>[] | Record<string, unknown>, options: UpsertOptions = {}) {
    this.action = 'upsert';
    this.insertRows = (Array.isArray(values) ? values : [values]).map(stripUndefinedFields);
    this.upsertOptions = options;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: 'basic', operator: 'eq', column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ type: 'basic', operator: 'neq', column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ type: 'basic', operator: 'in', column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ type: 'basic', operator: 'is', column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ type: 'basic', operator: 'gte', column, value });
    return this;
  }

  match(values: Record<string, unknown>) {
    Object.entries(values).forEach(([column, value]) => {
      if (value === null) {
        this.is(column, null);
        return;
      }

      this.eq(column, value);
    });

    return this;
  }

  or(value: string) {
    const clauses = parseOrClauses(value);
    if (clauses.length > 0) {
      this.filters.push({ type: 'or', clauses });
    }
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderClauses.push({ column, ascending: options.ascending !== false });
    return this;
  }

  range(from: number, to: number) {
    this.rangeStart = from;
    this.rangeEnd = to;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.expectSingle = true;
    return this;
  }

  then<TResult1 = QueryResultPayload<any>, TResult2 = never>(
    onfulfilled?: ((value: QueryResultPayload<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<QueryResultPayload<any> | TResult> {
    return this.execute().catch(onrejected);
  }

  private buildWhereClause(values: unknown[]) {
    if (this.filters.length === 0) return '';

    const clauses = this.filters.map((filter) => {
      if (filter.type === 'or') {
        const orClauses = filter.clauses.map((clause) => {
          values.push(clause.value);
          return `${quoteIdentifier(clause.column)} ILIKE $${values.length}`;
        });

        return `(${orClauses.join(' OR ')})`;
      }

      const column = quoteIdentifier(filter.column);

      if (filter.operator === 'eq') {
        if (filter.value === null) return `${column} IS NULL`;
        values.push(filter.value);
        return `${column} = $${values.length}`;
      }

      if (filter.operator === 'neq') {
        if (filter.value === null) return `${column} IS NOT NULL`;
        values.push(filter.value);
        return `${column} <> $${values.length}`;
      }

      if (filter.operator === 'is') {
        if (filter.value === null) return `${column} IS NULL`;
        if (filter.value === true) return `${column} IS TRUE`;
        if (filter.value === false) return `${column} IS FALSE`;
        values.push(filter.value);
        return `${column} IS NOT DISTINCT FROM $${values.length}`;
      }

      if (filter.operator === 'gte') {
        values.push(filter.value);
        return `${column} >= $${values.length}`;
      }

      const arrayValue = Array.isArray(filter.value) ? filter.value : [];
      if (arrayValue.length === 0) return 'FALSE';
      values.push(arrayValue);
      return `${column} = ANY($${values.length})`;
    });

    return ` WHERE ${clauses.join(' AND ')}`;
  }

  private buildOrderClause() {
    if (this.orderClauses.length === 0) return '';

    return ` ORDER BY ${this.orderClauses
      .map((clause) => `${quoteIdentifier(clause.column)} ${clause.ascending ? 'ASC' : 'DESC'}`)
      .join(', ')}`;
  }

  private buildLimitOffsetClause(values: unknown[]) {
    const parts: string[] = [];

    if (this.rangeStart != null && this.rangeEnd != null) {
      const rangeLimit = Math.max(0, this.rangeEnd - this.rangeStart + 1);
      values.push(rangeLimit);
      parts.push(` LIMIT $${values.length}`);
      values.push(this.rangeStart);
      parts.push(` OFFSET $${values.length}`);
      return parts.join('');
    }

    if (this.limitCount != null) {
      values.push(this.limitCount);
      parts.push(` LIMIT $${values.length}`);
    }

    return parts.join('');
  }

  private normalizeResultRows<T extends DbRow = DbRow>(rows: T[]): QueryResultPayload<T[] | T | null> {
    if (!this.expectSingle) {
      return { data: rows, error: null };
    }

    if (rows.length !== 1) {
      return {
        data: null,
        error: new DbClientError('JSON object requested, multiple (or no) rows returned', 'PGRST116'),
      };
    }

    return { data: rows[0], error: null };
  }

  private async executeSelect() {
    const values: unknown[] = [];
    const whereClause = this.buildWhereClause(values);

    if (this.headOnly && this.countRequested) {
      const query = `SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(this.table)}${whereClause}`;
      const result = await runQueryWithRetry(query, values);
      return {
        data: null,
        error: null,
        count: Number(result.rows[0]?.count ?? 0),
      };
    }

    const query = [
      `SELECT ${buildSelectClause(this.table, this.selectColumns)}`,
      `FROM ${quoteIdentifier(this.table)}`,
      whereClause,
      this.buildOrderClause(),
      this.buildLimitOffsetClause(values),
    ].join('');

    const result = await runQueryWithRetry(query, values);
    const normalized = this.normalizeResultRows(result.rows);
    return {
      ...normalized,
      count: this.countRequested ? result.rowCount : null,
    };
  }

  private async executeInsertLike(action: 'insert' | 'upsert') {
    if (this.insertRows.length === 0) {
      return { data: null, error: new DbClientError('Insert payload is empty') };
    }

    const sanitizedRows = this.insertRows.map(stripUndefinedFields);
    const columns = Array.from(
      new Set(sanitizedRows.flatMap((row) => Object.keys(row)))
    );

    if (columns.length === 0) {
      return { data: null, error: new DbClientError('Insert payload has no columns') };
    }

    const values: unknown[] = [];
    const valueGroups = sanitizedRows.map((row) => {
      const placeholders = columns.map((column) => {
        values.push(Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null);
        return `$${values.length}`;
      });

      return `(${placeholders.join(', ')})`;
    });

    const returningClause = this.returningColumns
      ? ` RETURNING ${buildSelectClause(this.table, this.returningColumns)}`
      : '';

    let conflictClause = '';
    if (action === 'upsert') {
      const conflictColumns = splitTopLevelCsv(this.upsertOptions.onConflict || '')
        .map((column) => column.trim())
        .filter(Boolean);

      if (conflictColumns.length === 0) {
        return { data: null, error: new DbClientError('Upsert requires onConflict columns') };
      }

      if (this.upsertOptions.ignoreDuplicates) {
        conflictClause = ` ON CONFLICT (${conflictColumns.map(quoteIdentifier).join(', ')}) DO NOTHING`;
      } else {
        const nonConflictColumns = columns.filter((column) => !conflictColumns.includes(column));
        const assignments = (nonConflictColumns.length > 0 ? nonConflictColumns : conflictColumns)
          .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
          .join(', ');

        conflictClause = ` ON CONFLICT (${conflictColumns.map(quoteIdentifier).join(', ')}) DO UPDATE SET ${assignments}`;
      }
    }

    const query = [
      `INSERT INTO ${quoteIdentifier(this.table)}`,
      `(${columns.map(quoteIdentifier).join(', ')})`,
      `VALUES ${valueGroups.join(', ')}`,
      conflictClause,
      returningClause,
    ].join(' ');

    const result = await runQueryWithRetry(query, values);
    if (!this.returningColumns) {
      return { data: null, error: null, count: result.rowCount };
    }

    const normalized = this.normalizeResultRows(result.rows);
    return {
      ...normalized,
      count: result.rowCount,
    };
  }

  private async executeUpdate() {
    const entries = Object.entries(this.updateValues).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      return { data: null, error: new DbClientError('Update payload is empty') };
    }

    const values: unknown[] = [];
    const assignments = entries.map(([column, value]) => {
      values.push(value);
      return `${quoteIdentifier(column)} = $${values.length}`;
    });

    const whereClause = this.buildWhereClause(values);
    const returningClause = this.returningColumns
      ? ` RETURNING ${buildSelectClause(this.table, this.returningColumns)}`
      : '';

    const query = `UPDATE ${quoteIdentifier(this.table)} SET ${assignments.join(', ')}${whereClause}${returningClause}`;
    const result = await runQueryWithRetry(query, values);

    if (!this.returningColumns) {
      return { data: null, error: null, count: result.rowCount };
    }

    const normalized = this.normalizeResultRows(result.rows);
    return {
      ...normalized,
      count: result.rowCount,
    };
  }

  private async executeDelete() {
    const values: unknown[] = [];
    const whereClause = this.buildWhereClause(values);
    const returningClause = this.returningColumns
      ? ` RETURNING ${buildSelectClause(this.table, this.returningColumns)}`
      : '';

    const query = `DELETE FROM ${quoteIdentifier(this.table)}${whereClause}${returningClause}`;
    const result = await runQueryWithRetry(query, values);

    if (!this.returningColumns) {
      return { data: null, error: null, count: result.rowCount };
    }

    const normalized = this.normalizeResultRows(result.rows);
    return {
      ...normalized,
      count: result.rowCount,
    };
  }

  async execute(): Promise<QueryResultPayload<any>> {
    try {
      if (this.action === 'select') {
        return await this.executeSelect();
      }

      if (this.action === 'insert') {
        return await this.executeInsertLike('insert');
      }

      if (this.action === 'upsert') {
        return await this.executeInsertLike('upsert');
      }

      if (this.action === 'update') {
        return await this.executeUpdate();
      }

      return await this.executeDelete();
    } catch (error) {
      return {
        data: this.expectSingle ? null : [],
        error: createDbError(error),
      };
    }
  }
}

export const supabaseAdmin = {
  from(table: string) {
    return new PostgresQueryBuilder(table);
  },
};

export async function initializeDb() {
  if (!databaseUrl) return;

  try {
    const result = await supabaseAdmin.from('users').select('id').limit(1);

    if (result.error?.code === '42P01') {
      console.error(
        '❌ SETUP REQUIRED: The "users" table does not exist in your Neon database.\n' +
        'Load your schema into Neon before starting the app.'
      );
    } else if (result.error) {
      console.warn('⚠️  Database connection warning:', result.error.message);
    } else {
      console.log('✅ Database users table verified');
    }
  } catch {
    console.log('ℹ️  Database connection initialized');
  }
}

if (typeof window === 'undefined') {
  initializeDb();
}
