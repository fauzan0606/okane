import { inflateRawSync } from "node:zlib";

function u16(buffer: Buffer, offset: number) { return buffer.readUInt16LE(offset); }
function u32(buffer: Buffer, offset: number) { return buffer.readUInt32LE(offset); }

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset -= 1) {
    if (u32(buffer, offset) === 0x06054b50) return offset;
  }
  throw new Error("Invalid XLSX file: ZIP end record was not found.");
}

function unzipEntries(buffer: Buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = u16(buffer, eocd + 10);
  const centralDirectoryOffset = u32(buffer, eocd + 16);
  const entries = new Map<string, Buffer>();
  let offset = centralDirectoryOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (u32(buffer, offset) !== 0x02014b50) throw new Error("Invalid XLSX file: ZIP central directory is corrupted.");
    const compression = u16(buffer, offset + 10);
    const compressedSize = u32(buffer, offset + 20);
    const nameLength = u16(buffer, offset + 28);
    const extraLength = u16(buffer, offset + 30);
    const commentLength = u16(buffer, offset + 32);
    const localHeaderOffset = u32(buffer, offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");

    if (["xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"].includes(name)) {
      if (u32(buffer, localHeaderOffset) !== 0x04034b50) throw new Error("Invalid XLSX file: local ZIP header is corrupted.");
      const localNameLength = u16(buffer, localHeaderOffset + 26);
      const localExtraLength = u16(buffer, localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      const content = compression === 0 ? compressed : compression === 8 ? inflateRawSync(compressed) : null;
      if (!content) throw new Error(`Unsupported XLSX compression method for ${name}.`);
      entries.set(name, content);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function decodeXml(value: string) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "";
  let result = 0;
  for (const char of letters) result = result * 26 + char.charCodeAt(0) - 64;
  return Math.max(0, result - 1);
}

function getSharedStrings(xml: string) {
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((token) => decodeXml(token[1])).join("")
  );
}

function getCellValue(attributes: string, content: string, shared: string[]) {
  const type = attributes.match(/\st="([^"]+)"/)?.[1];
  if (type === "inlineStr") return [...content.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");
  const raw = content.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (raw === undefined) return null;
  if (type === "s") {
    const index = Number(raw);
    return Number.isInteger(index) ? shared[index] ?? "" : "";
  }
  if (type === "b") return raw === "1";
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : decodeXml(raw);
}

export type XlsxRow = Array<string | number | boolean | null>;

export function readFirstWorksheet(buffer: Buffer): XlsxRow[] {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new Error("The uploaded file is not a valid XLSX workbook.");
  const entries = unzipEntries(buffer);
  const sheet = entries.get("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("The XLSX workbook does not contain a readable first worksheet.");
  const shared = entries.has("xl/sharedStrings.xml") ? getSharedStrings(entries.get("xl/sharedStrings.xml")!.toString("utf8")) : [];
  const xml = sheet.toString("utf8");
  const rows: XlsxRow[] = [];

  for (const rowMatch of xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
    const row: XlsxRow = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1];
      const reference = attributes.match(/r="([A-Z]+\d+)"/)?.[1];
      if (!reference) continue;
      row[columnIndex(reference)] = getCellValue(attributes, cellMatch[2] ?? "", shared);
    }
    rows.push(row);
  }
  return rows;
}
