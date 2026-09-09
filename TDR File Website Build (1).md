# Technical Design Document (TDD) 

# PocketKirana – Grocery Delivery Platform 

**Version:** 1.0 **Project Name:** PocketKirana **Document Type:** Technical Design Document (TDD) 

# 1. Project Overview 

PocketKirana is a full-stack grocery delivery platform designed to provide a seamless online shopping experience. The platform supports customers, store operators, delivery partners, and administrators through dedicated web portals. It is designed to be scalable, secure, high-performing, and cloud-native. 

# 2. System Architecture 

Internet │ Cloudflare CDN │ Load Balancer / WAF │ ┌──────────────────────────────────┐ Next.js Frontend         │ │ Customer | Admin | Store | Rider │ │ └──────────────────────────────────┘ │ HTTPS REST API │ ┌──────────────────────────────────┐ Backend (Next.js APIs)      │ │ Authentication                   │ │ Products                         │ │ Orders                           │ │ 

Inventory                        │ │ Payments                         │ │ Delivery                         │ │ Notifications                    │ │ └──────────────────────────────────┘ │ ┌──────────────────────────────────┐ Firebase Cloud Platform          │ │ Firestore                        │ │ Authentication                   │ │ Storage                          │ │ Cloud Functions                  │ │ Cloud Messaging                  │ │ └──────────────────────────────────┘ │ ┌────────────┬────────────┬────────────┐ │ │ │ │ Google Maps   Razorpay     SMS OTP     Analytics 

# 3. Technology Stack 

## Frontend 

- Next.js 15 

- React 19 

- TypeScript 

- Tailwind CSS 

- Material UI 

- Emotion 

- Swiper.js 

- Framer Motion 

- React Hook Form 

- Zod Validation 

## Backend 

- Next.js API Routes 

- Node.js 

- Firebase Cloud Functions 

- REST APIs 

## Database 

- Firebase Firestore 

- Firebase Storage 

## Authentication 

- Firebase Authentication 

- Phone OTP Login 

- Email Authentication (Admin) 

## State Management 

- Zustand 

- React Context API 

## Caching 

- Next.js Server Cache 

- Firebase Local Cache 

## Search 

- Firestore Indexes 

- Optional Algolia (Future) 

## Hosting 

- Vercel 

- Firebase Hosting 

- Cloudflare CDN 

# 4. Third-Party Integrations 

## Authentication 

- Firebase Authentication 

- Google Login 

- Apple Login (Future) 

## Payment Gateway 

- Razorpay 

- PhonePe 

- Paytm 

- UPI 

- Cash on Delivery 

## Maps & Location 

- Google Maps API 

- Places API 

- Distance Matrix API 

- Geolocation API 

## Notifications 

- Firebase Cloud Messaging 

- Email SMTP 

- SMS Gateway 

## Analytics 

- Google Analytics 4 

- Google Tag Manager 

- Microsoft Clarity 

## Media Storage 

- Firebase Storage 

## Monitoring 

- Firebase Crashlytics 

- Google Cloud Monitoring 

## Barcode 

- Barcode Scanner API 

## Security 

- Google reCAPTCHA 

- Cloudflare WAF 

# 5. User Modules 

## Customer 

- Registration 

- OTP Login 

- Browse Products 

- Search Products 

- Wishlist 

- Cart 

- Checkout 

- Payment 

- Order Tracking 

- Reviews 

- Notifications 

## Store Portal 

- Product Management 

- Inventory 

- Orders 

- Reports 

- Coupons 

- Pricing 

- Promotions 

## Delivery Partner 

- Login 

- Accept Orders 

- Navigation 

- Pickup 

- Delivery OTP 

- Earnings 

- Wallet 

## Admin 

- Dashboard 

- User Management 

- Product Management 

- Categories 

- Brands 

- Stores 

- Delivery Partners 

- Orders 

- Coupons 

- Analytics 

- CMS 

- Reports 

###  Settings 

# 6. Data Flow 

## Customer Order Flow 

Customer 

#### ↓ 

Browse Products 

#### ↓ 

Add to Cart 

↓ 

Checkout 

↓ 

Address Selection 

