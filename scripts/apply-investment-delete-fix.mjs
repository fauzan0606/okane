import fs from "node:fs";

const path = "app/api/investments/v2/route.ts";
let s = fs.readFileSync(path, "utf8");

const old = `      const transactionId = String(body.transactionId || "");\n      if (!transactionId) return NextResponse.json({ error: "transactionId is required." }, { status: 400 });\n      const result = await prisma.$transaction(async tx => {\n        const target = await tx.investmentTransaction.findUnique({ where: { id: transactionId }, include: { account: true, asset: true, holding: true, cashMovements: true } });\n        if (!target) throw new Error("Investment transaction not found.");`;

const replacement = `      const transactionId = String(body.transactionId || "");\n      if (!transactionId) return NextResponse.json({ error: "transactionId is required." }, { status: 400 });\n      const result = await prisma.$transaction(async tx => {\n        // The UI normally sends the BUY transaction id. Also accept the internal\n        // lot id so imported/manual ledger rows remain deletable even when the\n        // source row was reconstructed from its lot metadata.\n        let target = await tx.investmentTransaction.findUnique({ where: { id: transactionId }, include: { account: true, asset: true, holding: true, cashMovements: true } });\n        if (!target) {\n          const candidates = await tx.investmentTransaction.findMany({\n            where: { transactionType: InvestmentTransactionType.BUY },\n            include: { account: true, asset: true, holding: true, cashMovements: true },\n          });\n          target = candidates.find((candidate) => {\n            const note = candidate.note || "";\n            const marker = "__OKANE_LOT__";\n            const start = note.indexOf(marker);\n            if (start < 0) return false;\n            try {\n              const raw = note.slice(start + marker.length);\n              const end = raw.indexOf("}");\n              const parsed = JSON.parse(end >= 0 ? raw.slice(0, end + 1) : raw) as { lotId?: string };\n              return parsed.lotId === transactionId;\n            } catch {\n              return false;\n            }\n          }) || null;\n        }\n        if (!target) throw new Error("Investment transaction not found.");`;

if (!s.includes(old)) {
  console.log("Investment delete fix already applied or source changed; nothing to do.");
  process.exit(0);
}

s = s.replace(old, replacement);
fs.writeFileSync(path, s);
console.log("Applied investment transaction delete fix.");
