import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function startOfDayIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function startOfWeekIso() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function startOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

async function countVisits(sinceIso) {
  const url = sinceIso
    ? `${supabaseUrl}/rest/v1/page_visits?select=id&created_at=gte.${encodeURIComponent(sinceIso)}`
    : `${supabaseUrl}/rest/v1/page_visits?select=id`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Prefer': 'count=exact',
      'Range': '0-0'
    },
    cache: 'no-store'
  });

  if (!res.ok) return 0;
  const contentRange = res.headers.get('content-range'); // format: "0-0/N"
  const total = contentRange ? parseInt(contentRange.split('/')[1], 10) : 0;
  return isNaN(total) ? 0 : total;
}

// Pais+provincia de cada visita, agrupado por la funcion get_visits_by_region()
// (agregacion server-side en Postgres via RPC: no depende de traer todas las
// filas de page_visits al API, escala aunque la tabla crezca mucho).
// Vercel inyecta la geolocalizacion por IP gratis en los headers
// x-vercel-ip-*, no depende de ninguna API externa paga.
async function getVisitsByRegion() {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_visits_by_region`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Content-Type': 'application/json'
    },
    cache: 'no-store'
  });
  if (!res.ok) return [];

  const rows = await res.json();
  return rows.map((row) => ({
    country: row.country || null,
    region: row.region || null,
    count: typeof row.count === 'string' ? parseInt(row.count, 10) : row.count
  }));
}

async function getVisitCounts() {
  const [total, today, week, month, byRegion] = await Promise.all([
    countVisits(null),
    countVisits(startOfDayIso()),
    countVisits(startOfWeekIso()),
    countVisits(startOfMonthIso()),
    getVisitsByRegion()
  ]);
  return { total, today, week, month, byRegion };
}

function getGeoFromHeaders(request) {
  const country = request.headers.get('x-vercel-ip-country') || null;
  const region = request.headers.get('x-vercel-ip-country-region') || null;
  const cityRaw = request.headers.get('x-vercel-ip-city');
  let city = null;
  if (cityRaw) {
    try {
      city = decodeURIComponent(cityRaw);
    } catch {
      city = cityRaw;
    }
  }
  return { country, region, city };
}

async function insertVisit(geo) {
  await fetch(`${supabaseUrl}/rest/v1/page_visits`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(geo)
  });
}

export async function GET() {
  const counts = await getVisitCounts();
  return NextResponse.json(counts);
}

export async function POST(request) {
  await insertVisit(getGeoFromHeaders(request));
  const counts = await getVisitCounts();
  return NextResponse.json(counts);
}
