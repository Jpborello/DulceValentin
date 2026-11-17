import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/adminAuth';
import { buildBackup, isBackupConfigured } from '@/lib/backupBuilder';

// Boton "Respaldar en 1 clic" del panel. Devuelve el snapshot para que el
// navegador lo guarde en IndexedDB y lo descargue. Ademas intenta escribirlo
// en disco, pero OJO: eso escribe en la maquina donde corre el servidor. En
// Vercel no es la PC del local (y el disco es de solo lectura), asi que ahi
// ni se intenta: la copia fisica en la PC del local la hace el print-agent
// (ver /api/admin/backups/agent y print-agent/agent.js).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

export async function POST(req) {
  if (!isBackupConfigured() || !supabaseAdmin) {
    return NextResponse.json(
      { error: 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor: sin ella el respaldo saldría incompleto.' },
      { status: 500 }
    );
  }

  const denied = await requireAdmin(req, supabaseAdmin);
  if (denied) return denied;

  try {
    const { snapshot, timestamp, dateStr, missingTables, csvFiles } = await buildBackup();

    const homeDir = process.env.USERPROFILE || process.env.HOME || os.homedir();
    const backupDir = path.join(homeDir, 'Backups_DulceValentin');

    let savedToDisk = false;
    let diskError = null;
    let savedMasterJsonPath = '';

    if (process.env.VERCEL) {
      diskError = 'El servidor está en la nube (Vercel): no puede escribir en la PC del local. La copia física la hace el agente del local; esta quedó en la descarga del navegador.';
    } else {
      try {
        fs.mkdirSync(backupDir, { recursive: true });
        snapshot.windowsPath = backupDir;
        savedMasterJsonPath = path.join(backupDir, `backup_dulce_valentin_${timestamp}.json`);
        const jsonString = JSON.stringify(snapshot, null, 2);
        fs.writeFileSync(savedMasterJsonPath, jsonString, 'utf8');
        fs.writeFileSync(path.join(backupDir, 'base_completa_reciente.json'), jsonString, 'utf8');
        fs.writeFileSync(path.join(backupDir, `catalogo_productos_${dateStr}.csv`), csvFiles.catalogo, 'utf8');
        fs.writeFileSync(path.join(backupDir, `stock_por_talle_y_color_${dateStr}.csv`), csvFiles.stockVariantes, 'utf8');
        fs.writeFileSync(path.join(backupDir, `ventas_y_pedidos_${dateStr}.csv`), csvFiles.ventas, 'utf8');
        fs.writeFileSync(path.join(backupDir, `clientes_y_contactos_${dateStr}.csv`), csvFiles.clientes, 'utf8');
        savedToDisk = true;
      } catch (fsErr) {
        snapshot.windowsPath = null;
        console.warn('Advertencia al escribir en disco físico:', fsErr?.message);
        diskError = fsErr?.message || 'Error de escritura en disco';
      }
    }

    return NextResponse.json({
      success: true,
      savedToDisk,
      diskError,
      backupDir: savedToDisk ? backupDir : null,
      missingTables,
      filePath: savedMasterJsonPath,
      timestamp,
      counts: snapshot.counts,
      snapshot,
      csvFiles
    });
  } catch (error) {
    console.error('Error generando respaldo local de Dulce Valentín:', error);
    return NextResponse.json(
      { error: error?.message || 'Error interno al exportar respaldo' },
      { status: 500 }
    );
  }
}
