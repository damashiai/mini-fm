/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "coverartarchive.org" },
      { protocol: "https", hostname: "archive.org" },
    ],
  },
  experimental: {
    // Keep barrel imports (lucide-react, ai) out of the shared bundles —
    // noticeably faster dev compiles and smaller first-load JS.
    optimizePackageImports: ["lucide-react", "ai", "zustand", "music-metadata-browser"],
  },
};

module.exports = nextConfig;
