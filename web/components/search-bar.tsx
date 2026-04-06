"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { trackSearch } from "@/lib/analytics";

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") || "");

  const submit = useCallback(
    (term: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (term) {
        params.set("q", term);
      } else {
        params.delete("q");
      }
      params.delete("page"); // Reset to page 1 on new search
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) trackSearch();
        submit(value);
      }}
      className="w-full sm:max-w-sm"
    >
      <Input
        aria-label="Search bookmarks"
        placeholder="Search bookmarks..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </form>
  );
}
