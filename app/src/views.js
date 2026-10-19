'use strict';
const { html, raw, esc } = require('./html');

const NAV = [
  { key: 'dashboard', href: '/', label: 'Tổng quan' },
  { key: 'books', href: '/books', label: 'Sách' },
  { key: 'members', href: '/members', label: 'Độc giả' },
  { key: 'loans', href: '/loans', label: 'Mượn / trả' },
];

const fmtDate = (d) => (d ? String(d).split('-').reverse().join('/') : '');
const attrs = (a = {}) => raw(Object.entries(a).map(([k, v]) => `${k}="${esc(v)}"`).join(' '));
const csrfField = (t) => html`<input type="hidden" name="_csrf" value="${t}">`;
const qs = (o) => new URLSearchParams(
  Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => [k, String(v)]),
).toString();

// ---------- Thành phần dùng chung ----------
function field({ label, name, value = '', type = 'text', required = false, hint = '', attr = {} }) {
  return html`<div class="field">
  <label for="${name}">${label}${required ? html`<span class="req" aria-hidden="true"> *</span>` : ''}</label>
  <input id="${name}" name="${name}" type="${type}" value="${value}" ${required ? raw('required') : ''} ${attrs(attr)}>
  ${hint ? html`<small>${hint}</small>` : ''}
</div>`;
}

function select({ label, name, options, value = '', required = false, hint = '' }) {
  return html`<div class="field">
  <label for="${name}">${label}${required ? html`<span class="req" aria-hidden="true"> *</span>` : ''}</label>
  <select id="${name}" name="${name}" ${required ? raw('required') : ''}>
    ${options.map((o) => html`<option value="${o.value}" ${String(o.value) === String(value) ? raw('selected') : ''}>${o.label}</option>`)}
  </select>
  ${hint ? html`<small>${hint}</small>` : ''}
</div>`;
}

const errorList = (errors) => (errors && errors.length
  ? html`<div class="flash flash-err" role="alert"><ul>${errors.map((e) => html`<li>${e}</li>`)}</ul></div>`
  : '');

const flashBox = (f) => (f ? html`<div class="flash flash-${f.type}" role="status">${f.msg}</div>` : '');

function pager({ base, page, pages, extra = {} }) {
  if (pages <= 1) return '';
  return html`<nav class="pager" aria-label="Phân trang">
  ${page > 1 ? html`<a href="${base}?${qs({ ...extra, page: page - 1 })}">Trang trước</a>` : ''}
  <span>Trang ${page} / ${pages}</span>
  ${page < pages ? html`<a href="${base}?${qs({ ...extra, page: page + 1 })}">Trang sau</a>` : ''}
</nav>`;
}

// ---------- Khung trang ----------
function layout({ title, user, flash, csrf, active, bare, body }) {
  const head = html`<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - Thư viện</title>
<link rel="stylesheet" href="/static/style.css">
<script src="/static/app.js" defer></script>
</head>`;

  if (bare || !user) {
    return html`<!doctype html>
<html lang="vi">
${head}
<body class="bare"><main class="bare-main">${flashBox(flash)}${body}</main></body>
</html>`;
  }

  return html`<!doctype html>
<html lang="vi">
${head}
<body>
<a class="skip" href="#main">Bỏ qua điều hướng</a>
<div class="shell">
  <nav class="side" aria-label="Điều hướng chính">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span>Thư viện</a>
    <ul>
      ${NAV.map((n) => html`<li><a href="${n.href}" ${active === n.key ? raw('aria-current="page"') : ''}>${n.label}</a></li>`)}
    </ul>
    <form class="who" method="post" action="/logout">
      ${csrfField(csrf)}
      <span class="who-name">${user.fullName}</span>
      <button class="btn btn-quiet" type="submit">Đăng xuất</button>
    </form>
  </nav>
  <main id="main" class="main">${flashBox(flash)}${body}</main>
</div>
</body>
</html>`;
}

function errorBox(status, message) {
  return html`<section class="notice">
  <h1>${status}</h1>
  <p>${message}</p>
  <p><a class="btn" href="/">Về trang tổng quan</a></p>
</section>`;
}

