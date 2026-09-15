export interface LegalDocument {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  badge: string;
  effectiveDate: string;
  category: 'Legal' | 'Privacy' | 'Commerce' | 'Compliance';
  icon: string;
  summary: string;
  sections: {
    heading: string;
    content: string[];
    important?: boolean;
  }[];
}

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    id: 'disclosures',
    slug: 'disclosures',
    title: 'Website & App Disclosures',
    subtitle: 'Business identity, single-seller model & statutory food disclosures',
    badge: 'FSSAI & Business Identity',
    effectiveDate: '12 September 2026',
    category: 'Legal',
    icon: 'Building2',
    summary: 'Comprehensive transparency disclosures regarding Pocket Kirana, Maule Kirana Store, FSSAI registration, and checkout standards.',
    sections: [
      {
        heading: '1. Business Identity & Operating Model',
        content: [
          'Pocket Kirana is the customer-facing grocery ordering and home-delivery platform for Maule Kirana Store.',
          'Legal Operator & Seller: Maule Kirana Store (Pocket Kirana Platform).',
          'Business Address: Neral, Karjat Taluka, Raigad, Maharashtra — 410101, India.',
          'Customer Support: support@pocketkirana.in | +91 86988 93348',
          'Pocket Kirana operates as a single-store inventory-led grocery ordering service. All products are supplied directly from the inventory of Maule Kirana Store. It is not an open marketplace for unrelated third-party sellers.',
        ],
        important: true,
      },
      {
        heading: '2. Food & Product Information Disclosures',
        content: [
          'Product listings accurately display the item name, net pack weight/volume, Maximum Retail Price (MRP), unit sale price, manufacturer/packer details, country of origin, and best-before/use-by dates.',
          'Digital listings do not conceal any legally required package disclosures or nutritional information.',
          'FSSAI Food License Reference: 21526070001778 (Registered with FoSCoS).',
        ],
      },
      {
        heading: '3. Transparent Checkout Disclosures',
        content: [
          'Before placing an order, customers are shown an itemized cost summary: individual item prices, applied coupon discounts, packaging/delivery fees, applicable taxes, final payable total, selected payment method, and exact delivery address.',
          'No hidden convenience or arbitrary handling fees are charged without upfront disclosure on the checkout screen.',
        ],
      },
      {
        heading: '4. Payment & COD Verification Disclosure',
        content: [
          'Pocket Kirana supports prepaid digital payments and Cash-on-Delivery (COD) with doorstep dynamic UPI collection.',
          'For digital COD payments, a dynamic transaction-specific QR code containing the exact order amount is generated on the delivery partner application. Payment is verified in real-time server-side with PhonePe / payment gateway before delivery completion.',
        ],
      },
      {
        heading: '5. Delivery & Estimated Arrival',
        content: [
          'Delivery time estimates (e.g. 10–15 minutes) are estimates based on real-time darkstore proximity and delivery partner availability. Severe weather, road conditions, traffic, or sudden inventory shortages may affect delivery timelines.',
        ],
      },
    ],
  },
  {
    id: 'terms',
    slug: 'terms',
    title: 'Terms & Conditions',
    subtitle: 'User agreements, ordering rules, delivery terms & consumer protections',
    badge: 'User Agreement',
    effectiveDate: '12 September 2026',
    category: 'Legal',
    icon: 'FileText',
    summary: 'Rules governing access to and use of Pocket Kirana website, customer mobile apps, and 10-minute grocery delivery services.',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        content: [
          'By installing, accessing, or placing an order on Pocket Kirana website or mobile app, you agree to be bound by these Terms & Conditions and our linked policies.',
          'Operated by Maule Kirana Store, Neral, Maharashtra, India.',
        ],
      },
      {
        heading: '2. User Accounts & Security',
        content: [
          'Users must provide an accurate 10-digit mobile number and delivery details. Authentication is verified via One-Time Password (OTP).',
          'Users are responsible for maintaining confidentiality of account access and must immediately report unauthorized access.',
        ],
      },
      {
        heading: '3. Product Availability & Pricing',
        content: [
          'All grocery orders are subject to stock availability at Maule Kirana Store. In the event of sudden stock exhaustion, items may be cancelled or substituted with customer consent.',
          'Prices displayed are in Indian Rupees (INR) and include applicable taxes where required by law.',
        ],
      },
      {
        heading: '4. Delivery & Secure OTP Handover',
        content: [
          'Deliveries are dispatched to the customer’s specified GPS location or address within serviceable zones.',
          'A secure 4-digit Delivery OTP is generated for order handover verification. For COD digital payments, OTP is unlocked only after server-side payment confirmation. Do not share OTP before inspecting item handover.',
        ],
        important: true,
      },
      {
        heading: '5. Prohibited Misuse & Fraud Prevention',
        content: [
          'Users must not manipulate order statuses, generate fake or fraudulent orders, forge payment receipts or QR codes, or misuse promotional coupon codes.',
          'Pocket Kirana reserves the right to suspend accounts engaged in abusive return requests or fraudulent claims.',
        ],
      },
      {
        heading: '6. Consumer Rights & Governing Law',
        content: [
          'These terms are governed by the laws of India. Nothing in these terms excludes statutory consumer rights under the Consumer Protection Act, 2019.',
          'Jurisdiction for any legal disputes resides with the competent courts in Raigad / Maharashtra, India.',
        ],
      },
    ],
  },
  {
    id: 'privacy',
    slug: 'privacy',
    title: 'Privacy & DPDP Notice',
    subtitle: 'Digital Personal Data Protection compliance, encryption & user rights',
    badge: 'DPDP Act 2023 Compliant',
    effectiveDate: '12 September 2026',
    category: 'Privacy',
    icon: 'ShieldCheck',
    summary: 'Our data protection standards under the Digital Personal Data Protection (DPDP) Act 2023, data storage, consent, and erasure rights.',
    sections: [
      {
        heading: '1. Data Fiduciary Identity',
        content: [
          'Data Fiduciary: Maule Kirana Store (Pocket Kirana Platform).',
          'Registered Address: Neral, Karjat Taluka, Raigad, Maharashtra — 410101.',
          'Privacy Officer Contact: privacy@pocketkirana.in / support@pocketkirana.in',
        ],
      },
      {
        heading: '2. Personal Data We Collect',
        content: [
          'Contact & Identity: Mobile number, full name, email address (optional).',
          'Delivery & Location: Delivery address, landmark, and GPS coordinates (collected with explicit user permission for darkstore routing and delivery accuracy).',
          'Transactions: Order history, invoice records, payment transaction IDs, and settlement references.',
          'Device & Technical: Device model, app version, IP address, and push notification tokens for live order updates.',
        ],
      },
      {
        heading: '3. Purpose of Processing',
        content: [
          'Order fulfillment, 10-minute dispatch routing, and doorstep delivery.',
          'Generating statutory tax invoices and verifying electronic payments.',
          'Fraud prevention, security audit logging, and customer support resolution.',
          'We do NOT sell, rent, or trade your personal data to third-party advertisers.',
        ],
        important: true,
      },
      {
        heading: '4. Data Security Standards',
        content: [
          '256-Bit SSL/TLS encryption for all data in transit.',
          'Zero Card Storage: Pocket Kirana never stores credit/debit card numbers or UPI PINs. All payments are processed through RBI-authorized payment aggregators (PhonePe).',
          'Role-based database security rules and encrypted cloud storage.',
        ],
      },
      {
        heading: '5. Your Rights Under DPDP Act 2023',
        content: [
          'Right to Access: View your stored profile, addresses, and full order history in-app at any time.',
          'Right to Correction: Update your personal details and address book freely in your profile.',
          'Right to Erasure: Request permanent deletion of your account and personal data by emailing privacy@pocketkirana.in or using the in-app Data Deletion button.',
          'Right to Grievance Redressal: Lodge privacy concerns with our designated Grievance Officer.',
        ],
      },
    ],
  },
  {
    id: 'cookies',
    slug: 'cookies',
    title: 'Cookie & Local Storage Policy',
    subtitle: 'Essential session tokens, preference cache & analytics technologies',
    badge: 'Cookie & Storage',
    effectiveDate: '12 September 2026',
    category: 'Privacy',
    icon: 'Cookie',
    summary: 'Explanation of essential cookies, local storage tokens, and browser cache used for authentication and app performance.',
    sections: [
      {
        heading: '1. Technologies We Use',
        content: [
          'Pocket Kirana uses essential cookies and local storage tokens to provide a seamless, secure ordering experience across web and Android APK.',
          'Essential Session Cookies: `__pk_session` and Firebase auth tokens maintain your verified login state across app restarts.',
          'Local Storage: `pocketkirana-store-v4` caches your active cart, delivery address selection, and theme preferences locally on your device for instant loading.',
        ],
      },
      {
        heading: '2. Purpose Classification',
        content: [
          'Essential / Strictly Necessary: Authentication, cart persistence, payment session validation, and security token management.',
          'Performance & Caching: Offline asset caching, fast product catalog rendering, and darkstore delivery zone caching.',
          'We do not deploy invasive third-party cross-site tracking cookies without explicit consent.',
        ],
      },
      {
        heading: '3. User Controls & Preferences',
        content: [
          'You can clear your local storage and cookies at any time through your browser settings or by logging out of the Pocket Kirana application.',
        ],
      },
    ],
  },
  {
    id: 'refund-policy',
    slug: 'refund-policy',
    title: 'Refund & Cancellation Policy',
    subtitle: 'Order cancellations, damaged items, spoiled perishables & refund timelines',
    badge: 'Cancellations & Refunds',
    effectiveDate: '12 September 2026',
    category: 'Commerce',
    icon: 'RotateCcw',
    summary: 'Clear guidelines on when orders can be cancelled, return eligibility for fresh groceries, and refund settlement timelines.',
    sections: [
      {
        heading: '1. Order Cancellation Policy',
        content: [
          'Orders can be cancelled free of charge before the store picker begins packing the order (Status: PLACED or STOCK_RESERVED).',
          'Once an order is packed or dispatched with a delivery partner (Status: OUT_FOR_DELIVERY), cancellations are restricted to prevent perishable food wastage.',
        ],
      },
      {
        heading: '2. Damaged, Defective or Wrong Items',
        content: [
          'If you receive a damaged, expired, or incorrect item, please notify customer support within 2 hours of delivery with a photo of the item.',
          'Upon instant review, Pocket Kirana will provide an immediate free replacement or a full refund back to your original payment method.',
        ],
        important: true,
      },
      {
        heading: '3. Fresh Fruits, Vegetables & Dairy',
        content: [
          'For fresh produce, milk, paneer, and bakery products, quality issues should be reported upon delivery.',
          'Customers are never required to return spoiled food items physically; photographic verification is sufficient.',
        ],
      },
      {
        heading: '4. Refund Modes & Timelines',
        content: [
          'Prepaid UPI / Online: Refunds are processed immediately and credited to the original bank account within 24–48 banking hours.',
          'COD Dynamic UPI: Refunds for verified doorstep UPI payments are credited directly back to the payer UPI ID via the payment gateway.',
          'Delivery partners are strictly prohibited from handing out informal cash refunds.',
        ],
      },
    ],
  },
  {
    id: 'delivery-policy',
    slug: 'delivery-policy',
    title: 'Delivery & Shipping Policy',
    subtitle: '10-minute darkstore delivery, OTP security & service boundaries',
    badge: '10-Min Fast Delivery',
    effectiveDate: '12 September 2026',
    category: 'Commerce',
    icon: 'Truck',
    summary: 'Service coverage area around Neral hub, delivery partner protocols, doorstep handover, and security rules.',
    sections: [
      {
        heading: '1. Serviceable Delivery Zone',
        content: [
          'Pocket Kirana delivers exclusively within designated active delivery zones (currently Neral and immediate surrounding radii of 3–5 km from our central darkstore hub).',
          'Users outside serviceable coordinates are notified upfront before placing orders.',
        ],
      },
      {
        heading: '2. Express Delivery Timelines',
        content: [
          'Pocket Kirana operates an ultra-fast fulfillment system with target delivery times of 10 to 15 minutes.',
          'Delivery timelines may be extended during peak rain, heavy traffic, night operations, or technical maintenance.',
        ],
      },
      {
        heading: '3. Handover & OTP Verification',
        content: [
          'Every delivery requires secure verification. The customer provides the 4-digit Delivery OTP displayed on their order screen to the delivery partner upon receiving the grocery bag.',
          'For COD orders, the delivery partner generates the PhonePe dynamic QR for payment. Once payment status turns PAID on the rider app, the OTP is validated and the order is marked DELIVERED.',
        ],
        important: true,
      },
      {
        heading: '4. Failed Delivery Attempts',
        content: [
          'If the customer is unreachable after multiple phone calls or address is inaccessible, the order is safely returned to the darkstore hub and refunded according to cancellation guidelines.',
        ],
      },
    ],
  },
  {
    id: 'grievance-redressal',
    slug: 'grievance-redressal',
    title: 'Grievance Redressal Policy',
    subtitle: 'Designated Grievance Officer, complaint escalation & resolution matrix',
    badge: 'Statutory Consumer Redressal',
    effectiveDate: '12 September 2026',
    category: 'Legal',
    icon: 'HelpCircle',
    summary: 'Statutory grievance redressal mechanism under Consumer Protection (E-Commerce) Rules, 2020.',
    sections: [
      {
        heading: '1. Designated Grievance Officer',
        content: [
          'In accordance with the Consumer Protection (E-Commerce) Rules 2020 and Information Technology Rules:',
          'Grievance Officer: Aniket Yadav',
          'Designation: Operations & Grievance Lead',
          'Email: grievance@pocketkirana.in / support@pocketkirana.in',
          'Address: Maule Kirana Store, Neral, Karjat, Raigad, Maharashtra — 410101',
          'Contact Phone: +91 86988 93348',
        ],
        important: true,
      },
      {
        heading: '2. Complaint Submission Channels',
        content: [
          'In-App Support: Profile → Need Help? → Instant Chat & Callback',
          'Email Support: support@pocketkirana.in (Please specify Order #, date, and description)',
          'Phone Support: +91 86988 93348 (Available 7:00 AM – 11:00 PM IST daily)',
        ],
      },
      {
        heading: '3. Resolution Timeline & Escalation',
        content: [
          'Acknowledgement: All formal grievances are acknowledged within 48 hours with a unique ticket reference.',
          'Resolution: Redressal is completed within 15 working days from receipt of complaint.',
          'If dissatisfied with the initial resolution, customers may request escalation directly to the Grievance Officer.',
        ],
      },
    ],
  },
  {
    id: 'payment-terms',
    slug: 'payment-terms',
    title: 'Payment & Invoice Architecture',
    subtitle: 'Server-side verification, PhonePe QR, tax invoice immutability & security',
    badge: 'Payment & Invoicing',
    effectiveDate: '12 September 2026',
    category: 'Commerce',
    icon: 'CreditCard',
    summary: 'Architectural overview of PhonePe gateway integration, dynamic COD QR generation, and tamper-proof PDF invoices.',
    sections: [
      {
        heading: '1. Backend Source of Truth for Payments',
        content: [
          'The Pocket Kirana backend is the sole authority for order totals, payment status, verified amount, and transaction IDs. Client applications cannot set an order to PAID unilaterally.',
          'All payment webhooks and callbacks are cryptographically verified using PhonePe SHA-256 signatures.',
        ],
        important: true,
      },
      {
        heading: '2. COD Doorstep UPI Dynamic QR Workflow',
        content: [
          'Step 1: Customer selects Cash on Delivery (COD).',
          'Step 2: On arrival, delivery partner opens order and selects UPI Payment.',
          'Step 3: Server generates an exact-amount dynamic PhonePe QR Code for that specific order.',
          'Step 4: Customer scans with any UPI app (PhonePe, Google Pay, Paytm, BHIM, Cred) and pays.',
          'Step 5: PhonePe webhook notifies Pocket Kirana backend -> Amount verified -> Status marked PAID -> OTP verified -> Handover completed.',
          'Customer screenshots or verbal claims are never accepted as payment proof without server verification.',
        ],
      },
      {
        heading: '3. Statutory Tax Invoice Standards',
        content: [
          'Every completed order generates an immutable PDF Tax Invoice accessible in the Customer App and Admin Dashboard.',
          'Invoices include: Seller name, address, FSSAI # 21526070001778, unique Invoice #, date, customer name, itemized products with HSN/SAC, discounts, delivery fee, taxes, and payment confirmation stamp.',
          'Historical invoices are frozen upon generation to maintain financial audit integrity.',
        ],
      },
    ],
  },
  {
    id: 'compliance',
    slug: 'compliance',
    title: 'Publication & Regulatory Compliance',
    subtitle: 'FSSAI licensing, Legal Metrology, FoSCoS and e-commerce readiness',
    badge: 'Regulatory Compliance',
    effectiveDate: '12 September 2026',
    category: 'Compliance',
    icon: 'CheckCircle2',
    summary: 'Verification audit of FSSAI registrations, Legal Metrology compliance, consumer protection disclosures, and DPDP readiness.',
    sections: [
      {
        heading: '1. Statutory Licensing & Registration',
        content: [
          'FSSAI State/Central Registration: 21526070001778 (Maule Kirana Store / Pocket Kirana).',
          'Business Category: Retail grocery sales and proprietary delivery fulfillment.',
          'Legal Metrology: Mandatory disclosures (MRP, net quantity, manufacturer, expiry) displayed on all catalog items.',
        ],
        important: true,
      },
      {
        heading: '2. Consumer Protection (E-Commerce) Rules 2020',
        content: [
          'Clear display of seller legal identity, contact details, and Grievance Officer details.',
          'No deceptive dark patterns, pre-ticked optional paid add-ons, or misleading discount representations.',
          'Accurate itemized breakdown before checkout submission.',
        ],
      },
      {
        heading: '3. Digital Personal Data Protection (DPDP) Readiness',
        content: [
          'Minimal permission footprint (Location only requested when needed for delivery check/routing).',
          'Encrypted storage of customer credentials and transaction history.',
          'Self-service account deletion and data export requests supported.',
        ],
      },
    ],
  },
];
