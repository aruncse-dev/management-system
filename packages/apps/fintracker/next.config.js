/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: [
    '@fintracker-vault/ui',
    '@fintracker-vault/types',
    '@fintracker-vault/config',
    '@fintracker-vault/utils',
  ],
};

module.exports = nextConfig;
