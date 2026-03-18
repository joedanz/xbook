"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/sidebar-nav";

interface MobileNavProps {
  folders: { id: string; name: string; count: number }[];
}

export function MobileNav({ folders }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close sheet on navigation instead of using key={pathname} which forces re-mount
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional close-on-navigate
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="md:hidden sticky top-0 z-50 bg-background border-b px-4 py-3 flex items-center gap-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-expanded={open} className="shrink-0">
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Open navigation</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-56 p-4 flex flex-col gap-1">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Suspense>
            <SidebarNav folders={folders} />
          </Suspense>
        </SheetContent>
      </Sheet>
      <span className="font-semibold text-lg">xbook</span>
    </div>
  );
}
