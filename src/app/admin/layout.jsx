export const metadata = {
  title: 'Panel de Administración',
  // El panel se instala como una app aparte ("DV Admin") con su propio
  // icono, separada de la tienda.
  manifest: '/admin.webmanifest',
  icons: {
    apple: [{ url: '/icons/admin-icon-192.png', sizes: '192x192' }]
  },
  appleWebApp: {
    capable: true,
    title: 'DV Admin',
    statusBarStyle: 'default'
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false
    }
  }
};

export default function AdminLayout({ children }) {
  return children;
}
