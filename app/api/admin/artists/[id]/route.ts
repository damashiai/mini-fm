import { NextResponse } from "next/server";
import { requireAdmin } from "../../_auth";

const FIELDS = ["name", "bio", "image_url", "musicbrainz_id"] as const;

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
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });
  const { error } = await gate.db.from("artists").update(patch).eq("id", id);
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
  // song_artists has no cascade — refuse rather than orphan or wipe songs.
  const { count } = await gate.db
    .from("song_artists")
    .select("song_id", { count: "exact", head: true })
    .eq("artist_id", id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `Artist still has ${count} song(s) — reassign or delete them first.` },
      { status: 409 },
    );
  }
  await gate.db.from("album_artists").delete().eq("artist_id", id);
  const { error } = await gate.db.from("artists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
