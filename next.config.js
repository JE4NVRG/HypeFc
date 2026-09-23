/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'api.football-data.org', 
      'crests.football-data.org',
      'a.espncdn.com'
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
      },
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
}

module.exports = nextConfig