'use strict';
// Log dạng JSON, mỗi dòng một sự kiện, ghi ra stdout -> Docker -> Promtail -> Loki.
// Nhờ định dạng JSON, LogQL có thể dùng `| json | event="login_failed"` để lọc.
const { EventEmitter } = require('events');

// Bus nội bộ: module metrics (nếu có) lắng nghe các sự kiện nghiệp vụ để đếm.
const bus = new EventEmitter();

function write(level, fields) {
  process.stdout.write(JSON.stringify({ time: new Date().toISOString(), level, ...fields }) + '\n');
}

const log = {
  info: (fields) => write('info', fields),
  warn: (fields) => write('warn', fields),
  error: (fields) => write('error', fields),
};

// Sự kiện nghiệp vụ / bảo mật (đăng nhập, mượn, trả...).
function audit(event, fields = {}, level = 'info') {
  write(level, { type: 'audit', event, ...fields });
  bus.emit(event, fields);
}

// Access log của ứng dụng (khác access log của Nginx).
function accessLog(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0];
    if (path === '/health' || path === '/metrics') return;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;
    write(status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', {
      type: 'access',
      method: req.method,
      path,
      status,
      duration_ms: Math.round(ms * 10) / 10,
      ip: req.ip,
      user: req.session && req.session.user ? req.session.user.username : null,
    });
  });
  next();
}

module.exports = { log, audit, accessLog, bus };
