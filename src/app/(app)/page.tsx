import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Home</h1>
      <Suspense
        fallback={<div className="h-32 animate-pulse rounded-xl bg-muted" />}
      >
        <Welcome />
      </Suspense>
    </div>
  );
}

async function Welcome() {
  const user = await getCurrentUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          Hello, {user.fullName ?? user.email}
        </CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p>
          Role:{" "}
          <span className="rounded-md bg-muted px-2 py-0.5 font-medium capitalize">
            {user.role ?? "none"}
          </span>
        </p>
        {!user.role && (
          <p className="text-muted-foreground">
            No profile found. Run the profiles migration in Supabase.
          </p>
        )}
        {user.role && !user.fullName && (
          <p className="text-muted-foreground">
            Your name isn&apos;t set yet. An admin can add it in Supabase.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
