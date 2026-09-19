-- ============================================================================
-- PocketKirana — Phase 13D: Dual-User Database Security Model
-- ============================================================================
-- Establishes least-privilege separation between Application Runtime (DML)
-- and Deployment / Migration (DDL).
-- ============================================================================

-- 1. Create Roles if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pk_app_user') THEN
    CREATE ROLE pk_app_user WITH LOGIN PASSWORD 'CHANGE_IN_PRODUCTION_SECRET_APP_PW';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pk_migrator') THEN
    CREATE ROLE pk_migrator WITH LOGIN PASSWORD 'CHANGE_IN_PRODUCTION_SECRET_MIGRATOR_PW';
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
