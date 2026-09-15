import {
  FestivalTemplate,
  FestivalTheme,
  FestivalSectionConfig,
  AIGenerateTemplatePrompt,
  AIGeneratedVariation,
  FestivalKey,
} from '@/types/festival';
import { validateFestivalTemplate } from './festivalValidator';

// Helper to determine festival key from name
export function detectFestivalKey(name: string): FestivalKey {
  const lower = name.toLowerCase();
  if (lower.includes('ganesh') || lower.includes('ganpati') || lower.includes('vinayagar')) return 'ganesh_chaturthi';
  if (lower.includes('diwali') || lower.includes('deepavali') || lower.includes('dhanteras')) return 'diwali';
  if (lower.includes('navratri') || lower.includes('durga') || lower.includes('garba') || lower.includes('dussehra')) return 'navratri';
  if (lower.includes('holi') || lower.includes('rang')) return 'holi';
  if (lower.includes('eid') || lower.includes('ramadan')) return 'eid';
  if (lower.includes('christmas') || lower.includes('xmas')) return 'christmas';
  if (lower.includes('new year') || lower.includes('nye')) return 'new_year';
  if (lower.includes('teej') || lower.includes('hartalika')) return 'teej';
  return 'custom';
}

// Generate high quality stock photography based on festival
function getFestivalHeroImages(festivalName: string): { desktop: string; mobile: string; thumb: string } {
  const lower = festivalName.toLowerCase();
  if (lower.includes('ganesh') || lower.includes('ganpati')) {
    return {
      desktop: 'https://images.unsplash.com/photo-1567591414240-e2b26056cf9e?auto=format&fit=crop&w=1200&q=80',
      mobile: 'https://images.unsplash.com/photo-1567591414240-e2b26056cf9e?auto=format&fit=crop&w=600&q=80',
      thumb: 'https://images.unsplash.com/photo-1567591414240-e2b26056cf9e?auto=format&fit=crop&w=600&q=80',
    };
  }
  if (lower.includes('diwali') || lower.includes('deepavali')) {
    return {
      desktop: 'https://images.unsplash.com/photo-1508672019048-805b876b67e2?auto=format&fit=crop&w=1200&q=80',
      mobile: 'https://images.unsplash.com/photo-1508672019048-805b876b67e2?auto=format&fit=crop&w=600&q=80',
      thumb: 'https://images.unsplash.com/photo-1508672019048-805b876b67e2?auto=format&fit=crop&w=600&q=80',
    };
  }
  if (lower.includes('navratri') || lower.includes('durga')) {
    return {
      desktop: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80',
      mobile: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
      thumb: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
    };
  }
  if (lower.includes('holi')) {
    return {
      desktop: 'https://images.unsplash.com/photo-1583083527882-4bee9aba2eea?auto=format&fit=crop&w=1200&q=80',
      mobile: 'https://images.unsplash.com/photo-1583083527882-4bee9aba2eea?auto=format&fit=crop&w=600&q=80',
      thumb: 'https://images.unsplash.com/photo-1583083527882-4bee9aba2eea?auto=format&fit=crop&w=600&q=80',
    };
  }
  if (lower.includes('eid')) {
    return {
      desktop: 'https://images.unsplash.com/photo-1584286595398-a59f21d313f5?auto=format&fit=crop&w=1200&q=80',
      mobile: 'https://images.unsplash.com/photo-1584286595398-a59f21d313f5?auto=format&fit=crop&w=600&q=80',
      thumb: 'https://images.unsplash.com/photo-1584286595398-a59f21d313f5?auto=format&fit=crop&w=600&q=80',
    };
  }
  return {
    desktop: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=1200&q=80',
    mobile: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=600&q=80',
  };
}

