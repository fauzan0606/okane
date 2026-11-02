import { NextResponse } from "next/server";
import { transactionFormData } from "@/modules/transaction/service";

export async function GET() {
  try {
    return NextResponse.json(await transactionFormData());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load transaction options." },
      { status: 500 },
    );
  }
}
