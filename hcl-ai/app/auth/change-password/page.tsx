"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Loader2, ShieldCheck } from "lucide-react";
import { getPasswordRequirementsText } from "@/lib/password-validation";
import { SessionProvider } from "@/components/session-provider";

function ChangePasswordForm() {
  const router = useRouter();
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const requirements = getPasswordRequirementsText();

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to change password");
        return;
      }

      // Sign out to clear the old JWT token and redirect to sign in
      await signOut({ redirect: false });
      router.push("/auth/signin?passwordChanged=true");
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <ShieldCheck className="size-4" />
          </div>
          Password Change Required
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Change Your Password</CardTitle>
            <CardDescription>
              For security reasons, you must change your password before continuing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="new-password">New Password</FieldLabel>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoFocus
                  />
                  <div className="mt-2 text-muted-foreground text-sm">
                    <strong>Password Requirements:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {requirements.map((req, i) => (
                        <li key={i} className="text-xs">{req}</li>
                      ))}
                    </ul>
                  </div>
                </Field>

                <Field>
                  <FieldLabel htmlFor="confirm-password">Confirm New Password</FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </Field>

                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Field>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Changing Password...
                      </>
                    ) : (
                      "Change Password"
                    )}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <SessionProvider>
      <ChangePasswordForm />
    </SessionProvider>
  );
}
