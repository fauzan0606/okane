import "dotenv/config";
import Database from "better-sqlite3";
import pg from "pg";

const { Client } = pg;

const sqlite = new Database("okane.db", {
  readonly: true,
});

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString?.startsWith("postgres")) {
  throw new Error("DIRECT_URL/DATABASE_URL PostgreSQL tidak valid.");
}

const client = new Client({
  connectionString,
});

const quote = (name) => `"${String(name).replaceAll('"', '""')}"`;

function sqliteTables() {
  return sqlite
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name <> '_prisma_migrations'
      ORDER BY name
    `)
    .all()
    .map((r) => r.name);
}

function sqliteColumns(table) {
  return sqlite
    .prepare(`PRAGMA table_info(${quote(table)})`)
    .all()
    .map((r) => r.name);
}

function sqliteDependencies(table) {
  return sqlite
    .prepare(`PRAGMA foreign_key_list(${quote(table)})`)
    .all()
    .map((r) => r.table)
    .filter(Boolean);
}

function orderTables(tables) {
  const tableSet = new Set(tables);
  const state = new Map();
  const result = [];

  function visit(table, stack = []) {
    const current = state.get(table);

    if (current === "done") return;

    if (current === "visiting") {
      const cycle = [...stack, table].join(" -> ");
      throw new Error(`Circular foreign key terdeteksi: ${cycle}`);
    }

    state.set(table, "visiting");

    for (const dependency of sqliteDependencies(table)) {
      if (tableSet.has(dependency) && dependency !== table) {
        visit(dependency, [...stack, table]);
      }
    }

    state.set(table, "done");
    result.push(table);
  }

  for (const table of tables) {
    visit(table);
  }

  return result;
}

async function postgresTables() {
  const { rows } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `);

  return rows.map((r) => r.table_name);
}

async function postgresCount(table) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::bigint AS count FROM ${quote(table)}`
  );

  return Number(rows[0].count);
}

function normalizeValue(value) {
  if (value === undefined) return null;
  return value;
}

async function migrateTable(table) {
  const columns = sqliteColumns(table);

  if (!columns.length) {
    console.log(`- ${table}: tidak ada kolom, dilewati`);
    return 0;
  }

  const rows = sqlite
    .prepare(`SELECT * FROM ${quote(table)}`)
    .all();

  if (!rows.length) {
    console.log(`- ${table}: 0 row`);
    return 0;
  }

  const columnSql = columns.map(quote).join(", ");
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

  const insertSql = `
    INSERT INTO ${quote(table)} (${columnSql})
    VALUES (${placeholders})
  `;

  const insert = {
    text: insertSql,
  };

  for (const row of rows) {
    const values = columns.map((column) =>
      normalizeValue(row[column])
    );

    await client.query(insert.text, values);
  }

  console.log(`- ${table}: ${rows.length} row`);
  return rows.length;
}

async function resetSequences() {
  const { rows } = await client.query(`
    SELECT
      table_name,
      column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_default LIKE 'nextval(%'
  `);

  for (const row of rows) {
    const table = row.table_name;
    const column = row.column_name;

    const sequenceResult = await client.query(
      `SELECT pg_get_serial_sequence($1, $2) AS sequence_name`,
      [`public.${table}`, column]
    );

    const sequenceName = sequenceResult.rows[0]?.sequence_name;

    if (!sequenceName) continue;

    const maxResult = await client.query(
      `SELECT MAX(${quote(column)}) AS max_value FROM ${quote(table)}`
    );

    const maxValue = maxResult.rows[0]?.max_value;

    if (maxValue === null || maxValue === undefined) continue;

    await client.query(
      `SELECT setval($1, $2, true)`,
      [sequenceName, maxValue]
    );
  }
}

async function verify(tables) {
  console.log("\n=== VERIFIKASI ===");

  let totalSqlite = 0;
  let totalPostgres = 0;

  for (const table of tables) {
    const sqliteCount = sqlite
      .prepare(`SELECT COUNT(*) AS count FROM ${quote(table)}`)
      .get().count;

    const postgresCount = await postgresCountForTable(table);

    totalSqlite += Number(sqliteCount);
    totalPostgres += Number(postgresCount);

    const status = Number(sqliteCount) === Number(postgresCount)
      ? "OK"
      : "MISMATCH";

    console.log(
      `${status.padEnd(9)} ${table.padEnd(35)} SQLite=${sqliteCount} PostgreSQL=${postgresCount}`
    );

    if (status !== "OK") {
      throw new Error(`Jumlah data berbeda pada tabel ${table}`);
    }
  }

  console.log("\nSemua jumlah row cocok.");
  console.log(`Total SQLite     : ${totalSqlite}`);
  console.log(`Total PostgreSQL : ${totalPostgres}`);
}

async function postgresCountForTable(table) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::bigint AS count FROM ${quote(table)}`
  );

  return Number(rows[0].count);
}

async function main() {
  const tables = sqliteTables();
  const pgTables = await postgresTables();

  const missing = tables.filter((table) => !pgTables.includes(table));

  if (missing.length) {
    throw new Error(
      `Tabel SQLite tidak ditemukan di PostgreSQL: ${missing.join(", ")}`
    );
  }

  const orderedTables = orderTables(tables);

  console.log("=== URUTAN MIGRASI ===");
  console.log(orderedTables.join(" -> "));

  console.log("\n=== CEK DATABASE TUJUAN ===");

  for (const table of orderedTables) {
    const count = await postgresCountForTable(table);

    if (count !== 0) {
      throw new Error(
        `Database PostgreSQL tidak kosong: tabel ${table} memiliki ${count} row.`
      );
    }
  }

  console.log("PostgreSQL masih kosong. Aman untuk migrasi.\n");

  await client.query("BEGIN");

  try {
    for (const table of orderedTables) {
      await migrateTable(table);
    }

    await resetSequences();

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  await verify(orderedTables);

  console.log("\n✅ MIGRASI SELESAI.");
}

try {
  await client.connect();
  await main();
} catch (error) {
  console.error("\n❌ MIGRASI GAGAL");
  console.error(error);
  process.exitCode = 1;
} finally {
  sqlite.close();
  await client.end().catch(() => {});
}
