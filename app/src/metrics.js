'use strict';
// Số liệu Prometheus cho ứng dụng (endpoint /metrics, chỉ truy cập được từ mạng nội bộ).
const client = require('prom-client');
const db = require('./db');
const { bus } = require('./logger');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequests = new client.Counter({
  name: 'library_http_requests_total',
  help: 'Total HTTP requests handled by the app',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});
const httpDuration = new client.Histogram({
  name: 'library_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

function middleware(req, res, next) {
  const original = req.originalUrl.split('?')[0];
  if (original === '/metrics' || original === '/health') return next();
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    let route = 'unmatched';
    if (req.route) route = (req.baseUrl || '') + req.route.path;
    else if (original.startsWith('/static')) route = '/static';
    const labels = { method: req.method, route, status: String(res.statusCode) };
    httpRequests.inc(labels);
    end(labels);
  });
  return next();
}

// Gauge nghiệp vụ: đọc trực tiếp từ DB mỗi lần Prometheus scrape.
function dbGauge(name, help, sql) {
  return new client.Gauge({
    name,
    help,
    registers: [register],
    async collect() {
      try {
        const r = await db.query(sql);
        this.set(Number(r.rows[0].v));
      } catch (err) { /* DB tạm thời không truy cập được: bỏ qua lần scrape này */ }
    },
  });
}
dbGauge('library_books_titles', 'Number of book titles', 'SELECT COUNT(*) AS v FROM books');
dbGauge('library_books_copies', 'Total number of book copies', 'SELECT COALESCE(SUM(total_copies), 0) AS v FROM books');
dbGauge('library_books_available_copies', 'Copies currently on the shelf', 'SELECT COALESCE(SUM(available_copies), 0) AS v FROM books');
dbGauge('library_members', 'Active library members', "SELECT COUNT(*) AS v FROM members WHERE status = 'active'");
dbGauge('library_loans_active', 'Loans not yet returned', 'SELECT COUNT(*) AS v FROM loans WHERE returned_at IS NULL');
dbGauge('library_loans_overdue', 'Loans past their due date', 'SELECT COUNT(*) AS v FROM loans WHERE returned_at IS NULL AND due_date < CURRENT_DATE');

// Bộ đếm sự kiện nghiệp vụ (lấy từ bus của logger)
const loansCreated = new client.Counter({ name: 'library_loans_created_total', help: 'Loans created since app start', registers: [register] });
const loansReturned = new client.Counter({ name: 'library_loans_returned_total', help: 'Loans returned since app start', registers: [register] });
const logins = new client.Counter({ name: 'library_logins_total', help: 'Login attempts by result', labelNames: ['result'], registers: [register] });
bus.on('loan_created', () => loansCreated.inc());
bus.on('loan_returned', () => loansReturned.inc());
bus.on('login_success', () => logins.inc({ result: 'success' }));
bus.on('login_failed', () => logins.inc({ result: 'failure' }));

async function handler(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

module.exports = { middleware, handler };
