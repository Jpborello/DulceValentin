/**
 * Sube las fotos de "Remeras y Shorts" a Supabase Storage y carga los 16
 * productos en la tabla `products`.
 *
 *   node scripts/cargar-remeras-y-shorts.js            # corre de verdad
 *   node scripts/cargar-remeras-y-shorts.js --dry-run  # solo muestra qué haría
 *
 * Requiere que ya se haya corrido la migración
 * `supabase/migrations/001_multi_imagen_y_precio_por_talle.sql`.
 *
 * Los productos entran con is_active = false a propósito: se prenden cuando el
 * front sepa leer price_per_size (si no, la adidas talle 6 al 10 se vendería al
 * precio del 1 al 5). Para prenderlos: `node scripts/cargar-remeras-y-shorts.js --activar`.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.join(__dirname, '..');
const CARGA = path.join(ROOT, 'carga');
const IMGS = path.join(CARGA, 'productos');
const MANIFEST = path.join(CARGA, 'productos.json');

const BUCKET = 'Productos';
const PREFIJO = 'remeras-y-shorts';

const DRY = process.argv.includes('--dry-run');
const ACTIVAR = process.argv.includes('--activar');

// --- .env.local (node no lo carga solo; eso lo hace Next) --------------------
function loadEnvLocal() {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const hasService = /^(sb_secret_|eyJ)/.test(SERVICE);
const KEY = hasService ? SERVICE : ANON;

/**
 * Guarda contra un problema real que hay en los scripts viejos de este repo:
 * `upload-to-supabase-storage.js` y `make-bucket-public.js` tienen hardcodeado
 * un anon key cuyo `ref` es pgipeujafjwhqjobcjzw (otro proyecto) mientras la
 * URL apunta a revrbrrzlnweuxwhpgei. Si .env.local no está cargado, esos
 * scripts fallan con errores de auth confusos. Acá se verifica antes de tocar
 * nada.
 */
function refDeLaUrl(u) {
  const m = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(u || '');
  return m ? m[1] : null;
}
function refDelJwt(k) {
  try {
    if (!k || !k.startsWith('eyJ')) return null;   // las sb_publishable_ no llevan ref
    return JSON.parse(Buffer.from(k.split('.')[1], 'base64').toString()).ref || null;
  } catch { return null; }
}

function verificarCredenciales() {
  if (!URL || !ANON) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local');
  }
  const rUrl = refDeLaUrl(URL);
  for (const [nombre, key] of [['anon', ANON], ['service role', hasService ? SERVICE : null]]) {
    const rKey = refDelJwt(key);
    if (rKey && rUrl && rKey !== rUrl) {
      throw new Error(
        `La ${nombre} key es del proyecto "${rKey}" pero la URL apunta a "${rUrl}". ` +
        'Revisá .env.local: son credenciales de proyectos distintos.'
      );
    }
  }
  console.log(`Proyecto : ${rUrl}`);
  console.log(`Key      : ${hasService ? 'service role' : 'anon'}`);
  if (!hasService) {
    console.log('  (sin service role: si las políticas RLS/Storage no dejan escribir, va a fallar)');
  }
}

const ZIP = path.join(ROOT, 'carga-remeras-y-shorts.zip');

/**
 * Extractor de ZIP minimo, sin dependencias. Node no trae unzip pero si zlib,
 * y un zip son entradas DEFLATE (metodo 8) o crudas (metodo 0) indexadas por
 * un Central Directory al final del archivo.
 *
 * Esta aca porque el paso manual de descomprimir se salteaba y el script
 * abortaba antes de hacer nada.
 */
function extraerZip(zipPath, destDir) {
  const buf = fs.readFileSync(zipPath);

  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65535; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error('No parece un ZIP valido: falta el End of Central Directory');

  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  let escritos = 0;

  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('Central Directory corrupto');
    const metodo   = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen  = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commLen  = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const nombre   = buf.toString('utf8', off + 46, off + 46 + nameLen);
    off += 46 + nameLen + extraLen + commLen;

    if (nombre.endsWith('/')) continue;
    const destino = path.join(destDir, nombre);
    if (!path.resolve(destino).startsWith(path.resolve(destDir))) {
      throw new Error('Ruta sospechosa en el zip: ' + nombre);
    }

    const lNameLen  = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const inicio = localOff + 30 + lNameLen + lExtraLen;
    const crudo = buf.subarray(inicio, inicio + compSize);

    let datos;
    if (metodo === 0) datos = crudo;
    else if (metodo === 8) datos = zlib.inflateRawSync(crudo);
    else throw new Error(`Metodo de compresion ${metodo} no soportado en ${nombre}`);

    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, datos);
    escritos++;
  }
  return escritos;
}

