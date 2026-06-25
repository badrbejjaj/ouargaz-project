/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'exceljs'],
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'bcryptjs']
    return config
  },
}

module.exports = nextConfig
