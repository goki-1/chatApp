"use client";

import React, { useState, useEffect } from "react";

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  userDbId: number | null;
  onCheckout: (creditsTier: 50 | 100 | 200, currencyCode: string) => Promise<void>;
  isLoading: boolean;
}

export function CreditModal({ isOpen, onClose, userDbId, onCheckout, isLoading }: CreditModalProps) {
  const [selectedTier, setSelectedTier] = useState<50 | 100 | 200>(100);
  const [currencySymbol, setCurrencySymbol] = useState("CAD $");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [currencyCode, setCurrencyCode] = useState("CAD");

  useEffect(() => {
    // Basic local currency detection based on user timezone / browser locale
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const locale = navigator.language || "en-CA";

      if (timeZone.includes("Calcutta") || timeZone.includes("Kolkata") || timeZone.includes("Asia/Kolkata")) {
        setCurrencySymbol("₹");
        setCurrencyCode("INR");
        setExchangeRate(67.5);
      } else if (timeZone.includes("America/New_York") || timeZone.includes("America/Los_Angeles") || timeZone.includes("America/Chicago")) {
        setCurrencySymbol("$");
        setCurrencyCode("USD");
        setExchangeRate(0.74);
      } else if (timeZone.includes("Europe/London")) {
        setCurrencySymbol("£");
        setCurrencyCode("GBP");
        setExchangeRate(0.58);
      } else if (timeZone.includes("Europe/Paris") || timeZone.includes("Europe/Berlin") || timeZone.includes("Europe/Rome")) {
        setCurrencySymbol("€");
        setCurrencyCode("EUR");
        setExchangeRate(0.68);
      } else {
        setCurrencySymbol("CAD $");
        setCurrencyCode("CAD");
        setExchangeRate(1.0);
      }
    } catch {
      setCurrencySymbol("CAD $");
      setCurrencyCode("CAD");
      setExchangeRate(1.0);
    }
  }, []);

  if (!isOpen) return null;

  const tiers = [
    {
      credits: 50 as const,
      cadPrice: 3,
      badge: null,
      description: "Great for quick catch-ups",
    },
    {
      credits: 100 as const,
      cadPrice: 5,
      badge: "MOST POPULAR",
      description: "Save 16% — Best for active chat",
    },
    {
      credits: 200 as const,
      cadPrice: 8,
      badge: "BEST VALUE",
      description: "Save 33% — Maximum savings",
    },
  ];

  const formatPrice = (cadPrice: number, credits: number) => {
    if (currencyCode === "INR") {
      if (credits === 50) return "₹200";
      if (credits === 100) return "₹300";
      if (credits === 200) return "₹500";
      return `₹${Math.round(cadPrice * exchangeRate)}`;
    }
    if (currencyCode === "CAD") {
      return `$${cadPrice.toFixed(2)} CAD`;
    }
    const converted = (cadPrice * exchangeRate).toFixed(2);
    return `${currencySymbol}${converted} ${currencyCode}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#121212] border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal Title */}
        <div className="text-center mb-6">
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#8f6d3d] dark:text-[#c4a06d] font-semibold">
            Refill Balance
          </span>
          <h2 className="text-2xl font-serif font-medium text-stone-950 dark:text-stone-50 mt-1">
            Choose a Credit Pack
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Unlock uninterrupted access with Harnoor. Auto-converted on Stripe Checkout.
          </p>
        </div>

        {/* Tier Options */}
        <div className="space-y-3 mb-6">
          {tiers.map((t) => {
            const isSelected = selectedTier === t.credits;
            return (
              <div
                key={t.credits}
                onClick={() => setSelectedTier(t.credits)}
                className={`relative flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "border-[#8f6d3d] bg-[#8f6d3d]/5 dark:bg-[#8f6d3d]/10 shadow-sm"
                    : "border-stone-200 dark:border-stone-850 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50/50 dark:bg-stone-900/30"
                }`}
              >
                {t.badge && (
                  <span className={`absolute -top-2.5 right-4 text-[9px] font-semibold tracking-wider px-2 py-0.5 rounded-full ${
                    t.badge === "MOST POPULAR" 
                      ? "bg-[#8f6d3d] text-white" 
                      : "bg-emerald-600 text-white"
                  }`}>
                    {t.badge}
                  </span>
                )}
                
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    isSelected ? "border-[#8f6d3d] bg-[#8f6d3d]" : "border-stone-300 dark:border-stone-700"
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                      {t.credits} Credits
                    </span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">
                      {t.description}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-bold text-sm text-stone-950 dark:text-stone-50">
                    {formatPrice(t.cadPrice, t.credits)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <button
          disabled={isLoading || !userDbId}
          onClick={() => onCheckout(selectedTier, currencyCode)}
          className="w-full py-3.5 px-6 rounded-full bg-[#8f6d3d] hover:bg-[#7a5c32] text-white font-medium text-sm tracking-wide transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Redirecting to Stripe...</span>
            </>
          ) : (
            <span>Proceed to Payment</span>
          )}
        </button>

        <p className="text-[10px] text-center text-stone-400 dark:text-stone-600 mt-4">
          Secured by Stripe Encrypted 256-Bit SSL Payment
        </p>
      </div>
    </div>
  );
}
