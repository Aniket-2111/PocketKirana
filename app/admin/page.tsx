'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { showToast } from '@/components/ui/Toast';
import { OrderStatus, Product } from '@/types';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Store as StoreIcon,
  Package,
  Tag,
  Image as ImageIcon,
  FileText,
  DollarSign,
  TrendingUp,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Truck,
  Search,
  Edit,
  Lock,
  ArrowRight,
  RefreshCw,
  XCircle,
  BarChart3,
  ChevronRight,
  MapPin,
  Phone,
  X,
  LayoutDashboard,
  Percent,
  Layers,
  ShoppingBag,
  Mail,
  Sliders,
  Calendar,
  ChevronDown,
  ArrowUpRight,
  CreditCard,
  Wallet,
  FileSpreadsheet,
  UploadCloud,
  Navigation,
  Bell,
  Send,
  Sparkles,
  Radio,
  Eye,
  ExternalLink,
  Boxes,
  Barcode,
  History,
  CheckCheck,
  Building2,
  Menu
} from 'lucide-react';
import { BulkCSVUploadModal } from '@/components/admin/BulkCSVUploadModal';
import { uploadProductImageFS } from '@/lib/firebaseStorage';
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell';
import { NotificationSimulator } from '@/components/common/NotificationSimulator';
import { Product360Modal } from '@/components/admin/Product360Modal';
import { AddProductWithBarcodeModal } from '@/components/admin/AddProductWithBarcodeModal';
import { BatchInventoryView } from '@/components/admin/BatchInventoryView';
import { ExpiryCenterView } from '@/components/admin/ExpiryCenterView';
import { InventoryLedgerView } from '@/components/admin/InventoryLedgerView';
import { CategoryManagementView } from '@/components/admin/CategoryManagementView';
import { BrandManagementView } from '@/components/admin/BrandManagementView';
import { BannerManagementView } from '@/components/admin/BannerManagementView';
import { ModernSalesAnalyticsChart } from '@/components/admin/ModernSalesAnalyticsChart';
import { StaffManagementView } from '@/components/admin/StaffManagementView';
import { InvoicesManagementView } from '@/components/admin/InvoicesManagementView';
import { InvoiceSettingsView } from '@/components/admin/InvoiceSettingsView';
import { PaymentsAndSettlementView } from '@/components/admin/PaymentsAndSettlementView';
import { FestivalCampaignsCMS } from '@/components/admin/festival/FestivalCampaignsCMS';
import { Order } from '@/types';
import { INITIAL_ORDERS } from '@/lib/mockData';

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get('tab') as any) || 'overview';

  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const {
    activeRole,
    setActiveRole,
    products,
    categories,
    banners,
    coupons,
    orders,
    deliveryPartners,
    pickers,
    addresses,
    auditLogs,
    addAuditLog,
    notifications,
    campaigns,
    addCampaign,
    dispatchNotification,
    getFilteredNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    isFirebaseConnected,
    isFirebaseLoading,
    initializeFirebaseSync,
    seedFirebaseData,
    addBanner,
    toggleBannerStatus,
    addCoupon,
    updateOrderStatus,
    assignDeliveryPartner,
    addProduct,
    updateProduct,
    deleteProduct,
    addCategory,
    updateCategory,
    deleteCategory,
    downloadInvoicePDF
  } = useAppStore();

  React.useEffect(() => {
    initializeFirebaseSync();
  }, [initializeFirebaseSync]);

  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedFirebase = async () => {
    setIsSeeding(true);
    const result = await seedFirebaseData();
    setIsSeeding(false);
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleSyncFirebase = async () => {
    await initializeFirebaseSync();
    showToast('Synced latest data from Firestore!', 'info');
  };

  const [activeTab, setActiveTab] = useState<
    'overview' | 'analytics' | 'inventory' | 'batches' | 'expiry' | 'ledger' | 'categories' | 'brands' | 'offers' | 'orders' | 'customers' | 'notifications' | 'audit' | 'delivery-fleet' | 'service-area' | 'invoices' | 'invoice-settings' | 'payments' | 'festivals'
  >(
    initialTab === 'store' ? 'orders' : (initialTab as any) || 'overview'
  );

  const [selectedOrderModal, setSelectedOrderModal] = useState<Order | null>(null);
  const [selectedProductFor360, setSelectedProductFor360] = useState<Product | null>(null);
  const [showBarcodeAddModal, setShowBarcodeAddModal] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Synchronize URL search parameters (tab, orderId, search) with state
  React.useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam === 'store' ? 'orders' : (tabParam as any));
    }
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setProductSearch(searchParam);
    }
    const orderIdParam = searchParams.get('orderId');
    if (orderIdParam) {
      const match =
        orders.find(
          (o) =>
            o.id === orderIdParam ||
            o.orderNumber === orderIdParam ||
            o.id.toLowerCase() === orderIdParam.toLowerCase() ||
            o.orderNumber.toLowerCase() === orderIdParam.toLowerCase()
        ) ||
        INITIAL_ORDERS.find(
          (o) =>
            o.id === orderIdParam ||
            o.orderNumber === orderIdParam ||
            o.id.toLowerCase() === orderIdParam.toLowerCase() ||
            o.orderNumber.toLowerCase() === orderIdParam.toLowerCase()
        );
      if (match) {
        setSelectedOrderModal(match);
      }
    }
  }, [searchParams, orders]);

  // Broadcast & Campaign Composer states
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState<'all' | 'new_users' | 'returning' | 'selected'>('all');
  const [broadcastCoupon, setBroadcastCoupon] = useState('');
  const [broadcastImage, setBroadcastImage] = useState('');
  const [broadcastDeepLink, setBroadcastDeepLink] = useState('/offers');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMessage) {
      showToast('Please enter both title and message', 'error');
      return;
    }

    setIsBroadcasting(true);
    const result = await addCampaign({
      title: broadcastTitle,
      message: broadcastMessage,
      targetAudience: broadcastAudience,
      couponCode: broadcastCoupon || undefined,
      imageUrl: broadcastImage || undefined,
      deepLink: broadcastDeepLink || '/offers',
      status: 'sent',
      sentAt: new Date().toISOString(),
      sentCount: 1420,
      readCount: 0,
      createdAt: new Date().toISOString(),
    });
    setIsBroadcasting(false);

    if (result) {
      showToast(`Broadcast campaign "${broadcastTitle}" sent successfully via FCM!`, 'success');
      setBroadcastTitle('');
      setBroadcastMessage('');
      setBroadcastCoupon('');
      setBroadcastImage('');
    }
  };

  const [selectedMonth, setSelectedMonth] = useState('Jul 2026');

  // Modals & search states
  const [showBulkCSVModal, setShowBulkCSVModal] = useState(false);
  const [showAddBannerModal, setShowAddBannerModal] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [bannerTag, setBannerTag] = useState('');
  const [bannerImage, setBannerImage] = useState('');

  const [showAddCouponModal, setShowAddCouponModal] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponValue, setCouponValue] = useState('');
  const [couponMinOrder, setCouponMinOrder] = useState('499');

  // Add category form states
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatImage, setNewCatImage] = useState('');

  // Edit category form states
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatSlug, setEditCatSlug] = useState('');
  const [editCatImage, setEditCatImage] = useState('');
  const [editCatActive, setEditCatActive] = useState(true);

  // Add product form states
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState(categories[0]?.id || 'cat-dairy');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdMrp, setNewProdMrp] = useState('');
  const [newProdUnit, setNewProdUnit] = useState('1 kg');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdShelfLife, setNewProdShelfLife] = useState('90 days');
  const [newProdFoodType, setNewProdFoodType] = useState('100% Vegetarian');
  const [newProdProductType, setNewProdProductType] = useState('Sehori Atta');
  const [newProdSource, setNewProdSource] = useState('Sehore, Madhya Pradesh');
  const [newProdDietPreference, setNewProdDietPreference] = useState('High Fiber');
  const [newProdCountryOfOrigin, setNewProdCountryOfOrigin] = useState('India');
  const [newProdFssaiLicense, setNewProdFssaiLicense] = useState('10012031000312');
  const [newProdManufacturer, setNewProdManufacturer] = useState('PocketKirana Verified DarkStore Hub & Authorized FMCG Partner, Neral Central Distribution Center.');
  const [newProdStorageInstructions, setNewProdStorageInstructions] = useState('Store in a cool, hygienic, dry place away from direct sunlight and heat.');
  const [newProdKeyFeatures, setNewProdKeyFeatures] = useState('EXPERIENCE THE GOLDEN GRAINS: Indulge in the finest quality atta made with Premium MP Sehori Wheat carefully selected and sourced from the farmers of Sehore, Madhya Pradesh, for its exceptional aroma and taste\nBRINGING YOU WHAT YOU LIKE: Made with your preferred wheat variety, in your way of traditional chakki jaisi pisai, provided with guarantee of wheat sourcing through quality certificate');
  const [newProdDisclaimer, setNewProdDisclaimer] = useState('Every effort is made to maintain accuracy of all information. However, actual product packaging and materials may contain more and/or different information.');
  // Nutritional info
  const [newProdEnergy, setNewProdEnergy] = useState('343 kcal');
  const [newProdProtein, setNewProdProtein] = useState('10.5 g');
  const [newProdCarbs, setNewProdCarbs] = useState('77.1 g');
  const [newProdTotalSugar, setNewProdTotalSugar] = useState('3.4 g');
  const [newProdAddedSugar, setNewProdAddedSugar] = useState('0 g');
  const [newProdTotalFat, setNewProdTotalFat] = useState('1.6 g');
  const [newProdSaturatedFat, setNewProdSaturatedFat] = useState('0.3 g');
  const [newProdUnsaturatedFat, setNewProdUnsaturatedFat] = useState('1.3 g');
  const [newProdTransFat, setNewProdTransFat] = useState('0 g');
  const [newProdDietaryFiber, setNewProdDietaryFiber] = useState('10.8 g');
  const [newProdSodium, setNewProdSodium] = useState('1.7 mg');

  // Edit product form states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editMrp, setEditMrp] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'out_of_stock' | 'discontinued'>('active');
  const [editShelfLife, setEditShelfLife] = useState('90 days');
  const [editFoodType, setEditFoodType] = useState('100% Vegetarian');
  const [editProductType, setEditProductType] = useState('Sehori Atta');
  const [editSource, setEditSource] = useState('Sehore, Madhya Pradesh');
  const [editDietPreference, setEditDietPreference] = useState('High Fiber');
  const [editCountryOfOrigin, setEditCountryOfOrigin] = useState('India');
  const [editFssaiLicense, setEditFssaiLicense] = useState('10012031000312');
  const [editManufacturer, setEditManufacturer] = useState('');
  const [editStorageInstructions, setEditStorageInstructions] = useState('');
  const [editKeyFeatures, setEditKeyFeatures] = useState('');
  const [editDisclaimer, setEditDisclaimer] = useState('');
  // Nutritional info edit
  const [editEnergy, setEditEnergy] = useState('343 kcal');
  const [editProtein, setEditProtein] = useState('10.5 g');
  const [editCarbs, setEditCarbs] = useState('77.1 g');
  const [editTotalSugar, setEditTotalSugar] = useState('3.4 g');
  const [editAddedSugar, setEditAddedSugar] = useState('0 g');
  const [editTotalFat, setEditTotalFat] = useState('1.6 g');
  const [editSaturatedFat, setEditSaturatedFat] = useState('0.3 g');
  const [editUnsaturatedFat, setEditUnsaturatedFat] = useState('1.3 g');
  const [editTransFat, setEditTransFat] = useState('0 g');
  const [editDietaryFiber, setEditDietaryFiber] = useState('10.8 g');
  const [editSodium, setEditSodium] = useState('1.7 mg');

  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleUploadImageFile = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    const uploadedUrl = await uploadProductImageFS(file, 'products');
    setIsUploadingImage(false);
    if (uploadedUrl) {
      if (isEdit) {
        setEditImage(uploadedUrl);
      } else {
        setNewProdImage(uploadedUrl);
      }
      showToast('Image uploaded to Firebase Storage!', 'success');
    } else {
      showToast('Failed to upload image to Firebase Storage', 'error');
    }
  };

  // Security Check: Customer role cannot access Admin / Store Console
  const isAuthorized = activeRole === 'admin' || activeRole === 'store_manager';

  const totalGMV = orders.reduce((sum, o) => sum + o.total, 0);
  const deliveredOrders = orders.filter((o) => o.orderStatus === 'delivered');
  const todayRevenue = deliveredOrders.reduce((sum, o) => sum + o.total, 0);
  const activeOrders = orders.filter(
    (o) => o.orderStatus !== 'delivered' && o.orderStatus !== 'cancelled'
  );

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleCreateBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerTitle || !bannerImage) return;
    addBanner({
      title: bannerTitle,
      subtitle: bannerSubtitle,
      tag: bannerTag || 'SPECIAL PROMO',
      image: bannerImage,
      redirectUrl: '/products',
      active: true
    });
    setShowAddBannerModal(false);
    setBannerTitle('');
    setBannerSubtitle('');
    setBannerImage('');
    showToast('Banner created successfully!', 'success');
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode || !couponValue) return;
    addCoupon({
      code: couponCode.toUpperCase(),
      type: 'fixed',
      value: Number(couponValue),
      minimumOrder: Number(couponMinOrder),
      maxDiscount: Number(couponValue),
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      usageLimit: 100,
      active: true
    });
    setShowAddCouponModal(false);
    setCouponCode('');
    setCouponValue('');
    showToast('Coupon created successfully!', 'success');
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    addCategory({
      name: newCatName,
      slug: newCatSlug || newCatName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      image: newCatImage || 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=200&q=80',
      sortOrder: categories.length + 1,
      isActive: true
    });
    setShowAddCategoryModal(false);
    setNewCatName('');
    setNewCatSlug('');
    setNewCatImage('');
    showToast(`Category "${newCatName}" created successfully!`, 'success');
  };

  const handleOpenEditCategoryModal = (cat: any) => {
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setEditCatSlug(cat.slug);
    setEditCatImage(cat.image);
    setEditCatActive(cat.isActive);
  };

  const handleUpdateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editCatName) return;
    updateCategory(editingCategory.id, {
      name: editCatName,
      slug: editCatSlug || editCatName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      image: editCatImage,
      isActive: editCatActive
    });
    setEditingCategory(null);
    showToast(`Category "${editCatName}" updated!`, 'success');
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice) return;
    addProduct({
      categoryId: newProdCategory,
      storeId: 'store-1',
      sku: `PK-${Math.floor(1000 + Math.random() * 9000)}`,
      barcode: `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      name: newProdName,
      slug: newProdName.toLowerCase().replace(/\s+/g, '-'),
      description: newProdDesc || 'Fresh local Kirana store product, high quality.',
      unit: newProdUnit,
      weight: 1.0,
      mrp: Number(newProdMrp) || Number(newProdPrice),
      sellingPrice: Number(newProdPrice),
      taxPercentage: 5,
      thumbnail: newProdImage || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80',
      status: 'active',
      shelfLife: newProdShelfLife || '90 days',
      foodType: newProdFoodType || '100% Vegetarian',
      productType: newProdProductType || 'Sehori Atta',
      source: newProdSource || 'Sehore, Madhya Pradesh',
      dietPreference: newProdDietPreference || 'High Fiber',
      countryOfOrigin: newProdCountryOfOrigin || 'India',
      fssaiLicense: newProdFssaiLicense || '10012031000312',
      manufacturer: newProdManufacturer || 'PocketKirana Verified DarkStore Hub & Authorized FMCG Partner, Neral Central Distribution Center.',
      storageInstructions: newProdStorageInstructions || 'Store in a cool, hygienic, dry place away from direct sunlight and heat.',
      keyFeatures: newProdKeyFeatures,
      disclaimer: newProdDisclaimer,
      nutritionalInfo: {
        energy: newProdEnergy,
        protein: newProdProtein,
        carbohydrates: newProdCarbs,
        totalSugar: newProdTotalSugar,
        addedSugar: newProdAddedSugar,
        totalFat: newProdTotalFat,
        saturatedFat: newProdSaturatedFat,
        unsaturatedFat: newProdUnsaturatedFat,
        transFat: newProdTransFat,
        dietaryFiber: newProdDietaryFiber,
        sodium: newProdSodium,
      },
      rating: 4.8,
      reviewsCount: 1,
    });
    setShowAddProductModal(false);
    setNewProdName('');
    setNewProdPrice('');
    setNewProdMrp('');
    setNewProdDesc('');
    setNewProdImage('');
    showToast(`${newProdName} added to product catalog!`, 'success');
  };

  const handleOpenEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setEditName(prod.name);
    setEditCategory(prod.categoryId);
    setEditPrice(String(prod.sellingPrice));
    setEditMrp(String(prod.mrp));
    setEditUnit(prod.unit);
    setEditDesc(prod.description || '');
    setEditImage(prod.thumbnail);
    setEditStatus(prod.status);
    setEditShelfLife(prod.shelfLife || '90 days');
    setEditFoodType(prod.foodType || '100% Vegetarian');
    setEditProductType(prod.productType || 'Sehori Atta');
    setEditSource(prod.source || 'Sehore, Madhya Pradesh');
    setEditDietPreference(prod.dietPreference || 'High Fiber');
    setEditCountryOfOrigin(prod.countryOfOrigin || 'India');
    setEditFssaiLicense(prod.fssaiLicense || '10012031000312');
    setEditManufacturer(prod.manufacturer || 'PocketKirana Verified DarkStore Hub & Authorized FMCG Partner, Neral Central Distribution Center.');
    setEditStorageInstructions(prod.storageInstructions || 'Store in a cool, hygienic, dry place away from direct sunlight and heat.');
    setEditKeyFeatures(prod.keyFeatures || prod.description || '');
    setEditDisclaimer(prod.disclaimer || 'Every effort is made to maintain accuracy of all information. However, actual product packaging and materials may contain more and/or different information.');
    setEditEnergy(prod.nutritionalInfo?.energy || '343 kcal');
    setEditProtein(prod.nutritionalInfo?.protein || '10.5 g');
    setEditCarbs(prod.nutritionalInfo?.carbohydrates || '77.1 g');
    setEditTotalSugar(prod.nutritionalInfo?.totalSugar || '3.4 g');
    setEditAddedSugar(prod.nutritionalInfo?.addedSugar || '0 g');
    setEditTotalFat(prod.nutritionalInfo?.totalFat || '1.6 g');
    setEditSaturatedFat(prod.nutritionalInfo?.saturatedFat || '0.3 g');
    setEditUnsaturatedFat(prod.nutritionalInfo?.unsaturatedFat || '1.3 g');
    setEditTransFat(prod.nutritionalInfo?.transFat || '0 g');
    setEditDietaryFiber(prod.nutritionalInfo?.dietaryFiber || '10.8 g');
    setEditSodium(prod.nutritionalInfo?.sodium || '1.7 mg');
  };

  const handleUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editName || !editPrice) return;

    updateProduct(editingProduct.id, {
      name: editName,
      slug: editName.toLowerCase().replace(/\s+/g, '-'),
      categoryId: editCategory,
      sellingPrice: Number(editPrice),
      mrp: Number(editMrp) || Number(editPrice),
      unit: editUnit,
      description: editDesc,
      thumbnail: editImage || editingProduct.thumbnail,
      status: editStatus,
      shelfLife: editShelfLife,
      foodType: editFoodType,
      productType: editProductType,
      source: editSource,
      dietPreference: editDietPreference,
      countryOfOrigin: editCountryOfOrigin,
      fssaiLicense: editFssaiLicense,
      manufacturer: editManufacturer,
      storageInstructions: editStorageInstructions,
      keyFeatures: editKeyFeatures,
      disclaimer: editDisclaimer,
      nutritionalInfo: {
        energy: editEnergy,
        protein: editProtein,
        carbohydrates: editCarbs,
        totalSugar: editTotalSugar,
        addedSugar: editAddedSugar,
        totalFat: editTotalFat,
        saturatedFat: editSaturatedFat,
        unsaturatedFat: editUnsaturatedFat,
        transFat: editTransFat,
        dietaryFiber: editDietaryFiber,
        sodium: editSodium,
      },
    });

    setEditingProduct(null);
    showToast(`${editName} updated successfully!`, 'success');
  };

  // ── SECURITY PROTECTION BARRIER REMOVED ──

  // Sidebar Menu Config (Pixel Commerce / PocketKirana  // Sidebar Menu Config (Pixel Commerce / PocketKirana Style)
  const adminUnreadCount = notifications.filter(n => n.recipientType === 'admin' && !n.isRead).length;

  const navMenuSections = [
    {
      title: 'OPERATIONS',
      items: [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'orders', label: 'Orders & Queue', icon: ShoppingBag, count: activeOrders.length },
        { id: 'delivery-fleet', label: 'Staff & Fleet', icon: Truck, count: deliveryPartners.length + (pickers?.length || 0) },
        { id: 'service-area', label: 'Service Area', icon: MapPin, href: '/admin/service-area' },
      ],
    },
    {
      title: 'CATALOG & INVENTORY',
      items: [
        { id: 'inventory', label: 'Products', icon: Package, count: products.length },
        { id: 'categories', label: 'Categories', icon: Layers, count: categories.length },
        { id: 'brands', label: 'Brands', icon: Building2 },
        { id: 'batches', label: 'Batch & FEFO Stock', icon: Boxes },
        { id: 'expiry', label: 'Expiry Center', icon: Clock },
        { id: 'ledger', label: 'Stock Ledger', icon: History },
      ],
    },
    {
      title: 'GROWTH & CUSTOMERS',
      items: [
        { id: 'festivals', label: 'Festival Campaigns', icon: Sparkles },
        { id: 'offers', label: 'Banners & Marketing', icon: Percent, count: banners.length + coupons.length },
        { id: 'customers', label: 'Customer Base', icon: Users },
        { id: 'notifications', label: 'Broadcast & Alerts', icon: Bell, count: adminUnreadCount > 0 ? adminUnreadCount : undefined },
      ],
    },
    {
      title: 'FINANCE & AUDIT',
      items: [
        { id: 'payments', label: 'Payments & Settlements', icon: Wallet },
        { id: 'invoices', label: 'Invoices', icon: FileText },
        { id: 'invoice-settings', label: 'Invoice Settings', icon: Sliders },
        { id: 'analytics', label: 'Analytics & Trends', icon: BarChart3 },
        { id: 'audit', label: 'Audit Logs', icon: ShieldCheck, count: auditLogs.length },
      ],
    },
  ];

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo & Brand Header */}
      <div className="flex items-center justify-between px-2 py-2 mb-2 shrink-0 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo-icon.png"
            alt="Pocket Kirana"
            className="w-9 h-9 object-contain rounded-xl bg-white p-1 shadow-xs border border-slate-200"
          />
          <div>
            <h2 className="font-black text-slate-900 text-base tracking-tight leading-none">
              Pocket<span className="text-emerald-600">Kirana</span>
            </h2>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">Admin Console</span>
          </div>
        </div>
        {mobileSidebarOpen && (
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Sidebar Nav Links with Clear Grouping */}
      <nav className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400 overscroll-contain">
        {navMenuSections.map((sec) => (
          <div key={sec.title} className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 block">
              {sec.title}
            </span>
            <div className="space-y-0.5">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                if ((item as any).href) {
                  return (
                    <Link
                      key={item.id}
                      href={(item as any).href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#4FD1C5] text-slate-950 font-black shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                      {item.count !== undefined && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                            isActive ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-slate-950 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Quick User Profile Pill at Bottom (Pinned) */}
      <div className="shrink-0 pt-3 mt-2 border-t border-slate-200 flex items-center justify-between px-2 text-xs bg-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
            A
          </div>
          <div className="min-w-0">
            <span className="font-bold text-slate-900 block leading-tight truncate">Aniket (Admin)</span>
            <span className="text-[10px] text-slate-500 block truncate">Master Operations</span>
          </div>
        </div>
        <button
          onClick={() => setActiveRole('customer')}
          className="text-slate-400 hover:text-slate-900 transition-colors p-1.5 rounded-lg hover:bg-slate-100 shrink-0"
          title="Switch to Customer Mode"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] text-slate-900 flex items-center justify-center font-sans">
        <div className="p-10 text-center text-xs text-slate-500 font-bold">Loading Admin Console...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-slate-900 flex flex-col font-sans" suppressHydrationWarning>
      <RoleSwitcher />

      {/* Main Admin Wrapper */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto bg-[#F4F5F7] min-h-[calc(100vh-37px)] relative">

        {/* ── DESKTOP LEFT SIDEBAR ── */}
        <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0 p-3.5 sticky top-[37px] h-[calc(100vh-37px)] max-h-[calc(100vh-37px)] z-30 overflow-hidden shadow-2xs">
          {renderSidebarContent()}
        </aside>

        {/* ── MOBILE SLIDEOVER DRAWER ── */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-slate-950/60 backdrop-blur-xs flex">
            <div className="w-72 max-w-[85vw] bg-white h-full p-4 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
              {renderSidebarContent()}
            </div>
            <div className="flex-1" onClick={() => setMobileSidebarOpen(false)} />
          </div>
        )}

        {/* ── MAIN CONTENT AREA (Right Side) ── */}
        <main className="flex-1 flex flex-col min-w-0 p-4 sm:p-6 md:p-8 space-y-6 overflow-y-auto">

          {/* Top Bar Header */}
          <header className="flex flex-wrap items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shadow-2xs cursor-pointer"
                aria-label="Open Admin Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight capitalize">
                  {activeTab === 'overview' ? 'Overview' : activeTab.replace(/_/g, ' ')}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">Real-time store performance & operational controls</p>
              </div>
            </div>

            {/* Top Search, Notification Bell & Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search products, orders..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs rounded-xl py-2.5 pl-9 pr-4 focus:outline-none focus:border-slate-400 shadow-2xs"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>

              {/* Admin Notification Bell */}
              <AdminNotificationBell />

              <button
                onClick={() => setShowBulkCSVModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Bulk CSV Import</span>
              </button>

              <button
                onClick={() => setShowBarcodeAddModal(true)}
                className="bg-slate-900 hover:bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product (EAN-13)</span>
              </button>
            </div>
          </header>

          {/* ── TAB 1: OVERVIEW (Matching Screenshot Layout Exactly) ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">

              {/* Top Stat Cards (Total Revenue & Total Orders) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Total Revenue */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between text-slate-500">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Total Revenue</span>
                      <span className="text-[10px] text-slate-400">Last 30 days</span>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                      <DollarSign className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between flex-wrap gap-x-2 gap-y-1 pt-1">
                    <span className="text-2xl font-black text-slate-900">₹{totalGMV > 0 ? totalGMV.toLocaleString() : '82,650'}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      <TrendingUp className="w-3 h-3" /> +11%
                    </span>
                  </div>
                </div>

                {/* Total Order */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between text-slate-500">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Total Order</span>
                      <span className="text-[10px] text-slate-400">Last 30 days</span>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-2xl font-black text-slate-900">{orders.length > 0 ? orders.length : '1,645'}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      <TrendingUp className="w-3 h-3" /> +11%
                    </span>
                  </div>
                </div>

                {/* Total Products */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between text-slate-500">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Active Products</span>
                      <span className="text-[10px] text-slate-400">Inventory Catalog</span>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center">
                      <Package className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-2xl font-black text-slate-900">{products.length} Items</span>
                    <span className="text-[11px] text-slate-500 font-bold">{categories.length} Categories</span>
                  </div>
                </div>

                {/* Active EV Delivery & Picker Fleet */}
                <div
                  onClick={() => setActiveTab('delivery-fleet')}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3 cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block group-hover:text-emerald-700 transition-colors">Staff &amp; Fleet</span>
                      <span className="text-[10px] text-slate-400">Riders &amp; Pickers</span>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-200 transition-colors">
                      <Truck className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-2xl font-black text-slate-900">{deliveryPartners.length + (pickers?.length || 0)} Staff</span>
                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {deliveryPartners.length} Riders / {pickers?.length || 0} Pickers
                    </span>
                  </div>
                </div>
              </div>

              {/* Modern Interactive Sales Analytics Chart */}
              <ModernSalesAnalyticsChart />

              {/* Top Selling Products Grid (Matching Screenshot) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-slate-900 tracking-tight">Top Selling Products</h3>
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className="text-xs font-bold text-slate-700 hover:text-black flex items-center gap-1"
                  >
                    View All Products <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {products.slice(0, 5).map((prod) => (
                    <div
                      key={prod.id}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between hover:shadow-md transition-all group"
                    >
                      <div className="bg-white rounded-xl p-3 mb-3 border border-slate-100 flex items-center justify-center h-32 overflow-hidden">
                        <img
                          src={prod.thumbnail}
                          alt={prod.name}
                          className="h-full object-contain group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 text-xs truncate">{prod.name}</h4>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">752 Pcs</span>
                          <span className="font-black text-slate-900">₹{prod.sellingPrice}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: ANALYTICS & REPORTS ── */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h3 className="font-black text-slate-900 text-lg">Detailed Sales & Operational Metrics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
                    <span className="text-xs text-slate-500 font-bold uppercase block">Gross Sales</span>
                    <span className="text-2xl font-black text-slate-900">₹{totalGMV.toLocaleString()}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
                    <span className="text-xs text-slate-500 font-bold uppercase block">Average Order Value</span>
                    <span className="text-2xl font-black text-slate-900">
                      ₹{orders.length > 0 ? Math.round(totalGMV / orders.length) : 0}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
                    <span className="text-xs text-slate-500 font-bold uppercase block">Total Delivered</span>
                    <span className="text-2xl font-black text-slate-900">{deliveredOrders.length} Orders</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: PRODUCTS & INVENTORY ── */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search by product name or SKU..."
                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs rounded-xl py-2.5 pl-9 pr-4 focus:outline-none focus:border-black shadow-2xs"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>

                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="bg-black hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Product</span>
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-black tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-4">Product</th>
                      <th className="p-4">SKU</th>
                      <th className="p-4">Selling Price</th>
                      <th className="p-4">MRP</th>
                      <th className="p-4">Stock Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 flex items-center gap-3">
                          <img src={prod.thumbnail} alt={prod.name} className="w-10 h-10 object-contain rounded-lg border border-slate-200 p-1 bg-white" />
                          <div>
                            <span className="font-bold text-slate-900 block">{prod.name}</span>
                            <span className="text-[10px] text-slate-500">{prod.unit}</span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-600 font-mono">{prod.sku}</td>
                        <td className="p-4 font-black text-slate-900">₹{prod.sellingPrice}</td>
                        <td className="p-4 text-slate-400 line-through">₹{prod.mrp}</td>
                        <td className="p-4">
                          <select
                            value={prod.status}
                            onChange={(e) => updateProduct(prod.id, { status: e.target.value as any })}
                            className="bg-white border border-slate-200 text-xs font-bold rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none"
                          >
                            <option value="active">Active</option>
                            <option value="out_of_stock">Out of Stock</option>
                            <option value="discontinued">Discontinued</option>
                          </select>
                        </td>
                        <td className="p-4 text-right flex items-center justify-end gap-1.5">
                          {/* Product 360 Button */}
                          <button
                            onClick={() => setSelectedProductFor360(prod)}
                            className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-1.5 transition-colors rounded-lg border border-emerald-200 flex items-center gap-1 text-[11px] font-bold"
                            title="Product 360 View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>360</span>
                          </button>
                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenEditModal(prod)}
                            className="text-slate-600 hover:text-black p-1.5 transition-colors rounded-lg hover:bg-slate-100 border border-slate-200"
                            title="Edit Product"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {/* Delete Button */}
                          <button
                            onClick={() => {
                              deleteProduct(prod.id);
                              showToast(`${prod.name} deleted`, 'info');
                            }}
                            className="text-slate-400 hover:text-red-600 p-1.5 transition-colors rounded-lg hover:bg-slate-100 border border-slate-200"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB: STAFF & DELIVERY FLEET MANAGEMENT (Direct In-Dashboard View) ── */}
          {activeTab === 'delivery-fleet' && (
            <StaffManagementView />
          )}

          {/* ── TAB: BATCHES & FEFO INVENTORY ── */}
          {activeTab === 'batches' && (
            <BatchInventoryView />
          )}

          {/* ── TAB: EXPIRY CENTER ── */}
          {activeTab === 'expiry' && (
            <ExpiryCenterView />
          )}

          {/* ── TAB: STOCK AUDIT LEDGER ── */}
          {activeTab === 'ledger' && (
            <InventoryLedgerView />
          )}

          {/* ── TAB: DYNAMIC CATEGORY & SUBCATEGORY MANAGEMENT ── */}
          {activeTab === 'categories' && (
            <CategoryManagementView />
          )}

          {/* ── TAB: BRAND MANAGEMENT ── */}
          {activeTab === 'brands' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2">
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Brand Management</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Create, edit, reorder, and assign brands to categories dynamically. Brand filter pills on customer category pages are powered by this data.
                  </p>
                </div>
              </div>
              <BrandManagementView />
            </div>
          )}

          {/* ── TAB 4: MARKETING & BANNERS ── */}
          {activeTab === 'offers' && (
            <BannerManagementView />
          )}

          {/* ── TAB 5: ORDERS & STORE QUEUE (Orders Management) ── */}
          {activeTab === 'orders' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Header Section */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-3xl font-extrabold text-[#121c2a] tracking-tight">Orders Management</h2>
                  <p className="text-xs text-[#3d4a3d] font-medium mt-1">
                    Monitor, filter, and manage all incoming and processed grocery orders in real-time.
                  </p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <button
                    onClick={() => showToast('Orders exported to CSV file!', 'success')}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-[#121c2a] border border-gray-200/80 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors shadow-xs w-full md:w-auto cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">file_download</span>
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="bg-white/95 backdrop-blur-md rounded-xl p-4 border border-gray-200/80 shadow-xs flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="relative w-full lg:w-1/3">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                    search
                  </span>
                  <input
                    className="w-full pl-10 pr-10 py-2.5 bg-[#f8f9ff] border border-gray-200/80 rounded-lg text-xs font-medium focus:outline-none focus:border-[#006e2f] focus:ring-1 focus:ring-[#006e2f] transition-all shadow-2xs"
                    placeholder="Search by Order ID or Customer..."
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#006e2f] text-lg cursor-pointer">
                    mic
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto text-xs">
                  <button
                    onClick={() => showToast('Filter options applied', 'info')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white text-[#121c2a] border border-gray-200/80 rounded-lg font-bold hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">filter_list</span>
                    Filter
                  </button>

                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white text-[#121c2a] border border-gray-200/80 rounded-lg font-bold hover:bg-gray-50 transition-colors shadow-xs cursor-pointer">
                    <span className="material-symbols-outlined text-lg text-gray-500">date_range</span>
                    <span>Today</span>
                    <span className="material-symbols-outlined text-base">arrow_drop_down</span>
                  </div>
                </div>
              </div>

              {/* Orders Table Content */}
              <div className="bg-white/95 backdrop-blur-md rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#eff4ff] border-b border-gray-200/80 text-[#3d4a3d]">
                        <th className="px-4 py-3.5 font-bold whitespace-nowrap">Order ID</th>
                        <th className="px-4 py-3.5 font-bold whitespace-nowrap">Customer Name</th>
                        <th className="px-4 py-3.5 font-bold whitespace-nowrap">Items</th>
                        <th className="px-4 py-3.5 font-bold whitespace-nowrap">Total Amount</th>
                        <th className="px-4 py-3.5 font-bold whitespace-nowrap">Payment</th>
                        <th className="px-4 py-3.5 font-bold whitespace-nowrap">Status</th>
                        <th className="px-4 py-3.5 font-bold whitespace-nowrap text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orders.map((order, idx) => {
                        const isSelected = selectedOrderModal?.id === order.id;
                        const customerInitials = (order.customerName || 'Customer')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2);

                        // Status Color Mapping
                        const statusStr = String(order.orderStatus).toLowerCase();
                        let statusBg = 'bg-[#ef9900]/15 text-[#855300]';
                        if (statusStr === 'delivered') statusBg = 'bg-[#22c55e]/15 text-[#006e2f]';
                        if (statusStr === 'out_for_delivery') statusBg = 'bg-[#ef9900]/20 text-[#5c3800]';
                        if (statusStr === 'packed' || statusStr === 'confirmed') statusBg = 'bg-[#dee9fc] text-[#121c2a]';

                        return (
                          <tr
                            key={order.id}
                            className={`hover:bg-gray-50/80 transition-colors group ${
                              isSelected ? 'bg-emerald-50/40' : idx % 2 === 1 ? 'bg-[#f8f9ff]' : ''
                            }`}
                          >
                            <td className="px-4 py-3.5 font-bold text-[#121c2a] whitespace-nowrap">
                              {order.orderNumber}
                            </td>

                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#acf847] text-[#102000] flex items-center justify-center font-bold text-xs shadow-xs">
                                  {customerInitials}
                                </div>
                                <span className="font-semibold text-[#121c2a]">{order.customerName || 'Customer'}</span>
                              </div>
                            </td>

                            <td className="px-4 py-3.5 text-[#3d4a3d] whitespace-nowrap">
                              {order.items?.length || 3} items
                            </td>

                            <td className="px-4 py-3.5 whitespace-nowrap font-bold text-[#121c2a] text-sm">
                              ₹{order.total}
                            </td>

                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e6eeff] text-[#121c2a] font-semibold text-[11px] border border-gray-200">
                                <span className="material-symbols-outlined text-sm text-[#006e2f]">
                                  {order.paymentMethod === 'cod' ? 'money' : 'qr_code_scanner'}
                                </span>
                                {order.paymentMethod.toUpperCase()}
                              </span>
                            </td>

                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${statusBg}`}
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                <span className="capitalize">{order.orderStatus.replace(/_/g, ' ')}</span>
                              </span>
                            </td>

                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedOrderModal(order)}
                                  className="p-1.5 text-gray-500 hover:text-[#006e2f] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                  title="View Details"
                                >
                                  <span className="material-symbols-outlined text-lg">visibility</span>
                                </button>
                                {order.orderStatus === 'READY_FOR_PICKUP' && (
                                  <button
                                    onClick={() => {
                                      const eligiblePartners = deliveryPartners.filter(p => p.currentStatus === 'online');
                                      if (eligiblePartners.length > 0) {
                                        assignDeliveryPartner(order.id, eligiblePartners[0].id);
                                        showToast(`Assigned ${eligiblePartners[0].name}!`, 'success');
                                      } else {
                                        showToast('No online riders!', 'error');
                                      }
                                    }}
                                    className="bg-[#006e2f] text-white text-[10px] font-bold px-2.5 py-1 rounded-lg hover:bg-[#005c26] transition-colors cursor-pointer"
                                  >
                                    Assign Partner
                                  </button>
                                )}
                                {['ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_STORE', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER'].includes(order.orderStatus) && (
                                  <button
                                    onClick={() => window.open(`/orders/${order.id}/track`, '_blank')}
                                    className="bg-purple-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg hover:bg-purple-700 transition-colors cursor-pointer"
                                  >
                                    Track Rider
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-between text-xs text-[#3d4a3d]">
                  <div>
                    Showing <span className="font-bold text-[#121c2a]">1</span> to{' '}
                    <span className="font-bold text-[#121c2a]">{orders.length}</span> of{' '}
                    <span className="font-bold text-[#121c2a]">{orders.length}</span> entries
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      disabled
                      className="p-1 border border-gray-200 rounded text-gray-400 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-base">chevron_left</span>
                    </button>
                    <button className="px-3 py-1 bg-[#006e2f] text-white rounded font-bold">1</button>
                    <button className="p-1 border border-gray-200 rounded hover:bg-gray-50 text-gray-600">
                      <span className="material-symbols-outlined text-base">chevron_right</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ── TAB 6: CUSTOMER PII ── */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <h3 className="font-black text-slate-900 text-lg">Registered Customers</h3>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-black text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Phone</th>
                      <th className="p-4">Role</th>
                      <th className="p-4 text-right">Saved Addresses</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-900">Aniket Yadav</td>
                      <td className="p-4 text-slate-600 font-mono">+91 98765 43210</td>
                      <td className="p-4"><span className="bg-slate-100 border border-slate-200 text-black px-2 py-0.5 rounded font-bold">Admin</span></td>
                      <td className="p-4 text-right text-slate-600">{addresses.length} Addresses</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB: BROADCAST & NOTIFICATIONS ENGINE (Admin Central Console) ── */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              {/* Header Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block uppercase">Operational Alerts</span>
                    <strong className="text-2xl font-black text-slate-900 mt-1 block">
                      {notifications.filter((n) => n.recipientType === 'admin').length}
                    </strong>
                    <span className="text-[10px] text-emerald-600 font-bold">Real-time sync</span>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block uppercase">Campaigns Broadcasted</span>
                    <strong className="text-2xl font-black text-slate-900 mt-1 block">
                      {campaigns.length}
                    </strong>
                    <span className="text-[10px] text-slate-500 font-bold">Target: All Customers</span>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Send className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block uppercase">FCM Push Delivery</span>
                    <strong className="text-2xl font-black text-emerald-600 mt-1 block">Active</strong>
                    <span className="text-[10px] text-slate-500 font-bold">Web Push &amp; In-App Engine</span>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Radio className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Main Split View: Broadcast Form (Left) & Live Feed (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left: Create Notification / Campaign Broadcast Form */}
                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-2xs space-y-4">
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        Create Promotional Broadcast
                      </h3>
                      <p className="text-xs text-slate-500">Send push notifications to customers with offers or announcements</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[10px] uppercase">
                      Admin FCM
                    </span>
                  </div>

                  <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 mb-1 block">Notification Title *</label>
                      <input
                        type="text"
                        placeholder="e.g. 🎉 20% OFF on Groceries Above ₹499"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-bold focus:outline-none focus:border-slate-900"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 mb-1 block">Message Body *</label>
                      <textarea
                        rows={3}
                        placeholder="e.g. Get flat 20% instant discount on fresh staples and snacks! Use code: GROCERY20. Valid today only."
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-slate-900 resize-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 mb-1 block">Target Audience</label>
                        <select
                          value={broadcastAudience}
                          onChange={(e) => setBroadcastAudience(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-bold focus:outline-none focus:border-slate-900"
                        >
                          <option value="all">All Registered Customers</option>
                          <option value="new_users">New Users (1st Order)</option>
                          <option value="returning">Returning Users (Active)</option>
                          <option value="selected">Selected VIP Users</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 mb-1 block">Coupon Code (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. GROCERY20"
                          value={broadcastCoupon}
                          onChange={(e) => setBroadcastCoupon(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-mono font-bold focus:outline-none focus:border-slate-900"
                        >
                        </input>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 mb-1 block">Deep Link Target</label>
                        <input
                          type="text"
                          placeholder="e.g. /offers, /category/fruits-vegetables"
                          value={broadcastDeepLink}
                          onChange={(e) => setBroadcastDeepLink(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 mb-1 block">Banner Image URL (Optional)</label>
                        <input
                          type="url"
                          placeholder="https://images.unsplash.com/..."
                          value={broadcastImage}
                          onChange={(e) => setBroadcastImage(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isBroadcasting}
                      className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isBroadcasting ? 'Broadcasting via FCM...' : 'Broadcast Notification Now'}</span>
                    </button>
                  </form>
                </div>

                {/* Right: Live Business & Operational Events Feed */}
                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-2xs flex flex-col space-y-4">
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-emerald-600" />
                        Live Business Events Feed
                      </h3>
                      <p className="text-xs text-slate-500">Real-time alerts for orders, stock, payments &amp; partners</p>
                    </div>

                    {notifications.filter((n) => n.recipientType === 'admin' && !n.isRead).length > 0 && (
                      <button
                        onClick={() => markAllNotificationsRead('admin')}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Clear all</span>
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[380px] space-y-3 pr-1">
                    {notifications.filter((n) => n.recipientType === 'admin').length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
                        <p className="font-bold text-sm text-slate-700">All systems clear</p>
                        <p className="text-xs text-slate-400">No operational alerts or inventory warnings.</p>
                      </div>
                    ) : (
                      notifications
                        .filter((n) => n.recipientType === 'admin')
                        .map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => {
                              if (!notif.isRead) markNotificationRead(notif.id);
                              if (notif.deepLink) router.push(notif.deepLink);
                            }}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                              !notif.isRead
                                ? 'bg-amber-50/40 border-amber-300 ring-2 ring-amber-500/10'
                                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-bold text-xs text-slate-900">{notif.title}</h4>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>

              {/* Sent Broadcasts History Table */}
              {campaigns.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xs space-y-4">
                  <h3 className="font-black text-slate-900 text-base">Broadcast Campaigns History</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-black text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="p-3">Campaign Title</th>
                          <th className="p-3">Audience</th>
                          <th className="p-3">Coupon Code</th>
                          <th className="p-3">Sent Count</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {campaigns.map((camp) => (
                          <tr key={camp.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{camp.title}</td>
                            <td className="p-3 capitalize text-slate-600">{camp.targetAudience.replace('_', ' ')}</td>
                            <td className="p-3 font-mono font-bold text-amber-800">{camp.couponCode || '—'}</td>
                            <td className="p-3 font-bold text-slate-700">{camp.sentCount || 1} users</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                                {camp.status}
                              </span>
                            </td>
                            <td className="p-3 text-right text-slate-500">
                              {new Date(camp.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 7: AUDIT LOGS ── */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              <h3 className="font-black text-slate-900 text-lg">Security & System Audit Logs</h3>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div>
                        <span className="font-bold text-slate-900 block">{log.action}</span>
                        <span className="text-slate-500">{log.userName} • {log.ipAddress}</span>
                      </div>
                      <span className="text-slate-400 font-mono">{new Date(log.createdAt ?? log.timestamp ?? Date.now()).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: INVOICES MANAGEMENT ── */}
          {activeTab === 'invoices' && (
            <InvoicesManagementView />
          )}

          {/* ── TAB: INVOICE SETTINGS ── */}
          {activeTab === 'invoice-settings' && (
            <InvoiceSettingsView />
          )}

          {/* ── TAB: PAYMENTS & SETTLEMENTS ── */}
          {activeTab === 'payments' && (
            <PaymentsAndSettlementView />
          )}

          {/* ── TAB: FESTIVAL CAMPAIGNS & AI TEMPLATES CMS ── */}
          {activeTab === 'festivals' && (
            <FestivalCampaignsCMS />
          )}

        </main>
      </div>

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-900 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base flex items-center gap-2 text-slate-900">
                <Plus className="w-5 h-5 text-black" />
                Add New Product to Inventory
              </h3>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Product Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Fresh Paneer 200g"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-black"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">Category *</label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-black"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">Unit / Weight *</label>
                  <input
                    type="text"
                    placeholder="e.g. 500g, 1L, Pack of 6"
                    value={newProdUnit}
                    onChange={(e) => setNewProdUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-black"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">Selling Price (₹) *</label>
                  <input
                    type="number"
                    placeholder="27"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none focus:border-black"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">MRP (₹)</label>
                  <input
                    type="number"
                    placeholder="30"
                    value={newProdMrp}
                    onChange={(e) => setNewProdMrp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Product Description *</label>
                <textarea
                  rows={2}
                  placeholder="Enter detailed product description..."
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-black resize-none"
                  required
                />
              </div>

              {/* ── Product Specifications & Details for Customer App View Details ── */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 max-h-[380px] overflow-y-auto">
                <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider block">
                  Product Details & Specifications (Displayed in Customer App)
                </span>

                {/* 1. Highlights & Key Information */}
                <div className="space-y-2 border-b border-slate-200 pb-3">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                    1. Highlights & Key Info
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block">Shelf Life</label>
                      <input
                        type="text"
                        placeholder="e.g. 90 days"
                        value={newProdShelfLife}
                        onChange={(e) => setNewProdShelfLife(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block">Product / Atta Type</label>
                      <input
                        type="text"
                        placeholder="e.g. Sehori Atta"
                        value={newProdProductType}
                        onChange={(e) => setNewProdProductType(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block">Source / Origin</label>
                      <input
                        type="text"
                        placeholder="e.g. Sehore, Madhya Pradesh"
                        value={newProdSource}
                        onChange={(e) => setNewProdSource(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block">Diet Preference</label>
                      <input
                        type="text"
                        placeholder="e.g. High Fiber"
                        value={newProdDietPreference}
                        onChange={(e) => setNewProdDietPreference(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Nutritional Information per 100g */}
                <div className="space-y-2 border-b border-slate-200 pb-3">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                    2. Nutritional Information (Per 100g)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Energy</label>
                      <input
                        type="text"
                        placeholder="343 kcal"
                        value={newProdEnergy}
                        onChange={(e) => setNewProdEnergy(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Protein</label>
                      <input
                        type="text"
                        placeholder="10.5 g"
                        value={newProdProtein}
                        onChange={(e) => setNewProdProtein(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Carbohydrates</label>
                      <input
                        type="text"
                        placeholder="77.1 g"
                        value={newProdCarbs}
                        onChange={(e) => setNewProdCarbs(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Total Sugar</label>
                      <input
                        type="text"
                        placeholder="3.4 g"
                        value={newProdTotalSugar}
                        onChange={(e) => setNewProdTotalSugar(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Added Sugar</label>
                      <input
                        type="text"
                        placeholder="0 g"
                        value={newProdAddedSugar}
                        onChange={(e) => setNewProdAddedSugar(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Total Fat</label>
                      <input
                        type="text"
                        placeholder="1.6 g"
                        value={newProdTotalFat}
                        onChange={(e) => setNewProdTotalFat(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Dietary Fiber</label>
                      <input
                        type="text"
                        placeholder="10.8 g"
                        value={newProdDietaryFiber}
                        onChange={(e) => setNewProdDietaryFiber(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Sodium</label>
                      <input
                        type="text"
                        placeholder="1.7 mg"
                        value={newProdSodium}
                        onChange={(e) => setNewProdSodium(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Info & Compliance Details */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                    3. Features & Legal Info
                  </span>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 mb-1 block">Key Features Text</label>
                    <textarea
                      rows={2}
                      placeholder="Enter detailed key features..."
                      value={newProdKeyFeatures}
                      onChange={(e) => setNewProdKeyFeatures(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block">FSSAI License No.</label>
                      <input
                        type="text"
                        placeholder="10012031000312"
                        value={newProdFssaiLicense}
                        onChange={(e) => setNewProdFssaiLicense(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block">Country of Origin</label>
                      <input
                        type="text"
                        placeholder="India"
                        value={newProdCountryOfOrigin}
                        onChange={(e) => setNewProdCountryOfOrigin(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 mb-1 block">Disclaimer Text</label>
                    <input
                      type="text"
                      placeholder="Every effort is made to maintain accuracy of all information..."
                      value={newProdDisclaimer}
                      onChange={(e) => setNewProdDisclaimer(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                  <span>Product Image</span>
                  <span className="text-[10px] text-emerald-600 font-bold">Upload to Firebase Storage</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={newProdImage}
                    onChange={(e) => setNewProdImage(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-black"
                  />
                  <label className="bg-slate-900 hover:bg-black text-white text-xs font-bold px-3 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-1 shrink-0">
                    <UploadCloud className="w-4 h-4" />
                    <span>{isUploadingImage ? 'Uploading...' : 'Upload File'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleUploadImageFile(e, false)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-slate-700 font-bold border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-black hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-black shadow-sm"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-900 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base flex items-center gap-2 text-slate-900">
                <Edit className="w-5 h-5 text-black" />
                Edit Product: {editingProduct.name}
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Product Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-black"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">Category *</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-black"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">Unit / Weight *</label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-black"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">Selling Price (₹) *</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none focus:border-black"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">MRP (₹)</label>
                  <input
                    type="number"
                    value={editMrp}
                    onChange={(e) => setEditMrp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">Stock Status *</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none focus:border-black"
                  >
                    <option value="active">Active</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Product Description *</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-black resize-none"
                  required
                />
              </div>

              {/* ── Product Specifications & Details for Customer App View Details ── */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 max-h-[380px] overflow-y-auto">
                <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider block">
                  Product Details & Specifications (Displayed in Customer App)
                </span>

                {/* 1. Highlights & Key Information */}
                <div className="space-y-2 border-b border-slate-200 pb-3">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                    1. Highlights & Key Info
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block">Shelf Life</label>
                      <input
                        type="text"
                        placeholder="e.g. 90 days"
                        value={editShelfLife}
                        onChange={(e) => setEditShelfLife(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block">Product / Atta Type</label>
                      <input
                        type="text"
                        placeholder="e.g. Sehori Atta"
                        value={editProductType}
                        onChange={(e) => setEditProductType(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block">Source / Origin</label>
                      <input
                        type="text"
                        placeholder="e.g. Sehore, Madhya Pradesh"
                        value={editSource}
                        onChange={(e) => setEditSource(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block">Diet Preference</label>
                      <input
                        type="text"
                        placeholder="e.g. High Fiber"
                        value={editDietPreference}
                        onChange={(e) => setEditDietPreference(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Nutritional Information per 100g */}
                <div className="space-y-2 border-b border-slate-200 pb-3">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                    2. Nutritional Information (Per 100g)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Energy</label>
                      <input
                        type="text"
                        placeholder="343 kcal"
                        value={editEnergy}
                        onChange={(e) => setEditEnergy(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Protein</label>
                      <input
                        type="text"
                        placeholder="10.5 g"
                        value={editProtein}
                        onChange={(e) => setEditProtein(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Carbohydrates</label>
                      <input
                        type="text"
                        placeholder="77.1 g"
                        value={editCarbs}
                        onChange={(e) => setEditCarbs(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Total Sugar</label>
                      <input
                        type="text"
                        placeholder="3.4 g"
                        value={editTotalSugar}
                        onChange={(e) => setEditTotalSugar(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Added Sugar</label>
                      <input
                        type="text"
                        placeholder="0 g"
                        value={editAddedSugar}
                        onChange={(e) => setEditAddedSugar(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Total Fat</label>
                      <input
                        type="text"
                        placeholder="1.6 g"
                        value={editTotalFat}
                        onChange={(e) => setEditTotalFat(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Dietary Fiber</label>
                      <input
                        type="text"
                        placeholder="10.8 g"
                        value={editDietaryFiber}
                        onChange={(e) => setEditDietaryFiber(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">Sodium</label>
                      <input
                        type="text"
                        placeholder="1.7 mg"
                        value={editSodium}
                        onChange={(e) => setEditSodium(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Info & Compliance Details */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                    3. Features & Legal Info
                  </span>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 mb-1 block">Key Features Text</label>
                    <textarea
                      rows={2}
                      placeholder="Enter detailed key features..."
                      value={editKeyFeatures}
                      onChange={(e) => setEditKeyFeatures(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block">FSSAI License No.</label>
                      <input
                        type="text"
                        placeholder="10012031000312"
                        value={editFssaiLicense}
                        onChange={(e) => setEditFssaiLicense(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block">Country of Origin</label>
                      <input
                        type="text"
                        placeholder="India"
                        value={editCountryOfOrigin}
                        onChange={(e) => setEditCountryOfOrigin(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 mb-1 block">Disclaimer Text</label>
                    <input
                      type="text"
                      placeholder="Every effort is made to maintain accuracy of all information..."
                      value={editDisclaimer}
                      onChange={(e) => setEditDisclaimer(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                  <span>Product Image</span>
                  <span className="text-[10px] text-emerald-600 font-bold">Upload to Firebase Storage</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={editImage}
                    onChange={(e) => setEditImage(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-black"
                  />
                  <label className="bg-slate-900 hover:bg-black text-white text-xs font-bold px-3 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-1 shrink-0">
                    <UploadCloud className="w-4 h-4" />
                    <span>{isUploadingImage ? 'Uploading...' : 'Upload File'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleUploadImageFile(e, true)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-slate-700 font-bold border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-black hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-black shadow-sm"
                >
                  Update Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── MODAL: ADD CATEGORY ── */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-black" />
                <h3 className="font-black text-slate-900 text-base">Add New Category</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Category Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Organic Bakery, Gourmet Cheese"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-bold focus:outline-none focus:border-black"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">URL Slug (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. organic-bakery"
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-bold focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Image URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={newCatImage}
                  onChange={(e) => setNewCatImage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-bold focus:outline-none focus:border-black"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-black hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-black shadow-sm"
                >
                  Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT CATEGORY ── */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-black" />
                <h3 className="font-black text-slate-900 text-base">Edit Category</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCategory} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Category Name *</label>
                <input
                  type="text"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-bold focus:outline-none focus:border-black"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">URL Slug</label>
                <input
                  type="text"
                  value={editCatSlug}
                  onChange={(e) => setEditCatSlug(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-bold focus:outline-none focus:border-black"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Image URL</label>
                <input
                  type="url"
                  value={editCatImage}
                  onChange={(e) => setEditCatImage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-bold focus:outline-none focus:border-black"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={editCatActive}
                    onChange={(e) => setEditCatActive(e.target.checked)}
                    className="w-4 h-4 accent-black rounded"
                  />
                  <span>Active (Visible on Homepage and Header)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-black hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-black shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrderModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-900 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-emerald-600" />
                    Order #{selectedOrderModal.orderNumber}
                  </h3>
                  <span className="bg-black text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase">
                    {selectedOrderModal.orderStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Placed on {new Date(selectedOrderModal.placedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer & Delivery Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Customer Details</span>
                <strong className="text-sm font-bold text-slate-900 block mt-0.5">
                  {selectedOrderModal.customerName || 'Customer'}
                </strong>
                <span className="text-slate-600 font-mono block mt-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {selectedOrderModal.customerPhone || '+91 98765 43210'}
                </span>
                {selectedOrderModal.address && (
                  <span className="text-slate-500 block mt-1 leading-relaxed">
                    📍 {selectedOrderModal.address.addressLine1}, {selectedOrderModal.address.city} - {selectedOrderModal.address.postalCode}
                  </span>
                )}
              </div>

              <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-4">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Fulfillment & Security</span>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-slate-600 font-medium">Delivery OTP:</span>
                  <strong className="font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-bold text-xs">
                    {selectedOrderModal.deliveryOtp}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Payment:</span>
                  <span className="font-bold text-slate-900 capitalize">
                    {selectedOrderModal.paymentMethod.toUpperCase()} ({selectedOrderModal.paymentStatus})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Delivery Partner:</span>
                  <strong className="text-slate-900">{selectedOrderModal.partnerName || 'Unassigned'}</strong>
                </div>
              </div>
            </div>

            {/* Contextual Action Buttons */}
            <div className="space-y-1.5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <label className="text-[11px] font-black text-slate-500 block uppercase tracking-wider">Fulfillment Actions</label>
              <div className="flex flex-wrap gap-2 items-center">
                {selectedOrderModal.orderStatus === 'STOCK_RESERVED' && (
                  <span className="text-xs text-slate-600 font-bold bg-amber-50 text-amber-800 px-3 py-1.5 rounded-xl border border-amber-200">
                     Awaiting Picker Assignment
                  </span>
                )}

                {selectedOrderModal.orderStatus === 'PICKING' && (
                  <span className="text-xs text-slate-600 font-bold bg-blue-50 text-blue-800 px-3 py-1.5 rounded-xl border border-blue-200">
                     Picker is picking items...
                  </span>
                )}

                {selectedOrderModal.orderStatus === 'READY_FOR_PICKUP' && (
                  <button
                    onClick={() => {
                      const eligiblePartners = deliveryPartners.filter(p => p.currentStatus === 'online');
                      if (eligiblePartners.length > 0) {
                        assignDeliveryPartner(selectedOrderModal.id, eligiblePartners[0].id);
                        showToast(`Rider ${eligiblePartners[0].name} assigned successfully!`, 'success');
                      } else {
                        showToast('No online delivery riders available!', 'error');
                      }
                    }}
                    className="bg-[#006e2f] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs hover:bg-[#005c26] transition-colors cursor-pointer"
                  >
                    Assign Delivery Rider
                  </button>
                )}

                {['ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_STORE', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER'].includes(selectedOrderModal.orderStatus) && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        window.open(`/orders/${selectedOrderModal.id}/track`, '_blank');
                      }}
                      className="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs hover:bg-purple-700 transition-colors cursor-pointer"
                    >
                      Track Rider
                    </button>
                    <a
                      href={`tel:${selectedOrderModal.partnerPhone || '+919876543210'}`}
                      className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Contact Rider
                    </a>
                  </div>
                )}

                {!['CANCELLED', 'DELIVERED', 'COMPLETED', 'REFUNDED'].includes(selectedOrderModal.orderStatus) && (
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to cancel this order?')) {
                        updateOrderStatus(selectedOrderModal.id, 'CANCELLED');
                        setSelectedOrderModal({ ...selectedOrderModal, orderStatus: 'CANCELLED' });
                        showToast('Order cancelled.', 'success');
                      }
                    }}
                    className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel Order
                  </button>
                )}

                {selectedOrderModal.orderStatus === 'COMPLETED' && (
                  <button
                    onClick={() => {
                      if (confirm('Initiate a refund for this order?')) {
                        updateOrderStatus(selectedOrderModal.id, 'REFUNDED');
                        setSelectedOrderModal({ ...selectedOrderModal, orderStatus: 'REFUNDED' });
                        showToast('Order marked as Refunded.', 'success');
                      }
                    }}
                    className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Refund Order
                  </button>
                )}

                <div className="flex-1" />

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await downloadInvoicePDF(selectedOrderModal.id);
                      if (res.success) {
                        showToast(`Invoice downloaded for Order #${selectedOrderModal.orderNumber}`, 'success');
                      } else {
                        showToast('Failed to download invoice', 'error');
                      }
                    } catch (err) {
                      showToast('Failed to download invoice', 'error');
                    }
                  }}
                  className="bg-slate-900 hover:bg-black text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Download Invoice</span>
                </button>

                <button
                  onClick={() => {
                    const reason = prompt('EMERGENCY OVERRIDE REQUIRED\n\nPlease enter the reason for this manual override:');
                    if (reason && reason.trim()) {
                      const newStatus = prompt('Enter exact new status:\nCREATED, PAYMENT_PENDING, CONFIRMED, STOCK_RESERVED, PICKING, PICKED, PACKING, READY_FOR_PICKUP, ASSIGNED, ACCEPTED, PICKED_UP, OUT_FOR_DELIVERY, ARRIVED_AT_CUSTOMER, DELIVERED, COMPLETED, CANCELLED');
                      if (newStatus && newStatus.trim()) {
                        updateOrderStatus(selectedOrderModal.id, newStatus.trim() as any);
                        setSelectedOrderModal({ ...selectedOrderModal, orderStatus: newStatus.trim() as OrderStatus });
                        addAuditLog(`EMERGENCY_OVERRIDE: ${reason}`, 'Order', selectedOrderModal.id);
                        showToast(`Emergency override successful to ${newStatus}`, 'success');
                      }
                    }
                  }}
                  className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
                  title="Force status change manually"
                >
                  ⚠️ Emergency Override
                </button>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-600 block uppercase">
                Order Items ({selectedOrderModal.items.length})
              </label>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                {selectedOrderModal.items.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between bg-white text-xs">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.product.thumbnail}
                        alt={item.product.name}
                        className="w-10 h-10 object-contain rounded-lg border border-slate-100 p-0.5 bg-slate-50"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block">{item.product.name}</span>
                        <span className="text-slate-400 text-[11px]">{item.product.unit} • Qty: {item.quantity}</span>
                      </div>
                    </div>
                    <span className="font-bold text-slate-900 font-mono">
                      ₹{item.quantity * item.unitPrice}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bill Summary */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono">₹{selectedOrderModal.subtotal}</span>
              </div>
              {selectedOrderModal.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Discount</span>
                  <span className="font-mono">-₹{selectedOrderModal.discount}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Delivery Charge</span>
                <span className="font-mono">{selectedOrderModal.deliveryCharge === 0 ? 'FREE' : `₹${selectedOrderModal.deliveryCharge}`}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                <span>Total Paid / Payable</span>
                <span className="font-mono text-emerald-700">₹{selectedOrderModal.total}</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedOrderModal(null)}
                className="bg-slate-100 hover:bg-slate-200 px-5 py-2.5 rounded-xl text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product 360 Modal */}
      <Product360Modal
        product={selectedProductFor360}
        isOpen={Boolean(selectedProductFor360)}
        onClose={() => setSelectedProductFor360(null)}
      />

      {/* Add Product with Barcode & PK ID Modal */}
      <AddProductWithBarcodeModal
        isOpen={showBarcodeAddModal}
        onClose={() => setShowBarcodeAddModal(false)}
      />

      {/* Bulk CSV Product Upload & Scanner Modal */}
      <BulkCSVUploadModal
        isOpen={showBulkCSVModal}
        onClose={() => setShowBulkCSVModal(false)}
      />
      <NotificationSimulator />
    </div>
  );
}

export default function UnifiedAdminDashboardPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-xs text-gray-500">Loading Dashboard...</div>}>
      <AdminDashboardContent />
    </Suspense>
  );
}
