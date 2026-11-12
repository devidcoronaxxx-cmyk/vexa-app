import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "glxm.cdn.troojin.com",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
              "img-src 'self' https://glxm.cdn.troojin.com https://cdn.discordapp.com https://www.roblox.com https://*.roblox.com data: blob:",
              "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
              "connect-src 'self' https://urenbjultzmpmamcaogv.supabase.co wss://urenbjultzmpmamcaogv.supabase.co https://discord.com https://api.roblox.com https://apis.roblox.com https://github.com https://*.githubusercontent.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/generate",          destination: "/api/actions/generate" },
      { source: "/generate/thinking", destination: "/api/actions/generate/thinking" },
      { source: "/thinking-steps",    destination: "/api/actions/thinking-steps" },
      { source: "/models",            destination: "/api/actions/models" },
      { source: "/health",            destination: "/api/actions/health" },
    ]
  },
};

export default nextConfig;
