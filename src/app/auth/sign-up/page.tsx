import { SignUpForm } from "@/components/auth/sign-up-form";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/auth/actions";

export default async function SignUpPage() {
  const user = await getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold tracking-tight">Plan.krd</span>
      </Link>
      <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
        <SignUpForm />
      </Suspense>
    </div>
  );
}
