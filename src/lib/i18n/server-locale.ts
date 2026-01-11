import type { Locale } from "./locale";

/**
 * Server-side function to get locale from headers (for SSR)
 * This function can only be used in server components/actions
 * 
 * Parses Accept-Language header and respects q-values (quality/priority)
 * Returns the highest priority supported locale, defaulting to 'en'
 */
export function getLocaleFromHeaders(headers?: Headers): Locale {
  if (!headers) return "en";

  // Check Accept-Language header
  const acceptLanguage = headers.get("accept-language");
  if (!acceptLanguage) return "en";

  // Parse Accept-Language header with q-values
  // Format: "en-US,en;q=0.9,ar;q=0.8"
  const languageEntries = acceptLanguage.split(",").map((entry) => {
    const [lang, qValue] = entry.split(";");
    const quality = qValue ? parseFloat(qValue.replace("q=", "").trim()) : 1.0;
    return {
      lang: lang.trim(),
      quality,
    };
  });

  // Sort by quality (higher first), then by order in header
  languageEntries.sort((a, b) => b.quality - a.quality);

  // Check languages in priority order
  for (const { lang } of languageEntries) {
    const primary = lang.toLowerCase().split("-")[0];

    // Kurdish variants
    if (primary === "ckb" || primary === "ku" || primary === "kur") {
      return "ckb";
    }

    // Arabic
    if (primary === "ar") {
      return "ar";
    }

    // English
    if (primary === "en") {
      return "en";
    }
  }

  return "en"; // Default fallback
}

/**
 * Server-side function to get direction from locale (for SSR)
 * This function can only be used in server components/actions
 */
export function getDirectionFromLocale(locale: Locale): "ltr" | "rtl" {
  const rtlLocales: Locale[] = ["ar", "ckb", "ku"];
  return rtlLocales.includes(locale) ? "rtl" : "ltr";
}
