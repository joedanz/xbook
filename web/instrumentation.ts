// ABOUTME: Next.js instrumentation hook — runs on server startup.
// ABOUTME: Validates environment variables and logs warnings/errors.

export async function register() {
  const { validateEnv } = await import("@/lib/env");
  const errors = validateEnv();

  for (const err of errors) {
    if (err.severity === "error") {
      console.error(`❌ ENV ERROR: ${err.variable} — ${err.message}`);
    } else {
      console.warn(`⚠️  ENV WARNING: ${err.variable} — ${err.message}`);
    }
  }

  const fatalErrors = errors.filter((e) => e.severity === "error");
  if (fatalErrors.length > 0) {
    throw new Error(
      `Missing required environment variables: ${fatalErrors.map((e) => e.variable).join(", ")}`
    );
  }
}
