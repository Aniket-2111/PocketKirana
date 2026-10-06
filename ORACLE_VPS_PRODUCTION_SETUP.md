# POCKETKIRANA — ORACLE VPS PRODUCTION ENVIRONMENT SETUP GUIDE

**Operating System:** Ubuntu 22.04 LTS or 24.04 LTS (x86_64 or aarch64 Ampere A1)  
**Host Target:** Oracle Cloud Infrastructure (OCI) Compute Instance  
**Security Architecture:** Zero Public Application Ports (All HTTP/API traffic mediated by Cloudflare Tunnel)  
**Database Architecture:** PostgreSQL 16+ bound strictly to `127.0.0.1`  

---

## 1. Oracle Cloud Infrastructure (OCI) Network Security Rules

In the OCI Console under **Virtual Cloud Network (VCN) $\rightarrow$ Security Lists / Network Security Groups**:

| Direction | Source CIDR | Protocol | Port Range | Purpose |
| :---: | :---: | :---: | :---: | :--- |
| **Ingress** | `0.0.0.0/0` (or Admin IP) | TCP | `22` | Secure SSH Administration only |
| **Ingress** | — | — | — | **ALL OTHER PORTS (3000, 5432, 80, 443) CLOSED** |
| **Egress** | `0.0.0.0/0` | All | All | Outbound connectivity (Cloudflare Tunnel, Firebase, PhonePe, MSG91, R2) |

> [!IMPORTANT]
> **No public inbound web ports (80 or 443) need to be opened in OCI.**
> The `cloudflared` daemon creates secure outbound encrypted tunnels directly to Cloudflare edge nodes. This completely hides the VPS origin IP address from the public Internet.

---

## 2. Operating System Base Hardening & Dedicated User

Connect to the instance via SSH as `ubuntu`:

```bash
# 1. Update OS packages
sudo apt update && sudo apt upgrade -y

# 2. Install essential system tools
sudo apt install -y curl wget gnupg lsb-release ufw fail2ban htop unzip git

# 3. Create dedicated application service user (non-root)
sudo useradd -m -s /bin/bash pocketkirana
sudo usermod -aG sudo pocketkirana

# 4. Configure local firewall (UFW)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH Administration'
sudo ufw --force enable
sudo ufw status verbose
```

---

## 3. Node.js 20 LTS & PM2 Installation

Install Node.js 20.x from the official NodeSource repository:

```bash
# 1. Add NodeSource repository for Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 2. Install Node.js
sudo apt install -y nodejs

# 3. Verify Node & npm versions
node -v   # Expected: v20.x.x
npm -v    # Expected: 10.x.x

# 4. Install PM2 process manager globally
sudo npm install -g pm2

# 5. Enable PM2 to restart on system boot
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u pocketkirana --hp /home/pocketkirana
```

---

## 4. PostgreSQL 16+ Installation & Hardening

Install PostgreSQL 16 from the official PostgreSQL Global Development Group (PGDG) apt repository:

```bash
# 1. Add official PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# 2. Install PostgreSQL 16 and client tools
sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16

# 3. Verify PostgreSQL status
sudo systemctl status postgresql
```

### Hardening PostgreSQL Network Configuration:
Edit `/etc/postgresql/16/main/postgresql.conf`:
```ini
# Ensure PostgreSQL listens ONLY on localhost
listen_addresses = '127.0.0.1'
port = 5432
max_connections = 100
shared_buffers = 1GB                  # Tune according to VPS RAM (e.g. 25% of RAM)
work_mem = 16MB
maintenance_work_mem = 128MB
statement_timeout = 4000              # 4-second statement timeout (matches Phase 2)
idle_in_transaction_session_timeout = 5000 # 5-second idle transaction timeout
```

Edit `/etc/postgresql/16/main/pg_hba.conf`:
```text
# TYPE  DATABASE        USER            ADDRESS                 METHOD
# "local" is for Unix domain socket connections only
local   all             all                                     peer
# IPv4 local connections only (reject any remote IP)
host    pocketkirana_db pk_app_user     127.0.0.1/32            scram-sha-256
host    pocketkirana_db pk_migrator     127.0.0.1/32            scram-sha-256
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Provision Database & Separated Roles:
```bash
sudo -u postgres psql << 'EOF'
-- Create Database
CREATE DATABASE pocketkirana_db;

-- 1. Migration Role (DDL privilege for schema evolution)
CREATE ROLE pk_migrator WITH LOGIN PASSWORD 'GENERATE_SECURE_MIGRATOR_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE pocketkirana_db TO pk_migrator;

-- 2. Application Role (Strict DML for Next.js runtime)
CREATE ROLE pk_app_user WITH LOGIN PASSWORD 'GENERATE_SECURE_APP_PASSWORD';
GRANT CONNECT ON DATABASE pocketkirana_db TO pk_app_user;

\c pocketkirana_db

-- Grant schema privileges
GRANT USAGE, CREATE ON SCHEMA public TO pk_migrator;
GRANT USAGE ON SCHEMA public TO pk_app_user;

-- Set default privileges for tables created by pk_migrator
ALTER DEFAULT PRIVILEGES FOR ROLE pk_migrator IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pk_app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE pk_migrator IN SCHEMA public
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO pk_app_user;
EOF
```

---

## 5. Application Code Deployment & Directory Structure

Run as user `pocketkirana`:

```bash
# Switch to application user
sudo -u pocketkirana -i

# Clone repository
git clone https://github.com/Aniket-2111/PocketKirana.git /home/pocketkirana/app
cd /home/pocketkirana/app

# Install dependencies
npm ci

# Configure production environment variables
# Copy .env.production template and fill with real production secrets
# (See PRODUCTION_ENVIRONMENT_MATRIX.md)
nano .env.production

# Build Next.js production bundle
NODE_ENV=production npm run build

# Start services via PM2
pm2 start ecosystem.config.js --env production
pm2 save
```

---

## 6. Cloudflare Tunnel Daemon (`cloudflared`) Installation

```bash
# 1. Download official Cloudflare Tunnel package
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# 2. Verify installation
cloudflared --version

# 3. Authenticate and configure tunnel (Detailed in CLOUDFLARE_TUNNEL_PRODUCTION_PLAN.md)
```
