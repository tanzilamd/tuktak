import type { Metadata } from "next";
import { BRAND, SITE_URL } from "./config";
export function publicMetadata(
  path: string,
  title: string,
  description = BRAND.description,
): Metadata {
  const url = new URL(path, SITE_URL).href;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} · ${BRAND.name}`,
      description,
      url,
      siteName: BRAND.name,
      locale: "bn_BD",
      type: "website",
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
      title: `${title} · ${BRAND.name}`,
      description,
      images: ["/og-image.png"],
    },
  };
}
