import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label, Field } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { getSessionUser } from "@/lib/auth/session";
import { ensureSuperAdminBootstrap } from "@/lib/auth/superadmin-bootstrap";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string; reason?: string };
}) {
  await ensureSuperAdminBootstrap();
  const user = await getSessionUser();
  if (user) redirect("/app/dashboard");

  const errorMessage = errorMessageFor(searchParams?.error, searchParams?.reason);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-base font-semibold text-gray-900">{env.appName}</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to continue.</p>

        {errorMessage ? (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <form method="post" action="/api/auth/login" className="mt-5">
          <Field label={<Label>Email</Label>}>
            <Input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </Field>
          <Field label={<Label>Password</Label>}>
            <PasswordInput
              name="password"
              required
              autoComplete="current-password"
            />
          </Field>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>

        <div className="mt-4 text-xs text-gray-500">
          New SuperAdmin? On first launch the system creates a SuperAdmin from
          <code className="mx-1 rounded bg-gray-100 px-1 py-0.5">SUPER_ADMIN_EMAIL</code>
          and logs a temporary password to server output.
        </div>
      </div>
    </main>
  );
}

function errorMessageFor(error?: string, reason?: string): string | null {
  if (!error) return null;
  switch (error) {
    case "invalid":
      return "Email or password is incorrect.";
    case "forbidden":
      return "Your account does not have permission to access that page.";
    case "disabled":
      return "Your account is disabled. Contact a SuperAdmin.";
    case "db":
      switch (reason) {
        case "db_not_initialized":
          return "Database tables are missing. Run `prisma migrate deploy` on this environment, then try again.";
        case "db_unreachable":
          return "Cannot reach the database. Check DATABASE_URL and that the database is online.";
        case "db_auth":
          return "Database credentials were rejected. Check DATABASE_URL on this environment.";
        default:
          return "Database error during sign-in. Check the server logs.";
      }
    default:
      return "Sign-in failed. Try again.";
  }
}
