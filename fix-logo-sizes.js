#!/usr/bin/env node
/**
 * Aumenta o tamanho do logotipo em todos os materiais e corrige a unidade
 * (estava em px, inconsistente com o resto do documento que é mm/pt para
 * impressão A4 — isso fazia a logo renderizar pequena demais no PDF).
 */
const fs = require('fs');
const path = require('path');

const standardFiles = [
  'materiais/pais/rotina-visual-tea.html',
  'materiais/pais/manejo-comportamentos.html',
  'materiais/pais/higiene-sono-tdah.html',
  'materiais/pais/seletividade-alimentar.html',
  'materiais/pais/atividades-cognitivas.html',
  'materiais/pais/integracao-sensorial.html',
  'materiais/pais/kit-estimulacao-precoce.html',
  'materiais/pais/como-falar-com-escola.html',
  'materiais/pais/diario-observacao.html',
  'materiais/parceiros/protocolo-pts.html',
  'materiais/parceiros/mchat-rf.html',
  'materiais/parceiros/relatorio-evolucao.html',
  'materiais/parceiros/guia-inclusao-escolar.html',
  'materiais/parceiros/guia-direitos.html',
  'materiais/parceiros/tcle.html',
];

let count = 0;

// ── 1. Capas padrão: 200px (≈53mm) → 100mm, e troca px→mm para bater com o resto do doc ──
for (const rel of standardFiles) {
  const fp = path.join(__dirname, rel);
  let html = fs.readFileSync(fp, 'utf-8');
  const before = html;

  html = html.replace(
    /\.cover-logo\{width:200px;height:auto;margin-bottom:40pt;display:block\}/,
    '.cover-logo{width:100mm;height:auto;margin-bottom:16mm;display:block}'
  );

  if (html !== before) {
    fs.writeFileSync(fp, html, 'utf-8');
    count++;
    console.log(`✅ ${rel} — logo 200px → 100mm`);
  } else {
    console.log(`⚠️  ${rel} — padrão não encontrado (já alterado?)`);
  }
}

// ── 2. slides-tea-sala-aula.html: capa (brand-img) + rodapé de cada slide (slide-brand) ──
const slidesPath = path.join(__dirname, 'materiais/parceiros/slides-tea-sala-aula.html');
let slidesHtml = fs.readFileSync(slidesPath, 'utf-8');
const beforeSlides = slidesHtml;

// Capa: 26pt (~9mm) → 90mm de largura
slidesHtml = slidesHtml.replace(
  /\.cover \.brand-img \{ height: 26pt; width: auto; \}/,
  '.cover .brand-img { width: 90mm; height: auto; }'
);

// Rodapé de cada slide de conteúdo: 11pt (~4mm) → 32mm de largura
slidesHtml = slidesHtml.replace(
  /\.slide-brand\{position:absolute;top:12mm;left:20mm;height:11pt;width:auto\}/,
  '.slide-brand{position:absolute;top:12mm;left:20mm;width:32mm;height:auto}'
);

if (slidesHtml !== beforeSlides) {
  fs.writeFileSync(slidesPath, slidesHtml, 'utf-8');
  count++;
  console.log('✅ materiais/parceiros/slides-tea-sala-aula.html — capa e rodapés aumentados');
} else {
  console.log('⚠️  slides-tea-sala-aula.html — padrão não encontrado');
}

// ── 3. portal_programas.html — logo do header (44px → 60px, é página web, não impressa) ──
const portalProgPath = path.join(__dirname, 'portal_programas.html');
let portalProgHtml = fs.readFileSync(portalProgPath, 'utf-8');
const beforePP = portalProgHtml;

portalProgHtml = portalProgHtml.replace(
  'style="height:44px;width:auto;display:block;margin-bottom:14px"',
  'style="height:60px;width:auto;display:block;margin-bottom:14px"'
);

if (portalProgHtml !== beforePP) {
  fs.writeFileSync(portalProgPath, portalProgHtml, 'utf-8');
  count++;
  console.log('✅ portal_programas.html — logo do header 44px → 60px');
} else {
  console.log('⚠️  portal_programas.html — padrão não encontrado');
}

console.log(`\n📝 Total: ${count}/17 arquivos corrigidos\n`);
