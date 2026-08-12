import "dotenv/config";
import { CategoryType } from "@prisma/client";
import { prisma } from "../lib/prisma";

async function main() {
  const currencies = [
    { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimalPlaces: 0 },
    { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
    { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimalPlaces: 2 },
    { code: "JPY", name: "Japanese Yen", symbol: "¥", decimalPlaces: 0 },
    { code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2 },
    { code: "GBP", name: "British Pound", symbol: "£", decimalPlaces: 2 },
    { code: "AUD", name: "Australian Dollar", symbol: "A$", decimalPlaces: 2 },
    { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", decimalPlaces: 2 },
    { code: "THB", name: "Thai Baht", symbol: "฿", decimalPlaces: 2 },
    { code: "KRW", name: "South Korean Won", symbol: "₩", decimalPlaces: 0 },
  ];

  for (const currency of currencies) {
    await prisma.currency.upsert({ where: { code: currency.code }, update: currency, create: currency });
  }

  const expenseCategories = [
    ["Food & Dining", ["Groceries", "Restaurants", "Coffee & Drinks", "Delivery & Takeaway", "Snacks & Desserts"]],
    ["Housing", ["Rent / Mortgage", "Utilities", "Household", "Maintenance & Repairs"]],
    ["Transportation", ["Fuel", "Public Transportation", "Taxi / Ride-hailing", "Parking", "Toll", "Vehicle Maintenance"]],
    ["Shopping", ["Clothing", "Electronics", "Personal Items", "Home & Furniture", "Gifts"]],
    ["Health & Wellness", ["Medical", "Pharmacy", "Dental", "Fitness", "Personal Care"]],
    ["Entertainment", ["Movies & Events", "Hobbies", "Games", "Streaming & Subscriptions"]],
    ["Travel", ["Flights", "Hotels", "Local Transport", "Activities", "Other Travel"]],
    ["Finance & Fees", ["Transfer Fee", "Bank Fee", "ATM Fee", "Credit Card Fee", "Interest", "Tax & Government Fee"]],
    ["Family & Education", ["Family Support", "Childcare", "Education", "School / Tuition"]],
    ["Insurance & Protection", ["Insurance", "Other Protection"]],
    ["Other", ["Charity / Donation", "Other Expense"]],
  ] as const;

  const incomeCategories = [
    ["Employment", ["Salary", "Bonus", "Overtime", "Allowance"]],
    ["Business & Side Income", ["Business Income", "Freelance", "Commission", "Rental Income"]],
    ["Investment", ["Dividend", "Interest Income", "Capital Gain"]],
    ["Other Income", ["Gift Received", "Refund", "Reimbursement", "Other Income"]],
  ] as const;

  async function seedCategory(type: CategoryType, name: string, subcategoryNames: readonly string[], sortOrder: number) {
    const existing = await prisma.category.findFirst({ where: { name, type } });
    const category = existing
      ? await prisma.category.update({ where: { id: existing.id }, data: { isSystem: true, isActive: true, sortOrder } })
      : await prisma.category.create({ data: { name, type, isSystem: true, sortOrder } });

    for (const [index, subcategoryName] of subcategoryNames.entries()) {
      const existingSubcategory = await prisma.subcategory.findUnique({ where: { categoryId_name: { categoryId: category.id, name: subcategoryName } } });
      if (existingSubcategory) {
        await prisma.subcategory.update({ where: { id: existingSubcategory.id }, data: { isSystem: true, isActive: true, sortOrder: index } });
      } else {
        await prisma.subcategory.create({ data: { categoryId: category.id, name: subcategoryName, isSystem: true, sortOrder: index } });
      }
    }
  }

  for (const [index, [name, subcategories]] of expenseCategories.entries()) await seedCategory(CategoryType.EXPENSE, name, subcategories, index);
  for (const [index, [name, subcategories]] of incomeCategories.entries()) await seedCategory(CategoryType.INCOME, name, subcategories, index);

  // Hide legacy categories that are not part of the canonical taxonomy.
  await prisma.category.updateMany({
    where: { type: CategoryType.EXPENSE, name: { notIn: expenseCategories.map(([name]) => name) } },
    data: { isActive: false },
  });
  await prisma.category.updateMany({
    where: { type: CategoryType.INCOME, name: { notIn: incomeCategories.map(([name]) => name) } },
    data: { isActive: false },
  });

  console.log("✅ Currency and canonical category hierarchy seeded successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
