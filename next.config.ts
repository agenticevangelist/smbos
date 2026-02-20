import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  sassOptions: {
    silenceDeprecations: ['legacy-js-api'],
  },
  serverExternalPackages: [
    '@whiskeysockets/baileys',
    'better-sqlite3',
    'cron-parser',
    'pino',
    'qrcode-terminal',
    '@supabase/supabase-js',
    '@anthropic-ai/sdk',
    'cheerio',
    'gray-matter',
    'js-yaml',
    'node-cron',
  ],
};

export default nextConfig;
