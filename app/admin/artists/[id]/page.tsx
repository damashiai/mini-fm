import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import ArtistEditForm from "@/components/ArtistEditForm";

export const metadata: Metadata = { title: "Edit artist · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminArtistEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: artist } = await db.from("artists").select("*").eq("id", id).maybeSingle();
  if (!artist) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-black">Edit: {artist.name}</h1>
      <ArtistEditForm
        artistId={artist.id}
        initial={{
          name: artist.name,
          bio: artist.bio ?? "",
          imageUrl: artist.image_url ?? "",
        }}
      />
    </div>
  );
}
