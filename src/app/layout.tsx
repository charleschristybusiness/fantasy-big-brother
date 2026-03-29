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
      <body className="min-h-full flex flex-col bg-gray-950 text-white">
        <nav className="bg-gray-900 border-b border-gray-800">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-yellow-400 hover:text-yellow-300">
              🏠 Fantasy Big Brother
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/leaderboard" className="text-gray-300 hover:text-white transition">
                Leaderboard
              </Link>
              <Link href="/houseguests" className="text-gray-300 hover:text-white transition">
                Houseguests
              </Link>
              <Link href="/trends" className="text-gray-300 hover:text-white transition">
                Trends
              </Link>
              <Link href="/compare" className="text-gray-300 hover:text-white transition">
                Compare
              </Link>
              <Link href="/submit" className="text-gray-300 hover:text-white transition">
                Submit Bracket
              </Link>
              <Link href="/admin" className="text-gray-400 hover:text-gray-200 transition">
                Admin
              </Link>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
        <footer className="bg-gray-900 border-t border-gray-800 py-4 text-center text-gray-500 text-sm">
          Fantasy Big Brother © {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
