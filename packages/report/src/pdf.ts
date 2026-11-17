import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { AuditBinder } from './binder';
import { layout, type Block } from './layout';

const PAGE = { width: 612, height: 792, margin: 54 };
const WIDTH = PAGE.width - PAGE.margin * 2;
const FOOTER = 'Calculation under the rules as encoded, for the data provided. Not legal advice.';

// The standard PDF fonts cover Latin-1 only. Anything else is shown as "?" instead of failing the whole report.
const safe = (text: string): string => text.replace(/[\t\r\n]+/g, ' ').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of safe(text).split(' ')) {
    // A single word wider than the line (a hash) is cut to fit.
    let rest = word;
    while (font.widthOfTextAtSize(rest, size) > width) {
      let cut = rest.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut -= 1;
      if (line !== '') { lines.push(line); line = ''; }
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    const candidate = line === '' ? rest : `${line} ${rest}`;
    if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
    lines.push(line);
    line = rest;
  }
  if (line !== '') lines.push(line);
  return lines.length === 0 ? [''] : lines;
}

// Lays the binder out as a Letter-size PDF. No clock is read: the dates come from the binder.
export async function renderPdf(binder: AuditBinder): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const stamp = new Date(binder.header.generatedAt);
  doc.setTitle(`${binder.header.title} - ${safe(binder.header.licenseeName)}`);
  doc.setProducer('DrayComply report');
  doc.setCreator(`DrayComply engine ${binder.header.engineVersion}`);
  if (binder.header.watermark !== null) doc.setSubject(binder.header.watermark);
  doc.setCreationDate(stamp);
  doc.setModificationDate(stamp);

  const pages: PDFPage[] = [];
  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;
  pages.push(page);
  const newPage = (): void => { page = doc.addPage([PAGE.width, PAGE.height]); pages.push(page); y = PAGE.height - PAGE.margin; };
  const room = (height: number): void => { if (y - height < PAGE.margin + 18) newPage(); };
  const write = (text: string, font: PDFFont, size: number, opts: { indent?: number; gapAfter?: number; grey?: boolean } = {}): void => {
    const indent = opts.indent ?? 0;
    for (const line of wrap(text, font, size, WIDTH - indent)) {
      room(size + 3);
      y -= size + 3;
      page.drawText(line, { x: PAGE.margin + indent, y, size, font, color: opts.grey === true ? rgb(0.3, 0.3, 0.3) : rgb(0, 0, 0) });
    }
    y -= opts.gapAfter ?? 2;
  };

  const paint = (b: Block): void => {
    switch (b.kind) {
      case 'title': write(b.text, bold, 20, { gapAfter: 6 }); return;
      // A heading needs room for itself and a few lines under it, or it moves to the next page.
      case 'h1': room(76); y -= 10; write(b.text, bold, 13, { gapAfter: 4 }); return;
      case 'h2': room(56); y -= 6; write(b.text, bold, 11, { gapAfter: 3 }); return;
      case 'text': write(b.text, regular, 10); return;
      case 'small': write(b.text, regular, 8.5, { indent: 10, grey: true }); return;
      case 'mono': write(b.text, mono, 8, { indent: 10 }); return;
      case 'notice': {
        const lines = wrap(b.text, bold, 9.5, WIDTH - 16);
        const height = lines.length * 12.5 + 10;
        room(height + 6);
        page.drawRectangle({ x: PAGE.margin, y: y - height, width: WIDTH, height, borderColor: rgb(0, 0, 0), borderWidth: 1 });
        lines.forEach((line, i) => page.drawText(line, { x: PAGE.margin + 8, y: y - 14 - i * 12.5, size: 9.5, font: bold }));
        y -= height + 8;
        return;
      }
      case 'pair': {
        const label = wrap(b.label, bold, 9.5, WIDTH * 0.55);
        const value = wrap(b.value, regular, 9.5, WIDTH * 0.42);
        const rows = Math.max(label.length, value.length);
        room(rows * 12.5);
        for (let i = 0; i < rows; i += 1) {
          y -= 12.5;
          page.drawText(label[i] ?? '', { x: PAGE.margin, y, size: 9.5, font: bold });
          page.drawText(value[i] ?? '', { x: PAGE.margin + WIDTH * 0.58, y, size: 9.5, font: regular });
        }
        y -= 2;
        return;
      }
      case 'rule': y -= 6; page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.width - PAGE.margin, y }, thickness: 0.5 }); y -= 4; return;
      case 'page_break': newPage(); return;
    }
  };
  layout(binder).forEach(paint);

  // The watermark crosses every page, corner to corner, over the text.
  const mark = binder.header.watermark;
  if (mark !== null) {
    const size = 34;
    const length = bold.widthOfTextAtSize(mark, size);
    const angle = Math.atan2(PAGE.height, PAGE.width);
    const x = PAGE.width / 2 - (length / 2) * Math.cos(angle);
    const y0 = PAGE.height / 2 - (length / 2) * Math.sin(angle);
    pages.forEach(p => p.drawText(mark, { x, y: y0, size, font: bold, color: rgb(0.75, 0.1, 0.1), opacity: 0.28, rotate: degrees((angle * 180) / Math.PI) }));
  }
  pages.forEach((p, i) => {
    p.drawText(`${FOOTER}   Page ${i + 1} of ${pages.length}`, { x: PAGE.margin, y: 30, size: 7.5, font: regular, color: rgb(0.3, 0.3, 0.3) });
  });
  return doc.save({ useObjectStreams: false });
}
