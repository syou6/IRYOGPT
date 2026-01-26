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
        ],
      },
    ];
  },
};

export default nextConfig;
