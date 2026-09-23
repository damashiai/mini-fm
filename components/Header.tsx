"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/charts", label: "Charts" },
  { href: "/library", label: "Library" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="MiniFM home" className="h-9 w-9 rounded-xl shadow-lg shadow-brand/30" />
          <span className="text-lg font-extrabold tracking-tight">
            Mini<span className="text-brand">FM</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-card hover:text-white",
                (pathname === n.href ||
                  (n.href !== "/" && pathname.startsWith(n.href))) &&
                  "bg-card text-white",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <form
          className="ml-auto flex w-full max-w-xs items-center"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/explore?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search songs, artists, albums…"
            className="w-full rounded-full border border-line bg-coal px-4 py-1.5 text-sm outline-none placeholder:text-muted/70 focus:border-brand"
          />
        </form>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 sm:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted",
              pathname === n.href && "bg-card text-white",
            )}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
