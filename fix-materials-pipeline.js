#!/usr/bin/env node
/**
 * Pipeline de correção dos materiais do portal:
 *
 * 1. Converte os 16 guias HTML em PDFs reais (Edge headless) — o Supabase
 *    Storage força text/html → text/plain (anti-phishing), então HTML nunca
 *    renderiza via signed URL; PDF é o formato que os cards já prometem.
 * 2. Sobe os PDFs com Content-Type application/pdf (mesmo prefixo de
 *    timestamp, extensão .pdf). Material "both" vai para os dois buckets.
 * 3. Re-sobe o ZIP do Programa TEA a partir do original local — a cópia no
 *    storage estava corrompida (Buffer serializado como JSON pelo bug do
 *    publish.js, 2,8 MB → 10,6 MB de texto).
 * 4. Corrige no banco: file_url, file_size real, e file_type falsos
 *    (video/doc → pdf; ZIP marcado como pdf → zip).
 * 5. Verifica cada objeto: HEAD (content-type/length) + magic bytes.
 *
 * Uso: node fix-materials-pipeline.js
 */

const https = require('https');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PDF_DIR = path.join(ROOT, 'materiais', 'pdfs');
const ZIP_LOCAL = path.join(ROOT, 'materiais', 'programa-tea', 'programa-completo-tea-v1.zip');

const envContent = fs.readFileSync(path.join(ROOT, 'materiais', '.env'), 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/); if (m) envVars[m[1]] = m[2];
});
const SUPABASE_URL = envVars.SUPABASE_URL;
const SUPABASE_KEY = envVars.SUPABASE_SERVICE_KEY;

function req(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL);
    const opts = { hostname: u.hostname, port: 443, path: urlPath, method,
      headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY, ...headers } };
    const r = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, buffer: Buffer.concat(chunks) }));
    });
    r.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) r.write(body);
      else r.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    r.end();
  });
}

function fmtSize(bytes) {
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

function findLocal(basename) {
  for (const dir of ['materiais/pais', 'materiais/parceiros', 'materiais/programa-tea']) {
    const p = path.join(ROOT, dir, basename);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function convertToPdf(htmlPath, pdfPath) {
  const profile = path.join(os.tmpdir(), 'edge-pdf-profile');
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
  execFileSync(EDGE, [
    '--headless', '--disable-gpu', '--no-pdf-header-footer',
    `--user-data-dir=${profile}`,
    `--print-to-pdf=${pdfPath}`,
    fileUrl,
  ], { stdio: 'pipe', timeout: 60000 });
  if (!fs.existsSync(pdfPath) || fs.statSync(pdfPath).size < 1000) {
    throw new Error(`PDF não gerado ou vazio: ${pdfPath}`);
  }
}

async function uploadObject(bucket, name, buffer, contentType) {
  const res = await req('POST', `/storage/v1/object/${bucket}/${name}`, buffer,
    { 'Content-Type': contentType, 'x-upsert': 'true' });
  if (res.status >= 400) throw new Error(`Upload ${bucket}/${name} falhou (${res.status}): ${res.buffer.toString().slice(0, 200)}`);
}

async function verifyObject(bucket, name, expectedType, expectedLen, magic) {
  const head = await req('HEAD', `/storage/v1/object/${bucket}/${name}`);
  const ct = head.headers['content-type'] || '?';
  const len = Number(head.headers['content-length'] || 0);
  const range = await req('GET', `/storage/v1/object/${bucket}/${name}`, null, { Range: 'bytes=0-4' });
  const start = range.buffer.toString('latin1');
  const ok = ct.startsWith(expectedType) && len === expectedLen && start.startsWith(magic);
  return { ok, ct, len, start: JSON.stringify(start) };
}

async function patchMaterial(id, fields) {
  const res = await req('PATCH', `/rest/v1/materials?id=eq.${id}`, JSON.stringify(fields),
    { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' });
  if (res.status >= 400) throw new Error(`PATCH ${id} falhou (${res.status}): ${res.buffer.toString().slice(0, 200)}`);
}

(async () => {
  console.log('\n══════ PIPELINE DE CORREÇÃO DOS MATERIAIS ══════\n');
  fs.mkdirSync(PDF_DIR, { recursive: true });

  const listRes = await req('GET', '/rest/v1/materials?select=id,title_pt,file_url,file_type,for_role&order=title_pt');
  const materials = JSON.parse(listRes.buffer.toString());
  const failures = [];

  for (const mat of materials) {
    const isZip = mat.file_url.endsWith('.zip');
    const buckets = mat.for_role === 'both' ? ['materiais-pais', 'materiais-parceiros']
                  : mat.for_role === 'parent' ? ['materiais-pais'] : ['materiais-parceiros'];
    console.log(`\n📄 ${mat.title_pt}`);

    try {
      if (isZip) {
        // ── ZIP: re-upload do original íntegro, mesmo nome ──
        const buf = fs.readFileSync(ZIP_LOCAL);
        for (const b of buckets) await uploadObject(b, mat.file_url, buf, 'application/zip');
        await patchMaterial(mat.id, { file_type: 'zip', file_size: fmtSize(buf.length) });
        for (const b of buckets) {
          const v = await verifyObject(b, mat.file_url, 'application/zip', buf.length, 'PK');
          console.log(`   ${v.ok ? '✅' : '❌'} ${b}/${mat.file_url} → ${v.ct}, ${v.len} bytes, inicia ${v.start}`);
          if (!v.ok) failures.push(mat.title_pt);
        }
        continue;
      }

      // ── HTML → PDF ──
      const basename = mat.file_url.replace(/^\d+_/, '');
      const localHtml = findLocal(basename);
      if (!localHtml) throw new Error(`arquivo local não encontrado: ${basename}`);

      const pdfLocal = path.join(PDF_DIR, basename.replace(/\.html$/, '.pdf'));
      convertToPdf(localHtml, pdfLocal);
      const buf = fs.readFileSync(pdfLocal);
      console.log(`   🖨️  PDF gerado: ${fmtSize(buf.length)}`);

      const newName = mat.file_url.replace(/\.html$/, '.pdf');
      for (const b of buckets) await uploadObject(b, newName, buf, 'application/pdf');

      const fields = { file_url: newName, file_type: 'pdf', file_size: fmtSize(buf.length) };
      if (basename === 'integracao-sensorial.html') {
        // desc antiga prometia "vídeo de 18 minutos" — é um guia em PDF
        fields.desc_pt = 'Guia prático da equipe de TO Sensorial do Instituto para famílias.';
        fields.desc_en = 'Practical guide from the Institute\'s Sensory OT team for families.';
        fields.desc_es = 'Guía práctica del equipo de TO Sensorial del Instituto para familias.';
      }
      await patchMaterial(mat.id, fields);

      for (const b of buckets) {
        const v = await verifyObject(b, newName, 'application/pdf', buf.length, '%PDF-');
        console.log(`   ${v.ok ? '✅' : '❌'} ${b}/${newName} → ${v.ct}, ${v.len} bytes, inicia ${v.start}`);
        if (!v.ok) failures.push(mat.title_pt);
      }
    } catch (err) {
      console.log(`   ❌ ERRO: ${err.message}`);
      failures.push(mat.title_pt);
    }
  }

  console.log('\n══════ RESUMO ══════');
  console.log(`Materiais processados: ${materials.length}`);
  console.log(`Falhas: ${failures.length}${failures.length ? ' → ' + failures.join('; ') : ''}`);
  process.exit(failures.length ? 1 : 0);
})().catch(err => { console.error('Erro fatal:', err); process.exit(1); });
