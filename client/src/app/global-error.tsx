'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled Global Layout Error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 font-sans text-neutral-800">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-200">
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
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-neutral-900">
            System Service Notice
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            सेवा में अस्थायी रुकावट · कृपया पुनः प्रयास करें
          </p>

          <p className="mt-4 text-xs text-neutral-600">
            An unexpected client-side error occurred. You can retry the action or reload the portal.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded-xl bg-green-700 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-green-800 transition"
            >
              Try Again (पुनः प्रयास)
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/';
              }}
              className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition"
            >
              Reload Portal
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
