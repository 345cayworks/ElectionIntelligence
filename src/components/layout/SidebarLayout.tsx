import Link from "next/link";
import clsx from "clsx";
import type { SessionUser } from "@/lib/auth/session";

export interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
  badge?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export function SidebarLayout({
  user,
  title,
  groups,
  children,
  currentPath,
}: {
  user: SessionUser;
  title: string;
  groups: NavGroup[];
  children: React.ReactNode;
  currentPath?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 lg:flex-row">
      <aside className="border-b border-gray-200 bg-white lg:w-64 lg:border-b-0 lg:border-r">
        <div className="px-4 py-4">
          <Link href="/app/dashboard" className="text-base font-semibold text-gray-900">
            {title}
          </Link>
          <div className="mt-1 text-xs text-gray-500">{user.name ?? user.email}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-400">
            {user.role.replace(/_/g, " ")}
          </div>
        </div>
        <nav className="px-2 pb-6">
          {groups.map((group) => (
            <div key={group.title} className="mb-4">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {group.title}
              </div>
              {group.items.map((item) => {
                const isActive = currentPath
                  ? item.exact
                    ? currentPath === item.href
                    : currentPath.startsWith(item.href)
                  : false;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center justify-between rounded px-2 py-1.5 text-sm",
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700 hover:bg-gray-100",
                    )}
                  >
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
          <form action="/api/auth/logout" method="post" className="px-2">
            <button
              type="submit"
              className="w-full rounded px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-100"
            >
              Sign out
            </button>
          </form>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}