function asegurarCarga() {
  if (fs.existsSync(MANIFEST)) return;
  if (!fs.existsSync(ZIP)) {
    throw new Error(`No encuentro ni ${MANIFEST} ni ${ZIP}. Falta el paquete de la carga.`);
  }
  console.log('carga/ no existe, descomprimiendo carga-remeras-y-shorts.zip...');
  const n = extraerZip(ZIP, CARGA);
  console.log(`  ${n} archivos extraidos en carga/`);
}

const sb = () => createClient(URL, KEY, { auth: { persistSession: false } });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@dulcevalentin.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123';

/**
 * Las policies de `products` y de `storage.objects` exigen rol `authenticated`
 * (verificado contra la base: los INSERT/UPDATE estan restringidos a ese rol,
 * el publico solo puede SELECT). Con la anon key pelada, cada escritura vuelve
 * con error de RLS. Con service role no hace falta nada de esto.
 */
async function autenticar(supabase) {
  if (hasService) { console.log('Auth     : service role, no hace falta login'); return; }

  let { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL, password: ADMIN_PASSWORD
  });

  if (!data?.session) {
    console.log(`Auth     : ${ADMIN_EMAIL} no existe todavia, creandolo...`);
    const up = await supabase.auth.signUp({
      email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
      options: { data: { role: 'admin', name: 'Administrador Dulce Valentin' } }
    });
    if (up.error) {
      throw new Error(
        `No se pudo crear ${ADMIN_EMAIL}: ${up.error.message}\n` +
        '  Si dice que hace falta confirmar el mail: Supabase > Authentication >\n' +
        '  Sign In / Providers > Email > desactivar "Confirm email".'
      );
    }
    ({ data, error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL, password: ADMIN_PASSWORD
    }));
  }

  if (!data?.session) {
    throw new Error(
      `No pude autenticarme como ${ADMIN_EMAIL}: ${error?.message || 'sin sesion'}\n` +
      '  Sin sesion, las policies RLS rechazan la escritura. Alternativa: cargar\n' +
      '  SUPABASE_SERVICE_ROLE_KEY en .env.local.'
    );
  }
  console.log(`Auth     : ${ADMIN_EMAIL} (rol authenticated)`);
}

async function asegurarBucket(supabase) {
  // El bucket "Productos" ya fue creado por migracion SQL (publico, con
  // policy de lectura publica y escritura para el rol authenticated). Con
  // anon/authenticated (sin service role) NO tocamos storage.buckets:
  //   - listBuckets() puede devolver éxito con lista vacía (RLS en la
  //     tabla de metadata de buckets, sin relación con los permisos sobre
  //     los objetos), lo que antes hacía creer que el bucket no existía.
  //   - createBucket()/updateBucket() son operaciones sobre storage.buckets
  //     que solo puede hacer el dueño/service role — un authenticated
  //     comun siempre las va a rechazar por RLS, exista o no el bucket.
  // Verificar o crear el bucket por API con una key no-privilegiada no es
  // posible ni necesario: ya está creado. Si en algún momento hiciera
  // falta recrearlo, se hace por SQL (como la vez pasada), no desde acá.
  if (!hasService) {
    console.log(`Bucket   : uso "${BUCKET}" (ya creado por SQL, no lo verifico con esta key)`);
    return BUCKET;
  }

  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.log(`Bucket   : no puedo listar (${error.message}), sigo con "${BUCKET}"`);
    return BUCKET;
  }

  const existente = (buckets || []).find((b) => b.name.toLowerCase() === BUCKET.toLowerCase());
  if (!existente) {
    console.log(`Bucket "${BUCKET}" no existe, creándolo público...`);
    if (DRY) return BUCKET;
    const { error: e } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (e) throw new Error('No se pudo crear el bucket: ' + e.message);
    return BUCKET;
  }
  if (!existente.public) {
    console.log(`Bucket "${existente.name}" es privado, pasándolo a público...`);
    if (!DRY) await supabase.storage.updateBucket(existente.name, { public: true });
  }
  return existente.name;
}

