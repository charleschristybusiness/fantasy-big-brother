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
        <nav className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-yellow-400 hover:text-yellow-300 transition-colors duration-200 flex items-center gap-2">
              <span className="text-2xl">BB</span>
              <span className="hidden sm:inline">Fantasy Big Brother</span>
              <span className="sm:hidden">FBB</span>
            </Link>
            <div className="flex gap-1 sm:gap-3 text-sm">
              <Link href="/leaderboard" className="text-gray-400 hover:text-yellow-400 transition-colors duration-200 px-2 py-1 rounded-lg hover:bg-gray-800/50">
                Leaderboard
              </Link>
              <Link href="/houseguests" className="text-gray-400 hover:text-yellow-400 transition-colors duration-200 px-2 py-1 rounded-lg hover:bg-gray-800/50">
                Houseguests
              </Link>
              <Link href="/trends" className="text-gray-400 hover:text-yellow-400 transition-colors duration-200 px-2 py-1 rounded-lg hover:bg-gray-800/50">
                Trends
              </Link>
              <Link href="/compare" className="text-gray-400 hover:text-yellow-400 transition-colors duration-200 px-2 py-1 rounded-lg hover:bg-gray-800/50">
                Compare
              </Link>
              <Link href="/submit" className="text-gray-400 hover:text-yellow-400 transition-colors duration-200 px-2 py-1 rounded-lg hover:bg-gray-800/50">
                Submit
              </Link>
              <Link href="/admin" className="text-gray-500 hover:text-gray-300 transition-colors duration-200 px-2 py-1 rounded-lg hover:bg-gray-800/50">
                Admin
              </Link>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
        <footer className="bg-gray-900/50 border-t border-gray-800 py-6 text-center">
          <p className="text-gray-500 text-sm">Fantasy Big Brother &copy; {new Date().getFullYear()}</p>
          <p className="text-gray-600 text-xs mt-1">Draft. Compete. Dominate.</p>
        </footer>
      </body>
    </html>
  );
}
