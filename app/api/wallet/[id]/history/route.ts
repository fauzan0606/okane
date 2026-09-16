import { NextResponse } from "next/server";
import { listWalletHistory } from "@/modules/wallet/service";

const PAGE_SIZE = 20;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const searchParams = new URL(request.url).searchParams;
    const rawPage = Number(searchParams.get("page") ?? "1");
    const rawPageSize = Number(searchParams.get("pageSize") ?? PAGE_SIZE);
    const page = Number.isFinite(rawPage) ? Math.max(Math.floor(rawPage), 1) : 1;
    const pageSize = Number.isFinite(rawPageSize) ? Math.min(Math.max(Math.floor(rawPageSize), 1), 50) : PAGE_SIZE;

    const entries = await listWalletHistory(id);
    const total = entries.length;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;

    return NextResponse.json({ entries: entries.slice(start, start + pageSize), page: safePage, pageSize, total, totalPages });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load wallet history." }, { status: 500 });
  }
}
