"use client";

/**
 * Detects whether the current page is being viewed inside an in-app browser
 * (such as Instagram, Facebook, Threads, Messenger, TikTok) and whether the device is iOS or Android.
 */
export function checkIsInAppBrowser(): {
  isInApp: boolean;
  isIOS: boolean;
  isAndroid: boolean;
} {
  if (typeof window === "undefined") {
    return { isInApp: false, isIOS: false, isAndroid: false };
  }

  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";

  // URL overrides for testing (?browser=instagram or ?iab=true, ?device=ios or ?device=android)
  let forceIAB = false;
  let forceDevice: "ios" | "android" | null = null;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    forceIAB =
      urlParams.get("browser") === "instagram" ||
      urlParams.get("iab") === "true";
    if (urlParams.get("device") === "ios" || urlParams.get("ios") === "true") forceDevice = "ios";
    if (urlParams.get("device") === "android" || urlParams.get("android") === "true") forceDevice = "android";
  } catch {}

  const isInApp =
    forceIAB ||
    /Instagram|FBAN|FBAV|FB_IAB|Barcelona|Threads|TikTok|musical_ly/i.test(ua);

  let isAndroid = /Android/i.test(ua);
  let isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (!isAndroid && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);

  if (forceDevice === "ios") {
    isIOS = true;
    isAndroid = false;
  } else if (forceDevice === "android") {
    isAndroid = true;
    isIOS = false;
  } else if (forceIAB && !isAndroid && !isIOS) {
    // Default to iOS view when testing on desktop with ?browser=instagram
    isIOS = true;
  }

  return { isInApp, isIOS, isAndroid };
}

/**
 * Triggers Android intent to open the current page in the default external browser (Chrome).
 */
export function triggerAndroidExternalBrowser(customUrl?: string) {
  if (typeof window === "undefined") return;
  try {
    let target = customUrl || window.location.href;
    try {
      const urlObj = new URL(target);
      urlObj.searchParams.delete("browser");
      urlObj.searchParams.delete("iab");
      urlObj.searchParams.delete("device");
      target = urlObj.toString();
    } catch {}
    const cleanUrl = target.replace(/^https?:\/\//i, "");
    window.location.href = `intent://${cleanUrl}#Intent;scheme=https;action=android.intent.action.VIEW;end;`;
  } catch (err) {
    console.error("Failed to trigger Android Intent:", err);
  }
}
