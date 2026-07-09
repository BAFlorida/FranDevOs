import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";

import {
  canonicalizeDrizzleType,
  canonicalizeLiveType,
  compareColumn,
  drizzleDefaultLiteral,
  normalizeLiveDefault,
  type ActualColumn,
  type ExpectedColumn,
} from "./check-db-drift";

describe("canonicalizeDrizzleType", () => {
  it("maps serial family to its underlying integer type", () => {
    assert.equal(canonicalizeDrizzleType("serial"), "integer");
    assert.equal(canonicalizeDrizzleType("bigserial"), "bigint");
    assert.equal(canonicalizeDrizzleType("smallserial"), "smallint");
  });

  it("expands varchar with and without a length", () => {
    assert.equal(
      canonicalizeDrizzleType("varchar(128)"),
      "character varying(128)",
    );
    assert.equal(canonicalizeDrizzleType("varchar"), "character varying");
  });

  it("expands char with and without a length", () => {
    assert.equal(canonicalizeDrizzleType("char(4)"), "character(4)");
    assert.equal(canonicalizeDrizzleType("char"), "character");
  });

  it("normalizes timestamp to the information_schema spelling", () => {
    assert.equal(
      canonicalizeDrizzleType("timestamp"),
      "timestamp without time zone",
    );
  });

  it("collapses whitespace inside numeric precision/scale", () => {
    assert.equal(canonicalizeDrizzleType("numeric(14, 2)"), "numeric(14,2)");
    assert.equal(canonicalizeDrizzleType("numeric(10)"), "numeric(10)");
  });

  it("lowercases and passes through other types unchanged", () => {
    assert.equal(canonicalizeDrizzleType("INTEGER"), "integer");
    assert.equal(canonicalizeDrizzleType("jsonb"), "jsonb");
    assert.equal(canonicalizeDrizzleType("boolean"), "boolean");
  });
});

describe("canonicalizeLiveType", () => {
  it("appends the character maximum length for varchar/char", () => {
    assert.equal(
      canonicalizeLiveType({
        data_type: "character varying",
        character_maximum_length: 128,
        numeric_precision: null,
        numeric_scale: null,
      }),
      "character varying(128)",
    );
    assert.equal(
      canonicalizeLiveType({
        data_type: "character",
        character_maximum_length: 4,
        numeric_precision: null,
        numeric_scale: null,
      }),
      "character(4)",
    );
  });

  it("leaves varchar/char without a max length bare", () => {
    assert.equal(
      canonicalizeLiveType({
        data_type: "character varying",
        character_maximum_length: null,
        numeric_precision: null,
        numeric_scale: null,
      }),
      "character varying",
    );
  });

  it("renders numeric precision with and without scale", () => {
    assert.equal(
      canonicalizeLiveType({
        data_type: "numeric",
        character_maximum_length: null,
        numeric_precision: 14,
        numeric_scale: 2,
      }),
      "numeric(14,2)",
    );
    assert.equal(
      canonicalizeLiveType({
        data_type: "numeric",
        character_maximum_length: null,
        numeric_precision: 10,
        numeric_scale: null,
      }),
      "numeric(10)",
    );
  });

  it("passes through plain types unchanged", () => {
    assert.equal(
      canonicalizeLiveType({
        data_type: "timestamp without time zone",
        character_maximum_length: null,
        numeric_precision: null,
        numeric_scale: null,
      }),
      "timestamp without time zone",
    );
    assert.equal(
      canonicalizeLiveType({
        data_type: "integer",
        character_maximum_length: null,
        numeric_precision: 32,
        numeric_scale: 0,
      }),
      "integer",
    );
  });
});

describe("drizzleDefaultLiteral", () => {
  // The function only reads `column.default`, so a minimal stand-in suffices.
  const col = (def: unknown) =>
    ({ default: def }) as Parameters<typeof drizzleDefaultLiteral>[0];

  it("returns null for serial columns (presence-only check)", () => {
    assert.equal(drizzleDefaultLiteral(col("ignored"), true), null);
  });

  it("returns null when there is no default", () => {
    assert.equal(drizzleDefaultLiteral(col(undefined), false), null);
  });

  it("returns null for SQL-expression defaults", () => {
    assert.equal(drizzleDefaultLiteral(col(sql`now()`), false), null);
  });

  it("quotes string defaults", () => {
    assert.equal(drizzleDefaultLiteral(col("member"), false), "'member'");
  });

  it("stringifies number, boolean and bigint defaults", () => {
    assert.equal(drizzleDefaultLiteral(col(0), false), "0");
    assert.equal(drizzleDefaultLiteral(col(true), false), "true");
    assert.equal(drizzleDefaultLiteral(col(false), false), "false");
    assert.equal(drizzleDefaultLiteral(col(10n), false), "10");
  });

  it("serializes object/array defaults as a quoted JSON literal", () => {
    assert.equal(drizzleDefaultLiteral(col([]), false), "'[]'");
    assert.equal(drizzleDefaultLiteral(col({ a: 1 }), false), `'{"a":1}'`);
  });
});

