## Pocket Kirana

## Complete App Flow Document (AFD)

Document Version: 1.0 Project: Pocket Kirana Platform: Responsive Web + Android + iOS Modules: Customer • Store • Delivery Partner • Admin

## 1. Application Entry Flow

Launch Website/App

│

Splash Screen

│

Check Internet

│

├ ── No Internet

│ │

│ ▼

│ Retry

│

Check App Version

│

├ ── Update Required

│ │

│ ▼

│ Update App

│

Check Login Status

│

├ ── Logged In

│ │

│ ▼


│ Home Page

│

Login / Register

## 2. Authentication Flow

Welcome Screen

↓

Get Started

↓

Select Language

↓

Enter Mobile Number

↓

Send OTP

↓

OTP Verification

↓

OTP Valid?

├ │ ├ ── Resend OTP │ └ ── Retry


↓

New User?

├ ── Yes │ ├ ── Enter Name ├ ── Email (Optional) ├ ── Accept Terms └ ─ ─ Create Account

↓

Existing User

↓

Home Screen

## 3. Home Screen Flow

Home

│

├ ── Search

├ ── Categories

├ ── Offers

├ ── Banners

├ ── Recommended Products

├ ── Recently Ordered

├ ── Best Sellers


├ ── Wishlist

├ ── Cart

├ ── Notifications

├ ── Profile

└ ─ ─ Orders

## 4. Product Search Flow

Home

↓

Search Bar

↓

Typing...

↓

Search Suggestions

↓

Select Product

↓

Product Details

↓

Add to Cart

↓


Continue Shopping

OR

Go to Cart

## 5. Category Flow

Home

↓

Categories

↓

Choose Category

↓

Subcategory

↓

Product Listing

↓

Filter

↓

Sort

↓

Product Details


↓

Add to Cart

## 6. Product Detail Flow

Product

↓

Images

↓

Description

↓

Price

↓

Offers

↓

Quantity

↓

Reviews

↓

Related Products

↓

Add to Cart


↓

Cart

## 7. Cart Flow

Cart

↓

Increase Quantity

↓

Decrease Quantity

↓

Remove Product

↓

Apply Coupon

↓

Continue Shopping

↓

Checkout

- 8. Checkout Flow

Checkout


↓

Delivery Address

↓

Add Address?

↓

Yes

↓

Location Permission

↓

Google Maps

↓

Save Address

↓

Select Delivery Slot

↓

Order Summary

↓

Select Payment

↓

Confirm Order


- 9. Payment Flow

Payment

│

├

├ ── Razorpay

├ ── PhonePe

├ ── Paytm

├ ── Credit Card

├ ── Debit Card

├ ── Net Banking

└ ── Cash on Delivery

↓

Payment Success

↓

Generate Invoice

↓

Order Confirmation

## 10. Order Tracking Flow

Order Created

↓


Store Accepted

↓

Preparing Order

↓

Packed

↓

Delivery Assigned

↓

Partner Pickup

↓

Live Tracking

↓

OTP Verification

↓

Delivered

↓

Rate Order

- 11. Wishlist Flow

Wishlist


↓

View Products

↓

Move to Cart

↓

Remove Product

↓

Continue Shopping

## 12. Notification Flow

Notifications

↓

Offers

↓

Order Updates

↓

Payment Updates

↓

Delivery Updates

↓

Promotions


## 13. User Profile Flow

Profile

│

├ ── Personal Details

├ ── Saved Addresses

├ ── Orders

├ ── Wishlist

├ ── Wallet

├

├ ── Notifications

├ ── Help

├ ── Privacy

├ ── Terms

└ ── Logout

## 14. Address Management

Addresses

↓

Add

↓


Edit

↓

Delete

↓

Default Address

↓

Save

## 15. Order History

Orders

↓

Active Orders

↓

Completed Orders

↓

Cancelled Orders

↓

Invoice

↓

Reorder


## 16. Review Flow

Delivered

↓

Rate Delivery

↓

Rate Product

↓

Write Review

↓

Upload Images

↓

Submit

## 17. Customer Support Flow

Help

↓

