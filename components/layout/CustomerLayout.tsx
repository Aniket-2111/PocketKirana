'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store, Search, ShoppingBag, Heart, User } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Header } from '@/components/customer/Header';
import { CartDrawer } from '@/components/customer/CartDrawer';
import { AuthModal } from '@/components/customer/AuthModal';
import { ToastContainer } from '@/components/ui/Toast';
import { NotificationSimulator } from '@/components/common/NotificationSimulator';

interface CustomerLayoutProps {
  children: React.ReactNode;
}

const mobileNav = [
  { icon: Store, label: 'Shop', href: '/' },
  { icon: Search, label: 'Explore', href: '/categories' },
  { icon: ShoppingBag, label: 'Cart', href: '#cart' },
  { icon: Heart, label: 'Favourite', href: '/wishlist' },
  { icon: User, label: 'Account', href: '/profile' },
];

export const CustomerLayout: React.FC<CustomerLayoutProps> = ({ children }) => {
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const { cart, initializeFirebaseSync } = useAppStore();
  const pathname = usePathname();
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  React.useEffect(() => {
    initializeFirebaseSync();
  }, [initializeFirebaseSync]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header onOpenCart={() => setCartOpen(true)} onOpenAuth={() => setAuthOpen(true)} />

      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation (Matching Mockups 1-5) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200/80 md:hidden shadow-lg">
        <div className="flex items-stretch justify-around h-15 py-1">
          {mobileNav.map(({ icon: Icon, label, href }) => {
            const isCart = href === '#cart';
            const isActive = !isCart && (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href));

            if (isCart) {
              return (
                <button
                  key="cart"
                  onClick={() => setCartOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 px-3 flex-1 relative"
                >
                  <div className="relative">
                    <Icon className="w-5 h-5 text-gray-500" />
                    {totalItems > 0 && (
                      <span className="absolute -top-1.5 -right-2 bg-[#53B175] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-2xs">
                        {totalItems > 9 ? '9+' : totalItems}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-gray-500">{label}</span>
                </button>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center gap-0.5 px-3 flex-1"
              >
                <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-[#53B175]' : 'text-gray-500'}`} />
                <span className={`text-[10px] transition-colors ${isActive ? 'text-[#53B175] font-black' : 'text-gray-500 font-bold'}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} onOpenAuth={() => { setCartOpen(false); setAuthOpen(true); }} />

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      <ToastContainer />
      <NotificationSimulator />
    </div>
  );
};
