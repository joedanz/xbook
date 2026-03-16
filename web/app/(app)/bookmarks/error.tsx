"use client";

export default function BookmarksErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 max-w-4xl">
      <h2 className="text-xl font-semibold">Failed to load bookmarks</h2>
      <p className="text-muted-foreground text-sm max-w-md text-center">
        Could not load bookmarks. Please try again.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
