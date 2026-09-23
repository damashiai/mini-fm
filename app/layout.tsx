import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import Header from "@/components/Header";
import PlayerBar from "@/components/PlayerBar";
import MobilePlayer from "@/components/MobilePlayer";
import QueuePanel from "@/components/QueuePanel";
import AudioEngine from "@/components/AudioEngine";
import SessionInit from "@/components/SessionInit";
import SpaceToggle from "@/components/SpaceToggle";
import ResumeState from "@/components/ResumeState";
import TabSync from "@/components/TabSync";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import LyricsOverlay from "@/components/LyricsOverlay";

export const metadata: Metadata = {
  title: { default: "MiniFM — moods into music", template: "%s · MiniFM" },
  description:
    "MiniFM is a small public audio streaming site. Describe a mood, or explore by genre, artist, album and language.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MiniFM" },
  openGraph: {
    siteName: "MiniFM",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#141414",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen pb-28 md:pb-24">
        <SessionInit />
        <ServiceWorkerRegister />
        <AudioEngine />
        <SpaceToggle />
        <ResumeState />
        <TabSync />
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-6 text-xs text-muted">
          <p>
            MiniFM · moods into music ·{" "}
            <Link href="/admin" className="underline hover:text-white">
              Admin
            </Link>
          </p>
        </footer>
        <PlayerBar />
        <MobilePlayer />
        <QueuePanel />
        <LyricsOverlay />
      </body>
    </html>
  );
}