export function generateAITemplateVariations(prompt: AIGenerateTemplatePrompt): AIGeneratedVariation[] {
  const festName = prompt.festivalName.trim() || 'Festival Utsav';
  const festKey = detectFestivalKey(festName);
  const images = getFestivalHeroImages(festName);

  const primary = prompt.primaryColor || '#EA580C';
  const secondary = prompt.secondaryColor || '#9A3412';
  const accent = prompt.accentColor || '#FEF3C7';

  // ── OPTION A: PREMIUM FESTIVE ──
  const themeA: FestivalTheme = {
    primaryColor: primary,
    secondaryColor: secondary,
    accentColor: accent,
    bgColor: '#FFFBEB',
    bgGradient: `linear-gradient(135deg, ${primary}15 0%, ${accent}30 50%, ${secondary}10 100%)`,
    cardBg: '#FFFFFF',
    textColor: '#7C2D12',
    accentTextColor: primary,
    badgeBg: primary,
    badgeTextColor: '#FFFFFF',
    mood: 'premium_festive',
    fontStyle: 'festive_serif',
    borderRadius: 'curved',
  };

  const sectionsA: FestivalSectionConfig[] = [
    {
      id: `sec-ai-hero-a-${Date.now()}`,
      type: 'Hero',
      title: `${festName} Grand Celebrations ✨`,
      subtitle: prompt.festivalDescription || `Experience the joy of ${festName} with fresh sweets, puja essentials and premium groceries delivered in 10 minutes.`,
      badge: 'PREMIUM FESTIVAL COLLECTION',
      ctaText: prompt.ctaText || 'SHOP FESTIVAL SPECIALS',
      ctaLink: '/categories',
      image: images.desktop,
      mobileImage: images.mobile,
      active: true,
    },
    {
      id: `sec-ai-countdown-a-${Date.now()}`,
      type: 'Countdown',
      title: `${festName} Early Bird Offers Ending Soon`,
      badge: 'LIMITED FESTIVE WINDOW',
      targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      active: true,
    },
    {
      id: `sec-ai-categories-a-${Date.now()}`,
      type: 'CategoryGrid',
      title: `${festName} Shopping Aisles`,
      subtitle: 'Handpicked festive categories for your celebrations',
      categoryIds: ['cat-sweets', 'cat-pooja', 'cat-fruits', 'cat-dairy', 'cat-snacks', 'cat-dryfruits'],
      layoutStyle: 'grid',
      active: true,
    },
    {
      id: `sec-ai-sweets-a-${Date.now()}`,
      type: 'ProductCarousel',
      title: 'Festive Sweets & Mithai Special',
      subtitle: 'Pure Ghee Sweets, Mawa Delicacies & Fresh Treats',
      badge: 'FRESH BATCH',
      categoryId: 'cat-sweets',
      maxItems: 8,
      active: true,
    },
    {
      id: `sec-ai-offer-a-${Date.now()}`,
      type: 'OfferBanner',
      title: `FLAT ₹100 OFF ON ${festName.toUpperCase()} ESSENTIALS`,
      subtitle: 'Apply code UTSAV100 on orders above ₹599',
      tag: 'BEST DEAL',
      badge: 'FESTIVE DISCOUNT',
      ctaText: 'CLAIM OFFER',
      ctaLink: '/categories',
      image: 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=800&q=80',
      active: true,
    },
    {
      id: `sec-ai-collection-a-${Date.now()}`,
      type: 'Collection',
      title: `${festName} Puja & Hosting Staples`,
      subtitle: 'Complete rituals kit and gourmet hosting snacks',
      badge: 'HOSTING READY',
      categoryId: 'cat-pooja',
      active: true,
    },
  ];

  // ── OPTION B: MODERN QUICK COMMERCE ──
  const themeB: FestivalTheme = {
    primaryColor: '#059669', // Emerald
    secondaryColor: '#064E3B',
    accentColor: '#FDE047',
    bgColor: '#F0FDF4',
    bgGradient: 'linear-gradient(135deg, #064E3B 0%, #059669 50%, #10B981 100%)',
    cardBg: '#FFFFFF',
    textColor: '#064E3B',
    accentTextColor: '#059669',
    badgeBg: '#10B981',
    badgeTextColor: '#FFFFFF',
    mood: 'modern_quick_commerce',
    fontStyle: 'bold_display',
    borderRadius: 'pill',
  };

  const sectionsB: FestivalSectionConfig[] = [
    {
      id: `sec-ai-hero-b-${Date.now()}`,
      type: 'Hero',
      title: `${festName} in 10 Minutes ⚡`,
      subtitle: `Lightning fast delivery of all your ${festName} grocery essentials and sweets right to your doorstep.`,
      badge: 'SUPERFAST 10-MIN DELIVERY',
      ctaText: 'ORDER INSTANTLY',
      ctaLink: '/categories',
      image: images.desktop,
      mobileImage: images.mobile,
      active: true,
    },
    {
      id: `sec-ai-categories-b-${Date.now()}`,
      type: 'CategoryGrid',
      title: 'Quick Category Station',
      subtitle: 'One-tap access to all festive items',
      categoryIds: ['cat-sweets', 'cat-dairy', 'cat-snacks', 'cat-beverages', 'cat-fruits'],
      layoutStyle: 'grid',
      active: true,
    },
    {
      id: `sec-ai-products-b-${Date.now()}`,
      type: 'ProductCarousel',
      title: 'Top Savers Today',
      subtitle: 'Massive price drops on daily grocery and festival packs',
      badge: 'UP TO 50% OFF',
      categoryId: 'cat-staples',
      maxItems: 8,
      active: true,
    },
    {
      id: `sec-ai-promostrip-b-${Date.now()}`,
      type: 'PromoStrip',
      title: 'Free Delivery on Orders above ₹99 • Use Code QUICKFEST',
      badge: 'ZERO FEE',
      active: true,
    },
  ];

  // ── OPTION C: TRADITIONAL INDIAN ──
  const themeC: FestivalTheme = {
    primaryColor: '#B91C1C', // Traditional Sindoor Red
    secondaryColor: '#78350F', // Ochre
    accentColor: '#FEF08A', // Haldi Yellow
    bgColor: '#FEF2F2',
    bgGradient: 'linear-gradient(135deg, #FEF2F2 0%, #FEF3C7 50%, #FEE2E2 100%)',
    cardBg: '#FFFFFF',
    textColor: '#450A0A',
    accentTextColor: '#B91C1C',
    badgeBg: '#DC2626',
    badgeTextColor: '#FFFFFF',
    mood: 'traditional_indian',
    fontStyle: 'festive_serif',
    borderRadius: 'curved',
  };

  const sectionsC: FestivalSectionConfig[] = [
    {
      id: `sec-ai-hero-c-${Date.now()}`,
      type: 'Hero',
      title: `Shubh ${festName} Ki Shubhkamnayein 🙏`,
      subtitle: `Authentic puja samagri, desi ghee mithai, seasonal fruits & dry fruit hampers for auspicious family prayers.`,
      badge: '100% SHUDDH SAMAGRI',
      ctaText: 'START PUJA SHOPPING',
      ctaLink: '/categories',
      image: images.desktop,
      mobileImage: images.mobile,
      active: true,
    },
    {
      id: `sec-ai-puja-c-${Date.now()}`,
      type: 'Collection',
      title: 'Auspicious Puja & Rituals Kit',
      subtitle: 'Pure Ghee, Agarbatti, Dhoop, Camphor & Kumkum',
      badge: 'PUJA CERTIFIED',
      categoryId: 'cat-pooja',
      active: true,
    },
    {
      id: `sec-ai-sweets-c-${Date.now()}`,
      type: 'ProductCarousel',
      title: 'Desi Ghee Sweets & Ladoo',
      subtitle: 'Handmade traditional sweets with rich dry fruits',
      badge: 'PURE DESI GHEE',
      categoryId: 'cat-sweets',
      maxItems: 8,
      active: true,
    },
  ];

  // ── OPTION D: MINIMAL ELEGANT ──
  const themeD: FestivalTheme = {
    primaryColor: '#334155', // Slate Elegance
    secondaryColor: '#0F172A',
    accentColor: '#F59E0B', // Golden Amber Accent
    bgColor: '#F8FAFC',
    bgGradient: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 50%, #E2E8F0 100%)',
    cardBg: '#FFFFFF',
    textColor: '#0F172A',
    accentTextColor: '#D97706',
    badgeBg: '#0F172A',
    badgeTextColor: '#FFFFFF',
    mood: 'minimal_elegant',
    fontStyle: 'clean_modern',
    borderRadius: 'rounded',
  };

  const sectionsD: FestivalSectionConfig[] = [
    {
      id: `sec-ai-hero-d-${Date.now()}`,
      type: 'Hero',
      title: `${festName} Curated Collection`,
      subtitle: `Sleek, minimalist curated grocery and gourmet hampers for the modern home.`,
      badge: 'CURATED SELECTION',
      ctaText: 'VIEW COLLECTION',
      ctaLink: '/categories',
      image: images.desktop,
      mobileImage: images.mobile,
      active: true,
    },
    {
      id: `sec-ai-categories-d-${Date.now()}`,
      type: 'CategoryGrid',
      title: 'Featured Departments',
      subtitle: 'Browse by category',
      categoryIds: ['cat-dryfruits', 'cat-chocolates', 'cat-bakery', 'cat-beverages'],
      layoutStyle: 'grid',
      active: true,
    },
    {
      id: `sec-ai-dryfruits-d-${Date.now()}`,
      type: 'ProductCarousel',
      title: 'Gourmet Gift Boxes & Dry Fruits',
      subtitle: 'Artisanal gift packs and roasted nuts',
      badge: 'GOURMET',
      categoryId: 'cat-dryfruits',
      maxItems: 8,
      active: true,
    },
  ];

  const createTemplateObj = (label: string, title: string, desc: string, theme: FestivalTheme, sections: FestivalSectionConfig[]): AIGeneratedVariation => {
    const template: FestivalTemplate = {
      id: `tpl-ai-${festKey}-${Date.now()}-${label.replace(/\s+/g, '-').toLowerCase()}`,
      name: `${festName} (${title})`,
      description: desc,
      festivalKey: festKey,
      category: 'AI_GENERATED',
      version: 1,
      schemaVersion: '1.0',
      minimumAppVersion: '1.0.0',
      previewThumbnail: images.thumb,
      tags: [festName, 'AI Generated', title],
      createdBy: 'Pocket Kirana AI Engine',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      theme,
      sections,
    };

    return {
      id: template.id,
      optionLabel: label,
      styleTitle: title,
      description: desc,
      template,
    };
  };

  return [
    createTemplateObj('Option A — Premium Festive', 'Premium Festive', `Rich, celebratory ${festName} layout with gold accents, sweets carousel & Puja samagri.`, themeA, sectionsA),
    createTemplateObj('Option B — Modern Quick Commerce', 'Modern Quick Commerce', `Fast, conversion-focused layout with 10-min speed highlights, countdown timer & promo banners.`, themeB, sectionsB),
    createTemplateObj('Option C — Traditional Indian', 'Traditional Indian', `Sacred, devotional Indian visual language with vermilion/amber tones and ritual essentials.`, themeC, sectionsC),
    createTemplateObj('Option D — Minimal Elegant', 'Minimal Elegant', `Refined, contemporary look focused on gourmet gifting, clean typography & premium hampers.`, themeD, sectionsD),
  ];
}

