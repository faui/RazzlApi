"use client";

import { AppProvider, Frame, Toast } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastFn = (message: string, options?: { isError?: boolean }) => void;

const CommerceToastContext = createContext<ToastFn>(() => {});

export function useCommerceToast(): ToastFn {
  return useContext(CommerceToastContext);
}

export function ShopifyPolarisProvider({ children }: { children: ReactNode }) {
  const [polarisToast, setPolarisToast] = useState<{ message: string; isError?: boolean } | null>(
    null
  );

  const showToast: ToastFn = useCallback((message, options) => {
    if (typeof window !== "undefined" && window.shopify?.toast) {
      window.shopify.toast.show(message, { isError: options?.isError });
      return;
    }
    setPolarisToast({ message, isError: options?.isError });
  }, []);

  return (
    <AppProvider i18n={enTranslations}>
      <CommerceToastContext.Provider value={showToast}>
        <Frame>
          {children}
          {polarisToast ? (
            <Toast
              content={polarisToast.message}
              error={polarisToast.isError}
              onDismiss={() => setPolarisToast(null)}
            />
          ) : null}
        </Frame>
      </CommerceToastContext.Provider>
    </AppProvider>
  );
}
