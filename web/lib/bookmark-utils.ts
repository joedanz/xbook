import type { StoredBookmark } from "@shared/types";

export function groupByFolder(
  items: StoredBookmark[]
): { folder: string; items: StoredBookmark[] }[] {
  const groups = new Map<string, StoredBookmark[]>();
  for (const bm of items) {
    const folder = bm.folder_name || "Unsorted";
    const group = groups.get(folder);
    if (group) {
      group.push(bm);
    } else {
      groups.set(folder, [bm]);
    }
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === "Unsorted") return 1;
      if (b === "Unsorted") return -1;
      return a.localeCompare(b);
    })
    .map(([folder, items]) => ({ folder, items }));
}
