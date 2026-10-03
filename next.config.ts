import type { NextConfig } from "next";
const config: NextConfig = {
 output: "standalone", poweredByHeader: false,
 async headers() { return [{source:"/(.*)", headers:[
 {key:"X-Content-Type-Options",value:"nosniff"},
 {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
 {key:"X-Frame-Options",value:"DENY"},
 {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
 {key:"Content-Security-Policy",value:"default-src 'self'; script-src 'self' 'unsafe-inline' " + (process.env.NODE_ENV === "development" ? "'unsafe-eval' " : "") + "https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com" + (process.env.NODE_ENV === "development" ? " http://127.0.0.1:* ws://localhost:*" : "") + "; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"},
 ...(process.env.NODE_ENV === "production" ? [{key:"Strict-Transport-Security",value:"max-age=31536000; includeSubDomains"}] : [])
 ]}]; }
}; export default config;
