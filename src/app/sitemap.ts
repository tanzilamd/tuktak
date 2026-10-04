import { SITE_URL } from "@/lib/config";
import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL;
  return ["", "/discover", "/community", "/privacy", "/terms"].map((path) => ({
    url: base + path,
    changeFrequency: "weekly",
  }));
}
