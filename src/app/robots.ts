import { SITE_URL } from "@/lib/config";
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/login",
        "/signup",
        "/forgot-password",
        "/verify-email",
        "/compose",
        "/api",
        "/settings",
        "/admin",
        "/moderation",
        "/notifications",
        "/auth",
        "/onboarding",
        "/report",
        "/reset-password",
        "/suspended",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
