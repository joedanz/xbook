"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { GitHubIcon } from "./github-icon";

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-semibold text-lg">
            xbook
          </Link>
          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <a
              href="https://github.com/joedanz/xbook"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/joedanz/xbook"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground hidden sm:block"
            aria-label="xbook on GitHub"
          >
            <GitHubIcon className="h-5 w-5" />
          </a>
          <div className="hidden md:flex items-center gap-3">
            <Button size="sm" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>

          {/* Mobile hamburger menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-expanded={open} className="md:hidden">
                <Menu className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-6">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <nav aria-label="Mobile navigation" className="flex flex-col gap-4 mt-4">
                <Link
                  href="/#features"
                  onClick={() => setOpen(false)}
                  className="text-sm hover:text-foreground transition-colors"
                >
                  Features
                </Link>
                <a
                  href="https://github.com/joedanz/xbook"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
                <div className="border-t pt-4 mt-2 flex flex-col gap-2">
                  <Button size="sm" asChild>
                    <Link href="/dashboard" onClick={() => setOpen(false)}>
                      Dashboard
                    </Link>
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
