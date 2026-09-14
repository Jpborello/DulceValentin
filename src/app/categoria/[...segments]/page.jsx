import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { slugify } from '@/lib/slugify';
import { isRetiredSubcategory } from '@/lib/catalogData';
import { normalizeText } from '@/lib/searchUtils';
import { buildProductSlug } from '@/lib/productSlug';
import ShareCategoryButton from '@/components/ShareCategoryButton';
import CategoryGroupCatalog from '@/components/CategoryGroupCatalog';

const SITE_URL = 'https://www.dulcevalentin.com.ar';

// Las 4 tarjetas principales del home (Calzado, Indumentaria, Lencería,
// Bebés) apuntan a esta misma ruta /categoria/<id>. La mayoria de esos ids
// ya coinciden 1 a 1 con una categoria real de Supabase (Calzado, Lencería,
// Bebés), asi que se resuelven solos mas abajo. La unica que NO es una
// categoria real es "Indumentaria": agrupa Hombres + Mujeres + Infantil, y
// esa agrupacion se define aca (solo UI/navegacion, no toca la base).
const GROUP_DEFS = {
  indumentaria: { name: 'Indumentaria', memberNames: ['Hombres', 'Mujeres', 'Infantil'] }
};

// Las categorias reales viven en la tabla "categories" de Supabase (el admin
// las puede editar), pero esa misma tabla tambien guarda configuracion
// interna con ids "_config_..." (alias de transferencia, CUIT, etc.) que
// hay que descartar aca.
async function getAllCategoryDefs() {
  const { data } = await supabase
    .from('categories')
    .select('id, name, subcategories')
    .not('id', 'like', '_config_%');
  return data || [];
}

async function resolveParams(segments) {
  const [firstSlug, subSlug] = segments || [];
  const allCategories = await getAllCategoryDefs();

  const group = GROUP_DEFS[firstSlug];
  if (group) {
    // Por ahora el filtro fino de un grupo (que tier / que subcategoria) es
    // solo interactivo del lado del cliente, no tiene su propia URL — asi
    // que una URL con un segundo segmento para un grupo no es valida.
    if (subSlug) return null;
    const members = group.memberNames
      .map((name) => allCategories.find((c) => normalizeText(c.name) === normalizeText(name)))
      .filter(Boolean);
    if (members.length === 0) return null;
    return { kind: 'group', groupId: firstSlug, groupName: group.name, members };
  }

  const categoryDef = allCategories.find((c) => slugify(c.id) === firstSlug);
  if (!categoryDef) return null;

  let subcategory = null;
  if (subSlug) {
    subcategory = (categoryDef.subcategories || []).find((s) => slugify(s) === subSlug);
    if (!subcategory) return null;
  }

  return {
    kind: 'category',
    categoryId: categoryDef.id,
    categoryName: categoryDef.name,
    subcategory,
    subcategories: categoryDef.subcategories || []
  };
}

async function getProductsForCategories(categoryIds) {
  const { data } = await supabase
    .from('products')
    .select('id, name, category, subcategory, image_url, price, wholesale_price, price_per_size, stock, is_new')
    .in('category', categoryIds)
    .eq('is_active', true)
    // Los marcados "Nuevo Ingreso" (is_new) van primero, y adentro de cada
    // grupo se mantiene el orden alfabetico de siempre.
    .order('is_new', { ascending: false })
    .order('name');
  return data || [];
}

