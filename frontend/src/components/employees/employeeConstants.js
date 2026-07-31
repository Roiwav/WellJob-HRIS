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

const ROMAN_NUMERALS = new Set([
  "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
]);

const NAME_SUFFIXES = {
  jr: "Jr",
  "jr.": "Jr.",
  sr: "Sr",
  "sr.": "Sr.",
};

export function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function toProperName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const lowerWord = word.toLowerCase();

      if (ROMAN_NUMERALS.has(lowerWord)) return lowerWord.toUpperCase();
      if (NAME_SUFFIXES[lowerWord]) return NAME_SUFFIXES[lowerWord];

      return lowerWord.replace(
        /(^|[-'’])([a-zñ])/g,
        (_, separator, letter) => `${separator}${letter.toUpperCase()}`
      );
    })
    .join(" ");
}

export function getDocumentStatus(expirationDate) {
  if (!expirationDate) return "No Data";

  const today = new Date();
  const expiration = new Date(expirationDate);

  if (Number.isNaN(expiration.getTime())) return "No Data";

  today.setHours(0, 0, 0, 0);
  expiration.setHours(0, 0, 0, 0);

  const daysRemaining = Math.ceil(
    (expiration.getTime() - today.getTime()) / 86400000
  );

  if (daysRemaining < 0) return "Expired";
  if (daysRemaining <= 30) return "Expiring Soon";
  return "Valid";
}