import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">HubCheck</h1>
          <p className="text-muted-foreground">
            Enter your email and we will send you a login link.
          </p>
        </header>
        {/* The form reads the URL (?error=...), so it needs a boundary. */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
