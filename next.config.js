/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'img.icons8.com',
      },
    ],
  },
  webpack(config) {
    config.experiments = { ...config.experiments, topLevelAwait: true };
    return config;
  },
  async headers() {
    return [
      {
        // 全てのルートに適用
        source: '/(.*)',
        headers: [
          {
            // MIMEタイプスニッフィング防止
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // クリックジャッキング防止（自サイトのiframeのみ許可）
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            // XSS攻撃防止（レガシーブラウザ向け）
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            // リファラー制御
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // 機能の使用制限
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            // HTTPS強制（1年間）
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            // Content Security Policy
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://*.supabase.co https://api.openai.com wss://*.supabase.co https://*.upstash.io",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
