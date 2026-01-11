"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getCurrentLocale,
  setLocalePreference,
  isRTL,
  type Locale,
} from "./locale";

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  direction: "ltr" | "rtl";
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

interface RTLProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

/**
 * RTL Provider Component
 * Manages locale state and updates the HTML dir attribute
 */
export function RTLProvider({ children, initialLocale }: RTLProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(
    initialLocale || getCurrentLocale()
  );
  const [direction, setDirection] = useState<"ltr" | "rtl">(
    isRTL(locale) ? "rtl" : "ltr"
  );

  // Update direction when locale changes
  useEffect(() => {
    const newDirection = isRTL(locale) ? "rtl" : "ltr";
    setDirection(newDirection);

    // Update HTML dir attribute
    if (typeof document !== "undefined") {
      document.documentElement.dir = newDirection;
      document.documentElement.lang = locale;
    }
  }, [locale]);

  // Set initial locale on mount
  useEffect(() => {
    if (!initialLocale) {
      const detected = getCurrentLocale();
      setLocaleState(detected);
    }
  }, [initialLocale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    setLocalePreference(newLocale);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, direction }}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * Hook to use locale context
 * Usage: const { locale, setLocale, direction } = useLocale();
 */
export function useLocale(): LocaleContextType {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error("useLocale must be used within an RTLProvider");
  }
  return context;
}
