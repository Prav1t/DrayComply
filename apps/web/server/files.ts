// Checks on a file before it is stored: name, size and that the bytes are what the extension says.
import { unzipSync } from 'fflate';
import type { FileFormat } from '../../../packages/ingest/src/index';
import { invalid } from './errors';
import { LIMITS } from './limits';

export interface CheckedFile { readonly name: string; readonly format: FileFormat; readonly bytes: Uint8Array }

export const RESERVED_PREFIX = 'draycomply-roster-';

export function checkFile(rawName: string, bytes: Uint8Array): CheckedFile {
  const name = (rawName.split(/[\\/]/).pop() ?? '').trim();
  // eslint-disable-next-line no-control-regex
  if (name === '' || name.length > LIMITS.maxFileNameLength || /[\u0000-\u001f<>:"|?*]/.test(name)) throw invalid('A file name is empty, too long, or has characters that cannot be used.');
  if (name.toLowerCase().startsWith(RESERVED_PREFIX)) throw invalid(`File names starting with "${RESERVED_PREFIX}" are reserved.`);
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext !== 'csv' && ext !== 'xlsx') throw invalid(`${name}: only .csv and .xlsx files are accepted.`);
  if (bytes.length === 0) throw invalid(`${name}: the file is empty.`);
  if (bytes.length > LIMITS.maxFileBytes) throw invalid(`${name}: the file is larger than ${LIMITS.maxFileBytes / (1024 * 1024)} MB.`);
  if (ext === 'xlsx') {
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) throw invalid(`${name}: this is not an Excel .xlsx workbook.`);
    let declared = 0;
    try {
      // Nothing is inflated here: the filter only adds up the sizes the archive declares.
      unzipSync(bytes, { filter: f => { declared += f.originalSize; return false; } });
    } catch {
      throw invalid(`${name}: this is not a readable .xlsx workbook.`);
    }
    if (declared > LIMITS.maxXlsxUncompressedBytes) throw invalid(`${name}: the workbook is too large once unpacked.`);
    return { name, format: 'xlsx', bytes };
  }
  if (bytes.includes(0)) throw invalid(`${name}: this is not a text file.`);
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw invalid(`${name}: the file is not UTF-8 text. Save it as "CSV UTF-8" and upload it again.`);
  }
  return { name, format: 'csv', bytes };
}
