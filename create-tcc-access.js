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

function req(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL);
    const opts = { hostname: u.hostname, port: 443, path: urlPath, method,
      headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' } };
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
  console.log('\n=== CRIANDO ACESSO URGENTE — REDACTED_EMAIL ===\n');

  const authRes = await req('POST', '/auth/v1/admin/users', {
    email: 'REDACTED_EMAIL',
    password: 'REDACTED_PASSWORD',
    email_confirm: true,
    user_metadata: { full_name: 'Tiago' }
  });

  if (authRes.status >= 400) {
    console.error(`❌ Erro ao criar usuário (${authRes.status}):`, JSON.stringify(authRes.body));
    if (authRes.body && /password/i.test(JSON.stringify(authRes.body))) {
      console.error('\n⚠️  Provável causa: senha "3214" (4 caracteres) abaixo do mínimo exigido pelo Supabase.');
      console.error('    Rode novamente com uma senha mais longa, ex: node create-tcc-access.js --pass=SUASENHA\n');
    }
    process.exit(1);
  }
  const userId = authRes.body.id;
  console.log(`✅ Usuário criado: ${userId}`);

  const profRes = await req('POST', '/rest/v1/profiles', {
    id: userId,
    full_name: 'Tiago',
    role: 'parent',
    active: true
  });
  if (profRes.status >= 400) {
    console.error(`❌ Erro ao criar perfil (${profRes.status}):`, JSON.stringify(profRes.body));
    process.exit(1);
  }
  console.log('✅ Perfil criado: role=parent');

  console.log('\n=== PRONTO ===');
  console.log('• Email:  REDACTED_EMAIL');
  console.log('• Senha:  REDACTED_PASSWORD');
  console.log('• Role:   parent (Área dos Pais)');
  console.log('\n🎯 Já pode logar no portal agora.\n');
})().catch(err => { console.error('Erro fatal:', err.message); process.exit(1); });
