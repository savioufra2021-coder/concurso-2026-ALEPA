import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parseEpubBuffer } from './epubAndHtmlEngine';
import { hasPdfMagicBytes } from './pdfBookEngine';
import { inferMaterialMimeType } from './storageService';

describe('inferMaterialMimeType', () => {
  it('normalizes EPUB and PDF MIME types even when browser supplies empty or octet-stream type', () => {
    expect(inferMaterialMimeType({ name: 'regimento-alepa.epub', type: '' })).toBe('application/epub+zip');
    expect(inferMaterialMimeType({ name: 'codigo.EPUB', type: 'application/octet-stream' })).toBe('application/epub+zip');
    expect(inferMaterialMimeType({ name: 'edital.pdf', type: 'binary/octet-stream' })).toBe('application/pdf');
    expect(inferMaterialMimeType({ name: 'aula.mp4', type: '' })).toBe('video/mp4');
    expect(inferMaterialMimeType({ name: 'podcast.mp3', type: '' })).toBe('audio/mpeg');
    expect(inferMaterialMimeType({ name: 'capa.png', type: '' })).toBe('image/png');
  });
});

describe('hasPdfMagicBytes', () => {
  it('accepts valid %PDF headers (including minor leading whitespace) and rejects empty or HTML responses', () => {
    const valid = new TextEncoder().encode('%PDF-1.7\n1 0 obj');
    const withBomSpace = new TextEncoder().encode('  \n%PDF-1.5\n');
    const htmlPage = new TextEncoder().encode('<!doctype html><html><body>Login</body></html>');

    expect(hasPdfMagicBytes(valid)).toBe(true);
    expect(hasPdfMagicBytes(withBomSpace)).toBe(true);
    expect(hasPdfMagicBytes(new Uint8Array(0))).toBe(false);
    expect(hasPdfMagicBytes(htmlPage)).toBe(false);
  });
});

describe('parseEpubBuffer', () => {
  it('rejects empty or corrupt buffers with clear Portuguese messages', async () => {
    await expect(parseEpubBuffer(new ArrayBuffer(0))).rejects.toThrow(/vazio ou incompleto/i);
    await expect(parseEpubBuffer(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/corrompido|pacote ZIP/i);
  });

  it('parses minimal EPUB package with case-insensitive ZIP paths and URI-encoded chapter href', async () => {
    const zip = new JSZip();
    zip.file(
      'META-INF/CONTAINER.XML',
      `<?xml version="1.0"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>`
    );
    zip.file(
      'OEBPS/content.opf',
      `<?xml version="1.0" encoding="utf-8"?>
      <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Constituição Estadual do Pará</dc:title>
          <dc:creator>ALEPA</dc:creator>
        </metadata>
        <manifest>
          <item id="ch1" href="Text/Cap%C3%ADtulo%201.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="ch1"/>
        </spine>
      </package>`
    );
    zip.file(
      'OEBPS/Text/Capítulo 1.xhtml',
      `<html xmlns="http://www.w3.org/1999/xhtml">
        <head><title>Capítulo 1</title></head>
        <body>
          <h1>Da Organização do Estado</h1>
          <p>Art. 1º O Estado do Pará integra a República Federativa do Brasil.</p>
        </body>
      </html>`
    );

    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const parsed = await parseEpubBuffer(buf, 'Fallback');
    expect(parsed.sourceKind).toBe('epub');
    expect(parsed.title).toBe('Constituição Estadual do Pará');
    expect(parsed.author).toBe('ALEPA');
    expect(parsed.units).toHaveLength(1);
    expect(parsed.units[0].title).toBe('Da Organização do Estado');
    expect(parsed.units[0].plainText).toContain('Estado do Pará');
    expect(parsed.outline).toHaveLength(1);
  });
});
