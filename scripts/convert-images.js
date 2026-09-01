const fs = require('fs');
const path = require('path');
let sharp;

try {
  sharp = require('sharp');
} catch (e) {
  console.error('Error cargando sharp:', e);
  process.exit(1);
}

const inputRoot = 'C:\\Users\\jpbor\\OneDrive\\Escritorio\\elpaquetero\\Indumentaria';
const outputRoot = path.join(__dirname, '..', 'public', 'dulcevalentin_imagenes');

const targetFolders = [
  'Blanqueria',
  'Hombres\\BUZOS',
  'Hombres\\CAMPERAS',
  'Hombres\\PANTALONES',
  'Hombres\\REMERAS Y CHOMBAS',
  'Hombres\\ROPA INTERIOR',
  'infantil',
  'Medias',
  'Mujer\\BUZOS Y MAS',
  'Mujer\\CAMPERAS',
  'Mujer\\MEDIAS',
  'Mujer\\PANTALONES',
  'Mujer\\REMERAS',
  'Mujer\\ROPA INTIMA'
];

async function convertFolder(folderRel) {
  const fullInput = path.join(inputRoot, folderRel);
  const fullOutput = path.join(outputRoot, folderRel);

  if (!fs.existsSync(fullInput)) {
    console.warn(`La carpeta no existe: ${fullInput}`);
    return 0;
  }

  if (!fs.existsSync(fullOutput)) {
    fs.mkdirSync(fullOutput, { recursive: true });
  }

  const files = fs.readdirSync(fullInput);
  let convertedCount = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'].includes(ext)) {
      const inputFilePath = path.join(fullInput, file);
      const baseName = path.basename(file, ext);
      const outputFilePath = path.join(fullOutput, `${baseName}.webp`);

      try {
        await sharp(inputFilePath)
          .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82, effort: 4 })
          .toFile(outputFilePath);

        const inStat = fs.statSync(inputFilePath);
        const outStat = fs.statSync(outputFilePath);
        const savings = Math.round((1 - (outStat.size / inStat.size)) * 100);

        console.log(`✓ ${folderRel}/${baseName}.webp: ${(inStat.size/1024).toFixed(0)}KB -> ${(outStat.size/1024).toFixed(0)}KB (-${savings}%)`);
        convertedCount++;
      } catch (err) {
        console.error(`❌ Error convirtiendo ${file}:`, err.message);
      }
    }
  }

  return convertedCount;
}

async function run() {
  console.log('🚀 Iniciando conversión masiva de imágenes a WebP (Calidad 82%, Max 1000px)...\n');
  let totalConverted = 0;

  for (const folder of targetFolders) {
    console.log(`📁 Procesando: ${folder}...`);
    const count = await convertFolder(folder);
    totalConverted += count;
  }

  console.log(`\n🎉 ¡Conversión completada! Total de imágenes procesadas: ${totalConverted}`);
}

run();
