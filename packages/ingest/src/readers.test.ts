import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';
import { parseCsv } from './csv';
import { parseXlsx } from './xlsx';
import { sha256Hex } from './sha256';
import { bytes } from './testing/sample';
import type { Grid } from './types';

const texts = (grid: Grid): string[][] => grid.rows.map(r => r.map(c => (c.kind === 'text' ? c.text : `!${c.code}`)));
const csv = (text: string, delimiter: ',' | ';' | '\t' = ',') => {
  const r = parseCsv(bytes(text), delimiter);
  return r.kind === 'ok' ? texts(r.grid) : r.message;
};

describe('sha256', () => {
  it('matches the published test vectors', () => {
    expect(sha256Hex(new Uint8Array())).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex(bytes('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex(bytes('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });
  it('handles input longer than one block and changes with a single byte', () => {
    const big = new Uint8Array(1000).fill(97);
    expect(sha256Hex(big)).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
    expect(sha256Hex(bytes('139.00'))).not.toBe(sha256Hex(bytes('139.01')));
  });
});

describe('csv reader', () => {
  it('reads plain rows, with or without a final newline', () => {
    expect(csv('a,b\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]);
    expect(csv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('keeps commas, quotes and line breaks that sit inside quotes', () => {
    expect(csv('name,amount\n"Singh, R.","$1,234.50"\n"said ""hi""","two\nlines"')).toEqual([['name', 'amount'], ['Singh, R.', '$1,234.50'], ['said "hi"', 'two\nlines']]);
  });
  it('accepts Windows line endings and a byte order mark', () => {
    expect(csv('﻿a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('keeps empty fields and does not trim', () => {
    expect(csv('a,,c\n, x ,')).toEqual([['a', '', 'c'], ['', ' x ', '']]);
  });
  it('honours the delimiter the template names', () => {
    expect(csv('a;b\n1,5;2', ';')).toEqual([['a', 'b'], ['1,5', '2']]);
  });
  it('refuses a quote that never closes, and bytes that are not UTF-8', () => {
    expect(csv('a,b\n"open,2')).toBe('a quoted field is never closed');
    expect(parseCsv(new Uint8Array([0x61, 0xff, 0xfe]), ',')).toEqual({ kind: 'error', message: 'the file is not valid UTF-8 text' });
  });
});

const workbook = (sheetXml: string, extra: { shared?: string; date1904?: boolean } = {}): Uint8Array => zipSync({
  'xl/workbook.xml': strToU8(`<workbook><workbookPr${extra.date1904 === true ? ' date1904="1"' : ''}/><sheets><sheet name="Pay &amp; Hours" sheetId="1" r:id="rId1"/></sheets></workbook>`),
  'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>'),
  'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${sheetXml}</sheetData></worksheet>`),
  ...(extra.shared === undefined ? {} : { 'xl/sharedStrings.xml': strToU8(extra.shared) }),
});

describe('xlsx reader', () => {
  const sheet = (bytesIn: Uint8Array) => {
    const r = parseXlsx(bytesIn);
    return r.kind === 'ok' ? r.sheets : r.message;
  };
  it('reads shared strings, rich text, inline strings, numbers and booleans', () => {
    const book = sheet(workbook(
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>Inline</t></is></c></row>'
      + '<row r="2"><c r="A2"><v>139.5</v></c><c r="B2" t="b"><v>1</v></c><c r="C2" t="str"><f>A2*2</f><v>formula text</v></c></row>',
      { shared: '<sst><si><t>Driver</t></si><si><r><t>Rich </t></r><r><t xml:space="preserve">text</t></r></si></sst>' },
    ));
    expect(typeof book === 'string' ? book : texts(book.get('Pay & Hours') ?? { rows: [], date1904: false }))
      .toEqual([['Driver', 'Rich text', 'Inline'], ['139.5', 'TRUE', 'formula text']]);
  });
  it('keeps a number as the exact decimal text stored, never a float', () => {
    const book = sheet(workbook('<row r="1"><c r="A1"><v>293.76</v></c><c r="B1"><v>0.1</v></c><c r="C1"><v>139.10000000000002</v></c></row>'));
    expect(typeof book === 'string' ? book : texts(book.get('Pay & Hours') ?? { rows: [], date1904: false })).toEqual([['293.76', '0.1', '139.10000000000002']]);
  });
  it('fills skipped cells and skipped rows with blanks, so columns stay aligned', () => {
    const book = sheet(workbook('<row r="1"><c r="A1"><v>1</v></c><c r="C1"><v>3</v></c></row><row r="3"><c r="B3"><v>9</v></c></row>'));
    expect(typeof book === 'string' ? book : texts(book.get('Pay & Hours') ?? { rows: [], date1904: false })).toEqual([['1', '', '3'], [], ['', '9']]);
  });
  it('carries a spreadsheet error as an error cell, not as text', () => {
    const book = sheet(workbook('<row r="1"><c r="A1" t="e"><v>#REF!</v></c></row>'));
    expect(typeof book === 'string' ? book : book.get('Pay & Hours')?.rows[0]).toEqual([{ kind: 'error', code: '#REF!' }]);
  });
  it('decodes entities in sheet names and text', () => {
    const book = sheet(workbook('<row r="1"><c r="A1" t="inlineStr"><is><t>R &amp; D &lt;1&gt; &#65;&#x42;</t></is></c></row>'));
    expect(typeof book === 'string' ? book : texts(book.get('Pay & Hours') ?? { rows: [], date1904: false })).toEqual([['R & D <1> AB']]);
  });
  it('reports the 1904 date system when the workbook uses it', () => {
    const book = sheet(workbook('<row r="1"><c r="A1"><v>1</v></c></row>', { date1904: true }));
    expect(typeof book === 'string' ? book : book.get('Pay & Hours')?.date1904).toBe(true);
  });
  it('refuses a file that is not a workbook', () => {
    expect(sheet(bytes('not a zip'))).toBe('the file is not a readable .xlsx workbook');
    expect(sheet(zipSync({ 'hello.txt': strToU8('hi') }))).toBe('the workbook has no sheet list');
  });
  it('reads a workbook written by a real spreadsheet library', () => {
    // samples/payments.xlsx was written by openpyxl 3.1.5; see samples/README.md.
    const real = readFileSync(fileURLToPath(new URL('../samples/payments.xlsx', import.meta.url)));
    const book = sheet(new Uint8Array(real));
    expect(typeof book === 'string' ? book : texts(book.get('Payments') ?? { rows: [], date1904: false })).toEqual([
      ['Driver', 'Period', 'Type', 'Amount', 'Work From', 'Work To', 'Trip'],
      ['D1', 'P1', 'Regular', '293.76', '46208', '46221'],   // the empty trailing cell is simply not stored
      ['IO1', 'P1', 'Trip', '139', '46208', '46221', 'T1'],
    ]);
  });
});
