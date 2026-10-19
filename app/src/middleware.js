'use strict';
const crypto = require('crypto');
const { audit } = require('./logger');
const views = require('./views');

// Lỗi do người dùng nhập sai / vi phạm quy tắc nghiệp vụ (hiển thị được cho người dùng)
class UserError extends Error {}

function ensureCsrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  next();
}

// Chống CSRF: mọi POST phải mang token khớp với token trong session.
function verifyCsrf(req, res, next) {
  if (req.method !== 'POST') return next();
  const sent = Buffer.from(String((req.body && req.body._csrf) || ''));
  const expected = Buffer.from(String(req.session.csrf || ''));
  const ok = sent.length > 0 && sent.length === expected.length && crypto.timingSafeEqual(sent, expected);
  if (!ok) {
    audit('csrf_rejected', { ip: req.ip, path: req.originalUrl.split('?')[0] }, 'warn');
    return res.status(403).page('Yêu cầu bị từ chối', views.errorBox(403, 'Phiên làm việc không hợp lệ. Hãy tải lại trang và thử lại.'));
  }
  return next();
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  return next();
}

function flash(req, type, msg) {
  req.session.flash = { type, msg };
}

// Chuyển tham số đường dẫn thành số nguyên dương (hoặc null)
function intParam(v) {
  const n = Number.parseInt(v, 10);
  return /^\d+$/.test(String(v)) && Number.isInteger(n) && n > 0 ? n : null;
}

module.exports = { UserError, ensureCsrf, verifyCsrf, requireLogin, flash, intParam };
