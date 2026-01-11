"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Locale } from "@/lib/i18n/locale";

/**
 * Update user locale preference
 */
export async function updateUserLocale(
  locale: Locale
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ locale, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("Error updating user locale:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Get user locale preference
 */
export async function getUserLocale(): Promise<Locale | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return (data.locale as Locale) || null;
}
