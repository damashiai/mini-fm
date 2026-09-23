import { NextResponse } from "next/server";
import { requireAdmin } from "../_auth";

/**
 * Clear ALL play history (plays table) and reset the denormalized
 * songs.play_count counter. Charts rebuild from zero afterwards.
 */
export async function DELETE() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { error: playsError } = await gate.db
    .from("plays")
    .delete()
    .gte("id", 0);
  if (playsError) {
    return NextResponse.json({ error: playsError.message }, { status: 500 });
  }
  const { error: countError } = await gate.db
    .from("songs")
    .update({ play_count: 0 })
    .gte("play_count", 0);
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
