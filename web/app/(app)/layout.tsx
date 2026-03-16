import { Suspense } from "react";
import { SidebarNav } from "@/components/sidebar-nav";
import { MobileNav } from "@/components/mobile-nav";
import { SearchDialog } from "@/components/search-dialog";
import { getRepository } from "@/lib/db";

async function getFolders(userId: string) {
  try {
    const repo = getRepository();
    return await repo.getFolders();
  } catch {
    return [];
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Import here to avoid loading auth in local mode at module level
  const { requireUser } = await import("@/lib/session");
  const { userId } = await requireUser();
  const folders = await getFolders(userId);

  return (
    <div className="flex min-h-screen">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground focus:border focus:rounded-md">
        Skip to content
      </a>
      <nav aria-label="Main navigation" className="hidden md:flex w-56 shrink-0 border-r bg-muted/40 p-4 flex-col gap-1">
        <Suspense>
          <SidebarNav folders={folders} />
        </Suspense>
      </nav>
      <div className="flex flex-col flex-1 min-w-0">
        <MobileNav folders={folders} />
        <main id="main-content" className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
      <SearchDialog />
    </div>
  );
}
