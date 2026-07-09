/**
 * check-db-drift
 *
 * Compares the live PostgreSQL database against what the Drizzle schema
 * (lib/db/src/schema) declares, and fails loudly when they differ.
 *
 * It catches the class of bug where the live database falls out of sync with
 * the code's expectations — typically after a hand-applied schema change — which
 * otherwise surfaces as hard-to-diagnose 500 errors on pages like the task list
 * and dashboard.
 *
 * Beyond missing/extra tables and columns, it also flags columns whose data
 * type, nullability, or default presence/value disagrees with the schema. A
 * column that exists but has the wrong type or rules can still break pages.
 *
 * It also verifies the relational guardrails the schema declares — indexes
 * (`index(...)` / `uniqueIndex(...)`), unique constraints (column `.unique()` or
 * table-level `unique(...)`), and foreign keys (`.references(...)`). A missing
 * index can silently make pages slow; a missing unique constraint or foreign key
 * can let duplicate or orphaned rows in without anything noticing.
 *
 * Finally, it does the reverse comparison and warns about *extra* objects that
 * exist in the live database but are no longer declared in the schema — extra
 * tables, indexes, unique constraints, and foreign keys (extra columns are
 * already reported as a hard failure above). Leftover objects from old
 * hand-applied DDL can hide bugs (e.g. a stale unique index silently blocking
 * inserts). Primary-key and unique-constraint backing indexes are excluded so
 * the legitimate `*_pkey` / unique backing indexes are never flagged as noise.
 * Extras are warnings by default and do NOT fail the check; pass
 * `--strict-extras` to make them fail it too.
 *
 * Exit codes:
 *   0  schema and database agree (extra-object warnings may still be printed)
 *   1  drift detected (missing/extra columns, missing tables, column mismatches,
 *      or missing/mismatched indexes, unique constraints, or foreign keys), or
 *      extra objects were found while `--strict-extras` was set
 *   2  could not run the check (no DATABASE_URL, connection error, etc.)
 */
import { pathToFileURL } from "node:url";
import pg from "pg";
import { is, SQL } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "@workspace/db/schema";

export type ExpectedColumn = {
  name: string;
  /** Canonical Postgres type, e.g. "character varying(128)", "numeric(14,2)". */
  type: string;
  /** true when the column allows NULL (i.e. not declared notNull / primary). */
  nullable: boolean;
  /** true when the database is expected to carry a column default. */
  hasDefault: boolean;
  /**
   * Normalized literal default we can reliably compare against the live value
   * (e.g. "'member'", "0", "true", "'[]'"), or null when the default is an SQL
   * expression / sequence whose serialized form Postgres rewrites — in that
   * case only presence is checked, not the exact value.
   */
  defaultLiteral: string | null;
};

/** An index declared via `index(...)` / `uniqueIndex(...)` in the schema. */
type ExpectedIndex = {
  name: string;
  unique: boolean;
  /** Ordered column names the index covers. */
  columns: string[];
};

/** A unique constraint (column `.unique()` or table-level `unique(...)`). */
type ExpectedUnique = {
  name: string;
  /** Ordered column names the constraint covers. */
  columns: string[];
};

/** A foreign key declared via `.references(...)` / `foreignKey(...)`. */
type ExpectedForeignKey = {
  name: string;
  /** Ordered local column names. */
  columns: string[];
  foreignTable: string;
  /** Ordered referenced column names. */
  foreignColumns: string[];
  /** Normalized referential action, e.g. "no action", "cascade", "set null". */
  onDelete: string;
  onUpdate: string;
};

export type ExpectedTable = {
  table: string;
  columns: Map<string, ExpectedColumn>;
  indexes: ExpectedIndex[];
  uniques: ExpectedUnique[];
  foreignKeys: ExpectedForeignKey[];
};

export type ActualColumn = {
  name: string;
  type: string;
  nullable: boolean;
  hasDefault: boolean;
  /** Raw column_default text from information_schema (null when none). */
  rawDefault: string | null;
};

