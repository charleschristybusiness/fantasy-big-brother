import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Nav from "@/components/nav";
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
  title: "Fantasy Big Brother",
  description: "Draft your houseguests, track live scores, and compete for the top of the leaderboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas text-ink">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-edge">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gold text-[10px] font-black text-black">
                BB
              </span>
              <p className="text-sm text-ink-dim">
                Fantasy Big Brother &copy; {new Date().getFullYear()} &middot; Draft. Compete. Dominate.
              </p>
            </div>
            <Link
              href="/admin"
              className="text-sm text-ink-dim transition-colors hover:text-ink-mid"
            >
              Admin
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
