'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store, LayoutGrid, ClipboardList, ShoppingBag, User } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Header } from '@/components/customer/Header';
import { CartDrawer } from '@/components/customer/CartDrawer';
import { AuthModal } from '@/components/customer/AuthModal';
import { ToastContainer } from '@/components/ui/Toast';
import { NotificationSimulator } from '@/components/common/NotificationSimulator';
import { Footer } from '@/components/layout/Footer';

interface CustomerLayoutProps {
  children: React.ReactNode;
}

const mobileNav = [
  { icon: Store, label: 'Shop', href: '/' },
  { icon: LayoutGrid, label: 'Categories', href: '/categories' },
  { icon: ClipboardList, label: 'Orders', href: '/orders' },
  { icon: ShoppingBag, label: 'Cart', href: '#cart' },
  { icon: User, label: 'Account', href: '/profile' },
];

export const CustomerLayout: React.FC<CustomerLayoutProps> = ({ children }) => {
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { cart = [], initializeFirebaseSync } = useAppStore();
  const pathname = usePathname();
  const totalItems = (cart || []).reduce((s, i) => s + i.quantity, 0);

  React.useEffect(() => {
    setMounted(true);
    initializeFirebaseSync();
  }, [initializeFirebaseSync]);

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground selection:bg-emerald-100 dark:selection:bg-emerald-950 selection:text-emerald-900 dark:selection:text-emerald-100 transition-colors duration-200">
      <Header onOpenCart={() => setCartOpen(true)} onOpenAuth={() => setAuthOpen(true)} />

      <main className="flex-1 pb-24 md:pb-8">
        {children}
      </main>

      <Footer />

      {/* ── Mobile Bottom Navigation Bar (Fixed 5-Tab Quick-Commerce Navigation) ── */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-[#263241] md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-safe transition-colors duration-200"
      >
        <div className="flex items-stretch justify-around h-16 max-w-lg mx-auto px-1">
          {mobileNav.map(({ icon: Icon, label, href }) => {
            const isCart = href === '#cart';
            const isActive =
              !isCart &&
              (href === '/'
                ? pathname === '/'
                : pathname === href || (href !== '/' && pathname.startsWith(href)));

            if (isCart) {
              return (
                <button
                  key="cart-tab"
                  type="button"
                  onClick={() => setCartOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 py-1 px-2 flex-1 relative active:scale-95 transition-transform cursor-pointer"
                  aria-label={`Shopping Cart with ${totalItems} items`}
                >
                  <div className="relative flex items-center justify-center">
                    <Icon className="w-5 h-5 text-slate-600 dark:text-slate-300 stroke-[2]" />
                    {mounted && totalItems > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 bg-[#E65100] text-white text-[9px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-white dark:border-[#111827] shadow-xs animate-in zoom-in-50 duration-150">
                        {totalItems > 99 ? '99+' : totalItems}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-none">
                    {label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-col items-center justify-center gap-1 py-1 px-2 flex-1 transition-colors cursor-pointer ${isActive ? 'text-[#0B8F5A] dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#0B8F5A] dark:bg-emerald-400 rounded-b-full shadow-xs" />
                )}
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-5 h-5 transition-transform ${isActive ? 'stroke-[2.5] scale-105' : 'stroke-[1.8]'
                      }`}
                  />
                </div>
                <span
                  className={`text-[10px] leading-none transition-all ${isActive ? 'font-black tracking-tight text-[#075C3C] dark:text-emerald-400' : 'font-semibold'
                    }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Cart Drawer & Auth Modal */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        onOpenAuth={() => {
          setCartOpen(false);
          setAuthOpen(true);
        }}
      />

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      <ToastContainer />
      <NotificationSimulator />
    </div>
  );
};
