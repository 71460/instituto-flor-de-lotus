#!/usr/bin/env node
/**
 * Script para verificar estrutura do Supabase
 * (categorias, materiais existentes, buckets)
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

function httpsRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
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

async function main() {
  console.log('\n=== VERIFICANDO SUPABASE ===\n');

  // Listar categorias
  console.log('📂 CATEGORIAS DE MATERIAIS:');
  const cats = await httpsRequest('GET', '/rest/v1/material_categories?select=*&order=id');
  if (cats.status === 200 && Array.isArray(cats.body)) {
    cats.body.forEach(c => console.log(`  ${c.id}: ${c.icon || ''} ${c.name_pt} (slug: ${c.slug || 'sem-slug'})`));
  } else {
    console.log('  ❌ Erro ao listar categorias:', cats.body);
  }

  // Listar materiais existentes
  console.log('\n📚 MATERIAIS JÁ PUBLICADOS:');
  const mats = await httpsRequest('GET', '/rest/v1/materials?select=id,title_pt,for_role,category_id,is_featured&order=created_at.desc&limit=20');
  if (mats.status === 200 && Array.isArray(mats.body)) {
    if (mats.body.length === 0) {
      console.log('  (nenhum material publicado ainda)');
    } else {
      mats.body.forEach(m => console.log(`  • [${m.for_role}] ${m.title_pt} (cat=${m.category_id}${m.is_featured ? ', destaque' : ''})`));
    }
  } else {
    console.log('  ❌ Erro ao listar materiais:', mats.body);
  }

  // Listar buckets do Storage
  console.log('\n🗂️  BUCKETS DE STORAGE:');
  const buckets = await httpsRequest('GET', '/storage/v1/bucket');
  if (buckets.status === 200 && Array.isArray(buckets.body)) {
    buckets.body.forEach(b => console.log(`  • ${b.name} (${b.public ? 'público' : 'privado'})`));
  } else {
    console.log('  ❌ Erro ao listar buckets:', buckets.body);
  }

  console.log('\n=== FIM ===\n');
}

main().catch(err => console.error('❌ Erro:', err.message));
