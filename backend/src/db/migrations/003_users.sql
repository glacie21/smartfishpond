-- ============================================================
--  003_users — akun pengguna dashboard
--
--  Peran:
--    admin  : boleh membaca dan mengubah data (tambah/ubah/hapus kolam)
--    viewer : hanya membaca dashboard
--
--  Akun dibuat lewat CLI: npm run user:create -- <username> --role admin
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id             BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username       TEXT        NOT NULL UNIQUE
                   CHECK (username = lower(username)),
    password_hash  TEXT        NOT NULL,                -- bcrypt
    role           TEXT        NOT NULL DEFAULT 'viewer'
                   CHECK (role IN ('admin', 'viewer')),
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
