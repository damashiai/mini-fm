"use client";

import { useState } from "react";

/**
 * Cover art with shimmer placeholder + fade-in on load, so grids and heroes
 * never flash empty boxes while images travel.
 */
export default function CoverImage({
  src,
  alt,
  className = "",
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span className={`relative block overflow-hidden bg-card ${className}`}>
      {!loaded && <span aria-hidden className="skeleton absolute inset-0" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}
