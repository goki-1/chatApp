"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { checkIsInAppBrowser, triggerAndroidExternalBrowser } from "@/lib/inAppBrowser";
import { InAppBrowserModal } from "@/components/InAppBrowserModal";

interface InAppBrowserContextType {
  isInApp: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const InAppBrowserContext = createContext<InAppBrowserContextType>({
  isInApp: false,
  isIOS: false,
  isAndroid: false,
  isModalOpen: false,
  openModal: () => {},
  closeModal: () => {},
});

export function InAppBrowserProvider({ children }: { children: React.ReactNode }) {
  const [isInApp, setIsInApp] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const info = checkIsInAppBrowser();
    setIsInApp(info.isInApp);
    setIsIOS(info.isIOS);
    setIsAndroid(info.isAndroid);

    // If user opens the website in Instagram or in-app browser, prompt them immediately
    if (info.isInApp) {
      setIsModalOpen(true);
      if (info.isAndroid) {
        try {
          triggerAndroidExternalBrowser();
        } catch (e) {
          console.error("Android intent auto breakout error:", e);
        }
      }
    }
  }, []);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <InAppBrowserContext.Provider
      value={{
        isInApp,
        isIOS,
        isAndroid,
        isModalOpen,
        openModal,
        closeModal,
      }}
    >
      {children}
      <InAppBrowserModal isOpen={isModalOpen} onClose={closeModal} />
    </InAppBrowserContext.Provider>
  );
}

export function useInAppBrowser() {
  return useContext(InAppBrowserContext);
}
