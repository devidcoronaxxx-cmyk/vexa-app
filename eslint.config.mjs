import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      // Images are served unoptimized from external CDNs (Roblox/Discord/unpkg)
      // and next.config.ts sets images.unoptimized: true, so <img> is the right
      // choice here and next/image would add no optimization benefit.
      "@next/next/no-img-element": "off",
    },
  },
  {
    files: ["electron/**/*.js", "scripts/**/*.js", "proxy.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/release/**",
    "**/dist-electron/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
