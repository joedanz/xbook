"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { parseImportFile, type ImportResult } from "@shared/import-parser";
import { importBookmarks } from "@/lib/actions";

const BATCH_SIZE = 100;

interface ImportTotals {
  imported: number;
  skipped: number;
  errors: number;
}

export function ImportForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<
    "idle" | "parsed" | "importing" | "done"
  >("idle");
  const [parseInfo, setParseInfo] = useState<{
    format: string;
    count: number;
    users: number;
    warnings: string[];
  } | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [totals, setTotals] = useState<ImportTotals | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const parsedRef = useRef<ImportResult | null>(null);

  function handleFileChange() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setPhase("idle");
      setParseInfo(null);
      return;
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large — maximum size is 50MB");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    // Parse the file client-side
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = reader.result as string;
        const result = parseImportFile(content, file.name);
        parsedRef.current = result;
        setParseInfo({
          format: result.format,
          count: result.tweets.length,
          users: result.users.size,
          warnings: result.warnings,
        });
        setPhase("parsed");
        setTotals(null);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not parse file"
        );
        setPhase("idle");
      }
    };
    reader.onerror = () => {
      toast.error("Could not read file");
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const parsed = parsedRef.current;
    if (!parsed) return;

    setPhase("importing");
    setProgress({ current: 0, total: parsed.tweets.length });

    const result: ImportTotals = { imported: 0, skipped: 0, errors: 0 };

    // Serialize users Map to plain object for JSON
    const usersObj: Record<string, { id: string; name: string; username: string }> = {};
    for (const [id, user] of parsed.users) {
      usersObj[id] = user;
    }

    // Send in batches
    for (let i = 0; i < parsed.tweets.length; i += BATCH_SIZE) {
      const batch = parsed.tweets.slice(i, i + BATCH_SIZE);

      try {
        const data = await importBookmarks(batch, usersObj, parsed.format);
        result.imported += data.imported ?? 0;
        result.skipped += data.skipped ?? 0;
        result.errors += data.errors ?? 0;
      } catch {
        result.errors += batch.length;
      }

      setProgress({ current: Math.min(i + BATCH_SIZE, parsed.tweets.length), total: parsed.tweets.length });
      setTotals({ ...result });
    }

    setPhase("done");
    setTotals(result);

    if (result.imported > 0) {
      toast.success(`Imported ${result.imported} new bookmarks`);
    } else if (result.skipped > 0) {
      toast.info(`All ${result.skipped} bookmarks already exist`);
    } else {
      toast.warning("No bookmarks were imported");
    }
  }

  const warnings = parseInfo?.warnings ?? totals ? (parseInfo?.warnings ?? []) : [];
  const pct =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv"
          aria-label="Import bookmarks file"
          onChange={handleFileChange}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
          disabled={phase === "importing"}
        />
      </div>

      {/* Parse preview */}
      {parseInfo && phase !== "idle" && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {parseInfo.count.toLocaleString()} bookmarks found
                </p>
                <p className="text-xs text-muted-foreground">
                  {parseInfo.users.toLocaleString()} authors &middot;{" "}
                  {parseInfo.format} format
                </p>
              </div>
              {phase === "parsed" && (
                <Button onClick={handleImport} size="sm">
                  Import
                </Button>
              )}
            </div>

            {/* Progress bar */}
            {(phase === "importing" || phase === "done") && (
              <div className="space-y-1.5">
                <div
                  className="h-2 bg-muted rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Import progress"
                >
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {progress.current.toLocaleString()} /{" "}
                    {progress.total.toLocaleString()}
                  </span>
                  <span>{pct}%</span>
                </div>
              </div>
            )}

            {/* Running / final totals */}
            {totals && (
              <div aria-live="polite" role="status" className="sr-only">
                {phase === "importing"
                  ? `Importing: ${progress.current} of ${progress.total} processed`
                  : `Import complete: ${totals.imported} imported, ${totals.skipped} skipped, ${totals.errors} errors`}
              </div>
            )}
            {totals && (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{totals.imported}</div>
                  <div className="text-xs text-muted-foreground">Imported</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{totals.skipped}</div>
                  <div className="text-xs text-muted-foreground">Skipped</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{totals.errors}</div>
                  <div className="text-xs text-muted-foreground">Errors</div>
                </div>
              </div>
            )}

            {/* Done actions */}
            {phase === "done" && totals && totals.imported > 0 && (
              <div className="flex justify-center pt-1">
                <Button
                  size="sm"
                  onClick={() => {
                    router.push("/bookmarks");
                  }}
                >
                  View Bookmarks
                </Button>
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div>
                <button
                  onClick={() => setShowWarnings(!showWarnings)}
                  aria-expanded={showWarnings}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  {showWarnings ? "Hide" : "Show"} {warnings.length}{" "}
                  warning{warnings.length !== 1 ? "s" : ""}
                </button>
                {showWarnings && (
                  <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                    {warnings.map((w, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
