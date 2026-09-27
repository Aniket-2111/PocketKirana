import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  generateProductExcelTemplate,
  exportProductsToExcel,
  parseProductExcelFile,
  mergeProductSections,
  PRODUCT_EXCEL_COLUMNS,
  SECTION_SHEET_NAMES,
} from '@/lib/productExcelUtils';
import { Product, Category, Brand, ProductSection } from '@/types';

const mockCategories: Category[] = [
  { id: 'cat-dairy', name: 'Dairy & Eggs', slug: 'dairy-eggs', image: '', isActive: true, displayOrder: 1 },
  { id: 'cat-atta', name: 'Atta & Rice', slug: 'atta-rice', image: '', isActive: true, displayOrder: 2 },
  { id: 'cat-oil', name: 'Oils & Ghee', slug: 'oils-ghee', image: '', isActive: true, displayOrder: 3 },
];

const mockBrands: Brand[] = [
  { id: 'brand-amul', name: 'Amul', slug: 'amul', isActive: true },
  { id: 'brand-aashirvaad', name: 'Aashirvaad', slug: 'aashirvaad', isActive: true },
];

const mockExistingProducts: Product[] = [
  {
    id: 'PK-PROD-001',
    name: 'Pasteurized Toned Milk',
    slug: 'pasteurized-toned-milk',
    categoryId: 'cat-dairy',
    brandId: 'brand-amul',
    brandName: 'Amul',
    sellingPrice: 68,
    mrp: 72,
    unit: '1 L (Pouch)',
    measurementType: 'VOLUME',
    measurementUnit: 'LTR',
    measurementValue: 1,
    packagingType: 'Pouch',
    status: 'active',
    publishStatus: 'PUBLISHED',
    stock: 150,
    sku: 'AMUL-MILK-1L',
    thumbnail: 'https://images.unsplash.com/photo-1550583724-b2692b85b150',
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150',
    description: 'Pure fresh toned milk',
    sections: [
      {
        id: 'sec-1',
        title: 'Key Information',
        displayOrder: 1,
        isVisible: true,
        defaultExpanded: true,
        attributes: [
          { id: 'a-1', label: 'Product Type', value: 'Daily Essential', unit: '', displayOrder: 1, isVisible: true },
          { id: 'a-2', label: 'Country of Origin', value: 'India', unit: '', displayOrder: 2, isVisible: true },
        ],
      },
    ],
  } as unknown as Product,
];

