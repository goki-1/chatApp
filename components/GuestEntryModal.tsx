"use client";

import React from "react";

interface GuestEntryModalProps {
  isOpen: boolean;
  onTalkAsGuest: () => void;
  onSignIn: () => void;
  isLoading?: boolean;
}

export function GuestEntryModal({
  isOpen,
  onTalkAsGuest,
  onSignIn,
  isLoading = false,
}: GuestEntryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm sm:max-w-md bg-white/95 dark:bg-[#121212]/95 border-2 border-[#8f6d3d]/50 dark:border-[#c4a06d]/40 rounded-3xl shadow-[0_0_40px_rgba(196,160,109,0.25)] p-6 sm:p-8 text-center space-y-6 overflow-hidden">
        
        {/* Glow backdrop behind modal */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-[#8f6d3d]/20 dark:bg-[#c4a06d]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-amber-500/20 dark:bg-[#8f6d3d]/15 blur-3xl pointer-events-none" />

        {/* Creator Avatar & Header */}
        <div className="relative flex flex-col items-center space-y-3">
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#8f6d3d]/70 shadow-lg shadow-[#8f6d3d]/20">
            <img
              src="/harnoor.jpg"
              alt="Harnoor K."
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-900 dark:text-stone-50">
              Welcome to Backstage ✨
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
              Start your private 1-on-1 chat with <strong className="text-[#8f6d3d] dark:text-[#c4a06d]">Harnoor</strong>
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3 pt-2">
          {/* Primary: Talk as Guest */}
          <button
            type="button"
            onClick={onTalkAsGuest}
            disabled={isLoading}
            className="w-full relative group py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#8f6d3d] via-[#a8824b] to-[#c4a06d] hover:from-[#7a5c32] hover:to-[#b38f5c] text-white font-semibold text-sm shadow-md shadow-[#8f6d3d]/30 transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">💬</span>
              <span>{isLoading ? "Setting up chat..." : "Talk as Guest"}</span>
            </div>
            <span className="bg-white/25 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-xs">
              16 Free Credits
            </span>
          </button>

          {/* Secondary: Sign In / Sign Up */}
          <button
            type="button"
            onClick={onSignIn}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-2xl border border-stone-300 dark:border-stone-750 bg-stone-100/70 dark:bg-stone-900/60 hover:bg-stone-200/80 dark:hover:bg-stone-850/80 text-stone-800 dark:text-stone-200 font-medium text-xs sm:text-sm transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Already have an account?</span>
            <strong className="text-[#8f6d3d] dark:text-[#c4a06d] underline">Sign In / Sign Up</strong>
          </button>
        </div>

        {/* Footnote */}
        <p className="text-[11px] text-stone-400 dark:text-stone-500 leading-relaxed">
          No password or email required to chat as a guest. You can always sign up later to save your chat forever.
        </p>

      </div>
    </div>
  );
}
