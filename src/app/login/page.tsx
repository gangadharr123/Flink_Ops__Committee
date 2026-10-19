import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">HubCheck</CardTitle>
          <CardDescription>
            Enter your email and we will send you a login link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* The form reads the URL (?error=...), so it needs a boundary. */}
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
