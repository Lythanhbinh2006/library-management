'use strict';
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const views = require('../views');
const { audit } = require('../logger');

const router = express.Router();
// Hash giả để thời gian phản hồi gần như nhau dù tên đăng nhập có tồn tại hay không.
const DUMMY_HASH = bcrypt.hashSync('khong-ton-tai-' + crypto.randomBytes(8).toString('hex'), 10);

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  return res.page('Đăng nhập', views.login({ csrf: req.session.csrf, error: null }), { bare: true });
});

router.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim().slice(0, 50);
    const password = String(req.body.password || '').slice(0, 200);
    const { rows } = await db.query('SELECT id, username, password_hash, full_name, role FROM users WHERE username = $1', [username]);
    const user = rows[0];
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !ok) {
      audit('login_failed', { username, ip: req.ip }, 'warn');
      return res.status(401).page('Đăng nhập', views.login({ csrf: req.session.csrf, error: 'Sai tên đăng nhập hoặc mật khẩu.' }), { bare: true });
    }

    // Tạo session mới sau khi đăng nhập (chống session fixation)
    return req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { id: user.id, username: user.username, fullName: user.full_name, role: user.role };
      req.session.csrf = crypto.randomBytes(24).toString('hex');
      audit('login_success', { username: user.username, ip: req.ip });
      return req.session.save((saveErr) => (saveErr ? next(saveErr) : res.redirect('/')));
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', (req, res, next) => {
  const username = req.session.user ? req.session.user.username : null;
  req.session.destroy((err) => {
    if (err) return next(err);
    audit('logout', { username, ip: req.ip });
    res.clearCookie('library.sid');
    return res.redirect('/login');
  });
});

module.exports = router;
