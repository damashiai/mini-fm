import { supabaseAdmin } from "./supabase-server";

type AdminDb = ReturnType<typeof supabaseAdmin>;

/**
 * Best-effort removal of a just-uploaded audio object when finalize can't use
 * it (duplicate race, validation/DB failure). Upload paths are unique per
 * upload (`tracks/<timestamp>-<name>`), so nothing else can reference them —
 * without this every failed save leaks an orphan into the bucket.
 */
export async function discardUpload(
  db: AdminDb,
  filePath: string | undefined,
): Promise<void> {
  if (!filePath || !filePath.startsWith("tracks/") || filePath.includes("..")) return;
  try {
    await db.storage.from("audio").remove([filePath]);
  } catch {
    /* orphan cleanup must never fail the request */
  }
}
