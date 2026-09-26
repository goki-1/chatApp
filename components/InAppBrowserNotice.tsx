"use client";

import React, { useState } from "react";
import { useInAppBrowser } from "@/context/InAppBrowserContext";
import { triggerAndroidExternalBrowser } from "@/lib/inAppBrowser";

export function InAppBrowserNotice() {
  const { isInApp, isIOS, isAndroid, openModal } = useInAppBrowser();
  const [dismissed, setDismissed] = useState(false);

  if (!isInApp || dismissed) return null;

  const handleManualAndroidOpen = () => {
    triggerAndroidExternalBrowser();
  };

  return (
    <div className="shrink-0 bg-gradient-to-r from-[#8f6d3d] via-[#a8824b] to-[#8f6d3d] text-white px-3.5 py-2 sm:py-2.5 text-xs z-50 flex items-center justify-between shadow-md border-b border-[#7a5c32]">
      <div className="flex items-center gap-2 flex-1 pr-2">
        <span className="text-base shrink-0">💡</span>
        {isIOS ? (
          <p className="leading-tight text-[11.5px] sm:text-xs">
            Viewing inside Instagram? Tap <strong className="font-bold underline decoration-white/60 underline-offset-2">⋯</strong> (top right) and select <strong className="font-semibold">&quot;Open in Safari&quot;</strong> or{" "}
            <button
              onClick={openModal}
              className="underline font-bold hover:text-amber-100 cursor-pointer inline"
            >
              tap here for help
            </button>.
          </p>
        ) : (
          <p className="leading-tight text-[11.5px] sm:text-xs">
            Viewing inside Instagram?{" "}
            <button
              onClick={handleManualAndroidOpen}
              className="underline font-bold hover:text-amber-100 cursor-pointer"
            >
              Tap here to open in Chrome ↗
            </button>
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notice"
        className="text-white/80 hover:text-white p-1 text-sm font-bold shrink-0 transition-opacity cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}
