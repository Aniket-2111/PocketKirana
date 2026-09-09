# PocketKirana — Production Incident Management Standard
**Reference:** Extends `PILOT_INCIDENT_LOG.md`  

---

## 1. Incident Severity Definitions

| Severity | Definition | Target Response (SLA) | Target Resolution |
| :--- | :--- | :--- | :--- |
| 🔴 **SEV-1 (CRITICAL)** | Core ordering, PhonePe payments, or database cluster down. Customers cannot place orders. | **< 5 Minutes** | **< 30 Minutes** |
| 🟠 **SEV-2 (HIGH)** | Picker app barcode scanner failure, single darkstore unable to dispatch, or SMS OTP delayed. | **< 15 Minutes** | **< 60 Minutes** |
| 🟡 **SEV-3 (MEDIUM)** | Minor UI display bug, single non-critical coupon failing, or analytics dashboard latency. | **< 2 Hours** | **< 24 Hours** |
| 🟢 **SEV-4 (LOW)** | Cosmetic alignment issue, documentation update, or feature request. | **Next Sprint** | **Scheduled Release** |

---

## 2. Standard Incident Log Template

```markdown
### Incident ID: INC-2026-XXX
* **Timestamp:** YYYY-MM-DD HH:mm:ss IST
* **Severity:** SEV-1 / SEV-2 / SEV-3 / SEV-4
* **Impacted Component:** [e.g. PhonePe Webhook / PostgreSQL Pool / Leaflet Map / Picker App]
* **Customer / Order Impact:** [e.g. 3 orders affected, 1 customer payment pending]
* **Order IDs / Transaction IDs:** [ORD-XXXXX / T260XXXXXXXX]
* **Root Cause Analysis (RCA):** [Detailed technical explanation]
* **Immediate Remediation (Mitigation):** [Action taken to restore service]
* **Permanent Preventative Fix:** [Code / Config / Infrastructure change committed]
* **Assigned Owner:** [Name / Role]
* **Status:** [OPEN / INVESTIGATING / MITIGATED / RESOLVED / CLOSED]
```
