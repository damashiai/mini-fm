import { NextResponse } from "next/server";
import { slugify } from "@/lib/utils";
import { requireAdmin } from "../_auth";

/** Genre list with song counts (drives the admin genre manager). */
export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const [{ data: genres }, { data: links }] = await Promise.all([
    gate.db.from("genres").select("id, name, slug").order("name"),
    gate.db.from("song_genres").select("genre_id").limit(5000),
  ]);
  const counts = new Map<string, number>();
  for (const l of links ?? []) counts.set(l.genre_id, (counts.get(l.genre_id) ?? 0) + 1);
  return NextResponse.json({
    genres: (genres ?? []).map((g) => ({ ...g, songCount: counts.get(g.id) ?? 0 })),
  });
}

/** Create a genre (slug kept stable afterwards so genre URLs never break). */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  try {
    const { name } = (await req.json()) as { name?: string };
    const clean = (name ?? "").trim();
    if (!clean) return NextResponse.json({ error: "name required" }, { status: 400 });
    const slug = slugify(clean);
    const { data: existing } = await gate.db
      .from("genres")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "A genre with that slug already exists." }, { status: 409 });
    }
    const { data, error } = await gate.db
      .from("genres")
      .insert({ name: clean, slug })
      .select("id, name, slug")
      .single();
    if (error || !data) throw new Error(error?.message ?? "create failed");
    return NextResponse.json({ genre: { ...data, songCount: 0 } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "create failed" },
      { status: 500 },
    );
  }
}
