import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Line = { text: string; size?: number; bold?: boolean; gap?: number };

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
  return `${symbol}${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function date(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(value);
}

function splitLines(lines: Line[], maxLines = 48) {
  const pages: Line[][] = [];
  let current: Line[] = [];
  for (const line of lines) {
    if (current.length >= maxLines) {
      pages.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length) pages.push(current);
  return pages;
}

function buildPdf(pages: Line[][]) {
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const fontRegularId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds: number[] = [];

  for (const lines of pages) {
    let y = 780;
    const streamParts: string[] = ["q", "0.12 0.20 0.28 rg", "0.12 0.20 0.28 RG"];
    for (const line of lines) {
      const size = line.size ?? 10;
      const font = line.bold ? "/F2" : "/F1";
      const color = line.bold ? "0.08 0.12 0.17" : "0.25 0.30 0.35";
      streamParts.push(`${color} rg BT ${font} ${size} Tf 54 ${y} Td (${escapePdfText(line.text)}) Tj ET`);
      y -= line.gap ?? (size >= 16 ? 25 : size >= 12 ? 20 : 16);
    }
    streamParts.push("Q");
    const stream = streamParts.join("\n");
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

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
    { text: "OKANE", size: 22, bold: true, gap: 30 },
    { text: "SPLIT BILL", size: 9, bold: true, gap: 22 },
    { text: bill.merchantName, size: 18, bold: true, gap: 22 },
    { text: bill.transaction ? date(bill.transaction.transactionDate) : date(bill.createdAt), size: 10, gap: 24 },
  ];

  for (const participant of bill.participants) {
    lines.push({ text: participant.isMe ? `${participant.name} (You)` : participant.name, size: 14, bold: true, gap: 20 });
    lines.push({ text: "ITEMS", size: 8, bold: true, gap: 16 });
    let subtotal = 0;
    const participantAllocations = bill.items.flatMap((item) => {
      const allocation = item.allocations.find((entry) => entry.participantId === participant.id);
      if (!allocation) return [];
      const amount = Number(allocation.amount);
      subtotal += amount;
      return [{ name: item.name, amount }];
    });

    if (participantAllocations.length === 0) lines.push({ text: "No allocated items", size: 9, gap: 16 });
    else for (const allocation of participantAllocations) lines.push({ text: `${allocation.name}    ${money(allocation.amount, symbol)}`, size: 9, gap: 16 });

    const taxItem = participantAllocations.find((item) => item.name === "Tax / PPN");
    const serviceItem = participantAllocations.find((item) => item.name === "Service Fee");
    const foodItems = participantAllocations.filter((item) => item.name !== "Tax / PPN" && item.name !== "Service Fee");
    const foodSubtotal = foodItems.reduce((sum, item) => sum + item.amount, 0);
    lines.push({ text: `Subtotal    ${money(foodSubtotal, symbol)}`, size: 9, bold: true, gap: 16 });
    if (taxItem) lines.push({ text: `Tax / PPN    ${money(taxItem.amount, symbol)}`, size: 9, gap: 16 });
    if (serviceItem) lines.push({ text: `Service Fee    ${money(serviceItem.amount, symbol)}`, size: 9, gap: 16 });
    lines.push({ text: `TOTAL    ${money(subtotal, symbol)}`, size: 13, bold: true, gap: 26 });
    lines.push({ text: "", gap: 12 });
  }

  lines.push({ text: "Thank you for using OKANE", size: 8, gap: 16 });
  const pages = splitLines(lines);
  const pdf = buildPdf(pages);
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
