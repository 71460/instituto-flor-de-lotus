#!/usr/bin/env node
/**
 * Upload de materiais em massa para Supabase Storage + vinculação no banco.
 * Mapeia arquivos HTML locais aos registros existentes na tabela `materials`.
 */

const https = require('https');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, 'materiais', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2];
});
const SUPABASE_URL = envVars.SUPABASE_URL;
const SUPABASE_KEY = envVars.SUPABASE_SERVICE_KEY;

// Mapeamento arquivo → título no banco → bucket destino
// (o for_role no banco define onde o loadMaterials vai buscar; both = 2 buckets)
const MAP = [
  // PAIS (for_role = parent)
  { file: 'materiais/pais/rotina-visual-tea.html', title: 'Rotina Visual para TEA — Guia Prático para Pais', bucket: 'materiais-pais' },
  { file: 'materiais/pais/manejo-comportamentos.html', title: 'Manejo de Comportamentos Desafiadores — TEA e TDAH', bucket: 'materiais-pais' },
  { file: 'materiais/pais/higiene-sono-tdah.html', title: 'Higiene do Sono em Crianças com TDAH', bucket: 'materiais-pais' },
  { file: 'materiais/pais/seletividade-alimentar.html', title: 'Seletividade Alimentar no TEA — Guia Familiar', bucket: 'materiais-pais' },
  { file: 'materiais/pais/atividades-cognitivas.html', title: '100 Atividades de Estimulação Cognitiva por Faixa Etária', bucket: 'materiais-pais' },
  { file: 'materiais/pais/kit-estimulacao-precoce.html', title: 'Kit Estimulação Precoce 0-3 Anos — 30 Atividades', bucket: 'materiais-pais' },
  { file: 'materiais/pais/como-falar-com-escola.html', title: 'Como Falar com a Escola sobre o seu Filho — Guia Prático', bucket: 'materiais-pais' },
  { file: 'materiais/pais/diario-observacao.html', title: 'Diário de Observação do Paciente — Semanal', bucket: 'materiais-pais' },
  // BOTH (for_role = both, sobe em ambos)
  { file: 'materiais/pais/integracao-sensorial.html', title: 'Integração Sensorial: O que os pais precisam saber', bucket: 'both' },
  // PARCEIROS (for_role = partner)
  { file: 'materiais/parceiros/protocolo-pts.html', title: 'Protocolo PTS — Plano Terapêutico Singular v3.2', bucket: 'materiais-parceiros' },
  { file: 'materiais/parceiros/mchat-rf.html', title: 'Checklist de Rastreamento TEA — M-CHAT-R/F Adaptado', bucket: 'materiais-parceiros' },
  { file: 'materiais/parceiros/relatorio-evolucao.html', title: 'Relatório de Evolução Terapêutica — Template Padrão', bucket: 'materiais-parceiros' },
  { file: 'materiais/parceiros/guia-inclusao-escolar.html', title: 'Guia de Inclusão Escolar — TEA e TDAH', bucket: 'materiais-parceiros' },
  { file: 'materiais/parceiros/slides-tea-sala-aula.html', title: 'Slides: TEA na Sala de Aula — Formação de Professores', bucket: 'materiais-parceiros' },
  { file: 'materiais/parceiros/guia-direitos.html', title: 'Guia de Direitos do Paciente TEA/TDAH — 2025', bucket: 'materiais-parceiros' },
  { file: 'materiais/parceiros/tcle.html', title: 'Termo de Consentimento Livre e Esclarecido (TCLE)', bucket: 'materiais-parceiros' },
];

function httpsRequest(method, urlPath, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL);
    const opts = {
      hostname: u.hostname, port: 443, path: urlPath, method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        ...extraHeaders,
      },
    };
    const req = https.request(opts, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => {
        let parsed = data;
        try { parsed = data ? JSON.parse(data) : null; } catch (e) {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) req.write(body);
      else req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function uploadToBucket(bucket, filename, content) {
  const encodedPath = encodeURIComponent(filename);
  const res = await httpsRequest(
    'POST',
    `/storage/v1/object/${bucket}/${filename}`,
    content,
    { 'Content-Type': 'text/html; charset=utf-8', 'x-upsert': 'true' }
  );
  if (res.status >= 400) {
    throw new Error(`Upload falhou ${bucket}/${filename} (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return filename;
}

function formatSize(bytes) {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

async function updateMaterialByTitle(title, fileUrl, fileType, sizeBytes) {
  const encTitle = encodeURIComponent(title);
  const res = await httpsRequest(
    'PATCH',
    `/rest/v1/materials?title_pt=eq.${encTitle}`,
    { file_url: fileUrl, file_type: fileType, file_size: formatSize(sizeBytes) },
    { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }
  );
  if (res.status >= 400) {
    throw new Error(`Update falhou "${title}" (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return true;
}

async function main() {
  console.log('\n=== UPLOAD DE MATERIAIS EM MASSA ===\n');
  const results = { ok: [], err: [] };

  for (const item of MAP) {
    try {
      const fullPath = path.join(__dirname, item.file);
      if (!fs.existsSync(fullPath)) {
        results.err.push({ title: item.title, reason: `arquivo não encontrado: ${item.file}` });
        console.log(`  ❌ ${item.title} — arquivo não encontrado`);
        continue;
      }
      const content = fs.readFileSync(fullPath);
      const baseName = path.basename(item.file);
      const storageName = `${Date.now()}_${baseName}`;

      console.log(`\n📄 ${item.title}`);
      console.log(`   Arquivo: ${item.file} (${(content.length/1024).toFixed(1)} KB)`);

      // Upload
      let uploadedPath;
      if (item.bucket === 'both') {
        await uploadToBucket('materiais-pais', storageName, content);
        await uploadToBucket('materiais-parceiros', storageName, content);
        console.log(`   ✅ Upload em AMBOS buckets: ${storageName}`);
        uploadedPath = storageName;
      } else {
        await uploadToBucket(item.bucket, storageName, content);
        console.log(`   ✅ Upload em ${item.bucket}: ${storageName}`);
        uploadedPath = storageName;
      }

      // Update registro no banco — preservar file_type original (pdf/doc/video)
      // Buscar tipo já existente antes de fazer PATCH
      const encTitle = encodeURIComponent(item.title);
      const existing = await httpsRequest('GET', `/rest/v1/materials?title_pt=eq.${encTitle}&select=file_type`);
      const existingType = (existing.body && existing.body[0] && existing.body[0].file_type) || 'pdf';
      await updateMaterialByTitle(item.title, uploadedPath, existingType, content.length);
      console.log(`   ✅ Registro atualizado no banco (tipo: ${existingType})`);

      results.ok.push(item.title);
    } catch (err) {
      results.err.push({ title: item.title, reason: err.message });
      console.log(`   ❌ ERRO: ${err.message}`);
    }
  }

  console.log('\n\n=== RESUMO ===');
  console.log(`✅ Sucesso: ${results.ok.length}/${MAP.length}`);
  console.log(`❌ Erros: ${results.err.length}`);
  if (results.err.length) {
    console.log('\nErros detalhados:');
    results.err.forEach(e => console.log(`  - ${e.title}: ${e.reason}`));
  }
  console.log('');
}

main().catch(err => { console.error('Erro fatal:', err); process.exit(1); });