// ---------- Đăng nhập ----------
function login({ csrf, error }) {
  return html`<section class="login">
  <h1>Thư viện</h1>
  <p class="login-sub">Đăng nhập để quản lý sách, độc giả và phiếu mượn.</p>
  ${error ? html`<div class="flash flash-err" role="alert">${error}</div>` : ''}
  <form method="post" action="/login">
    ${csrfField(csrf)}
    ${field({ label: 'Tên đăng nhập', name: 'username', required: true, attr: { autocomplete: 'username', maxlength: 50, autofocus: '' } })}
    ${field({ label: 'Mật khẩu', name: 'password', type: 'password', required: true, attr: { autocomplete: 'current-password', maxlength: 200 } })}
    <button class="btn btn-primary btn-block" type="submit">Đăng nhập</button>
  </form>
</section>`;
}

// ---------- Phiếu mượn ----------
function loanTag(l) {
  if (l.returned_at) return html`<span class="tag tag-ok">Đã trả ${fmtDate(l.returned_at)}</span>`;
  if (l.is_overdue) return html`<span class="tag tag-late">Quá hạn ${l.days_over} ngày (hạn ${fmtDate(l.due_date)})</span>`;
  return html`<span class="tag tag-due">Hạn ${fmtDate(l.due_date)}</span>`;
}

function loanTable(loans, { csrf, actions = true } = {}) {
  if (loans.length === 0) return html`<p class="empty">Chưa có phiếu mượn nào ở mục này.</p>`;
  return html`<div class="table-wrap"><table class="data">
  <thead><tr><th>Phiếu</th><th>Sách</th><th>Độc giả</th><th>Ngày mượn</th><th>Trạng thái</th>${actions ? html`<th><span class="sr">Thao tác</span></th>` : ''}</tr></thead>
  <tbody>
  ${loans.map((l) => html`<tr>
    <td class="mono">#${l.id}</td>
    <td>${l.title}</td>
    <td>${l.full_name} <span class="muted mono">${l.member_code}</span></td>
    <td>${fmtDate(l.borrowed_at)}</td>
    <td>${loanTag(l)}</td>
    ${actions ? html`<td class="actions">${l.returned_at ? '' : html`<form method="post" action="/loans/${l.id}/return">${csrfField(csrf)}<button class="btn btn-small" type="submit">Nhận trả</button></form>`}</td>` : ''}
  </tr>`)}
  </tbody></table></div>`;
}

function loansList({ loans, status, csrf }) {
  const tabs = [
    { key: 'open', label: 'Đang mượn' },
    { key: 'overdue', label: 'Quá hạn' },
    { key: 'returned', label: 'Đã trả' },
    { key: 'all', label: 'Tất cả' },
  ];
  return html`<header class="page-head"><h1>Mượn / trả</h1><a class="btn btn-primary" href="/loans/new">Lập phiếu mượn</a></header>
<nav class="tabs" aria-label="Lọc phiếu mượn">
  ${tabs.map((t) => html`<a href="/loans?status=${t.key}" ${t.key === status ? raw('aria-current="page"') : ''}>${t.label}</a>`)}
</nav>
${loanTable(loans, { csrf })}`;
}

function loanForm({ members, books, values, errors, csrf, maxOpen }) {
  const noStock = books.length === 0;
  return html`<header class="page-head"><h1>Lập phiếu mượn</h1></header>
${errorList(errors)}
${noStock ? html`<p class="empty">Hiện không còn cuốn sách nào có thể cho mượn.</p>` : ''}
<form class="form" method="post" action="/loans">
  ${csrfField(csrf)}
  ${select({ label: 'Độc giả', name: 'member_id', required: true, value: values.member_id,
    options: [{ value: '', label: 'Chọn độc giả' }, ...members.map((m) => ({ value: m.id, label: `${m.full_name} (${m.member_code})` }))] })}
  ${select({ label: 'Sách', name: 'book_id', required: true, value: values.book_id,
    options: [{ value: '', label: 'Chọn sách' }, ...books.map((b) => ({ value: b.id, label: `${b.title} - còn ${b.available_copies} bản` }))] })}
  ${field({ label: 'Hạn trả', name: 'due_date', type: 'date', required: true, value: values.due_date, hint: `Mỗi độc giả được mượn tối đa ${maxOpen} cuốn cùng lúc.` })}
  <div class="form-actions"><button class="btn btn-primary" type="submit">Lập phiếu</button><a class="btn" href="/loans">Hủy</a></div>
</form>`;
}

