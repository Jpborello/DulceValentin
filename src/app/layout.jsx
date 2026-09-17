import './globals.css';
import Script from 'next/script';

const SITE_URL = 'https://www.dulcevalentin.com.ar';

// Sin esto, algunos navegadores de celular renderizan la pagina con un
// ancho "de escritorio" y despues la recortan — causaba que en mobile se
// viera una sola columna de productos con la siguiente cortada, sin poder
// desplazarse para el costado.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Dulce Valentín — Indumentaria, Calzado y Complementos Mayorista en Rosario',
    template: '%s | Dulce Valentín'
  },
  description:
    'Venta mayorista de indumentaria, calzado y complementos. Envíos a todo el país.', // TODO: completar zona, condiciones de compra minima y retiro en local
  keywords: [
    'indumentaria mayorista',
    'calzado mayorista',
    'mayorista de ropa Argentina',
    'buzos por mayor',
    'camperas por mayor',
    'complementos y accesorios por mayor',
    'Dulce Valentín'
  ],
  authors: [{ name: 'Dulce Valentín' }],
  alternates: {
    canonical: '/'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true
    }
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: SITE_URL,
    siteName: 'Dulce Valentín',
    title: 'Dulce Valentín — Indumentaria, Calzado y Complementos Mayorista',
    description:
      'Catálogo mayorista de Dulce Valentín. Envíos a todo el país y retiro en local.', // TODO: completar
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 896,
        alt: 'Dulce Valentín — Indumentaria Mayorista'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dulce Valentín — Indumentaria, Calzado y Complementos Mayorista',
    description:
      'Catálogo mayorista de Dulce Valentín. Envíos a todo el país y retiro en local.', // TODO: completar
    images: ['/logo.png']
  }
};

// Datos estructurados (Schema.org) para SEO local / GEO: ayuda a que
// Google y los buscadores con IA entiendan que es un comercio físico
// real en Rosario, con horarios, rubro y contacto verificables.
const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ClothingStore',
  name: 'Dulce Valentín',
  image: `${SITE_URL}/logo.png`,
  url: SITE_URL,
  telephone: '+5493415147414',
  priceRange: '$$',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Av. Pres. Perón 5349/5305/5265',
    addressLocality: 'Rosario',
    addressRegion: 'Santa Fe',
    postalCode: 'S2010AAD',
    addressCountry: 'AR'
  },
  // Coordenadas exactas de la ficha de Google Maps del local, para que
  // Google y los buscadores/IA lo posicionen bien en resultados locales.
  geo: {
    '@type': 'GeoCoordinates',
    latitude: -32.9602861,
    longitude: -60.6958208
  },
  hasMap: 'https://maps.app.goo.gl/cnrzyNr8FxRYtqjm7',
  // Aunque el local es de Rosario, vendemos por mayor a todo el pais —
  // ayuda a que no se lo limite solo a busquedas locales de Rosario.
  areaServed: {
    '@type': 'Country',
    name: 'Argentina'
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '08:00',
      closes: '17:00'
    }
  ],
  sameAs: ['https://www.instagram.com/dulcevalentin.unidas/']
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado ANTES de pintar la pagina, para que no se
            vea un flash de tema claro y despues salte a oscuro. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('dulcevalentin_theme');
                  if (saved === 'light' || saved === 'dark') {
                    document.documentElement.setAttribute('data-theme', saved);
                  }
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />

        {/* Meta Pixel Code */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1619985726217301');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=1619985726217301&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {/* End Meta Pixel Code */}

        {children}
      </body>
    </html>
  );
}
