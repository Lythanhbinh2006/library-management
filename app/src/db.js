'use strict';
const { Pool, types } = require('pg');
const config = require('./config');
const { log } = require('./logger');

// DATE -> chuỗi 'YYYY-MM-DD' (tránh lệch múi giờ khi pg chuyển thành Date)
types.setTypeParser(1082, (v) => v);
// BIGINT (COUNT/SUM) -> number
types.setTypeParser(20, (v) => Number.parseInt(v, 10));

const pool = new Pool({
  ...config.db,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => log.error({ type: 'db', msg: 'Lỗi pool PostgreSQL', error: err.message }));

const query = (text, params) => pool.query(text, params);

// Chạy fn trong một transaction; tự ROLLBACK nếu có lỗi.
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* bỏ qua */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, tx };
