'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const views = require('../views');
const { audit } = require('../logger');
const { requireRole, flash, intParam } = require('../middleware');

const router = express.Router();
router.use(requireRole('admin'));

function parse(body, editing = false) {
  const values = {
    username: String(body.username || '').trim(),
    full_name: String(body.full_name || '').trim(),
    role: String(body.role || 'librarian'),
    password: String(body.password || ''),
  };
  const errors = [];
  if (!editing && !/^[a-zA-Z0-9_.-]{3,50}$/.test(values.username)) errors.push('Tên đăng nhập phải dài 3-50 ký tự và chỉ dùng chữ, số, ., _, -.');
  if (!values.full_name || values.full_name.length > 100) errors.push('Họ tên bắt buộc và tối đa 100 ký tự.');
  if (!['admin', 'librarian'].includes(values.role)) errors.push('Vai trò không hợp lệ.');
  if ((!editing || values.password) && values.password.length < 12) errors.push('Mật khẩu phải có ít nhất 12 ký tự.');
  return { values, errors };
}

function dbMessage(err) {
  return err.code === '23505' ? 'Tên đăng nhập đã tồn tại.' : null;
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT id, username, full_name, role, to_char(created_at, \'YYYY-MM-DD\') AS created_at FROM users ORDER BY username');
    return res.page('Tài khoản', views.usersList({ users: rows, csrf: req.session.csrf }), { active: 'users' });
  } catch (err) { return next(err); }
});

router.get('/new', (req, res) => res.page('Thêm tài khoản', views.userForm({
  title: 'Thêm tài khoản', action: '/users', values: { username: '', full_name: '', role: 'librarian', password: '' }, errors: [], csrf: req.session.csrf, editing: false,
}), { active: 'users' }));

router.post('/', async (req, res, next) => {
  const { values, errors } = parse(req.body);
  const again = (errs) => res.status(400).page('Thêm tài khoản', views.userForm({ title: 'Thêm tài khoản', action: '/users', values, errors: errs, csrf: req.session.csrf, editing: false }), { active: 'users' });
  if (errors.length) return again(errors);
  try {
    const hash = await bcrypt.hash(values.password, 12);
    const { rows } = await db.query('INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id', [values.username, hash, values.full_name, values.role]);
    audit('user_created', { user_id: rows[0].id, username: values.username, by: req.session.user.username });
    flash(req, 'ok', 'Đã tạo tài khoản.');
    return res.redirect('/users');
  } catch (err) { const msg = dbMessage(err); return msg ? again([msg]) : next(err); }
});

router.get('/:id/edit', async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    const { rows } = id ? await db.query('SELECT id, username, full_name, role FROM users WHERE id = $1', [id]) : { rows: [] };
    if (!rows[0]) return next();
    return res.page('Sửa tài khoản', views.userForm({ title: 'Sửa tài khoản', action: `/users/${id}`, values: { ...rows[0], password: '' }, errors: [], csrf: req.session.csrf, editing: true }), { active: 'users' });
  } catch (err) { return next(err); }
});

router.post('/:id', async (req, res, next) => {
  const id = intParam(req.params.id);
  const { values, errors } = parse(req.body, true);
  const again = (errs) => res.status(400).page('Sửa tài khoản', views.userForm({ title: 'Sửa tài khoản', action: `/users/${id}`, values, errors: errs, csrf: req.session.csrf, editing: true }), { active: 'users' });
  if (!id) return next();
  if (errors.length) return again(errors);
  try {
    if (id === req.session.user.id && values.role !== 'admin') return again(['Không thể hạ quyền tài khoản đang đăng nhập.']);
    const params = [values.full_name, values.role, id];
    const query = values.password
      ? 'UPDATE users SET full_name = $1, role = $2, password_hash = $3 WHERE id = $4'
      : 'UPDATE users SET full_name = $1, role = $2 WHERE id = $3';
    if (values.password) params.splice(2, 0, await bcrypt.hash(values.password, 12));
    const result = await db.query(query, params);
    if (!result.rowCount) return next();
    audit('user_updated', { user_id: id, by: req.session.user.username });
    flash(req, 'ok', 'Đã cập nhật tài khoản.');
    return res.redirect('/users');
  } catch (err) { return next(err); }
});

module.exports = router;
