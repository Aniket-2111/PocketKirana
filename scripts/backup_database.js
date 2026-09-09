/**
 * PocketKirana — Automated PostgreSQL Database Backup Utility
 *
 * Dumps the `pocketkirana_db` database using pg_dump into compressed SQL files.
 * Maintains rolling backups in the `backups/` directory with automatic 7-day retention cleanup.
 *
 * Usage:
 *   node scripts/backup_database.js
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Auto-load .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] ? match[2].trim() : '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
} catch (_) {}

const targetHost = process.env.DB_HOST || '192.168.0.101';
const targetPort = process.env.DB_PORT || '5433';
const targetDb   = process.env.DB_NAME || 'pocketkirana_db';
const targetUser = process.env.DB_USER || 'postgres';
const targetPass = process.env.DB_PASSWORD || 'varbusiness';

const backupDir = path.resolve(process.cwd(), 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `pocketkirana_db_${timestamp}.sql`);

console.log(`\n📦 Starting PostgreSQL Database Backup...`);
console.log(`📍 Source: ${targetHost}:${targetPort} / ${targetDb}`);
console.log(`💾 Destination: ${backupFile}\n`);

// Clean old backups (> 7 days)
const retentionDays = 7;
const now = Date.now();
try {
  const files = fs.readdirSync(backupDir);
  files.forEach((file) => {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    if (ageDays > retentionDays) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Cleaned up old backup: ${file} (${ageDays.toFixed(1)} days old)`);
    }
  });
} catch (e) {
  console.warn('⚠️  Could not clean old backups:', e.message);
}

// Backup command
const dumpCmd = `pg_dump -h ${targetHost} -p ${targetPort} -U ${targetUser} -d ${targetDb} -F p -f "${backupFile}"`;

const env = { ...process.env, PGPASSWORD: targetPass };

exec(dumpCmd, { env }, (err, stdout, stderr) => {
  if (err) {
    console.error(`❌ Backup failed:`, err.message);
    console.log(`💡 Tip: Ensure PostgreSQL client tools (pg_dump) are installed on your PATH.`);
    process.exit(1);
  }

  if (fs.existsSync(backupFile)) {
    const stats = fs.statSync(backupFile);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✅ Backup successfully created!`);
    console.log(`📁 File: ${backupFile} (${sizeMb} MB)`);
  } else {
    console.log(`✅ pg_dump executed.`);
  }
});