type ActualIndex = {
  unique: boolean;
  columns: string[];
  /**
   * true when this index backs a primary-key or unique constraint. Those are
   * created implicitly by Postgres for `*_pkey` and unique constraints, so they
   * must not be reported as "extra" indexes — they are covered by the column /
   * unique-constraint checks instead.
   */
  constraintBacked: boolean;
};

type ActualForeignKey = {
  columns: string[];
  foreignTable: string;
  foreignColumns: string[];
  onDelete: string;
  onUpdate: string;
};

const { Pool } = pg;

const SERIAL_TYPES: Record<string, string> = {
  serial: "integer",
  bigserial: "bigint",
  smallserial: "smallint",
};

/**
 * Map Drizzle's `getSQLType()` output onto the canonical form that
 * `information_schema` reports, so the two sides can be compared directly.
 */
export function canonicalizeDrizzleType(sqlType: string): string {
  const lower = sqlType.trim().toLowerCase();

  if (lower in SERIAL_TYPES) return SERIAL_TYPES[lower];

  const varcharMatch = lower.match(/^varchar(?:\((\d+)\))?$/);
  if (varcharMatch) {
    return varcharMatch[1]
      ? `character varying(${varcharMatch[1]})`
      : "character varying";
  }

  const charMatch = lower.match(/^char(?:\((\d+)\))?$/);
  if (charMatch) {
    return charMatch[1] ? `character(${charMatch[1]})` : "character";
  }

  if (lower === "timestamp") return "timestamp without time zone";

  // Collapse the space Drizzle emits in e.g. "numeric(14, 2)".
  return lower.replace(/,\s*/g, ",");
}

/** Build the canonical type string from an information_schema.columns row. */
export function canonicalizeLiveType(row: {
  data_type: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}): string {
  const dt = row.data_type;
  if (dt === "character varying" || dt === "character") {
    return row.character_maximum_length != null
      ? `${dt}(${row.character_maximum_length})`
      : dt;
  }
  if (dt === "numeric" && row.numeric_precision != null) {
    return row.numeric_scale != null
      ? `numeric(${row.numeric_precision},${row.numeric_scale})`
      : `numeric(${row.numeric_precision})`;
  }
  return dt;
}

/**
 * Derive the comparable literal default for a Drizzle column, or null when the
 * default is an SQL expression / auto-increment sequence (presence-only check).
 */
export function drizzleDefaultLiteral(
  column: ReturnType<typeof getTableConfig>["columns"][number],
  isSerial: boolean,
): string | null {
  if (isSerial) return null;
  const value = column.default;
  if (value === undefined) return null;
  if (is(value, SQL)) return null;

  const t = typeof value;
  if (t === "string") return `'${value as string}'`;
  if (t === "number" || t === "boolean" || t === "bigint") {
    return String(value);
  }
  if (t === "object" && value !== null) {
    // jsonb array/object literal (e.g. default([]) -> '[]').
    return `'${JSON.stringify(value)}'`;
  }
  return null;
}

