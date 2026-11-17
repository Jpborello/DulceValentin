import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildBackup, isBackupConfigured } from '@/lib/backupBuilder';

// Respaldo para el agente de la PC del local (print-agent/agent.js).
// El agente lo pide cada X horas y guarda la copia en el disco de esa PC:
// es el "punto local" del respaldo (la nube es Supabase).
//
// Se autentica con el header x-agent-secret. Usa BACKUP_AGENT_SECRET si esta
// cargado y, si no, el mismo PRINT_AGENT_SECRET de la impresora. Ojo: este
// secreto da acceso a TODA la base, asi que no se comparte con nadie.
//
// GET ?part=snapshot -> { snapshot, timestamp, dateStr, missingTables }
// GET ?part=csv      -> { csvFiles, timestamp, dateStr }
// Va en dos partes para no pasar el limite de tamaño de respuesta de Vercel.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAgentAuthorized(req) {
  const expected = process.env.BACKUP_AGENT_SECRET || process.env.PRINT_AGENT_SECRET;
  const provided = req.headers.get('x-agent-secret') || '';
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req) {
  if (!isAgentAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!isBackupConfigured()) {
    return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.' }, { status: 500 });
  }

  const part = new URL(req.url).searchParams.get('part') || 'snapshot';
  if (!['snapshot', 'csv'].includes(part)) {
    return NextResponse.json({ error: 'part debe ser snapshot o csv' }, { status: 400 });
  }

  try {
    const { snapshot, timestamp, dateStr, missingTables, csvFiles } = await buildBackup();
    if (part === 'csv') return NextResponse.json({ csvFiles, timestamp, dateStr });
    return NextResponse.json({ snapshot, timestamp, dateStr, missingTables });
  } catch (error) {
    console.error('Respaldo para el agente falló:', error);
    return NextResponse.json({ error: error?.message || 'Error al armar el respaldo' }, { status: 500 });
  }
}
