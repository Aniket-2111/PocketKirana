'use client';

import React, { useState } from 'react';
import { Product } from '@/types';
import { useAppStore } from '@/lib/store';
import { X, Star, Heart, Plus, Minus, ShieldCheck, Truck, RefreshCw, MessageSquare } from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose }) => {
  const { cart, addToCart, updateQuantity, wishlist, toggleWishlist, reviews, addReview } = useAppStore();
  const [newReviewText, setNewReviewText] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  if (!product) return null;

  const cartItem = cart.find((i) => i.productId === product.id);
  const qty = cartItem ? cartItem.quantity : 0;
  const isWishlisted = wishlist.includes(product.id);
  const discountPercent = Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100);

  const productReviews = reviews.filter((r) => r.productId === product.id);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewText.trim()) return;
    addReview(product.id, 'ord-1001', newRating, newReviewText.trim());
    setNewReviewText('');
    setReviewSubmitted(true);
    setTimeout(() => setReviewSubmitted(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-modal max-w-2xl w-full shadow-modal overflow-hidden relative my-8 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-gray-100 hover:bg-gray-200 p-2 rounded-full text-gray-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Image side */}
          <div className="bg-gray-50 p-6 flex flex-col items-center justify-center relative border-r border-gray-100">
            {discountPercent > 0 && (
              <span className="absolute top-4 left-4 bg-amber-500 text-white font-bold text-xs px-2.5 py-1 rounded-full shadow-sm">
                {discountPercent}% OFF
              </span>
            )}
            <img
              src={product.thumbnail}
              alt={product.name}
              className="w-full max-h-64 object-contain rounded-xl"
            />
            <div className="flex items-center gap-2 mt-4 text-xs text-gray-500 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>100% Fresh & Authentic Guarantee</span>
            </div>
          </div>

          {/* Details side */}
          <div className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {product.unit}
                </span>
                <div className="flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-bold text-xs">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>{product.rating} ({product.reviewsCount} reviews)</span>
                </div>
              </div>

              <h2 className="font-black text-gray-900 text-xl leading-snug mt-1">{product.name}</h2>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">{product.description}</p>

              {/* Price block */}
              <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-gray-900">₹{product.sellingPrice}</span>
                  {product.mrp > product.sellingPrice && (
                    <span className="text-sm text-gray-400 line-through">₹{product.mrp}</span>
                  )}
                </div>
                <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">
                  Save ₹{product.mrp - product.sellingPrice} on this item
                </span>
              </div>

              {/* Badges */}
              <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-gray-600">
                <div className="flex items-center gap-1.5 p-2 bg-emerald-50/50 rounded-lg text-emerald-900">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span>30-Min Express Delivery</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 bg-blue-50/50 rounded-lg text-blue-900">
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                  <span>Easy Doorstep Replacement</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-3">
              <button
                onClick={() => toggleWishlist(product.id)}
                className={`p-3 rounded-btn border transition-colors ${
                  isWishlisted
                    ? 'border-red-300 bg-red-50 text-red-500'
                    : 'border-gray-200 text-gray-400 hover:text-red-500'
                }`}
                title="Wishlist"
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
              </button>

              {qty === 0 ? (
                <button
                  onClick={() => addToCart(product, 1)}
                  disabled={product.status === 'out_of_stock'}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3 rounded-btn shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add to Cart</span>
                </button>
              ) : (
                <div className="flex-1 flex items-center justify-between bg-emerald-600 text-white rounded-btn p-1 shadow-md font-bold text-sm">
                  <button
                    onClick={() => updateQuantity(product.id, qty - 1)}
                    className="px-4 py-2 hover:bg-emerald-700 rounded-lg transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span>{qty} in Cart</span>
                  <button
                    onClick={() => updateQuantity(product.id, qty + 1)}
                    className="px-4 py-2 hover:bg-emerald-700 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <div className="p-6 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-gray-900">Customer Ratings & Reviews</h3>
          </div>

          <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
            {productReviews.length > 0 ? (
              productReviews.map((rev) => (
                <div key={rev.id} className="p-2.5 bg-white rounded-xl border border-gray-200 text-xs">
                  <div className="flex items-center justify-between font-bold text-gray-900">
                    <span>{rev.userName}</span>
                    <div className="flex items-center gap-0.5 text-amber-500">
                      <Star className="w-3 h-3 fill-current" />
                      <span>{rev.rating}</span>
                    </div>
                  </div>
                  <p className="text-gray-600 mt-1">{rev.review}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 italic">No reviews yet for this product. Be the first to write one!</p>
            )}
          </div>

          {/* Write Review Form */}
          <form onSubmit={handleSubmitReview} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700">Your Rating:</span>
              <div className="flex gap-1 text-amber-400 cursor-pointer">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    onClick={() => setNewRating(star)}
                    className={`w-4 h-4 ${star <= newRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Write your review experience..."
                value={newReviewText}
                onChange={(e) => setNewReviewText(e.target.value)}
                className="flex-1 text-xs bg-white border border-gray-300 rounded-btn px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-btn transition-colors"
              >
                Submit
              </button>
            </div>
            {reviewSubmitted && (
              <p className="text-xs text-emerald-600 font-semibold">Thank you! Your review has been published.</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
