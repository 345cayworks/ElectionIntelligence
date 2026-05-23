"use client";

import { useEffect } from "react";

// Global error boundary for the App Router. Renders our own UI instead of
// the generic platform crash page so users see something actionable.
// `digest` is the same identifier surfaced in server logs.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f9fafb",
            padding: "1rem",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: "100%",
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "1.5rem",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <h1 style={{ margin: 0, fontSize: 18, color: "#111827" }}>
              Something went wrong.
            </h1>
            <p
              style={{
                marginTop: 8,
                color: "#4b5563",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              The server hit an unexpected error. If you are the administrator,
              check the server logs for the digest below.
            </p>
            {error.digest ? (
              <code
                style={{
                  display: "block",
                  marginTop: 12,
                  padding: "8px 10px",
                  background: "#f3f4f6",
                  borderRadius: 4,
                  fontSize: 12,
                  color: "#374151",
                }}
              >
                digest: {error.digest}
              </code>
            ) : null}
            <p
              style={{
                marginTop: 12,
                color: "#6b7280",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              Common causes: <code>DATABASE_URL</code> not configured for the
              deployment, database migration not applied, or a network/timeout
              hitting an external service.
            </p>
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button
                onClick={() => reset()}
                style={{
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 6,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  background: "white",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  padding: "8px 14px",
                  borderRadius: 6,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
