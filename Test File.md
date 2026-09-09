# Pocket Kirana — Complete Testing Project File 

**Document Type:** QA & Security Test Plan **Version:** 1.0 

**Testing Scope:** Customer App/Web, Admin Panel, Store Panel, Delivery Partner App, Backend APIs, Database, Integrations, Infrastructure and Security. 

## 1. Testing Execution Order 

1. System Design Validation ↓ 2. Environment & Configuration Testing ↓ 3. Database Testing ↓ 4. API Testing ↓ 5. Authentication & OTP Security ↓ 6. Frontend/UI Testing ↓ 7. Integration & Connection Testing ↓ 8. Business Logic Testing ↓ 9. End-to-End System Testing ↓ 10. Cybersecurity Testing ↓ 11. Performance & Load Testing ↓ 12. Compatibility Testing ↓ 13. Regression Testing ↓ 14. UAT ↓ 15. Production Security & Smoke Testing 

# 2. Test Environment 

Create separate environments: 

- Development 

- QA/Staging 

- Production 

Never perform destructive security testing directly against production. Required test data: 

- Test customers 

- Test stores 

- Test delivery partners 

- Test administrators 

- Test products 

- Test orders 

- Test payment accounts 

- Test OTP numbers/services 

# 3. System Design Testing 

### Architecture 

- ☐ Verify frontend → API communication. 

- ☐ Verify API → database communication. 

- ☐ Verify authentication service. 

- ☐ Verify payment gateway integration. 

- ☐ Verify notification service. 

- ☐ Verify map/location integration. 

- ☐ Verify storage/CDN. 

- ☐ Verify admin/store/delivery/customer role separation. 

- ☐ Verify failure handling when an external service is unavailable. 

- ☐ Verify retry and timeout mechanisms. 

### Architecture Security 

- ☐ No database credentials in frontend. 

- ☐ No secret API keys in client-side JavaScript. 

- ☐ HTTPS enforced. 

- ☐ Production secrets stored in server-side secret management. 

- ☐ Admin APIs protected. 

- ☐ Internal services not unnecessarily exposed publicly. 

# 4. Database Testing 

### Schema 

- ☐ Verify all required tables/collections exist. 

- ☐ Verify primary keys. 

- ☐ Verify foreign keys. 

- ☐ Verify unique constraints. 

- ☐ Verify nullable/non-nullable fields. 

- ☐ Verify indexes. 

- ☐ Verify enum/status values. 

### CRUD 

Test: 

CREATE READ 

#### UPDATE DELETE 

for: 

- Users 

- Stores 

- Products 

- Categories 

- Inventory 

- Cart 

- Orders 

- Payments 

- Delivery 

- Coupons 

- Reviews 

- Notifications 

### Data Integrity 

- ☐ User cannot access another user's address. 

- ☐ Order must belong to a valid customer. 

- ☐ Order item must reference a valid product. 

- ☐ Payment must reference the correct order. 

- ☐ Delivery must reference the correct order. 

- ☐ Deleted/inactive products cannot incorrectly appear as purchasable. 

- ☐ Inventory cannot become negative. 

- ☐ Duplicate order creation is prevented. 

- ☐ Transaction/atomicity rules prevent partial order creation. 

### Database Security 

- ☐ Database is not publicly accessible. 

- ☐ Least-privilege database accounts. 

- ☐ Sensitive fields protected. 

- ☐ Backups configured. 

- ☐ Restore procedure tested. 

- ☐ Audit logs enabled. 

- ☐ SQL/NoSQL injection tests performed. 

# 5. API Testing 

Test every endpoint for: 

### Functional 

- ☐ Correct request accepted. 

- ☐ Correct response returned. 

- ☐ Invalid request rejected. 

- ☐ Missing fields rejected. 

- ☐ Invalid data types rejected. 

- ☐ Unauthorized request rejected. 

- ☐ Expired token rejected. 

- ☐ Correct HTTP status codes returned. 

### API Security 

Test: 

- ☐ Authentication bypass 

- ☐ Authorization bypass 

- ☐ IDOR/BOLA 

- ☐ Parameter tampering 

- ☐ Injection 

- ☐ Rate-limit enforcement 

- ☐ Excessive request payloads 

- ☐ Sensitive information leakage 

- ☐ Improper error messages 

- ☐ CORS configuration 

- ☐ HTTP method restrictions 

### API Key Testing 

- ☐ Frontend contains no private API keys. 

- ☐ Secret keys are server-side only. 

- ☐ Test/staging keys are not used in production. 

- ☐ Production keys are not committed to Git. 

- ☐ .env files are excluded from source control. 

- ☐ Key rotation procedure works. 

- ☐ Revoked keys stop working. 

- ☐ Third-party API permissions follow least privilege. 

# 6. OTP Security Testing 

