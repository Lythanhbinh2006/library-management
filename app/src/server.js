'use strict';
const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');

const config = require('./config');
const db = require('./db');
const views = require('./views');
const { log, accessLog } = require('./logger');
const { ensureCsrf, verifyCsrf } = require('./middleware');
const metrics = require('./metrics');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // phía trước là Nginx (1 hop)

app.use(metrics.middleware);
app.get('/metrics', metrics.handler); // Nginx chặn đường dẫn này ra ngoài; Prometheus gọi trực tiếp trong mạng nội bộ

// Healthcheck (Docker + Nginx dùng)
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'error' });
  }
});

app.use('/static', express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h', index: false }));
app.use(accessLog);
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

app.use(session({
  store: new PgSession({ pool: db.pool, tableName: 'session' }),
  name: 'library.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 8 * 60 * 60 * 1000 },
}));

// res.page(): render trang HTML trong khung giao diện
app.use((req, res, next) => {
  res.page = function page(title, body, opts = {}) {
    const s = req.session || {};
    const flash = s.flash;
    if (req.session) delete req.session.flash;
    res.set('Cache-Control', 'no-store');
    res.type('html').send(views.layout({
      title, user: s.user, flash, csrf: s.csrf, active: opts.active, bare: opts.bare, body,
    }).toString());
  };
  next();
});

app.use(ensureCsrf);
app.use(verifyCsrf);

app.use(require('./routes/auth'));
app.use(require('./routes/dashboard'));
app.use(require('./routes/books'));
app.use(require('./routes/members'));
app.use(require('./routes/loans'));

app.use((req, res) => {
  res.status(404).page('Không tìm thấy', views.errorBox(404, 'Trang bạn tìm không tồn tại.'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  log.error({
    type: 'app',
    msg: err.message,
    code: err.code,
    path: req.originalUrl.split('?')[0],
    stack: String(err.stack || '').split('\n').slice(0, 4).join(' | '),
  });
  if (res.headersSent) return next(err);
  return res.status(500).page('Lỗi hệ thống', views.errorBox(500, 'Có lỗi xảy ra. Vui lòng thử lại sau.'));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDb() {
  for (let i = 1; i <= 15; i += 1) {
    try { await db.query('SELECT 1'); return; } catch (err) {
      log.warn({ type: 'app', msg: `Chờ PostgreSQL (lần ${i}/15)`, error: err.message });
      await sleep(2000);
    }
  }
  throw new Error('Không kết nối được PostgreSQL');
}

// Tạo tài khoản quản trị lần đầu từ biến môi trường (mật khẩu được băm bcrypt, không lưu trong SQL/mã nguồn).
async function ensureAdmin() {
  const { rows } = await db.query('SELECT 1 FROM users WHERE username = $1', [config.admin.username]);
  if (rows.length > 0) return;
  const hash = await bcrypt.hash(config.admin.password, 12);
  await db.query(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
    [config.admin.username, hash, 'Quản trị viên', 'admin'],
  );
  log.info({ type: 'app', msg: `Đã tạo tài khoản quản trị '${config.admin.username}'` });
}

async function main() {
  await waitForDb();
  await ensureAdmin();
  const server = app.listen(config.port, '0.0.0.0', () => {
    log.info({ type: 'app', msg: `Library app lắng nghe cổng ${config.port}`, env: config.env });
  });
  const shutdown = (signal) => {
    log.info({ type: 'app', msg: `Nhận ${signal}, đang tắt` });
    server.close(() => db.pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  log.error({ type: 'app', msg: 'Khởi động thất bại', error: err.message });
  process.exit(1);
});
