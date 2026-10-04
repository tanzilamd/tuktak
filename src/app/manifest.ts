import type { MetadataRoute } from "next";
import { BRAND, SITE_URL } from "@/lib/config";
export default function manifest(): MetadataRoute.Manifest {
  const home = new URL("/", SITE_URL).href;
  return {
    id: home,
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.description,
    lang: "bn",
    start_url: home,
    scope: home,
    display: "standalone",
    background_color: "#f8f6f1",
    theme_color: "#f8f6f1",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
