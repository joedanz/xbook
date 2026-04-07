import Link from "next/link";
import type { Metadata } from "next";
import {
  Bookmark,
  Search,
  Mail,
  BookOpen,
  Code2,
  Zap,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { GitHubIcon } from "@/components/marketing/github-icon";

export const metadata: Metadata = {
  title: "xbook — X Bookmarks Organizer & Newsletter Digest",
  description:
    "Sync, search, tag, and organize your X bookmarks. Get a newsletter digest of your saved content. Open source.",
};

const features = [
  {
    icon: Bookmark,
    title: "Chrome Sync",
    description: "Sync straight from Chrome — no developer account needed. Or use the X API.",
  },
  {
    icon: Search,
    title: "Search & Organize",
    description: "Full-text search, folders, tags, and notes. Find anything instantly.",
  },
  {
    icon: Mail,
    title: "Newsletter Digest",
    description: "Get a curated weekly newsletter of your bookmarks.",
  },
  {
    icon: BookOpen,
    title: "Need to Read",
    description: "Mark bookmarks for later. Track your reading list across folders.",
  },
  {
    icon: Code2,
    title: "Open Source",
    description: "Free to self-host. Fair Source licensed.",
  },
  {
    icon: Zap,
    title: "API Access",
    description: "Full REST API. Build your own integrations and workflows.",
  },
];

const steps = [
  { step: "1", title: "Sync", description: "Pull your bookmarks from Chrome with one command. Full history, no API key." },
  { step: "2", title: "Search", description: "Full-text search across every bookmark you've ever saved." },
  { step: "3", title: "Digest", description: "Get a weekly email with what you saved — your bookmarks come to you." },
];

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-4">
            Open Source
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl mx-auto">
            Your X bookmarks, organized.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Sync your X bookmarks straight from Chrome — full history, no API key needed.
            Search everything, get a weekly digest. Your data, your machine.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Button size="lg" asChild>
              <Link href="/dashboard">
                Get Started <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a
                href="https://github.com/joedanz/xbook"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitHubIcon className="mr-2 h-4 w-4" />
                GitHub
              </a>
            </Button>
          </div>
        </div>
      </section>

      <Separator />

      {/* Features */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Everything you need</h2>
            <p className="mt-3 text-muted-foreground">
              A complete toolkit for managing your X bookmarks.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="h-8 w-8 mb-2 text-primary" aria-hidden="true" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* How It Works */}
      <section className="py-20 bg-muted/40">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">How it works</h2>
            <p className="mt-3 text-muted-foreground">
              Get started in under two minutes.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg mb-4">
                  {s.step}
                </div>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* Self-Hosted */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Free &amp; self-hosted</h2>
            <p className="mt-3 text-muted-foreground">
              Run xbook on your own infrastructure. Free forever.
            </p>
          </div>
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <Badge variant="outline" className="w-fit mb-2">
                Self-Hosted
              </Badge>
              <CardTitle>Open Source</CardTitle>
              <CardDescription>
                Your data stays on your machine. No accounts, no tracking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {[
                  "Chrome sync — no API key needed",
                  "Full history + engagement stats",
                  "SQLite — zero dependencies",
                  "Fair Source (FSL-1.1-MIT)",
                  "Full API access",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full mt-6" asChild>
                <a
                  href="https://github.com/joedanz/xbook"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on GitHub
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      {/* Open Source CTA */}
      <section className="py-20 bg-muted/40">
        <div className="container mx-auto px-4 text-center">
          <Code2 className="h-10 w-10 mx-auto mb-4 text-primary" aria-hidden="true" />
          <h2 className="text-3xl font-bold">Built in the open</h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            xbook is Fair Source and open code. Star us on GitHub, report
            issues, or contribute.
          </p>
          <Button size="lg" variant="outline" className="mt-6" asChild>
            <a
              href="https://github.com/joedanz/xbook"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHubIcon className="mr-2 h-4 w-4" />
              Star on GitHub
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