describe('PocketKirana Section-Wise Product Excel Import System', () => {
  it('1. Generates official workbook with Section-Wise sheets (Products, Key Info, Nutrition, Info, Manufacturer, Instructions)', () => {
    const templateBytes = generateProductExcelTemplate(mockCategories, mockBrands);
    expect(templateBytes.length).toBeGreaterThan(100);

    const wb = XLSX.read(templateBytes, { type: 'array' });
    expect(wb.SheetNames).toContain('Products');
    expect(wb.SheetNames).toContain(SECTION_SHEET_NAMES.KEY_INFO);
    expect(wb.SheetNames).toContain(SECTION_SHEET_NAMES.NUTRITION);
    expect(wb.SheetNames).toContain(SECTION_SHEET_NAMES.INFO);
    expect(wb.SheetNames).toContain(SECTION_SHEET_NAMES.MANUFACTURER);
    expect(wb.SheetNames).toContain('Instructions');

    // Generic "Specifications" sheet should NOT be present
    expect(wb.SheetNames).not.toContain('Specifications');

    const wsProducts = wb.Sheets['Products'];
    const rows: any[][] = XLSX.utils.sheet_to_json(wsProducts, { header: 1 });
    const headers = rows[0];

    // Verify editable Admin headers
    expect(headers).toContain('product_id');
    expect(headers).toContain('product_name');
    expect(headers).toContain('category');
    expect(headers).toContain('selling_price');
    expect(headers).toContain('mrp');
    expect(headers).toContain('measurement_type');
    expect(headers).toContain('packaging_type');

    // STRICT RULE: Verify NO barcode / EAN / UPC columns exist
    const barcodeKeys = ['barcode', 'ean', 'ean13', 'upc', 'gtin', 'barcode_number'];
    headers.forEach((h: string) => {
      expect(barcodeKeys).not.toContain(String(h).toLowerCase());
    });
  });

  it('2. Nutritional Information sheet has separate value and unit columns', () => {
    const templateBytes = generateProductExcelTemplate(mockCategories, mockBrands);
    const wb = XLSX.read(templateBytes, { type: 'array' });
    const wsNutrition = wb.Sheets[SECTION_SHEET_NAMES.NUTRITION];
    const rows: any[][] = XLSX.utils.sheet_to_json(wsNutrition, { header: 1 });
    const headers = rows[0];

    expect(headers).toContain('Product ID');
    expect(headers).toContain('Product Name');
    expect(headers).toContain('Energy');
    expect(headers).toContain('Energy Unit');
    expect(headers).toContain('Protein');
    expect(headers).toContain('Protein Unit');
    expect(headers).toContain('Total Fat');
    expect(headers).toContain('Fat Unit');
    expect(headers).toContain('Calcium');
    expect(headers).toContain('Calcium Unit');
  });

  it('3. Section sheets all include Product ID and Product Name for readable linking', () => {
    const templateBytes = generateProductExcelTemplate(mockCategories, mockBrands);
    const wb = XLSX.read(templateBytes, { type: 'array' });

    [
      SECTION_SHEET_NAMES.KEY_INFO,
      SECTION_SHEET_NAMES.NUTRITION,
      SECTION_SHEET_NAMES.INFO,
      SECTION_SHEET_NAMES.MANUFACTURER,
    ].forEach((sheetName) => {
      const ws = wb.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      expect(rows[0][0]).toBe('Product ID');
      expect(rows[0][1]).toBe('Product Name');
    });
  });

  it('4. Parses section-wise Excel template and maps into canonical Product model', () => {
    const templateBytes = generateProductExcelTemplate(mockCategories, mockBrands);
    const result = parseProductExcelFile(templateBytes, mockExistingProducts, mockCategories, mockBrands);

    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.totalProductsCount).toBe(3); // 2 existing/sample updates + 1 new product
    expect(result.updateProductsCount).toBe(1); // PK-PROD-001 matches existing
    expect(result.newProductsCount).toBe(2);

    const milk = result.parsedProducts.find((p) => p.name.includes('Pasteurized Toned Milk'));
    expect(milk).toBeDefined();
    expect(milk?.isUpdate).toBe(true);
    expect(milk?.sellingPrice).toBe(68);
    expect(milk?.measurementType).toBe('VOLUME');
    expect(milk?.measurementUnit).toBe('LTR');

    // Specifications mapped from section sheets
    const keyInfo = milk?.sections.find((s) => s.title.toLowerCase().includes('key'));
    expect(keyInfo).toBeDefined();
    expect(keyInfo?.attributes.some((a) => a.label === 'Diet Preference' && a.value === '100% Vegetarian')).toBe(true);
    expect(keyInfo?.attributes.some((a) => a.label === 'Country of Origin' && a.value === 'India')).toBe(true);

    const nutrition = milk?.sections.find((s) => s.title.toLowerCase().includes('nutri'));
    expect(nutrition).toBeDefined();
    expect(nutrition?.attributes.some((a) => a.label.includes('Protein') && a.value === '3.1' && a.unit === 'g')).toBe(true);
    expect(nutrition?.attributes.some((a) => a.label.includes('Energy') && a.value === '58.2' && a.unit === 'kcal')).toBe(true);

    const info = milk?.sections.find((s) => s.title.toLowerCase() === 'info');
    expect(info).toBeDefined();
    expect(info?.attributes.some((a) => a.label === 'Shelf Life' && a.value.includes('2 Days'))).toBe(true);

    const mfg = milk?.sections.find((s) => s.title.toLowerCase().includes('manuf'));
    expect(mfg).toBeDefined();
    expect(mfg?.attributes.some((a) => a.label === 'FSSAI License No.' && a.value === '10012021000071')).toBe(true);
  });

  it('5. Validates non-numeric values in Nutritional Information sheet', () => {
    const wb = XLSX.utils.book_new();

    // Products sheet
    const wsProducts = XLSX.utils.aoa_to_sheet([
      [...PRODUCT_EXCEL_COLUMNS],
      ['PK-PROD-001', 'Pasteurized Toned Milk', 'Dairy & Eggs', 'Amul', 'AMUL-MILK-1L', 'VOLUME', 'LTR', 1, 'Pouch', 68, 72, 100, 'active', 'PUBLISHED', 'Fresh milk', '', ''],
    ]);
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

    // Invalid Nutrition sheet (Protein has string "invalid_protein")
    const wsNutrition = XLSX.utils.aoa_to_sheet([
      ['Product ID', 'Product Name', 'Energy', 'Energy Unit', 'Protein', 'Protein Unit'],
      ['PK-PROD-001', 'Pasteurized Toned Milk', 58.2, 'kcal', 'invalid_protein', 'g'],
    ]);
    XLSX.utils.book_append_sheet(wb, wsNutrition, SECTION_SHEET_NAMES.NUTRITION);

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const result = parseProductExcelFile(buffer, mockExistingProducts, mockCategories, mockBrands);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].sheet).toBe(SECTION_SHEET_NAMES.NUTRITION);
    expect(result.errors[0].field).toBe('Protein');
    expect(result.errors[0].message).toContain('must be a numeric value');
  });

  it('6. Merges specifications without deleting unmodified existing sections', () => {
    const existingSections: ProductSection[] = [
      {
        id: 'sec-1',
        title: 'Key Information',
        displayOrder: 1,
        isVisible: true,
        defaultExpanded: true,
        attributes: [
          { id: 'a-1', label: 'Product Type', value: 'Milk', unit: '', displayOrder: 1, isVisible: true },
          { id: 'a-2', label: 'Country of Origin', value: 'India', unit: '', displayOrder: 2, isVisible: true },
        ],
      },
      {
        id: 'sec-2',
        title: 'Manufacturer Details',
        displayOrder: 2,
        isVisible: true,
        defaultExpanded: false,
        attributes: [
          { id: 'a-3', label: 'FSSAI License No.', value: '10012031000312', unit: '', displayOrder: 1, isVisible: true },
        ],
      },
    ];

    // Excel import only updates Key Information (adds Diet Preference)
    const importedSections: ProductSection[] = [
      {
        id: 'sec-new-1',
        title: 'Key Information',
        displayOrder: 1,
        isVisible: true,
        defaultExpanded: true,
        attributes: [
          { id: 'a-4', label: 'Diet Preference', value: '100% Vegetarian', unit: '', displayOrder: 1, isVisible: true },
        ],
      },
    ];

    const merged = mergeProductSections(existingSections, importedSections, false);
    expect(merged.length).toBe(2);

    const keyInfo = merged.find((s) => s.title === 'Key Information');
    expect(keyInfo?.attributes.length).toBe(3); // Product Type, Country of Origin, Diet Preference

    const mfg = merged.find((s) => s.title === 'Manufacturer Details');
    expect(mfg).toBeDefined(); // Preserved
  });

  it('7. Duplicate Product ID within Products sheet blocks import with clear row numbers', () => {
    const wb = XLSX.utils.book_new();
    const wsProducts = XLSX.utils.aoa_to_sheet([
      [...PRODUCT_EXCEL_COLUMNS],
      ['PK-PROD-001', 'Pasteurized Toned Milk', 'Dairy & Eggs', 'Amul', 'AMUL-MILK-1L', 'VOLUME', 'LTR', 1, 'Pouch', 68, 72, 100, 'active', 'PUBLISHED', 'Fresh milk', '', ''],
      ['PK-PROD-001', 'Duplicate Milk Entry', 'Dairy & Eggs', 'Amul', 'AMUL-MILK-1L-DUP', 'VOLUME', 'LTR', 1, 'Pouch', 68, 72, 100, 'active', 'PUBLISHED', 'Duplicate milk', '', ''],
    ]);
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const result = parseProductExcelFile(buffer, mockExistingProducts, mockCategories, mockBrands);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    const dupError = result.errors.find((e) => e.message.includes('Duplicate Product ID'));
    expect(dupError).toBeDefined();
    expect(dupError?.sheet).toBe('Products');
    expect(dupError?.message).toContain('rows 2 and 3');
  });

  it('8. Duplicate Product ID within Nutritional Information sheet blocks import with clear row numbers', () => {
    const wb = XLSX.utils.book_new();
    const wsProducts = XLSX.utils.aoa_to_sheet([
      [...PRODUCT_EXCEL_COLUMNS],
      ['PK-PROD-001', 'Pasteurized Toned Milk', 'Dairy & Eggs', 'Amul', 'AMUL-MILK-1L', 'VOLUME', 'LTR', 1, 'Pouch', 68, 72, 100, 'active', 'PUBLISHED', 'Fresh milk', '', ''],
    ]);
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

    const wsNutrition = XLSX.utils.aoa_to_sheet([
      ['Product ID', 'Product Name', 'Energy', 'Energy Unit', 'Protein', 'Protein Unit'],
      ['PK-PROD-001', 'Pasteurized Toned Milk', 58.2, 'kcal', 3.1, 'g'],
      ['PK-PROD-001', 'Pasteurized Toned Milk', 60.0, 'kcal', 3.2, 'g'],
    ]);
    XLSX.utils.book_append_sheet(wb, wsNutrition, SECTION_SHEET_NAMES.NUTRITION);

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const result = parseProductExcelFile(buffer, mockExistingProducts, mockCategories, mockBrands);

    expect(result.success).toBe(false);
    const dupError = result.errors.find((e) => e.message.includes('Duplicate Product ID'));
    expect(dupError).toBeDefined();
    expect(dupError?.sheet).toBe(SECTION_SHEET_NAMES.NUTRITION);
    expect(dupError?.message).toContain('rows 2 and 3');
  });

  it('9. Same Product ID in multiple different section sheets is accepted and unified', () => {
    const wb = XLSX.utils.book_new();
    const wsProducts = XLSX.utils.aoa_to_sheet([
      [...PRODUCT_EXCEL_COLUMNS],
      ['PK-PROD-001', 'Pasteurized Toned Milk', 'Dairy & Eggs', 'Amul', 'AMUL-MILK-1L', 'VOLUME', 'LTR', 1, 'Pouch', 68, 72, 100, 'active', 'PUBLISHED', 'Fresh milk', '', ''],
    ]);
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

    const wsKey = XLSX.utils.aoa_to_sheet([
      ['Product ID', 'Product Name', 'Diet Preference', 'Country of Origin'],
      ['PK-PROD-001', 'Pasteurized Toned Milk', '100% Vegetarian', 'India'],
    ]);
    XLSX.utils.book_append_sheet(wb, wsKey, SECTION_SHEET_NAMES.KEY_INFO);

    const wsNutri = XLSX.utils.aoa_to_sheet([
      ['Product ID', 'Product Name', 'Energy', 'Energy Unit', 'Protein', 'Protein Unit'],
      ['PK-PROD-001', 'Pasteurized Toned Milk', 58.2, 'kcal', 3.1, 'g'],
    ]);
    XLSX.utils.book_append_sheet(wb, wsNutri, SECTION_SHEET_NAMES.NUTRITION);

    const wsInfo = XLSX.utils.aoa_to_sheet([
      ['Product ID', 'Product Name', 'Shelf Life', 'Storage Instructions'],
      ['PK-PROD-001', 'Pasteurized Toned Milk', '2 Days from packing', 'Keep refrigerated'],
    ]);
    XLSX.utils.book_append_sheet(wb, wsInfo, SECTION_SHEET_NAMES.INFO);

    const wsMfg = XLSX.utils.aoa_to_sheet([
      ['Product ID', 'Product Name', 'Manufacturer', 'FSSAI License No.'],
      ['PK-PROD-001', 'Pasteurized Toned Milk', 'GCMMF', '10012021000071'],
    ]);
    XLSX.utils.book_append_sheet(wb, wsMfg, SECTION_SHEET_NAMES.MANUFACTURER);

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const result = parseProductExcelFile(buffer, mockExistingProducts, mockCategories, mockBrands);

    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.parsedProducts.length).toBe(1);

    const prod = result.parsedProducts[0];
    expect(prod.sections.length).toBeGreaterThanOrEqual(4);
  });

  it('10. exportProductsToExcel generates section-wise sheets and no generic Specifications sheet', () => {
    const exportBytes = exportProductsToExcel(mockExistingProducts, mockCategories, mockBrands);
    const wb = XLSX.read(exportBytes, { type: 'array' });

    expect(wb.SheetNames).toContain('Products');
    expect(wb.SheetNames).toContain(SECTION_SHEET_NAMES.KEY_INFO);
    expect(wb.SheetNames).not.toContain('Specifications');

    const wsKey = wb.Sheets[SECTION_SHEET_NAMES.KEY_INFO];
    const rows: any[][] = XLSX.utils.sheet_to_json(wsKey, { header: 1 });
    expect(rows[0][0]).toBe('Product ID');
    expect(rows[0][1]).toBe('Product Name');
    expect(rows[1][0]).toBe('PK-PROD-001');
  });
});

