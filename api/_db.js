// Database access for Campus360 (Supabase Postgres).
// Both helpers return row arrays. The tagged-template helper preserves existing API call sites
// while node-postgres sends interpolated values as parameters.
const MIGRATIONS = require('./_migrations');

let client = null;
let pool = null;
function getPool() {
  if (!pool) {
    if (!process.env.SUPABASE_DB_URL) {
      const e = new Error('The Supabase database is not configured.');
      e.code = 'DB_NOT_CONFIGURED';
      throw e;
    }
    const { Pool } = require('pg');
    // Use the Supabase transaction-pooler URL (port 6543), which is designed for serverless APIs.
    pool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL,
      max: 2,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
      allowExitOnIdle: true,
    });
    pool.on('error', (err) => console.error('Supabase Postgres pool error:', err.code || 'unknown'));
  }
  return pool;
}

function q(text, params = []) {
  if (client) return client(text, params);
  return (async () => {
    const connection = await getPool().connect();
    try {
      // Transaction-local search_path works with Supabase's transaction pooler and keeps the
      // application's tables in its private schema without changing the existing `campus` schema.
      await connection.query('begin');
      await connection.query('set local search_path to campus360_api, public');
      const result = await connection.query(text, params);
      await connection.query('commit');
      return result.rows;
    } catch (err) {
      await connection.query('rollback').catch(() => {});
      throw err;
    } finally {
      connection.release();
    }
  })();
}

// Compatibility layer for existing tagged-template SQL calls.
function sql(strings, ...values) {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`;
  return q(text, values);
}

let ready = null;
async function migrate(run = q) {
  // Keep the Supabase schema created for this API separate from the existing `campus` schema.
  if (run === q) await run('create schema if not exists campus360_api');
  await run('create table if not exists schema_migrations (id int primary key, name text not null, applied_at timestamptz not null default now())');
  const done = new Set((await run('select id from schema_migrations')).map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    for (const stmt of m.up) await run(stmt);
    await run('insert into schema_migrations (id, name) values ($1, $2) on conflict (id) do nothing', [m.id, m.name]);
  }
}
const ensureSchema = () => (ready = ready || migrate().catch((e) => { ready = null; throw e; }));

/** Fixed-window rate limit. Returns true when the call is allowed. */
async function allow(key, max, windowSec) {
  const [r] = await q(
    `insert into rate_limits (key, window_start, count) values ($1, now(), 1)
     on conflict (key) do update set
       count = case when rate_limits.window_start < now() - make_interval(secs => $2) then 1 else rate_limits.count + 1 end,
       window_start = case when rate_limits.window_start < now() - make_interval(secs => $2) then now() else rate_limits.window_start end
     returning count`, [key, windowSec]);
  return r.count <= max;
}
const audit = (actor, action, target, detail, branch) =>
  q('insert into audit_log (actor, action, target, detail, branch_code) values ($1, $2, $3, $4, $5)', [actor || null, action, target || null, detail ? JSON.stringify(detail) : null, branch || null]);

/** Tests inject an in-memory Postgres. */
function _setClient(fn) { client = fn; ready = null; }

module.exports = { q, sql, ensureSchema, migrate, allow, audit, _setClient };
