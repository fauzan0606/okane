import { Prisma, SplitBillItemMethod, SplitBillStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOrCreatePayeeByName } from "@/modules/payee/service";
import { createPayableForSplitBillParticipant } from "@/modules/payable/service";

type ParticipantInput = { name: string; isMe: boolean };
type ItemInput = { name: string; quantity: number; unitPrice: number; splitMethod: "EQUAL" | "PRO_RATA"; units: number[] };
type ChargeTreatment = "INCLUDED" | "EXCLUDED" | "UNKNOWN";
type ChargeInput = { mode: "AMOUNT" | "PERCENT"; value: number; treatment?: ChargeTreatment };
type DeliveryFeeInput = ChargeInput & { splitMethod?: "EQUAL" | "PRO_RATA" };
type SplitBillInput = { merchantName: string; participants: ParticipantInput[]; payerParticipantIndex?: number; items: ItemInput[]; orderDiscount?: ChargeInput; tax?: ChargeInput; serviceFee?: ChargeInput; deliveryFee?: DeliveryFeeInput; deliveryDiscount?: ChargeInput; note?: string };

function decimal(value: number) { return new Prisma.Decimal(value); }
function capDecimal(value: Prisma.Decimal, maximum: Prisma.Decimal) { return value.lte(maximum) ? value : maximum; }
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
  const payerIndex = input.payerParticipantIndex ?? input.participants.findIndex((participant) => participant.isMe);
  if (!Number.isInteger(payerIndex) || payerIndex < 0 || payerIndex >= input.participants.length) throw new Error("Select who paid for the Split Bill.");
  if (input.items.length === 0) throw new Error("Add at least one bill item.");
  if (input.participants.some((participant) => !participant.isMe && !participant.name.trim())) throw new Error("Every friend needs a name.");
  validateCharge(input.orderDiscount, "Order discount");
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
  const payerIndex = input.payerParticipantIndex ?? input.participants.findIndex((participant) => participant.isMe);
  return prisma.$transaction(async (tx) => {
    const splitBill = await tx.splitBill.create({ data: { merchantName: input.merchantName.trim(), totalAmount: 0, personalAmount: 0, status: SplitBillStatus.DRAFT, note: input.note?.trim() || null } });
    const participants = await Promise.all(input.participants.map((participant) => tx.splitBillParticipant.create({ data: { splitBillId: splitBill.id, name: participant.isMe ? "You" : participant.name.trim(), isMe: participant.isMe } })));
    const payerParticipant = participants[payerIndex];
    if (!payerParticipant) throw new Error("Select who paid for the Split Bill.");
    await tx.splitBill.update({ where: { id: splitBill.id }, data: { payerParticipantId: payerParticipant.id } });
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
      const allocations = [];
      for (let participantIndex = 0; participantIndex < participants.length; participantIndex += 1) {
        if (units[participantIndex].lte(0)) continue;
        const amount = units[participantIndex].div(unitTotal).mul(itemAmount);
        shareTotals[participantIndex] = shareTotals[participantIndex].plus(amount);
        allocations.push({ itemId: item.id, participantId: participants[participantIndex].id, units: units[participantIndex], amount });
      }
      if (allocations.length > 0) await tx.splitBillItemAllocation.createMany({ data: allocations });
    }

    const orderDiscountAmount = capDecimal(chargeAmount(input.orderDiscount, subtotal), subtotal);
    const discountedSubtotal = subtotal.minus(orderDiscountAmount);

    const addDiscount = async (amount: Prisma.Decimal) => {
      if (amount.lte(0)) return;
      if (subtotal.lte(0)) throw new Error("Order discount cannot be added when the bill subtotal is zero.");
      const item = await tx.splitBillItem.create({ data: { splitBillId: splitBill.id, name: "Order Discount", quantity: 1, unitPrice: amount.negated(), splitMethod: SplitBillItemMethod.PRO_RATA } });
      const allocations = [];
      for (let participantIndex = 0; participantIndex < participants.length; participantIndex += 1) {
        const baseShare = shareTotals[participantIndex];
        if (baseShare.lte(0)) continue;
        const allocation = baseShare.div(subtotal).mul(amount);
        shareTotals[participantIndex] = shareTotals[participantIndex].minus(allocation);
        allocations.push({ itemId: item.id, participantId: participants[participantIndex].id, units: baseShare, amount: allocation.negated() });
      }
      if (allocations.length > 0) await tx.splitBillItemAllocation.createMany({ data: allocations });
    };

    await addDiscount(orderDiscountAmount);
    const baseShares = shareTotals.map((value) => value);

    const taxAmount = chargeAmount(input.tax, discountedSubtotal);
    const serviceFeeAmount = chargeAmount(input.serviceFee, discountedSubtotal);

    const addProportionalCharge = async (name: string, amount: Prisma.Decimal) => {
      if (amount.lte(0)) return;
      if (discountedSubtotal.lte(0)) throw new Error(`${name} cannot be added when the discounted bill subtotal is zero.`);
      const item = await tx.splitBillItem.create({ data: { splitBillId: splitBill.id, name, quantity: 1, unitPrice: amount, splitMethod: SplitBillItemMethod.PRO_RATA } });
      const allocations = [];
      for (let participantIndex = 0; participantIndex < participants.length; participantIndex += 1) {
        const baseShare = baseShares[participantIndex];
        if (baseShare.lte(0)) continue;
        const allocation = baseShare.div(discountedSubtotal).mul(amount);
        allocations.push({ itemId: item.id, participantId: participants[participantIndex].id, units: baseShare, amount: allocation });
        shareTotals[participantIndex] = shareTotals[participantIndex].plus(allocation);
      }
      if (allocations.length > 0) await tx.splitBillItemAllocation.createMany({ data: allocations });
    };

    const addDeliveryCharge = async (amount: Prisma.Decimal, splitMethod: "EQUAL" | "PRO_RATA") => {
      if (amount.lte(0)) return;
      const item = await tx.splitBillItem.create({ data: { splitBillId: splitBill.id, name: "Delivery Fee", quantity: 1, unitPrice: amount, splitMethod: splitMethod === "PRO_RATA" ? SplitBillItemMethod.PRO_RATA : SplitBillItemMethod.EQUAL } });
      const eligible = participants.map((_, index) => baseShares[index].gt(0));
      const eligibleCount = eligible.filter(Boolean).length;
      if (eligibleCount === 0) throw new Error("Delivery fee cannot be allocated when no participant has an item share.");
      const baseTotal = baseShares.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0));
      for (let participantIndex = 0; participantIndex < participants.length; participantIndex += 1) {
        if (!eligible[participantIndex]) continue;
        const allocation = splitMethod === "EQUAL" ? amount.div(eligibleCount) : amount.mul(baseShares[participantIndex]).div(baseTotal);
        const units = splitMethod === "EQUAL" ? new Prisma.Decimal(1) : baseShares[participantIndex];
        await tx.splitBillItemAllocation.create({ data: { itemId: item.id, participantId: participants[participantIndex].id, units, amount: allocation } });
        shareTotals[participantIndex] = shareTotals[participantIndex].plus(allocation);
      }
    };

    const deliveryFeeAmount = chargeAmount(input.deliveryFee, subtotal);
    const deliveryDiscountAmount = capDecimal(chargeAmount(input.deliveryDiscount, subtotal), deliveryFeeAmount);
    const netDeliveryAmount = deliveryFeeAmount.minus(deliveryDiscountAmount);
    const deliverySplitMethod = input.deliveryFee?.splitMethod ?? "EQUAL";

    await addProportionalCharge("Tax / PPN", taxAmount);
    await addProportionalCharge("Service Fee", serviceFeeAmount);
    await addDeliveryCharge(netDeliveryAmount, deliverySplitMethod);

    const totalAmount = discountedSubtotal.plus(taxAmount).plus(serviceFeeAmount).plus(netDeliveryAmount);
    const personalIndex = input.participants.findIndex((participant) => participant.isMe);
    await tx.splitBill.update({ where: { id: splitBill.id }, data: { totalAmount, personalAmount: shareTotals[personalIndex] } });
    for (let index = 0; index < participants.length; index += 1) await tx.splitBillParticipant.update({ where: { id: participants[index].id }, data: { shareAmount: shareTotals[index] } });
    return splitBill;
  }, { maxWait: 10000, timeout: 20000 });
}

