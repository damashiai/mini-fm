import { NextResponse } from "next/server";
import { requireAdmin } from "../_auth";

/** Duplicate detection: does this SHA-256 file hash already exist? */
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const hash = new URL(req.url).searchParams.get("hash");
  if (!hash) return NextResponse.json({ duplicate: false });
  const { data } = await gate.db
    .from("songs")
    .select("id, title, slug")
    .eq("file_hash", hash)
    .maybeSingle();
  return NextResponse.json({ duplicate: !!data, song: data ?? null });
}
