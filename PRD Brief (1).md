# Product Requirements Document (PRD) 

# PocketKirana – Grocery Delivery Platform 

**Version:** 1.0 **Product Manager:** Product Team **Product Name:** PocketKirana 

**Platform:** Responsive Web (Phase 1) | Android & iOS (Phase 2) 

# 1. Executive Summary 

PocketKirana is a modern online grocery delivery platform that connects customers with nearby grocery stores for fast and convenient shopping. The platform enables customers to browse products, place orders, track deliveries, and make secure payments, while providing dedicated portals for store operators, delivery partners, and administrators to efficiently manage operations. 

# 2. Product Vision 

To become the preferred digital grocery platform by delivering fresh products, transparent pricing, and reliable doorstep delivery through a seamless and userfriendly experience. 

# 3. Product Mission 

- Make grocery shopping fast and convenient. 

- Digitize neighborhood grocery stores. 

- Empower delivery partners with efficient workflows. 

- Provide businesses with data-driven management tools. 

- Build a scalable platform for multi-store and multi-city operations. 

# 4. Business Objectives 

### Short-Term (0–12 Months) 

- Launch the web platform. 

- Onboard local grocery stores. 

- Achieve reliable order fulfillment. 

- Build customer trust through secure payments and timely deliveries. 

### Long-Term (1–3 Years) 

- Expand to multiple cities. 

- Launch Android and iOS applications. 

- Introduce loyalty programs and subscriptions. 

- Support multi-language and multi-store operations. 

# 5. Target Users 

## Primary Users 

### Customers 

- Families 

- Working professionals 

- Students 

- Senior citizens 

#### **Needs** 

- Quick grocery shopping 

- Fresh products 

- Transparent pricing 

- Secure checkout 

- Fast delivery 

### Store Managers 

#### **Needs** 

- Manage inventory 

- Process orders 

- Update pricing 

- View sales reports 

### Delivery Partners 

#### **Needs** 

- Receive assigned orders 

- Navigate efficiently 

- Track earnings 

- Complete deliveries securely 

### Administrators 

#### **Needs** 

- Manage users 

- Monitor platform activity 

- Configure products and promotions 

- Analyze business performance 

# 6. Problem Statement 

Traditional grocery shopping often requires significant time and effort. Local stores may lack digital tools to manage inventory, orders, and deliveries efficiently. PocketKirana addresses these challenges by providing a centralized digital platform for ordering, fulfillment, and business management. 

# 7. Value Proposition 

#### For Customers: 

- Shop anytime, anywhere. 

- Wide product selection. 

- Secure payments. 

- Real-time order tracking. 

#### For Stores: 

- Increased digital reach. 

- Simplified inventory and order management. 

- Sales analytics. 

#### For Delivery Partners: 

- Streamlined delivery assignments. 

- Navigation support. 

- Transparent earnings. 

#### For Business Owners: 

- Centralized management. 

- Business insights. 

- Scalable operations. 

# 8. Core Features 

## Customer Portal 

- OTP-based registration and login 

- Product search and category browsing 

- Product details with images and pricing 

- Shopping cart 

- Wishlist 

- Address management 

- Secure checkout 

- Multiple payment options 

- Live order tracking 

- Order history 

- Ratings and reviews 

- Push notifications 

## Store Portal 

- Dashboard 

- Product management 

- Inventory management 

- Order processing 

- Pricing and promotions 

- Reports and analytics 

## Delivery Partner Portal 

- Login 

- Order acceptance 

- Pickup confirmation 

- Navigation 

- Delivery verification (OTP) 

- Earnings dashboard 

- Wallet 

## Admin Dashboard 

- User management 

- Product and category management 

- Store management 

- Delivery partner management 

- Order monitoring 

- Promotions and coupons 

- Reports and analytics 

- CMS and banner management 

- Platform settings 

# 9. Functional Requirements 

### Authentication 

- Customer login via OTP 

- Admin login with email and password 

- Role-based access control 

### Product Catalog 

- Categories and subcategories 

