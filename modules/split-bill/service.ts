import { Prisma, SplitBillItemMethod, SplitBillStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOrCreatePayeeByName } from "@/modules/payee/service";

type ParticipantInput = { name: string; isMe: boolean };
type ItemInput = { name: string; quantity: number; unitPrice: number; splitMethod: "EQUAL" | "PRO_RATA"; units: number[] };
type ChargeTreatment = "INCLUDED" | "EXCLUDED" | "UNKNOWN";
type ChargeInput = { mode: "AMOUNT" | "PERCENT"; value: number; treatment?: ChargeTreatment };
type DeliveryFeeInput = ChargeInput & { splitMethod?: "EQUAL" | "PRO_RATA" };
type SplitBillInput = { merchantName: string; participants: ParticipantInput[]; items: ItemInput[]; tax?: ChargeInput; serviceFee?: ChargeInput; deliveryFee?: DeliveryFeeInput; deliveryDiscount?: ChargeInput; note?: string };

function decimal(value: number) { return new Prisma.Decimal(value); }
function balanceDelta(type: "INCOME" | "EXPENSE", amount: Prisma.Decimal) { return type === "INCOME" ? amount : amount.negated(); }
async function applyBalanceDelta(tx: Prisma.TransactionClient, walletId: string, delta: Prisma.Decimal) { if (delta.isZero()) return; await tx.wallet.update({ where: { id: walletId }, data: delta.isPositive() ? { currentBalance: { increment: delta } } : { currentBalance: { decrement: delta.abs() } } }); }
function chargeAmount(charge?: ChargeInput, subtotal = new Prisma.Decimal(0)) {
  if (!charge || charge.value <= 0) return new Prisma.Decimal(0);
  if (charge.treatment === "INCLUDED") return new Prisma.Decimal(0);
  if (charge.treatment === "UNKNOWN") throw new Error("Tax/service treatment must be reviewed before creating the Split Bill.");
  if (charge.mode === "PERCENT") { if (charge.value > 100) throw new Error("Charge percentage cannot exceed 100%."); return subtotal.mul(charge.value).div(100); }
  return decimal(charge.value);
}
function validateCharge(charge?: ChargeInput, label = "Charge") {
  if (!charge) return;
  if (!Number.isFinite(charge.value) || charge.value < 0) throw new Error(`${label} must be a valid non-negative value.`);
  if (charge.mode === "PERCENT" && charge.value > 100) throw new Error(`${label} percentage cannot exceed 100%.`);
  if (charge.treatment && !["INCLUDED", "EXCLUDED", "UNKNOWN"].includes(charge.treatment)) throw new Error(`Invalid ${label.toLowerCase()} treatment.`);
  if (charge.treatment === "UNKNOWN" && charge.value > 0) throw new Error(`${label} treatment must be reviewed before creating the Split Bill.`);
}
function validateInput(input: SplitBillInput) {
  if (!input.merchantName.trim()) throw new Error("Merchant is required.");
  if (input.participants.length < 2) throw new Error("Add at least one friend to split the bill with you.");
  if (input.participants.filter((participant) => participant.isMe).length !== 1) throw new Error("Split Bill must have exactly one 'You' participant.");
  if (input.items.length === 0) throw new Error("Add at least one bill item.");
  if (input.participants.some((participant) => !participant.isMe && !participant.name.trim())) throw new Error("Every friend needs a name.");
  validateCharge(input.tax, "Tax");
  validateCharge(input.serviceFee, "Service fee");
  validateCharge(input.deliveryFee, "Delivery fee");
  validateCharge(input.deliveryDiscount, "Delivery discount");
  if (input.deliveryFee?.splitMethod && !["EQUAL", "PRO_RATA"].includes(input.deliveryFee.splitMethod)) throw new Error("Invalid delivery fee split method.");
  for (const item of input.items) {
    if (!item.name.trim() || item.quantity <= 0 || item.unitPrice < 0) throw new Error("Each item must have a name, positive quantity, and non-negative unit price.");
    const selectedUnits = item.units.map((unit) => Number(unit) || 0);
    const selectedCount = selectedUnits.filter((unit) => unit > 0).length;
    if (selectedCount === 0) throw new Error(`Choose at least one person for '${item.name}'.`);
    if (item.splitMethod === "PRO_RATA" && selectedCount > 1 && selectedUnits.every((unit) => unit <= 0)) throw new Error(`Set at least one share unit for '${item.name}'.`);
  }
}

