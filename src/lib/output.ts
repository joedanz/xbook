// ABOUTME: Output formatting for CLI — text or JSON mode.
// ABOUTME: JSON mode outputs structured data to stdout, errors to stderr.

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function outputText(message: string): void {
  console.log(message);
}

export function outputError(message: string, json: boolean): void {
  if (json) {
    console.error(JSON.stringify({ error: message }));
  } else {
    console.error(`Error: ${message}`);
  }
}

export function outputTable(
  headers: string[],
  rows: string[][],
): void {
  // Calculate column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] || "").length))
  );

  const sep = widths.map((w) => "-".repeat(w)).join("-+-");
  const formatRow = (row: string[]) =>
    row.map((cell, i) => (cell || "").padEnd(widths[i])).join(" | ");

  console.log(formatRow(headers));
  console.log(sep);
  rows.forEach((row) => console.log(formatRow(row)));
}
