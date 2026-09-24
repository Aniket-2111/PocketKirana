import {
  Product,
  Category,
  CartItem,
  Order,
  Address,
  Coupon,
  Banner,
  DeliveryPartner,
  Notification,
  Review,
  SupportTicket,
  User
} from '@/types';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ServiceabilityResult {
  isServiceable: boolean;
  estimatedDeliveryMins: number;
  nearestStoreId: string;
  nearestStoreName: string;
  deliveryCharge: number;
  freeDeliveryThreshold: number;
}

export interface CartValidationResult {
  isValid: boolean;
  outOfStockItems: { productId: string; productName: string; available: number }[];
  priceChanges: { productId: string; oldPrice: number; newPrice: number }[];
}

export interface CheckoutQuote {
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  tax: number;
  total: number;
  appliedCouponCode?: string;
}

import { apiFetch } from '@/lib/apiClient';

// Helper wrapper for standardized API responses
async function request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await apiFetch(endpoint, {
      ...options,
    });
    const data = await res.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'API request failed',
    };
  }
}

// ----------------------------------------------------
// 1. AUTH & USER APIS
// ----------------------------------------------------
export const authApi = {
  async sendOtp(phone: string): Promise<ApiResponse<{ otpSent: boolean; devOtp: string }>> {
    return request('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  async verifyOtp(phone: string, otp: string): Promise<ApiResponse<{ user: User; token: string }>> {
    return request('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });
  },

  async logout(): Promise<ApiResponse> {
    return { success: true, message: 'Logged out successfully' };
  },

  async getProfile(): Promise<ApiResponse<User>> {
    return request('/api/users/me');
  },
};

// ----------------------------------------------------
// 2. LOCATION & MAPS APIS
// ----------------------------------------------------
export const locationApi = {
  async checkServiceability(lat: number, lng: number): Promise<ApiResponse<ServiceabilityResult>> {
    return request(`/api/location/serviceability?lat=${lat}&lng=${lng}`);
  },

  async geocode(address: string): Promise<ApiResponse<{ lat: number; lng: number; formattedAddress: string }>> {
    return request(`/api/location/geocode?address=${encodeURIComponent(address)}`);
  },

  async getDeliveryEstimate(lat: number, lng: number): Promise<ApiResponse<{ estimateMins: number }>> {
    return request(`/api/location/delivery-estimate?lat=${lat}&lng=${lng}`);
  },
};

// ----------------------------------------------------
// 3. PRODUCT & CATEGORY APIS
// ----------------------------------------------------
export const productsApi = {
  async listProducts(catId?: string): Promise<ApiResponse<Product[]>> {
    const url = catId ? `/api/products?categoryId=${catId}` : '/api/products';
    return request(url);
  },

  async searchProducts(query: string): Promise<ApiResponse<Product[]>> {
    return request(`/api/products/search?q=${encodeURIComponent(query)}`);
  },
};

export const categoriesApi = {
  async listCategories(): Promise<ApiResponse<Category[]>> {
    return request('/api/categories');
  },
};

// ----------------------------------------------------
// 4. CART & CHECKOUT APIS (Server-Calculated Pricing)
// ----------------------------------------------------
export const cartApi = {
  async validateCart(items: CartItem[]): Promise<ApiResponse<CartValidationResult>> {
    return request('/api/cart/validate', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },
};

export const checkoutApi = {
  async getQuote(cartItems: CartItem[], couponCode?: string): Promise<ApiResponse<CheckoutQuote>> {
    return request('/api/checkout/quote', {
      method: 'POST',
      body: JSON.stringify({ cartItems, couponCode }),
    });
  },

  async placeOrder(payload: {
    addressId: string;
    cartItems: CartItem[];
    paymentMethod: string;
    couponCode?: string;
  }): Promise<ApiResponse<Order>> {
    return request('/api/checkout/place-order', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// ----------------------------------------------------
// 5. PAYMENT APIS (Razorpay Server Verification)
// ----------------------------------------------------
export const paymentsApi = {
  async createRazorpayOrder(amount: number): Promise<ApiResponse<{ razorpayOrderId: string; keyId: string }>> {
    return request('/api/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  async verifyPayment(payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<ApiResponse<{ verified: boolean }>> {
    return request('/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// ----------------------------------------------------
// 6. DELIVERY & PARTNER APIS
// ----------------------------------------------------
export const deliveryApi = {
  async verifyOtp(orderId: string, otp: string): Promise<ApiResponse<{ verified: boolean; earningsAdded: number }>> {
    return request(`/api/delivery/orders/${orderId}/verify-otp`, {
      method: 'POST',
      body: JSON.stringify({ otp }),
    });
  },

  async updateLocation(partnerId: string, lat: number, lng: number): Promise<ApiResponse> {
    return request('/api/delivery/location', {
      method: 'POST',
      body: JSON.stringify({ partnerId, lat, lng }),
    });
  },
};

// ----------------------------------------------------
// 7. INVENTORY APIS
// ----------------------------------------------------
export const inventoryApi = {
  async adjustStock(productId: string, physicalStock: number, reservedStock = 0): Promise<ApiResponse<{ availableStock: number }>> {
    return request('/api/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({ productId, physicalStock, reservedStock }),
    });
  },
};

// ----------------------------------------------------
// 8. ADMIN APIS
// ----------------------------------------------------
export const adminApi = {
  async getOverviewAnalytics(): Promise<ApiResponse<any>> {
    return request('/api/admin/analytics/overview');
  },

  async generateSalesReport(): Promise<ApiResponse<{ downloadUrl: string; rowCount: number }>> {
    return request('/api/admin/reports/sales');
  },
};
