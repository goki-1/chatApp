"use client";

import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, ExpressCheckoutElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { createPaymentIntentAction } from "@/lib/actions";

const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  userDbId: number | null;
  onCheckout: (creditsTier: 50 | 100 | 200, currencyCode: string) => Promise<void>;
  isLoading: boolean;
  errorText?: string | null;
}

function ExpressCheckoutInner({
  clientSecret,
  onSuccess,
  onError,
}: {
  clientSecret: string;
  onSuccess: () => void;
  onError: (err: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleConfirm = async () => {
    if (!stripe || !elements) return;

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}${window.location.pathname}?payment=success`,
        },
        redirect: "if_required",
      });

      if (error) {
        onError(error.message || "Payment failed");
      } else {
        onSuccess();
      }
    } catch (err: any) {
      onError(err?.message || "Express Checkout error");
    }
  };

  return (
    <div className="w-full">
      <ExpressCheckoutElement
        onConfirm={handleConfirm}
        options={{
          buttonHeight: 46,
          buttonTheme: {
            applePay: "black",
            googlePay: "black",
          },
          wallets: {
            applePay: "auto",
            googlePay: "auto",
          },
        }}
      />
    </div>
  );
}

export function CreditModal({ isOpen, onClose, userDbId, onCheckout, isLoading, errorText }: CreditModalProps) {
  const [selectedTier, setSelectedTier] = useState<50 | 100 | 200>(100);
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [expressError, setExpressError] = useState<string | null>(null);
  const [isPreparingExpress, setIsPreparingExpress] = useState(false);

  useEffect(() => {
    // Detect Indian timezone/locale vs global USD
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (timeZone.includes("Calcutta") || timeZone.includes("Kolkata") || timeZone.includes("Asia/Kolkata") || timeZone.includes("India")) {
        setCurrencySymbol("₹");
        setCurrencyCode("INR");
      } else {
        setCurrencySymbol("$");
        setCurrencyCode("USD");
      }
    } catch {
      setCurrencySymbol("$");
      setCurrencyCode("USD");
    }
  }, []);

  // Fetch client secret for Express Checkout Element whenever tier or currency changes
  useEffect(() => {
    if (!isOpen || !userDbId || !stripePromise) return;

    let isMounted = true;
    setIsPreparingExpress(true);
    setExpressError(null);

    createPaymentIntentAction(userDbId, selectedTier, currencyCode)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.clientSecret) {
          setClientSecret(res.clientSecret);
        } else {
          setClientSecret(null);
        }
      })
      .catch((err) => {
        console.error("Error creating PaymentIntent for Express Checkout:", err);
      })
      .finally(() => {
        if (isMounted) setIsPreparingExpress(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, userDbId, selectedTier, currencyCode]);

  if (!isOpen) return null;

  const getDescription = (credits: number) => {
    if (credits === 50) return "Great for quick catch-ups (1 session)";
    if (credits === 100) {
      const savePct = currencyCode === "INR" ? "25%" : "16%";
      return `Save ${savePct} — Best for active chat (2 sessions)`;
    }
    if (credits === 200) {
      const savePct = currencyCode === "INR" ? "37%" : "33%";
      return `Save ${savePct} — Maximum savings (4 sessions)`;
    }
    return "";
  };

  const tiers = [
    {
      credits: 50 as const,
      usdPrice: 2.99,
      badge: null,
    },
    {
      credits: 100 as const,
      usdPrice: 4.99,
      badge: "MOST POPULAR",
    },
    {
      credits: 200 as const,
      usdPrice: 7.99,
      badge: "BEST VALUE",
    },
  ];

  const formatPrice = (usdPrice: number, credits: number) => {
    if (currencyCode === "INR") {
      if (credits === 50) return "₹199";
      if (credits === 100) return "₹299";
      if (credits === 200) return "₹499";
    }
    return `$${usdPrice.toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#121212] border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all max-h-[90vh] overflow-y-auto">
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
            Unlock uninterrupted access with Harnoor. Auto-converted on Checkout.
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
                      {getDescription(t.credits)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-bold text-sm text-stone-950 dark:text-stone-50">
                    {formatPrice(t.usdPrice, t.credits)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {(errorText || expressError) && (
          <div className="mb-4 text-xs text-red-600 dark:text-red-400 font-medium px-4 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-2xl text-center">
            {errorText || expressError}
          </div>
        )}

        {/* Embedded Stripe Express Checkout Element (Apple Pay, Google Pay, Link) */}
        {clientSecret && stripePromise && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                ⚡ Instant 1-Click Pay
              </span>
              <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
            </div>

            <Elements
              key={clientSecret}
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "night",
                  variables: {
                    colorPrimary: "#8f6d3d",
                    borderRadius: "16px",
                  },
                },
              }}
            >
              <ExpressCheckoutInner
                clientSecret={clientSecret}
                onSuccess={() => {
                  window.location.href = `${window.location.origin}${window.location.pathname}?payment=success`;
                }}
                onError={(err) => setExpressError(err)}
              />
            </Elements>

            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200 dark:border-stone-800" />
              </div>
              <span className="relative bg-white dark:bg-[#121212] px-3 text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                Or pay with Card / NetBanking
              </span>
            </div>
          </div>
        )}

        {/* Standard Hosted Checkout Button */}
        <button
          disabled={isLoading || !userDbId}
          onClick={() => onCheckout(selectedTier, currencyCode)}
          className="w-full py-3.5 px-6 rounded-full bg-[#8f6d3d] hover:bg-[#7a5c32] text-white font-medium text-sm tracking-wide transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
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
            <span>Proceed to Standard Checkout</span>
          )}
        </button>

        <p className="text-[10px] text-center text-stone-400 dark:text-stone-600 mt-4">
          Secured by Stripe Encrypted 256-Bit SSL Payment
        </p>
      </div>
    </div>
  );
}
