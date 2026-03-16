"use client";

// Note: dangerouslySetInnerHTML is safe here — the CSS content is a static string
// literal with no user input, used only because global-error.tsx cannot rely on
// external stylesheets loading (they may be what caused the error).

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media (prefers-color-scheme: dark) {
                body.ge-body { background: #111 !important; color: #e5e5e5 !important; }
                .ge-card { background: #1a1a1a !important; box-shadow: 0 1px 3px rgba(0,0,0,.4) !important; }
                .ge-sub { color: #bbb !important; }
                .ge-digest { color: #999 !important; }
                .ge-btn { background: #fff !important; color: #000 !important; }
              }
            `,
          }}
        />
      </head>
      <body
        className="ge-body"
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          margin: 0,
          background: "#fafafa",
          colorScheme: "light dark",
        }}
      >
        <div
          className="ge-card"
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "2rem",
            maxWidth: "480px",
            boxShadow: "0 1px 3px rgba(0,0,0,.1)",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>
            Something went wrong
          </h1>
          <p className="ge-sub" style={{ color: "#666", margin: "0 0 1rem" }}>
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p className="ge-digest" style={{ color: "#999", fontSize: "0.75rem", margin: "0 0 1rem" }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            className="ge-btn"
            onClick={reset}
            style={{
              background: "#000",
              color: "#fff",
              border: "2px solid transparent",
              borderRadius: "6px",
              padding: "0.5rem 1.5rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
              outline: "none",
            }}
            onFocus={(e) => { e.currentTarget.style.border = "2px solid #3b82f6"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(59,130,246,.4)"; }}
            onBlur={(e) => { e.currentTarget.style.border = "2px solid transparent"; e.currentTarget.style.boxShadow = "none"; }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