// ---------- Sách ----------
function booksList({ books, q, page, pages, total, csrf }) {
  return html`<header class="page-head"><h1>Sách</h1><a class="btn btn-primary" href="/books/new">Thêm sách</a></header>
<form class="search" method="get" action="/books" role="search">
  <input type="search" name="q" value="${q}" placeholder="Tìm theo tên sách, tác giả hoặc ISBN" aria-label="Tìm sách" maxlength="100">
  <button class="btn" type="submit">Tìm</button>
</form>
<p class="muted">${total} đầu sách${q ? html` khớp với “${q}”` : ''}</p>
${books.length === 0 ? html`<p class="empty">Không tìm thấy sách nào. Thử từ khóa khác hoặc thêm sách mới.</p>` : html`<div class="table-wrap"><table class="data">
  <thead><tr><th>Tên sách</th><th>ISBN</th><th>Thể loại</th><th class="num">Còn / Tổng</th><th><span class="sr">Thao tác</span></th></tr></thead>
  <tbody>
  ${books.map((b) => html`<tr>
    <td><strong>${b.title}</strong><br><span class="muted">${b.author}${b.publish_year ? html`, ${b.publish_year}` : ''}</span></td>
    <td class="mono">${b.isbn}</td>
    <td>${b.category}</td>
    <td class="num ${b.available_copies === 0 ? 'is-late' : ''}">${b.available_copies} / ${b.total_copies}</td>
    <td class="actions">
      <a class="btn btn-small" href="/books/${b.id}/edit">Sửa</a>
      <form method="post" action="/books/${b.id}/delete" data-confirm="Xóa sách này khỏi thư viện?">${csrfField(csrf)}<button class="btn btn-small btn-danger" type="submit">Xóa</button></form>
    </td>
  </tr>`)}
  </tbody></table></div>`}
${pager({ base: '/books', page, pages, extra: { q } })}`;
}

function bookForm({ title, action, values, errors, csrf }) {
  return html`<header class="page-head"><h1>${title}</h1></header>
${errorList(errors)}
<form class="form" method="post" action="${action}">
  ${csrfField(csrf)}
  ${field({ label: 'Tên sách', name: 'title', required: true, value: values.title, attr: { maxlength: 255 } })}
  ${field({ label: 'Tác giả', name: 'author', required: true, value: values.author, attr: { maxlength: 255 } })}
  <div class="grid-2">
    ${field({ label: 'ISBN', name: 'isbn', value: values.isbn, attr: { maxlength: 20 }, hint: 'Có thể để trống.' })}
    ${field({ label: 'Thể loại', name: 'category', value: values.category, attr: { maxlength: 100 } })}
  </div>
  <div class="grid-2">
    ${field({ label: 'Nhà xuất bản', name: 'publisher', value: values.publisher, attr: { maxlength: 255 } })}
    ${field({ label: 'Năm xuất bản', name: 'publish_year', type: 'number', value: values.publish_year, attr: { min: 1000, max: 2100 } })}
  </div>
  ${field({ label: 'Tổng số bản', name: 'total_copies', type: 'number', required: true, value: values.total_copies, attr: { min: 0, max: 10000 }, hint: 'Số bản còn lại trong kho được tự động điều chỉnh theo.' })}
  <div class="form-actions"><button class="btn btn-primary" type="submit">Lưu sách</button><a class="btn" href="/books">Hủy</a></div>
</form>`;
}