// In-editor conversational AI modifier
export function applyAIModification(
  currentTemplate: FestivalTemplate,
  instruction: string
): { updatedTemplate: FestivalTemplate; summary: string } {
  const tpl = JSON.parse(JSON.stringify(currentTemplate)) as FestivalTemplate;
  const lower = instruction.toLowerCase();
  let summary = 'Applied AI modifications successfully.';

  // 1. Color / Palette instructions
  if (lower.includes('green') || lower.includes('emerald')) {
    tpl.theme.primaryColor = '#059669';
    tpl.theme.secondaryColor = '#064E3B';
    tpl.theme.accentColor = '#FEF08A';
    tpl.theme.bgColor = '#F0FDF4';
    summary = 'Updated color scheme to emerald green and gold.';
  } else if (lower.includes('gold') || lower.includes('amber') || lower.includes('yellow')) {
    tpl.theme.primaryColor = '#D97706';
    tpl.theme.secondaryColor = '#78350F';
    tpl.theme.accentColor = '#FEF08A';
    tpl.theme.bgColor = '#FFFBEB';
    summary = 'Updated color scheme to royal festive gold and saffron.';
  } else if (lower.includes('red') || lower.includes('crimson') || lower.includes('maroon')) {
    tpl.theme.primaryColor = '#B91C1C';
    tpl.theme.secondaryColor = '#7F1D1D';
    tpl.theme.accentColor = '#FDE047';
    tpl.theme.bgColor = '#FEF2F2';
    summary = 'Updated color scheme to royal crimson red.';
  }

  // 2. Section additions / modifications
  if (lower.includes('countdown') || lower.includes('timer')) {
    const hasCountdown = tpl.sections.some((s) => s.type === 'Countdown');
    if (!hasCountdown) {
      tpl.sections.splice(1, 0, {
        id: `sec-countdown-${Date.now()}`,
        type: 'Countdown',
        title: 'Festival Mega Deals Ending In',
        badge: 'LIMITED TIME SALE',
        targetDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        active: true,
      });
      summary += ' Added an interactive festival countdown timer section.';
    }
  }

  if (lower.includes('offer') || lower.includes('discount') || lower.includes('banner')) {
    tpl.sections.push({
      id: `sec-offer-${Date.now()}`,
      type: 'OfferBanner',
      title: 'SPECIAL FESTIVE SAVINGS: FLAT 20% OFF',
      subtitle: 'Use code CELEBRATE20 on orders above ₹499',
      badge: 'EXTRA DISCOUNT',
      tag: 'LIMITED TIME',
      ctaText: 'CLAIM SAVINGS',
      ctaLink: '/categories',
      image: 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=800&q=80',
      active: true,
    });
    summary += ' Added a promotional offer banner section.';
  }

  if (lower.includes('sweets') || lower.includes('mithai') || lower.includes('modak')) {
    tpl.sections.push({
      id: `sec-sweets-${Date.now()}`,
      type: 'ProductCarousel',
      title: 'Fresh Festive Sweets & Delicacies',
      subtitle: 'Pure Ghee Sweets & Fresh Handcrafted Mithai',
      badge: 'FRESH BATCH',
      categoryId: 'cat-sweets',
      maxItems: 8,
      active: true,
    });
    summary += ' Added a curated festive sweets carousel section.';
  }

  if (lower.includes('puja') || lower.includes('samagri')) {
    tpl.sections.push({
      id: `sec-puja-${Date.now()}`,
      type: 'Collection',
      title: 'Complete Puja Samagri & Essentials',
      subtitle: 'Pure Ghee, Agarbatti, Camphor, Supari & Diya Wicks',
      badge: '100% PURE',
      categoryId: 'cat-pooja',
      active: true,
    });
    summary += ' Added a Puja essentials collection.';
  }

  // 3. Reordering instructions
  if (lower.includes('move offers above') || lower.includes('offers on top')) {
    const offerIdx = tpl.sections.findIndex((s) => s.type === 'OfferBanner' || s.type === 'PromoStrip');
    if (offerIdx > -1) {
      const [offer] = tpl.sections.splice(offerIdx, 1);
      tpl.sections.splice(1, 0, offer);
      summary += ' Moved festival offer banner above product sections.';
    }
  }

  tpl.updatedAt = new Date().toISOString();
  tpl.version += 1;

  return { updatedTemplate: tpl, summary };
}
