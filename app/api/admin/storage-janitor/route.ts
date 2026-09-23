import { NextResponse } from "next/server";
import { requireAdmin } from "../_auth";

/**
 * Storage janitor: deletes bucket objects nothing references — the orphans
 * left by interrupted/failed uploads (pre-content-addressing paths, abandoned
 * review items, replaced covers). Only objects OLDER than the cutoff are
 * touched, so in-flight batch items (freshly uploaded, awaiting Save) are
 * never at risk. Catalog-referenced files are never deleted.
 */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  let olderThanHours = 24;
  try {
    const body = (await req.json()) as { olderThanHours?: number };
    if (body.olderThanHours && body.olderThanHours > 0) {
      olderThanHours = Math.min(24 * 30, body.olderThanHours);
    }
  } catch {
    /* empty body → defaults */
  }
  const cutoff = Date.now() - olderThanHours * 3600_000;
  const db = gate.db;

  const [{ data: songs }, { data: songCovers }, { data: albums }, { data: artists }] =
    await Promise.all([
      db.from("songs").select("file_path"),
      db.from("songs").select("cover_art_url"),
      db.from("albums").select("cover_art_url"),
      db.from("artists").select("image_url"),
    ]);

  const referencedAudio = new Set((songs ?? []).map((s) => s.file_path));
  const referencedImages = new Set<string>();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const prefix = `${base}/storage/v1/object/public/images/`;
  for (const row of [...(songCovers ?? []), ...(albums ?? []), ...(artists ?? [])]) {
    const url =
      (row as { cover_art_url?: string | null; image_url?: string | null }).cover_art_url ??
      (row as { image_url?: string | null }).image_url;
    if (url?.startsWith(prefix)) {
      referencedImages.add(url.slice(prefix.length).split("?")[0]!);
    }
  }

  async function sweep(bucket: "audio" | "images", dir: string, referenced: Set<string>) {
    let offset = 0;
    const limit = 1000;
    let checked = 0;
    let deleted = 0;
    let skipped = 0;
    for (;;) {
      const { data, error } = await db.storage.from(bucket).list(dir, { limit, offset });
      if (error || !data?.length) break;
      const stale: string[] = [];
      for (const f of data) {
        if (!f.name || f.name.startsWith(".")) continue; // keep placeholders
        const full = `${dir}/${f.name}`;
        if (referenced.has(full)) continue;
        const age = f.created_at ? new Date(f.created_at).getTime() : NaN;
        if (!Number.isFinite(age)) {
          skipped++; // unknown age → leave it; never guess
          continue;
        }
        if (age < cutoff) stale.push(full);
      }
      if (stale.length > 0) {
        const { error: delError } = await db.storage.from(bucket).remove(stale);
        if (!delError) deleted += stale.length;
      }
      checked += data.length;
      if (data.length < limit) break;
      offset += limit;
    }
    return { checked, deleted, skipped };
  }

  const [audio, images] = await Promise.all([
    sweep("audio", "tracks", referencedAudio),
    sweep("images", "covers", referencedImages),
  ]);
  return NextResponse.json({ audio, images, olderThanHours });
}
