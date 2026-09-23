import type { Metadata } from "next";
import LibraryClient from "@/components/LibraryClient";

export const metadata: Metadata = { title: "Your library" };

export default function LibraryPage() {
  return <LibraryClient />;
}