This is a critical Pocket Kirana test area. 

OTP Generation 

- ☐ OTP generated only through authorized request. 

- ☐ OTP has appropriate expiration. 

- ☐ OTP is unpredictable. 

- ☐ OTP is single-use. 

- ☐ Old OTP becomes invalid after successful verification. 

- ☐ Previous OTP cannot be reused. 

### OTP Verification 

Test: 

Correct OTP       → SUCCESS Wrong OTP         → FAILURE Expired OTP       → FAILURE Already-used OTP  → FAILURE Missing OTP       → FAILURE Invalid format    → FAILURE 

### OTP Abuse Protection 

- ☐ Limit OTP requests per phone/account. 

- ☐ Limit verification attempts. 

- ☐ Apply cooldown between resend requests. 

- ☐ Prevent automated OTP-request flooding. 

- ☐ Prevent account enumeration. 

- ☐ Verify rate limits by IP/device/account where appropriate. 

- ☐ Verify CAPTCHA/risk controls where appropriate. 

- ☐ Do not log OTP values. 

- ☐ Do not expose OTP in API responses. 

- ☐ OTP must not appear in URLs. 

### Session Security 

- ☐ Successful OTP verification creates a secure session/token. 

- ☐ Logout invalidates/revokes the appropriate session. 

- ☐ Token expiration works. 

- ☐ Refresh-token rotation/revocation works if implemented. 

- ☐ OTP verification cannot be replayed. 

# 7. Frontend Testing 

## Home 

- ☐ Page loads. 

- ☐ Banners work. 

- ☐ Categories work. 

- ☐ Product cards work. 

- ☐ Search works. 

- ☐ Cart count updates. 

- ☐ Login state displays correctly. 

## Product Page 

- ☐ Images load. 

- ☐ Price is correct. 

- ☐ MRP/discount is correct. 

- ☐ Stock status is correct. 

- ☐ Quantity selector works. 

- ☐ Add to cart works. 

- ☐ Wishlist works. 

## Cart 

- ☐ Add item. 

- ☐ Remove item. 

- ☐ Increase quantity. 

- ☐ Decrease quantity. 

- ☐ Out-of-stock handling. 

- ☐ Price recalculation. 

- ☐ Coupon calculation. 

- ☐ Delivery charge calculation. 

## Checkout 

- ☐ Address selection. 

- ☐ Add address. 

- ☐ Edit address. 

- ☐ Delivery slot. 

- ☐ Payment method. 

- ☐ Order summary. 

- ☐ Final amount. 

- ☐ Order confirmation. 

# 8. Responsive Testing 

Test at minimum: 

- ☐ Mobile 

- ☐ Tablet 

- ☐ Laptop 

- ☐ Desktop 

- ☐ Large desktop 

Verify: 

- ☐ No horizontal overflow. 

- ☐ Navigation works. 

- ☐ Buttons are usable. 

- ☐ Forms work. 

- ☐ Product grids adapt. 

- ☐ Checkout remains usable. 

- ☐ Touch interactions work. 

# 9. Browser & Device Testing 

Test major supported: 

- Chrome 

- Edge 

- Firefox 

- Safari 

- Android Chrome 

- iOS Safari 

Also test: 

- Slow network 

- Offline/online transition 

- Poor connectivity 

- Permission denial 

- Location disabled 

# 10. Integration Testing 

Payment 

Create Order ↓ Payment Request ↓ Gateway ↓ Success/Failure ↓ Webhook ↓ Payment Verification ↓ Order Status 

Test: 

☐ Successful payment. 

- ☐ Failed payment. 

- ☐ Cancelled payment. 

- ☐ Timeout. 

- ☐ Duplicate callback/webhook. 

- ☐ Incorrect payment amount. 

- ☐ Payment received but browser closes. 

- ☐ Webhook replay. 

☐ Refund. 

- ☐ Partial refund if supported. 

**Important:** Never mark an order as paid solely because the frontend says payment succeeded. Verify the transaction server-side using the payment provider's trusted response/webhook. 

### Maps 

- ☐ Location permission. 

- ☐ Address search. 

- ☐ Invalid address. 

- ☐ Distance calculation. 

- ☐ Delivery-area validation. 

- ☐ Map API failure. 

- ☐ API quota failure. 

### Notifications 

- ☐ OTP notification. 

- ☐ Order confirmation. 

- ☐ Payment notification. 

- ☐ Order status. 

- ☐ Delivery notification. 

- ☐ Push notification. 

- ☐ Email. 

- ☐ SMS. 

# 11. Order Management Testing 

Test the complete lifecycle: 

Cart ↓ Checkout ↓ Order Created ↓ Payment Verified 

↓ Store Accepted ↓ Preparing ↓ Packed ↓ Ready for Pickup ↓ Delivery Assigned ↓ Picked Up ↓ Out for Delivery ↓ Delivered 

