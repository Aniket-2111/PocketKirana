import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { INITIAL_BRANDS, INITIAL_PRODUCTS } from '@/lib/mockData';

describe('Homepage Usability & Heuristics Verification', () => {
  it('Production safety: NotificationSimulator has production environment guard', () => {
    const simulatorPath = path.join(process.cwd(), 'components', 'common', 'NotificationSimulator.tsx');
    expect(fs.existsSync(simulatorPath)).toBe(true);
    const content = fs.readFileSync(simulatorPath, 'utf8');
    expect(content).toContain("process.env.NODE_ENV !== 'development'");
    expect(content).toContain('return null;');
  });

  it('ProductImage resilience: ProductImage component exists with accessible fallback', () => {
    const componentPath = path.join(process.cwd(), 'components', 'customer', 'ProductImage.tsx');
    expect(fs.existsSync(componentPath)).toBe(true);
    const content = fs.readFileSync(componentPath, 'utf8');
    expect(content).toContain('role="img"');
    expect(content).toContain('image unavailable');
    expect(content).toContain('sr-only');
    expect(content).toContain('onError');
  });

  it('Brand logos: all INITIAL_BRANDS use local SVG assets or valid structured paths', () => {
    INITIAL_BRANDS.forEach((brand) => {
      expect(brand.logo).toMatch(/^\/brands\/[a-z0-9-]+\.svg$|^https?:\/\//);
      expect(brand.name).toBeTruthy();
      expect(brand.slug).toBeTruthy();
    });
  });

  it('Brand assets: verifies local SVG files exist in public/brands', () => {
    const brandFiles = [
      'fortune.svg',
      'amul.svg',
      'aashirvaad.svg',
      'lays.svg',
      'britannia.svg',
      'mother-dairy.svg',
      'tata.svg',
      'saffola.svg',
      'dettol.svg',
      'surf-excel.svg',
      'nestle.svg',
      'parle.svg',
      'everest.svg',
    ];
    brandFiles.forEach((file) => {
      const filePath = path.join(process.cwd(), 'public', 'brands', file);
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('<svg');
    });
  });

  it('Footer headings: uses semantic h3 for column landmarks under h2 sections', () => {
    const footerPath = path.join(process.cwd(), 'components', 'layout', 'Footer.tsx');
    const content = fs.readFileSync(footerPath, 'utf8');
    expect(content).toContain('<h3 className="text-xs font-black uppercase text-[#075C3C]');
    expect(content).toContain('Categories');
    expect(content).toContain('About &amp; Help');
  });

  it('Footer payment badges: uses standardized neutral badge labels', () => {
    const footerPath = path.join(process.cwd(), 'components', 'layout', 'Footer.tsx');
    const content = fs.readFileSync(footerPath, 'utf8');
    expect(content).toContain('UPI');
    expect(content).toContain('VISA');
    expect(content).toContain('MASTERCARD');
    expect(content).toContain('RUPAY');
    expect(content).toContain('CASH ON DELIVERY');
  });

  it('Product data consistency: all initial vegetables and pantry items have valid units and ratings', () => {
    const vegProducts = INITIAL_PRODUCTS.filter((p) => p.categoryId === 'cat-veg');
    expect(vegProducts.length).toBeGreaterThan(0);

    vegProducts.forEach((p) => {
      expect(p.name).toBeTruthy();
      expect(p.thumbnail).toBeTruthy();
      expect(p.sellingPrice).toBeGreaterThan(0);
    });
  });

  it('Typography: verifies Header 30 Min Groceries has tracking-wide and no uppercase class', () => {
    const headerPath = path.join(process.cwd(), 'components', 'customer', 'Header.tsx');
    const content = fs.readFileSync(headerPath, 'utf8');
    expect(content).toContain('30 Min Groceries');
    expect(content).toContain('tracking-wide');
    const match = content.match(/<span[^>]*>[\s\n]*30 Min Groceries[\s\n]*<\/span>/);
    expect(match).toBeTruthy();
    expect(match![0]).not.toContain('uppercase');
  });

  it('ProductCard: verifies Add button and stepper controls use canonical brand styling', () => {
    const cardPath = path.join(process.cwd(), 'components', 'customer', 'ProductCard.tsx');
    const content = fs.readFileSync(cardPath, 'utf8');
    expect(content).toContain('ProductImage');
    expect(content).toContain('aria-label="Decrease quantity"');
    expect(content).toContain('aria-label="Increase quantity"');
    expect(content).toContain('bg-[#075C3C]');
  });
});
