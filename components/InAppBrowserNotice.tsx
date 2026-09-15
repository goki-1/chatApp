"use client";

import React, { useState, useEffect } from "react";

export function InAppBrowserNotice() {
  const [showNotice, setShowNotice] = useState(false);
  const [deviceType, setDeviceType] = useState<"ios" | "android" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";
    
    // Detect In-App Browsers (Instagram, Facebook, Messenger, Threads, TikTok)
    const isInAppBrowser = /Instagram|FBAN|FBAV|FB_IAB|Messenger|Barcelona|TikTok|musical_ly/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);

    if (isInAppBrowser) {
      if (isAndroid) {
        setDeviceType("android");
        setShowNotice(true);
        // Attempt automatic breakout using Android Intent
        try {
          const cleanUrl = window.location.href.replace(/^https?:\/\//i, "");
          window.location.href = `intent://${cleanUrl}#Intent;scheme=https;action=android.intent.action.VIEW;end;`;
        } catch (e) {
          console.error("Android Intent breakout error:", e);
        }
      } else if (isIOS) {
        setDeviceType("ios");
        setShowNotice(true);
      }
    }
  }, []);

  const handleManualAndroidOpen = () => {
    const cleanUrl = window.location.href.replace(/^https?:\/\//i, "");
    window.location.href = `intent://${cleanUrl}#Intent;scheme=https;action=android.intent.action.VIEW;end;`;
  };

  if (!showNotice) return null;

  return (
    <div className="shrink-0 bg-gradient-to-r from-[#8f6d3d] via-[#a8824b] to-[#8f6d3d] text-white px-3.5 py-2 sm:py-2.5 text-xs z-50 flex items-center justify-between shadow-md border-b border-[#7a5c32]">
      <div className="flex items-center gap-2 flex-1 pr-2">
        <span className="text-base shrink-0">💡</span>
        {deviceType === "ios" ? (
          <p className="leading-tight text-[11.5px] sm:text-xs">
            Viewing inside Instagram? Tap <strong className="font-bold underline decoration-white/60 underline-offset-2">⋯</strong> (top right) and select <strong className="font-semibold">&quot;Open in Safari&quot;</strong> for full chat.
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
        onClick={() => setShowNotice(false)}
        aria-label="Dismiss notice"
        className="text-white/80 hover:text-white p-1 text-sm font-bold shrink-0 transition-opacity"
      >
        ✕
      </button>
    </div>
  );
}
