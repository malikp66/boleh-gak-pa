import type { Metadata, Viewport } from "next";
import { Archivo_Black, Space_Grotesk } from "next/font/google";
import { ToastProvider } from "@/components/Alerts";
import { SITE_DESC, SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

const head = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-head" });
const body = Space_Grotesk({ weight: ["400", "500", "700"], subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} · Cek makanan untuk diabetes & asam urat`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESC,
  applicationName: SITE_NAME,
  keywords: [
    "makanan untuk diabetes", "makanan untuk asam urat", "makanan untuk darah tinggi", "pantangan asam urat", "pantangan diabetes",
    "makanan kolesterol", "bolehkah makan", "cek makanan", "kalkulator makanan sehat", "aplikasi diet orang tua", "gizi makanan Indonesia",
  ],
  category: "health",
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "Boleh Gak?", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: SITE_NAME,
    title: `${SITE_NAME} · Cek dulu sebelum makan`,
    description: SITE_DESC,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} · Cek dulu sebelum makan`, description: SITE_DESC },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
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
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
