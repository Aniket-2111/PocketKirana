import { Product, ProductSection, ProductAttribute } from '@/types';

/**
 * Generates default standard sections for new products
 */
export function getDefaultProductSections(): ProductSection[] {
  return [
    {
      id: 'sec-key-info',
      title: 'Key Information',
      displayOrder: 1,
      isVisible: true,
      defaultExpanded: true,
      attributes: [
        { id: 'attr-ki-1', label: 'Product Type', value: 'Grocery Staple', unit: '', displayOrder: 1, isVisible: true },
        { id: 'attr-ki-2', label: 'Source / Origin', value: 'Direct Farm Sourced', unit: '', displayOrder: 2, isVisible: true },
        { id: 'attr-ki-3', label: 'Diet Preference', value: '100% Vegetarian', unit: '', displayOrder: 3, isVisible: true },
        { id: 'attr-ki-4', label: 'Country of Origin', value: 'India', unit: '', displayOrder: 4, isVisible: true },
      ],
    },
    {
      id: 'sec-nutrition',
      title: 'Nutritional Information',
      displayOrder: 2,
      isVisible: true,
      defaultExpanded: false,
      attributes: [
        { id: 'attr-nu-1', label: 'Energy Per 100 g', value: '343', unit: 'kcal', displayOrder: 1, isVisible: true },
        { id: 'attr-nu-2', label: 'Protein Per 100 g', value: '10.5', unit: 'g', displayOrder: 2, isVisible: true },
        { id: 'attr-nu-3', label: 'Carbohydrates Per 100 g', value: '77.1', unit: 'g', displayOrder: 3, isVisible: true },
        { id: 'attr-nu-4', label: 'Total Sugar Per 100 g', value: '3.4', unit: 'g', displayOrder: 4, isVisible: true },
        { id: 'attr-nu-5', label: 'Added Sugar Per 100 g', value: '0', unit: 'g', displayOrder: 5, isVisible: true },
        { id: 'attr-nu-6', label: 'Total Fat Per 100 g', value: '1.6', unit: 'g', displayOrder: 6, isVisible: true },
        { id: 'attr-nu-7', label: 'Saturated Fat Per 100 g', value: '0.3', unit: 'g', displayOrder: 7, isVisible: true },
        { id: 'attr-nu-8', label: 'Unsaturated Fat Per 100 g', value: '1.3', unit: 'g', displayOrder: 8, isVisible: true },
        { id: 'attr-nu-9', label: 'Trans Fat Per 100 g', value: '0', unit: 'g', displayOrder: 9, isVisible: true },
        { id: 'attr-nu-10', label: 'Dietary Fiber Per 100 g', value: '10.8', unit: 'g', displayOrder: 10, isVisible: true },
        { id: 'attr-nu-11', label: 'Sodium Per 100 g', value: '1.7', unit: 'mg', displayOrder: 11, isVisible: true },
      ],
    },
    {
      id: 'sec-info',
      title: 'Info',
      displayOrder: 3,
      isVisible: true,
      defaultExpanded: false,
      attributes: [
        { id: 'attr-inf-1', label: 'Key Features', value: 'Premium quality daily staple, hygienically sorted, packed to retain freshness.', unit: '', displayOrder: 1, isVisible: true },
        { id: 'attr-inf-2', label: 'Unit', value: '1 kg', unit: '', displayOrder: 2, isVisible: true },
        { id: 'attr-inf-3', label: 'Shelf Life', value: '90 days', unit: '', displayOrder: 3, isVisible: true },
        { id: 'attr-inf-4', label: 'Customer Care Details', value: 'support@pocketkirana.com | +91 98765 43210', unit: '', displayOrder: 4, isVisible: true },
        { id: 'attr-inf-5', label: 'Disclaimer', value: 'Every effort is made to maintain accuracy of all information. Actual product packaging and materials may contain additional or different information.', unit: '', displayOrder: 5, isVisible: true },
      ],
    },
    {
      id: 'sec-manufacturer',
      title: 'Manufacturer Details',
      displayOrder: 4,
      isVisible: true,
      defaultExpanded: false,
      attributes: [
        { id: 'attr-mfg-1', label: 'Manufacturer Name', value: 'PocketKirana Fulfillment & Agro Hub', unit: '', displayOrder: 1, isVisible: true },
        { id: 'attr-mfg-2', label: 'FSSAI License No.', value: '10012031000312', unit: '', displayOrder: 2, isVisible: true },
        { id: 'attr-mfg-3', label: 'Storage Instructions', value: 'Store in a cool, hygienic and dry place away from direct sunlight.', unit: '', displayOrder: 3, isVisible: true },
      ],
    },
    {
      id: 'sec-return-policy',
      title: 'Return Policy',
      displayOrder: 5,
      isVisible: true,
      defaultExpanded: false,
      attributes: [
        { id: 'attr-ret-1', label: 'Return Window', value: '24 Hours from delivery', unit: '', displayOrder: 1, isVisible: true },
        { id: 'attr-ret-2', label: 'Return Condition', value: 'Unopened, with original packaging and invoice.', unit: '', displayOrder: 2, isVisible: true },
      ],
    },
  ];
}