Also test: 

- Cancellation 

- Refund 

- Failed delivery 

- Customer unavailable 

- Store rejects order 

- Product unavailable 

- Delivery partner rejects assignment 

- Order timeout 

# 12. Inventory Testing 

- ☐ Stock decreases after confirmed order. 

- ☐ Reserved stock handled correctly. 

- ☐ Stock restored after cancellation where applicable. 

- ☐ Out-of-stock product cannot be purchased. 

- ☐ Concurrent orders cannot oversell inventory. 

- ☐ Low-stock alert works. 

- ☐ Store/admin stock updates synchronize correctly. 

- ☐ Inventory audit history is retained. 

# 13. Role & Permission Testing 

### Customer 

- ☐ Customer cannot access admin. 

- ☐ Customer cannot access store management. 

- ☐ Customer cannot modify another user's order. 

### Store 

- ☐ Store sees only authorized store data. 

- ☐ Store cannot modify another store's inventory. 

- ☐ Store cannot access admin functions. 

### Delivery Partner 

- ☐ Partner sees assigned/authorized deliveries only. 

- ☐ Partner cannot access customer administrative functions. 

- ☐ Partner cannot modify payment records. 

### Admin 

- ☐ Admin permissions follow role. 

- ☐ Sensitive actions require appropriate authorization. 

# 14. Cybersecurity Testing 

Use a controlled security assessment based on recognized application-security practices such as OWASP testing guidance. 

Test for: 

- ☐ Broken access control 

- ☐ Authentication weaknesses 

- ☐ Injection 

- ☐ XSS 

- ☐ CSRF where applicable 

- ☐ SSRF where applicable 

- ☐ Security misconfiguration 

- ☐ Sensitive-data exposure 

- ☐ Insecure file upload 

- ☐ Session weaknesses 

- ☐ Rate-limit weaknesses 

- ☐ Business-logic abuse 

### Do not expose 

- Passwords 

- OTPs 

- Payment secrets 

- API private keys 

- Database credentials 

- Access tokens 

- Refresh tokens 

- Internal infrastructure details 

# 15. File Upload Security 

For product images, profile images and documents: 

- ☐ Validate file type. 

- ☐ Validate file size. 

- ☐ Validate extension and MIME type. 

- ☐ Generate safe filenames. 

- ☐ Prevent executable uploads. 

- ☐ Store uploads outside executable paths. 

- ☐ Scan files where appropriate. 

- ☐ Verify authorization before upload. 

- ☐ Verify authorization before download/delete. 

# 16. Session & Token Security 

- ☐ Secure cookies where cookies are used. 

- ☐ HttpOnly cookies where appropriate. 

- ☐ Secure flag in production. 

- ☐ Appropriate SameSite policy. 

- ☐ Token expiry. 

- ☐ Token revocation strategy. 

- ☐ Logout behavior. 

- ☐ Concurrent session policy. 

- ☐ Sensitive actions require reauthentication/step-up authentication where appropriate. 

# 17. Performance Testing 

Test: 

- ☐ Homepage load. 

- ☐ Product listing. 

- ☐ Search. 

- ☐ Cart. 

- ☐ Checkout. 

- ☐ API response times. 

- ☐ Database query performance. 

- ☐ Concurrent users. 

- ☐ Concurrent checkout. 

- ☐ Traffic spikes. 

Measure: 

- Response time 

- Throughput 

- Error rate 

- CPU 

- Memory 

- Database connections 

- Cache hit rate 

# 18. Load & Stress Testing 

Scenarios: 

Normal Load ↓ Peak Load ↓ High Load ↓ Stress ↓ Recovery 

Verify: 

- ☐ System remains stable. 

- ☐ No duplicate orders. 

- ☐ No inventory corruption. 

- ☐ No payment inconsistencies. 

- ☐ APIs enforce rate limits. 

- ☐ Recovery works after load decreases. 

# 19. Reliability Testing 

Test failures of: 

- Database 

- API server 

- Payment gateway 

- SMS provider 

- Email provider 

- Push notification service 

- Maps service 

- CDN 

- Network 

Verify: 

- ☐ Appropriate fallback. 

- ☐ Retry policy. 

- ☐ Timeout. 

- ☐ Circuit breaker where appropriate. 

- ☐ No duplicate transactions. 

- ☐ User receives meaningful error. 

- ☐ Operations team receives alert. 

# 20. Backup & Disaster Recovery 

- ☐ Automated backups enabled. 

- ☐ Backup encryption. 

- ☐ Backup retention. 

- ☐ Restore test. 

- ☐ Disaster recovery procedure. 

- ☐ Recovery Point Objective (RPO) defined. 

- ☐ Recovery Time Objective (RTO) defined. 

- ☐ Backup monitoring. 

# 21. Logging & Monitoring 

