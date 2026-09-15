import {
  FestivalTemplate,
  FestivalCampaign,
  FestivalSectionConfig,
  FestivalValidationResult,
  FestivalValidationIssue,
  SectionType,
} from '@/types/festival';

export const APPROVED_SECTION_TYPES: SectionType[] = [
  'Hero',
  'CategoryGrid',
  'ProductGrid',
  'ProductCarousel',
  'OfferBanner',
  'PromoStrip',
  'Collection',
  'Countdown',
  'ImageText',
  'FestivalDivider',
  'RecommendationCarousel',
  'RecentlyBought',
  'PopularProducts',
  'BestSellers',
  'FreeDeliveryBanner',
  'TrustBanner',
  'AppPromotion',
  'Footer',
];

// Dangerous pattern check (XSS, scripts, event handlers, javascript: pseudo-protocol)
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /onload\s*=/gi,
  /onerror\s*=/gi,
  /onclick\s*=/gi,
  /<iframe/gi,
  /<embed/gi,
  /<object/gi,
  /eval\(/gi,
];

function sanitizeString(str: string | undefined): boolean {
  if (!str) return true;
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(str)) {
      return false;
    }
  }
  return true;
}

export function validateFestivalTemplate(template: Partial<FestivalTemplate>): FestivalValidationResult {
  const errors: FestivalValidationIssue[] = [];
  const warnings: FestivalValidationIssue[] = [];

  if (!template.name || template.name.trim().length < 3) {
    errors.push({
      field: 'name',
      message: 'Template name is required and must be at least 3 characters long.',
      severity: 'error',
    });
  }

  if (!template.schemaVersion || template.schemaVersion !== '1.0') {
    errors.push({
      field: 'schemaVersion',
      message: 'Invalid schema version. Expected "1.0".',
      severity: 'error',
    });
  }

  if (!template.sections || template.sections.length === 0) {
    errors.push({
      field: 'sections',
      message: 'Template must contain at least one section.',
      severity: 'error',
    });
  }

  const sections = template.sections || [];
  const heroSections = sections.filter((s) => s.type === 'Hero' && s.active !== false);
  if (heroSections.length === 0) {
    warnings.push({
      field: 'sections',
      message: 'Recommended: Add an active Hero banner for top visual impact.',
      severity: 'warning',
    });
  }

  sections.forEach((sec, idx) => {
    if (!APPROVED_SECTION_TYPES.includes(sec.type)) {
      errors.push({
        field: `sections[${idx}].type`,
        message: `Unsupported component type "${sec.type}". Must be one of approved library components.`,
        severity: 'error',
        sectionId: sec.id,
      });
    }

    if (sec.type === 'Hero') {
      if (!sec.image && !sec.desktopImage && !sec.mobileImage) {
        errors.push({
          field: `sections[${idx}].image`,
          message: 'Hero section requires an image URL.',
          severity: 'error',
          sectionId: sec.id,
        });
      }
      if (!sec.title || sec.title.trim().length === 0) {
        errors.push({
          field: `sections[${idx}].title`,
          message: 'Hero section requires a headline title.',
          severity: 'error',
          sectionId: sec.id,
        });
      }
    }

    if (sec.type === 'Countdown') {
      if (!sec.targetDate) {
        errors.push({
          field: `sections[${idx}].targetDate`,
          message: 'Countdown section requires a valid target datetime.',
          severity: 'error',
          sectionId: sec.id,
        });
      } else {
        const targetMs = new Date(sec.targetDate).getTime();
        if (isNaN(targetMs)) {
          errors.push({
            field: `sections[${idx}].targetDate`,
            message: 'Countdown targetDate is not a valid ISO timestamp.',
            severity: 'error',
            sectionId: sec.id,
          });
        }
      }
    }

    // Check dangerous strings
    const checkFields = [sec.title, sec.subtitle, sec.ctaText, sec.ctaLink, sec.badge, sec.tag];
    for (const val of checkFields) {
      if (!sanitizeString(val)) {
        errors.push({
          field: `sections[${idx}]`,
          message: 'Potential malicious script or unsafe HTML tag detected in section content.',
          severity: 'error',
          sectionId: sec.id,
        });
        break;
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateFestivalCampaign(campaign: Partial<FestivalCampaign>): FestivalValidationResult {
  const errors: FestivalValidationIssue[] = [];
  const warnings: FestivalValidationIssue[] = [];

  if (!campaign.name || campaign.name.trim().length < 3) {
    errors.push({
      field: 'name',
      message: 'Campaign name is required.',
      severity: 'error',
    });
  }

  if (!campaign.startAt) {
    errors.push({
      field: 'startAt',
      message: 'Campaign start date & time is required.',
      severity: 'error',
    });
  }

  if (!campaign.endAt) {
    errors.push({
      field: 'endAt',
      message: 'Campaign end date & time is required.',
      severity: 'error',
    });
  }

  if (campaign.startAt && campaign.endAt) {
    const start = new Date(campaign.startAt).getTime();
    const end = new Date(campaign.endAt).getTime();

    if (isNaN(start)) {
      errors.push({ field: 'startAt', message: 'Start date is invalid format.', severity: 'error' });
    }
    if (isNaN(end)) {
      errors.push({ field: 'endAt', message: 'End date is invalid format.', severity: 'error' });
    }
    if (!isNaN(start) && !isNaN(end) && start >= end) {
      errors.push({
        field: 'endAt',
        message: 'End date must be strictly after the start date.',
        severity: 'error',
      });
    }
  }

  if (!campaign.configurationSnapshot) {
    errors.push({
      field: 'configurationSnapshot',
      message: 'Campaign configuration snapshot is missing.',
      severity: 'error',
    });
  } else {
    const templateValidation = validateFestivalTemplate({
      name: campaign.name,
      schemaVersion: '1.0',
      sections: campaign.configurationSnapshot.sections,
      theme: campaign.configurationSnapshot.theme,
    });

    errors.push(...templateValidation.errors);
    warnings.push(...templateValidation.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
