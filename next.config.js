/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'api.football-data.org', 
      'crests.football-data.org'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'crests.football-data.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.football-data.org',
        port: '',
        pathname: '/**',
      }
    ],
  },
}

module.exports = nextConfig