# Pocket Kirana — Payment & Invoice Architecture
**Effective date:** 12 September 2026

## Backend is the source of truth
The backend is authoritative for order total, payment method/status, verified amount, payment reference and refund status. Client apps cannot set PAID.

## COD digital payment
Example:

COD ₹450
→ backend creates payment request
→ transaction-specific/dynamic QR
→ customer pays
→ provider verifies
→ backend verifies order/reference/amount/status
→ paymentStatus = PAID
→ delivery app updates
→ OTP enabled
→ OTP verified
→ delivery completed.

A displayed QR or customer screenshot is not proof of payment.

## Amount validation
The expected amount comes from the authoritative order record. Provider-verified amount must match before PAID is recorded.

## Idempotency
Payment creation and provider webhook processing must be idempotent. Duplicate callbacks must not create duplicate financial records.

## Failure/mismatch
Failures, expirations and amount mismatches do not unlock OTP and should enter appropriate reconciliation/review states.

## OTP
For COD digital payment, OTP remains locked until required payment verification is complete. OTP is verified server-side.

## Delivery completion
Only the assigned authenticated delivery partner can complete the order, and only after required payment/OTP/order-state checks.

## Invoice source of truth
Website, customer app and admin use the same backend invoice record.

## Invoice fields
Where applicable: seller identity/address, FSSAI information, GSTIN only if applicable, order/invoice number, dates, customer details, products, quantities, prices, discounts, delivery, applicable tax, total and payment status.

## Invoice integrity
Finalized invoices retain the snapshot used at generation. Template changes do not rewrite historical invoices. Refunds/adjustments should use the appropriate financial document process.

## Customer access
Customer invoice downloads require authentication and order ownership verification.

## Admin
Authorised admins can view/download invoices and configure future templates. Ordinary template settings must not alter finalized financial values.

## Tax
Tax is based on actual product/order configuration and applicable law; do not hard-code one GST rate for all groceries.

## FSSAI
Applicable FSSAI information must be displayed on required food-business documents. Current project reference: **21526070001778**. Verify before production.

## Audit
Record payment initiation/verification/failure, refunds, invoice creation/finalisation/download and delivery completion.

## Security
Never trust client-provided customer ID, delivery partner ID, invoice ID, amount, order total, payment status or provider status.
