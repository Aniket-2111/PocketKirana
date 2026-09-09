# PocketKirana — Operational Known Issues & Mitigations

---

## 1. Known Operational Nuances & Safeguards

| Issue Area | Description | Built-In System Mitigation | Operational Recommendation |
| :--- | :--- | :--- | :--- |
| **Phone SMS Gateway Quota** | Firebase Phone Auth SMS carrier delivery can encounter carrier delays or regional SMS quota limits during high-volume testing. | `lib/store.ts` (`sendOtp`) automatically provides a demo OTP fallback (`1234`) for authorized test mobile numbers when carrier networks fail. | Enable Indian SMS Region policy in Google Cloud Console and set up Firebase Blaze billing with custom SMS quotas for live production. |
| **Localhost Auth Middleware Bypass** | To allow rapid local pair-programming and role switching, `middleware.ts` permits a bypass on `localhost` when `NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED !== 'true'`. | In production (`NODE_ENV=production`), the bypass is strictly disabled and enforces cryptographic session tokens. | Ensure production builds always execute with `NODE_ENV=production`. |
| **Camera Barcode Scan Permission** | On some low-end Android mobile devices, camera hardware permissions may be revoked or denied by the user. | `picker-app` and `BarcodeScannerModal.tsx` include a manual barcode numeric input box as a zero-friction fallback. | Ensure darkstore picking devices have camera permissions pre-granted in Android Settings. |
| **PostgreSQL Lock Contention** | Under high concurrent order volume, simultaneous stock deductions could encounter transient serialization conflicts. | `lib/postgres.ts` implements `withTransaction` with automatic exponential backoff retry on SQL codes `40001` and `40P01`. | Keep transaction execution bodies minimal and index all foreign keys (already implemented). |
