"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Star, BookOpen, Upload, Mail, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
  folders: { id: string; name: string; count: number }[];
}

export function SidebarNav({ folders }: SidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/bookmarks") return pathname === "/bookmarks" && !filter;
    if (href === "/bookmarks?filter=starred") return pathname === "/bookmarks" && filter === "starred";
    if (href === "/bookmarks?filter=need-to-read") return pathname === "/bookmarks" && filter === "need-to-read";
    return pathname === href;
  }

  const link = (href: string, extra?: string) =>
    cn("rounded-md px-2 py-1.5 text-sm hover:bg-accent", extra, isActive(href) && "bg-accent font-medium");

  return (
    <>
      <Link href="/dashboard" className="font-semibold text-lg mb-4 px-2">
        xbook
      </Link>
      <Link href="/dashboard" className={link("/dashboard")} aria-current={isActive("/dashboard") ? "page" : undefined}>
        Dashboard
      </Link>
      <Link href="/bookmarks" className={link("/bookmarks")} aria-current={isActive("/bookmarks") ? "page" : undefined}>
        All Bookmarks
      </Link>
      <Link
        href="/bookmarks?filter=starred"
        className={link("/bookmarks?filter=starred", "flex items-center gap-2")}
        aria-current={isActive("/bookmarks?filter=starred") ? "page" : undefined}
      >
        <Star className="h-4 w-4" aria-hidden="true" />
        Starred
      </Link>
      <Link
        href="/bookmarks?filter=need-to-read"
        className={link("/bookmarks?filter=need-to-read", "flex items-center gap-2")}
        aria-current={isActive("/bookmarks?filter=need-to-read") ? "page" : undefined}
      >
        <BookOpen className="h-4 w-4" aria-hidden="true" />
        Need to Read
      </Link>
      <Link href="/import" className={link("/import", "flex items-center gap-2")} aria-current={isActive("/import") ? "page" : undefined}>
        <Upload className="h-4 w-4" aria-hidden="true" />
        Import
      </Link>

      {folders.length > 0 && (
        <>
          <Separator className="my-2" />
          <span className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Folders
          </span>
          {folders.map((f) => (
            <Link
              key={f.id}
              href={`/bookmarks/${f.id}`}
              className={cn(
                "rounded-md px-2 py-1.5 text-sm hover:bg-accent flex items-center justify-between",
                pathname === `/bookmarks/${f.id}` && "bg-accent font-medium"
              )}
              aria-current={pathname === `/bookmarks/${f.id}` ? "page" : undefined}
            >
              <span className="truncate">{f.name}</span>
              <Badge variant="secondary" className="text-xs ml-1">
                {f.count}
              </Badge>
            </Link>
          ))}
        </>
      )}

      <Separator className="my-2" />
      <Link href="/newsletter" className={link("/newsletter", "flex items-center gap-2")} aria-current={isActive("/newsletter") ? "page" : undefined}>
        <Mail className="h-4 w-4" aria-hidden="true" />
        Newsletter
      </Link>
      <Link href="/settings" className={link("/settings", "flex items-center gap-2")} aria-current={isActive("/settings") ? "page" : undefined}>
        <Settings className="h-4 w-4" aria-hidden="true" />
        Settings
      </Link>

      <div className="mt-auto pt-4" />
    </>
  );
}
