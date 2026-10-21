'use strict';
const express = require('express');
const db = require('../db');
const views = require('../views');
const { audit } = require('../logger');
const { requireLogin, requireRole, flash, intParam } = require('../middleware');

const router = express.Router();
router.use(requireLogin);

const PAGE_SIZE = 12;
const EMPTY = { title: '', author: '', isbn: '', publisher: '', publish_year: '', category: '', total_copies: '1' };

function parseBook(body) {
  const s = (k) => String(body[k] === undefined || body[k] === null ? '' : body[k]).trim();
  const values = {
    title: s('title'), author: s('author'), isbn: s('isbn'), publisher: s('publisher'),
    publish_year: s('publish_year'), category: s('category'), total_copies: s('total_copies'),
  };
  const errors = [];
  if (!values.title) errors.push('Tên sách không được để trống.');
  if (!values.author) errors.push('Tác giả không được để trống.');
  if (values.title.length > 255 || values.author.length > 255 || values.publisher.length > 255) errors.push('Tên sách, tác giả, nhà xuất bản tối đa 255 ký tự.');
  if (values.isbn.length > 20) errors.push('ISBN tối đa 20 ký tự.');
  if (!/^\d+$/.test(values.total_copies) || Number(values.total_copies) > 10000) errors.push('Tổng số bản phải là số nguyên từ 0 đến 10000.');
  let year = null;
  if (values.publish_year) {
    if (!/^\d{4}$/.test(values.publish_year) || Number(values.publish_year) < 1000 || Number(values.publish_year) > 2100) errors.push('Năm xuất bản không hợp lệ.');
    else year = Number(values.publish_year);
  }
  return {
    values,
    errors,
    data: {
      isbn: values.isbn || null, title: values.title, author: values.author, publisher: values.publisher || null,
      year, category: values.category || null, total: Number(values.total_copies),
    },
  };
}

function dbMessage(err) {
  if (err.code === '23505') return 'ISBN này đã tồn tại trong thư viện.';
  if (err.code === '23514') return 'Tổng số bản không được nhỏ hơn số bản đang cho mượn.';
  return null;
}

router.get('/books', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const page = Math.max(1, intParam(req.query.page) || 1);
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const where = q ? 'WHERE title ILIKE $1 OR author ILIKE $1 OR COALESCE(isbn, \'\') ILIKE $1' : '';
    const params = q ? [like] : [];
    const total = (await db.query(`SELECT COUNT(*) AS n FROM books ${where}`, params)).rows[0].n;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const { rows } = await db.query(
      `SELECT id, isbn, title, author, publish_year, category, total_copies, available_copies FROM books ${where}
       ORDER BY title LIMIT ${PAGE_SIZE} OFFSET ${(Math.min(page, pages) - 1) * PAGE_SIZE}`,
      params,
    );
    res.page('Sách', views.booksList({ books: rows, q, page: Math.min(page, pages), pages, total, csrf: req.session.csrf, user: req.session.user }), { active: 'books' });
  } catch (err) { next(err); }
});

router.get('/books/new', (req, res) => {
  res.page('Thêm sách', views.bookForm({ title: 'Thêm sách', action: '/books', values: EMPTY, errors: [], csrf: req.session.csrf }), { active: 'books' });
});

router.post('/books', async (req, res, next) => {
  const { values, errors, data } = parseBook(req.body);
  const again = (errs) => res.status(400).page('Thêm sách', views.bookForm({ title: 'Thêm sách', action: '/books', values, errors: errs, csrf: req.session.csrf }), { active: 'books' });
  if (errors.length) return again(errors);
  try {
    const { rows } = await db.query(
      `INSERT INTO books (isbn, title, author, publisher, publish_year, category, total_copies, available_copies)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING id`,
      [data.isbn, data.title, data.author, data.publisher, data.year, data.category, data.total],
    );
    audit('book_created', { book_id: rows[0].id, title: data.title, by: req.session.user.username });
    flash(req, 'ok', `Đã thêm sách “${data.title}”.`);
    return res.redirect('/books');
  } catch (err) {
    const msg = dbMessage(err);
    return msg ? again([msg]) : next(err);
  }
});

router.get('/books/:id/edit', async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    const { rows } = id ? await db.query('SELECT * FROM books WHERE id = $1', [id]) : { rows: [] };
    if (!rows[0]) return next();
    const b = rows[0];
    const values = {
      title: b.title, author: b.author, isbn: b.isbn || '', publisher: b.publisher || '',
      publish_year: b.publish_year || '', category: b.category || '', total_copies: String(b.total_copies),
    };
    return res.page('Sửa sách', views.bookForm({ title: 'Sửa sách', action: `/books/${id}`, values, errors: [], csrf: req.session.csrf }), { active: 'books' });
  } catch (err) { return next(err); }
});

router.post('/books/:id', async (req, res, next) => {
  const id = intParam(req.params.id);
  if (!id) return next();
  const { values, errors, data } = parseBook(req.body);
  const again = (errs) => res.status(400).page('Sửa sách', views.bookForm({ title: 'Sửa sách', action: `/books/${id}`, values, errors: errs, csrf: req.session.csrf }), { active: 'books' });
  if (errors.length) return again(errors);
  try {
    // available_copies thay đổi theo chênh lệch tổng số bản; CHECK trong DB chặn giá trị âm.
    const r = await db.query(
      `UPDATE books SET isbn = $1, title = $2, author = $3, publisher = $4, publish_year = $5, category = $6,
         available_copies = available_copies + ($7 - total_copies), total_copies = $7, updated_at = now()
       WHERE id = $8`,
      [data.isbn, data.title, data.author, data.publisher, data.year, data.category, data.total, id],
    );
    if (r.rowCount === 0) return next();
    audit('book_updated', { book_id: id, by: req.session.user.username });
    flash(req, 'ok', 'Đã cập nhật sách.');
    return res.redirect('/books');
  } catch (err) {
    const msg = dbMessage(err);
    return msg ? again([msg]) : next(err);
  }
});

router.post('/books/:id/delete', requireRole('admin'), async (req, res, next) => {
  const id = intParam(req.params.id);
  if (!id) return next();
  try {
    const r = await db.query('DELETE FROM books WHERE id = $1', [id]);
    if (r.rowCount === 0) return next();
    audit('book_deleted', { book_id: id, by: req.session.user.username });
    flash(req, 'ok', 'Đã xóa sách.');
  } catch (err) {
    if (err.code === '23503') flash(req, 'err', 'Không thể xóa: sách này đã có lịch sử mượn.');
    else return next(err);
  }
  return res.redirect('/books');
});

module.exports = router;
