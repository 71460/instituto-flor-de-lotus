#!/usr/bin/env node
/**
 * Publicar TODOS os materiais em massa
 * Garante que materiais em rascunho sejam publicados
 */

const https = require('https');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, 'materiais', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) envVars[m[1]] = m[2];
});

const SUPABASE_URL = envVars.SUPABASE_URL;
const SUPABASE_KEY = envVars.SUPABASE_SERVICE_KEY;

function req(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL);
    const opts = {
      hostname: u.hostname,
      port: 443,
      path: urlPath,
      method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json'
      }
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: d ? JSON.parse(d) : null });
        } catch (e) {
          resolve({ status: res.statusCode, body: d });
        }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║         PUBLICANDO TODOS OS MATERIAIS                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Buscar todos os materiais
  const allRes = await req('GET', '/rest/v1/materials_with_category?select=*');
  if (allRes.status >= 400) {
    console.error('❌ Erro ao buscar materiais:', allRes.body);
    process.exit(1);
  }

  const allMaterials = allRes.body || [];
  const drafts = allMaterials.filter(m => !m.published);
  const alreadyPublished = allMaterials.filter(m => m.published);

  console.log(`📊 Total de materiais: ${allMaterials.length}`);
  console.log(`✅ Já publicados: ${alreadyPublished.length}`);
  console.log(`📝 Rascunhos para publicar: ${drafts.length}\n`);

  if (drafts.length === 0) {
    console.log('✅ TODOS OS MATERIAIS JÁ ESTÃO PUBLICADOS!\n');
    process.exit(0);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PUBLICANDO RASCUNHOS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (const draft of drafts) {
    const publishRes = await req(
      'PATCH',
      `/rest/v1/materials?id=eq.${draft.id}`,
      { published: true }
    );

    if (publishRes.status >= 400) {
      console.log(`❌ ERRO: ${draft.title_pt}`);
      console.log(`   └─ ${publishRes.body.message || 'Erro desconhecido'}`);
    } else {
      console.log(`✅ ${draft.title_pt}`);
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      OPERAÇÃO CONCLUÍDA                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`✅ ${drafts.length} material(is) publicado(s) com sucesso!\n`);
})().catch(err => {
  console.error('\n❌ ERRO FATAL:', err.message);
  process.exit(1);
});
