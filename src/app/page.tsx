import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { ensureSuperAdminBootstrap } from "@/lib/auth/superadmin-bootstrap";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureSuperAdminBootstrap();
  const user = await getSessionUser();
  if (user) redirect("/app/dashboard");

  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="text-base font-semibold text-gray-900">{env.appName}</div>
          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign in
          </Link>
        </div>
      </header>
      <section className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-gray-900">
              Campaign intelligence built for the Cayman Islands.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-gray-600">
              Replace spreadsheet-based elector tracking with a secure, role-gated
              canvassing platform. Import the official register repeatedly, track
              visits in the field, and give your leadership a live operational view.
            </p>
            <div className="mt-6 flex gap-2">
              <Link
                href="/login"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Sign in
              </Link>
              <a
                href="https://code.claude.com/docs/en/claude-code-on-the-web"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Documentation
              </a>
            </div>
          </div>
          <ul className="grid grid-cols-1 gap-3 text-sm text-gray-700">
            <li className="rounded-lg border border-gray-200 bg-white p-3">
              Separated official elector data and campaign-entered intelligence
            </li>
            <li className="rounded-lg border border-gray-200 bg-white p-3">
              Strict role-based access and audit logging for political data
            </li>
            <li className="rounded-lg border border-gray-200 bg-white p-3">
              Mobile-first field canvassing with quick action buttons
            </li>
            <li className="rounded-lg border border-gray-200 bg-white p-3">
              Repeatable elector register imports with change detection
            </li>
          </ul>
        </div>
      </section>
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 text-xs text-gray-500">
          <span>Cayworks</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </footer>
    </main>
  );
}
