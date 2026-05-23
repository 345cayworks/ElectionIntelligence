"use client";

import { useEffect } from "react";

// Per-segment error boundary - friendlier UI than the global one because
// it preserves the surrounding layout (sidebar, etc.).
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="mx-auto mt-8 max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-base font-semibold text-gray-900">
        Something went wrong on this page.
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        The server hit an unexpected error. Try again, or return home. If this
        keeps happening, check your server logs using the digest below.
      </p>
      {error.digest ? (
        <code className="mt-3 block rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
          digest: {error.digest}
        </code>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => reset()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Home
        </a>
      </div>
    </div>
  );
}
