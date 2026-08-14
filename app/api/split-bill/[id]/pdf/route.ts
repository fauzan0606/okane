import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const PAGE_WIDTH = 226.77; // 80mm receipt roll
const MARGIN_X = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const FOOTER_HEIGHT = 32;

type Line = {
  text?: string;
  right?: string;
  size?: number;
  bold?: boolean;
  gap?: number;
  separator?: boolean;
};

function escapePdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function money(value: number, symbol: string) {
  return `${symbol}${Math.round(value).toLocaleString("id-ID")}`;
}

function date(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(value);
}

function textWidth(value: string, size: number) {
  return value.length * size * 0.52;
}

function wrapText(value: string, size: number, maxWidth: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || textWidth(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function addItem(lines: Line[], name: string, amount: number, symbol: string, bold = false) {
  const size = 8.5;
  const amountText = money(amount, symbol);
  const amountWidth = textWidth(amountText, size);
  const leftWidth = CONTENT_WIDTH - amountWidth - 10;
  const wrapped = wrapText(name, size, leftWidth);

  if (wrapped.length === 1) {
    lines.push({ text: wrapped[0], right: amountText, size, bold, gap: 14 });
    return;
  }

  wrapped.slice(0, -1).forEach((part) => lines.push({ text: part, size, bold, gap: 12 }));
  lines.push({ text: wrapped[wrapped.length - 1], right: amountText, size, bold, gap: 14 });
}

function buildPdf(lines: Line[]) {
  let contentHeight = 34;
  for (const line of lines) {
    if (line.separator) contentHeight += (line.gap ?? 10) + 8;
    else contentHeight += line.gap ?? (line.size && line.size >= 16 ? 22 : line.size && line.size >= 12 ? 18 : 14);
  }
  const pageHeight = Math.max(180, contentHeight + FOOTER_HEIGHT);

  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const fontRegularId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  let y = pageHeight - 24;
  const streamParts: string[] = [];
  for (const line of lines) {
    if (line.separator) {
      streamParts.push(`0.82 0.84 0.87 RG 0.5 w ${MARGIN_X} ${y + 5} m ${PAGE_WIDTH - MARGIN_X} ${y + 5} l S`);
      y -= line.gap ?? 10;
      continue;
    }

    const size = line.size ?? 9;
    const font = line.bold ? "/F2" : "/F1";
    const color = line.bold ? "0.08 0.12 0.17" : "0.25 0.30 0.35";
    if (line.text) streamParts.push(`${color} rg BT ${font} ${size} Tf ${MARGIN_X} ${y} Td (${escapePdfText(line.text)}) Tj ET`);
    if (line.right) {
      const width = textWidth(line.right, size);
      const x = PAGE_WIDTH - MARGIN_X - width;
      streamParts.push(`${color} rg BT ${font} ${size} Tf ${x} ${y} Td (${escapePdfText(line.right)}) Tj ET`);
    }
    y -= line.gap ?? (size >= 16 ? 22 : size >= 12 ? 18 : 14);
  }

  const stream = streamParts.join("\n");
  const contentId = add(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
  const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, "binary");
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bill = await prisma.splitBill.findUnique({
    where: { id },
    include: {
      transaction: { include: { wallet: { select: { currency: { select: { symbol: true } } } } } },
      participants: { orderBy: { isMe: "desc" } },
      items: { include: { allocations: true }, orderBy: { id: "asc" } },
    },
  });

  if (!bill) return new Response("Split Bill not found", { status: 404 });

  const symbol = bill.transaction?.wallet.currency.symbol ?? "Rp";
  const lines: Line[] = [
    { text: "OKANE", size: 18, bold: true, gap: 24 },
    { text: "SPLIT BILL", size: 8, bold: true, gap: 16 },
    ...wrapText(bill.merchantName, 13, CONTENT_WIDTH).map((text, index, all) => ({ text, size: 13, bold: true, gap: index === all.length - 1 ? 10 : 14 })),
    { text: bill.transaction ? date(bill.transaction.transactionDate) : date(bill.createdAt), size: 8, gap: 16 },
  ];

  for (const participant of bill.participants) {
    lines.push({ separator: true, gap: 9 });
    lines.push({ text: participant.isMe ? `${participant.name} (You)` : participant.name, size: 11, bold: true, gap: 14 });
    lines.push({ text: "ITEMS", size: 7.5, bold: true, gap: 10 });

    const participantAllocations = bill.items.flatMap((item) => {
      const allocation = item.allocations.find((entry) => entry.participantId === participant.id);
      if (!allocation) return [];
      return [{ name: item.name, amount: Number(allocation.amount) }];
    });

    const normalItems = participantAllocations.filter((item) => item.name !== "Tax / PPN" && item.name !== "Service Fee" && !/fee/i.test(item.name));
    const taxItem = participantAllocations.find((item) => item.name === "Tax / PPN");
    const serviceItem = participantAllocations.find((item) => item.name === "Service Fee");
    const otherFees = participantAllocations.filter((item) => item.name !== "Tax / PPN" && item.name !== "Service Fee" && /fee/i.test(item.name));

    if (normalItems.length === 0) lines.push({ text: "No allocated items", size: 8, gap: 12 });
    else for (const item of normalItems) addItem(lines, item.name, item.amount, symbol);

    const subtotal = normalItems.reduce((sum, item) => sum + item.amount, 0);
    addItem(lines, "Subtotal", subtotal, symbol, true);
    if (taxItem) addItem(lines, "Tax / PPN", taxItem.amount, symbol);
    if (serviceItem) addItem(lines, "Service Fee", serviceItem.amount, symbol);
    for (const fee of otherFees) addItem(lines, fee.name, fee.amount, symbol);

    lines.push({ separator: true, gap: 8 });
    addItem(lines, "TOTAL", Number(participant.shareAmount), symbol, true);
  }

  lines.push({ separator: true, gap: 10 }, { text: "Thank you for using OKANE", size: 7.5, gap: 8 });
  const pdf = buildPdf(lines);
  const safeName = bill.merchantName.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-|-$/g, "") || "split-bill";

  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="OKANE-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