describe("normalizeLiveDefault", () => {
  it("strips a simple type cast", () => {
    assert.equal(normalizeLiveDefault("'member'::text"), "'member'");
  });

  it("strips parameterized type casts", () => {
    assert.equal(
      normalizeLiveDefault("'member'::character varying(128)"),
      "'member'",
    );
    assert.equal(normalizeLiveDefault("0::numeric(14,2)"), "0");
  });

  it("strips wrapping parentheses", () => {
    assert.equal(normalizeLiveDefault("(0)"), "0");
    assert.equal(normalizeLiveDefault("((1))"), "1");
  });

  it("strips parentheses and casts together", () => {
    assert.equal(normalizeLiveDefault("('[]'::jsonb)"), "'[]'");
  });

  it("leaves a bare literal untouched", () => {
    assert.equal(normalizeLiveDefault("true"), "true");
  });
});

describe("compareColumn", () => {
  const base = (
    overrides: Partial<ExpectedColumn> = {},
  ): ExpectedColumn => ({
    name: "role",
    type: "character varying(128)",
    nullable: false,
    hasDefault: true,
    defaultLiteral: "'member'",
    ...overrides,
  });

  const live = (overrides: Partial<ActualColumn> = {}): ActualColumn => ({
    name: "role",
    type: "character varying(128)",
    nullable: false,
    hasDefault: true,
    rawDefault: "'member'::character varying",
    ...overrides,
  });

  it("returns no mismatches when expected and live agree", () => {
    assert.deepEqual(compareColumn("users", base(), live()), []);
  });

  it("treats a presence-only default (null literal) as matching when both have one", () => {
    const expected = base({ defaultLiteral: null });
    const actual = live({ rawDefault: "nextval('users_id_seq'::regclass)" });
    assert.deepEqual(compareColumn("users", expected, actual), []);
  });

  it("flags a type mismatch", () => {
    const result = compareColumn(
      "users",
      base(),
      live({ type: "text" }),
    );
    assert.equal(result.length, 1);
    assert.match(result[0], /type expected "character varying\(128\)"/);
    assert.match(result[0], /found "text"/);
  });

  it("flags a nullability mismatch", () => {
    const result = compareColumn("users", base(), live({ nullable: true }));
    assert.equal(result.length, 1);
    assert.match(result[0], /nullability expected NOT NULL, found NULL/);
  });

  it("flags a missing default in the database", () => {
    const result = compareColumn(
      "users",
      base(),
      live({ hasDefault: false, rawDefault: null }),
    );
    assert.equal(result.length, 1);
    assert.match(result[0], /default expected 'member', found no default/);
  });

  it("flags an unexpected default in the database", () => {
    const expected = base({ hasDefault: false, defaultLiteral: null });
    const result = compareColumn("users", expected, live());
    assert.equal(result.length, 1);
    assert.match(
      result[0],
      /default expected no default, found 'member'::character varying/,
    );
  });

  it("flags a differing default value", () => {
    const result = compareColumn(
      "users",
      base(),
      live({ rawDefault: "'admin'::character varying" }),
    );
    assert.equal(result.length, 1);
    assert.match(
      result[0],
      /default expected 'member', found 'admin'::character varying/,
    );
  });

  it("does not flag a default value difference that is only a type cast", () => {
    const result = compareColumn(
      "users",
      base({ defaultLiteral: "0" }),
      live({ rawDefault: "(0)::numeric(14,2)" }),
    );
    assert.deepEqual(result, []);
  });

  it("reports every kind of mismatch at once", () => {
    const result = compareColumn(
      "users",
      base(),
      live({ type: "text", nullable: true, rawDefault: "'admin'::text" }),
    );
    assert.equal(result.length, 3);
  });
});