↓ 

Payment Gateway 

↓ 

Order Creation 

#### ↓ 

Inventory Validation 

↓ 

Store Confirmation 

↓ 

Delivery Partner Assignment 

↓ 

Pickup 

#### ↓ 

Live Tracking 

#### ↓ 

Delivery OTP 

#### ↓ 

Order Completed 

↓ 

Invoice Generation 

## Product Management Flow 

Admin 

↓ 

Create Category 

↓ 

Create Brand 

↓ 

Add Product 

#### ↓ 

Upload Images 

#### ↓ 

Set Price 

#### ↓ 

Inventory Sync 

#### ↓ 

Publish Product 

#### ↓ 

Visible to Customer 

## Delivery Flow 

Store 

#### ↓ 

Prepare Order 

#### ↓ 

Ready for Pickup 

#### ↓ 

Delivery Partner Assigned 

#### ↓ 

Pickup Confirmation 

↓ 

Navigation 

#### ↓ 

Customer OTP Verification 

#### ↓ 

Delivery Completed 

#### ↓ 

Payment Settlement 

# 7. Database Collections 

users customers admins stores deliveryPartners products categories brands inventory orders payments coupons addresses notifications reviews wallet settings banners offers logs 

# 8. API Architecture 

/api/auth /api/products /api/categories /api/cart /api/orders /api/payments /api/users /api/store /api/delivery /api/inventory /api/reviews /api/search /api/admin /api/notifications 

# 9. Security Architecture 

- Firebase Authentication 

- JWT Tokens 

- HTTPS Encryption 

- Role-Based Access Control (RBAC) 

- Firestore Security Rules 

- API Rate Limiting 

- Input Validation 

- XSS Protection 

- CSRF Protection 

- Secure Headers 

- Audit Logging 

# 10. Deployment Architecture 

Developer 

#### ↓ 

#### GitHub 

#### ↓ 

GitHub Actions 

#### ↓ 

Vercel Deployment 

↓ 

Firebase Backend 

↓ 

Cloudflare CDN 

↓ 

Production Users 

# 11. Folder Structure 

PocketKirana/ 

apps/ 

- ├── customer-web/ 

- ├── admin-dashboard/ 

- ├── store-portal/ 

- ├── delivery-partner/ 

backend/ 

├── auth/ 

├── products/ 

├── inventory/ 

├── orders/ 

├── payments/ ├── delivery/ ├── notifications/ 

shared/ 

├── components/ ├── hooks/ ├── services/ ├── utils/ ├── types/ 

firebase/ ├── firestore.rules ├── storage.rules ├── functions/ 

public/ assets/ docs/ 

# 12. Performance Strategy 

- Server-Side Rendering (SSR) 

- Static Site Generation (SSG) 

- Incremental Static Regeneration (ISR) 

- Image Optimization 

- Lazy Loading 

- Code Splitting 

- CDN Caching 

- Firestore Indexing 

- API Response Caching 

- Brotli Compression 

- HTTP/3 Support 

# 13. Scalability 

- Horizontal scaling 

- Stateless APIs 

- Cloud Functions 

- CDN-based content delivery 

- Firestore auto-scaling 

- Modular microservice-ready architecture 

- Multi-store support 

- Multi-city expansion 

# 14. Monitoring & Logging 

- Google Analytics 4 

- Firebase Performance Monitoring 

- Cloud Monitoring 

- Error Logging 

- User Activity Logs 

- Order Audit Logs 

- Payment Logs 

- API Monitoring 

# 15. Deliverables 

- Customer Web Application 

- Admin Dashboard 

- Store Portal 

- Delivery Partner Portal 

- REST API Backend 

- Firebase Database 

- Authentication System 

- Inventory Management 

- Order Management 

- Payment Integration 

- Live Delivery Tracking 

- Push Notification System 

- Analytics Dashboard 

- Technical Documentation 

- Deployment Guide 

- Source Code 

- Maintenance Guide 

This Technical Design Document provides the blueprint for building **PocketKirana** as a scalable, enterprise-grade grocery delivery platform with an original architecture, modern cloud technologies, secure integrations, and efficient end-to-end data flow. 