/** Strip Postgres `::type` casts and wrapping parens for literal comparison. */
export function normalizeLiveDefault(raw: string): string {
  let s = raw.replace(/::[a-zA-Z_][a-zA-Z0-9_ ]*(?:\(\d+(?:,\d+)?\))?/g, "");
  s = s.trim();
  while (s.startsWith("(") && s.endsWith(")")) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Compare one expected (schema) column against its live (database) counterpart
 * and return a human-readable message for each kind of mismatch found (type,
 * nullability, default presence, default value). Returns an empty array when
 * the column matches. Pure: no database access, so it is unit-testable.
 */
export function compareColumn(
  table: string,
  expected: ExpectedColumn,
  live: ActualColumn,
): string[] {
  const mismatches: string[] = [];
  const columnName = expected.name;

  if (expected.type !== live.type) {
    mismatches.push(
      `${table}.${columnName}: type expected "${expected.type}", found "${live.type}"`,
    );
  }

  if (expected.nullable !== live.nullable) {
    mismatches.push(
      `${table}.${columnName}: nullability expected ${
        expected.nullable ? "NULL" : "NOT NULL"
      }, found ${live.nullable ? "NULL" : "NOT NULL"}`,
    );
  }

  if (expected.hasDefault !== live.hasDefault) {
    mismatches.push(
      `${table}.${columnName}: default expected ${
        expected.hasDefault
          ? expected.defaultLiteral ?? "a default"
          : "no default"
      }, found ${live.hasDefault ? live.rawDefault : "no default"}`,
    );
  } else if (
    expected.hasDefault &&
    live.hasDefault &&
    expected.defaultLiteral != null &&
    live.rawDefault != null &&
    expected.defaultLiteral !== normalizeLiveDefault(live.rawDefault)
  ) {
    mismatches.push(
      `${table}.${columnName}: default expected ${expected.defaultLiteral}, found ${live.rawDefault}`,
    );
  }

  return mismatches;
}

/**
 * Normalize a Drizzle referential action ("cascade", "set null", undefined …)
 * to the canonical lowercase form Postgres reports. An unset action defaults to
 * "no action", matching what Postgres records when none is declared.
 */
function normalizeReferentialAction(action: string | undefined): string {
  if (!action) return "no action";
  return action.trim().toLowerCase();
}

/** Pull the ordered column names off a Drizzle index/constraint column list. */
function indexColumnNames(columns: readonly unknown[]): string[] {
  return columns.map((col) => {
    if (col && typeof col === "object" && "name" in col) {
      return String((col as { name: unknown }).name);
    }
    // Expression-based index entry without a plain column name.
    return "<expression>";
  });
}

function collectExpectedTables(): ExpectedTable[] {
  const tables: ExpectedTable[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value);
    const columns = new Map<string, ExpectedColumn>();
    for (const column of config.columns) {
      const rawSqlType = column.getSQLType().trim().toLowerCase();
      const isSerial = rawSqlType in SERIAL_TYPES;
      const hasStaticDefault = column.default !== undefined;
      columns.set(column.name, {
        name: column.name,
        type: canonicalizeDrizzleType(column.getSQLType()),
        // Primary-key columns are implicitly NOT NULL even if notNull is unset.
        nullable: !(column.notNull || column.primary),
        // A DB default exists for sequences and static defaults; app-level
        // `$default` / `$onUpdate` functions do not create a column default.
        hasDefault: isSerial || hasStaticDefault,
        defaultLiteral: drizzleDefaultLiteral(column, isSerial),
      });
    }

    // Indexes declared via index(...) / uniqueIndex(...). Primary-key and
    // unique-constraint backing indexes are not reported here — those are
    // covered by the column / unique-constraint checks.
    const indexes: ExpectedIndex[] = [];
    for (const index of config.indexes) {
      // Drizzle types the index name as optional; in practice every declared
      // index here is named. Skip any nameless entry rather than guess.
      if (!index.config.name) continue;
      indexes.push({
        name: index.config.name,
        unique: index.config.unique === true,
        columns: indexColumnNames(index.config.columns ?? []),
      });
    }

    // Unique constraints: column-level `.unique()` (tracked on the column as
    // `isUnique` + `uniqueName`) plus any table-level `unique(...)` constraints.
    const uniques: ExpectedUnique[] = [];
    for (const column of config.columns) {
      if (column.isUnique && column.uniqueName) {
        uniques.push({ name: column.uniqueName, columns: [column.name] });
      }
    }
    for (const constraint of config.uniqueConstraints) {
      if (!constraint.name) continue;
      uniques.push({
        name: constraint.name,
        columns: constraint.columns.map((c) => c.name),
      });
    }

    const foreignKeys: ExpectedForeignKey[] = config.foreignKeys.map((fk) => {
      const ref = fk.reference();
      return {
        name: fk.getName(),
        columns: ref.columns.map((c) => c.name),
        foreignTable: getTableConfig(ref.foreignTable).name,
        foreignColumns: ref.foreignColumns.map((c) => c.name),
        onDelete: normalizeReferentialAction(fk.onDelete),
        onUpdate: normalizeReferentialAction(fk.onUpdate),
      };
    });

    tables.push({ table: config.name, columns, indexes, uniques, foreignKeys });
  }
  tables.sort((a, b) => a.table.localeCompare(b.table));
  return tables;
}