- Search and filters 

- Product images 

- Pricing 

- Stock status 

### Cart & Checkout 

- Add, update, remove items 

- Apply coupons 

- Delivery slot selection 

- Order summary 

### Payments 

- UPI 

- Credit/Debit Cards 

- Net Banking 

- Wallets 

- Cash on Delivery 

### Order Management 

- Order creation 

- Order status updates 

- Order cancellation 

- Refund management 

### Delivery 

- Delivery assignment 

- Live tracking 

- OTP verification 

- Delivery completion 

# 10. Non-Functional Requirements 

- Responsive design 

- High availability (99.9% uptime target) 

- Fast page loads 

- Secure data storage 

- Scalable cloud infrastructure 

- Accessibility (WCAG 2.1 AA) 

- Audit logging 

- Data backup and recovery 

# 11. User Journey 

1. User registers with OTP. 

2. User browses products and categories. 

3. User adds items to the cart. 

4. User selects delivery address and slot. 

5. User completes payment. 

6. Store confirms and prepares the order. 

7. Delivery partner picks up the order. 

8. User tracks delivery in real time. 

9. Delivery is verified with OTP. 

- 10.User rates the order and products. 

# 12. Success Metrics (KPIs) 

### Customer Metrics 

- Customer registration rate 

- Daily Active Users (DAU) 

- Monthly Active Users (MAU) 

- Customer retention rate 

- Repeat purchase rate 

- Customer satisfaction (CSAT) 

- Net Promoter Score (NPS) 

### Business Metrics 

- Gross Merchandise Value (GMV) 

- Average Order Value (AOV) 

- Orders per day 

- Revenue growth 

- Coupon redemption rate 

### Operational Metrics 

- Order acceptance rate 

- Order fulfillment rate 

- Average delivery time 

- On-time delivery percentage 

- Inventory accuracy 

- Order cancellation rate 

### Technical Metrics 

- API response time 

- Page load time 

- Crash-free sessions 

- Error rate 

- Uptime 

- Payment success rate 

# 13. Product Roadmap 

### Phase 1 – MVP 

- Customer web application 

- Admin dashboard 

- Store portal 

- Delivery partner portal 

- OTP authentication 

- Product catalog 

- Shopping cart 

- Checkout 

- Payments 

- Order management 

### Phase 2 

- Android application 

- iOS application 

- Push notifications 

- Loyalty points 

- Referral program 

- Coupons 

### Phase 3 

- AI-powered product recommendations 

- Voice search 

- Subscription orders 

- Personalized offers 

- Multi-language support 

- Multi-city expansion 

# 14. Risks & Mitigations 

|Risk|Mitigation|
|---|---|
|Inventory mismatch|Real-time stock synchronization|
|Payment failures|Retry logic and webhook<br>reconciliation|
|Delivery delays|Smart assignment and live<br>tracking|
|Trafc spikes|Auto-scaling cloud<br>infrastructure|
|Security threats|Encryption, RBAC, WAF, regular<br>audits|



# 15. Out of Scope (Phase 1) 

- International shipping 

- Marketplace for third-party sellers 

- B2B wholesale ordering 

- AI chatbot 

- Voice commerce 

- Subscription meal kits 

# 16. Expected Deliverables 

- Customer Web Application 

- Admin Dashboard 

- Store Management Portal 

- Delivery Partner Portal 

- Backend APIs 

- Authentication System 

- Product & Inventory Management 

- Order & Payment Management 

- Notification System 

- Analytics Dashboard 

- Deployment Infrastructure 

- Technical Documentation 

- User Documentation 

- Operations & Maintenance Guide 

## Product Success Definition 

PocketKirana will be considered successful when it enables customers to complete grocery purchases quickly and reliably, allows stores to manage inventory and orders efficiently, empowers delivery partners with optimized delivery workflows, and provides administrators with the tools to operate and scale the business effectively. The platform should be secure, responsive, scalable, and capable of supporting expansion to multiple stores and cities while maintaining a high-quality user experience. 

