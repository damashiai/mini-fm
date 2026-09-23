"use client";

import { useRef, useState } from "react";
import { parseBlob } from "music-metadata-browser";
import { X } from "lucide-react";
import { stripLrc } from "@/lib/lrclib";
import type { FinalizePayload } from "@/app/api/admin/finalize/route";

type Stage =
  | "queued"
  | "hashing"
  | "duplicate"
  | "parsing"
  | "uploading"
  | "enriching"
  | "ready"
  | "saving"
  | "done"
  | "error";

interface QueueItem {
  key: string;
  file: File;
  stage: Stage;
  note?: string;
  hash?: string;
  storagePath?: string;
  draft: {
    title: string;
    artists: string; // comma-separated (features/collabs)
    album: string;
    albumType: "album" | "single" | "ep";
    durationSeconds: number | null;
    releaseDate: string;
    languageCode: string;
    isInstrumental: boolean;
    plainLyrics: string;
    syncedLyrics: string;
    coverUrl: string;
    musicbrainzId: string;
    isrc: string;
    genres: string; // comma-separated
    artistImage: string;
    artistMusicbrainzIds: string;
    albumMusicbrainzId: string;
  };
}

const LANGUAGES = [
  "en", "hi", "es", "pa", "ta", "te", "fr", "ko", "ja", "pt",
  "de", "it", "ml", "bn", "mr", "gu", "other",
];

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(file: File): Promise<string> {
  return sha256Hex(await file.arrayBuffer());
}

/** ID3 dates are often year-only — keep only full YYYY-MM-DD values. */
function extractFullDate(value: unknown): string {
  const m = String(value ?? "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/**
 * Last-resort duration: decode the actual file in-browser. ID3 duration can
 * be missing and MusicBrainz often lacks length — but duration is required
 * for lyrics-version matching, so never leave it null when the bytes are
 * right here. 15s safety cap so one odd file can't stall the queue.
 */
function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(v);
    };
    const timer = setTimeout(() => done(null), 15_000);
    const url = URL.createObjectURL(file);
    const el = document.createElement("audio");
    el.preload = "metadata";
    el.onloadedmetadata = () =>
      done(Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration) : null);
    el.onerror = () => done(null);
    el.src = url;
  });
}

/** Map one of our public images URLs back to its bucket path (else null). */
function coverStoragePath(url: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prefix = base ? `${base}/storage/v1/object/public/images/` : "/images/";
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length).split("?")[0] ?? "";
  if (!path.startsWith("covers/") || path.includes("..")) return null;
  return path;
}

function emptyDraft(filename: string): QueueItem["draft"] {
  return {
    title: filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim(),
    artists: "",
    album: "",
    albumType: "album",
    durationSeconds: null,
    releaseDate: "",
    languageCode: "en",
    isInstrumental: false,
    plainLyrics: "",
    syncedLyrics: "",
    coverUrl: "",
    musicbrainzId: "",
    isrc: "",
    genres: "",
    artistImage: "",
    artistMusicbrainzIds: "",
    albumMusicbrainzId: "",
  };
}