// ---------- Độc giả ----------
function membersList({ members, q, page, pages, total, csrf }) {
  return html`<header class="page-head"><h1>Độc giả</h1><a class="btn btn-primary" href="/members/new">Thêm độc giả</a></header>
<form class="search" method="get" action="/members" role="search">
  <input type="search" name="q" value="${q}" placeholder="Tìm theo họ tên, mã độc giả, email hoặc số điện thoại" aria-label="Tìm độc giả" maxlength="100">
  <button class="btn" type="submit">Tìm</button>
</form>
<p class="muted">${total} độc giả${q ? html` khớp với “${q}”` : ''}</p>
${members.length === 0 ? html`<p class="empty">Không tìm thấy độc giả nào.</p>` : html`<div class="table-wrap"><table class="data">
  <thead><tr><th>Mã</th><th>Họ tên</th><th>Liên hệ</th><th>Đang mượn</th><th>Trạng thái</th><th><span class="sr">Thao tác</span></th></tr></thead>
  <tbody>
  ${members.map((m) => html`<tr>
    <td class="mono">${m.member_code}</td>
    <td><strong>${m.full_name}</strong></td>
    <td>${m.email}${m.email && m.phone ? html`<br>` : ''}${m.phone}</td>
    <td class="num">${m.open_loans}</td>
    <td>${m.status === 'active' ? html`<span class="tag tag-ok">Hoạt động</span>` : html`<span class="tag tag-late">Tạm khóa</span>`}</td>
    <td class="actions">
      <a class="btn btn-small" href="/members/${m.id}/edit">Sửa</a>
      <form method="post" action="/members/${m.id}/delete" data-confirm="Xóa độc giả này?">${csrfField(csrf)}<button class="btn btn-small btn-danger" type="submit">Xóa</button></form>
    </td>
  </tr>`)}
  </tbody></table></div>`}
${pager({ base: '/members', page, pages, extra: { q } })}`;
}

function memberForm({ title, action, values, errors, csrf }) {
  return html`<header class="page-head"><h1>${title}</h1></header>
${errorList(errors)}
<form class="form" method="post" action="${action}">
  ${csrfField(csrf)}
  <div class="grid-2">
    ${field({ label: 'Mã độc giả', name: 'member_code', required: true, value: values.member_code, attr: { maxlength: 20 } })}
    ${select({ label: 'Trạng thái', name: 'status', value: values.status, options: [{ value: 'active', label: 'Hoạt động' }, { value: 'suspended', label: 'Tạm khóa' }] })}
  </div>
  ${field({ label: 'Họ và tên', name: 'full_name', required: true, value: values.full_name, attr: { maxlength: 100 } })}
  <div class="grid-2">
    ${field({ label: 'Email', name: 'email', type: 'email', value: values.email, attr: { maxlength: 150 } })}
    ${field({ label: 'Số điện thoại', name: 'phone', type: 'tel', value: values.phone, attr: { maxlength: 20 } })}
  </div>
  ${field({ label: 'Địa chỉ', name: 'address', value: values.address, attr: { maxlength: 255 } })}
  <div class="form-actions"><button class="btn btn-primary" type="submit">Lưu độc giả</button><a class="btn" href="/members">Hủy</a></div>
</form>`;
}

// ---------- Tổng quan ----------
function dashboard({ stats, recent, overdue, csrf }) {
  return html`<header class="page-head"><h1>Tổng quan</h1><a class="btn btn-primary" href="/loans/new">Lập phiếu mượn</a></header>
<dl class="ledger">
  <div><dt>Đầu sách</dt><dd>${stats.titles}</dd></div>
  <div><dt>Tổng số bản</dt><dd>${stats.copies}</dd></div>
  <div><dt>Độc giả hoạt động</dt><dd>${stats.members}</dd></div>
  <div><dt>Đang cho mượn</dt><dd>${stats.active_loans}</dd></div>
  <div class="${stats.overdue > 0 ? 'is-late' : ''}"><dt>Quá hạn</dt><dd>${stats.overdue}</dd></div>
</dl>
<section>
  <h2>Cần thu hồi: phiếu quá hạn</h2>
  ${overdue.length === 0 ? html`<p class="empty">Không có phiếu nào quá hạn.</p>` : loanTable(overdue, { csrf })}
</section>
<section>
  <h2>Phiếu mượn gần đây</h2>
  ${loanTable(recent, { csrf, actions: false })}
</section>`;
}

module.exports = {
  layout, errorBox, login, dashboard,
  booksList, bookForm, membersList, memberForm, loansList, loanForm,
};
