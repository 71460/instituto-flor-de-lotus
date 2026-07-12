#!/usr/bin/env node
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
      hostname: url.hostname, port: 443, path: path, method: method,
      headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' }
    };
    const req = https.request(options, (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); } catch (e) { resolve({ status: res.statusCode, body: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('\n=== DETALHES DOS MATERIAIS PUBLICADOS ===\n');
  const mats = await httpsRequest('GET', '/rest/v1/materials?select=id,title_pt,for_role,file_url,file_type,file_size,is_featured,is_new,published&order=created_at.desc');
  if (mats.status === 200) {
    mats.body.forEach(m => {
      console.log(`[${m.for_role}] ${m.title_pt}`);
      console.log(`  file_url: ${m.file_url || '(vazio)'}`);
      console.log(`  file_type: ${m.file_type} | size: ${m.file_size || '(vazio)'} | featured: ${m.is_featured} | new: ${m.is_new} | published: ${m.published}`);
      console.log('');
    });
  }

  console.log('\n=== ARQUIVOS NO STORAGE ===\n');
  for (const bucket of ['materiais-pais', 'materiais-parceiros']) {
    console.log(`\n📦 Bucket: ${bucket}`);
    const files = await httpsRequest('POST', `/storage/v1/object/list/${bucket}`, {
      prefix: '', limit: 100, offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    });
    if (files.status === 200 && Array.isArray(files.body)) {
      if (files.body.length === 0) {
        console.log('  (vazio - nenhum arquivo real)');
      } else {
        files.body.forEach(f => console.log(`  • ${f.name} (${f.metadata?.size || '?'} bytes)`));
      }
    } else {
      console.log(`  Erro: ${JSON.stringify(files.body)}`);
    }
  }
}

main().catch(err => console.error('Erro:', err.message));