export async function finalizeSplitBill(splitBillId: string, input: {
  transactionDate: Date;
  walletId?: string;
  categoryId?: string;
  subcategoryId?: string;
}) {
  const merchant = await prisma.splitBill.findUnique({ where: { id: splitBillId }, select: { merchantName: true } });
  if (!merchant) throw new Error("Split Bill not found.");
  const payee = await findOrCreatePayeeByName(merchant.merchantName);
  return prisma.$transaction(async (tx) => {
    const splitBill = await tx.splitBill.findUnique({ where: { id: splitBillId }, include: { participants: { include: { receivable: true, payable: true } } } });
    if (!splitBill) throw new Error("Split Bill not found.");
    if (splitBill.status !== SplitBillStatus.DRAFT && splitBill.status !== SplitBillStatus.OPEN) throw new Error("This Split Bill has already been finalized or cancelled.");
    if (splitBill.transactionId) throw new Error("This Split Bill is already linked to a transaction.");

    const payer = splitBill.payerParticipantId
      ? splitBill.participants.find((participant) => participant.id === splitBill.payerParticipantId)
      : splitBill.participants.find((participant) => participant.isMe);
    if (!payer) throw new Error("Split Bill payer not found.");

    if (!payer.isMe) {
      const personalParticipant = splitBill.participants.find((participant) => participant.isMe);
      if (!personalParticipant) throw new Error("Your Split Bill participant was not found.");
      if (!input.walletId) throw new Error("Payment wallet is required when someone else paid the Split Bill.");

      const wallet = await tx.wallet.findUnique({
        where: { id: input.walletId },
        select: { id: true, currencyId: true },
      });
      if (!wallet) throw new Error("Wallet not found.");

      await tx.splitBill.update({ where: { id: splitBill.id }, data: { status: SplitBillStatus.OPEN, paymentDate: input.transactionDate } });
      const payable = await createPayableForSplitBillParticipant(
        tx,
        personalParticipant,
        splitBill.merchantName,
        wallet.currencyId,
        input.transactionDate,
      );

      if (!payable) throw new Error("Unable to create payable for the Split Bill.");
      if (!input.categoryId) throw new Error("Expense category is required when recording repayment.");

      const category = await tx.category.findUnique({ where: { id: input.categoryId }, select: { id: true, type: true } });
      if (!category || category.type !== "EXPENSE") throw new Error("Repayment category must be an expense category.");
      if (input.subcategoryId) {
        const subcategory = await tx.subcategory.findUnique({ where: { id: input.subcategoryId }, select: { id: true, categoryId: true } });
        if (!subcategory || subcategory.categoryId !== input.categoryId) throw new Error("Subcategory does not belong to the selected category.");
      }

      return { payableId: payable.id, walletId: wallet.id };
    }

    if (!input.walletId) throw new Error("Wallet is required when you paid the Split Bill.");
    const wallet = await tx.wallet.findUnique({ where: { id: input.walletId }, select: { id: true, currencyId: true, balanceAsOf: true } });
    if (!wallet) throw new Error("Wallet not found.");
    const totalAmount = splitBill.totalAmount;
    if (!input.categoryId) throw new Error("Expense category is required when finalizing the Split Bill.");
    const category = await tx.category.findUnique({ where: { id: input.categoryId }, select: { id: true, type: true } });
    if (!category || category.type !== "EXPENSE") throw new Error("Expense category is required when finalizing the Split Bill.");
    if (input.subcategoryId) {
      const subcategory = await tx.subcategory.findUnique({ where: { id: input.subcategoryId }, select: { id: true, categoryId: true } });
      if (!subcategory || subcategory.categoryId !== input.categoryId) throw new Error("Subcategory does not belong to the selected category.");
    }
    const transaction = await tx.transaction.create({
      data: {
        transactionDate: input.transactionDate,
        type: "EXPENSE",
        kind: "STANDARD",
        amount: totalAmount,
        note: splitBill.note || "Split Bill: " + splitBill.merchantName,
        wallet: { connect: { id: wallet.id } },
        category: { connect: { id: input.categoryId } },
        subcategory: input.subcategoryId ? { connect: { id: input.subcategoryId } } : undefined,
        payee: payee ? { connect: { id: payee.id } } : undefined,
      },
    });
    if (!wallet.balanceAsOf || transaction.transactionDate > wallet.balanceAsOf || (transaction.transactionDate.toDateString() === wallet.balanceAsOf.toDateString() && transaction.createdAt > wallet.balanceAsOf)) await applyBalanceDelta(tx, wallet.id, balanceDelta("EXPENSE", totalAmount));
    for (const participant of splitBill.participants) {
      if (participant.isMe || participant.shareAmount.lte(0) || participant.receivable) continue;
      const receivableAmount = participant.shareAmount;
      await tx.receivable.create({ data: { personName: participant.name, description: "Split Bill: " + splitBill.merchantName, amount: receivableAmount, currencyId: wallet.currencyId, sourceWalletId: wallet.id, loanDate: input.transactionDate, sourceTransactionId: transaction.id, splitBillParticipantId: participant.id } });
    }
    await tx.splitBill.update({ where: { id: splitBill.id }, data: { transactionId: transaction.id, status: SplitBillStatus.OPEN, paymentDate: input.transactionDate } });
    return transaction;
  });
}