export default function BatchUploadForm() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [savingAll, setSavingAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Live mirror of drafts so async pipeline steps always see fresh edits.
  const itemsRef = useRef(new Map<string, QueueItem["draft"]>());
  itemsRef.current = new Map(items.map((i) => [i.key, i.draft]));

  const snapshot = (key: string): QueueItem["draft"] =>
    itemsRef.current.get(key) ?? emptyDraft("");

  const patch = (key: string, p: Partial<QueueItem>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...p } : it)));
  const patchDraft = (key: string, d: Partial<QueueItem["draft"]>) =>
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, draft: { ...it.draft, ...d } } : it)),
    );

  // Content hashes already seen in THIS batch — catches re-drops and same
  // audio under a different filename before any byte hits storage.
  const seenHashes = useRef(new Set<string>());
  const [batchMsg, setBatchMsg] = useState<string | null>(null);

  const fileIdentity = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

  const addFiles = (files: FileList | File[]) => {
    const knownFiles = new Set(items.map((it) => fileIdentity(it.file)));
    const fresh: QueueItem[] = [];
    let skipped = 0;
    [...files].forEach((file, i) => {
      if (knownFiles.has(fileIdentity(file))) {
        skipped++;
        return;
      }
      knownFiles.add(fileIdentity(file));
      fresh.push({
        key: `${Date.now()}-${i}-${file.name}`,
        file,
        stage: "queued" as Stage,
        draft: emptyDraft(file.name),
      });
    });
    setBatchMsg(skipped > 0 ? `${skipped} file(s) already in the queue — skipped.` : null);
    if (fresh.length === 0) return;
    setItems((prev) => [...prev, ...fresh]);
    fresh.forEach((it) => void processItem(it));
  };

  async function processItem(item: QueueItem) {
    const { key, file } = item;
    try {
      // 1. Hash + duplicate check BEFORE uploading bytes anywhere.
      patch(key, { stage: "hashing" });
      const hash = await sha256(file);
      patch(key, { hash });
      if (seenHashes.current.has(hash)) {
        patch(key, {
          stage: "duplicate",
          note: "Same audio is already in this batch — skipped before uploading.",
        });
        return;
      }
      seenHashes.current.add(hash);
      const dupRes = await fetch(`/api/admin/check-hash?hash=${hash}`);
      const dup = dupRes.ok ? await dupRes.json() : { duplicate: false };
      if (dup.duplicate) {
        patch(key, {
          stage: "duplicate",
          note: `Duplicate of “${dup.song?.title ?? "existing track"}” — skipped.`,
        });
        return;
      }

      // 2. ID3 / audio tags → pre-fill.
      patch(key, { stage: "parsing" });
      try {
        const meta = await parseBlob(file, { duration: true });
        const c = meta.common ?? {};
        const pic = c.picture?.[0];
        patchDraft(key, {
          title: c.title ?? item.draft.title,
          artists: c.artist ?? c.artists?.join(", ") ?? "",
          album: c.album ?? "",
          durationSeconds: meta.format.duration ? Math.round(meta.format.duration) : null,
          // Store a full date or nothing: year-only tags ("2019") are truthy
          // enough to block the MusicBrainz date in the merge below, yet
          // invalid for both the date input and the DB date column.
          releaseDate: extractFullDate(c.date ?? c.year),
          plainLyrics: Array.isArray(c.lyrics) ? c.lyrics.flat().join("\n") : "",
        });
        // Embedded cover → upload to the public images bucket.
        if (pic?.data) {
          const blob = new Blob([pic.data as unknown as BlobPart], {
            type: pic.format || "image/jpeg",
          });
          const coverUrl = await uploadCover(new File([blob], "cover.jpg", { type: blob.type }));
          if (coverUrl) patchDraft(key, { coverUrl });
        }
      } catch {
        /* tags missing — admin fills manually */
      }

      // 3. Direct-to-storage audio upload (browser → Supabase, no Next.js body).
      // Paths are content-addressed (tracks/<sha256>.<ext>): if these exact
      // bytes are already stored — e.g. a retried/failed earlier attempt —
      // the server reports exists:true and we skip the PUT entirely.
      patch(key, { stage: "uploading" });
      const ext = file.name.split(".").pop() ?? "";
      const signRes = await fetch("/api/admin/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          kind: "audio",
          hash,
          ext,
        }),
      });
      if (!signRes.ok) throw new Error("Could not mint upload URL");
      const { path, signedUrl, exists } = (await signRes.json()) as {
        path: string;
        signedUrl: string | null;
        exists: boolean;
      };
      if (exists) {
        patch(key, {
          storagePath: path,
          note: "Identical bytes already in storage — reusing the existing file, nothing re-uploaded.",
        });
      } else {
        if (!signedUrl) throw new Error("Could not mint upload URL");
        const put = await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "audio/mpeg" },
          body: file,
        });
        if (!put.ok) throw new Error("Storage upload failed");
        patch(key, { storagePath: path });
      }

      // 4. MusicBrainz enrichment (cover, release date, ISRC, artist genres).
      patch(key, { stage: "enriching" });
      const draft = snapshot(key);
      try {
        const enRes = await fetch("/api/admin/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draft.title,
            artist: draft.artists.split(",")[0]?.trim(),
            album: draft.album || undefined,
          }),
        });
        if (enRes.ok) {
          const en = await enRes.json();
          if (en.warning) {
            patch(key, {
              note: `MusicBrainz lookup failed (${en.warning}) — fill fields manually, the track still saves.`,
            });
          }
          patchDraft(key, {
            coverUrl: draft.coverUrl || en.album?.coverArtUrl || "",
            // MusicBrainz dates are authoritative full dates — they win over
            // ID3 values (which are often year-only or release-variant).
            releaseDate: en.album?.releaseDate || draft.releaseDate || "",
            musicbrainzId: en.track?.musicbrainzId || "",
            isrc: en.track?.isrc || "",
            durationSeconds: draft.durationSeconds ?? en.track?.durationSeconds ?? null,
            albumType: en.album?.albumType ?? draft.albumType,
            album: draft.album || en.album?.title || "",
            genres: en.genres?.join(", ") || "",
            artistImage: en.artists?.[0]?.imageUrl || "",
            artistMusicbrainzIds: (en.artists ?? []).map((a: { musicbrainzId: string }) => a.musicbrainzId).join(", "),
            albumMusicbrainzId: en.album?.musicbrainzId || "",
          });
        }
      } catch {
        /* enrichment optional */
      }

      // 5. lrclib lyrics prefill.
      try {
        const d2 = snapshot(key);
        const lyRes = await fetch("/api/admin/lyrics-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            track: d2.title,
            artist: d2.artists.split(",")[0]?.trim(),
            album: d2.album || undefined,
            durationSeconds: d2.durationSeconds ?? undefined,
          }),
        });
        if (lyRes.ok) {
          const ly = await lyRes.json();
          patchDraft(key, {
            isInstrumental: ly.status === "instrumental" ? true : d2.isInstrumental,
            plainLyrics: d2.plainLyrics || ly.plainLyrics || "",
            syncedLyrics: ly.syncedLyrics || "",
          });
        }
      } catch {
        /* lyrics optional */
      }

      // 6. Duration guarantee: ID3 and MusicBrainz both miss it sometimes,
      // but lyrics matching needs it — decode the file itself as fallback.
      if (snapshot(key).durationSeconds == null) {
        const probed = await probeDuration(file).catch(() => null);
        if (probed != null) patchDraft(key, { durationSeconds: probed });
      }

      // 7. Language: instrumentals file under "other" with no AI call;
      // otherwise Jev classifies title/album/artists/genres + lyrics
      // (unicode-script heuristic if Jev is unreachable). Pre-fill only —
      // the review form stays editable.
      try {
        const d3 = snapshot(key);
        if (d3.isInstrumental) {
          patchDraft(key, { languageCode: "other" });
        } else {
          const lyricsText = (
            d3.plainLyrics || stripLrc(d3.syncedLyrics)
          ).slice(0, 1500);
          const langRes = await fetch("/api/admin/detect-language", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: d3.title,
              artists: d3.artists.split(",").map((s) => s.trim()).filter(Boolean),
              album: d3.album || null,
              genres: d3.genres.split(",").map((s) => s.trim()).filter(Boolean),
              lyricsText,
            }),
          });
          if (langRes.ok) {
            const lj = (await langRes.json()) as {
              languageCode: string | null;
              source: string;
            };
            if (lj.languageCode) patchDraft(key, { languageCode: lj.languageCode });
          }
        }
      } catch {
        /* language stays at the "en" default — admin corrects in review */
      }

      patch(key, { stage: "ready" });
    } catch (e) {
      patch(key, { stage: "error", note: e instanceof Error ? e.message : "failed" });
    }
  }

  async function uploadCover(file: File): Promise<string | null> {
    // Content-addressed like audio: same image bytes → same object, no dupes.
    const bytes = await file.arrayBuffer();
    const hash = await sha256Hex(bytes);
    const signRes = await fetch("/api/admin/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        kind: "image",
        hash,
        ext: file.name.split(".").pop() ?? "",
      }),
    });
    if (!signRes.ok) return null;
    const { path, signedUrl, exists } = (await signRes.json()) as {
      path: string;
      signedUrl: string | null;
      exists: boolean;
    };
    if (!exists) {
      if (!signedUrl) return null;
      const put = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: bytes,
      });
      if (!put.ok) return null;
    }
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    return `${base}/storage/v1/object/public/images/${path}`;
  }

  /** Mint + PUT the audio bytes (idempotent under content-addressed paths). */
  async function ensureBytesUploaded(item: QueueItem): Promise<string | null> {
    if (!item.hash) return null;
    const signRes = await fetch("/api/admin/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: item.file.name,
        contentType: item.file.type,
        kind: "audio",
        hash: item.hash,
        ext: item.file.name.split(".").pop() ?? "",
      }),
    });
    if (!signRes.ok) return null;
    const { path, signedUrl, exists } = (await signRes.json()) as {
      path: string;
      signedUrl: string | null;
      exists: boolean;
    };
    if (!exists) {
      if (!signedUrl) return null;
      const put = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": item.file.type || "audio/mpeg" },
        body: item.file,
      });
      if (!put.ok) return null;
    }
    patch(item.key, { storagePath: path });
    return path;
  }

  async function saveItem(item: QueueItem, retried = false): Promise<boolean> {
    const d = item.draft;
    if (!d.title.trim() || !d.artists.trim() || !item.storagePath || !item.hash) return false;
    patch(item.key, { stage: "saving", note: undefined });
    const payload: FinalizePayload = {
      title: d.title.trim(),
      artistNames: d.artists.split(",").map((s) => s.trim()).filter(Boolean),
      albumTitle: d.album.trim() || null,
      albumType: d.albumType,
      durationSeconds: d.durationSeconds,
      filePath: item.storagePath,
      fileHash: item.hash,
      coverArtUrl: d.coverUrl || null,
      releaseDate: d.releaseDate || null,
      languageCode: d.languageCode || null,
      isInstrumental: d.isInstrumental,
      plainLyrics: d.plainLyrics || null,
      syncedLyrics: d.syncedLyrics || null,
      lyricsSource: d.syncedLyrics || d.plainLyrics ? "lrclib/id3" : null,
      musicbrainzId: d.musicbrainzId || null,
      isrc: d.isrc || null,
      artistImageUrl: d.artistImage || null,
      artistMusicbrainzIds: d.artistMusicbrainzIds.split(",").map((s) => s.trim()).filter(Boolean),
      albumMusicbrainzId: d.albumMusicbrainzId || null,
      genreNames: d.genres.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const res = await fetch("/api/admin/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 409) {
      patch(item.key, { stage: "duplicate", note: "Duplicate file — already in catalog." });
      return false;
    }
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        fileDiscarded?: boolean;
      };
      // Bytes went missing (discarded by a failed attempt, deleted
      // externally) — the File is still held, so re-upload and retry once.
      if ((j.code === "FILE_GONE" || j.fileDiscarded) && !retried) {
        patch(item.key, { note: "Stored bytes went missing — re-uploading, then retrying…" });
        const path = await ensureBytesUploaded(item);
        if (!path) {
          patch(item.key, { stage: "error", note: "Re-upload failed — drop the file again." });
          return false;
        }
        return saveItem({ ...item, storagePath: path }, true);
      }
      patch(item.key, { stage: "error", note: j.error ?? "save failed" });
      return false;
    }
    patch(item.key, { stage: "done" });
    return true;
  }

  const saveAll = async () => {
    setSavingAll(true);
    for (const it of items) {
      if (it.stage === "ready" || it.stage === "error") {
        const cur = itemsRef.current.get(it.key);
        if (cur) await saveItem({ ...it, draft: cur });
      }
    }
    setSavingAll(false);
  };

  const readyCount = items.filter((i) => i.stage === "ready").length;

  /** Remove a card; if its audio/cover already reached storage without being
   *  finalized, delete the orphan so the bucket doesn't fill with dead files. */
  const removeItem = async (item: QueueItem) => {
    if (item.stage === "saving") return;
    const finalized = item.stage === "done";
    setItems((prev) => prev.filter((it) => it.key !== item.key));
    if (item.hash) seenHashes.current.delete(item.hash);
    if (finalized) return; // catalog row owns the file — leave storage alone
    try {
      if (item.storagePath) {
        await fetch("/api/admin/cleanup-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: item.storagePath, kind: "audio" }),
        });
      }
      const coverPath = coverStoragePath(item.draft.coverUrl);
      if (coverPath) {
        await fetch("/api/admin/cleanup-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: coverPath, kind: "image" }),
        });
      }
    } catch {
      /* cleanup is best-effort */
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-2xl border-2 border-dashed border-line bg-coal p-10 text-center transition hover:border-brand"
      >
        <p className="text-lg font-semibold">Drop audio files here, or click to browse</p>
        <p className="mt-1 text-sm text-muted">
          MP3 / M4A / WAV / OGG / FLAC — batch supported. Files upload straight to storage.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {batchMsg && <p className="mt-2 text-xs text-muted">{batchMsg}</p>}

      {items.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted">
            {readyCount} ready · {items.filter((i) => i.stage === "done").length} saved
          </p>
          <button
            onClick={saveAll}
            disabled={savingAll || readyCount === 0}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold hover:bg-brandDark disabled:opacity-50"
          >
            {savingAll ? "Saving…" : `Save all ready (${readyCount})`}
          </button>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {items.map((it) => (
          <article key={it.key} className="rounded-2xl border border-line bg-coal p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold">{it.file.name}</p>
              <span className="flex shrink-0 items-center gap-2">
                <StageBadge stage={it.stage} />
                {it.stage !== "saving" && (
                  <button
                    onClick={() => void removeItem(it)}
                    aria-label={`Remove ${it.file.name} from queue`}
                    title="Remove (deletes unfinalized uploads from storage)"
                    className="rounded-full bg-card p-1 text-muted hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            </div>
            {it.note && <p className="mt-1 text-xs text-muted">{it.note}</p>}
            {(it.stage === "ready" || it.stage === "error" || it.stage === "saving") && (
              <ReviewFields
                item={it}
                onChange={(d) => patchDraft(it.key, d)}
                onSave={() => void saveItem({ ...it, draft: itemsRef.current.get(it.key)! })}
              />
            )}
            {(it.stage === "done" || it.stage === "duplicate") && it.note !== undefined && (
              <p className="mt-2 text-xs text-muted">{it.note}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function StageBadge({ stage }: { stage: Stage }) {
  const colors: Record<Stage, string> = {
    queued: "bg-card text-muted",
    hashing: "bg-card text-yellow-300",
    duplicate: "bg-card text-orange-400",
    parsing: "bg-card text-yellow-300",
    uploading: "bg-card text-blue-300",
    enriching: "bg-card text-blue-300",
    ready: "bg-card text-green-400",
    saving: "bg-card text-blue-300",
    done: "bg-green-900 text-green-200",
    error: "bg-red-900 text-red-200",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[stage]}`}>
      {stage}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-line bg-ink px-2 py-1.5 text-sm outline-none focus:border-brand";

function ReviewFields({
  item,
  onChange,
  onSave,
}: {
  item: QueueItem;
  onChange: (d: Partial<QueueItem["draft"]>) => void;
  onSave: () => void;
}) {
  const d = item.draft;
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <Field label="Title">
        <input value={d.title} onChange={(e) => onChange({ title: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Artists (comma-separated)">
        <input value={d.artists} onChange={(e) => onChange({ artists: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Album">
        <input value={d.album} onChange={(e) => onChange({ album: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Genres (comma-separated)">
        <input value={d.genres} onChange={(e) => onChange({ genres: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Language">
        <select value={d.languageCode} onChange={(e) => onChange({ languageCode: e.target.value })} className={inputCls}>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </Field>
      <Field label="Release date">
        <input type="date" value={d.releaseDate} onChange={(e) => onChange({ releaseDate: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Cover art URL">
        <input value={d.coverUrl} onChange={(e) => onChange({ coverUrl: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Duration (sec)">
        <input
          type="number"
          value={d.durationSeconds ?? ""}
          onChange={(e) => onChange({ durationSeconds: e.target.value ? Number(e.target.value) : null })}
          className={inputCls}
        />
      </Field>
      <div className="flex items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.isInstrumental} onChange={(e) => onChange({ isInstrumental: e.target.checked })} />
          Instrumental
        </label>
        <label className="flex items-center gap-2 text-sm">
          Album type
          <select value={d.albumType} onChange={(e) => onChange({ albumType: e.target.value as "album" | "single" | "ep" })} className="rounded border border-line bg-ink px-1 py-1 text-sm">
            <option value="album">Album</option>
            <option value="single">Single</option>
            <option value="ep">EP</option>
          </select>
        </label>
      </div>
      <div className="sm:col-span-2">
        <button
          onClick={onSave}
          disabled={item.stage === "saving"}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold hover:bg-brandDark disabled:opacity-50"
        >
          {item.stage === "saving" ? "Saving…" : "Save track"}
        </button>
      </div>
    </div>
  );
}
