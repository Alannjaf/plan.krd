import { getUser } from "@/lib/auth/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { CommandPalette } from "@/components/search/command-palette";
import { SearchButton } from "@/components/search/search-button";
import { NotificationBell } from "@/components/notifications/notification-bell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-xl bg-background/80 sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">Plan.krd</span>
          </Link>
          <div className="flex items-center gap-4">
            <SearchButton />
            <NotificationBell />
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
            <form action={signOut}>
              <Button variant="ghost" size="sm" className="gap-2">
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Command Palette */}
      <CommandPalette />

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
