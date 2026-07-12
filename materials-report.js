#!/usr/bin/env node
/**
 * Relatório completo de materiais — status, localização, próximos passos
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

const EXPECTED = [
  { title: 'Rotina Visual para TEA — Guia Prático para Pais', role: 'parent' },
  { title: 'Manejo de Comportamentos Desafiadores — TEA e TDAH', role: 'parent' },
  { title: 'Higiene do Sono em Crianças com TDAH', role: 'parent' },
  { title: 'Seletividade Alimentar no TEA — Guia Familiar', role: 'parent' },
  { title: '100 Atividades de Estimulação Cognitiva por Faixa Etária', role: 'parent' },
  { title: 'Kit Estimulação Precoce 0-3 Anos — 30 Atividades', role: 'parent' },
  { title: 'Como Falar com a Escola sobre o seu Filho — Guia Prático', role: 'parent' },
  { title: 'Diário de Observação do Paciente — Semanal', role: 'parent' },
  { title: 'Integração Sensorial: O que os pais precisam saber', role: 'both' },
  { title: 'Protocolo PTS — Plano Terapêutico Singular v3.2', role: 'partner' },
  { title: 'Checklist de Rastreamento TEA — M-CHAT-R/F Adaptado', role: 'partner' },
  { title: 'Relatório de Evolução Terapêutica — Template Padrão', role: 'partner' },
  { title: 'Guia de Inclusão Escolar — TEA e TDAH', role: 'partner' },
  { title: 'Slides: TEA na Sala de Aula — Formação de Professores', role: 'partner' },
  { title: 'Guia de Direitos do Paciente TEA/TDAH — 2025', role: 'partner' },
  { title: 'Termo de Consentimento Livre e Esclarecido (TCLE)', role: 'partner' }
];

(async () => {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║             📊 RELATÓRIO COMPLETO DE MATERIAIS                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const allRes = await req('GET', '/rest/v1/materials_with_category?select=*');
  const allMaterials = allRes.body || [];

  const published = allMaterials.filter(m => m.published);
  const drafts = allMaterials.filter(m => !m.published);
  const existingTitles = new Set(allMaterials.map(m => m.title_pt));
  const missing = EXPECTED.filter(e => !existingTitles.has(e.title));

  // ════════════════════════════════════════════════════════════════
  // 1. PUBLICADOS E PRONTOS
  // ════════════════════════════════════════════════════════════════
  console.log('✅ PUBLICADOS E PRONTOS PARA DOWNLOAD\n');
  console.log('Para PAIS:');
  published.filter(m => m.for_role === 'parent').forEach(m => {
    console.log(`  ✓ ${m.title_pt}`);
    console.log(`    └─ ${m.file_size} | ${m.download_count || 0} acessos`);
  });

  console.log('\nPara PARCEIROS:');
  published.filter(m => m.for_role === 'partner').forEach(m => {
    console.log(`  ✓ ${m.title_pt}`);
    console.log(`    └─ ${m.file_size} | ${m.download_count || 0} acessos`);
  });

  console.log('\nPara AMBOS (Pais + Parceiros):');
  published.filter(m => m.for_role === 'both').forEach(m => {
    console.log(`  ✓ ${m.title_pt}`);
    console.log(`    └─ ${m.file_size} | ${m.download_count || 0} acessos`);
  });

  // ════════════════════════════════════════════════════════════════
  // 2. RASCUNHOS
  // ════════════════════════════════════════════════════════════════
  if (drafts.length > 0) {
    console.log('\n\n📝 RASCUNHOS (NÃO PUBLICADOS)\n');
    drafts.forEach(m => {
      const icon = m.for_role === 'parent' ? '👪' : m.for_role === 'partner' ? '🤝' : '👪🤝';
      console.log(`  ${icon} ${m.title_pt}`);
      console.log(`    └─ Ação: Execute "node publish-all-materials.js" para publicar`);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 3. FALTANDO
  // ════════════════════════════════════════════════════════════════
  if (missing.length > 0) {
    console.log('\n\n❌ FALTANDO (PRECISA CRIAR/PROVIDENCIAR)\n');
    missing.forEach(m => {
      const icon = m.role === 'parent' ? '👪' : m.role === 'partner' ? '🤝' : '👪🤝';
      console.log(`  ${icon} ${m.title}`);
      console.log(`    └─ Role: ${m.role} | Ação: Providenciar arquivo & criar no admin`);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 4. RESUMO EXECUTIVO
  // ════════════════════════════════════════════════════════════════
  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      RESUMO EXECUTIVO                           ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║ Total de Materiais:     ${String(allMaterials.length).padStart(45)}║`);
  console.log(`║   ✅ Publicados:        ${String(published.length).padStart(45)}║`);
  console.log(`║   📝 Rascunhos:         ${String(drafts.length).padStart(45)}║`);
  console.log(`║   ❌ Faltando:          ${String(missing.length).padStart(45)}║`);
  console.log('╠════════════════════════════════════════════════════════════════╣');

  if (drafts.length > 0) {
    console.log('║ ⚠️  AÇÃO NECESSÁRIA:                                            ║');
    console.log('║    $ node publish-all-materials.js                            ║');
  } else if (missing.length > 0) {
    console.log('║ ⚠️  MATERIAIS FALTANDO:                                         ║');
    console.log('║    Providencie os arquivos listados acima                      ║');
  } else {
    console.log('║ ✅ TUDO PRONTO!                                                 ║');
    console.log('║    Todos os 16 materiais estão publicados e disponíveis        ║');
  }

  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Estatísticas por role
  console.log('📈 DISTRIBUIÇÃO POR AUDIENCE:\n');
  console.log(`  👪 Para Pais:              ${published.filter(m => m.for_role === 'parent').length} materiais`);
  console.log(`  🤝 Para Parceiros:         ${published.filter(m => m.for_role === 'partner').length} materiais`);
  console.log(`  👪🤝 Para Ambos:           ${published.filter(m => m.for_role === 'both').length} material(is)\n`);

})().catch(err => {
  console.error('\n❌ ERRO:', err.message);
  process.exit(1);
});
