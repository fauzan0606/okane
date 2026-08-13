import type {
  ParserCategory,
  ParserContext,
  ParserSubcategory,
} from "./types";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: [
    "makan", "makan siang", "makan malam", "kantin", "warung", "restoran",
    "restaurant", "kopi", "coffee", "cafe", "starbucks", "grabfood", "gofood",
    "snack", "dessert", "groceries", "supermarket", "minimarket",
  ],
  transport: [
    "transport", "grab", "gojek", "ojek", "taxi", "taksi", "bensin", "parkir",
    "tol", "kereta", "bus", "fuel", "ride-hailing",
  ],
  shopping: ["belanja", "shopping", "shop", "tokopedia", "shopee", "lazada"],
  housing: ["sewa", "rent", "mortgage", "listrik", "air", "internet", "wifi", "rumah", "kos", "maintenance"],
  health: ["dokter", "hospital", "rumah sakit", "obat", "pharmacy", "apotek", "dental", "gym", "fitness", "salon"],
  entertainment: ["bioskop", "cinema", "movie", "hobi", "game", "netflix", "spotify", "streaming", "event"],
  travel: ["flight", "pesawat", "hotel", "travel", "liburan", "vacation", "tour", "wisata"],
  finance: ["fee", "admin", "biaya admin", "atm", "interest", "bunga", "pajak", "tax", "transfer fee"],
  family: ["keluarga", "family", "sekolah", "school", "kuliah", "tuition", "education", "childcare"],
  insurance: ["asuransi", "insurance", "protection"],
  other: ["donasi", "charity", "donation"],
  salary: ["gaji", "salary", "bonus", "thr", "overtime", "lembur", "allowance", "tunjangan"],
  business: ["business", "freelance", "commission", "rental income", "usaha"],
  investment: ["dividen", "dividend", "bunga investasi", "capital gain", "investasi"],
  income: ["refund", "cashback", "reimbursement", "gift received"],
};

const SUBCATEGORY_KEYWORDS: Record<string, string[]> = {
  Groceries: ["groceries", "supermarket", "minimarket", "indomaret", "alfamart", "sayur", "sembako"],
  Restaurants: ["restoran", "restaurant", "warung", "makan", "dining", "lunch", "dinner"],
  "Coffee & Drinks": ["kopi", "coffee", "cafe", "starbucks", "minuman", "drink", "tea", "teh"],
  "Delivery & Takeaway": ["grabfood", "gofood", "delivery", "takeaway", "pesan antar", "food delivery"],
  "Snacks & Desserts": ["snack", "dessert", "camilan", "kue", "cake", "ice cream", "es krim"],
  Fuel: ["bensin", "fuel", "pertalite", "pertamax", "shell", "spbu"],
  "Public Transportation": ["kereta", "train", "bus", "transjakarta", "commuter", "mrt", "lrt", "angkot"],
  "Taxi / Ride-hailing": ["grab", "gojek", "ojek", "taxi", "taksi", "ride-hailing"],
  Parking: ["parkir", "parking"],
  Toll: ["tol", "toll"],
  "Vehicle Maintenance": ["service mobil", "service motor", "bengkel", "ban", "oli", "vehicle maintenance"],
  "Rent / Mortgage": ["rent", "sewa", "mortgage", "kontrakan", "kos"],
  Utilities: ["listrik", "pln", "air", "internet", "wifi", "pulsa", "utilities"],
  Household: ["household", "peralatan rumah", "cleaning", "sabun rumah"],
  "Maintenance & Repairs": ["maintenance", "repair", "perbaikan", "renovasi"],
  Clothing: ["baju", "pakaian", "clothing", "fashion", "sepatu"],
  Electronics: ["elektronik", "electronics", "laptop", "hp", "phone", "gadget"],
  "Personal Items": ["personal item", "tas", "jam", "aksesori", "accessories"],
  "Home & Furniture": ["furniture", "mebel", "furnitur", "home", "perabot"],
  Gifts: ["gift", "hadiah", "kado"],
  Medical: ["dokter", "hospital", "rumah sakit", "medical", "klinik"],
  Pharmacy: ["obat", "apotek", "pharmacy", "medicine"],
  Dental: ["dokter gigi", "dental", "dentist"],
  Fitness: ["gym", "fitness", "workout"],
  "Personal Care": ["salon", "barbershop", "skincare", "personal care"],
  "Movies & Events": ["bioskop", "cinema", "movie", "event", "konser"],
  Hobbies: ["hobi", "hobby"],
  Games: ["game", "gaming"],
  "Streaming & Subscriptions": ["netflix", "spotify", "youtube premium", "streaming", "subscription", "langganan"],
  Flights: ["flight", "pesawat", "airline", "tiket pesawat"],
  Hotels: ["hotel", "penginapan", "accommodation"],
  "Local Transport": ["transport lokal", "shuttle", "airport transfer"],
  Activities: ["wisata", "tour", "activity", "aktivitas"],
  "Transfer Fee": ["transfer fee", "biaya transfer"],
  "Bank Fee": ["bank fee", "biaya admin", "admin bank"],
  "ATM Fee": ["atm fee", "biaya atm", "tarik tunai fee"],
  "Credit Card Fee": ["credit card fee", "annual fee", "biaya kartu kredit"],
  Interest: ["interest", "bunga"],
  "Tax & Government Fee": ["tax", "pajak", "government fee", "bea"],
  "Family Support": ["keluarga", "family support", "uang keluarga"],
  Childcare: ["childcare", "pengasuh", "daycare"],
  Education: ["education", "kursus", "kuliah", "college"],
  "School / Tuition": ["school", "sekolah", "tuition", "spp"],
  Insurance: ["insurance", "asuransi"],
  "Charity / Donation": ["donasi", "charity", "donation", "sedekah"],
  Salary: ["gaji", "salary"],
  Bonus: ["bonus", "thr"],
  Overtime: ["overtime", "lembur"],
  Allowance: ["allowance", "tunjangan"],
  "Business Income": ["business income", "usaha"],
  Freelance: ["freelance"],
  Commission: ["commission", "komisi"],
  "Rental Income": ["rental income", "sewa diterima"],
  Dividend: ["dividend", "dividen"],
  "Interest Income": ["interest income", "bunga diterima"],
  "Capital Gain": ["capital gain", "keuntungan investasi"],
  "Gift Received": ["gift received", "hadiah diterima"],
  Refund: ["refund", "pengembalian dana"],
  Reimbursement: ["reimbursement", "penggantian biaya"],
};

