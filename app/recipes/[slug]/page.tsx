'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { RECIPES } from '@/lib/recipes';
import { ProductCard } from '@/components/customer/ProductCard';
import { Clock, Users, ChefHat, CheckCircle, Lightbulb, ShoppingBag, ChevronLeft } from 'lucide-react';

export default function RecipeDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { products } = useAppStore();

  const recipe = RECIPES.find((r) => r.slug === slug);

  if (!recipe) {
    return (
      <>
        <RoleSwitcher />
        <CustomerLayout>
          <div className="max-w-3xl mx-auto px-4 py-20 text-center">
            <h1 className="text-2xl font-black text-gray-900 mb-3">Recipe Not Found</h1>
            <Link href="/recipes" className="text-emerald-600 font-semibold hover:underline">← Back to Recipes</Link>
          </div>
        </CustomerLayout>
      </>
    );
  }

  // Map ingredients to products where slugs are provided
  const linkedProducts = recipe.ingredients
    .filter((ing) => ing.productSlug)
    .map((ing) => products.find((p) => p.slug === ing.productSlug))
    .filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-8 space-y-8">
          <Breadcrumb
            items={[{ label: 'Recipes', href: '/recipes' }, { label: recipe.title }]}
          />

          {/* Hero Image */}
          <div className="relative rounded-3xl overflow-hidden aspect-[16/8] shadow-lg">
            <img
              src={recipe.image}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6 text-white">
              <span className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-full mb-2 inline-block ${
                recipe.difficulty === 'Easy'
                  ? 'bg-emerald-500'
                  : recipe.difficulty === 'Medium'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}>
                {recipe.difficulty}
              </span>
              <h1 className="text-3xl font-black leading-tight">{recipe.title}</h1>
              <p className="text-sm text-gray-200 mt-1">{recipe.subtitle}</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Clock, label: 'Prep Time', value: recipe.prepTime },
              { icon: Clock, label: 'Cook Time', value: recipe.cookTime },
              { icon: Users, label: 'Servings', value: `${recipe.servings} people` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-2xl p-4 text-center shadow-sm">
                <Icon className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-black text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Ingredients */}
            <div className="md:col-span-1">
              <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm sticky top-24">
                <h2 className="text-base font-black text-gray-900 mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                  Ingredients
                </h2>
                <ul className="space-y-2.5">
                  {recipe.ingredients.map((ing, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-2 text-sm">
                      <span className="font-semibold text-gray-700 flex-1 leading-snug">{ing.item}</span>
                      <span className="text-gray-500 text-xs shrink-0 mt-0.5">{ing.qty}</span>
                    </li>
                  ))}
                </ul>

                {recipe.tip && (
                  <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">{recipe.tip}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Steps */}
            <div className="md:col-span-2">
              <h2 className="text-base font-black text-gray-900 mb-4 flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-emerald-600" />
                Instructions
              </h2>
              <div className="space-y-4">
                {recipe.steps.map((step, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                      <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Buy Ingredients */}
          {linkedProducts.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6">
              <h2 className="text-base font-black text-gray-900 mb-2 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                Shop Ingredients from PocketKirana
              </h2>
              <p className="text-xs text-gray-500 mb-4">All delivered in 8 minutes</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {linkedProducts.map((prod) => (
                  <ProductCard key={prod.id} product={prod} />
                ))}
              </div>
            </div>
          )}

          {/* More Recipes */}
          <div>
            <h2 className="text-base font-black text-gray-900 mb-4">More Recipes</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {RECIPES.filter((r) => r.slug !== slug).slice(0, 3).map((r) => (
                <Link
                  key={r.id}
                  href={`/recipes/${r.slug}`}
                  className="group bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  <div className="h-32 overflow-hidden">
                    <img src={r.image} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="p-3">
                    <h3 className="text-xs font-black text-gray-900 group-hover:text-emerald-700 transition-colors">{r.title}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">{r.prepTime} prep · Serves {r.servings}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </CustomerLayout>
    </>
  );
}
