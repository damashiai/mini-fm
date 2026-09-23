import type { Metadata } from "next";
import AdminLoginForm from "@/components/AdminLoginForm";

export const metadata: Metadata = { title: "Admin login" };

export default function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-4 py-10">
      <h1 className="text-2xl font-black">Admin sign in</h1>
      <AdminLoginForm />
    </div>
  );
}
