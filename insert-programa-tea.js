#!/usr/bin/env node
const https = require('https');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, 'materiais', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
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
      headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json', ...headers } };
    const r = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: d ? JSON.parse(d) : null }); } catch (e) { resolve({ status: res.statusCode, body: d }); } });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  // Arquivo já foi uploaded pelo publish.js — reutilizando o path retornado
  const fileUrl = '1783846190377_programa-completo-tea-v1.zip';
  const fileSize = fs.statSync(path.join(__dirname, 'materiais/programa-tea/programa-completo-tea-v1.zip')).size;
  const sizeMb = (fileSize / (1024*1024)).toFixed(1) + ' MB';

  console.log('\n📥 Inserindo Programa TEA no banco...\n');

  const data = {
    category_id: 'd8578483-32eb-42a5-8b1a-759760856d0d', // Formação Profissional
    for_role: 'partner',
    title_pt: 'Programa TEA na Prática — 30 Atividades',
    title_en: 'ASD in Practice Program — 30 Activities',
    title_es: 'Programa TEA en la Práctica — 30 Actividades',
    desc_pt: 'Programa de treinamento completo (pacote ZIP: e-book PDF de 30 págs + caderno impresso de 34 págs + versão digital interativa HTML) desmembrando as intervenções baseadas em evidências (ABA, TEACCH, PBS) em 30 atividades práticas organizadas em 7 módulos, aproximadamente 14 horas de percurso. Modelo OMS CST (Caregiver Skills Training). Uso profissional exclusivo.',
    desc_en: 'Complete training program (ZIP package: 30-page PDF e-book + 34-page printed workbook + interactive HTML version) breaking down evidence-based interventions (ABA, TEACCH, PBS) into 30 practical activities organized in 7 modules.',
    desc_es: 'Programa de formación completo (paquete ZIP con e-book PDF, cuaderno impreso y versión digital interactiva) que desglosa las intervenciones basadas en evidencia (ABA, TEACCH, PBS) en 30 actividades prácticas.',
    file_url: fileUrl,
    file_type: 'pdf',
    file_size: sizeMb,
    is_new: true,
    is_featured: true,
    published: true,
  };

  const res = await req('POST', '/rest/v1/materials', data, { 'Prefer': 'return=minimal' });
  if (res.status >= 400) {
    console.error(`❌ Erro (${res.status}):`, JSON.stringify(res.body));
    process.exit(1);
  }
  console.log('✅ Programa TEA registrado no banco!');
  console.log(`   Arquivo: materiais-parceiros/${fileUrl}`);
  console.log(`   Público-alvo: PARCEIROS profissionais\n`);
})().catch(err => { console.error('Erro:', err); process.exit(1); });
