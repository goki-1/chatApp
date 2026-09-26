"use client";

import React from "react";
import { Show, UserButton, useClerk } from "@clerk/nextjs";
import { useInAppBrowser } from "@/context/InAppBrowserContext";

export function HeaderAuth() {
  const clerk = useClerk();
  const { isInApp, openModal } = useInAppBrowser();

  const handleSignIn = () => {
    if (isInApp) {
      openModal();
      return;
    }
    clerk.openSignIn();
  };

  const handleSignUp = () => {
    if (isInApp) {
      openModal();
      return;
    }
    clerk.openSignUp();
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Show when="signed-out">
        <button
          onClick={handleSignIn}
          className="border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-full font-medium text-xs sm:text-sm h-9 sm:h-10 px-3.5 sm:px-4 cursor-pointer whitespace-nowrap"
        >
          Sign In
        </button>
        <button
          onClick={handleSignUp}
          className="bg-[#8f6d3d] hover:bg-[#7a5c32] text-white rounded-full font-medium text-xs sm:text-sm h-9 sm:h-10 px-3.5 sm:px-4 transition-all duration-200 active:scale-95 cursor-pointer shadow-sm hover:shadow-md whitespace-nowrap"
        >
          Sign Up
        </button>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