export async function getSplitBills() {
  return prisma.splitBill.findMany({ include: { transaction: { include: { wallet: { select: { name: true, walletType: true, currency: { select: { code: true, symbol: true } } } }, payee: { select: { name: true } }, category: { select: { name: true } } } }, participants: { include: { receivable: { include: { payments: { select: { amount: true } } } }, payable: { include: { currency: { select: { code: true, symbol: true } }, payments: { select: { amount: true, appliedAmount: true, excessAmount: true, paidAt: true, walletId: true } } } } }, orderBy: { isMe: "desc" } }, items: { include: { allocations: true }, orderBy: { id: "asc" } } }, orderBy: { createdAt: "desc" } });
}

function transactionAffectedBalance(transaction: { transactionDate: Date; createdAt: Date }, balanceAsOf: Date | null) { return !balanceAsOf || transaction.transactionDate > balanceAsOf || (transaction.transactionDate.toDateString() === balanceAsOf.toDateString() && transaction.createdAt > balanceAsOf); }

export async function deleteSplitBill(splitBillId: string) {
  return prisma.$transaction(async (tx) => {
    const splitBill = await tx.splitBill.findUnique({
      where: { id: splitBillId },
      include: {
        transaction: { include: { wallet: { select: { id: true, balanceAsOf: true } } } },
        participants: {
          include: {
            receivable: {
              include: {
                payments: { include: { transaction: { include: { wallet: { select: { id: true, balanceAsOf: true } } } } } },
              },
            },
            payable: {
              include: {
                payments: { include: { transaction: { include: { wallet: { select: { id: true, balanceAsOf: true } } } } } },
              },
            },
          },
        },
      },
    });
    if (!splitBill) throw new Error("Split Bill not found.");
    for (const participant of splitBill.participants) {
      const receivable = participant.receivable;
      if (receivable) {
        for (const payment of receivable.payments) {
          if (transactionAffectedBalance(payment.transaction, payment.transaction.wallet.balanceAsOf)) {
            await applyBalanceDelta(tx, payment.transaction.wallet.id, balanceDelta("INCOME", payment.amount).negated());
          }
          await tx.transaction.delete({ where: { id: payment.transaction.id } });
        }
        await tx.receivable.delete({ where: { id: receivable.id } });
      }

      const payable = participant.payable;
      if (payable) {
        for (const payment of payable.payments) {
          if (transactionAffectedBalance(payment.transaction, payment.transaction.wallet.balanceAsOf)) {
            await applyBalanceDelta(tx, payment.transaction.wallet.id, balanceDelta("EXPENSE", payment.amount).negated());
          }
          await tx.transaction.delete({ where: { id: payment.transaction.id } });
        }
        await tx.payable.delete({ where: { id: payable.id } });
      }
    }
    if (splitBill.transaction) {
      if (transactionAffectedBalance(splitBill.transaction, splitBill.transaction.wallet.balanceAsOf)) {
        await applyBalanceDelta(tx, splitBill.transaction.wallet.id, balanceDelta("EXPENSE", splitBill.transaction.amount).negated());
      }
      await tx.transaction.delete({ where: { id: splitBill.transaction.id } });
    }
    await tx.splitBill.delete({ where: { id: splitBill.id } });
  });
}
