import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  description: "Draft your houseguests and compete for the top of the leaderboard!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <nav className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-blue-600 hover:text-blue-700">
              🏠 Fantasy Big Brother
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/leaderboard" className="text-slate-600 hover:text-blue-600 transition">
                Leaderboard
              </Link>
              <Link href="/houseguests" className="text-slate-600 hover:text-blue-600 transition">
                Houseguests
              </Link>
              <Link href="/trends" className="text-slate-600 hover:text-blue-600 transition">
                Trends
              </Link>
              <Link href="/submit" className="text-slate-600 hover:text-blue-600 transition">
                Submit Bracket
              </Link>
              <Link href="/admin" className="text-slate-400 hover:text-slate-600 transition">
                Admin
              </Link>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
        <footer className="bg-white border-t border-slate-200 py-4 text-center text-slate-400 text-sm">
          Fantasy Big Brother © {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