export async function createSplitBill(input: SplitBillInput) {
  validateInput(input);
  return prisma.$transaction(async (tx) => {
    const splitBill = await tx.splitBill.create({ data: { merchantName: input.merchantName.trim(), totalAmount: 0, personalAmount: 0, status: SplitBillStatus.DRAFT, note: input.note?.trim() || null } });
    const participants = await Promise.all(input.participants.map((participant) => tx.splitBillParticipant.create({ data: { splitBillId: splitBill.id, name: participant.isMe ? "You" : participant.name.trim(), isMe: participant.isMe } })));
    const shareTotals = participants.map(() => new Prisma.Decimal(0));
    let subtotal = new Prisma.Decimal(0);
    for (const inputItem of input.items) {
      const itemAmount = decimal(inputItem.quantity).mul(decimal(inputItem.unitPrice));
      subtotal = subtotal.plus(itemAmount);
      const method = inputItem.splitMethod === "PRO_RATA" ? SplitBillItemMethod.PRO_RATA : SplitBillItemMethod.EQUAL;
      const selectedUnits = inputItem.units.map((unit) => decimal(Number(unit) || 0));
      const selectedCount = selectedUnits.filter((unit) => unit.gt(0)).length;
      const units = method === SplitBillItemMethod.EQUAL ? selectedUnits.map((unit) => unit.gt(0) ? new Prisma.Decimal(1) : new Prisma.Decimal(0)) : selectedUnits;
      const unitTotal = units.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0));
      if (unitTotal.lte(0)) throw new Error(`Choose at least one person for '${inputItem.name}'.`);
      if (method === SplitBillItemMethod.PRO_RATA && selectedCount > 1 && unitTotal.lte(0)) throw new Error(`Set at least one share unit for '${inputItem.name}'.`);
      const item = await tx.splitBillItem.create({ data: { splitBillId: splitBill.id, name: inputItem.name.trim(), quantity: inputItem.quantity, unitPrice: inputItem.unitPrice, splitMethod: method } });
      for (let participantIndex = 0; participantIndex < participants.length; participantIndex += 1) {
        if (units[participantIndex].lte(0)) continue;
        const amount = units[participantIndex].div(unitTotal).mul(itemAmount);
        shareTotals[participantIndex] = shareTotals[participantIndex].plus(amount);
        await tx.splitBillItemAllocation.create({ data: { itemId: item.id, participantId: participants[participantIndex].id, units: units[participantIndex], amount } });
      }
    }

    const taxAmount = chargeAmount(input.tax, subtotal);
    const serviceFeeAmount = chargeAmount(input.serviceFee, subtotal);

    const addProportionalCharge = async (name: string, amount: Prisma.Decimal) => {
      if (amount.lte(0)) return;
      if (subtotal.lte(0)) throw new Error(`${name} cannot be added when the bill subtotal is zero.`);
      const item = await tx.splitBillItem.create({ data: { splitBillId: splitBill.id, name, quantity: 1, unitPrice: amount, splitMethod: SplitBillItemMethod.PRO_RATA } });
      for (let participantIndex = 0; participantIndex < participants.length; participantIndex += 1) {
        const units = shareTotals[participantIndex];
        if (units.lte(0)) continue;
        const allocation = units.div(subtotal).mul(amount);
        await tx.splitBillItemAllocation.create({ data: { itemId: item.id, participantId: participants[participantIndex].id, units, amount: allocation } });
        shareTotals[participantIndex] = shareTotals[participantIndex].plus(allocation);
      }
    };

    const addDeliveryCharge = async (amount: Prisma.Decimal, splitMethod: "EQUAL" | "PRO_RATA") => {
      if (amount.lte(0)) return;
      const item = await tx.splitBillItem.create({ data: { splitBillId: splitBill.id, name: "Delivery Fee", quantity: 1, unitPrice: amount, splitMethod: splitMethod === "PRO_RATA" ? SplitBillItemMethod.PRO_RATA : SplitBillItemMethod.EQUAL } });
      const eligible = participants.map((_, index) => shareTotals[index].gt(0));
      const eligibleCount = eligible.filter(Boolean).length;
      if (eligibleCount === 0) throw new Error("Delivery fee cannot be allocated when no participant has an item share.");
      const baseTotal = shareTotals.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0));
      for (let participantIndex = 0; participantIndex < participants.length; participantIndex += 1) {
        if (!eligible[participantIndex]) continue;
        const allocation = splitMethod === "EQUAL" ? amount.div(eligibleCount) : amount.mul(shareTotals[participantIndex]).div(baseTotal);
        const units = splitMethod === "EQUAL" ? new Prisma.Decimal(1) : shareTotals[participantIndex];
        await tx.splitBillItemAllocation.create({ data: { itemId: item.id, participantId: participants[participantIndex].id, units, amount: allocation } });
        shareTotals[participantIndex] = shareTotals[participantIndex].plus(allocation);
      }
    };

    const deliveryFeeAmount = chargeAmount(input.deliveryFee, subtotal);
    const deliveryDiscountAmount = chargeAmount(input.deliveryDiscount, subtotal).min(deliveryFeeAmount);
    const netDeliveryAmount = deliveryFeeAmount.minus(deliveryDiscountAmount);
    const deliverySplitMethod = input.deliveryFee?.splitMethod ?? "EQUAL";

    await addProportionalCharge("Tax / PPN", taxAmount);
    await addProportionalCharge("Service Fee", serviceFeeAmount);
    await addDeliveryCharge(netDeliveryAmount, deliverySplitMethod);

    const totalAmount = subtotal.plus(taxAmount).plus(serviceFeeAmount).plus(netDeliveryAmount);
    const personalIndex = input.participants.findIndex((participant) => participant.isMe);
    await tx.splitBill.update({ where: { id: splitBill.id }, data: { totalAmount, personalAmount: shareTotals[personalIndex] } });
    for (let index = 0; index < participants.length; index += 1) await tx.splitBillParticipant.update({ where: { id: participants[index].id }, data: { shareAmount: shareTotals[index] } });
    return splitBill;
  });
}

