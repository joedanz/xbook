// ABOUTME: Environment variable validation for startup checks.
// ABOUTME: Ensures required vars are present; warns for optional ones.

interface EnvError {
  variable: string;
  message: string;
  severity: "error" | "warn";
}

export function validateEnv(): EnvError[] {
  const errors: EnvError[] = [];

  // Always required for X API sync
  if (!process.env.X_CLIENT_ID) {
    errors.push({ variable: "X_CLIENT_ID", message: "Required for X API sync", severity: "warn" });
  }
  if (!process.env.X_CLIENT_SECRET) {
    errors.push({ variable: "X_CLIENT_SECRET", message: "Required for X API sync", severity: "warn" });
  }

  // Optional warnings
  if (!process.env.RESEND_API_KEY) {
    errors.push({ variable: "RESEND_API_KEY", message: "Newsletter sending will be disabled", severity: "warn" });
  }

  return errors;
}
