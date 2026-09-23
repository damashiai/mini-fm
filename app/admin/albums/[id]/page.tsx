import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import AlbumEditForm from "@/components/AlbumEditForm";

export const metadata: Metadata = { title: "Edit release · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminAlbumEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: album } = await db.from("albums").select("*").eq("id", id).maybeSingle();
  if (!album) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-black">Edit: {album.title}</h1>
      <AlbumEditForm
        albumId={album.id}
        initial={{
          title: album.title,
          coverArtUrl: album.cover_art_url ?? "",
          releaseDate: album.release_date ?? "",
          albumType: album.album_type,
        }}
      />
    </div>
  );
}
