#!/usr/bin/env node
/**
 * Script para criar perfil admin manualmente no Supabase
 * Uso: node create-admin-profile.js
 */

const https = require('https');
const path = require('path');
const fs = require('fs');

// Carregar .env manualmente
const envPath = path.join(__dirname, 'materiais', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2];
});

const SUPABASE_URL = envVars.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Erro: SUPABASE_URL ou SUPABASE_SERVICE_KEY não encontrados em materiais/.env');
  process.exit(1);
}

function httpsRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
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
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function createAdminProfile() {
  try {
    console.log('\n📝 Criando perfil admin...\n');

    const res = await httpsRequest(
      'POST',
      '/rest/v1/profiles',
      {
        id: '553d6c02-b39b-438d-8c13-aff7857632e0',
        full_name: 'Tiago Camargo',
        role: 'admin',
        active: true
      }
    );

    if (res.status >= 400) {
      console.error(`❌ Erro (${res.status}):`, res.body);
      process.exit(1);
    }

    console.log('✅ Perfil admin criado com sucesso!\n');
    console.log('📋 Detalhes:');
    console.log('   Email: tcc55@live.com');
    console.log('   Nome: Tiago Camargo');
    console.log('   Role: admin');
    console.log('   Status: ativo\n');
    console.log('🎯 Você já pode fazer login no portal! 🚀\n');

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

createAdminProfile();