FAQs

↓

Call

↓


Email

↓

Live Chat

↓

Raise Ticket

↓

Track Ticket

## 18. Store Portal Flow

Store Login

↓

Dashboard

│

├ ── Orders

├ ── Inventory

├ ── Products

├ ── Categories

├

├ ── Offers

├ ── Customers


├ ── Reports

├ ── Sales

├ ── Notifications

└ ── Settings

## 19. Inventory Flow

Inventory

↓

Add Product

↓

Barcode Scan

↓

Update Stock

↓

Low Stock Alert

↓

Out of Stock

↓

Reports


- 20. Product Management

Products

↓

Add Product

↓

Upload Images

↓

Description

↓

Price

↓

Variants

↓

Inventory

↓

Publish

↓

Visible to Customer


- 21. Store Order Flow

New Order

↓

Accept

↓

Reject

↓

Prepare

↓

Pack

↓

Ready

↓

Assign Delivery

↓

Completed

- 22. Delivery Partner Flow

Delivery Login

↓

Dashboard


↓

Available Orders

↓

Accept

↓

Navigation

↓

Pickup

↓

OTP Delivery

↓

Complete

↓

Wallet Updated

- 23. Delivery Dashboard

Dashboard

│

├ ── Today's Orders

├ ── Earnings


├ ── Wallet

├ ── History

├ ── Performance

├ ── Notifications

└ ─ ─ Profile

## 24. Admin Login Flow

Admin Login

↓

Email

↓

Password

↓

2FA

↓

Dashboard

## 25. Admin Dashboard

Dashboard

│

├ ── Users


├ ── Products

├ ── Categories

├ ── Brands

├ ── Stores

├ ── Orders

├ ── Delivery Partners

├

├ ── Offers

├ ── Payments

├ ── Reports

├ ── Analytics

├ ── CMS

├ ── Notifications

└ ── Settings

- 26. Admin Product Flow

Products

↓

Create Category

↓


Create Brand

↓

Add Product

↓

Images

↓

Pricing

↓

Inventory

↓

Publish

## 27. Admin Order Flow

Orders

↓

View

↓

Assign Store

↓

Assign Delivery

↓


Track

↓

Refund

↓

Cancel

↓

Complete

## 28. Coupon Flow

Coupons

↓

Create

↓

Conditions

↓

Discount

↓

Publish

↓

Analytics


## 29. Banner Management

Banner

↓

Upload

↓

Title

↓

Link

↓

Schedule

↓

Publish

## 30. Reports

Reports

↓

Sales

↓

Revenue

↓


Orders

↓

Inventory

↓

Users

↓

Delivery

↓

Payments

↓

Export PDF

↓

Export Excel

## 31. Navigation Map

Splash │ ├ ── Login │ └── Home │ ├── Search │ ├── Categories │ ├── Offers │ ├── Product Details │ ├── Cart │ ├── Checkout


│ ├── Payment │ ├── Order Tracking │ ├── Orders │ ├── Wishlist │ ├── Notifications │ ├── Profile │ └── Support │

├ ── Store Portal │ ├── Dashboard │ ├── Inventory │ ├── Products │ ├── Orders │ ├── Reports │ └── Settings │

├ ── Delivery Portal │ ├── Dashboard │ ├── Orders │ ├── Navigation │ ├── Earnings │ └── Wallet │

└ ─ ─ Admin Portal ├ ── Dashboard

├

Users—

├ ── Products ├ ── Orders ├ ── Stores ├ ── Delivery ├ ── Payments ├ ── Reports

└

CMS—

## Summary

This App Flow Document maps the complete end-to-end navigation for Pocket Kirana, covering every primary screen, user action, and navigation path across all four user roles:

- Customer: onboarding, browsing, cart, checkout, payments, tracking, support.


- Store: inventory, products, order fulfillment, reporting.

- Delivery Partner: order acceptance, navigation, delivery confirmation, earnings.

- Admin: platform management, users, stores, orders, analytics, promotions, and settings.

This document can serve as the foundation for UI/UX wireframes, user journey

mapping, functional specifications, and development planning.
