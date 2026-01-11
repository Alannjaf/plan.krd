"use client";

/**
 * Locale detection and management utilities for RTL (Right-to-Left) support
 */

export type Locale = "en" | "ar" | "ckb" | "ku";

export const RTL_LOCALES: Locale[] = ["ar", "ckb", "ku"];

/**
 * Check if a locale is RTL (Right-to-Left)
 */
export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

/**
 * Detect locale from browser/user preferences
 * Priority:
 * 1. localStorage (user preference)
 * 2. navigator.language
 * 3. navigator.languages[0]
 * 4. Default: 'en'
 */
export function detectLocale(): Locale {
  // Check localStorage first (user preference)
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("locale") as Locale | null;
    if (stored && (stored === "en" || stored === "ar" || stored === "ckb" || stored === "ku")) {
      return stored;
    }

    // Check navigator.language
    if (navigator.language) {
      const browserLocale = normalizeLocale(navigator.language);
      if (browserLocale) {
        return browserLocale;
      }
    }

    // Check navigator.languages (preferred languages array)
    if (navigator.languages && navigator.languages.length > 0) {
      for (const lang of navigator.languages) {
        const normalized = normalizeLocale(lang);
        if (normalized) {
          return normalized;
        }
      }
    }
  }

  return "en"; // Default fallback
}

/**
 * Normalize browser language code to our supported locale
 * Examples:
 * - 'ar-SA' -> 'ar'
 * - 'ar' -> 'ar'
 * - 'ckb' -> 'ckb'
 * - 'ku' -> 'ku'
 * - 'en-US' -> 'en'
 * - 'fr' -> null (unsupported)
 */
function normalizeLocale(browserLang: string): Locale | null {
  const lang = browserLang.toLowerCase().split("-")[0]; // Get primary language code

  // Kurdish variants
  if (lang === "ckb" || lang === "ku" || lang === "kur") {
    return "ckb"; // Central Kurdish (Sorani) as default Kurdish locale
  }

  // Arabic
  if (lang === "ar") {
    return "ar";
  }

  // English (or any unsupported language defaults to English)
  if (lang === "en") {
    return "en";
  }

  return null; // Unsupported locale
}

/**
 * Get locale from URL search params (for testing/debugging)
 */
export function getLocaleFromURL(): Locale | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const localeParam = params.get("locale") as Locale | null;

  if (localeParam && (localeParam === "en" || localeParam === "ar" || localeParam === "ckb" || localeParam === "ku")) {
    return localeParam;
  }

  return null;
}

/**
 * Store locale preference in localStorage
 */
export function setLocalePreference(locale: Locale): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("locale", locale);
  }
}

/**
 * Get stored locale preference from localStorage
 */
export function getLocalePreference(): Locale | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem("locale") as Locale | null;
  if (stored && (stored === "en" || stored === "ar" || stored === "ckb" || stored === "ku")) {
    return stored;
  }

  return null;
}

/**
 * Get current locale
 * Priority:
 * 1. URL param (for testing)
 * 2. localStorage (user preference)
 * 3. Browser detection
 * 4. Default: 'en'
 */
export function getCurrentLocale(): Locale {
  // Check URL param first (for testing/debugging)
  const urlLocale = getLocaleFromURL();
  if (urlLocale) {
    return urlLocale;
  }

  // Check localStorage
  const stored = getLocalePreference();
  if (stored) {
    return stored;
  }

  // Detect from browser
  return detectLocale();
}

/**
 * Server-side locale detection (for SSR)
 * This can be used in server components/actions
 */
export function getServerLocale(headers?: Headers): Locale {
  // Check Accept-Language header
  if (headers) {
    const acceptLanguage = headers.get("accept-language");
    if (acceptLanguage) {
      // Parse Accept-Language header (format: "en-US,en;q=0.9,ar;q=0.8")
      const languages = acceptLanguage.split(",").map((lang) => lang.split(";")[0].trim());
      for (const lang of languages) {
        const normalized = normalizeLocale(lang);
        if (normalized) {
          return normalized;
        }
      }
    }
  }

  return "en"; // Default fallback
}