export async function generateMetadata({ params }) {
  const { segments } = await params;
  const resolved = await resolveParams(segments);
  if (!resolved) return {};

  const label = resolved.kind === 'group'
    ? resolved.groupName
    : (resolved.subcategory ? `${resolved.subcategory} de ${resolved.categoryName}` : resolved.categoryName);
  const title = `${label} — Venta Mayorista`;
  const description = `Comprá ${label.toLowerCase()} al por mayor en Dulce Valentín: precios de fábrica, envíos a todo el país y retiro en Rosario, Santa Fe.`;
  const canonicalPath = `/categoria/${segments.join('/')}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'website',
      url: `${SITE_URL}${canonicalPath}`,
      siteName: 'Dulce Valentín',
      title: `${title} | Dulce Valentín`,
      description
    }
  };
}

export default async function CategoryPage({ params }) {
  const { segments } = await params;
  if (!segments || segments.length === 0 || segments.length > 2) notFound();

  const resolved = await resolveParams(segments);
  if (!resolved) notFound();

  const canonicalPath = `/categoria/${segments.join('/')}`;

  let heading, tiers, products, shareLabel, breadcrumbTrail;

  if (resolved.kind === 'group') {
    heading = resolved.groupName;
    shareLabel = resolved.groupName;
    tiers = resolved.members.map((c) => ({
      id: c.name,
      name: c.name,
      subcategories: (c.subcategories || []).filter((s) => !isRetiredSubcategory(c.name, s))
    }));
    products = await getProductsForCategories(resolved.members.map((c) => c.id));
    breadcrumbTrail = [{ name: resolved.groupName, item: `${SITE_URL}${canonicalPath}` }];
  } else {
    heading = resolved.subcategory ? `${resolved.subcategory} de ${resolved.categoryName}` : resolved.categoryName;
    shareLabel = heading;
    tiers = [{
      id: resolved.categoryId,
      name: resolved.categoryName,
      subcategories: (resolved.subcategories || []).filter((s) => !isRetiredSubcategory(resolved.categoryName, s))
    }];
    products = await getProductsForCategories([resolved.categoryId]);
    breadcrumbTrail = resolved.subcategory
      ? [
          { name: resolved.categoryName, item: `${SITE_URL}/categoria/${segments[0]}` },
          { name: resolved.subcategory, item: `${SITE_URL}${canonicalPath}` }
        ]
      : [{ name: resolved.categoryName, item: `${SITE_URL}${canonicalPath}` }];
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      ...breadcrumbTrail.map((b, idx) => ({ '@type': 'ListItem', position: idx + 2, name: b.name, item: b.item }))
    ]
  };

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.map((p, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `${SITE_URL}/producto/${buildProductSlug(p)}`
    }))
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <header className="header-container">
        <div className="header-top">
          📍 ROSARIO (SANTA FE) — CAMILO ALDAO 2715 ESQ. EX GODOY
        </div>
        <div className="header-content">
          <Link href="/" className="brand-logo-wrapper">
            <img src="/logo.png" alt="Logo Dulce Valentín" className="brand-logo-img" />
            <div>
              <div className="brand-title">Dulce Valentín</div>
              <div className="brand-subtitle">Indumentaria Mayorista</div>
            </div>
          </Link>
          <Link href="/" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={16} /> Ver todo el catálogo
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: '1320px', width: '100%', margin: '0 auto', padding: '32px 24px' }}>
        <nav aria-label="breadcrumb" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
          <Link href="/" style={{ color: 'var(--accent-gold-hover)', fontWeight: 600 }}>Inicio</Link>
          {breadcrumbTrail.map((b, idx) => (
            <span key={b.name}>
              {' / '}
              {idx === breadcrumbTrail.length - 1 ? (
                b.name
              ) : (
                <Link href={`/categoria/${segments[0]}`} style={{ color: 'var(--accent-gold-hover)', fontWeight: 600 }}>{b.name}</Link>
              )}
            </span>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px', color: 'var(--text-main)' }}>
            {heading}
          </h1>
          <ShareCategoryButton label={shareLabel} productCount={products.length} />
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Precio mayorista, mínimo de compra $50.000 en pedidos por la web.
        </p>

        <CategoryGroupCatalog
          tiers={tiers}
          initialProducts={products}
          initialSubcategory={resolved.kind === 'category' ? resolved.subcategory : null}
        />
      </main>

      <footer style={{ background: 'var(--bg-surface-dark)', color: 'var(--text-on-dark)', padding: '28px 24px', marginTop: '20px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={15} /> Pte. Perón 5349/5305/5265, Rosario, Santa Fe
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            🕒 Lunes a Sábado de 8 a 17 hs
          </span>
        </div>
      </footer>
    </div>
  );
}
