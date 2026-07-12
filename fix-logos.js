#!/usr/bin/env node
/**
 * Substitui o texto "flor de lótus" (logotipo textual) pela imagem real
 * do logo em todos os materiais novos criados nesta sessão.
 */
const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, 'materiais/ebook-normas-tea/imagens/logo-instituto.png');
const logoBase64 = fs.readFileSync(logoPath).toString('base64');
const logoDataUri = `data:image/png;base64,${logoBase64}`;

// ── 1. Arquivos padrão com .cover-logo (capa vertical, 245mm/265mm) ──
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

let fixedCount = 0;

for (const rel of standardFiles) {
  const fp = path.join(__dirname, rel);
  let html = fs.readFileSync(fp, 'utf-8');

  const before = html;

  // Atualiza a regra CSS .cover-logo (era estilo de texto; vira container de imagem)
  html = html.replace(
    /\.cover-logo\s*\{[^}]*\}/,
    '.cover-logo{width:200px;height:auto;margin-bottom:40pt;display:block}'
  );

  // Substitui a div de texto pela tag de imagem
  html = html.replace(
    /<div class="cover-logo">flor de lótus<\/div>/,
    `<img class="cover-logo" src="${logoDataUri}" alt="Instituto Flor de Lótus">`
  );

  if (html !== before) {
    fs.writeFileSync(fp, html, 'utf-8');
    fixedCount++;
    console.log(`✅ ${rel}`);
  } else {
    console.log(`⚠️  ${rel} — nenhuma alteração (padrão não encontrado)`);
  }
}

// ── 2. slides-tea-sala-aula.html — capa (.brand) + rodapé de cada slide (.slide-brand) ──
const slidesPath = path.join(__dirname, 'materiais/parceiros/slides-tea-sala-aula.html');
let slidesHtml = fs.readFileSync(slidesPath, 'utf-8');

// CSS: cover .brand vira imagem grande; .slide-brand vira imagem pequena no canto
slidesHtml = slidesHtml.replace(
  /\.cover \.brand \{ color: #F5B8E2; \}/,
  '.cover .brand-img { height: 26pt; width: auto; }'
);
slidesHtml = slidesHtml.replace(
  /\.slide-brand \{[^}]*\}/,
  '.slide-brand{position:absolute;top:12mm;left:20mm;height:11pt;width:auto}'
);

// Capa: <div class="brand" style="...">flor de lótus</div> → <img>
slidesHtml = slidesHtml.replace(
  /<div class="brand" style="font-family: 'Georgia', serif; font-size: 24pt; font-style: italic; margin-bottom: 30pt;">flor de lótus<\/div>/,
  `<img class="brand-img" src="${logoDataUri}" alt="Instituto Flor de Lótus" style="margin-bottom: 30pt;">`
);

// Rodapés dos 15 slides: <div class="slide-brand">flor de lótus</div> → <img>
const slideBrandCount = (slidesHtml.match(/<div class="slide-brand">flor de lótus<\/div>/g) || []).length;
slidesHtml = slidesHtml.replace(
  /<div class="slide-brand">flor de lótus<\/div>/g,
  `<img class="slide-brand" src="${logoDataUri}" alt="Flor de Lótus">`
);

fs.writeFileSync(slidesPath, slidesHtml, 'utf-8');
console.log(`✅ materiais/parceiros/slides-tea-sala-aula.html (capa + ${slideBrandCount} rodapés de slide)`);
fixedCount++;

// ── 3. portal_programas.html — adicionar logo no header ──
const portalProgPath = path.join(__dirname, 'portal_programas.html');
let portalProgHtml = fs.readFileSync(portalProgPath, 'utf-8');

const beforePP = portalProgHtml;
portalProgHtml = portalProgHtml.replace(
  '<div class="hd-in">\n    <h1>Programas de <em>Treinamento</em></h1>',
  `<div class="hd-in">\n    <img src="${logoDataUri}" alt="Instituto Flor de Lótus" style="height:44px;width:auto;display:block;margin-bottom:14px">\n    <h1>Programas de <em>Treinamento</em></h1>`
);

if (portalProgHtml !== beforePP) {
  fs.writeFileSync(portalProgPath, portalProgHtml, 'utf-8');
  console.log(`✅ portal_programas.html (logo adicionada ao header)`);
  fixedCount++;
} else {
  console.log(`⚠️  portal_programas.html — padrão não encontrado`);
}

console.log(`\n📝 Total: ${fixedCount}/17 arquivos corrigidos\n`);
