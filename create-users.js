#!/usr/bin/env node
/**
 * Script automático de criação de usuários no Supabase
 * Uso: node create-users.js --file usuarios.json
 *
 * Formato do JSON:
 * [
 *   {"email": "pai@example.com", "password": "senha123", "name": "João Silva", "role": "parent"},
 *   {"email": "terapeuta@example.com", "password": "senha456", "name": "Maria Santos", "role": "partner"}
 * ]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config(path.join(__dirname, 'materiais', '.env'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ADMIN_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_ADMIN_KEY) {
  console.error('❌ Erro: SUPABASE_ADMIN_KEY não encontrada');
  process.exit(1);
}

// Parse args
const args = process.argv.slice(2);
let filePath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file') filePath = args[i + 1];
}

if (!filePath) {
  console.error('❌ Uso: node create-users.js --file usuarios.json');
  console.error('\nFormato esperado do JSON:');
  console.error(`[
  {"email": "pai@example.com", "password": "senha123", "name": "João Silva", "role": "parent"},
  {"email": "terapeuta@example.com", "password": "senha456", "name": "Maria Santos", "role": "partner"}
]`);
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`❌ Arquivo não encontrado: ${filePath}`);
  process.exit(1);
}

async function httpsRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_ADMIN_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null,
            headers: res.headers
          });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function createUser(email, password, name, role) {
  // 1. Criar usuário em Auth
  console.log(`  → Criando usuário: ${email} (${role})...`);

  const authRes = await httpsRequest(
    'POST',
    '/auth/v1/admin/users',
    {
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: name }
    }
  );

  if (authRes.status >= 400) {
    throw new Error(`Auth falhou (${authRes.status}): ${JSON.stringify(authRes.body)}`);
  }

  const userId = authRes.body.id;
  console.log(`    ✅ Usuário criado: ${userId}`);

  // 2. Inserir perfil
  console.log(`  → Criando perfil...`);

  const roleMap = { parent: 'parent', partner: 'partner', admin: 'admin', staff: 'staff' };
  const userRole = roleMap[role] || 'parent';

  const profileRes = await httpsRequest(
    'POST',
    '/rest/v1/profiles',
    {
      id: userId,
      full_name: name,
      role: userRole
    }
  );

  if (profileRes.status >= 400) {
    throw new Error(`Perfil falhou (${profileRes.status}): ${JSON.stringify(profileRes.body)}`);
  }

  console.log(`    ✅ Perfil criado (${userRole})`);
  return { userId, email, name, role: userRole };
}

async function main() {
  const users = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  if (!Array.isArray(users)) {
    console.error('❌ JSON deve ser um array de usuários');
    process.exit(1);
  }

  console.log(`\n📥 Criando ${users.length} usuário(s)...\n`);

  const results = [];
  const errors = [];

  for (const user of users) {
    if (!user.email || !user.password || !user.name || !user.role) {
      errors.push(`Usuário incompleto: ${JSON.stringify(user)}`);
      continue;
    }

    try {
      const result = await createUser(user.email, user.password, user.name, user.role);
      results.push(result);
    } catch (err) {
      errors.push(`${user.email}: ${err.message}`);
    }
  }

  console.log(`\n✅ RESUMO:`);
  console.log(`   Criados: ${results.length}/${users.length}`);
  if (errors.length > 0) {
    console.log(`   Erros: ${errors.length}`);
    errors.forEach(e => console.log(`   ❌ ${e}`));
  }

  if (results.length > 0) {
    console.log(`\n📋 Usuários criados com sucesso:`);
    results.forEach(r => console.log(`   • ${r.email} (${r.role}) — ${r.name}`));
  }

  console.log(`\n🎯 Próximo passo: acesse o Portal e teste o login destes usuários.\n`);
}

main().catch(err => {
  console.error(`\n❌ Erro fatal: ${err.message}`);
  process.exit(1);
});
