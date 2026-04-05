/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['csv-parse'],
  },
}

module.exports = nextConfig