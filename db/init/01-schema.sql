-- Lược đồ CSDL Quản lý Thư viện (PostgreSQL 16)
-- Chạy tự động lần đầu khởi tạo volume, bằng tài khoản quản trị (library_admin).

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,            -- bcrypt, không lưu mật khẩu thô
    full_name     VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'librarian' CHECK (role IN ('admin', 'librarian')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE books (
    id               SERIAL PRIMARY KEY,
    isbn             VARCHAR(20) UNIQUE,
    title            VARCHAR(255) NOT NULL,
    author           VARCHAR(255) NOT NULL,
    publisher        VARCHAR(255),
    publish_year     INTEGER CHECK (publish_year BETWEEN 1000 AND 2100),
    category         VARCHAR(100),
    total_copies     INTEGER NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
    available_copies INTEGER NOT NULL DEFAULT 1 CHECK (available_copies >= 0),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_available_le_total CHECK (available_copies <= total_copies)
);
CREATE INDEX idx_books_title ON books (title);
CREATE INDEX idx_books_author ON books (author);

CREATE TABLE members (
    id          SERIAL PRIMARY KEY,
    member_code VARCHAR(20)  NOT NULL UNIQUE,
    full_name   VARCHAR(100) NOT NULL,
    email       VARCHAR(150) UNIQUE,
    phone       VARCHAR(20),
    address     VARCHAR(255),
    status      VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    joined_at   DATE         NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE loans (
    id          SERIAL PRIMARY KEY,
    book_id     INTEGER NOT NULL REFERENCES books (id)   ON DELETE RESTRICT,
    member_id   INTEGER NOT NULL REFERENCES members (id) ON DELETE RESTRICT,
    borrowed_at DATE    NOT NULL DEFAULT CURRENT_DATE,
    due_date    DATE    NOT NULL,
    returned_at DATE,
    created_by  INTEGER REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT chk_due_after_borrow CHECK (due_date >= borrowed_at),
    CONSTRAINT chk_return_after_borrow CHECK (returned_at IS NULL OR returned_at >= borrowed_at)
);
CREATE INDEX idx_loans_member ON loans (member_id);
CREATE INDEX idx_loans_book ON loans (book_id);
CREATE INDEX idx_loans_open_due ON loans (due_date) WHERE returned_at IS NULL;

-- Bảng session cho express-session (connect-pg-simple)
CREATE TABLE session (
    sid    VARCHAR      NOT NULL PRIMARY KEY,
    sess   JSON         NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX idx_session_expire ON session (expire);
