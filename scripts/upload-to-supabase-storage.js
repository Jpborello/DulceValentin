const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
let ws;
try { ws = require('ws'); } catch (e) {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnaXBldWphZmp3aHFqb2Jjanp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4Nzg0MDcsImV4cCI6MjEwMTQ1NDQwN30.A9sRFYI36UvOmjw3fsFGlteutTLsaPRXPszacwysbQk';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  ...(ws ? { realtime: { transport: ws } } : {})
});

const imgRoot = path.join(__dirname, '..', 'public', 'dulcevalentin_imagenes');
const catalogPath = path.join(__dirname, '..', 'src', 'lib', 'catalogData.js');

function getAllWebpFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllWebpFiles(filePath, fileList);
    } else if (file.toLowerCase().endsWith('.webp')) {
      const relPath = path.relative(imgRoot, filePath).replace(/\\/g, '/');
      fileList.push({ filePath, relPath });
    }
  }
  return fileList;
}

async function upload() {
  let bucketName = 'Productos';

  // Check if bucket 'Productos' or 'productos' exists
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets && buckets.length > 0) {
    const found = buckets.find(b => b.name.toLowerCase() === 'productos');
    if (found) {
      bucketName = found.name;
    }
  }

  console.log(`🚀 Subiendo 160 imágenes al Bucket de Supabase: '${bucketName}' manteniendo la estructura de carpetas...\n`);

  const files = getAllWebpFiles(imgRoot);
  let uploadedCount = 0;
  let catalogContent = fs.readFileSync(catalogPath, 'utf8');

  for (const { filePath, relPath } of files) {
    const fileBuffer = fs.readFileSync(filePath);
    
    // Normalize path to remove accents (e.g. É -> E) for Supabase Storage key compatibility
    const destinationPath = relPath
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(destinationPath, fileBuffer, {
        contentType: 'image/webp',
        upsert: true
      });

    if (error) {
      console.error(`❌ Error subiendo '${relPath}':`, error.message);
    } else {
      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(destinationPath);
      const publicUrl = publicUrlData.publicUrl;

      const oldLocalPath = `/dulcevalentin_imagenes/${relPath}`;
      // Replace with public URL safely without $ regex group expansion
      catalogContent = catalogContent.replace(oldLocalPath, () => publicUrl);

      console.log(`✓ [Bucket '${bucketName}'] -> ${destinationPath}`);
      uploadedCount++;
    }
  }

  fs.writeFileSync(catalogPath, catalogContent, 'utf8');
  console.log(`\n🎉 ¡Subida completada con éxito! ${uploadedCount} imágenes subidas a Supabase Storage Bucket '${bucketName}'.`);
}

upload();