export async function finalizeSplitBill(splitBillId: string, input: { transactionDate: Date; walletId: string }) {
  const merchant = await prisma.splitBill.findUnique({ where: { id: splitBillId }, select: { merchantName: true } });
  if (!merchant) throw new Error("Split Bill not found.");
  const payee = await findOrCreatePayeeByName(merchant.merchantName);
  return prisma.$transaction(async (tx) => {
    const splitBill = await tx.splitBill.findUnique({ where: { id: splitBillId }, include: { participants: { include: { receivable: true } } } });
    if (!splitBill) throw new Error("Split Bill not found.");
    if (splitBill.status !== SplitBillStatus.DRAFT && splitBill.status !== SplitBillStatus.OPEN) throw new Error("This Split Bill has already been finalized or cancelled.");
    if (splitBill.transactionId) throw new Error("This Split Bill is already linked to a transaction.");
    const wallet = await tx.wallet.findUnique({ where: { id: input.walletId }, select: { id: true, currencyId: true, balanceAsOf: true } });
    if (!wallet) throw new Error("Wallet not found.");
    const transaction = await tx.transaction.create({ data: { transactionDate: input.transactionDate, type: "EXPENSE", kind: "STANDARD", amount: splitBill.totalAmount, note: splitBill.note || `Split Bill: ${splitBill.merchantName}`, wallet: { connect: { id: wallet.id } }, payee: payee ? { connect: { id: payee.id } } : undefined } });
    if (!wallet.balanceAsOf || transaction.transactionDate > wallet.balanceAsOf || (transaction.transactionDate.toDateString() === wallet.balanceAsOf.toDateString() && transaction.createdAt > wallet.balanceAsOf)) await applyBalanceDelta(tx, wallet.id, balanceDelta("EXPENSE", splitBill.totalAmount));
    for (const participant of splitBill.participants) {
      if (participant.isMe || participant.shareAmount.lte(0) || participant.receivable) continue;
      await tx.receivable.create({ data: { personName: participant.name, description: `Split Bill: ${splitBill.merchantName}`, amount: participant.shareAmount, currencyId: wallet.currencyId, sourceWalletId: wallet.id, loanDate: input.transactionDate, sourceTransactionId: transaction.id, splitBillParticipantId: participant.id } });
    }
    await tx.splitBill.update({ where: { id: splitBill.id }, data: { transactionId: transaction.id, status: SplitBillStatus.OPEN } });
    return transaction;
  });
}

export async function getSplitBills() {
  return prisma.splitBill.findMany({ include: { transaction: { include: { wallet: { select: { name: true, walletType: true, currency: { select: { code: true, symbol: true } } } }, payee: { select: { name: true } }, category: { select: { name: true } } } }, participants: { include: { receivable: { include: { payments: { select: { amount: true } } } } }, orderBy: { isMe: "desc" } }, items: { include: { allocations: true }, orderBy: { id: "asc" } } }, orderBy: { createdAt: "desc" } });
}

function transactionAffectedBalance(transaction: { transactionDate: Date; createdAt: Date }, balanceAsOf: Date | null) { return !balanceAsOf || transaction.transactionDate > balanceAsOf || (transaction.transactionDate.toDateString() === balanceAsOf.toDateString() && transaction.createdAt > balanceAsOf); }

export async function deleteSplitBill(splitBillId: string) {
  return prisma.$transaction(async (tx) => {
    const splitBill = await tx.splitBill.findUnique({ where: { id: splitBillId }, include: { transaction: { include: { wallet: { select: { id: true, balanceAsOf: true } } } }, participants: { include: { receivable: { include: { payments: { include: { transaction: { include: { wallet: { select: { id: true, balanceAsOf: true } } } } } } } } } } } });
    if (!splitBill) throw new Error("Split Bill not found.");
    for (const participant of splitBill.participants) { const receivable = participant.receivable; if (!receivable) continue; for (const payment of receivable.payments) { if (transactionAffectedBalance(payment.transaction, payment.transaction.wallet.balanceAsOf)) await applyBalanceDelta(tx, payment.transaction.wallet.id, balanceDelta("INCOME", payment.amount).negated()); await tx.transaction.delete({ where: { id: payment.transaction.id } }); } await tx.receivable.delete({ where: { id: receivable.id } }); }
    if (splitBill.transaction) { if (transactionAffectedBalance(splitBill.transaction, splitBill.transaction.wallet.balanceAsOf)) await applyBalanceDelta(tx, splitBill.transaction.wallet.id, balanceDelta("EXPENSE", splitBill.transaction.amount).negated()); await tx.transaction.delete({ where: { id: splitBill.transaction.id } }); }
    await tx.splitBill.delete({ where: { id: splitBill.id } });
  });
}
