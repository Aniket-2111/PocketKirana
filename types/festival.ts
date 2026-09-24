export type FestivalKey =
  | 'ganesh_chaturthi'
  | 'diwali'
  | 'navratri'
  | 'durga_puja'
  | 'baisakhi'
  | 'karwa_chauth'
  | 'holi'
  | 'dussehra'
  | 'eid'
  | 'christmas'
  | 'new_year'
  | 'teej'
  | 'raksha_bandhan'
  | 'makar_sankranti'
  | 'independence_day'
  | 'republic_day'
  | 'akshaya_tritiya'
  | 'onam'
  | 'pongal'
  | 'easter'
  | 'weekend_sale'
  | 'monthly_sale'
  | 'store_anniversary'
  | 'flash_sale'
  | 'custom';

export type TemplateCategory = 'SYSTEM' | 'AI_GENERATED' | 'MY_TEMPLATES' | 'ARCHIVED';

export type CampaignStatus =
  | 'DRAFT'
  | 'READY'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'PAUSED'
  | 'EXPIRED'
  | 'ARCHIVED';

export type AdminRole = 'SUPER_ADMIN' | 'MARKETING_ADMIN' | 'CONTENT_EDITOR' | 'VIEWER';

export type SectionType =
  | 'Hero'
  | 'CategoryGrid'
  | 'ProductGrid'
  | 'ProductCarousel'
  | 'OfferBanner'
  | 'PromoStrip'
  | 'Collection'
  | 'Countdown'
  | 'FlashSale'
  | 'ImageText'
  | 'FestivalDivider'
  | 'RecommendationCarousel'
  | 'RecentlyBought'
  | 'PopularProducts'
  | 'BestSellers'
  | 'FreeDeliveryBanner'
  | 'TrustBanner'
  | 'AppPromotion'
  | 'Footer';

export interface FestivalTheme {
  primaryColor: string; // Hex color e.g. #D97706
  secondaryColor: string; // Hex color e.g. #78350F
  accentColor: string; // Hex color e.g. #FEF3C7
  bgColor?: string; // Background tint e.g. #FFFBEB
  bgGradient?: string; // CSS linear gradient string
  cardBg?: string; // Card background e.g. #FFFFFF
  textColor?: string; // Main text color
  accentTextColor?: string;
  badgeBg?: string;
  badgeTextColor?: string;
  mood?: 'premium_festive' | 'modern_quick_commerce' | 'traditional_indian' | 'minimal_elegant' | 'vibrant_celebration';
  fontStyle?: 'festive_serif' | 'clean_modern' | 'bold_display';
  borderRadius?: 'rounded' | 'curved' | 'pill';
}

export interface FestivalSectionConfig {
  id: string;
  type: SectionType;
  title?: string;
  subtitle?: string;
  badge?: string;
  tag?: string;
  ctaText?: string;
  ctaLink?: string;
  image?: string;
  mobileImage?: string;
  desktopImage?: string;
  targetDate?: string; // ISO datetime for Countdown
  categoryId?: string; // Filter by category
  categoryIds?: string[];
  productIds?: string[]; // Custom list of authoritative product IDs
  maxItems?: number;
  layoutStyle?: 'grid' | 'carousel' | 'masonry' | 'compact' | 'split';
  backgroundColor?: string;
  textColor?: string;
  showTimer?: boolean;
  active?: boolean;
  customData?: Record<string, any>;
}

export interface FestivalTemplate {
  id: string;
  name: string;
  description: string;
  festivalKey: FestivalKey;
  category: TemplateCategory;
  version: number;
  schemaVersion: '1.0';
  minimumAppVersion: string;
  maximumAppVersion?: string;
  previewThumbnail: string;
  theme: FestivalTheme;
  sections: FestivalSectionConfig[];
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
}

export interface FestivalCampaignVersion {
  versionNumber: number;
  snapshot: {
    name: string;
    templateId: string;
    theme: FestivalTheme;
    sections: FestivalSectionConfig[];
    festivalName: string;
    startAt?: string;
    endAt?: string;
  };
  savedAt: string;
  savedBy: string;
  notes?: string;
}

export interface FestivalCampaign {
  id: string;
  name: string;
  festivalName: string;
  templateId: string;
  templateVersion: number;
  status: CampaignStatus;
  priority: number; // 1-100, highest wins when overlapping
  startAt: string; // ISO string in Asia/Kolkata
  endAt: string; // ISO string in Asia/Kolkata
  timezone: string; // Asia/Kolkata
  configurationSnapshot: {
    theme: FestivalTheme;
    sections: FestivalSectionConfig[];
    festivalName: string;
  };
  publishedAt?: string;
  publishedBy?: string;
  versionHistory: FestivalCampaignVersion[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface FestivalAuditLog {
  id: string;
  timestamp: string;
  adminId: string;
  adminName: string;
  action:
    | 'TEMPLATE_CREATED'
    | 'AI_TEMPLATE_GENERATED'
    | 'TEMPLATE_EDITED'
    | 'TEMPLATE_DUPLICATED'
    | 'TEMPLATE_ARCHIVED'
    | 'IMAGE_UPLOADED'
    | 'CAMPAIGN_CREATED'
    | 'CAMPAIGN_PREVIEWED'
    | 'CAMPAIGN_SCHEDULED'
    | 'CAMPAIGN_PUBLISHED'
    | 'CAMPAIGN_PAUSED'
    | 'CAMPAIGN_ROLLED_BACK'
    | 'CAMPAIGN_ARCHIVED'
    | 'EMERGENCY_DISABLE_TOGGLED';
  targetType: 'TEMPLATE' | 'CAMPAIGN' | 'SYSTEM';
  targetId: string;
  targetName: string;
  version?: number;
  details?: string;
  diffSummary?: string;
}

export interface FestivalValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  sectionId?: string;
}

export interface FestivalValidationResult {
  isValid: boolean;
  errors: FestivalValidationIssue[];
  warnings: FestivalValidationIssue[];
}

export interface AIGenerateTemplatePrompt {
  festivalName: string;
  festivalType?: string;
  festivalDescription?: string;
  targetAudience?: string;
  preferredDesignStyle?: 'premium_festive' | 'modern_quick_commerce' | 'traditional_indian' | 'minimal_elegant';
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  themeMood?: string;
  requiredSections?: SectionType[];
  productsOrCategories?: string;
  offerType?: string;
  ctaText?: string;
  mobilePreference?: string;
  websitePreference?: string;
}

export interface AIGeneratedVariation {
  id: string;
  optionLabel: string; // Option A — Premium Festive, Option B — Modern Quick Commerce, etc.
  styleTitle: string;
  description: string;
  template: FestivalTemplate;
}
