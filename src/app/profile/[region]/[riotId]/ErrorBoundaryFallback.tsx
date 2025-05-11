// app/profile/[region]/[riotId]/ErrorBoundaryFallback.tsx
'use client'; // This is a Client Component

import { RotateCcw, ShieldAlert } from 'lucide-react'; // Using lucide-react for icons
import type { FallbackProps } from 'react-error-boundary';

export function ProfilePageErrorBoundaryFallback({ error, resetErrorBoundary }: FallbackProps) {
  // You can log the error to an error reporting service here if you wish
  // console.error("Client-side ErrorBoundary caught an error:", error);

  return (
    <div
      role="alert"
      className="p-6 my-4 text-red-800 bg-red-100 border-l-4 border-red-600 rounded-md shadow-md dark:bg-red-900/30 dark:text-red-200 dark:border-red-500"
    >
      <div className="flex items-center mb-3">
        <ShieldAlert className="h-6 w-6 mr-3 text-red-600 dark:text-red-400" aria-hidden="true" />
        <h3 className="font-semibold text-xl">Oops! Something went wrong.</h3>
      </div>
      <p className="mb-2 text-sm">
        We encountered an issue while trying to display the profile information.
      </p>
      {error?.message && (
        <pre className="mt-2 mb-3 p-2 text-xs bg-red-200 dark:bg-red-800/50 rounded-md overflow-x-auto">
          <code>Error details: {error.message}</code>
        </pre>
      )}
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="mt-3 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-offset-gray-900 flex items-center"
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Try to reload section
      </button>
    </div>
  );
}
