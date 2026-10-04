import { InteractionSync } from "@/components/interaction-sync";
import type { Metadata, Viewport } from "next";
import "@fontsource/hind-siliguri/400.css";
import "@fontsource/hind-siliguri/500.css";
import "@fontsource/hind-siliguri/600.css";
import "@fontsource/hind-siliguri/700.css";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { RightRail } from "@/components/right-rail";
import { NotificationCount } from "@/components/notification-count";
import { viewer, unreadNotificationCount } from "@/lib/data";
import { BRAND, SITE_URL } from "@/lib/config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
    siteName: BRAND.name,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "টুকটাক — কথা জমাইও না।",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
    description: BRAND.description,
    images: ["/og-image.png"],
  },
};
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f6f1" },
    { media: "(prefers-color-scheme: dark)", color: "#191d1c" },
  ],
};
const themeScript = `(()=>{try{const m=matchMedia('(prefers-color-scheme: dark)');const apply=()=>{const t=localStorage.getItem('tuktak-theme')||'system';document.documentElement.dataset.theme=t==='system'?(m.matches?'dark':'light'):t};apply();m.addEventListener('change',apply)}catch{}})()`;
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const v = await viewer();
  const count = await unreadNotificationCount();
  return (
    <html lang="bn" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script>{themeScript}</script>
      </head>
      <body>
        <a href="#main" className="skip-link">
          মূল পাতায় যাই
        </a>
        <NotificationCount key={v?.id ?? "guest"} initialCount={count}>
          <div className="app-shell">
            <Navigation viewer={v} />
            <main id="main" className="main-column">
              <InteractionSync key={v?.id ?? "guest"} />
              {children}
            </main>
            <RightRail />
          </div>
        </NotificationCount>
      </body>
    </html>
  );
}
