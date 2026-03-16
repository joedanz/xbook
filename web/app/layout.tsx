import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "xbook — X Bookmarks Organizer & Newsletter Digest",
    template: "%s | xbook",
  },
  description:
    "Sync, search, tag, and organize your X bookmarks. Get a newsletter digest. Open source.",
  openGraph: {
    type: "website",
    siteName: "xbook",
    title: "xbook — X Bookmarks Organizer & Newsletter Digest",
    description:
      "Sync, search, tag, and organize your X bookmarks. Get a newsletter digest. Open source.",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
  twitter: {
    card: "summary_large_image",
    title: "xbook — X Bookmarks Organizer & Newsletter Digest",
    description:
      "Sync, search, tag, and organize your X bookmarks. Get a newsletter digest. Open source.",
    creator: "@joedanz",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <html lang="en" suppressHydrationWarning nonce={nonce}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
