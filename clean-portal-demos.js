#!/usr/bin/env node
/**
 * Remove os mat-cards hardcoded do portal.html
 * Substitui por container vazio com loader — loadMaterials() do JS injetará os reais.
 */
const fs = require('fs');
const path = require('path');

const portalPath = path.join(__dirname, 'portal.html');
let html = fs.readFileSync(portalPath, 'utf-8');

// Sentinelas — o padrão é <div id="XXX-tab-YYY"> ... <div class="materials-grid"> [DEMO] </div> </div>
// Vamos substituir o conteúdo do materials-grid dos 4 blocos identificados por um placeholder.

const targets = [
  { id: 'parents-tab-materiais', label: 'Materiais para pais' },
  { id: 'parents-tab-atividades', label: 'Atividades em casa' },
  { id: 'partners-tab-protocolos', label: 'Protocolos clínicos' },
  { id: 'partners-tab-escola', label: 'Kit escola' },
];

let changes = 0;
for (const t of targets) {
  // Regex: casa do id da tab até o próximo </div> que fecha o materials-grid
  // Padrão específico: <div ... id="{id}">\n    <div class="materials-grid">\n...\n    </div>\n  </div>
  const startMarker = `<div class="tab-content active" id="${t.id}">`;
  const startMarker2 = `<div class="tab-content" id="${t.id}">`;

  let idxStart = html.indexOf(startMarker);
  if (idxStart === -1) idxStart = html.indexOf(startMarker2);
  if (idxStart === -1) {
    console.log(`⚠️  Não encontrado: ${t.id}`);
    continue;
  }

  // Achar o materials-grid abertura logo após
  const gridOpen = html.indexOf('<div class="materials-grid">', idxStart);
  if (gridOpen === -1 || gridOpen - idxStart > 200) {
    console.log(`⚠️  materials-grid não encontrado logo após ${t.id}`);
    continue;
  }

  // Achar o </div> que fecha esse materials-grid — contar aberturas/fechamentos
  let depth = 1;
  let pos = gridOpen + '<div class="materials-grid">'.length;
  while (pos < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', pos);
    const nextClose = html.indexOf('</div>', pos);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + 4;
    } else {
      depth--;
      pos = nextClose + 6;
    }
  }
  const gridClose = pos; // posição logo após o </div> final do materials-grid

  // Substituir todo o conteúdo entre gridOpen e gridClose por um container vazio
  const before = html.slice(0, gridOpen);
  const after = html.slice(gridClose);
  const replacement = `<div class="materials-grid"><p style="color:var(--txl);font-size:.9rem;grid-column:1/-1;text-align:center;padding:2rem">Carregando materiais...</p></div>`;
  html = before + replacement + after;
  changes++;
  console.log(`✅ ${t.label} (id=${t.id}) — demo removido`);
}

fs.writeFileSync(portalPath, html, 'utf-8');
console.log(`\n📝 ${changes}/${targets.length} blocos limpos em portal.html\n`);
