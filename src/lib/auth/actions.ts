"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function signInWithGoogle(redirectTo?: string) {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || "http://localhost:3000";

  // Build callback URL with optional next parameter
  const callbackUrl = redirectTo 
    ? `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
    : `${origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    console.error("Error signing in with Google:", error);
    redirect("/error?message=auth_error");
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function signInWithEmail(
  email: string,
  password: string,
  redirectTo?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Error signing in with email:", error);
    return { success: false, error: error.message };
  }

  // Redirect to the specified URL or default to dashboard
  const destination = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/dashboard";
  redirect(destination);
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
  redirectTo?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || "http://localhost:3000";

  // Build confirmation URL with optional next parameter
  const confirmUrl = redirectTo
    ? `${origin}/auth/confirm?next=${encodeURIComponent(redirectTo)}`
    : `${origin}/auth/confirm`;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: confirmUrl,
      data: {
        full_name: fullName,
        avatar_url: null,
      },
    },
  });

  if (error) {
    console.error("Error signing up with email:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
