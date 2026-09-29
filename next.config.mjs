/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // El service worker de la PWA nunca se tiene que quedar viejo en el
  // navegador: si no, los celulares siguen con la version anterior.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' }
        ]
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }]
      },
      {
        source: '/admin.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }]
      }
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'revrbrrzlnweuxwhpgei.supabase.co',
        pathname: '/storage/v1/object/public/**'
      }
    ]
  }
};

export default nextConfig;
