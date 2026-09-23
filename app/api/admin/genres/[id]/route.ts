import { NextResponse } from "next/server";
import { requireAdmin } from "../../_auth";

/** Rename a genre (slug stays stable so /genre/[slug] URLs never break). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  try {
    const { name } = (await req.json()) as { name?: string };
    const clean = (name ?? "").trim();
    if (!clean) return NextResponse.json({ error: "name required" }, { status: 400 });
    const { error } = await gate.db.from("genres").update({ name: clean }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "rename failed" },
      { status: 500 },
    );
  }
}

/** Delete a genre and unlink it from all songs (songs themselves untouched). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  await gate.db.from("song_genres").delete().eq("genre_id", id);
  const { error } = await gate.db.from("genres").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
