/**
 * PocketKirana — Production PM2 Process Management Ecosystem
 *
 * Runs and manages:
 *   1. pocketkirana-main   (Main Next.js Customer & Admin Web App on Port 3000)
 *   2. pocketkirana-picker (Standalone Picker & Packing App on Port 3001)
 *
 * Features:
 *   - Auto-restart on failure / crash
 *   - Clustered instances
 *   - Unified logging to logs/
 *   - Graceful zero-downtime reloads
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 status
 *   pm2 logs
 *   pm2 reload all
 */

module.exports = {
  apps: [
    {
      name: 'pocketkirana-main',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: './',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/main-error.log',
      out_file: './logs/main-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'pocketkirana-picker',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      cwd: './picker-app',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/picker-error.log',
      out_file: './logs/picker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