/**
 * Normalizes a product object so it always has rich, structured dynamic sections.
 * Converts legacy flat fields (shelfLife, nutritionalInfo, keyFeatures, etc.) if sections are missing.
 */
export function normalizeProductSections(product?: Partial<Product> | null): ProductSection[] {
  if (!product) return getDefaultProductSections();

  if (product.sections && Array.isArray(product.sections) && product.sections.length > 0) {
    // Sort sections by displayOrder
    return [...product.sections].sort((a, b) => a.displayOrder - b.displayOrder).map(sec => ({
      ...sec,
      attributes: [...(sec.attributes || [])].sort((a, b) => a.displayOrder - b.displayOrder),
    }));
  }

  // Build dynamic sections from existing product properties
  const isAtta = product.categoryId?.includes('atta') || product.name?.toLowerCase().includes('atta');
  const typeLabel = isAtta ? 'Atta Type' : 'Product Type';
  const typeVal = product.productType || product.foodType || (isAtta ? 'Chakki Atta' : 'Daily Essential');

  const keyInfoAttrs: ProductAttribute[] = [
    { id: `attr-ki-1-${product.id}`, label: typeLabel, value: typeVal, unit: '', displayOrder: 1, isVisible: true },
  ];
  if (product.source) {
    keyInfoAttrs.push({ id: `attr-ki-2-${product.id}`, label: 'Source / Origin', value: product.source, unit: '', displayOrder: 2, isVisible: true });
  } else if (isAtta) {
    keyInfoAttrs.push({ id: `attr-ki-2-${product.id}`, label: 'Milling Process', value: 'Stone Ground (Chakki Pisai)', unit: '', displayOrder: 2, isVisible: true });
  }
  if (product.dietPreference || product.foodType) {
    keyInfoAttrs.push({ id: `attr-ki-3-${product.id}`, label: 'Diet Preference', value: product.dietPreference || product.foodType || '100% Vegetarian', unit: '', displayOrder: 3, isVisible: true });
  }
  keyInfoAttrs.push({ id: `attr-ki-4-${product.id}`, label: 'Country of Origin', value: product.countryOfOrigin || 'India', unit: '', displayOrder: 4, isVisible: true });

  // Nutrition Info attributes
  const nut = product.nutritionalInfo || {};
  const nutritionAttrs: ProductAttribute[] = [
    { id: `attr-nu-1-${product.id}`, label: 'Energy Per 100 g', value: nut.energy ? nut.energy.replace(/\s*kcal/i, '') : '343', unit: 'kcal', displayOrder: 1, isVisible: true },
    { id: `attr-nu-2-${product.id}`, label: 'Protein Per 100 g', value: nut.protein ? nut.protein.replace(/\s*g/i, '') : '10.5', unit: 'g', displayOrder: 2, isVisible: true },
    { id: `attr-nu-3-${product.id}`, label: 'Carbohydrates Per 100 g', value: nut.carbohydrates ? nut.carbohydrates.replace(/\s*g/i, '') : '77.1', unit: 'g', displayOrder: 3, isVisible: true },
    { id: `attr-nu-4-${product.id}`, label: 'Total Sugar Per 100 g', value: nut.totalSugar ? nut.totalSugar.replace(/\s*g/i, '') : '3.4', unit: 'g', displayOrder: 4, isVisible: true },
    { id: `attr-nu-5-${product.id}`, label: 'Added Sugar Per 100 g', value: nut.addedSugar ? nut.addedSugar.replace(/\s*g/i, '') : '0', unit: 'g', displayOrder: 5, isVisible: true },
    { id: `attr-nu-6-${product.id}`, label: 'Total Fat Per 100 g', value: nut.totalFat ? nut.totalFat.replace(/\s*g/i, '') : '1.6', unit: 'g', displayOrder: 6, isVisible: true },
    { id: `attr-nu-7-${product.id}`, label: 'Saturated Fat Per 100 g', value: nut.saturatedFat ? nut.saturatedFat.replace(/\s*g/i, '') : '0.3', unit: 'g', displayOrder: 7, isVisible: true },
    { id: `attr-nu-8-${product.id}`, label: 'Unsaturated Fat Per 100 g', value: nut.unsaturatedFat ? nut.unsaturatedFat.replace(/\s*g/i, '') : '1.3', unit: 'g', displayOrder: 8, isVisible: true },
    { id: `attr-nu-9-${product.id}`, label: 'Trans Fat Per 100 g', value: nut.transFat ? nut.transFat.replace(/\s*g/i, '') : '0', unit: 'g', displayOrder: 9, isVisible: true },
    { id: `attr-nu-10-${product.id}`, label: 'Dietary Fiber Per 100 g', value: nut.dietaryFiber ? nut.dietaryFiber.replace(/\s*g/i, '') : '10.8', unit: 'g', displayOrder: 10, isVisible: true },
    { id: `attr-nu-11-${product.id}`, label: 'Sodium Per 100 g', value: nut.sodium ? nut.sodium.replace(/\s*mg/i, '') : '1.7', unit: 'mg', displayOrder: 11, isVisible: true },
  ];

  // Info attributes
  const infoAttrs: ProductAttribute[] = [
    { id: `attr-inf-1-${product.id}`, label: 'Key Features', value: product.keyFeatures || product.description || 'Finest quality grocery item sourced fresh for authentic taste and nutrition.', unit: '', displayOrder: 1, isVisible: true },
    { id: `attr-inf-2-${product.id}`, label: 'Description', value: product.description || 'Premium grocery staple delivered to your doorstep.', unit: '', displayOrder: 2, isVisible: true },
    { id: `attr-inf-3-${product.id}`, label: 'Unit', value: product.unit || '1 pack', unit: '', displayOrder: 3, isVisible: true },
    { id: `attr-inf-4-${product.id}`, label: 'Shelf Life', value: product.shelfLife || '90 days', unit: '', displayOrder: 4, isVisible: true },
    { id: `attr-inf-5-${product.id}`, label: 'Customer Care Details', value: 'support@pocketkirana.com | WhatsApp: +91 8698893348', unit: '', displayOrder: 5, isVisible: true },
    { id: `attr-inf-6-${product.id}`, label: 'Disclaimer', value: product.disclaimer || 'Every effort is made to maintain accuracy of all information. Actual packaging and materials may contain more or different information.', unit: '', displayOrder: 6, isVisible: true },
  ];

  // Manufacturer & Legal
  const mfgAttrs: ProductAttribute[] = [
    { id: `attr-mfg-1-${product.id}`, label: 'Manufacturer', value: product.manufacturer || 'Pocket Kirana Authorized Fulfillment Center', unit: '', displayOrder: 1, isVisible: true },
    { id: `attr-mfg-2-${product.id}`, label: 'FSSAI License No.', value: product.fssaiLicense || '10012031000312', unit: '', displayOrder: 2, isVisible: true },
    { id: `attr-mfg-3-${product.id}`, label: 'Storage Instructions', value: product.storageInstructions || 'Store in a cool, hygienic and dry place away from direct sunlight.', unit: '', displayOrder: 3, isVisible: true },
  ];

  const returnAttrs: ProductAttribute[] = [
    { id: `attr-ret-1-${product.id}`, label: 'Return Window', value: '24 Hours from delivery', unit: '', displayOrder: 1, isVisible: true },
    { id: `attr-ret-2-${product.id}`, label: 'Return Condition', value: 'Item must be unused and in original packaging.', unit: '', displayOrder: 2, isVisible: true },
  ];

  return [
    {
      id: `sec-key-info-${product.id || 'default'}`,
      title: 'Key Information',
      displayOrder: 1,
      isVisible: true,
      defaultExpanded: true,
      attributes: keyInfoAttrs,
    },
    {
      id: `sec-nutrition-${product.id || 'default'}`,
      title: 'Nutritional Information',
      displayOrder: 2,
      isVisible: true,
      defaultExpanded: false,
      attributes: nutritionAttrs,
    },
    {
      id: `sec-info-${product.id || 'default'}`,
      title: 'Info',
      displayOrder: 3,
      isVisible: true,
      defaultExpanded: false,
      attributes: infoAttrs,
    },
    {
      id: `sec-manufacturer-${product.id || 'default'}`,
      title: 'Manufacturer Details',
      displayOrder: 4,
      isVisible: true,
      defaultExpanded: false,
      attributes: mfgAttrs,
    },
    {
      id: `sec-return-${product.id || 'default'}`,
      title: 'Return Policy',
      displayOrder: 5,
      isVisible: true,
      defaultExpanded: false,
      attributes: returnAttrs,
    },
  ];
}

/**
 * Filter sections and attributes for customer view (only visible, non-empty)
 */
export function sanitizeVisibleSectionsForCustomer(sections?: ProductSection[]): ProductSection[] {
  if (!sections || !Array.isArray(sections)) return [];

  return sections
    .filter((sec) => sec.isVisible)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((sec) => ({
      ...sec,
      attributes: (sec.attributes || [])
        .filter((attr) => attr.isVisible && attr.value && attr.value.trim().length > 0)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    }))
    .filter((sec) => sec.attributes.length > 0);
}
