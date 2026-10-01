# POCKETKIRANA — CLOUDFLARE TUNNEL PRODUCTION ARCHITECTURE PLAN

**Domain Target:** `api.pocketkirana.com`  
**Tunnel Identifier:** `pocketkirana-prod-tunnel`  
**Internal Origin:** `http://127.0.0.1:3000` (Next.js Application running on Oracle VPS)  
**Security Model:** Origin Cloaking (Zero inbound public ports, Origin IP shielded from DDoS)  

---

## 1. Architectural Concept

```text
[ Customer / Delivery / Picker Android APKs ]
[ Customer Browser Web Requests            ]
                     │
                     ▼ HTTPS (Port 443)
┌────────────────────────────────────────────────────────┐
│             Cloudflare Global Edge Network             │
│  - Edge SSL/TLS Termination (Strict Full SSL)          │
│  - Cloudflare DDoS Mitigation & WAF                    │
│  - Cloudflare Rate Limiting Rules                      │
│  - Hostname: api.pocketkirana.com                      │
└────────────────────────────┬───────────────────────────┘
                             │
                             ▼ Encrypted QUIC / HTTP2 Tunnel
┌────────────────────────────────────────────────────────┐
│               Oracle VPS Compute Node                  │
│                                                        │
│  cloudflared daemon (systemd service)                  │
│    │ (Outbound connection to Cloudflare PoP)           │
│    ▼                                                   │
│  http://127.0.0.1:3000                                 │
│    ▼                                                   │
│  Next.js 15 App Router Server (Node.js 20 LTS)         │
│  (Bound strictly to 127.0.0.1 — No public IP exposure) │
└────────────────────────────────────────────────────────┘
```

---

## 2. Cloudflare Tunnel Provisioning Steps

### Step 1: Authenticate `cloudflared` with Cloudflare Account
On the Oracle VPS:
```bash
sudo -u pocketkirana cloudflared tunnel login
```
*This provides an authentication link to authorize the `pocketkirana.com` domain zone in Cloudflare.*

### Step 2: Create the Named Production Tunnel
```bash
sudo -u pocketkirana cloudflared tunnel create pocketkirana-prod-tunnel
```
*This command generates:*
- Tunnel Name: `pocketkirana-prod-tunnel`
- Tunnel UUID: `<TUNNEL_UUID>` (e.g. `d41d8cd9-8f00-4200-a000-000000000000`)
- Credentials File: `/home/pocketkirana/.cloudflared/<TUNNEL_UUID>.json`

### Step 3: Install Tunnel Credentials in System Directory
```bash
sudo mkdir -p /etc/cloudflared
sudo cp /home/pocketkirana/.cloudflared/<TUNNEL_UUID>.json /etc/cloudflared/
sudo chown root:root /etc/cloudflared/<TUNNEL_UUID>.json
sudo chmod 600 /etc/cloudflared/<TUNNEL_UUID>.json
```

---

## 3. Production Ingress Configuration (`/etc/cloudflared/config.yml`)

Create `/etc/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json

# Metrics & health probe for local monitoring
metrics: 127.0.0.1:2000

ingress:
  # 1. Production API & Mobile Backend
  - hostname: api.pocketkirana.com
    service: http://127.0.0.1:3000
    originRequest:
      connectTimeout: 5s
      noTLSVerify: false
      keepAliveTimeout: 90s
      keepAliveConnections: 100
      httpHostHeader: api.pocketkirana.com

  # 2. Catch-all fallback (Denies any unrecognized hostname)
  - service: http_status:404
```

---

## 4. Systemd Daemon Installation & Service Hardening

```bash
# 1. Install cloudflared as a systemd service
sudo cloudflared service install

# 2. Reload and enable systemd service
sudo systemctl daemon-reload
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# 3. Verify service status
sudo systemctl status cloudflared
```

---

## 5. DNS Routing & Ingress Activation (Phase 5 Cutover)

> [!WARNING]
> **DO NOT RUN THIS COMMAND UNTIL EXPLICITLY INSTRUCTED IN PHASE 5.**
> This command updates public DNS to point `api.pocketkirana.com` to the tunnel.

```bash
# ONLY EXECUTED DURING PHASE 5 RELEASE GATE:
# cloudflared tunnel route dns pocketkirana-prod-tunnel api.pocketkirana.com
```

---

## 6. Health & Verification Procedure

Once the tunnel is active, test connectivity directly:

```bash
# 1. Local Origin Verification
curl -s http://127.0.0.1:3000/api/health | jq .
# Expected: {"status":"ok","service":"pocketkirana-api"}

# 2. Local Cloudflare Tunnel Metrics
curl -s http://127.0.0.1:2000/ready
# Expected: 200 OK

# 3. Edge Public Verification (Post-DNS Routing)
curl -s https://api.pocketkirana.com/api/health | jq .
# Expected: {"status":"ok","service":"pocketkirana-api"}
```

---

## 7. Emergency Rollback Plan

If `cloudflared` fails or unexpected latency occurs:
1. **Restart Tunnel:**
   ```bash
   sudo systemctl restart cloudflared
   ```
2. **Review Tunnel Logs:**
   ```bash
   sudo journalctl -u cloudflared -n 100 --no-pager
   ```
3. **DNS Fallback:**
   In Cloudflare DNS, switch `api.pocketkirana.com` CNAME pointer to maintenance worker or backup origin if disaster recovery is initiated.
