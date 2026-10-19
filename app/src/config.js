'use strict';

function required(name) {
  const v = process.env[name];
  if (!v) {
    process.stdout.write(JSON.stringify({ time: new Date().toISOString(), level: 'fatal', msg: `Thiếu biến môi trường bắt buộc: ${name}` }) + '\n');
    process.exit(1);
  }
  return v;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number.parseInt(process.env.PORT || '3000', 10),
  db: {
    host: process.env.DB_HOST || 'postgres',
    port: Number.parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'library',
    user: process.env.DB_USER || 'library_app',
    password: required('DB_PASSWORD'),
    max: 10,
  },
  sessionSecret: required('SESSION_SECRET'),
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: required('ADMIN_PASSWORD'),
  },
  loan: {
    defaultDays: 14,
    maxOpenPerMember: 5,
  },
};

// Hardening: từ chối khởi động nếu secret/mật khẩu quá yếu.
if (config.sessionSecret.length < 32) {
  process.stdout.write(JSON.stringify({ time: new Date().toISOString(), level: 'fatal', msg: 'SESSION_SECRET phải dài tối thiểu 32 ký tự' }) + '\n');
  process.exit(1);
}
if (config.admin.password.length < 12) {
  process.stdout.write(JSON.stringify({ time: new Date().toISOString(), level: 'fatal', msg: 'ADMIN_PASSWORD phải dài tối thiểu 12 ký tự' }) + '\n');
  process.exit(1);
}

module.exports = config;
