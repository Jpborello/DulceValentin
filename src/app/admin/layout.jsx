export const metadata = {
  title: 'Panel de Administración',
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
