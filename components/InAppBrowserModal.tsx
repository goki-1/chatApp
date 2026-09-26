"use client";

import React, { useState, useEffect } from "react";
import { checkIsInAppBrowser, triggerAndroidExternalBrowser } from "@/lib/inAppBrowser";

interface InAppBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InAppBrowserModal({ isOpen, onClose }: InAppBrowserModalProps) {
  const [device, setDevice] = useState<{ isIOS: boolean; isAndroid: boolean }>({
    isIOS: false,
    isAndroid: false,
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const { isIOS, isAndroid } = checkIsInAppBrowser();
    setDevice({ isIOS, isAndroid });
  }, []);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      try {
        const urlObj = new URL(window.location.href);
        urlObj.searchParams.delete("browser");
        urlObj.searchParams.delete("iab");
        urlObj.searchParams.delete("device");
        navigator.clipboard.writeText(urlObj.toString()).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        });
      } catch {
        navigator.clipboard.writeText(window.location.href).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        });
      }
    }
  };

  const handleOpenAndroid = () => {
    triggerAndroidExternalBrowser();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* Visual floating badge & arrow for iOS pointing to top-right ⋯ */}
      {device.isIOS && (
        <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-4 z-[110] flex items-center gap-1.5 bg-[#8f6d3d] text-white text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-2xl animate-bounce pointer-events-none border border-white/30">
          <span>Tap ⋯ here</span>
          <span className="text-base leading-none">↗</span>
        </div>
      )}

      <div className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-[#121212] border-2 border-[#8f6d3d]/50 dark:border-[#c4a06d]/40 rounded-3xl shadow-2xl p-6 sm:p-8 text-center space-y-5 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full transition-colors cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon & Title */}
        <div className="space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#8f6d3d]/15 flex items-center justify-center text-2xl text-[#8f6d3d]">
            🌐
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-semibold text-stone-900 dark:text-stone-50">
            Open in External Browser
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            Instagram&apos;s in-app browser blocks logins, chats, and payment sessions. Please switch to your phone&apos;s default browser to continue.
          </p>
        </div>

        {/* Instructions based on Device */}
        {device.isIOS ? (
          /* iOS (Apple) Instructions */
          <div className="space-y-4 pt-1">
            <div className="bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#8f6d3d] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-xs text-stone-700 dark:text-stone-300">
                  Tap the <strong className="font-bold text-stone-950 dark:text-stone-100">⋯ (three dots)</strong> at the very top-right corner of Instagram.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#8f6d3d] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-xs text-stone-700 dark:text-stone-300">
                  Select <strong className="font-bold text-stone-950 dark:text-stone-100">&quot;Open in Safari&quot;</strong> or &quot;Open in browser&quot;.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-3 px-4 rounded-2xl bg-[#8f6d3d] hover:bg-[#7a5c32] text-white font-medium text-xs sm:text-sm tracking-wide transition-all duration-200 active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <span>Link Copied! Open Safari & Paste</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                  </svg>
                  <span>Or Copy Website Link</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Android Instructions */
          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={handleOpenAndroid}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#8f6d3d] via-[#a8824b] to-[#c4a06d] hover:brightness-105 text-white font-semibold text-sm shadow-md transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open in Chrome Browser</span>
              <span className="text-base">↗</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-2.5 px-4 rounded-2xl border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 font-medium text-xs transition-colors hover:bg-stone-50 dark:hover:bg-stone-900 cursor-pointer flex items-center justify-center gap-2"
            >
              {copied ? "Link Copied!" : "Copy Link"}
            </button>
          </div>
        )}

        <p className="text-[10px] text-stone-400 dark:text-stone-500">
          Guest chats & purchases are only supported in Chrome, Safari, or Samsung Internet.
        </p>
      </div>
    </div>
  );
}
