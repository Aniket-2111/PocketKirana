-- ============================================================================
-- PocketKirana — Phase 13D: Dual-User Database Security Model
-- ============================================================================
-- Establishes least-privilege separation between Application Runtime (DML)
-- and Deployment / Migration (DDL).
--
-- Passwords must NOT be hardcoded or committed to version control.
-- Supply them via psql variables or environment variables before executing:
--
-- Method 1 (psql with environment variables):
--   export PK_APP_USER_PASSWORD="<STRONG_PASSWORD_1>"
--   export PK_MIGRATOR_PASSWORD="<STRONG_PASSWORD_2>"
--   psql -h <HOST> -p <PORT> -U postgres -d pocketkirana_db -f scripts/provision_db_users.sql
--
-- Method 2 (psql with command-line variables):
--   psql -h <HOST> -p <PORT> -U postgres -d pocketkirana_db \
--        -v app_pw="<STRONG_PASSWORD_1>" -v migrator_pw="<STRONG_PASSWORD_2>" \
--        -f scripts/provision_db_users.sql
--
-- Method 3 (Node provisioning runner):
--   node scripts/provision_db_users.js
-- ============================================================================

\if :{?app_pw}
\else
  \getenv app_pw PK_APP_USER_PASSWORD
\endif

\if :{?migrator_pw}
\else
  \getenv migrator_pw PK_MIGRATOR_PASSWORD
\endif

-- 1. Create or Update Roles with provided passwords
DO $$
DECLARE
  v_app_pw text := :'app_pw';
  v_migrator_pw text := :'migrator_pw';
BEGIN
  IF v_app_pw IS NULL OR length(trim(v_app_pw)) = 0 THEN
    RAISE EXCEPTION 'PK_APP_USER_PASSWORD (or :app_pw) must not be empty. Do not use placeholder passwords.';
  END IF;

  IF v_migrator_pw IS NULL OR length(trim(v_migrator_pw)) = 0 THEN
    RAISE EXCEPTION 'PK_MIGRATOR_PASSWORD (or :migrator_pw) must not be empty. Do not use placeholder passwords.';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pk_app_user') THEN
    EXECUTE format('CREATE ROLE pk_app_user WITH LOGIN PASSWORD %L', v_app_pw);
  ELSE
    EXECUTE format('ALTER ROLE pk_app_user WITH LOGIN PASSWORD %L', v_app_pw);
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pk_migrator') THEN
    EXECUTE format('CREATE ROLE pk_migrator WITH LOGIN PASSWORD %L', v_migrator_pw);
  ELSE
    EXECUTE format('ALTER ROLE pk_migrator WITH LOGIN PASSWORD %L', v_migrator_pw);
  END IF;
END $$;

-- 2. Configure Database & Schema Connection
GRANT CONNECT ON DATABASE pocketkirana_db TO pk_app_user;
GRANT CONNECT ON DATABASE pocketkirana_db TO pk_migrator;

GRANT USAGE ON SCHEMA public TO pk_app_user;
GRANT USAGE, CREATE ON SCHEMA public TO pk_migrator;

-- 3. Runtime User (pk_app_user) — Least-Privilege DML Only
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pk_app_user;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO pk_app_user;

-- Ensure future tables created by pk_migrator are accessible to pk_app_user
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pk_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO pk_app_user;

-- Explicitly revoke destructive privileges from application runtime
REVOKE CREATE ON SCHEMA public FROM pk_app_user;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM pk_app_user;

-- 4. Migrator User (pk_migrator) — DDL & Schema Management Only
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pk_migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pk_migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO pk_migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO pk_migrator;

-- ============================================================================
-- Dual-User Security Model Provisioned Successfully
-- ============================================================================
