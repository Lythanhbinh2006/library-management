'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { intParam, requireRole } = require('../src/middleware');

test('intParam only accepts positive decimal integers', () => {
  assert.equal(intParam('12'), 12);
  assert.equal(intParam('0'), null);
  assert.equal(intParam('1x'), null);
  assert.equal(intParam('-1'), null);
});

test('requireRole denies an authenticated user with another role', () => {
  let status;
  let page;
  const req = { session: { user: { username: 'librarian', role: 'librarian' } }, originalUrl: '/users' };
  const res = { status(code) { status = code; return this; }, page(title) { page = title; return this; } };
  let called = false;
  requireRole('admin')(req, res, () => { called = true; });
  assert.equal(status, 403);
  assert.equal(page, 'Không có quyền');
  assert.equal(called, false);
});

test('requireRole allows an administrator', () => {
  let called = false;
  requireRole('admin')({ session: { user: { role: 'admin' } } }, {}, () => { called = true; });
  assert.equal(called, true);
});
