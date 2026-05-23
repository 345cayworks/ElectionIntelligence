import "./globals.css";
import { Suspense } from "react";
import type { Metadata } from "next";
import { TrackingScripts } from "@/components/tracking/TrackingScripts";
import { PageViewTracker } from "@/components/tracking/PageViewTracker";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: env.appName,
  description: "Cayman Islands campaign intelligence and canvassing platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <TrackingScripts />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
