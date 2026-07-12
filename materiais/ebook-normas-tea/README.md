# 📘 E-book — Intervenções Baseadas em Evidências no TEA

Projeto do material didático premium do Instituto Flor de Lótus (Coleção Prática Clínica & Educação, Vol. 1),
derivado do dossiê técnico da Esteira "Normas (ABA, TEACCH...)", **com as referências normativas corrigidas e verificadas**.

## Arquivos

| Arquivo | O que é |
|---------|---------|
| `ebook-normas-tea.html` | O e-book completo: 30 páginas A4, autocontido (logo embutido), identidade visual do site (rosa #E87EC8 / lilás #7B87C4, Cormorant Garamond + DM Sans). Abre em qualquer navegador e imprime fiel ao A4. |
| `ebook-normas-tea.pdf` | PDF pronto (30 págs.), gerado via Edge headless. Regenerar sempre que o HTML mudar. |
| `imagens/logo-instituto.png` | Logo oficial extraído do site (520×168). |
| `imagens/SOLICITACAO-DE-IMAGENS.md` | Lista das 7 fotos pendentes (placeholders no e-book) com specs e buscas sugeridas. |

## Estrutura do e-book (30 páginas)

- **P. 1–3** Capa · Como usar · Sumário
- **Parte 1 (4–7)** O que é TEA · Níveis de suporte · Sinais precoces/triagem · Práticas baseadas em evidências
- **Parte 2 (8–20)** ABA (fundamentos, ciclo, normas, caso, exercício) · TEACCH (fundamentos, ambiente, caso, exercício) · PBS (fundamentos, plano, exercício) · Comparativo integrador
- **Parte 3 (21–23)** Outras práticas com evidência · O que evitar · Diretrizes internacionais
- **Parte 4 (24–25)** Leis brasileiras · SUS, ANS e escola
- **Parte 5 (26–30)** Checklists (educador/terapeuta/gestor/família) · Gabarito · Glossário · Referências

Exercícios variados por design: múltipla escolha com análise de cenário (p. 12), produção prática com template (p. 16), V/F + mini-plano (p. 19) — gabarito comentado na p. 28.

## ⚠️ Correções feitas em relação ao dossiê original (verificadas em jul/2026)

| No dossiê constava | Verificação | No e-book ficou |
|--------------------|------------|-----------------|
| "Resolução CFP nº 11/2021 — 360h de ABA" | **Não existe** resolução do CFP com esse número/conteúdo em 2021 | Removida; texto correto: não há regulamentação federal da profissão; certificações BCBA/BCaBA etc. |
| "Portaria CONITEC nº 67/2022 — PCDT TEA" | O instrumento real é a **Portaria Conjunta SAES/SCTIE nº 7/2022**, e o PCDT é **específico de comportamento agressivo** no TEA | Citação corrigida, com o escopo real explicitado (p. 25) |
| "Nota Técnica DIREB/DPEE/SEESP (2020)" | Sigla/ano inexistentes; as notas corretas são de 2013/2014 | **NT 24/2013** e **NT 04/2014** MEC/SECADI/DPEE (p. 25) |
| NICE CG170 "2021" | ✅ Correto (2013, atualizada 14/06/2021) | Mantido com data completa |
| CASP "2021, 10–25h crianças pequenas" | 2ª ed. é de **2020**; 10–25h = ABA **focada**; abrangente = 26–40h | Corrigido (p. 10 e 20) |
| Indicadores "≥80% sessões", "40h/ano" | Não são números literais de norma | Mantidos como **metas internas sugeridas**, com aviso de transparência |

## Como regenerar o PDF

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$PWD\ebook-normas-tea.pdf" "file:///$($PWD -replace '\\','/')/ebook-normas-tea.html"
```

(Ou abrir o HTML no navegador → Imprimir → Salvar como PDF, papel A4, margens "Nenhuma", "Gráficos de plano de fundo" ativado.)

## Publicação no site

O site é estático (GitHub → hospedagem). Para publicar:
1. O arquivo já está no repositório em `materiais/ebook-normas-tea/` — basta commit + push;
2. Linkar no menu/rodapé das páginas (ex.: "Materiais educativos") apontando para
   `/materiais/ebook-normas-tea/ebook-normas-tea.html` (leitura online) e `.pdf` (download);
3. Futuro (opcional): oferecer o download via Portal da Família (Supabase) para capturar leads —
   tabela `downloads` + política RLS, no mesmo projeto `imerhiewjfmtzwpqyhcz`.

## Pendências para a versão 1.1

- [ ] Inserir as 7 fotos (ver `imagens/SOLICITACAO-DE-IMAGENS.md`)
- [ ] Nome e registro do(a) revisor(a) técnico(a) (p. 2 e p. 30)
- [ ] Decidir política de licença/distribuição (texto atual: reprodução educacional não comercial com crédito)
- [x] Commit + push (`bc24886`, 12/07/2026) e link no site — página `materiais.html` criada, item "Materiais" no menu e rodapé das 6 páginas, sitemap atualizado
