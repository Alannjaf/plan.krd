"use client";

import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Languages, Check } from "lucide-react";
import { useLocale } from "@/lib/i18n/rtl-provider";
import type { Locale } from "@/lib/i18n/locale";
import { updateUserLocale } from "@/lib/actions/profiles";

const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  ckb: "کوردی",
  ku: "Kurdî",
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleLocaleChange = async (newLocale: Locale) => {
    if (newLocale === locale || isUpdating) return;

    setIsUpdating(true);
    setLocale(newLocale);

    // Update in database (don't wait for it to finish)
    updateUserLocale(newLocale).catch((error) => {
      console.error("Failed to update locale in database:", error);
    });

    setIsUpdating(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" disabled={isUpdating}>
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">{LOCALE_NAMES[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[150px]">
        {(Object.keys(LOCALE_NAMES) as Locale[]).map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span>{LOCALE_NAMES[loc]}</span>
            {locale === loc && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
