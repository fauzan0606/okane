import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const currencies = [
    {
      code: "IDR",
      name: "Indonesian Rupiah",
      symbol: "Rp",
      decimalPlaces: 0,
    },
    {
      code: "USD",
      name: "US Dollar",
      symbol: "$",
      decimalPlaces: 2,
    },
    {
      code: "SGD",
      name: "Singapore Dollar",
      symbol: "S$",
      decimalPlaces: 2,
    },
    {
      code: "JPY",
      name: "Japanese Yen",
      symbol: "¥",
      decimalPlaces: 0,
    },
    {
      code: "EUR",
      name: "Euro",
      symbol: "€",
      decimalPlaces: 2,
    },
    {
      code: "GBP",
      name: "British Pound",
      symbol: "£",
      decimalPlaces: 2,
    },
    {
      code: "AUD",
      name: "Australian Dollar",
      symbol: "A$",
      decimalPlaces: 2,
    },
    {
      code: "MYR",
      name: "Malaysian Ringgit",
      symbol: "RM",
      decimalPlaces: 2,
    },
    {
      code: "THB",
      name: "Thai Baht",
      symbol: "฿",
      decimalPlaces: 2,
    },
    {
      code: "KRW",
      name: "South Korean Won",
      symbol: "₩",
      decimalPlaces: 0,
    },
  ];

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: {
        code: currency.code,
      },
      update: currency,
      create: currency,
    });
  }

  console.log("✅ Currency seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });