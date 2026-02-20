import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  sassOptions: {
    silenceDeprecations: ['legacy-js-api'],
  },
  serverExternalPackages: [
    '@whiskeysockets/baileys',
    'pino',
    'qrcode-terminal',
    '@supabase/supabase-js',
    '@anthropic-ai/sdk',
    'cheerio',
    'gray-matter',
    'js-yaml',
  ],
};

export default nextConfig;