async function subirImagenes(supabase, bucket, productos) {
  let subidas = 0, fallidas = 0;

  for (const p of productos) {
    const publicas = [];
    let thumb = null;

    // Cada foto va en dos tamaños: la grande para el modal y el -thumb para
    // la grilla (16 fotos grandes en el home eran ~2,5 MB por pantalla).
    const archivos = [...p.image_files];
    if (p.thumb_file) archivos.push(p.thumb_file);

    for (const nombre of archivos) {
      const local = path.join(IMGS, nombre);
      if (!fs.existsSync(local)) {
        console.error(`  ! falta el archivo ${nombre}`);
        fallidas++;
        continue;
      }
      const destino = `${PREFIJO}/${nombre}`;

      if (!DRY) {
        const { error } = await supabase.storage.from(bucket).upload(destino, fs.readFileSync(local), {
          contentType: 'image/webp',
          upsert: true
        });
        if (error) {
          console.error(`  ! ${nombre}: ${error.message}`);
          fallidas++;
          continue;
        }
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(destino);
      if (nombre === p.thumb_file) thumb = data.publicUrl;
      else publicas.push(data.publicUrl);
      subidas++;
    }

    p._image_urls = publicas;
    p._thumb_url = thumb;
    console.log(`  ${p.name}: ${publicas.length} fotos${thumb ? ' + miniatura' : ''}`);
  }

  return { subidas, fallidas };
}

async function upsertProductos(supabase, productos) {
  const filas = productos.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category,
    subcategory: p.subcategory,
    price: p.price,
    wholesale_price: p.wholesale_price,
    price_per_size: p.price_per_size,          // null si tiene precio único
    sizes: p.sizes,
    stock_per_size: p.stock_per_size,
    stock: p.stock,
    image_url: p._image_urls[0] || null,       // portada
    image_urls: p._image_urls,
    thumb_url: p._thumb_url,
    description: p.description,
    is_active: ACTIVAR ? true : p.is_active,
    is_offer: p.is_offer,
    is_new: p.is_new,
    is_top_seller: p.is_top_seller,
    is_featured: p.is_featured,
    sales_count: p.sales_count
  }));

  if (DRY) return filas.length;
  const { error } = await supabase.from('products').upsert(filas, { onConflict: 'id' });
  if (error) throw new Error('Error al guardar los productos: ' + error.message);
  return filas.length;
}

async function asegurarSubcategoria(supabase) {
  const { data, error } = await supabase.from('categories').select('*').eq('id', 'Hombres').maybeSingle();
  if (error) { console.warn('  aviso: no se pudo leer la categoría Hombres:', error.message); return; }

  const actuales = Array.isArray(data?.subcategories)
    ? data.subcategories
    : (typeof data?.subcategories === 'string' ? JSON.parse(data.subcategories) : []);

  if (actuales.includes('Remeras y Shorts')) { console.log('  "Remeras y Shorts" ya estaba'); return; }

  const nuevas = [...actuales, 'Remeras y Shorts'];
  if (DRY) { console.log('  agregaría "Remeras y Shorts" a Hombres'); return; }

  const { error: e } = await supabase.from('categories')
    .upsert({ id: 'Hombres', name: data?.name || 'Hombres', subcategories: nuevas }, { onConflict: 'id' });
  if (e) console.warn('  aviso: no se pudo guardar la subcategoría:', e.message);
  else console.log('  "Remeras y Shorts" agregada a Hombres');
}

async function main() {
  console.log('='.repeat(64));
  console.log('Carga de Remeras y Shorts' + (DRY ? '  [DRY RUN — no escribe nada]' : ''));
  verificarCredenciales();
  console.log('='.repeat(64));

  asegurarCarga();
  const productos = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  console.log(`${productos.length} productos en el manifiesto\n`);

  const supabase = sb();
  await autenticar(supabase);
  const bucket = await asegurarBucket(supabase);

  console.log(`\nSubiendo fotos a "${bucket}/${PREFIJO}/"...`);
  const { subidas, fallidas } = await subirImagenes(supabase, bucket, productos);
  console.log(`\n${subidas} archivos subidos, ${fallidas} con error`);
  if (fallidas > 0) throw new Error('Hubo fotos que no se pudieron subir. No se guardan los productos a medias.');

  console.log('\nGuardando productos...');
  const n = await upsertProductos(supabase, productos);
  console.log(`${n} productos guardados`);

  console.log('\nCategoría...');
  await asegurarSubcategoria(supabase);

  console.log('\n' + '='.repeat(64));
  if (ACTIVAR) {
    console.log('LISTO. Los productos quedaron ACTIVOS y visibles en la web.');
  } else {
    console.log('LISTO — pero los productos quedaron APAGADOS (is_active = false).');
    console.log('Se prenden con: node scripts/cargar-remeras-y-shorts.js --activar');
    console.log('Hacelo recién cuando el front lea price_per_size, si no la adidas');
    console.log('talle 6 al 10 se vende a $11.000 en vez de $14.000.');
  }
  console.log('='.repeat(64));
}

main().catch((e) => {
  console.error('\nFalló:', e.message || e);
  process.exitCode = 1;
});
