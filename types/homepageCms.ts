import { Product, Category, Coupon } from './index';

export type HomepageSectionType =
  | 'Hero'
  | 'FestivalHero'
  | 'OfferBanner'
  | 'FlashSale'
  | 'ShopByCategory'
  | 'PopularProducts'
  | 'TrendingProducts'
  | 'BestSellers'
  | 'NewArrivals'
  | 'RecommendedForYou'
  | 'BuyAgain'
  | 'RecentlyViewed'
  | 'BecauseYouBought'
  | 'FrequentlyBoughtTogether'
  | 'ComboOffers'
  | 'Buy1Get1'
  | 'FreeGift'
  | 'DiscountAboveThreshold'
  | 'LimitedTimeOffers'
  | 'CustomerRewards'
  | 'LoyaltyProgress'
  | 'CouponBanner'
  | 'FreeDeliveryBanner'
  | 'TopDeals'
  | 'DailyEssentials'
  | 'FreshArrivals'
  | 'PersonalizedProducts'
  | 'SearchSuggestions'
  | 'BrandCollections'
  | 'ExploreMore'
  | 'ExploreMoreProducts'
  | 'InformationalBanner';

export type SectionLayoutStyle = 'grid' | 'carousel' | 'masonry' | 'compact' | 'split' | 'banner';

export type CustomerPersona =
  | 'ALL'
  | 'NEW_CUSTOMER'
  | 'RETURNING_CUSTOMER'
  | 'FREQUENT_BUYER'
  | 'CART_ABANDONER'
  | 'LOYALTY_VIP';

export interface HomepageSectionConfig {
  id: string;
  type: HomepageSectionType;
  title: string;
  subtitle?: string;
  badge?: string;
  tag?: string;
  ctaText?: string;
  ctaLink?: string;
  image?: string;
  mobileImage?: string;
  desktopImage?: string;
  backgroundColor?: string;
  textColor?: string;
  layoutStyle: SectionLayoutStyle;
  targetCategoryIds?: string[];
  targetProductIds?: string[];
  targetOfferId?: string;
  targetCouponCode?: string;
  thresholdAmount?: number;
  freeGiftProductId?: string;
  maxItems?: number;
  displayOrder: number;
  targetPersona: CustomerPersona;
  targetDate?: string; // ISO datetime for countdowns
  showTimer?: boolean;
  isActive: boolean;
  scheduleStart?: string;
  scheduleEnd?: string;
  customData?: Record<string, any>;
}

export type HomepageLayoutStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';

export interface HomepageLayoutConfig {
  id: string;
  name: string;
  description?: string;
  festivalKey?: string;
  version: number;
  status: HomepageLayoutStatus;
  sections: HomepageSectionConfig[];
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export interface RecommendationScoreResult {
  product: Product;
  score: number;
  reasons: string[];
  source: 'AFFINITY' | 'REORDER' | 'POPULARITY' | 'CROSS_SELL' | 'PROMOTION' | 'TRENDING';
}

export interface BundleOffer {
  id: string;
  title: string;
  mainProductId: string;
  bundledProductIds: string[];
  discountPercentage: number;
  totalMrp: number;
  bundlePrice: number;
  savings: number;
}

export interface SmartCartOfferState {
  subtotal: number;
  freeDeliveryThreshold: number;
  freeDeliveryUnlocked: boolean;
  freeDeliveryAmountNeeded: number;
  freeGiftThreshold: number;
  freeGiftUnlocked: boolean;
  freeGiftAmountNeeded: number;
  freeGiftProduct?: Product;
}
