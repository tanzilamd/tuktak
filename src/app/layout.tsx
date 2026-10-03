import type { Metadata } from "next";
import "@fontsource/hind-siliguri/400.css";
import "@fontsource/hind-siliguri/500.css";
import "@fontsource/hind-siliguri/600.css";
import "@fontsource/hind-siliguri/700.css";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { RightRail } from "@/components/right-rail";
import { viewer } from "@/lib/data";
import { BRAND } from "@/lib/config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: `${BRAND.name} · ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  openGraph: {
    title: BRAND.name,
    description: BRAND.description,
    locale: "bn_BD",
    type: "website",
  },
};
const themeScript = `(()=>{try{const m=matchMedia('(prefers-color-scheme: dark)');const apply=()=>{const t=localStorage.getItem('tuktak-theme')||'system';document.documentElement.dataset.theme=t==='system'?(m.matches?'dark':'light'):t};apply();m.addEventListener('change',apply)}catch{}})()`;
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const v = await viewer();
  return (
    <html lang="bn" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script>{themeScript}</script>
      </head>
      <body>
        <a href="#main" className="skip-link">
          মূল পাতায় যাই
        </a>
        <div className="app-shell">
          <Navigation viewer={v} />
          <main id="main" className="main-column">
            {children}
          </main>
          <RightRail />
        </div>
      </body>
    </html>
  );
}
