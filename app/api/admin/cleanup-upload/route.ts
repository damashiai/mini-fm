import { NextResponse } from "next/server";
import { requireAdmin } from "../_auth";
import { discardUpload } from "@/lib/storage-cleanup";

/**
 * Delete an unreferenced upload artifact (abandoned batch item, replaced
 * cover). Only paths we mint (`tracks/…`, `covers/…`) are accepted, and audio
 * objects are deleted only when no song row references them.
 */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  try {
    const { path, kind } = (await req.json()) as {
      path?: string;
      kind?: "audio" | "image";
    };
    if (!path || path.includes("..")) {
      return NextResponse.json({ error: "invalid path" }, { status: 400 });
    }
    if (kind === "image") {
      if (!path.startsWith("covers/")) {
        return NextResponse.json({ error: "invalid path" }, { status: 400 });
      }
      await gate.db.storage.from("images").remove([path]);
      return NextResponse.json({ ok: true });
    }
    if (!path.startsWith("tracks/")) {
      return NextResponse.json({ error: "invalid path" }, { status: 400 });
    }
    const { data: ref } = await gate.db
      .from("songs")
      .select("id")
      .eq("file_path", path)
      .maybeSingle();
    if (ref) {
      return NextResponse.json({ error: "file is referenced by a song" }, { status: 409 });
    }
    await discardUpload(gate.db, path);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "cleanup failed" }, { status: 500 });
  }
}
