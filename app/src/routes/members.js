'use strict';
const express = require('express');
const db = require('../db');
const views = require('../views');
const { audit } = require('../logger');
const { requireLogin, requireRole, flash, intParam } = require('../middleware');

const router = express.Router();
router.use(requireLogin);

const PAGE_SIZE = 12;

function parseMember(body) {
  const s = (k) => String(body[k] === undefined || body[k] === null ? '' : body[k]).trim();
  const values = {
    member_code: s('member_code').toUpperCase(), full_name: s('full_name'), email: s('email'),
    phone: s('phone'), address: s('address'), status: s('status') || 'active',
  };
  const errors = [];
  if (!/^[A-Z0-9-]{2,20}$/.test(values.member_code)) errors.push('Mã độc giả gồm 2-20 ký tự chữ, số hoặc dấu gạch ngang.');
  if (!values.full_name) errors.push('Họ tên không được để trống.');
  if (values.full_name.length > 100) errors.push('Họ tên tối đa 100 ký tự.');
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.push('Email không hợp lệ.');
  if (values.email.length > 150) errors.push('Email tối đa 150 ký tự.');
  if (values.phone && !/^[0-9+().\s-]{6,20}$/.test(values.phone)) errors.push('Số điện thoại không hợp lệ.');
  if (values.address.length > 255) errors.push('Địa chỉ tối đa 255 ký tự.');
  if (!['active', 'suspended'].includes(values.status)) errors.push('Trạng thái không hợp lệ.');
  return { values, errors };
}

function dbMessage(err) {
  if (err.code === '23505') {
    return /email/.test(err.constraint || '') ? 'Email này đã được dùng cho độc giả khác.' : 'Mã độc giả đã tồn tại.';
  }
  return null;
}

async function nextCode() {
  const { rows } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM members');
  return `DG${String(rows[0].n).padStart(4, '0')}`;
}

router.get('/members', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const page = Math.max(1, intParam(req.query.page) || 1);
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const where = q ? `WHERE m.full_name ILIKE $1 OR m.member_code ILIKE $1 OR COALESCE(m.email, '') ILIKE $1 OR COALESCE(m.phone, '') ILIKE $1` : '';
    const params = q ? [like] : [];
    const total = (await db.query(`SELECT COUNT(*) AS n FROM members m ${where}`, params)).rows[0].n;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const { rows } = await db.query(
      `SELECT m.id, m.member_code, m.full_name, m.email, m.phone, m.status,
              (SELECT COUNT(*) FROM loans l WHERE l.member_id = m.id AND l.returned_at IS NULL) AS open_loans
       FROM members m ${where} ORDER BY m.member_code LIMIT ${PAGE_SIZE} OFFSET ${(Math.min(page, pages) - 1) * PAGE_SIZE}`,
      params,
    );
    res.page('Độc giả', views.membersList({ members: rows, q, page: Math.min(page, pages), pages, total, csrf: req.session.csrf, user: req.session.user }), { active: 'members' });
  } catch (err) { next(err); }
});

router.get('/members/new', async (req, res, next) => {
  try {
    const values = { member_code: await nextCode(), full_name: '', email: '', phone: '', address: '', status: 'active' };
    res.page('Thêm độc giả', views.memberForm({ title: 'Thêm độc giả', action: '/members', values, errors: [], csrf: req.session.csrf }), { active: 'members' });
  } catch (err) { next(err); }
});

router.post('/members', async (req, res, next) => {
  const { values, errors } = parseMember(req.body);
  const again = (errs) => res.status(400).page('Thêm độc giả', views.memberForm({ title: 'Thêm độc giả', action: '/members', values, errors: errs, csrf: req.session.csrf }), { active: 'members' });
  if (errors.length) return again(errors);
  try {
    const { rows } = await db.query(
      `INSERT INTO members (member_code, full_name, email, phone, address, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [values.member_code, values.full_name, values.email || null, values.phone || null, values.address || null, values.status],
    );
    audit('member_created', { member_id: rows[0].id, by: req.session.user.username });
    flash(req, 'ok', `Đã thêm độc giả ${values.full_name}.`);
    return res.redirect('/members');
  } catch (err) {
    const msg = dbMessage(err);
    return msg ? again([msg]) : next(err);
  }
});

router.get('/members/:id/edit', async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    const { rows } = id ? await db.query('SELECT * FROM members WHERE id = $1', [id]) : { rows: [] };
    if (!rows[0]) return next();
    const m = rows[0];
    const values = { member_code: m.member_code, full_name: m.full_name, email: m.email || '', phone: m.phone || '', address: m.address || '', status: m.status };
    return res.page('Sửa độc giả', views.memberForm({ title: 'Sửa độc giả', action: `/members/${id}`, values, errors: [], csrf: req.session.csrf }), { active: 'members' });
  } catch (err) { return next(err); }
});

router.post('/members/:id', async (req, res, next) => {
  const id = intParam(req.params.id);
  if (!id) return next();
  const { values, errors } = parseMember(req.body);
  const again = (errs) => res.status(400).page('Sửa độc giả', views.memberForm({ title: 'Sửa độc giả', action: `/members/${id}`, values, errors: errs, csrf: req.session.csrf }), { active: 'members' });
  if (errors.length) return again(errors);
  try {
    const r = await db.query(
      `UPDATE members SET member_code = $1, full_name = $2, email = $3, phone = $4, address = $5, status = $6 WHERE id = $7`,
      [values.member_code, values.full_name, values.email || null, values.phone || null, values.address || null, values.status, id],
    );
    if (r.rowCount === 0) return next();
    audit('member_updated', { member_id: id, by: req.session.user.username });
    flash(req, 'ok', 'Đã cập nhật độc giả.');
    return res.redirect('/members');
  } catch (err) {
    const msg = dbMessage(err);
    return msg ? again([msg]) : next(err);
  }
});

router.post('/members/:id/delete', requireRole('admin'), async (req, res, next) => {
  const id = intParam(req.params.id);
  if (!id) return next();
  try {
    const r = await db.query('DELETE FROM members WHERE id = $1', [id]);
    if (r.rowCount === 0) return next();
    audit('member_deleted', { member_id: id, by: req.session.user.username });
    flash(req, 'ok', 'Đã xóa độc giả.');
  } catch (err) {
    if (err.code === '23503') flash(req, 'err', 'Không thể xóa: độc giả này đã có lịch sử mượn. Hãy chuyển sang trạng thái “Tạm khóa”.');
    else return next(err);
  }
  return res.redirect('/members');
});

module.exports = router;