async function collectActualColumns(
  pool: pg.Pool,
): Promise<Map<string, Map<string, ActualColumn>>> {
  const { rows } = await pool.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    character_maximum_length: number | null;
    numeric_precision: number | null;
    numeric_scale: number | null;
    is_nullable: string;
    column_default: string | null;
  }>(
    `SELECT table_name, column_name, data_type, character_maximum_length,
            numeric_precision, numeric_scale, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position`,
  );
  const actual = new Map<string, Map<string, ActualColumn>>();
  for (const row of rows) {
    let cols = actual.get(row.table_name);
    if (!cols) {
      cols = new Map<string, ActualColumn>();
      actual.set(row.table_name, cols);
    }
    cols.set(row.column_name, {
      name: row.column_name,
      type: canonicalizeLiveType(row),
      nullable: row.is_nullable === "YES",
      hasDefault: row.column_default != null,
      rawDefault: row.column_default,
    });
  }
  return actual;
}

/** Postgres confdeltype / confupdtype codes → the action words Drizzle uses. */
const FK_ACTION_CODES: Record<string, string> = {
  a: "no action",
  r: "restrict",
  c: "cascade",
  n: "set null",
  d: "set default",
};

/**
 * Read every index in the public schema (name, uniqueness, ordered columns).
 * Includes primary-key and constraint-backing indexes; callers look indexes up
 * by the names the schema declares, so the extras are simply never consulted.
 */
async function collectActualIndexes(
  pool: pg.Pool,
): Promise<Map<string, Map<string, ActualIndex>>> {
  const { rows } = await pool.query<{
    table_name: string;
    index_name: string;
    is_unique: boolean;
    constraint_backed: boolean;
    columns: string[];
  }>(
    `SELECT t.relname AS table_name,
            i.relname AS index_name,
            ix.indisunique AS is_unique,
            bool_or(con.oid IS NOT NULL) AS constraint_backed,
            array_agg(a.attname::text ORDER BY k.ord) AS columns
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
       LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
       LEFT JOIN pg_constraint con ON con.conindid = i.oid
      WHERE n.nspname = 'public'
      GROUP BY t.relname, i.relname, ix.indisunique`,
  );
  const actual = new Map<string, Map<string, ActualIndex>>();
  for (const row of rows) {
    let byName = actual.get(row.table_name);
    if (!byName) {
      byName = new Map<string, ActualIndex>();
      actual.set(row.table_name, byName);
    }
    byName.set(row.index_name, {
      unique: row.is_unique,
      // attname is null for expression entries (attnum 0); normalize to match.
      columns: row.columns.map((c) => c ?? "<expression>"),
      constraintBacked: row.constraint_backed === true,
    });
  }
  return actual;
}

/** Read unique constraints (contype 'u') with their ordered columns. */
async function collectActualUniques(
  pool: pg.Pool,
): Promise<Map<string, Map<string, string[]>>> {
  const { rows } = await pool.query<{
    table_name: string;
    name: string;
    columns: string[];
  }>(
    `SELECT t.relname AS table_name,
            con.conname AS name,
            (SELECT array_agg(att.attname::text ORDER BY u.ord)
               FROM unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord)
               JOIN pg_attribute att
                 ON att.attrelid = con.conrelid AND att.attnum = u.attnum
            ) AS columns
       FROM pg_constraint con
       JOIN pg_class t ON t.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE con.contype = 'u' AND n.nspname = 'public'`,
  );
  const actual = new Map<string, Map<string, string[]>>();
  for (const row of rows) {
    let byName = actual.get(row.table_name);
    if (!byName) {
      byName = new Map<string, string[]>();
      actual.set(row.table_name, byName);
    }
    byName.set(row.name, row.columns);
  }
  return actual;
}