function getCategoryGroup(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("food") || normalized.includes("drink")) return "food";
  if (normalized.includes("transport")) return "transport";
  if (normalized.includes("shopping")) return "shopping";
  if (normalized.includes("housing")) return "housing";
  if (normalized.includes("health") || normalized.includes("wellness")) return "health";
  if (normalized.includes("entertainment")) return "entertainment";
  if (normalized.includes("travel")) return "travel";
  if (normalized.includes("finance") || normalized.includes("fee")) return "finance";
  if (normalized.includes("family") || normalized.includes("education")) return "family";
  if (normalized.includes("insurance") || normalized.includes("protection")) return "insurance";
  if (normalized === "other") return "other";
  if (normalized.includes("employment")) return "salary";
  if (normalized.includes("business")) return "business";
  if (normalized.includes("investment")) return "investment";
  if (normalized.includes("other income") || normalized.includes("income")) return "income";
  return normalized;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[&/\-]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreSubcategory(subcategory: ParserSubcategory, input: string) {
  const name = normalize(subcategory.name);
  const keywords = SUBCATEGORY_KEYWORDS[subcategory.name] ?? [];
  const candidates = [name, ...keywords.map(normalize)];
  return candidates.reduce((score, keyword) => {
    if (!keyword) return score;
    return input.includes(keyword) ? Math.max(score, keyword.length) : score;
  }, 0);
}

export function findCategory(text: string, context: ParserContext): ParserCategory | undefined {
  const input = normalize(text);
  for (const category of context.categories) {
    const group = getCategoryGroup(category.name);
    const keywords = CATEGORY_KEYWORDS[group] ?? [];
    if (keywords.some((keyword) => input.includes(normalize(keyword)))) return category;
  }
  return undefined;
}

export function findSubcategory(
  text: string,
  category: ParserCategory | undefined,
  context: ParserContext
): ParserSubcategory | undefined {
  if (!category) return undefined;
  const input = normalize(text);
  const candidates = context.subcategories
    .filter((subcategory) => subcategory.categoryId === category.id && subcategory.isActive !== false)
    .map((subcategory) => ({ subcategory, score: scoreSubcategory(subcategory, input) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.subcategory;
}
