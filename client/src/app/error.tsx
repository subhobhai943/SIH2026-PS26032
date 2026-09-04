'use client';

import React, { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log exception to console for diagnostics
    console.error('Unhandled App Router Error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
          <svg
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-neutral-900">
          Something went wrong
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          कुछ गलत हो गया है · कृपया पुनः प्रयास करें
        </p>

        {error?.message && (
          <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-left border border-neutral-100">
            <p className="text-[11px] font-mono text-neutral-600 break-words line-clamp-3">
              {error.message}
            </p>
            {error.digest && (
              <p className="mt-1 text-[10px] text-neutral-400 font-mono">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-brand-800 transition"
          >
            Try Again (पुनः प्रयास करें)
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition"
          >
            Home (मुख्य पृष्ठ)
          </a>
        </div>
      </div>
    </div>
  );
}