Verify logs for: 

- Authentication events 

- Admin actions 

- Order changes 

- Payment events 

- API errors 

- Security events 

- Database failures 

Do **not** log: 

- OTP 

- Passwords 

- Full card details 

- Secret API keys 

- Authentication tokens 

# 22. Business Logic Security 

Test abuse cases: 

- ☐ Negative quantity. 

- ☐ Zero quantity. 

- ☐ Negative price manipulation. 

- ☐ Coupon reuse. 

- ☐ Coupon stacking. 

- ☐ Expired coupon. 

- ☐ Unauthorized discount. 

- ☐ Delivery charge manipulation. 

- ☐ Inventory race condition. 

- ☐ Duplicate checkout. 

- ☐ Duplicate payment callback. 

- ☐ Unauthorized refund. 

- ☐ Unauthorized order status change. 

# 23. End-to-End Testing 

### Complete Customer Journey 

Register ↓ OTP Verify ↓ Login ↓ Set Location ↓ Browse ↓ Search ↓ Product ↓ Add Cart ↓ Coupon ↓ Address ↓ Checkout ↓ Payment ↓ 

Order ↓ Store Processing ↓ Delivery Assignment ↓ Tracking ↓ OTP Delivery Verification ↓ Delivered ↓ Review 

Every step must be tested as one complete business transaction. 

# 24. Regression Testing 

After every major release: 

- ☐ Login 

- ☐ OTP 

- ☐ Product search 

- ☐ Cart 

- ☐ Checkout 

- ☐ Payment 

- ☐ Order 

- ☐ Inventory 

- ☐ Delivery 

- ☐ Admin 

- ☐ Store 

- ☐ Notifications 

- ☐ Reports 

- ☐ Security controls 

# 25. UAT Testing 

Business users verify: 

- ☐ Customer experience. 

- ☐ Store workflow. 

- ☐ Delivery workflow. 

- ☐ Admin workflow. 

- ☐ Pricing. 

- ☐ Promotions. 

- ☐ Inventory. 

- ☐ Payments. 

- ☐ Reports. 

- ☐ Refunds. 

- ☐ Customer support. 

# 26. Production Pre-Launch Checklist 

- ☐ HTTPS enabled. 

- ☐ Production environment separated from staging. 

- ☐ Production secrets configured securely. 

- ☐ Test keys removed. 

- ☐ Debug mode disabled. 

- ☐ Database backup verified. 

- ☐ Monitoring enabled. 

- ☐ Error alerts enabled. 

- ☐ Rate limits enabled. 

- ☐ CORS reviewed. 

- ☐ Security headers reviewed. 

- ☐ Admin MFA/2FA enabled. 

- ☐ OTP rate limits verified. 

- ☐ Payment webhooks verified. 

- ☐ DNS/CDN configured. 

- ☐ Final smoke test completed. 

# 27. Bug Severity 

|Level|Meaning|Example|
|---|---|---|
|**P0 Critical**|Production/security<br>emergency|Payment<br>compromise,<br>authentication<br>bypass|
|**P1 High**|Major functionality<br>broken|Checkout/payment<br>unavailable|
|**P2 Medium**|Important issue|Coupon calculation<br>wrong|
|**P3 Low**|Minor issue|UI alignment<br>problem|



# 28. Test Case Format 

Every test case should use: 

Test Case ID: Module: Feature: Priority: Precondition: Test Data: Steps: Expected Result: Actual Result: Status: Severity: Environment: Tester: Execution Date: Evidence: 

Example: 

TC-AUTH-001 Module: Authentication Feature: OTP Login Priority: Critical 

Precondition: Valid registered mobile number. 

Steps: 

1. Enter mobile number. 

2. Request OTP. 3. Enter valid OTP. 4. Submit. 

Expected: User is authenticated and redirected to the correct dashboard. 

Status: Pass / Fail Evidence: Screenshot + API log/reference 

# 29. Final QA Sign-Off 

Pocket Kirana should be released only after: 

System Design `✓` Database `✓` API `✓` Frontend `✓` Authentication `✓` OTP Security `✓` Payment `✓` Integration `✓` Business Logic `✓` Role Permissions `✓` Cybersecurity `✓` Performance `✓` Compatibility `✓` Backup/Recovery `✓` Regression `✓` UAT `✓` Production Smoke `✓` 

Release Gate 

**Critical/P0 vulnerabilities:** 0 **Unresolved P1 defects:** 0 **Payment reconciliation:** Passed **OTP security:** Passed **Authorization testing:** Passed **Database integrity:** Passed **Backup restore:** Passed **UAT:** Approved **Production smoke test:** Passed 

This should become the **QA/Security Testing section of the Pocket Kirana TDR** , and each checklist item can then be converted into individual test cases in Jira, TestRail, Excel, or another test-management system. 

