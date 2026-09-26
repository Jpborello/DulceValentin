import './globals.css';
import Script from 'next/script';
import { DM_Sans, DM_Serif_Display } from 'next/font/google';

// Tipografia de marca: DM Serif Display para titulares grandes (H1, titulos
// de seccion, nombres de categoria) y DM Sans para todo lo demas (textos,
// botones y titulos chicos de interfaz del carrito, admin, etc.).
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body-next',
  display: 'swap'
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display-next',
  display: 'swap'
});

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
    default: 'Dulce Valentín — Mayorista de ropa, calzado y lencería en Rosario',
    template: '%s | Dulce Valentín'
  },
  description:
    'Dulce Valentín es mayorista de ropa, calzado, lencería y artículos para bebés en Rosario (Av. Pres. Perón 5349). Venta por mayor con retiro en el local y envíos a todo el país.',
  keywords: [
    'mayorista de ropa Rosario',
    'indumentaria mayorista',
    'calzado mayorista',
    'lencería por mayor',
    'ropa de bebé por mayor',
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
    title: 'Dulce Valentín — Mayorista de ropa, calzado y lencería en Rosario',
    description:
      'Venta por mayor de indumentaria, calzado, lencería y artículos para bebés. Local en Rosario y envíos a todo el país.',
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
    title: 'Dulce Valentín — Mayorista de ropa, calzado y lencería en Rosario',
    description:
      'Venta por mayor de indumentaria, calzado, lencería y artículos para bebés. Local en Rosario y envíos a todo el país.',
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
    <html lang="es" suppressHydrationWarning className={`${dmSans.variable} ${dmSerifDisplay.variable}`}>
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
