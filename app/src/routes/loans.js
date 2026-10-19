'use strict';
const express = require('express');
const db = require('../db');
const config = require('../config');
const views = require('../views');
const { audit } = require('../logger');
const { UserError, requireLogin, flash, intParam } = require('../middleware');

const router = express.Router();
router.use(requireLogin);

const LOAN_COLS = `l.id, l.borrowed_at, l.due_date, l.returned_at, b.title, m.full_name, m.member_code,
  (l.returned_at IS NULL AND l.due_date < CURRENT_DATE) AS is_overdue,
  (CURRENT_DATE - l.due_date) AS days_over`;

const FILTERS = {
  open: 'WHERE l.returned_at IS NULL',
  overdue: 'WHERE l.returned_at IS NULL AND l.due_date < CURRENT_DATE',
  returned: 'WHERE l.returned_at IS NOT NULL',
  all: '',
};

async function formData(values, errors) {
  const [members, books, def] = await Promise.all([
    db.query(`SELECT id, full_name, member_code FROM members WHERE status = 'active' ORDER BY full_name`),
    db.query('SELECT id, title, available_copies FROM books WHERE available_copies > 0 ORDER BY title'),
    db.query(`SELECT to_char(CURRENT_DATE + $1::int, 'YYYY-MM-DD') AS d`, [config.loan.defaultDays]),
  ]);
  return {
    members: members.rows,
    books: books.rows,
    values: { member_id: '', book_id: '', due_date: def.rows[0].d, ...values },
    errors,
    maxOpen: config.loan.maxOpenPerMember,
  };
}

router.get('/loans', async (req, res, next) => {
  try {
    const status = Object.prototype.hasOwnProperty.call(FILTERS, req.query.status) ? req.query.status : 'open';
    const { rows } = await db.query(
      `SELECT ${LOAN_COLS} FROM loans l JOIN books b ON b.id = l.book_id JOIN members m ON m.id = l.member_id
       ${FILTERS[status]} ORDER BY l.returned_at IS NOT NULL, l.due_date, l.id DESC LIMIT 200`,
    );
    res.page('Mượn / trả', views.loansList({ loans: rows, status, csrf: req.session.csrf }), { active: 'loans' });
  } catch (err) { next(err); }
});

router.get('/loans/new', async (req, res, next) => {
  try {
    const data = await formData({}, []);
    res.page('Lập phiếu mượn', views.loanForm({ ...data, csrf: req.session.csrf }), { active: 'loans' });
  } catch (err) { next(err); }
});

router.post('/loans', async (req, res, next) => {
  const memberId = intParam(req.body.member_id);
  const bookId = intParam(req.body.book_id);
  const dueDate = String(req.body.due_date || '').trim();
  const values = { member_id: req.body.member_id || '', book_id: req.body.book_id || '', due_date: dueDate };

  try {
    if (!memberId || !bookId) throw new UserError('Hãy chọn độc giả và sách.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate))) throw new UserError('Hạn trả không hợp lệ.');

    const loanId = await db.tx(async (c) => {
      // Khóa dòng sách để hai thủ thư không cùng mượn bản cuối cùng.
      const book = (await c.query('SELECT id, title, available_copies FROM books WHERE id = $1 FOR UPDATE', [bookId])).rows[0];
      if (!book) throw new UserError('Không tìm thấy sách.');
      if (book.available_copies < 1) throw new UserError('Sách này đã hết bản trong kho.');

      const member = (await c.query('SELECT id, status FROM members WHERE id = $1', [memberId])).rows[0];
      if (!member) throw new UserError('Không tìm thấy độc giả.');
      if (member.status !== 'active') throw new UserError('Độc giả đang bị tạm khóa, không thể mượn sách.');

      const open = (await c.query('SELECT COUNT(*) AS n FROM loans WHERE member_id = $1 AND returned_at IS NULL', [memberId])).rows[0].n;
      if (open >= config.loan.maxOpenPerMember) throw new UserError(`Độc giả đã mượn tối đa ${config.loan.maxOpenPerMember} cuốn.`);

      const dup = (await c.query('SELECT 1 FROM loans WHERE member_id = $1 AND book_id = $2 AND returned_at IS NULL', [memberId, bookId])).rowCount;
      if (dup) throw new UserError('Độc giả này đang mượn cuốn sách này rồi.');

      const ins = await c.query(
        'INSERT INTO loans (book_id, member_id, due_date, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
        [bookId, memberId, dueDate, req.session.user.id],
      );
      await c.query('UPDATE books SET available_copies = available_copies - 1, updated_at = now() WHERE id = $1', [bookId]);
      return ins.rows[0].id;
    });

    audit('loan_created', { loan_id: loanId, book_id: bookId, member_id: memberId, by: req.session.user.username });
    flash(req, 'ok', `Đã lập phiếu mượn #${loanId}.`);
    return res.redirect('/loans');
  } catch (err) {
    if (err instanceof UserError || err.code === '23514') {
      try {
        const data = await formData(values, [err instanceof UserError ? err.message : 'Hạn trả phải từ hôm nay trở đi.']);
        return res.status(400).page('Lập phiếu mượn', views.loanForm({ ...data, csrf: req.session.csrf }), { active: 'loans' });
      } catch (inner) { return next(inner); }
    }
    return next(err);
  }
});

router.post('/loans/:id/return', async (req, res, next) => {
  const id = intParam(req.params.id);
  if (!id) return next();
  try {
    await db.tx(async (c) => {
      const r = await c.query('UPDATE loans SET returned_at = CURRENT_DATE WHERE id = $1 AND returned_at IS NULL RETURNING book_id', [id]);
      if (r.rowCount === 0) throw new UserError('Phiếu mượn không tồn tại hoặc đã được trả.');
      await c.query('UPDATE books SET available_copies = available_copies + 1, updated_at = now() WHERE id = $1', [r.rows[0].book_id]);
    });
    audit('loan_returned', { loan_id: id, by: req.session.user.username });
    flash(req, 'ok', `Đã nhận trả phiếu #${id}.`);
  } catch (err) {
    if (err instanceof UserError) flash(req, 'err', err.message);
    else return next(err);
  }
  return res.redirect('/loans');
});

module.exports = router;
