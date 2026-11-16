# Correção: PDF borrado ao ampliar (ALEPA-2026)

## Prompt pronto (cole na IA que vai implementar)

```
Aplique o patch `fix-pdf-nitidez-zoom.patch` na raiz do projeto ALEPA-2026.8 e
valide. Siga EXATAMENTE a seção "Comandos" do arquivo INSTRUCOES-IA-fix-pdf-nitidez.md.
Não altere nada além dos 4 arquivos do patch. Se o patch não aplicar, use a seção
"Plano B (edição manual)". Ao final, informe a saída de cada comando e marque os
critérios de aceite. Não refatore, não renomeie, não adicione dependências.
```

## Causa raiz (resumo)

No leitor de PDF, o zoom por pinça e pela barra (1x a 4x) é só `transform: scale()`
sobre um canvas renderizado uma única vez. O efeito de renderização não dependia do
zoom, então o canvas era apenas esticado. Além disso, o DPR era limitado a 2 e
`will-change: transform` fixava a rasterização na escala inicial.

## O que o patch faz

| Arquivo | Mudança |
|---|---|
| `src/lib/pdfRenderScale.ts` (novo) | `computeCanvasPixelRatio`: DPR real x zoom, com teto de nitidez (6), de área (16 M px, limite do iOS) e de lado (8192 px) |
| `src/lib/pdfRenderScale.test.ts` (novo) | 5 testes unitários do cálculo acima |
| `src/components/BookReaderModal.tsx` | `PdfCanvasSheet` recebe `zoomRender`; renderiza fora da tela e troca o canvas sem piscar; spinner só na 1ª renderização; camada de texto só refaz se página/escala de layout mudar; `renderZoom` "assentado" (aguarda 220 ms e fim do gesto, em passos de 0,25); as 4 chamadas de `PdfCanvasSheet` passam `zoomRender={renderZoom}`; classe `is-gesturing` no contêiner |
| `src/index.css` | `will-change: transform` só durante o gesto (`.is-gesturing`) |

O layout (tamanho em CSS px) **não muda**; só aumenta a quantidade de pixels do canvas.

## Comandos

Execute na raiz do projeto (pasta que contém `package.json`), com o arquivo
`fix-pdf-nitidez-zoom.patch` ao lado.

```bash
# 0. Branch de segurança
git checkout -b fix/pdf-nitidez-zoom

# 1. Verificar e aplicar o patch
git apply --check fix-pdf-nitidez-zoom.patch
git apply fix-pdf-nitidez-zoom.patch
# Sem git:  patch -p1 < fix-pdf-nitidez-zoom.patch

# 2. Confirmar arquivos afetados (esperado: 2 modificados + 2 novos)
git status --short

# 3. Dependências, tipos, testes e build
npm install
npm run lint
npx vitest run src/lib/pdfRenderScale.test.ts
npm run build

# 4. Teste manual
npm run dev
```

## Critérios de aceite (QA manual)

1. Abrir um PDF no leitor (modo livro e modo PDF original).
2. Dar zoom por pinça (celular) ou pelos botões + da barra até 3x a 4x e **soltar**.
   Em até ~0,3 s o texto deve ficar nítido (sem serrilhado). Durante o gesto pode
   ficar suave: é esperado.
3. Voltar para 1x: a página continua nítida e sem piscar.
4. Os botões A-/A+ de 60 a 220% continuam funcionando como antes.
5. Selecionar texto (camada de texto) continua alinhado em qualquer zoom.
6. Navegar entre páginas com zoom ativo: sem tela branca prolongada.
7. Temas sépia e noturno: aparência inalterada.
8. Celular (iOS/Android): sem recarga da página ou travamento ao dar zoom 4x em PDFs grandes.
9. `npm run lint`, o teste e o `npm run build` terminam sem erros.

## Plano B (edição manual, se o patch falhar)

1. Criar `src/lib/pdfRenderScale.ts` e o teste conforme o patch.
2. Em `BookReaderModal.tsx`: importar `computeCanvasPixelRatio`; adicionar a prop
   `zoomRender?: number` (padrão 1) a `PdfCanvasSheet`; no `useEffect` de renderização,
   trocar `Math.min(devicePixelRatio, 2)` por `computeCanvasPixelRatio(...)`, renderizar em
   canvas fora da tela e copiar com `drawImage`, e incluir `zoomRender` nas dependências.
3. No componente principal, após `useFullscreenZoom`, criar `renderZoom` com
   `useEffect` + `setTimeout(220)` que só atualiza quando `!zoom.isGesturing`, usando
   `Math.ceil(zoom.scale * 4) / 4`.
4. Passar `zoomRender={renderZoom}` nas 4 chamadas de `<PdfCanvasSheet>`.
5. Adicionar `${zoom.isGesturing ? 'is-gesturing' : ''}` ao `className` do contêiner `zoom-transform-stage`.
6. Em `index.css`, remover `will-change` de `.zoom-transform-stage` e criar
   `.zoom-transform-stage.is-gesturing { will-change: transform; }`.

## Rollback

```bash
git apply -R fix-pdf-nitidez-zoom.patch
```

## Limitações conhecidas (fora do escopo do patch)

- A capa (página 1) das 4 apostilas LaTeX é uma imagem de 96 ppi: continuará suave ao
  ampliar. A correção é regerar a capa com pelo menos 200 ppi no PDF de origem.
- `MediaPlaybackModal.tsx` também usa `.zoom-transform-stage`; deixou de ter
  `will-change` fixo (impacto esperado nulo para vídeo/iframe).
- PDFs abertos em `<iframe>` nativo (`MaterialsView`) ou no Drive `/preview` dependem do
  visualizador do navegador/Google e não são afetados por este patch.
- Este patch foi validado por aplicação (`git apply`/`patch`, com rollback), análise de
  sintaxe e execução dos casos do helper. `npm run lint`, `build` e o teste visual em
  navegador/celular **não** foram executados no ambiente de geração (sem
  `node_modules` nem rede), por isso estão nos critérios de aceite acima.
