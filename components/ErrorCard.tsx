import Link from "next/link";

/** Shared error/not-found card used by every route-level error page. */
export default function ErrorCard({
  code,
  title,
  message,
  homeHref = "/",
  extraHref,
  extraLabel,
}: {
  code: string;
  title: string;
  message: string;
  homeHref?: string;
  extraHref?: string;
  extraLabel?: string;
}) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="text-6xl font-black text-brand">{code}</p>
      <h1 className="mt-4 text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link
          href={homeHref}
          className="rounded-lg bg-brand px-5 py-2 text-sm font-bold hover:bg-brandDark"
        >
          {homeHref === "/admin" ? "Admin home" : "Home"}
        </Link>
        {extraHref ? (
          <Link
            href={extraHref}
            className="rounded-lg border border-line px-5 py-2 text-sm hover:bg-card"
          >
            {extraLabel ?? "Browse"}
          </Link>
        ) : (
          <Link
            href="/explore"
            className="rounded-lg border border-line px-5 py-2 text-sm hover:bg-card"
          >
            Explore
          </Link>
        )}
      </div>
    </div>
  );
}
