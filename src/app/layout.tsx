import type { Metadata, Viewport } from "next";
import { Archivo_Black, Space_Grotesk } from "next/font/google";
import "./globals.css";

const head = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-head" });
const body = Space_Grotesk({ weight: ["400", "500", "700"], subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Boleh Gak, Pa?",
  description: "Teman makan keluarga: cek makanan untuk asam urat & darah tinggi.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "Boleh Gak?", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffd23f",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${head.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
