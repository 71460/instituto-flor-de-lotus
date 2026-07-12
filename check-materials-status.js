#!/usr/bin/env node
/**
 * Diagnóstico completo de materiais — quais estão publicados, rascunhos, faltando
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

// Materiais esperados conforme upload-materials.js
const EXPECTED = [
  // PAIS
  { title: 'Rotina Visual para TEA — Guia Prático para Pais', role: 'parent' },
  { title: 'Manejo de Comportamentos Desafiadores — TEA e TDAH', role: 'parent' },
  { title: 'Higiene do Sono em Crianças com TDAH', role: 'parent' },
  { title: 'Seletividade Alimentar no TEA — Guia Familiar', role: 'parent' },
  { title: '100 Atividades de Estimulação Cognitiva por Faixa Etária', role: 'parent' },
  { title: 'Kit Estimulação Precoce 0-3 Anos — 30 Atividades', role: 'parent' },
  { title: 'Como Falar com a Escola sobre o seu Filho — Guia Prático', role: 'parent' },
  { title: 'Diário de Observação do Paciente — Semanal', role: 'parent' },
  // BOTH
  { title: 'Integração Sensorial: O que os pais precisam saber', role: 'both' },
  // PARCEIROS
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
  console.log('║     DIAGNÓSTICO: STATUS DE MATERIAIS NO PORTAL                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Buscar todos os materiais do banco
  const allRes = await req('GET', '/rest/v1/materials_with_category?select=*');
  if (allRes.status >= 400) {
    console.error('❌ Erro ao buscar materiais:', allRes.body);
    process.exit(1);
  }

  const allMaterials = allRes.body || [];
  console.log(`📊 Total de materiais no banco: ${allMaterials.length}\n`);

  // Separar por status
  const published = allMaterials.filter(m => m.published);
  const drafts = allMaterials.filter(m => !m.published);

  console.log(`✅ PUBLICADOS: ${published.length}`);
  console.log(`📝 RASCUNHOS: ${drafts.length}`);
  console.log(`❌ FALTANDO: ${EXPECTED.length - allMaterials.length}\n`);

  // Mostrar publicados
  if (published.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MATERIAIS PUBLICADOS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    published.forEach((m, i) => {
      const icon = m.for_role === 'parent' ? '👪' : m.for_role === 'partner' ? '🤝' : '👪🤝';
      const fileInfo = m.file_url ? ` [${m.file_size || '?'}]` : ' [sem arquivo]';
      console.log(`${i + 1}. ${icon} ${m.title_pt}${fileInfo}`);
      console.log(`   └─ Role: ${m.for_role} | Acessos: ${m.download_count || 0}`);
    });
    console.log();
  }

  // Mostrar rascunhos
  if (drafts.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 RASCUNHOS (NÃO PUBLICADOS):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    drafts.forEach((m, i) => {
      const icon = m.for_role === 'parent' ? '👪' : m.for_role === 'partner' ? '🤝' : '👪🤝';
      const fileInfo = m.file_url ? ` [${m.file_size || '?'}]` : ' [sem arquivo]';
      console.log(`${i + 1}. ${icon} ${m.title_pt}${fileInfo}`);
      console.log(`   └─ Role: ${m.for_role} | Status: RASCUNHO`);
    });
    console.log();
  }

  // Mostrar faltando
  const existingTitles = new Set(allMaterials.map(m => m.title_pt));
  const missing = EXPECTED.filter(e => !existingTitles.has(e.title));

  if (missing.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ MATERIAIS FALTANDO (NÃO CRIADOS NO BANCO):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    missing.forEach((m, i) => {
      const icon = m.role === 'parent' ? '👪' : m.role === 'partner' ? '🤝' : '👪🤝';
      console.log(`${i + 1}. ${icon} ${m.title}`);
      console.log(`   └─ Role: ${m.role} | Ação: PROVIDENCIAR & CRIAR`);
    });
    console.log();
  } else {
    console.log('✅ TODOS OS 16 MATERIAIS ESPERADOS EXISTEM NO BANCO!\n');
  }

  // Resumo
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                        RESUMO EXECUTIVO                         ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║ Publicados:    ${String(published.length).padEnd(53)}║`);
  console.log(`║ Rascunhos:     ${String(drafts.length).padEnd(53)}║`);
  console.log(`║ Faltando:      ${String(missing.length).padEnd(53)}║`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (missing.length === 0 && drafts.length > 0) {
    console.log('💡 PRÓXIMO PASSO: Publicar os rascunhos existentes');
    console.log('   node publish-drafts.js\n');
  } else if (missing.length > 0) {
    console.log('💡 PRÓXIMO PASSO: Criar os materiais faltando antes de publicar\n');
  }
})().catch(err => {
  console.error('\n❌ ERRO FATAL:', err.message);
  process.exit(1);
});
