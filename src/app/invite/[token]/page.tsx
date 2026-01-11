import { getInvitationByToken, acceptInvitation } from "@/lib/actions/invitations";
import { getUser } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, UserPlus, AlertCircle, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

async function AcceptInvitationAction(token: string) {
  "use server";
  const result = await acceptInvitation(token);
  if (result.success && result.workspaceId) {
    redirect(`/${result.workspaceId}`);
  }
  return result;
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [{ invitation, workspace }, user] = await Promise.all([
    getInvitationByToken(token),
    getUser(),
  ]);

  // Invalid or expired invitation
  if (!invitation || !workspace) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">Plan.krd</span>
        </Link>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/">Go to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if expired
  const isExpired = new Date(invitation.expires_at) < new Date();
  if (isExpired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">Plan.krd</span>
        </Link>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-muted-foreground" />
            </div>
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>
              This invitation has expired. Please ask the workspace owner to send a new invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/">Go to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User not logged in - prompt to sign in/up
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">Plan.krd</span>
        </Link>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>You&apos;re Invited!</CardTitle>
            <CardDescription>
              You&apos;ve been invited to join <strong>{workspace.name}</strong> as a{" "}
              <strong>{invitation.role}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Sign in or create an account with <strong>{invitation.email}</strong> to accept this invitation.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link href={`/auth/sign-in?next=/invite/${token}`}>
                  Sign In
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/auth/sign-up?next=/invite/${token}`}>
                  Create Account
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if email matches
  const emailMatches = user.email?.toLowerCase() === invitation.email.toLowerCase();

  if (!emailMatches) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">Plan.krd</span>
        </Link>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Wrong Account</CardTitle>
            <CardDescription>
              This invitation was sent to <strong>{invitation.email}</strong>, but you&apos;re signed in as{" "}
              <strong>{user.email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Please sign in with the correct email address to accept this invitation.
            </p>
            <div className="flex flex-col gap-2">
              <form action={async () => {
                "use server";
                const { signOut } = await import("@/lib/auth/actions");
                await signOut();
              }}>
                <Button type="submit" className="w-full">
                  Sign Out & Switch Account
                </Button>
              </form>
              <Button variant="outline" asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is logged in with correct email - show accept button
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold tracking-tight">Plan.krd</span>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CheckCircle className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Accept Invitation</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join <strong>{workspace.name}</strong> as a{" "}
            <strong>{invitation.role}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async () => {
              "use server";
              await AcceptInvitationAction(token);
            }}
          >
            <Button type="submit" className="w-full">
              <UserPlus className="mr-2 h-4 w-4" />
              Accept & Join Workspace
            </Button>
          </form>
          <Button variant="outline" asChild className="w-full">
            <Link href="/dashboard">Decline</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
