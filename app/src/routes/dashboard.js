'use strict';
const express = require('express');
const db = require('../db');
const views = require('../views');
const { requireLogin } = require('../middleware');

const router = express.Router();

const LOAN_COLS = `l.id, l.borrowed_at, l.due_date, l.returned_at, b.title, m.full_name, m.member_code,
  (l.returned_at IS NULL AND l.due_date < CURRENT_DATE) AS is_overdue,
  (CURRENT_DATE - l.due_date) AS days_over`;

router.get('/', requireLogin, async (req, res, next) => {
  try {
    const [stats, recent, overdue] = await Promise.all([
      db.query(`SELECT
        (SELECT COUNT(*) FROM books) AS titles,
        (SELECT COALESCE(SUM(total_copies), 0) FROM books) AS copies,
        (SELECT COUNT(*) FROM members WHERE status = 'active') AS members,
        (SELECT COUNT(*) FROM loans WHERE returned_at IS NULL) AS active_loans,
        (SELECT COUNT(*) FROM loans WHERE returned_at IS NULL AND due_date < CURRENT_DATE) AS overdue`),
      db.query(`SELECT ${LOAN_COLS} FROM loans l JOIN books b ON b.id = l.book_id JOIN members m ON m.id = l.member_id ORDER BY l.id DESC LIMIT 8`),
      db.query(`SELECT ${LOAN_COLS} FROM loans l JOIN books b ON b.id = l.book_id JOIN members m ON m.id = l.member_id
                WHERE l.returned_at IS NULL AND l.due_date < CURRENT_DATE ORDER BY l.due_date LIMIT 8`),
    ]);
    res.page('Tổng quan', views.dashboard({ stats: stats.rows[0], recent: recent.rows, overdue: overdue.rows, csrf: req.session.csrf }), { active: 'dashboard' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
