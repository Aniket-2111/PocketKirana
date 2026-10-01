/**
 * PocketKirana — PM2 Production Process Ecosystem Configuration
 * 
 * Target Environment: Oracle Cloud VPS (Ubuntu 22.04 / 24.04 LTS)
 * 
 * Manages:
 * 1. Next.js Web/API Application (Cluster mode, bounded memory, automatic restarts)
 * 2. Outbox Projection Worker (Singleton fork mode, concurrency leases, graceful shutdown)
 * 
 * Commands:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 status
 *   pm2 logs
 *   pm2 reload all
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      name: 'pocketkirana-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 'max', // Utilizes available CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '900M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      kill_timeout: 5000,
      listen_timeout: 10000,
      time: true,
    },
    {
      name: 'pocketkirana-outbox-worker',
      script: 'scripts/run_outbox_worker.js',
      instances: 1, // Singleton instance: row-level locking handles leases
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '450M',
      env_production: {
        NODE_ENV: 'production',
      },
      kill_timeout: 6000,
      time: true,
    },
  ],
};
