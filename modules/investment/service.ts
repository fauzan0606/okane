import {
  InvestmentAccountType,
  InvestmentAssetType,
  InvestmentCashMovementType,
  InvestmentTransactionType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const D = Prisma.Decimal;

const money = (v: Prisma.Decimal) => v.toDecimalPlaces(2);

const positive = (v: number, label: string) => {
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return new D(v);
};

const nonNegative = (v: number | undefined, label: string) => {
  const n = v ?? 0;

  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return new D(n);
};

type BuySellTransactionType = "BUY" | "SELL";
type IncomeTransactionType = "DIVIDEND" | "INTEREST" | "COUPON";

async function funding(
  tx: Prisma.TransactionClient,
  accountId: string,
  cashAccountId?: string,
  walletId?: string,
) {
  const target = await tx.investmentAccount.findUnique({
    where: { id: accountId },
    select: {
      providerId: true,
      currencyId: true,
    },
  });

  if (!target) {
    throw new Error("Investment account not found.");
  }

  if (cashAccountId) {
    const cash = await tx.investmentCashAccount.findUnique({
      where: { id: cashAccountId },
      include: { account: true },
    });

    if (
      !cash ||
      cash.account.providerId !== target.providerId ||
      cash.account.currencyId !== target.currencyId
    ) {
      throw new Error(
        "Funding cash account must belong to the same investment provider and currency.",
      );
    }

    return {
      kind: "CASH" as const,
      cash,
    };
  }

  if (walletId) {
    const wallet = await tx.wallet.findUnique({
      where: { id: walletId },
      include: { currency: true },
    });

    if (!wallet || wallet.currencyId !== target.currencyId) {
      throw new Error(
        "Funding wallet currency must match the investment account.",
      );
    }

    return {
      kind: "WALLET" as const,
      wallet,
    };
  }

  throw new Error("Select a funding wallet or investment cash account.");
}

async function debit(
  tx: Prisma.TransactionClient,
  f: Awaited<ReturnType<typeof funding>>,
  amount: Prisma.Decimal,
) {
  if (f.kind === "CASH") {
    if (f.cash.balance.lt(amount)) {
      throw new Error(`Insufficient balance in ${f.cash.account.name}.`);
    }

    await tx.investmentCashAccount.update({
      where: { id: f.cash.id },
      data: {
        balance: {
          decrement: amount,
        },
      },
    });
  } else {
    if (f.wallet.currentBalance.lt(amount)) {
      throw new Error(`Insufficient balance in ${f.wallet.name}.`);
    }

    await tx.wallet.update({
      where: { id: f.wallet.id },
      data: {
        currentBalance: {
          decrement: amount,
        },
      },
    });
  }
}

async function credit(
  tx: Prisma.TransactionClient,
  f: Awaited<ReturnType<typeof funding>>,
  amount: Prisma.Decimal,
) {
  if (f.kind === "CASH") {
    await tx.investmentCashAccount.update({
      where: { id: f.cash.id },
      data: {
        balance: {
          increment: amount,
        },
      },
    });
  } else {
    await tx.wallet.update({
      where: { id: f.wallet.id },
      data: {
        currentBalance: {
          increment: amount,
        },
      },
    });
  }
}

export async function getInvestmentOverview() {
  const [
    providers,
    accounts,
    assets,
    holdings,
    transactions,
    cashAccounts,
    currencies,
    wallets,
  ] = await Promise.all([
    prisma.investmentProvider.findMany({
      where: { isActive: true },
      include: {
        feeRules: {
          orderBy: { effectiveFrom: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),

    prisma.investmentAccount.findMany({
      where: { isActive: true },
      include: {
        provider: true,
        currency: true,
        cashAccount: true,
      },
      orderBy: { name: "asc" },
    }),

    prisma.investmentAsset.findMany({
      where: { isActive: true },
      include: {
        currency: true,
      },
      orderBy: { name: "asc" },
    }),

    prisma.investmentHolding.findMany({
      where: {
        quantity: {
          gt: 0,
        },
      },
      include: {
        asset: {
          include: {
            currency: true,
          },
        },
        account: {
          include: {
            provider: true,
            currency: true,
          },
        },
      },
      orderBy: {
        costBasis: "desc",
      },
    }),

    prisma.investmentTransaction.findMany({
      include: {
        asset: true,
        account: {
          include: {
            provider: true,
          },
        },
        currency: true,
      },
      orderBy: [
        {
          transactionDate: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 30,
    }),

    prisma.investmentCashAccount.findMany({
      include: {
        account: {
          include: {
            provider: true,
            currency: true,
          },
        },
      },
      orderBy: {
        balance: "desc",
      },
    }),

    prisma.currency.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        code: "asc",
      },
    }),

    prisma.wallet.findMany({
      where: {
        isActive: true,
        walletType: {
          not: "CREDIT_CARD",
        },
      },
      include: {
        currency: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  const holdingRows = holdings.map((h) => {
    const value = h.currentPrice
      ? h.quantity.mul(h.currentPrice)
      : h.costBasis;

    const gain = value.minus(h.costBasis);

    return {
      ...h,
      marketValue: value,
      gain,
      returnPct: h.costBasis.isZero()
        ? new D(0)
        : gain.div(h.costBasis).mul(100),
    };
  });

  const totalValue = holdingRows.reduce(
    (s, h) => s.plus(h.marketValue),
    new D(0),
  );

  const totalCost = holdingRows.reduce(
    (s, h) => s.plus(h.costBasis),
    new D(0),
  );

  const totalCash = cashAccounts.reduce(
    (s, c) => s.plus(c.balance),
    new D(0),
  );

  const unrealized = totalValue.minus(totalCost);

  return {
    providers,
    accounts,
    assets,
    holdings: holdingRows,
    transactions,
    cashAccounts,
    currencies,
    wallets,
    summary: {
      totalValue,
      totalCost,
      totalCash,
      totalInvestmentValue: totalValue.plus(totalCash),
      unrealized,
      returnPct: totalCost.isZero()
        ? new D(0)
        : unrealized.div(totalCost).mul(100),
    },
  };
}

export async function createInvestmentProvider(input: {
  name: string;
  countryCode: string;
  websiteUrl?: string;
  note?: string;
}) {
  if (!input.name.trim()) {
    throw new Error("Provider name is required.");
  }

  return prisma.investmentProvider.create({
    data: {
      name: input.name.trim(),
      countryCode: input.countryCode.toUpperCase(),
      websiteUrl: input.websiteUrl || null,
      note: input.note || null,
    },
  });
}

export async function createInvestmentAccount(input: {
  providerId: string;
  name: string;
  accountType: InvestmentAccountType;
  currencyId: string;
  accountNumberMasked?: string;
  createCashAccount?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.investmentAccount.create({
      data: {
        providerId: input.providerId,
        name: input.name.trim(),
        accountType: input.accountType,
        currencyId: input.currencyId,
        accountNumberMasked: input.accountNumberMasked || null,
      },
    });

    if (
      input.createCashAccount ||
      input.accountType === InvestmentAccountType.CASH
    ) {
      await tx.investmentCashAccount.create({
        data: {
          accountId: account.id,
        },
      });
    }

    return account;
  });
}

export async function createInvestmentAsset(input: {
  symbol?: string;
  name: string;
  assetType: InvestmentAssetType;
  countryCode?: string;
  currencyId: string;
  unitName: string;
  purity?: number;
}) {
  if (!input.name.trim()) {
    throw new Error("Asset name is required.");
  }

  return prisma.investmentAsset.create({
    data: {
      symbol: input.symbol?.trim().toUpperCase() || null,
      name: input.name.trim(),
      assetType: input.assetType,
      countryCode: input.countryCode?.toUpperCase() || null,
      currencyId: input.currencyId,
      unitName: input.unitName.trim(),
      purity:
        input.purity == null
          ? null
          : new D(input.purity),
    },
  });
}

export async function createCashDeposit(input: {
  cashAccountId: string;
  amount: number;
  date: Date;
  sourceWalletId?: string;
  note?: string;
}) {
  const amount = positive(input.amount, "Deposit amount");

  return prisma.$transaction(async (tx) => {
    const cash = await tx.investmentCashAccount.findUnique({
      where: {
        id: input.cashAccountId,
      },
      include: {
        account: true,
      },
    });

    if (!cash) {
      throw new Error("Investment cash account not found.");
    }

    if (input.sourceWalletId) {
      const wallet = await tx.wallet.findUnique({
        where: {
          id: input.sourceWalletId,
        },
      });

      if (
        !wallet ||
        wallet.currencyId !== cash.account.currencyId
      ) {
        throw new Error(
          "Source wallet currency must match the investment cash account.",
        );
      }

      if (wallet.currentBalance.lt(amount)) {
        throw new Error(`Insufficient balance in ${wallet.name}.`);
      }

      await tx.wallet.update({
        where: {
          id: wallet.id,
        },
        data: {
          currentBalance: {
            decrement: amount,
          },
        },
      });
    }

    await tx.investmentCashAccount.update({
      where: {
        id: cash.id,
      },
      data: {
        balance: {
          increment: amount,
        },
      },
    });

    return tx.investmentCashMovement.create({
      data: {
        cashAccountId: cash.id,
        movementType: InvestmentCashMovementType.DEPOSIT,
        amount,
        movementDate: input.date,
        sourceWalletId: input.sourceWalletId || null,
        note: input.note || null,
      },
    });
  });
}

export async function createCashWithdrawal(input: {
  cashAccountId: string;
  amount: number;
  date: Date;
  destinationWalletId?: string;
  note?: string;
}) {
  const amount = positive(input.amount, "Withdrawal amount");

  return prisma.$transaction(async (tx) => {
    const cash = await tx.investmentCashAccount.findUnique({
      where: {
        id: input.cashAccountId,
      },
      include: {
        account: true,
      },
    });

    if (!cash || cash.balance.lt(amount)) {
      throw new Error("Insufficient investment cash balance.");
    }

    if (input.destinationWalletId) {
      const wallet = await tx.wallet.findUnique({
        where: {
          id: input.destinationWalletId,
        },
      });

      if (
        !wallet ||
        wallet.currencyId !== cash.account.currencyId
      ) {
        throw new Error(
          "Destination wallet currency must match the investment cash account.",
        );
      }

      await tx.wallet.update({
        where: {
          id: wallet.id,
        },
        data: {
          currentBalance: {
            increment: amount,
          },
        },
      });
    }

    await tx.investmentCashAccount.update({
      where: {
        id: cash.id,
      },
      data: {
        balance: {
          decrement: amount,
        },
      },
    });

    return tx.investmentCashMovement.create({
      data: {
        cashAccountId: cash.id,
        movementType: InvestmentCashMovementType.WITHDRAWAL,
        amount,
        movementDate: input.date,
        sourceWalletId: input.destinationWalletId || null,
        note: input.note || null,
      },
    });
  });
}

export async function updateHoldingPrice(input: {
  holdingId: string;
  price: number;
  date: Date;
}) {
  const price = positive(input.price, "Current price");

  return prisma.investmentHolding.update({
    where: {
      id: input.holdingId,
    },
    data: {
      currentPrice: price,
      priceAsOf: input.date,
    },
  });
}

export async function calculateInvestmentCosts(input: {
  providerId: string;
  assetType: InvestmentAssetType;
  transactionType: InvestmentTransactionType;
  grossAmount: number;
  date: Date;
  feeRateOverride?: number;
  taxRateOverride?: number;
  fixedFeeOverride?: number;
}) {
  const gross = positive(input.grossAmount, "Gross amount");

  const rule = await prisma.investmentFeeRule.findFirst({
    where: {
      providerId: input.providerId,
      assetType: input.assetType,
      transactionType: input.transactionType,
      effectiveFrom: {
        lte: input.date,
      },
      OR: [
        {
          effectiveTo: null,
        },
        {
          effectiveTo: {
            gte: input.date,
          },
        },
      ],
    },
    orderBy: {
      effectiveFrom: "desc",
    },
  });

  const feeRate =
    input.feeRateOverride ?? Number(rule?.feeRate ?? 0);

  const taxRate =
    input.taxRateOverride ?? Number(rule?.taxRate ?? 0);

  const fixed =
    input.fixedFeeOverride ?? Number(rule?.fixedFee ?? 0);

  const fee = gross
    .mul(feeRate)
    .div(100)
    .plus(fixed);

  const tax = gross
    .mul(taxRate)
    .div(100);

  return {
    gross,
    fee: money(fee),
    tax: money(tax),
    totalBuy: money(
      gross.plus(fee).plus(tax),
    ),
    netSell: money(
      gross.minus(fee).minus(tax),
    ),
    rule,
  };
}

export async function createInvestmentTransaction(input: {
  accountId: string;
  assetId: string;
  transactionType: InvestmentTransactionType;
  transactionDate: Date;
  quantity: number;
  unitPrice: number;
  feeAmount?: number;
  taxAmount?: number;
  otherCharges?: number;
  fundingCashAccountId?: string;
  fundingWalletId?: string;
  note?: string;
}) {
  const quantity = positive(
    input.quantity,
    "Quantity",
  );

  const unitPrice = positive(
    input.unitPrice,
    "Unit price",
  );

  const fee = nonNegative(
    input.feeAmount,
    "Fee",
  );

  const tax = nonNegative(
    input.taxAmount,
    "Tax",
  );

  const other = nonNegative(
    input.otherCharges,
    "Other charges",
  );

  const rawTransactionType =
    String(input.transactionType);

  if (
    rawTransactionType !== "BUY" &&
    rawTransactionType !== "SELL"
  ) {
    throw new Error(
      "Use the income action for dividend, interest or coupon.",
    );
  }

  const transactionType: BuySellTransactionType =
    rawTransactionType;

  return prisma.$transaction(async (tx) => {
    const account =
      await tx.investmentAccount.findUnique({
        where: {
          id: input.accountId,
        },
        include: {
          provider: true,
          currency: true,
        },
      });

    const asset =
      await tx.investmentAsset.findUnique({
        where: {
          id: input.assetId,
        },
        include: {
          currency: true,
        },
      });

    if (!account || !asset) {
      throw new Error(
        "Investment account or asset not found.",
      );
    }

    if (account.currencyId !== asset.currencyId) {
      throw new Error(
        "Investment account and asset currency must match.",
      );
    }

    const gross = money(
      quantity.mul(unitPrice),
    );

    const costs = fee
      .plus(tax)
      .plus(other);

    const f = await funding(
      tx,
      account.id,
      input.fundingCashAccountId,
      input.fundingWalletId,
    );

    const holding =
      await tx.investmentHolding.findUnique({
        where: {
          accountId_assetId: {
            accountId: account.id,
            assetId: asset.id,
          },
        },
      });

    if (transactionType === "BUY") {
      const total = money(
        gross.plus(costs),
      );

      await debit(tx, f, total);

      const current =
        holding ??
        (await tx.investmentHolding.create({
          data: {
            accountId: account.id,
            assetId: asset.id,
          },
        }));

      const updated =
        await tx.investmentHolding.update({
          where: {
            id: current.id,
          },
          data: {
            quantity:
              current.quantity.plus(quantity),
            costBasis:
              current.costBasis.plus(total),
            currentPrice: unitPrice,
            priceAsOf: input.transactionDate,
          },
        });

      return tx.investmentTransaction.create({
        data: {
          accountId: account.id,
          assetId: asset.id,
          holdingId: updated.id,
          transactionType,
          transactionDate: input.transactionDate,
          quantity,
          unitPrice,
          grossAmount: gross,
          feeAmount: fee,
          taxAmount: tax,
          otherCharges: other,
          totalCashAmount: total,
          netCashAmount: total.neg(),
          costBasisAmount: total,
          fundingCashAccountId:
            f.kind === "CASH"
              ? f.cash.id
              : null,
          fundingWalletId:
            f.kind === "WALLET"
              ? f.wallet.id
              : null,
          currencyId:
            account.currencyId,
          note: input.note || null,
          feeRuleSnapshot: JSON.stringify({
            fee: fee.toString(),
            tax: tax.toString(),
            other: other.toString(),
          }),
        },
      });
    }

    if (
      !holding ||
      holding.quantity.lt(quantity)
    ) {
      throw new Error(
        "Insufficient holding quantity.",
      );
    }

    const soldCost = holding.costBasis
      .mul(quantity)
      .div(holding.quantity);

    const net = money(
      gross.minus(costs),
    );

    await credit(tx, f, net);

    const updated =
      await tx.investmentHolding.update({
        where: {
          id: holding.id,
        },
        data: {
          quantity:
            holding.quantity.minus(quantity),
          costBasis:
            holding.costBasis.minus(soldCost),
          currentPrice: unitPrice,
          priceAsOf: input.transactionDate,
        },
      });

    return tx.investmentTransaction.create({
      data: {
        accountId: account.id,
        assetId: asset.id,
        holdingId: updated.id,
        transactionType,
        transactionDate: input.transactionDate,
        quantity,
        unitPrice,
        grossAmount: gross,
        feeAmount: fee,
        taxAmount: tax,
        otherCharges: other,
        totalCashAmount: gross,
        netCashAmount: net,
        costBasisAmount: soldCost,
        realizedGainLoss:
          net.minus(soldCost),
        fundingCashAccountId:
          f.kind === "CASH"
            ? f.cash.id
            : null,
        fundingWalletId:
          f.kind === "WALLET"
            ? f.wallet.id
            : null,
        currencyId:
          account.currencyId,
        note: input.note || null,
        feeRuleSnapshot: JSON.stringify({
          fee: fee.toString(),
          tax: tax.toString(),
          other: other.toString(),
        }),
      },
    });
  });
}

export async function recordInvestmentIncome(input: {
  accountId: string;
  assetId: string;
  type: InvestmentTransactionType;
  amount: number;
  date: Date;
  destinationCashAccountId?: string;
  destinationWalletId?: string;
  note?: string;
}) {
  const rawIncomeType = String(input.type);

  if (
    rawIncomeType !== "DIVIDEND" &&
    rawIncomeType !== "INTEREST" &&
    rawIncomeType !== "COUPON"
  ) {
    throw new Error(
      "Invalid investment income type.",
    );
  }

  const incomeType: IncomeTransactionType =
    rawIncomeType;

  const amount = positive(
    input.amount,
    "Income amount",
  );

  return prisma.$transaction(async (tx) => {
    const account =
      await tx.investmentAccount.findUnique({
        where: {
          id: input.accountId,
        },
        include: {
          provider: true,
        },
      });

    const asset =
      await tx.investmentAsset.findUnique({
        where: {
          id: input.assetId,
        },
      });

    if (
      !account ||
      !asset ||
      account.currencyId !== asset.currencyId
    ) {
      throw new Error(
        "Investment account and asset not found or currencies do not match.",
      );
    }

    const destination = await funding(
      tx,
      account.id,
      input.destinationCashAccountId,
      input.destinationWalletId,
    );

    await credit(
      tx,
      destination,
      amount,
    );

    const holding =
      await tx.investmentHolding.findUnique({
        where: {
          accountId_assetId: {
            accountId: account.id,
            assetId: asset.id,
          },
        },
      });

    return tx.investmentTransaction.create({
      data: {
        accountId: account.id,
        assetId: asset.id,
        holdingId: holding?.id,
        transactionType: incomeType,
        transactionDate: input.date,
        quantity: new D(0),
        unitPrice: new D(0),
        grossAmount: amount,
        netCashAmount: amount,
        totalCashAmount: amount,
        currencyId: account.currencyId,
        fundingCashAccountId:
          destination.kind === "CASH"
            ? destination.cash.id
            : null,
        fundingWalletId:
          destination.kind === "WALLET"
            ? destination.wallet.id
            : null,
        note: input.note || null,
      },
    });
  });
}

export async function addDefaultFeeRules(
  providerId: string,
  effectiveFrom = new Date(),
) {
  const existing =
    await prisma.investmentFeeRule.count({
      where: {
        providerId,
      },
    });

  if (existing) {
    return {
      created: 0,
    };
  }

  const provider =
    await prisma.investmentProvider.findUnique({
      where: {
        id: providerId,
      },
    });

  if (!provider) {
    throw new Error("Provider not found.");
  }

  if (
    provider.name
      .toLowerCase()
      .includes("indopremier")
  ) {
    await prisma.investmentFeeRule.createMany({
      data: [
        {
          providerId,
          assetType: InvestmentAssetType.STOCK,
          transactionType:
            "BUY" as InvestmentTransactionType,
          feeRate: 0.19,
          taxRate: 0,
          fixedFee: 0,
          effectiveFrom,
          sourceUrl:
            "https://manual.indopremier.com/",
          sourceLabel:
            "IndoPremier stock fee snapshot",
        },
        {
          providerId,
          assetType: InvestmentAssetType.STOCK,
          transactionType:
            "SELL" as InvestmentTransactionType,
          feeRate: 0.29,
          taxRate: 0.1,
          fixedFee: 0,
          effectiveFrom,
          sourceUrl:
            "https://manual.indopremier.com/",
          sourceLabel:
            "IndoPremier + Indonesian stock sale tax snapshot",
          note:
            "Tax source: https://pajak.go.id/index.php/id/pph-pasal-4-ayat-2",
        },
      ],
    });

    return {
      created: 2,
    };
  }

  return {
    created: 0,
  };
}

export function calculateBreakEvenPrice(
  quantity: number,
  acquisitionCost: number,
  sellFeeRatePct: number,
  sellTaxRatePct: number,
  sellFixedFee = 0,
  otherSellCosts = 0,
) {
  const q = positive(
    quantity,
    "Quantity",
  );

  const cost = positive(
    acquisitionCost,
    "Acquisition cost",
  );

  const fixed = new D(sellFixedFee).plus(
    otherSellCosts,
  );

  const netRate = new D(100)
    .minus(sellFeeRatePct)
    .minus(sellTaxRatePct);

  if (netRate.lte(0)) {
    throw new Error(
      "Selling fee and tax rates leave no positive net proceeds.",
    );
  }

  return money(
    cost
      .plus(fixed)
      .mul(100)
      .div(q.mul(netRate)),
  );
}