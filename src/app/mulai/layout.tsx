import type { Metadata } from "next";

// halaman pribadi/aplikasi: tidak perlu muncul di mesin pencari
export const metadata: Metadata = {
  title: "Mulai",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
