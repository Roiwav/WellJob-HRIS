export const COMPANY_OPTIONS = [
  "SM Supermalls", "Robinsons Retail Holdings", "Ayala Land Inc.",
  "Jollibee Foods Corporation", "San Miguel Corporation", "PLDT Inc.",
  "Globe Telecom", "BDO Unibank", "Metrobank", "Puregold Price Club",
  "Wilcon Depot", "DMCI Holdings", "Megaworld Corporation",
  "Unilab Inc.", "Nestlé Philippines", "Coca-Cola Philippines",
  "Pepsi-Cola Products Philippines", "Toyota Philippines", "Honda Philippines",
  "Accenture Philippines", "IBM Philippines", "Teleperformance Philippines",
  "Concentrix Philippines", "Sitel Philippines",
];

export const DOCUMENT_OPTIONS = [
  { name: "Resume", expirable: false },
  { name: "NSO/PSA", expirable: false },
  { name: "SSS (ID or E1 form)", expirable: false },
  { name: "Pag-IBIG (ID or MDRF Form)", expirable: false },
  { name: "PhilHealth (ID or MDF Form)", expirable: false },
  { name: "Diploma", expirable: false },
  { name: "Cedula", expirable: false },
  { name: "Barangay Clearance", expirable: true },
  { name: "NBI/Police Clearance", expirable: true },
];

export const MIN_DEPLOYED_DOCUMENTS = 5;

export function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

// UPDATED: Smart Name Capitalization for Suffixes and Roman Numerals
export function toProperName(name) {
  if (!name) return "";

  // Listahan ng mga suffix na may special rules
  const romanNumerals = ["ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
  const standardSuffixes = ["jr", "jr.", "sr", "sr."];

  return String(name)
    .trim()
    .replace(/\s+/g, " ") // Tanggalin ang sobrang spaces
    .split(" ")
    .map((word) => {
      const lowerWord = word.toLowerCase();

      // 1. Kung Roman Numeral, gawing ALL CAPS (ex. III, IV)
      if (romanNumerals.includes(lowerWord)) {
        return word.toUpperCase();
      }

      // 2. Kung Jr. o Sr., gawing Title Case (ex. Jr., Sr.)
      if (standardSuffixes.includes(lowerWord)) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }

      // 3. Normal na pangalan (Title Case)
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function createDefaultDocuments(existingDocs = []) {
  return DOCUMENT_OPTIONS.map((doc) => {
    const matched = existingDocs.find((d) => d.name === doc.name);

    return {
      name: doc.name,
      expirable: doc.expirable,
      checked: !!matched,
      expirationDate: matched?.expirationDate || "",
      filePath: matched?.filePath || null,
      file: matched?.filePath
        ? {
            url: `http://localhost:5000/${matched.filePath}`,
            name: matched.name,
            type: matched.filePath.endsWith(".pdf") ? "application/pdf" : "image/*",
          }
        : null,
    };
  });
}

export function getDocumentStatus(expirationDate) {
  if (!expirationDate) return "No Data";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return "Expired";
  if (diffDays <= 30) return "Expiring Soon";
  return "Valid";
}