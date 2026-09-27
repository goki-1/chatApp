"use client";

import React, { useState, useEffect } from "react";

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  userDbId: number | null;
  onCheckout: (creditsTier: 50 | 100 | 200, currencyCode: string) => Promise<void>;
  onDodoCheckout: (creditsTier: 50 | 100 | 200) => Promise<void>;
  isLoading: boolean;
  errorText?: string | null;
}

export function CreditModal({
  isOpen,
  onClose,
  userDbId,
  onCheckout,
  onDodoCheckout,
  isLoading,
  errorText,
}: CreditModalProps) {
  const [selectedTier, setSelectedTier] = useState<50 | 100 | 200>(100);
  const [currencyCode, setCurrencyCode] = useState<"INR" | "USD">("USD");
  const [paymentProvider, setPaymentProvider] = useState<"dodo" | "stripe" | null>(null);

  useEffect(() => {
    // Detect Indian timezone/locale vs global USD
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (
        timeZone.includes("Calcutta") ||
        timeZone.includes("Kolkata") ||
        timeZone.includes("Asia/Kolkata") ||
        timeZone.includes("India") ||
        navigator.languages?.some((l) => l.toLowerCase().includes("-in"))
      ) {
        setCurrencyCode("INR");
      } else {
        setCurrencyCode("USD");
      }
    } catch {
      setCurrencyCode("USD");
    }
  }, []);

  const isIndia = currencyCode === "INR";

  // If India is active, ensure we don't have tier 200 selected
  useEffect(() => {
    if (isIndia && selectedTier === 200) {
      setSelectedTier(100);
    }
  }, [isIndia, selectedTier]);

  // Reset paymentProvider on close or when restored from bfcache
  useEffect(() => {
    if (!isOpen) {
      setPaymentProvider(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handlePageShow = () => {
      setPaymentProvider(null);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const handleModalClose = () => {
    setPaymentProvider(null);
    onClose();
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleModalClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const isActionLoading = isLoading || paymentProvider !== null;

  const handleDodoClick = async () => {
    if (!userDbId || isActionLoading) return;
    setPaymentProvider("dodo");
    try {
      await onDodoCheckout(selectedTier);
    } finally {
      setPaymentProvider(null);
    }
  };

  const handleStripeClick = async () => {
    if (!userDbId || isActionLoading) return;
    setPaymentProvider("stripe");
    try {
      await onCheckout(selectedTier, currencyCode);
    } finally {
      setPaymentProvider(null);
    }
  };

  // Tier configuration dynamically based on country
  const indiaTiers = [
    {
      credits: 50 as const,
      priceText: "₹199",
      description: "Great for quick catch-ups (1 session)",
      badge: null,
    },
    {
      credits: 100 as const,
      priceText: "₹299",
      description: "Save 25% — Best for active chat (2 sessions)",
      badge: "MOST POPULAR",
    },
  ];

  const internationalTiers = [
    {
      credits: 50 as const,
      priceText: "$2.99",
      description: "Great for quick catch-ups (1 session)",
      badge: null,
    },
    {
      credits: 100 as const,
      priceText: "$4.99",
      description: "Save 16% — Best for active chat (2 sessions)",
      badge: "MOST POPULAR",
    },
    {
      credits: 200 as const,
      priceText: "$7.99",
      description: "Save 33% — Maximum savings (4 sessions)",
      badge: "BEST VALUE",
    },
  ];

  const tiers = isIndia ? indiaTiers : internationalTiers;

  return (
    <div
      onClick={handleModalClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white dark:bg-[#121212] border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all max-h-[92vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleModalClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full transition-colors cursor-pointer"
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
            {isIndia
              ? "Instant UPI top-up. Scan QR or pay with any UPI app."
              : "Instant refill. Secured 256-Bit SSL checkout via Stripe."}
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
                  <span
                    className={`absolute -top-2.5 right-4 text-[9px] font-semibold tracking-wider px-2 py-0.5 rounded-full ${
                      t.badge === "MOST POPULAR"
                        ? "bg-[#8f6d3d] text-white"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected ? "border-[#8f6d3d] bg-[#8f6d3d]" : "border-stone-300 dark:border-stone-700"
                    }`}
                  >
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
                  <span className="font-bold text-lg text-stone-950 dark:text-stone-50 block">
                    {t.priceText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {errorText && (
          <div className="mb-4 text-xs text-red-600 dark:text-red-400 font-medium px-4 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-2xl text-center">
            {errorText}
          </div>
        )}

        {/* Payment Buttons based on Country */}
        {isIndia ? (
          /* INDIA: ONLY UPI Button (White background, Golden border, Google Pay, PhonePe, Paytm, BHIM UPI badges) */
          <div>
            <button
              type="button"
              disabled={isActionLoading || !userDbId}
              onClick={handleDodoClick}
              className="w-full py-4 px-5 rounded-2xl bg-white dark:bg-[#181818] hover:bg-stone-50 dark:hover:bg-stone-850 border-2 border-[#b59052] hover:border-[#d4af37] text-stone-900 dark:text-stone-100 shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2 cursor-pointer group"
            >
              {paymentProvider === "dodo" ? (
                <div className="flex items-center gap-2 py-2">
                  <svg className="animate-spin h-5 w-5 text-[#8f6d3d]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Opening UPI Checkout...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-stone-950 dark:text-white group-hover:text-[#8f6d3d] dark:group-hover:text-[#c4a06d] transition-colors">
                      Pay with UPI / QR app
                    </span>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                      <polygon points="8.75,3 14.75,12 3.25,21" fill="#F47920" />
                      <polygon points="14.75,3 20.75,12 9.25,21 5.75,21 17.25,12 11.25,3" fill="#00b074" />
                    </svg>
                  </div>

                  {/* Payment App Badges with Icons */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
                    {/* Google Pay */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.18 3.66-9.15Z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z" />
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
                      </svg>
                      <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-200">GPay</span>
                    </div>

                    {/* PhonePe */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#5f259f]/10 border border-[#5f959f]/20">
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                        <rect width="24" height="24" rx="6" fill="#5F259F" />
                        <path d="M14.8 6.5h-5.2c-.4 0-.7.3-.7.7v10.6c0 .4.3.7.7.7h2.2c.4 0 .7-.3.7-.7v-3.3h2.3c2.6 0 4.2-1.4 4.2-4 0-2.6-1.6-4-4.2-4Zm-.2 5.5h-2.1V9.3h2.1c1.2 0 1.9.6 1.9 1.4 0 .8-.7 1.3-1.9 1.3Z" fill="#FFF" />
                      </svg>
                      <span className="text-[11px] font-semibold text-[#5f259f] dark:text-[#a875eb]">PhonePe</span>
                    </div>

                    {/* Paytm */}
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#002e6e]/10 border border-[#009fff]/20">
                      <span className="text-[11px] font-bold text-[#002e6e] dark:text-[#00b9f5]">Paytm</span>
                    </div>

                    {/* BHIM UPI */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00b074]/10 border border-[#00b074]/25">
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                        <polygon points="8.75,3 14.75,12 3.25,21" fill="#F47920" />
                        <polygon points="14.75,3 20.75,12 9.25,21 5.75,21 17.25,12 11.25,3" fill="#00b074" />
                      </svg>
                      <span className="text-[11px] font-semibold text-[#008f5d] dark:text-[#00c985]">UPI</span>
                    </div>
                  </div>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-stone-400 dark:text-stone-600 mt-4">
              Secured 256-Bit SSL Payment • Instant balance update via UPI
            </p>
          </div>
        ) : (
          /* INTERNATIONAL: ONLY Stripe Button (Golden color, Card icons) */
          <div>
            <button
              type="button"
              disabled={isActionLoading || !userDbId}
              onClick={handleStripeClick}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#9e7a44] via-[#b59052] to-[#d4af37] hover:brightness-105 active:scale-[0.98] text-white font-medium text-sm tracking-wide transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 cursor-pointer"
            >
              {paymentProvider === "stripe" ? (
                <div className="flex items-center gap-2 py-1">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="font-semibold text-sm">Redirecting to Stripe...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                    <span className="font-semibold text-sm sm:text-base">
                      Pay with Google/Apple Pay
                    </span>
                  </div>
                  <span className="text-[11px] text-white/90 font-normal">
                    Visa • Mastercard • Amex • International
                  </span>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-stone-400 dark:text-stone-600 mt-4">
              Secured by Stripe Encrypted 256-Bit SSL Payment
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
