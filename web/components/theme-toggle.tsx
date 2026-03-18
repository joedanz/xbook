"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

const cycle = { light: "dark", dark: "system", system: "light" } as const;
const icons = { light: Sun, dark: Moon, system: Monitor } as const;
const labels = { light: "Light", dark: "Dark", system: "System" } as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-compiler/react-compiler -- hydration-safe mount check
  useEffect(() => setMounted(true), []);

  const current = (theme as keyof typeof cycle) ?? "system";
  const Icon = icons[current];

  if (!mounted) return <div className="h-9 w-9" />;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(cycle[current])}
      aria-label={`Theme: ${labels[current]}`}
      title={labels[current]}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
