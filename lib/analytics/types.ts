import { PostHogEventName } from './events';

export type UserRole = 'customer' | 'store_manager' | 'delivery_partner' | 'admin' | 'picker' | 'guest';

export type AppPlatform = 'web' | 'customer_apk' | 'delivery_apk' | 'picker_apk';

export interface UserAnalyticsProperties {
  user_role?: UserRole;
  account_created_at?: string;
  app_version?: string;
  platform?: AppPlatform;
  device_type?: string;
  environment?: string;
  [key: string]: any;
}

export interface ProductAnalyticsProperties {
  product_id: string;
  category_id?: string;
  brand_id?: string;
  product_name?: string;
  price?: number;
  quantity?: number;
  source?: string;
  variant_id?: string;
  mrp?: number;
  [key: string]: any;
}

export interface CartAnalyticsProperties {
  product_id?: string;
  quantity?: number;
  cart_item_count?: number;
  cart_value?: number;
  source?: string;
  variant_id?: string;
  [key: string]: any;
}

export interface CheckoutAnalyticsProperties {
  order_id?: string;
  cart_value?: number;
  coupon_code?: string;
  discount_amount?: number;
  payment_method?: string;
  delivery_zone?: string;
  failure_type?: string;
  error_message?: string;
  [key: string]: any;
}

export interface OrderAnalyticsProperties {
  order_id: string;
  order_number?: string;
  order_value?: number;
  item_count?: number;
  payment_method?: string;
  delivery_zone?: string;
  store_id?: string;
  status?: string;
  cancel_reason?: string;
  [key: string]: any;
}

export interface DeliveryAnalyticsProperties {
  order_id?: string;
  partner_id?: string;
  status?: string;
  delivery_zone?: string;
  failure_reason?: string;
  distance_km?: number;
  [key: string]: any;
}

export interface PickerAnalyticsProperties {
  order_id?: string;
  picker_id?: string;
  product_id?: string;
  quantity?: number;
  barcode?: string;
  item_count?: number;
  [key: string]: any;
}

export interface ErrorAnalyticsProperties {
  route?: string;
  error_code?: string | number;
  http_status?: number;
  platform?: AppPlatform;
  app_version?: string;
  context?: string;
  message?: string;
  [key: string]: any;
}

export interface PerformanceAnalyticsProperties {
  duration_ms: number;
  platform?: AppPlatform;
  app_version?: string;
  route?: string;
  [key: string]: any;
}

export interface TrackEventOptions {
  distinctId?: string;
  dedupKey?: string;
  dedupWindowMs?: number;
}
