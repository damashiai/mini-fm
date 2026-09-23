import { NextResponse } from "next/server";
import { requireAdmin } from "../../_auth";

const FIELDS = ["title", "cover_art_url", "release_date", "album_type", "musicbrainz_id"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const f of FIELDS) if (f in body) patch[f] = body[f];
  if (
    typeof patch.release_date === "string" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(patch.release_date)
  ) {
    patch.release_date = null;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });
  const { error } = await gate.db.from("albums").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  // songs.album_id is SET NULL and album_artists cascades — safe to delete.
  const { data: album } = await gate.db
    .from("albums")
    .select("cover_art_url")
    .eq("id", id)
    .maybeSingle();
  const { error } = await gate.db.from("albums").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Best-effort cover cleanup for our own bucket objects (janitor sweeps rest).
  const marker = "/images/";
  const url = album?.cover_art_url ?? "";
  const i = url.indexOf(marker);
  if (i !== -1) {
    const path = url.slice(i + marker.length).split("?")[0];
    if (path && path.startsWith("covers/") && !path.includes("..")) {
      await gate.db.storage.from("images").remove([path]);
    }
  }
  return NextResponse.json({ ok: true });
}
