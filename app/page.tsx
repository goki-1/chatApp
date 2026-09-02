"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { syncUser, createCheckoutSession } from "@/lib/actions";
import { CreditModal } from "@/components/CreditModal";

export default function Home() {
  const { isLoaded: authLoaded, userId } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();
  const clerk = useClerk();

  // Database states
  const [userDbId, setUserDbId] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  // Stripe Payment & Refill Modal states
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [creditsError, setCreditsError] = useState<string | null>(null);

  // Sync authenticated Clerk user to Supabase
  useEffect(() => {
    if (authLoaded && userId && userLoaded && user) {
      syncUser()
        .then((res) => {
          if (res.success && res.user) {
            setUserDbId(res.user.id);
            setCredits(res.user.credits);
          } else {
            console.error("Failed to sync user to Supabase:", res.error);
          }
        })
        .catch((err) => {
          console.error("Error invoking syncUser server action:", err);
        });
    }
  }, [authLoaded, userId, userLoaded, user]);

  // Handle Stripe Payment redirect status
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentStatus = urlParams.get("payment");

      if (paymentStatus === "success") {
        setPaymentNotice("Payment successful! Your credits have been updated.");
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
        if (authLoaded && userId && userLoaded && user) {
          syncUser().then((res) => {
            if (res.success && res.user) {
              setCredits(res.user.credits);
            }
          });
        }
      } else if (paymentStatus === "cancelled") {
        setPaymentNotice("Payment was cancelled.");
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [authLoaded, userId, userLoaded, user]);

  const handleCheckout = async (creditsTier: 50 | 100 | 200, currencyCode: string = "usd") => {
    if (!userDbId) return;
    setIsCheckoutLoading(true);
    try {
      const currentUrl = window.location.origin + window.location.pathname;
      const res = await createCheckoutSession(userDbId, creditsTier, currentUrl, currencyCode);
      if (res.success && res.url) {
        window.location.href = res.url;
      } else {
        setCreditsError(res.error || "Failed to initiate Stripe checkout");
        setIsCheckoutLoading(false);
      }
    } catch (err: any) {
      setCreditsError(err.message || "Checkout error occurred");
      setIsCheckoutLoading(false);
    }
  };

  return (
    <main className="w-full flex-1 min-h-0 overflow-y-auto bg-[#FAF8F5] text-stone-900 dark:bg-[#070707] dark:text-stone-100 px-4 py-8 sm:px-8 sm:py-12 flex flex-col items-center">
      <div className="max-w-5xl w-full space-y-12">
        {/* Payment Notice Banner */}
        {paymentNotice && (
          <div className="w-full text-sm text-emerald-700 dark:text-emerald-300 font-medium px-5 py-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl flex justify-between items-center shadow-sm">
            <span>{paymentNotice}</span>
            <button onClick={() => setPaymentNotice(null)} className="text-emerald-500 hover:text-emerald-700 ml-2">✕</button>
          </div>
        )}

        {/* Hero Section */}
        <section className="text-center space-y-4 pt-4">
          <span className="text-xs uppercase tracking-[0.3em] text-[#8f6d3d] dark:text-[#c4a06d] font-semibold">
            Direct Backstage Access
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif font-medium text-stone-950 dark:text-stone-50 leading-tight max-w-2xl mx-auto">
            Connect Directly with Creators
          </h1>
          <p className="text-stone-600 dark:text-stone-400 text-sm sm:text-base max-w-xl mx-auto font-light leading-relaxed">
            Experience 1-on-1 private backstage chat sessions. Select a creator below to start an exclusive conversation.
          </p>

          {/* User Credits Status Card */}
          {authLoaded && userId && (
            <div className="inline-flex items-center gap-4 bg-white dark:bg-[#121212] border border-stone-200 dark:border-stone-850 px-5 py-2.5 rounded-full shadow-sm mt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest font-semibold">Your Balance:</span>
                <span className="text-sm font-bold text-[#8f6d3d]">
                  {credits !== null ? `${credits} Credits` : "Loading..."}
                </span>
              </div>
              <button
                onClick={() => setIsCreditModalOpen(true)}
                className="px-3 py-1 text-xs font-semibold tracking-wider uppercase rounded-full bg-[#8f6d3d] hover:bg-[#7a5c32] text-white transition-all duration-200 active:scale-95 cursor-pointer shadow-sm"
              >
                + Refill
              </button>
            </div>
          )}
        </section>

        {/* Members Directory */}
        <section className="space-y-6">
          <div className="flex justify-between items-end border-b border-stone-200/60 dark:border-stone-850 pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-serif font-medium text-stone-900 dark:text-stone-100">
                Backstage Members
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Choose a member to initiate a private conversation.
              </p>
            </div>
            <span className="text-xs text-[#8f6d3d] font-semibold tracking-wider uppercase">
              1 Active Member
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Active Member Card: Harnoor K. */}
            <div className="group relative bg-white dark:bg-[#121212] border border-stone-200 dark:border-stone-850 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-[#8f6d3d]/50 transition-all duration-300 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-[#8f6d3d]/10 flex items-center justify-center">
                    <img src="/harnoor.jpg" alt="Harnoor K." className="w-full h-full object-cover object-top" />
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/50">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 tracking-wider uppercase">
                      Active these days
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100 group-hover:text-[#8f6d3d] transition-colors">
                    Harnoor K.
                  </h3>
                  <p className="text-xs text-[#8f6d3d] font-medium mt-0.5">
                    Instagram Inflencer
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 line-clamp-2 leading-relaxed">
                    Available for 1-on-1 chats, Q&A, and backstage discussions. Ask me anything!
                  </p>
                </div>
              </div>

              <div className="pt-6">
                <Link
                  href="/harnoor"
                  className="w-full py-3 px-5 rounded-2xl bg-[#8f6d3d] hover:bg-[#7a5c32] text-white font-medium text-xs tracking-wide transition-all duration-200 active:scale-95 shadow-md flex items-center justify-center gap-2 group-hover:shadow-lg"
                >
                  <span>Chat with Harnoor</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Placeholder Member Card 1 */}
            <div className="bg-white/40 dark:bg-[#121212]/40 border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl p-6 flex flex-col justify-between opacity-70">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="w-14 h-14 rounded-2xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-center">
                    <span className="text-stone-400 font-serif text-lg">AM</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-900 text-[10px] font-semibold text-stone-500 tracking-wider uppercase">
                    Not Active
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-stone-700 dark:text-stone-300">
                    Ritu
                  </h3>
                  <p className="text-xs text-stone-400 font-medium mt-0.5">
                    Instagram Influencer
                  </p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mt-2">
                  Available for 1-on-1 chats, Q&A, and backstage discussions. Ask me anything!
                  </p>
                </div>
              </div>
              <div className="pt-6">
                <button disabled className="w-full py-3 px-5 rounded-2xl bg-stone-200 dark:bg-stone-850 text-stone-400 font-medium text-xs cursor-not-allowed">
                  Not Active
                </button>
              </div>
            </div>

            {/* Placeholder Member Card 2 */}
            <div className="bg-white/40 dark:bg-[#121212]/40 border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl p-6 flex flex-col justify-between opacity-70">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="w-14 h-14 rounded-2xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-center">
                    <span className="text-stone-400 font-serif text-lg">KS</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-900 text-[10px] font-semibold text-stone-500 tracking-wider uppercase">
                    Not active
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-stone-700 dark:text-stone-300">
                    Karan S.
                  </h3>
                  <p className="text-xs text-stone-400 font-medium mt-0.5">
                    Instagram Infleuncer
                  </p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mt-2">
                  Available for 1-on-1 chats, Q&A, and backstage discussions. Ask me anything!
                  </p>
                </div>
              </div>
              <div className="pt-6">
                <button disabled className="w-full py-3 px-5 rounded-2xl bg-stone-200 dark:bg-stone-850 text-stone-400 font-medium text-xs cursor-not-allowed">
                  Not Active
                </button>
              </div>
            </div>
          </div>
        </section>


      </div>

      <CreditModal
        isOpen={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        userDbId={userDbId}
        onCheckout={handleCheckout}
        isLoading={isCheckoutLoading}
        errorText={creditsError}
      />
    </main>
  );
}
