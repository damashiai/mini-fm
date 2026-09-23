import { NextResponse } from "next/server";
import { requireAdmin } from "../_auth";

/**
 * Direct-to-storage uploads: mints a Supabase Storage SIGNED UPLOAD URL and
 * the browser PUTs bytes straight to Supabase. The file NEVER passes through
 * a Next.js route as a request body — Vercel serverless functions cap bodies
 * ~4.5MB, well under a typical track (spec §5.9).
 *
 * Paths are CONTENT-ADDRESSED (`tracks/<sha256>.<ext>`,
 * `covers/<sha256>.<ext>`): identical bytes always land on the same object,
 * so retries, re-drops and interrupted uploads can never duplicate files —
 * the second upload resolves to the same path and the PUT is skipped
 * (`exists: true`). Orphans from before this scheme are cleaned by
 * POST /api/admin/storage-janitor.
 */
const AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
  "audio/webm",
]);

const AUDIO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/webm": "webm",
};

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const HASH_RE = /^[a-f0-9]{64}$/;

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  try {
    const { filename, contentType, kind, hash } = (await req.json()) as {
      filename?: string;
      contentType?: string;
      kind?: "audio" | "image";
      /** SHA-256 hex of the exact bytes — enables content-addressed paths. */
      hash?: string;
    };
    if (!filename) return NextResponse.json({ error: "missing filename" }, { status: 400 });

    const isImage = kind === "image";
    const bucket = isImage ? "images" : "audio";
    const dir = isImage ? "covers" : "tracks";

    if (!isImage && contentType && !AUDIO_MIME.has(contentType)) {
      return NextResponse.json({ error: `unsupported audio type: ${contentType}` }, { status: 400 });
    }
    if (isImage && contentType && !IMAGE_MIME.has(contentType)) {
      return NextResponse.json({ error: `unsupported image type: ${contentType}` }, { status: 400 });
    }

    if (hash && HASH_RE.test(hash)) {
      const extMap = isImage ? IMAGE_EXT : AUDIO_EXT;
      const ext =
        (contentType && extMap[contentType]) ||
        sanitizedExt(filename, isImage) ||
        (isImage ? "jpg" : "mp3");
      const path = `${dir}/${hash.toLowerCase()}.${ext}`;
      // Already stored? Then there's nothing to upload — reuse the object.
      const { data: found } = await gate.db.storage
        .from(bucket)
        .list(dir, { search: hash.toLowerCase() });
      if (found?.some((f) => f.name === `${hash.toLowerCase()}.${ext}`)) {
        return NextResponse.json({ path, signedUrl: null, exists: true });
      }
      const { data, error } = await gate.db.storage
        .from(bucket)
        .createSignedUploadUrl(path);
      if (error || !data) throw new Error(error?.message ?? "sign failed");
      return NextResponse.json({ path, signedUrl: data.signedUrl, exists: false });
    }

    // Legacy fallback (current client always sends a hash).
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const path = `${dir}/${Date.now()}-${safe}`;
    const { data, error } = await gate.db.storage
      .from(bucket)
      .createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "sign failed");
    return NextResponse.json({ path, signedUrl: data.signedUrl, exists: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "sign failed" },
      { status: 500 },
    );
  }
}

function sanitizedExt(filename: string, isImage: boolean): string | null {
  const raw = (filename.split(".").pop() ?? "").toLowerCase();
  const allowed = isImage
    ? ["jpg", "jpeg", "png", "webp", "gif"]
    : ["mp3", "m4a", "wav", "ogg", "flac", "webm", "aac", "opus"];
  if (!allowed.includes(raw)) return null;
  return raw === "jpeg" ? "jpg" : raw;
}
