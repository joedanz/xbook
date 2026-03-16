"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const COLS_STORAGE_KEY = "xbook-grid-cols";
const DEFAULT_COLS = 3;

function getStoredCols(): number {
  if (typeof window === "undefined") return DEFAULT_COLS;
  const stored = localStorage.getItem(COLS_STORAGE_KEY);
  if (!stored) return DEFAULT_COLS;
  const n = parseInt(stored, 10);
  return n >= 1 && n <= 4 ? n : DEFAULT_COLS;
}

interface FilterBarProps {
  folders?: { id: string; name: string; count: number }[];
  authors?: { username: string; name: string; count: number }[];
}

export function FilterBar({ folders, authors }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const activeFolder = searchParams.get("folder") || "";
  const activeAuthor = searchParams.get("author") || "";
  const activeSort = searchParams.get("sort") || "created_at";
  const activeFilter = searchParams.get("filter") || "";

  const urlCols = searchParams.get("cols");
  const activeCols = urlCols ? parseInt(urlCols, 10) : getStoredCols();
  const hasRestored = useRef(false);

  // Sync localStorage <-> URL on mount
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;
    if (urlCols) {
      // URL has cols — save to localStorage so it persists across navigation
      localStorage.setItem(COLS_STORAGE_KEY, String(activeCols));
    } else {
      // No cols in URL — restore from localStorage via CSS variable (no navigation flash)
      const stored = getStoredCols();
      if (stored !== DEFAULT_COLS) {
        document.querySelectorAll<HTMLElement>("[style*='--cols']").forEach((el) => {
          el.style.setProperty("--cols", String(stored));
        });
      }
    }
  }, [urlCols, activeCols]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className={`grid grid-cols-2 sm:flex sm:items-center gap-2 sm:flex-wrap ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Folder filter */}
      {folders && folders.length > 0 && (
        <select
          value={activeFolder}
          onChange={(e) => setParam("folder", e.target.value)}
          aria-label="Filter by folder"
          className="rounded-md border bg-background px-2 py-1.5 text-sm min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">All folders</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.count})
            </option>
          ))}
        </select>
      )}

      {/* Author filter */}
      {authors && authors.length > 0 && (
        <select
          value={activeAuthor}
          onChange={(e) => setParam("author", e.target.value)}
          aria-label="Filter by author"
          className="rounded-md border bg-background px-2 py-1.5 text-sm min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">All authors</option>
          {authors.map((a) => (
            <option key={a.username} value={a.username}>
              @{a.username} ({a.count})
            </option>
          ))}
        </select>
      )}

      {/* Sort */}
      <select
        value={activeSort}
        onChange={(e) => setParam("sort", e.target.value)}
        aria-label="Sort by"
        className="rounded-md border bg-background px-2 py-1.5 text-sm min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <option value="synced_at">Newest synced</option>
        <option value="created_at">Newest created</option>
        <option value="author_name">Author name</option>
      </select>

      {/* Starred toggle */}
      <Button
        variant={activeFilter === "starred" ? "default" : "outline"}
        size="sm"
        aria-pressed={activeFilter === "starred"}
        onClick={() =>
          setParam("filter", activeFilter === "starred" ? "" : "starred")
        }
      >
        Starred
      </Button>

      {/* Grid size — slider value is "card size" (1=small/4cols, 4=big/1col) */}
      <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1 sm:ml-auto">
        <LayoutGrid className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Slider
          min={1}
          max={4}
          step={1}
          value={[5 - activeCols]}
          onValueChange={([v]) => {
            const cols = 5 - v;
            localStorage.setItem(COLS_STORAGE_KEY, String(cols));
            setParam("cols", cols === DEFAULT_COLS ? "" : String(cols));
          }}
          aria-label="Grid columns"
          className="w-36"
        />
      </div>

      {/* Clear filters — exclude cols since it's a display pref, not a content filter */}
      {(activeFolder || activeAuthor || activeFilter || searchParams.get("q")) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(pathname)}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
