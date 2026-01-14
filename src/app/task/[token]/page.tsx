import { getTaskByShareToken } from "@/lib/actions/tasks";
import { getUser } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, AlertCircle, Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBoard } from "@/lib/actions/boards";
import { createClient } from "@/lib/supabase/server";

export default async function SharedTaskPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getUser();

  // User must be authenticated
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
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              You must be signed in to view this shared task.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link href={`/auth/sign-in?next=/task/${token}`}>
                  Sign In
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/auth/sign-up?next=/task/${token}`}>
                  Create Account
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get task by share token
  const { success, task, error } = await getTaskByShareToken(token);

  if (!success || !task) {
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
            <CardTitle>Task Not Found</CardTitle>
            <CardDescription>
              {error || "This task link is invalid or sharing has been disabled."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get board info from task's list
  const supabase = await createClient();
  const { data: list } = await supabase
    .from("lists")
    .select("board_id")
    .eq("id", task.list_id)
    .single();

  if (!list) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Error</CardTitle>
            <CardDescription>Unable to load task details.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const board = await getBoard(list.board_id);
  if (!board) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Error</CardTitle>
            <CardDescription>Unable to load board details.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Redirect to board with task parameter
  redirect(`/${board.workspace_id}/${list.board_id}?task=${task.id}`);
}
