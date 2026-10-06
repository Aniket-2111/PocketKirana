import * as XLSX from 'xlsx';
import {
  Product,
  Category,
  Brand,
  ProductSection,
  ProductAttribute,
  MeasurementType,
  PackagingType,
  ProductPublishStatus,
} from '@/types';
import { formatCustomerDisplay } from './measurementUtils';
import { getDefaultProductSections, normalizeProductSections } from './productSectionUtils';

/**
 * Excel Products Sheet Column Names (Editable fields only - NO BARCODES)
 */
export const PRODUCT_EXCEL_COLUMNS = [
  'product_id',
  'product_name',
  'category',
  'brand',
  'sku',
  'measurement_type',
  'measurement_unit',
  'quantity',
  'packaging_type',
  'selling_price',
  'mrp',
  'stock',
  'status',
  'publish_status',
  'description',
  'image_url',
  'additional_images',
] as const;

/**
 * Known Standard Specification Section Sheet Names
 */
export const SECTION_SHEET_NAMES = {
  KEY_INFO: 'Key Information',
  NUTRITION: 'Nutritional Information',
  INFO: 'Info',
  MANUFACTURER: 'Manufacturer Details',
} as const;

export interface ParsedProductRow {
  rowNumber: number;
  productId?: string;
  name: string;
  categoryId: string;
  categoryName: string;
  brandId?: string;
  brandName?: string;
  sku: string;
  measurementType: MeasurementType;
  measurementUnit: string;
  measurementValue: number;
  packagingType: PackagingType;
  sellingPrice: number;
  mrp: number;
  stock: number;
  status: 'active' | 'out_of_stock' | 'discontinued';
  publishStatus: ProductPublishStatus;
  description: string;
  thumbnail: string;
  images: string[];
  sections: ProductSection[];
  isUpdate: boolean;
  existingProduct?: Product;
  changesSummary: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface ExcelValidationError {
  sheet: string;
  rowNumber: number;
  product?: string;
  field?: string;
  value?: any;
  message: string;
}

export interface ExcelValidationWarning {
  sheet: string;
  rowNumber: number;
  product?: string;
  field?: string;
  message: string;
}

export interface ParseExcelResult {
  success: boolean;
  totalProductsCount: number;
  newProductsCount: number;
  updateProductsCount: number;
  totalSpecificationsCount: number;
  parsedProducts: ParsedProductRow[];
  errors: ExcelValidationError[];
  warnings: ExcelValidationWarning[];
}

/**
 * Helper to normalize string lookup keys
 */
function normalizeKey(str?: string): string {
  return (str || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Helper to parse boolean values from Excel (TRUE, FALSE, 1, 0, yes, no)
 */
function parseExcelBoolean(val: any, defaultVal = true): boolean {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const s = String(val).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes' || s === 'y') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'n') return false;
  return defaultVal;
}

/**
 * Nutritional measurement field specifications (Value + Unit)
 */
const NUTRITIONAL_MEASUREMENT_FIELDS = [
  { valueCol: 'Energy', unitCol: 'Energy Unit', defaultUnit: 'kcal' },
  { valueCol: 'Protein', unitCol: 'Protein Unit', defaultUnit: 'g' },
  { valueCol: 'Total Fat', unitCol: 'Fat Unit', defaultUnit: 'g' },
  { valueCol: 'Saturated Fat', unitCol: 'Saturated Fat Unit', defaultUnit: 'g' },
  { valueCol: 'Unsaturated Fat', unitCol: 'Unsaturated Fat Unit', defaultUnit: 'g' },
  { valueCol: 'Trans Fat', unitCol: 'Trans Fat Unit', defaultUnit: 'g' },
  { valueCol: 'Carbohydrates', unitCol: 'Carbohydrates Unit', defaultUnit: 'g' },
  { valueCol: 'Total Sugar', unitCol: 'Sugar Unit', defaultUnit: 'g' },
  { valueCol: 'Added Sugar', unitCol: 'Added Sugar Unit', defaultUnit: 'g' },
  { valueCol: 'Dietary Fiber', unitCol: 'Fiber Unit', defaultUnit: 'g' },
  { valueCol: 'Sodium', unitCol: 'Sodium Unit', defaultUnit: 'mg' },
  { valueCol: 'Calcium', unitCol: 'Calcium Unit', defaultUnit: 'mg' },
  { valueCol: 'Iron', unitCol: 'Iron Unit', defaultUnit: 'mg' },
];

/**
 * Generate official PocketKirana Section-Wise Product Import Template (.xlsx)
 * Workbook contains:
 * 1. Products
 * 2. Key Information
 * 3. Nutritional Information
 * 4. Info
 * 5. Manufacturer Details
 * 6. Instructions
 */
export function generateProductExcelTemplate(
  categories: Category[] = [],
  brands: Brand[] = []
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // ── 1. PRODUCTS SHEET ──
  const productsHeaders = [
    'product_id',
    'product_name',
    'category',
    'brand',
    'sku',
    'measurement_type',
    'measurement_unit',
    'quantity',
    'packaging_type',
    'selling_price',
    'mrp',
    'stock',
    'status',
    'publish_status',
    'description',
    'image_url',
    'additional_images',
  ];

  const sampleProductsData = [
    productsHeaders,
    [
      'PK-PROD-001',
      'Pasteurized Toned Milk',
      categories[0]?.name || 'Dairy & Eggs',
      brands[0]?.name || 'Amul',
      'AMUL-MILK-1L',
      'VOLUME',
      'LTR',
      1,
      'Pouch',
      68,
      72,
      150,
      'active',
      'PUBLISHED',
      'Pure pasteurized toned milk, rich in calcium and protein.',
      'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80',
    ],
    [
      'PK-PROD-002',
      'Chakki Fresh Whole Wheat Atta',
      categories[1]?.name || 'Atta & Rice',
      brands[1]?.name || 'Aashirvaad',
      'AASH-ATTA-5KG',
      'WEIGHT',
      'KG',
      5,
      'Packet',
      245,
      275,
      80,
      'active',
      'PUBLISHED',
      '100% whole wheat grain chakki fresh flour for soft and fluffy rotis.',
      'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80',
      '',
    ],
    [
      '', // Blank for NEW PRODUCT
      'Fresh Salted Table Butter 100g',
      categories[0]?.name || 'Dairy & Eggs',
      brands[0]?.name || 'Amul',
      'AMUL-BUTTER-100G',
      'WEIGHT',
      'G',
      100,
      'Carton',
      58,
      60,
      200,
      'active',
      'PUBLISHED',
      'Delicious creamy butter made from pure fresh cream.',
      'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
      '',
    ],
  ];

  const wsProducts = XLSX.utils.aoa_to_sheet(sampleProductsData);
  wsProducts['!cols'] = [
    { wch: 15 }, // product_id
    { wch: 32 }, // product_name
    { wch: 20 }, // category
    { wch: 16 }, // brand
    { wch: 18 }, // sku
    { wch: 18 }, // measurement_type
    { wch: 18 }, // measurement_unit
    { wch: 12 }, // quantity
    { wch: 16 }, // packaging_type
    { wch: 14 }, // selling_price
    { wch: 12 }, // mrp
    { wch: 10 }, // stock
    { wch: 12 }, // status
    { wch: 16 }, // publish_status
    { wch: 45 }, // description
    { wch: 35 }, // image_url
    { wch: 35 }, // additional_images
  ];
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

  // ── 2. KEY INFORMATION SHEET ──
  const keyInfoHeaders = [
    'Product ID',
    'Product Name',
    'Product Type',
    'Diet Preference',
    'Country of Origin',
    'Source / Origin',
  ];
  const keyInfoData = [
    keyInfoHeaders,
    ['PK-PROD-001', 'Pasteurized Toned Milk', 'Daily Essential', '100% Vegetarian', 'India', 'Direct Farm Sourced'],
    ['PK-PROD-002', 'Chakki Fresh Whole Wheat Atta', 'Grocery Essential', '100% Vegetarian', 'India', 'Selected Wheat Mandis'],
    ['', 'Fresh Salted Table Butter 100g', 'Dairy Table Butter', '100% Vegetarian', 'India', 'Pasteurized Cow & Buffalo Milk Cream'],
  ];
  const wsKeyInfo = XLSX.utils.aoa_to_sheet(keyInfoData);
  wsKeyInfo['!cols'] = [{ wch: 15 }, { wch: 32 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsKeyInfo, SECTION_SHEET_NAMES.KEY_INFO);

  // ── 3. NUTRITIONAL INFORMATION SHEET ──
  const nutritionHeaders = [
    'Product ID',
    'Product Name',
    'Nutrition Basis',
    'Energy',
    'Energy Unit',
    'Protein',
    'Protein Unit',
    'Total Fat',
    'Fat Unit',
    'Carbohydrates',
    'Carbohydrates Unit',
    'Dietary Fiber',
    'Fiber Unit',
    'Sodium',
    'Sodium Unit',
    'Calcium',
    'Calcium Unit',
    'Iron',
    'Iron Unit',
  ];
  const nutritionData = [
    nutritionHeaders,
    ['PK-PROD-001', 'Pasteurized Toned Milk', 'Per 100 ml', 58.2, 'kcal', 3.1, 'g', 3.0, 'g', 4.7, 'g', 0, 'g', 50, 'mg', 120, 'mg', 0.1, 'mg'],
    ['PK-PROD-002', 'Chakki Fresh Whole Wheat Atta', 'Per 100 g', 343, 'kcal', 10.5, 'g', 1.6, 'g', 77.1, 'g', 10.8, 'g', 1.7, 'mg', 34, 'mg', 3.9, 'mg'],
    ['', 'Fresh Salted Table Butter 100g', 'Per 100 g', 717, 'kcal', 0.5, 'g', 80.0, 'g', 0.4, 'g', 0, 'g', 800, 'mg', 20, 'mg', 0.2, 'mg'],
  ];
  const wsNutrition = XLSX.utils.aoa_to_sheet(nutritionData);
  wsNutrition['!cols'] = [
    { wch: 15 }, { wch: 32 }, { wch: 16 },
    { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 18 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsNutrition, SECTION_SHEET_NAMES.NUTRITION);

  // ── 4. INFO SHEET ──
  const infoHeaders = [
    'Product ID',
    'Product Name',
    'Key Features',
    'Shelf Life',
    'Storage Instructions',
    'Customer Care Details',
    'Disclaimer',
  ];
  const infoData = [
    infoHeaders,
    [
      'PK-PROD-001',
      'Pasteurized Toned Milk',
      'Fortified with Vitamin A & D. Wholesome daily nutrition for the family.',
      '2 Days from packing',
      'Keep refrigerated at 4°C or below',
      'support@pocketkirana.com | +91 98765 43210',
      'Consume within 2 days after opening pouch.',
    ],
    [
      'PK-PROD-002',
      'Chakki Fresh Whole Wheat Atta',
      'Traditional stone grinding locks in dietary fiber, natural aroma and sweetness.',
      '90 Days',
      'Store in a cool, hygienic and dry place in an airtight container',
      'support@pocketkirana.com | +91 98765 43210',
      'Best before 3 months from date of packaging.',
    ],
    [
      '',
      'Fresh Salted Table Butter 100g',
      'Classic spread for toast, parathas, baking and cooking.',
      '180 Days',
      'Keep refrigerated at 4°C',
      'support@pocketkirana.com | +91 98765 43210',
      'Contains added milk solids and common salt.',
    ],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
  wsInfo['!cols'] = [{ wch: 15 }, { wch: 32 }, { wch: 38 }, { wch: 22 }, { wch: 35 }, { wch: 30 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, SECTION_SHEET_NAMES.INFO);

  // ── 5. MANUFACTURER DETAILS SHEET ──
  const mfgHeaders = [
    'Product ID',
    'Product Name',
    'Manufacturer',
    'FSSAI License No.',
    'Storage Instructions',
  ];
  const mfgData = [
    mfgHeaders,
    ['PK-PROD-001', 'Pasteurized Toned Milk', 'Gujarat Co-operative Milk Marketing Federation Ltd.', '10012021000071', 'Store refrigerated at 4°C or below'],
    ['PK-PROD-002', 'Chakki Fresh Whole Wheat Atta', 'ITC Limited, 37 J.L. Nehru Road, Kolkata', '10012031000312', 'Store in a cool dry place'],
    ['', 'Fresh Salted Table Butter 100g', 'Gujarat Co-operative Milk Marketing Federation Ltd.', '10012021000071', 'Store in refrigerator'],
  ];
  const wsMfg = XLSX.utils.aoa_to_sheet(mfgData);
  wsMfg['!cols'] = [{ wch: 15 }, { wch: 32 }, { wch: 45 }, { wch: 20 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsMfg, SECTION_SHEET_NAMES.MANUFACTURER);

  // ── 6. INSTRUCTIONS SHEET ──
  const instructionsData = [
    ['POCKETKIRANA — SECTION-WISE PRODUCT IMPORT INSTRUCTIONS'],
    [''],
    ['SHEET BREAKDOWN:'],
    ['1. Products', 'Basic product info (identity, measurement, prices, stock, images). Leave product_id blank for new products.'],
    ['2. Key Information', 'Key product traits (Product Type, Diet Preference, Country of Origin, Source).'],
    ['3. Nutritional Information', 'Nutritional values per serving/100g with separate value and unit columns.'],
    ['4. Info', 'Usage, Key Features, Shelf Life, Storage Instructions, Customer Care Details.'],
    ['5. Manufacturer Details', 'Manufacturer Name, FSSAI License Number, Regulatory details.'],
    [''],
    ['IMPORTANT RULES:'],
    ['• Product ID Linking', 'Rows across section sheets are matched using "Product ID". "Product Name" is for human readability.'],
    ['• Numeric Units', 'In Nutritional Information, values and units are separate (e.g. Energy: 58.2, Energy Unit: kcal).'],
    ['• Partial Updates', 'You do NOT need to fill every section. Blank sections will keep existing data by default.'],
    ['• No Barcodes', 'Barcodes/EAN/UPC are not used or stored in this Excel import.'],
    ['• Valid Values', 'Status: active | out_of_stock | discontinued. Publish Status: PUBLISHED | DRAFT | ARCHIVED.'],
    ['• Measurement Types', 'WEIGHT (KG, G) | VOLUME (LTR, ML) | UNIT (PCS, PACK, UNIT).'],
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!cols'] = [{ wch: 28 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  // Convert to Uint8Array
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(wbout);
}

/**
 * Export products to Section-Wise Excel Workbook (.xlsx)
 */
export function exportProductsToExcel(
  products: Product[],
  categories: Category[] = [],
  brands: Brand[] = []
): Uint8Array {
  const wb = XLSX.utils.book_new();

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const brandMap = new Map(brands.map((b) => [b.id, b.name]));

  // 1. PRODUCTS SHEET
  const productsHeaders = [
    'product_id',
    'product_name',
    'category',
    'brand',
    'sku',
    'measurement_type',
    'measurement_unit',
    'quantity',
    'packaging_type',
    'selling_price',
    'mrp',
    'stock',
    'status',
    'publish_status',
    'description',
    'image_url',
    'additional_images',
  ];

  const productsRows = products.map((p) => [
    p.id,
    p.name,
    categoryMap.get(p.categoryId) || p.categoryId,
    brandMap.get(p.brandId || '') || p.brandName || '',
    p.sku || '',
    p.measurementType || 'WEIGHT',
    p.measurementUnit || 'KG',
    p.measurementValue || 1,
    p.packagingType || 'Packet',
    p.sellingPrice,
    p.mrp,
    p.stock || 0,
    p.status || 'active',
    p.publishStatus || 'PUBLISHED',
    p.description || '',
    p.thumbnail || (p.images && p.images[0]) || '',
    p.images && p.images.length > 1 ? p.images.slice(1).join(',') : '',
  ]);

  const wsProducts = XLSX.utils.aoa_to_sheet([productsHeaders, ...productsRows]);
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

  // 2. KEY INFORMATION SHEET
  const keyInfoRows: any[][] = [];
  products.forEach((p) => {
    const sections = normalizeProductSections(p);
    const ki = sections.find((s) => s.title.toLowerCase().includes('key'));
    const getAttr = (label: string) => {
      const a = ki?.attributes.find((x) => x.label.toLowerCase().includes(label.toLowerCase()));
      return a ? a.value : '';
    };

    keyInfoRows.push([
      p.id,
      p.name,
      getAttr('type') || getAttr('atta') || p.productType || 'Daily Essential',
      getAttr('diet') || p.dietPreference || '100% Vegetarian',
      getAttr('country') || p.countryOfOrigin || 'India',
      getAttr('source') || p.source || '',
    ]);
  });
  const wsKeyInfo = XLSX.utils.aoa_to_sheet([
    ['Product ID', 'Product Name', 'Product Type', 'Diet Preference', 'Country of Origin', 'Source / Origin'],
    ...keyInfoRows,
  ]);
  XLSX.utils.book_append_sheet(wb, wsKeyInfo, SECTION_SHEET_NAMES.KEY_INFO);

  // 3. NUTRITIONAL INFORMATION SHEET
  const nutritionRows: any[][] = [];
  products.forEach((p) => {
    const sections = normalizeProductSections(p);
    const nu = sections.find((s) => s.title.toLowerCase().includes('nutri'));
    const getNutAttr = (keyword: string) => {
      const a = nu?.attributes.find((x) => x.label.toLowerCase().includes(keyword.toLowerCase()));
      return a ? { value: a.value, unit: a.unit } : { value: '', unit: '' };
    };

    const energy = getNutAttr('energy');
    const protein = getNutAttr('protein');
    const fat = getNutAttr('total fat');
    const carbs = getNutAttr('carb');
    const fiber = getNutAttr('fiber');
    const sodium = getNutAttr('sodium');
    const calcium = getNutAttr('calcium');
    const iron = getNutAttr('iron');

    nutritionRows.push([
      p.id,
      p.name,
      'Per 100 g',
      energy.value || '', energy.unit || 'kcal',
      protein.value || '', protein.unit || 'g',
      fat.value || '', fat.unit || 'g',
      carbs.value || '', carbs.unit || 'g',
      fiber.value || '', fiber.unit || 'g',
      sodium.value || '', sodium.unit || 'mg',
      calcium.value || '', calcium.unit || 'mg',
      iron.value || '', iron.unit || 'mg',
    ]);
  });

  const wsNutrition = XLSX.utils.aoa_to_sheet([
    [
      'Product ID',
      'Product Name',
      'Nutrition Basis',
      'Energy', 'Energy Unit',
      'Protein', 'Protein Unit',
      'Total Fat', 'Fat Unit',
      'Carbohydrates', 'Carbohydrates Unit',
      'Dietary Fiber', 'Fiber Unit',
      'Sodium', 'Sodium Unit',
      'Calcium', 'Calcium Unit',
      'Iron', 'Iron Unit',
    ],
    ...nutritionRows,
  ]);
  XLSX.utils.book_append_sheet(wb, wsNutrition, SECTION_SHEET_NAMES.NUTRITION);

  // 4. INFO SHEET
  const infoRows: any[][] = [];
  products.forEach((p) => {
    const sections = normalizeProductSections(p);
    const inf = sections.find((s) => s.title.toLowerCase() === 'info');
    const getAttr = (keyword: string) => {
      const a = inf?.attributes.find((x) => x.label.toLowerCase().includes(keyword.toLowerCase()));
      return a ? a.value : '';
    };

    infoRows.push([
      p.id,
      p.name,
      getAttr('feature') || p.keyFeatures || p.description || '',
      getAttr('shelf') || p.shelfLife || '90 days',
      getAttr('storage') || p.storageInstructions || 'Store in cool and dry place',
      getAttr('care') || 'support@pocketkirana.com | +91 98765 43210',
      getAttr('disclaimer') || p.disclaimer || '',
    ]);
  });
  const wsInfo = XLSX.utils.aoa_to_sheet([
    ['Product ID', 'Product Name', 'Key Features', 'Shelf Life', 'Storage Instructions', 'Customer Care Details', 'Disclaimer'],
    ...infoRows,
  ]);
  XLSX.utils.book_append_sheet(wb, wsInfo, SECTION_SHEET_NAMES.INFO);

  // 5. MANUFACTURER DETAILS SHEET
  const mfgRows: any[][] = [];
  products.forEach((p) => {
    const sections = normalizeProductSections(p);
    const mfg = sections.find((s) => s.title.toLowerCase().includes('manuf'));
    const getAttr = (keyword: string) => {
      const a = mfg?.attributes.find((x) => x.label.toLowerCase().includes(keyword.toLowerCase()));
      return a ? a.value : '';
    };

    mfgRows.push([
      p.id,
      p.name,
      getAttr('name') || getAttr('manufacturer') || p.manufacturer || 'PocketKirana Fulfillment Hub',
      getAttr('fssai') || p.fssaiLicense || '10012031000312',
      getAttr('storage') || p.storageInstructions || 'Store in a cool dry place',
    ]);
  });
  const wsMfg = XLSX.utils.aoa_to_sheet([
    ['Product ID', 'Product Name', 'Manufacturer', 'FSSAI License No.', 'Storage Instructions'],
    ...mfgRows,
  ]);
  XLSX.utils.book_append_sheet(wb, wsMfg, SECTION_SHEET_NAMES.MANUFACTURER);

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(wbout);
}

/**
 * Parse uploaded Product Excel File (Supports Section-Wise sheets & legacy format)
 */
export function parseProductExcelFile(
  fileBuffer: ArrayBuffer | Uint8Array,
  existingProducts: Product[] = [],
  categories: Category[] = [],
  brands: Brand[] = []
): ParseExcelResult {
  const errors: ExcelValidationError[] = [];
  const warnings: ExcelValidationWarning[] = [];

  // Security bounds: Max 15MB file buffer check
  const byteLength = fileBuffer instanceof ArrayBuffer ? fileBuffer.byteLength : fileBuffer.length;
  if (byteLength > 15 * 1024 * 1024) {
    return {
      success: false,
      totalProductsCount: 0,
      newProductsCount: 0,
      updateProductsCount: 0,
      totalSpecificationsCount: 0,
      parsedProducts: [],
      errors: [
        {
          sheet: 'General',
          rowNumber: 1,
          message: 'Excel file exceeds maximum allowed size (15MB).',
        },
      ],
      warnings: [],
    };
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(fileBuffer, { type: 'array', cellDates: true, dense: false });
  } catch (readErr: any) {
    return {
      success: false,
      totalProductsCount: 0,
      newProductsCount: 0,
      updateProductsCount: 0,
      totalSpecificationsCount: 0,
      parsedProducts: [],
      errors: [
        {
          sheet: 'General',
          rowNumber: 1,
          message: 'Malformed or corrupt Excel file could not be parsed.',
        },
      ],
      warnings: [],
    };
  }

  // Check for Products sheet
  const productsSheetName = wb.SheetNames.find((s) => normalizeKey(s) === 'products');
  if (!productsSheetName) {
    return {
      success: false,
      totalProductsCount: 0,
      newProductsCount: 0,
      updateProductsCount: 0,
      totalSpecificationsCount: 0,
      parsedProducts: [],
      errors: [
        {
          sheet: 'General',
          rowNumber: 1,
          message: 'Missing required "Products" sheet in Excel file.',
        },
      ],
      warnings: [],
    };
  }

  const categoryLookup = new Map<string, Category>();
  categories.forEach((c) => {
    categoryLookup.set(normalizeKey(c.id), c);
    categoryLookup.set(normalizeKey(c.name), c);
    if (c.slug) categoryLookup.set(normalizeKey(c.slug), c);
  });

  const brandLookup = new Map<string, Brand>();
  brands.forEach((b) => {
    brandLookup.set(normalizeKey(b.id), b);
    brandLookup.set(normalizeKey(b.name), b);
    if (b.slug) brandLookup.set(normalizeKey(b.slug), b);
  });

  const existingProductMap = new Map<string, Product>();
  existingProducts.forEach((p) => {
    if (p.id) existingProductMap.set(normalizeKey(p.id), p);
    if (p.sku) existingProductMap.set(normalizeKey(p.sku), p);
  });

  // 1. Parse Products Sheet
  const wsProducts = wb.Sheets[productsSheetName];
  const rawProductRows: any[][] = XLSX.utils.sheet_to_json(wsProducts, { header: 1 });

  if (rawProductRows.length < 2) {
    return {
      success: false,
      totalProductsCount: 0,
      newProductsCount: 0,
      updateProductsCount: 0,
      totalSpecificationsCount: 0,
      parsedProducts: [],
      errors: [
        {
          sheet: 'Products',
          rowNumber: 1,
          message: 'The "Products" sheet does not contain any data rows.',
        },
      ],
      warnings: [],
    };
  }

  const productHeaderRow = rawProductRows[0].map((h) => normalizeKey(String(h)));
  const productColIndex = (key: string) => productHeaderRow.findIndex((h) => h === normalizeKey(key));

  const idxId = productColIndex('product_id');
  const idxName = productColIndex('product_name');
  const idxCategory = productColIndex('category');
  const idxBrand = productColIndex('brand');
  const idxSku = productColIndex('sku');
  const idxMeasType = productColIndex('measurement_type');
  const idxMeasUnit = productColIndex('measurement_unit');
  const idxMeasVal = productColIndex('quantity') >= 0 ? productColIndex('quantity') : productColIndex('measurement_value');
  const idxPkgType = productColIndex('packaging_type');
  const idxSellingPrice = productColIndex('selling_price');
  const idxMrp = productColIndex('mrp');
  const idxStock = productColIndex('stock');
  const idxStatus = productColIndex('status');
  const idxPubStatus = productColIndex('publish_status');
  const idxDesc = productColIndex('description');
  const idxThumb = productColIndex('image_url');
  const idxAddImages = productColIndex('additional_images');

  if (idxName === -1) {
    errors.push({
      sheet: 'Products',
      rowNumber: 1,
      field: 'product_name',
      message: 'Missing mandatory column "product_name" in Products sheet.',
    });
  }

  const parsedProducts: ParsedProductRow[] = [];
  const productByIdKey = new Map<string, ParsedProductRow>();
  const seenProductIds = new Map<string, number>();

  for (let r = 1; r < rawProductRows.length; r++) {
    const row = rawProductRows[r];
    if (!row || row.length === 0 || row.every((c) => c === undefined || c === null || String(c).trim() === '')) {
      continue; // Empty row
    }

    const rowNumber = r + 1;
    const rawId = idxId >= 0 && row[idxId] ? String(row[idxId]).trim() : '';
    const rawName = idxName >= 0 && row[idxName] ? String(row[idxName]).trim() : '';

    // Check duplicate Product ID in Products sheet
    if (rawId) {
      const normId = normalizeKey(rawId);
      if (seenProductIds.has(normId)) {
        const prevRow = seenProductIds.get(normId)!;
        errors.push({
          sheet: 'Products',
          rowNumber,
          product: rawId,
          field: 'product_id',
          message: `Duplicate Product ID "${rawId}" in Products sheet. Found at rows ${prevRow} and ${rowNumber}. Import blocked.`,
        });
      } else {
        seenProductIds.set(normId, rowNumber);
      }
    }
    const rawCategory = idxCategory >= 0 && row[idxCategory] ? String(row[idxCategory]).trim() : '';
    const rawBrand = idxBrand >= 0 && row[idxBrand] ? String(row[idxBrand]).trim() : '';
    const rawSku = idxSku >= 0 && row[idxSku] ? String(row[idxSku]).trim() : '';
    const rawMeasType = idxMeasType >= 0 && row[idxMeasType] ? String(row[idxMeasType]).trim().toUpperCase() : 'WEIGHT';
    const rawMeasUnit = idxMeasUnit >= 0 && row[idxMeasUnit] ? String(row[idxMeasUnit]).trim().toUpperCase() : (rawMeasType === 'WEIGHT' ? 'KG' : rawMeasType === 'VOLUME' ? 'LTR' : 'PCS');
    const rawMeasVal = idxMeasVal >= 0 && row[idxMeasVal] !== undefined ? parseFloat(String(row[idxMeasVal])) : 1;
    const rawPkgType = idxPkgType >= 0 && row[idxPkgType] ? String(row[idxPkgType]).trim() : 'Packet';
    const rawSellingPrice = idxSellingPrice >= 0 && row[idxSellingPrice] !== undefined ? parseFloat(String(row[idxSellingPrice])) : NaN;
    const rawMrp = idxMrp >= 0 && row[idxMrp] !== undefined ? parseFloat(String(row[idxMrp])) : NaN;
    const rawStock = idxStock >= 0 && row[idxStock] !== undefined ? parseInt(String(row[idxStock]), 10) : 0;
    const rawStatus = idxStatus >= 0 && row[idxStatus] ? String(row[idxStatus]).trim().toLowerCase() : 'active';
    const rawPubStatus = idxPubStatus >= 0 && row[idxPubStatus] ? String(row[idxPubStatus]).trim().toUpperCase() : 'PUBLISHED';
    const rawDesc = idxDesc >= 0 && row[idxDesc] ? String(row[idxDesc]).trim() : '';
    const rawThumb = idxThumb >= 0 && row[idxThumb] ? String(row[idxThumb]).trim() : '';
    const rawAddImages = idxAddImages >= 0 && row[idxAddImages] ? String(row[idxAddImages]).trim() : '';

    // Validate Product Name
    if (!rawName) {
      errors.push({
        sheet: 'Products',
        rowNumber,
        product: rawId || `Row ${rowNumber}`,
        field: 'product_name',
        message: 'Product name is required.',
      });
    }

    // Validate Category
    let resolvedCategory: Category | undefined = categoryLookup.get(normalizeKey(rawCategory));
    if (!resolvedCategory && categories.length > 0) {
      if (rawCategory) {
        warnings.push({
          sheet: 'Products',
          rowNumber,
          product: rawName || rawId,
          field: 'category',
          message: `Category "${rawCategory}" not found. Falling back to default "${categories[0].name}".`,
        });
      }
      resolvedCategory = categories[0];
    }
    const categoryId = resolvedCategory ? resolvedCategory.id : 'cat-general';
    const categoryName = resolvedCategory ? resolvedCategory.name : (rawCategory || 'General');

    // Validate Brand
    const resolvedBrand = brandLookup.get(normalizeKey(rawBrand));
    const brandId = resolvedBrand ? resolvedBrand.id : '';
    const brandName = resolvedBrand ? resolvedBrand.name : rawBrand;

    // Validate Pricing
    if (isNaN(rawSellingPrice) || rawSellingPrice < 0) {
      errors.push({
        sheet: 'Products',
        rowNumber,
        product: rawName || rawId,
        field: 'selling_price',
        message: 'Valid non-negative selling price is required.',
      });
    }

    const mrp = isNaN(rawMrp) ? (isNaN(rawSellingPrice) ? 0 : rawSellingPrice) : rawMrp;
    if (mrp < rawSellingPrice) {
      warnings.push({
        sheet: 'Products',
        rowNumber,
        product: rawName || rawId,
        field: 'mrp',
        message: `MRP (₹${mrp}) is lower than Selling Price (₹${rawSellingPrice}). Auto-adjusting MRP to Selling Price.`,
      });
    }
    const finalMrp = Math.max(mrp, isNaN(rawSellingPrice) ? 0 : rawSellingPrice);

    // Validate Measurement
    let measurementType: MeasurementType = 'WEIGHT';
    if (rawMeasType === 'VOLUME') measurementType = 'VOLUME';
    else if (rawMeasType === 'UNIT' || rawMeasType === 'COUNT' || rawMeasType === 'PIECE') measurementType = 'UNIT';

    const measurementValue = isNaN(rawMeasVal) || rawMeasVal <= 0 ? 1 : rawMeasVal;

    // Resolve images
    const images: string[] = [];
    if (rawThumb) images.push(rawThumb);
    if (rawAddImages) {
      rawAddImages.split(',').forEach((img) => {
        const trimmed = img.trim();
        if (trimmed && !images.includes(trimmed)) images.push(trimmed);
      });
    }

    // Determine whether this is update or new product
    let existingProduct: Product | undefined;
    if (rawId && existingProductMap.has(normalizeKey(rawId))) {
      existingProduct = existingProductMap.get(normalizeKey(rawId));
    } else if (rawSku && existingProductMap.has(normalizeKey(rawSku))) {
      existingProduct = existingProductMap.get(normalizeKey(rawSku));
    }

    const isUpdate = !!existingProduct;

    // Changes Summary
    const changesSummary: { field: string; oldValue: any; newValue: any }[] = [];
    if (existingProduct) {
      if (existingProduct.name !== rawName) {
        changesSummary.push({ field: 'name', oldValue: existingProduct.name, newValue: rawName });
      }
      if (existingProduct.sellingPrice !== rawSellingPrice) {
        changesSummary.push({ field: 'sellingPrice', oldValue: existingProduct.sellingPrice, newValue: rawSellingPrice });
      }
      if (existingProduct.mrp !== finalMrp) {
        changesSummary.push({ field: 'mrp', oldValue: existingProduct.mrp, newValue: finalMrp });
      }
      if (existingProduct.stock !== rawStock) {
        changesSummary.push({ field: 'stock', oldValue: existingProduct.stock, newValue: rawStock });
      }
    }

    const parsedProduct: ParsedProductRow = {
      rowNumber,
      productId: rawId || existingProduct?.id,
      name: rawName,
      categoryId,
      categoryName,
      brandId,
      brandName,
      sku: rawSku || (existingProduct ? existingProduct.sku : `SKU-${Date.now()}-${r}`),
      measurementType,
      measurementUnit: rawMeasUnit,
      measurementValue,
      packagingType: rawPkgType as PackagingType,
      sellingPrice: isNaN(rawSellingPrice) ? 0 : rawSellingPrice,
      mrp: finalMrp,
      stock: isNaN(rawStock) ? 0 : Math.max(0, rawStock),
      status: (['active', 'out_of_stock', 'discontinued'].includes(rawStatus) ? rawStatus : 'active') as any,
      publishStatus: (['PUBLISHED', 'DRAFT', 'ARCHIVED'].includes(rawPubStatus) ? rawPubStatus : 'PUBLISHED') as any,
      description: rawDesc,
      thumbnail: images[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
      images: images.length > 0 ? images : ['https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'],
      sections: existingProduct ? normalizeProductSections(existingProduct) : getDefaultProductSections(),
      isUpdate,
      existingProduct,
      changesSummary,
    };

    parsedProducts.push(parsedProduct);
    if (rawId) {
      productByIdKey.set(normalizeKey(rawId), parsedProduct);
    }
    if (parsedProduct.name) {
      productByIdKey.set(normalizeKey(parsedProduct.name), parsedProduct);
    }
  }

  // ── 2. PARSE SECTION-WISE SPECIFICATION SHEETS ──
  let totalSpecificationsCount = 0;

  const sectionSheets = wb.SheetNames.filter((name) => {
    const n = normalizeKey(name);
    return n !== 'products' && n !== 'instructions' && n !== 'categoriesbrands' && n !== 'lookup';
  });

  for (const sheetName of sectionSheets) {
    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows || rows.length < 2) continue;

    const headers = rows[0].map((h) => String(h || '').trim());
    const normHeaders = headers.map((h) => normalizeKey(h));

    // Find Product ID column
    let idColIdx = normHeaders.findIndex((h) => h === 'productid' || h === 'id' || h === 'product_id');
    let nameColIdx = normHeaders.findIndex((h) => h === 'productname' || h === 'name' || h === 'product_name');
    if (idColIdx === -1 && nameColIdx === -1) {
      idColIdx = 0; // Default to first column
    }

    const isNutritionSheet = normalizeKey(sheetName).includes('nutri');
    const seenSectionProductIds = new Map<string, number>();

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0 || row.every((c) => c === undefined || c === null || String(c).trim() === '')) {
        continue;
      }

      const rowNumber = r + 1;
      const rawProdId = idColIdx >= 0 && row[idColIdx] ? String(row[idColIdx]).trim() : '';
      const rawProdName = nameColIdx >= 0 && row[nameColIdx] ? String(row[nameColIdx]).trim() : '';
      const prodKey = normalizeKey(rawProdId || rawProdName);

      // Duplicate detection within the same section sheet
      if (prodKey) {
        if (seenSectionProductIds.has(prodKey)) {
          const prevRow = seenSectionProductIds.get(prodKey)!;
          errors.push({
            sheet: sheetName,
            rowNumber,
            product: rawProdName || rawProdId,
            field: 'Product ID',
            message: `Duplicate Product ID "${rawProdId || rawProdName}" in sheet "${sheetName}". Found at rows ${prevRow} and ${rowNumber}. Import blocked.`,
          });
          continue;
        }
        seenSectionProductIds.set(prodKey, rowNumber);
      }

      // Match target parsed product
      let targetProduct = rawProdId ? productByIdKey.get(normalizeKey(rawProdId)) : undefined;
      if (!targetProduct && rawProdName) {
        targetProduct = productByIdKey.get(normalizeKey(rawProdName));
      }

      if (!targetProduct) {
        if (rawProdId || rawProdName) {
          errors.push({
            sheet: sheetName,
            rowNumber,
            product: rawProdName || rawProdId,
            field: 'Product ID',
            message: `Product "${rawProdId || rawProdName}" in sheet "${sheetName}" does not match any product in the "Products" sheet.`,
          });
        }
        continue;
      }

      // Collect attributes for this section
      const attributes: ProductAttribute[] = [];
      let attrOrder = 1;

      if (isNutritionSheet) {
        // Special Nutritional Value + Unit handling
        for (const nutField of NUTRITIONAL_MEASUREMENT_FIELDS) {
          const valIdx = normHeaders.findIndex((h) => h === normalizeKey(nutField.valueCol));
          if (valIdx === -1) continue;

          const rawVal = row[valIdx];
          if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') continue;

          const numVal = parseFloat(String(rawVal));
          if (isNaN(numVal)) {
            errors.push({
              sheet: sheetName,
              rowNumber,
              product: targetProduct.name,
              field: nutField.valueCol,
              value: rawVal,
              message: `${nutField.valueCol} must be a numeric value. Found "${rawVal}".`,
            });
            continue;
          }

          // Look for corresponding Unit column
          const unitIdx = normHeaders.findIndex((h) => h === normalizeKey(nutField.unitCol));
          const parsedUnit = unitIdx >= 0 && row[unitIdx] ? String(row[unitIdx]).trim() : nutField.defaultUnit;

          attributes.push({
            id: `attr-nut-${Date.now()}-${attrOrder}`,
            label: `${nutField.valueCol} Per 100 g`,
            value: String(numVal),
            unit: parsedUnit,
            displayOrder: attrOrder++,
            isVisible: true,
          });
          totalSpecificationsCount++;
        }
      } else {
        // Standard text columns
        for (let c = 0; c < headers.length; c++) {
          if (c === idColIdx || c === nameColIdx) continue;
          const headerName = headers[c];
          if (!headerName || normHeaders[c].includes('unit') || normHeaders[c] === 'nutritionbasis') continue;

          const cellVal = row[c];
          if (cellVal === undefined || cellVal === null || String(cellVal).trim() === '') continue;

          attributes.push({
            id: `attr-${normalizeKey(sheetName)}-${Date.now()}-${attrOrder}`,
            label: headerName,
            value: String(cellVal).trim(),
            unit: '',
            displayOrder: attrOrder++,
            isVisible: true,
          });
          totalSpecificationsCount++;
        }
      }

      // Merge or attach section to target product
      if (attributes.length > 0) {
        const existingSecIdx = targetProduct.sections.findIndex((s) => s.title.toLowerCase() === sheetName.toLowerCase());
        if (existingSecIdx >= 0) {
          // Merge attributes
          const existingSec = targetProduct.sections[existingSecIdx];
          const attrMap = new Map(existingSec.attributes.map((a) => [normalizeKey(a.label), a]));
          attributes.forEach((newA) => {
            attrMap.set(normalizeKey(newA.label), newA);
          });
          targetProduct.sections[existingSecIdx] = {
            ...existingSec,
            attributes: Array.from(attrMap.values()),
          };
        } else {
          targetProduct.sections.push({
            id: `sec-${normalizeKey(sheetName)}-${Date.now()}`,
            title: sheetName,
            displayOrder: targetProduct.sections.length + 1,
            isVisible: true,
            defaultExpanded: targetProduct.sections.length === 0,
            attributes,
          });
        }
      }
    }
  }

  const updateProductsCount = parsedProducts.filter((p) => p.isUpdate).length;
  const newProductsCount = parsedProducts.filter((p) => !p.isUpdate).length;

  return {
    success: errors.length === 0,
    totalProductsCount: parsedProducts.length,
    newProductsCount,
    updateProductsCount,
    totalSpecificationsCount,
    parsedProducts,
    errors,
    warnings,
  };
}

/**
 * Merge newly imported sections with existing sections
 */
export function mergeProductSections(
  existingSections: ProductSection[] = [],
  importedSections: ProductSection[] = [],
  replaceSections = false
): ProductSection[] {
  if (replaceSections) {
    return importedSections;
  }

  const sectionMap = new Map<string, ProductSection>();
  existingSections.forEach((s) => {
    sectionMap.set(normalizeKey(s.title), JSON.parse(JSON.stringify(s)));
  });

  importedSections.forEach((imp) => {
    const key = normalizeKey(imp.title);
    if (!sectionMap.has(key)) {
      sectionMap.set(key, imp);
    } else {
      const existing = sectionMap.get(key)!;
      const attrMap = new Map<string, ProductAttribute>();
      (existing.attributes || []).forEach((a) => attrMap.set(normalizeKey(a.label), a));
      (imp.attributes || []).forEach((a) => attrMap.set(normalizeKey(a.label), a));

      sectionMap.set(key, {
        ...existing,
        attributes: Array.from(attrMap.values()),
      });
    }
  });

  return Array.from(sectionMap.values()).map((s, idx) => ({
    ...s,
    displayOrder: idx + 1,
  }));
}