/** Read foreign keys (contype 'f') with columns, target, and FK actions. */
async function collectActualForeignKeys(
  pool: pg.Pool,
): Promise<Map<string, Map<string, ActualForeignKey>>> {
  const { rows } = await pool.query<{
    table_name: string;
    name: string;
    foreign_table: string;
    del: string;
    upd: string;
    columns: string[];
    foreign_columns: string[];
  }>(
    `SELECT t.relname AS table_name,
            con.conname AS name,
            ft.relname AS foreign_table,
            con.confdeltype AS del,
            con.confupdtype AS upd,
            (SELECT array_agg(att.attname::text ORDER BY u.ord)
               FROM unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord)
               JOIN pg_attribute att
                 ON att.attrelid = con.conrelid AND att.attnum = u.attnum
            ) AS columns,
            (SELECT array_agg(att.attname::text ORDER BY u.ord)
               FROM unnest(con.confkey) WITH ORDINALITY AS u(attnum, ord)
               JOIN pg_attribute att
                 ON att.attrelid = con.confrelid AND att.attnum = u.attnum
            ) AS foreign_columns
       FROM pg_constraint con
       JOIN pg_class t ON t.oid = con.conrelid
       JOIN pg_class ft ON ft.oid = con.confrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE con.contype = 'f' AND n.nspname = 'public'`,
  );
  const actual = new Map<string, Map<string, ActualForeignKey>>();
  for (const row of rows) {
    let byName = actual.get(row.table_name);
    if (!byName) {
      byName = new Map<string, ActualForeignKey>();
      actual.set(row.table_name, byName);
    }
    byName.set(row.name, {
      columns: row.columns,
      foreignTable: row.foreign_table,
      foreignColumns: row.foreign_columns,
      onDelete: FK_ACTION_CODES[row.del] ?? row.del,
      onUpdate: FK_ACTION_CODES[row.upd] ?? row.upd,
    });
  }
  return actual;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error(
      "✖ DATABASE_URL is not set. Cannot compare the live database against the schema.",
    );
    process.exit(2);
  }

  const expectedTables = collectExpectedTables();
  if (expectedTables.length === 0) {
    console.error("✖ No Drizzle tables found in @workspace/db/schema.");
    process.exit(2);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  let actual: Map<string, Map<string, ActualColumn>>;
  let actualIndexes: Map<string, Map<string, ActualIndex>>;
  let actualUniques: Map<string, Map<string, string[]>>;
  let actualForeignKeys: Map<string, Map<string, ActualForeignKey>>;
  try {
    [actual, actualIndexes, actualUniques, actualForeignKeys] =
      await Promise.all([
        collectActualColumns(pool),
        collectActualIndexes(pool),
        collectActualUniques(pool),
        collectActualForeignKeys(pool),
      ]);
  } catch (err) {
    console.error(
      `✖ Failed to read the live database schema: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    await pool.end();
    process.exit(2);
  }

  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  const extraColumns: string[] = [];
  const columnMismatches: string[] = [];
  const missingIndexes: string[] = [];
  const indexMismatches: string[] = [];
  const missingUniques: string[] = [];
  const uniqueMismatches: string[] = [];
  const missingForeignKeys: string[] = [];
  const foreignKeyMismatches: string[] = [];

  // Extras: objects present in the live database but absent from the schema.
  // Reported as warnings (do not fail the check) unless `--strict-extras` is
  // passed, in which case they fail it too.
  const extraTables: string[] = [];
  const extraIndexes: string[] = [];
  const extraUniques: string[] = [];
  const extraForeignKeys: string[] = [];

  const expectedTableNames = new Set(expectedTables.map((t) => t.table));

  for (const {
    table,
    columns,
    indexes,
    uniques,
    foreignKeys,
  } of expectedTables) {
    const actualColumns = actual.get(table);
    if (!actualColumns) {
      // The whole table is missing; its indexes / constraints / FKs are
      // implicitly missing too, so don't double-report them here.
      missingTables.push(table);
      continue;
    }
    for (const [columnName, expected] of columns) {
      const live = actualColumns.get(columnName);
      if (!live) {
        missingColumns.push(`${table}.${columnName}`);
        continue;
      }

      columnMismatches.push(...compareColumn(table, expected, live));
    }
    for (const columnName of actualColumns.keys()) {
      if (!columns.has(columnName)) {
        extraColumns.push(`${table}.${columnName}`);
      }
    }

    // Indexes declared in the schema.
    const liveIndexes = actualIndexes.get(table);
    for (const expected of indexes) {
      const live = liveIndexes?.get(expected.name);
      if (!live) {
        missingIndexes.push(
          `${table}.${expected.name} on (${expected.columns.join(", ")})`,
        );
        continue;
      }
      if (expected.columns.join(",") !== live.columns.join(",")) {
        indexMismatches.push(
          `${table}.${expected.name}: columns expected (${expected.columns.join(
            ", ",
          )}), found (${live.columns.join(", ")})`,
        );
      }
      if (expected.unique !== live.unique) {
        indexMismatches.push(
          `${table}.${expected.name}: uniqueness expected ${
            expected.unique ? "UNIQUE" : "non-unique"
          }, found ${live.unique ? "UNIQUE" : "non-unique"}`,
        );
      }
    }

    // Unique constraints declared in the schema.
    const liveUniques = actualUniques.get(table);
    for (const expected of uniques) {
      const live = liveUniques?.get(expected.name);
      if (!live) {
        missingUniques.push(
          `${table}.${expected.name} on (${expected.columns.join(", ")})`,
        );
        continue;
      }
      if (expected.columns.join(",") !== live.join(",")) {
        uniqueMismatches.push(
          `${table}.${expected.name}: columns expected (${expected.columns.join(
            ", ",
          )}), found (${live.join(", ")})`,
        );
      }
    }

    // Foreign keys declared in the schema.
    const liveForeignKeys = actualForeignKeys.get(table);
    for (const expected of foreignKeys) {
      const live = liveForeignKeys?.get(expected.name);
      if (!live) {
        missingForeignKeys.push(
          `${table}.${expected.name}: (${expected.columns.join(", ")}) → ${
            expected.foreignTable
          }(${expected.foreignColumns.join(", ")})`,
        );
        continue;
      }
      const expectedTarget = `${expected.foreignTable}(${expected.foreignColumns.join(
        ", ",
      )})`;
      const liveTarget = `${live.foreignTable}(${live.foreignColumns.join(", ")})`;
      if (
        expected.columns.join(",") !== live.columns.join(",") ||
        expectedTarget !== liveTarget
      ) {
        foreignKeyMismatches.push(
          `${table}.${expected.name}: mapping expected (${expected.columns.join(
            ", ",
          )}) → ${expectedTarget}, found (${live.columns.join(
            ", ",
          )}) → ${liveTarget}`,
        );
      }
      if (expected.onDelete !== live.onDelete) {
        foreignKeyMismatches.push(
          `${table}.${expected.name}: ON DELETE expected "${expected.onDelete}", found "${live.onDelete}"`,
        );
      }
      if (expected.onUpdate !== live.onUpdate) {
        foreignKeyMismatches.push(
          `${table}.${expected.name}: ON UPDATE expected "${expected.onUpdate}", found "${live.onUpdate}"`,
        );
      }
    }

    // --- Reverse comparison: extras present in the database, not the schema ---

    // Extra indexes. Primary-key and unique-constraint backing indexes are
    // created implicitly by Postgres, so they are excluded — they are covered
    // by the column / unique-constraint checks, not treated as leftover noise.
    const expectedIndexNames = new Set(indexes.map((i) => i.name));
    if (liveIndexes) {
      for (const [name, live] of liveIndexes) {
        if (live.constraintBacked) continue;
        if (!expectedIndexNames.has(name)) {
          extraIndexes.push(`${table}.${name} on (${live.columns.join(", ")})`);
        }
      }
    }

    // Extra unique constraints.
    const expectedUniqueNames = new Set(uniques.map((u) => u.name));
    if (liveUniques) {
      for (const [name, cols] of liveUniques) {
        if (!expectedUniqueNames.has(name)) {
          extraUniques.push(`${table}.${name} on (${cols.join(", ")})`);
        }
      }
    }

    // Extra foreign keys.
    const expectedForeignKeyNames = new Set(foreignKeys.map((f) => f.name));
    if (liveForeignKeys) {
      for (const [name, live] of liveForeignKeys) {
        if (!expectedForeignKeyNames.has(name)) {
          extraForeignKeys.push(
            `${table}.${name}: (${live.columns.join(", ")}) → ${
              live.foreignTable
            }(${live.foreignColumns.join(", ")})`,
          );
        }
      }
    }
  }

  // Extra tables: live tables with no matching declaration in the schema. Their
  // indexes / constraints / FKs are not separately reported — the table itself
  // is the leftover object.
  for (const liveTable of actual.keys()) {
    if (!expectedTableNames.has(liveTable)) {
      extraTables.push(liveTable);
    }
  }

  await pool.end();

  const hasDrift =
    missingTables.length > 0 ||
    missingColumns.length > 0 ||
    extraColumns.length > 0 ||
    columnMismatches.length > 0 ||
    missingIndexes.length > 0 ||
    indexMismatches.length > 0 ||
    missingUniques.length > 0 ||
    uniqueMismatches.length > 0 ||
    missingForeignKeys.length > 0 ||
    foreignKeyMismatches.length > 0;

  const strictExtras = process.argv.includes("--strict-extras");
  const hasExtras =
    extraTables.length > 0 ||
    extraIndexes.length > 0 ||
    extraUniques.length > 0 ||
    extraForeignKeys.length > 0;

  if (!hasDrift && !hasExtras) {
    console.log(
      `✔ Database matches the Drizzle schema (${expectedTables.length} tables checked).`,
    );
    process.exit(0);
  }

  // Hard-failure drift first.
  if (hasDrift) {
    console.error("✖ Database schema drift detected.\n");
  }

  if (missingTables.length > 0) {
    console.error(
      `Missing tables (declared in schema, absent in database) — ${missingTables.length}:`,
    );
    for (const t of missingTables.sort()) console.error(`  - ${t}`);
    console.error("");
  }

  if (missingColumns.length > 0) {
    console.error(
      `Missing columns (declared in schema, absent in database) — ${missingColumns.length}:`,
    );
    for (const c of missingColumns.sort()) console.error(`  - ${c}`);
    console.error("");
  }

  if (extraColumns.length > 0) {
    console.error(
      `Extra columns (present in database, not in schema) — ${extraColumns.length}:`,
    );
    for (const c of extraColumns.sort()) console.error(`  - ${c}`);
    console.error("");
  }

  if (columnMismatches.length > 0) {
    console.error(
      `Column mismatches (type / nullability / default differs) — ${columnMismatches.length}:`,
    );
    for (const c of columnMismatches.sort()) console.error(`  - ${c}`);
    console.error("");
  }

  if (missingIndexes.length > 0) {
    console.error(
      `Missing indexes (declared in schema, absent in database) — ${missingIndexes.length}:`,
    );
    for (const i of missingIndexes.sort()) console.error(`  - ${i}`);
    console.error("");
  }

  if (indexMismatches.length > 0) {
    console.error(
      `Index mismatches (columns / uniqueness differs) — ${indexMismatches.length}:`,
    );
    for (const i of indexMismatches.sort()) console.error(`  - ${i}`);
    console.error("");
  }

  if (missingUniques.length > 0) {
    console.error(
      `Missing unique constraints (declared in schema, absent in database) — ${missingUniques.length}:`,
    );
    for (const u of missingUniques.sort()) console.error(`  - ${u}`);
    console.error("");
  }

  if (uniqueMismatches.length > 0) {
    console.error(
      `Unique constraint mismatches (columns differ) — ${uniqueMismatches.length}:`,
    );
    for (const u of uniqueMismatches.sort()) console.error(`  - ${u}`);
    console.error("");
  }

  if (missingForeignKeys.length > 0) {
    console.error(
      `Missing foreign keys (declared in schema, absent in database) — ${missingForeignKeys.length}:`,
    );
    for (const f of missingForeignKeys.sort()) console.error(`  - ${f}`);
    console.error("");
  }

  if (foreignKeyMismatches.length > 0) {
    console.error(
      `Foreign key mismatches (mapping / referential action differs) — ${foreignKeyMismatches.length}:`,
    );
    for (const f of foreignKeyMismatches.sort()) console.error(`  - ${f}`);
    console.error("");
  }

  if (hasDrift) {
    console.error(
      "Fix: apply the schema changes to the database (dev: `pnpm --filter @workspace/db run push`) " +
        "or update the Drizzle schema to match, then re-run this check.",
    );
  }

  // Extras are reported as a distinct section. By default they are warnings and
  // do not fail the check; with `--strict-extras` they fail it too. Primary-key
  // and unique-constraint backing indexes are excluded above, so the legitimate
  // `*_pkey` and unique backing indexes never show up here as noise.
  if (hasExtras) {
    const log = strictExtras ? console.error : console.warn;
    const mark = strictExtras ? "✖" : "⚠";
    if (hasDrift) log("");
    log(
      `${mark} Extra database objects present in the database but not declared in the schema` +
        (strictExtras ? " (failing because --strict-extras is set):\n" : ":\n"),
    );

    if (extraTables.length > 0) {
      log(`Extra tables — ${extraTables.length}:`);
      for (const t of extraTables.sort()) log(`  - ${t}`);
      log("");
    }

    if (extraIndexes.length > 0) {
      log(`Extra indexes — ${extraIndexes.length}:`);
      for (const i of extraIndexes.sort()) log(`  - ${i}`);
      log("");
    }

    if (extraUniques.length > 0) {
      log(`Extra unique constraints — ${extraUniques.length}:`);
      for (const u of extraUniques.sort()) log(`  - ${u}`);
      log("");
    }

    if (extraForeignKeys.length > 0) {
      log(`Extra foreign keys — ${extraForeignKeys.length}:`);
      for (const f of extraForeignKeys.sort()) log(`  - ${f}`);
      log("");
    }

    log(
      "These objects exist in the database but are no longer declared in the Drizzle " +
        "schema. Drop them once you confirm nothing depends on them, or add them back " +
        "to the schema.",
    );
  }

  if (hasDrift || (strictExtras && hasExtras)) {
    process.exit(1);
  }

  // Only non-failing extra-object warnings remain: the schema itself matches.
  console.log(
    `\n✔ Database matches the Drizzle schema (${expectedTables.length} tables checked), ` +
      "but extra objects were found — see the warnings above.",
  );
  process.exit(0);
}

const invokedDirectly =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error(
      `✖ Unexpected error running the drift check: ${
        err instanceof Error ? err.stack ?? err.message : String(err)
      }`,
    );
    process.exit(2);
  });
}
