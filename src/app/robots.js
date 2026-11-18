const SITE_URL = 'https://www.dulcevalentin.com.ar';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/caja', '/seccion', '/ventas', '/supervisor', '/pedido', '/api/']
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
