import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  describeMaterialForCatalog,
  isMaterialPendingDefinition,
  standardizeMaterialCatalog,
} from '../data/libraryCatalogUtils';
import type { DocumentIndexChunk, StudyMaterial } from '../types';
import {
  normalizeForIndex,
  searchChunksLexical,
  searchDocumentIndexWithFallback,
} from './documentIndexer';
import {
  classifyMaterialOpeningMode,
  isInAppReadableMaterial,
  parseEpubBuffer,
} from './epubAndHtmlEngine';

describe('Document indexer, EPUB parser & Materials 1/6 preservation', () => {
  it('matches chunks by legal/edital synonyms and filters by discipline and campus', () => {
    const chunks: DocumentIndexChunk[] = [
      {
        chunkId: 'c1',
        materialId: 'm_rju',
        materialTitle: 'Estatuto dos Servidores do Pará',
        disciplineId: 'legislacao_alepa',
        campusLevel: 'geral',
        sourceKind: 'pdf',
        pageNumber: 14,
        chapterTitle: 'Do Provimento e Vacância',
        text: 'A posse do servidor sob o Estatuto dos Servidores e Regime Jurídico Único ocorre em até 30 dias.',
        normalizedText: normalizeForIndex(
          'A posse do servidor sob o Estatuto dos Servidores e Regime Jurídico Único ocorre em até 30 dias.'
        ),
        tokens: [
          'posse',
          'servidor',
          'estatuto',
          'servidores',
          'regime',
          'juridico',
          'unico',
          'ocorre',
          'ate',
          '30',
          'dias',
        ],
      },
      {
        chunkId: 'c2',
        materialId: 'm_info',
        materialTitle: 'Cartilha de Segurança CERT.br',
        disciplineId: 'nm_informatica',
        campusLevel: 'medio',
        sourceKind: 'html_portal',
        pageNumber: 3,
        chapterTitle: 'Códigos Maliciosos',
        text: 'Phishing e ransomware comprometem credenciais quando falta autenticação em duas etapas.',
        normalizedText: normalizeForIndex(
          'Phishing e ransomware comprometem credenciais quando falta autenticação em duas etapas.'
        ),
        tokens: ['phishing', 'ransomware', 'comprometem', 'credenciais', 'autenticacao', 'etapas'],
      },
    ];

    // Query using synonym "RJU" / "Lei Estadual 5810" matches c1 via LEGAL_EDITAL_SYNONYM_GROUPS
    const rjuHits = searchChunksLexical('Lei Estadual 5810 RJU', chunks, {
      campusLevel: 'superior',
    });
    expect(rjuHits.length).toBeGreaterThanOrEqual(1);
    expect(rjuHits[0].chunk.materialId).toBe('m_rju');
    expect(rjuHits[0].chunk.pageNumber).toBe(14);

    // Campus medio filter matches medio & geral, but superior filter excludes medio-only chunk
    const medioOnly = searchChunksLexical('phishing segurança', chunks, {
      campusLevel: 'superior',
    });
    expect(medioOnly).toHaveLength(0);

    const medioMatch = searchChunksLexical('phishing segurança', chunks, {
      campusLevel: 'medio',
    });
    expect(medioMatch).toHaveLength(1);
    expect(medioMatch[0].chunk.materialId).toBe('m_info');
  });

  it('parses a valid EPUB archive via JSZip preserving spine order and stripping scripts', async () => {
    const zip = new JSZip();
    zip.file(
      'META-INF/container.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
       <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
         <rootfiles>
           <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
         </rootfiles>
       </container>`
    );
    zip.file(
      'OEBPS/content.opf',
      `<?xml version="1.0" encoding="UTF-8"?>
       <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
         <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
           <dc:title>Manual de Processo Legislativo</dc:title>
           <dc:creator>Escola do Legislativo ALEPA</dc:creator>
         </metadata>
         <manifest>
           <item id="ch1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
           <item id="ch2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
         </manifest>
         <spine>
           <itemref idref="ch1"/>
           <itemref idref="ch2"/>
         </spine>
       </package>`
    );
    zip.file(
      'OEBPS/text/ch1.xhtml',
      `<html xmlns="http://www.w3.org/1999/xhtml">
         <body>
           <h1>Capítulo 1 · Proposições</h1>
           <script>window.hacked = true;</script>
           <p>O processo legislativo compreende a elaboração de emendas, leis complementares e ordinárias.</p>
         </body>
       </html>`
    );
    zip.file(
      'OEBPS/text/ch2.xhtml',
      `<html xmlns="http://www.w3.org/1999/xhtml">
         <body>
           <h1>Capítulo 2 · Quórum</h1>
           <p>As leis complementares exigem aprovação por maioria absoluta.</p>
         </body>
       </html>`
    );

    const buf = await zip.generateAsync({ type: 'uint8array' });
    const parsed = await parseEpubBuffer(buf, 'Fallback');

    expect(parsed.sourceKind).toBe('epub');
    expect(parsed.title).toBe('Manual de Processo Legislativo');
    expect(parsed.author).toBe('Escola do Legislativo ALEPA');
    expect(parsed.units).toHaveLength(2);
    expect(parsed.units[0].title).toContain('Capítulo 1');
    expect(parsed.units[0].plainText).not.toContain('window.hacked');
    expect(parsed.units[1].title).toContain('Capítulo 2');
    expect(parsed.outline).toHaveLength(2);
  });

  it('throws clear error when EPUB archive lacks OPF package', async () => {
    const zip = new JSZip();
    zip.file('readme.txt', 'invalid');
    const buf = await zip.generateAsync({ type: 'uint8array' });
    await expect(parseEpubBuffer(buf)).rejects.toThrow(/OPF/i);
  });

  it('classifies opening modes accurately across PDF, EPUB, allowlisted HTML, and external links', () => {
    expect(
      classifyMaterialOpeningMode({
        url: 'https://alepa.pa.gov.br/edital.pdf',
        fileType: 'pdf',
      })
    ).toBe('pdf');

    expect(
      classifyMaterialOpeningMode({
        url: 'https://cdn.example.org/livro.epub',
        fileType: 'epub',
      })
    ).toBe('epub');

    expect(
      classifyMaterialOpeningMode({
        url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
        fileType: 'html',
      })
    ).toBe('html_portal');

    expect(
      classifyMaterialOpeningMode({
        url: 'https://drive.google.com/drive/folders/123456',
        fileType: 'drive',
      })
    ).toBe('external');

    expect(
      isInAppReadableMaterial({
        url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
        fileType: 'html',
      })
    ).toBe(true);
  });

  it('strictly preserves Materials 1 and 6 as pendingDefinition and excludes them from indexing/search fabrication', async () => {
    const rawCatalog: StudyMaterial[] = [
      {
        id: 'cat_mat_1',
        ownerId: 'system',
        catalogNumber: 1,
        title: 'Material 1 (Aguardando definição do acervo)',
        disciplineId: 'geral',
        fileType: 'pdf',
        url: '',
        isShared: true,
        pendingDefinition: true,
        isSystemDefault: true,
        createdAt: '2026-11-15',
      },
      {
        id: 'cat_mat_2',
        ownerId: 'system',
        catalogNumber: 2,
        title: 'Constituição Federal Art. 37',
        disciplineId: 'direito_constitucional',
        fileType: 'html',
        url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
        editalTopic: 'Administração Pública',
        isShared: true,
        isOfficialContent: true,
        createdAt: '2026-11-15',
      },
      {
        id: 'cat_mat_6',
        ownerId: 'system',
        catalogNumber: 6,
        title: 'Material 6 (Aguardando definição do acervo)',
        disciplineId: 'geral',
        fileType: 'pdf',
        url: '',
        isShared: true,
        isSystemDefault: true,
        createdAt: '2026-11-15',
      },
    ];

    const standardized = standardizeMaterialCatalog(rawCatalog);
    expect(isMaterialPendingDefinition(standardized[0])).toBe(true);
    expect(isMaterialPendingDefinition(standardized[2])).toBe(true);
    expect(standardized[2].pendingDefinition).toBe(true);

    const desc1 = describeMaterialForCatalog(standardized[0]);
    expect(desc1.isPendingDefinition).toBe(true);
    expect(desc1.openingMode).toBe('external');
    expect(desc1.originBadge).toBe('Pendente');
    expect(isInAppReadableMaterial(standardized[0])).toBe(false);

    const desc6 = describeMaterialForCatalog(standardized[2]);
    expect(desc6.isPendingDefinition).toBe(true);
    expect(desc6.openingMode).toBe('external');
    expect(desc6.originBadge).toBe('Pendente');

    // Searching for "Aguardando definição" must not include Materials 1 or 6
    const hits = await searchDocumentIndexWithFallback({
      query: 'Aguardando definição acervo Material 1 Material 6',
      materials: standardized,
      useSemanticAi: false,
    });
    expect(hits.some((h) => h.chunk.materialId === 'cat_mat_1' || h.chunk.materialId === 'cat_mat_6')).toBe(false);
  });
});
