export const COMPANY_OPTIONS = [
  "SM Supermalls",
  "Robinsons Retail Holdings",
  "Ayala Land Inc.",
  "Jollibee Foods Corporation",
  "San Miguel Corporation",
  "PLDT Inc.",
  "Globe Telecom",
  "BDO Unibank",
  "Metrobank",
  "Puregold Price Club",
  "Wilcon Depot",
  "DMCI Holdings",
  "Megaworld Corporation",
  "Unilab Inc.",
  "Nestlé Philippines",
  "Coca-Cola Philippines",
  "Pepsi-Cola Products Philippines",
  "Toyota Philippines",
  "Honda Philippines",
  "Accenture Philippines",
  "IBM Philippines",
  "Teleperformance Philippines",
  "Concentrix Philippines",
  "Sitel Philippines",
];

/*
 * Employee compliance document configuration.
 *
 * documentNumber:
 * - enabled only for government compliance records that need a
 *   readable identifier in addition to the uploaded scanned copy.
 * - the actual value will be stored per employee document record.
 *
 * Existing historical records remain compatible because the future
 * database field will be nullable. The number is collected only when
 * HR Staff creates or edits the applicable compliance record.
 */
export const DOCUMENT_OPTIONS = [
  {
    name: "Resume",
    expirable: false,
    requiresDocumentNumber: false,
  },
  {
    name: "NSO/PSA",
    expirable: false,
    requiresDocumentNumber: false,
  },
  {
    name: "SSS (ID or E1 form)",
    expirable: false,
    requiresDocumentNumber: true,
    documentNumberLabel: "SSS Number",
    documentNumberPlaceholder: "Enter SSS Number",
  },
  {
    name: "Pag-IBIG (ID or MDRF Form)",
    expirable: false,
    requiresDocumentNumber: true,
    documentNumberLabel: "Pag-IBIG MID Number",
    documentNumberPlaceholder: "Enter Pag-IBIG MID Number",
  },
  {
    name: "PhilHealth (ID or MDF Form)",
    expirable: false,
    requiresDocumentNumber: true,
    documentNumberLabel: "PhilHealth Number",
    documentNumberPlaceholder: "Enter PhilHealth Number",
  },
  {
    name: "Diploma",
    expirable: false,
    requiresDocumentNumber: false,
  },
  {
    name: "Cedula",
    expirable: false,
    requiresDocumentNumber: false,
  },
  {
    name: "Barangay Clearance",
    expirable: true,
    requiresDocumentNumber: false,
  },
  {
    name: "NBI/Police Clearance",
    expirable: true,
    requiresDocumentNumber: false,
  },
];

export const MIN_DEPLOYED_DOCUMENTS = 5;

export const DOCUMENT_NUMBER_MAX_LENGTH = 64;

const COMPLIANCE_TIME_ZONE =
  "Asia/Manila";

const MILLISECONDS_PER_DAY =
  24 * 60 * 60 * 1000;

const ROMAN_NUMERALS = new Set([
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
]);

const NAME_SUFFIXES = {
  jr: "Jr",
  "jr.": "Jr.",
  sr: "Sr",
  "sr.": "Sr.",
};

export function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function toProperName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const lowerWord =
        word.toLowerCase();

      if (
        ROMAN_NUMERALS.has(
          lowerWord
        )
      ) {
        return lowerWord.toUpperCase();
      }

      if (
        NAME_SUFFIXES[
          lowerWord
        ]
      ) {
        return NAME_SUFFIXES[
          lowerWord
        ];
      }

      return lowerWord.replace(
        /(^|[-'’])([a-zñ])/g,
        (
          _,
          separator,
          letter
        ) =>
          `${separator}${letter.toUpperCase()}`
      );
    })
    .join(" ");
}

export function getDocumentOption(
  documentName
) {
  const normalizedName =
    String(
      documentName || ""
    )
      .trim()
      .toLowerCase();

  if (!normalizedName) {
    return null;
  }

  return (
    DOCUMENT_OPTIONS.find(
      (option) =>
        option.name
          .trim()
          .toLowerCase() ===
        normalizedName
    ) || null
  );
}

export function documentRequiresNumber(
  documentName
) {
  return Boolean(
    getDocumentOption(
      documentName
    )
      ?.requiresDocumentNumber
  );
}

export function getDocumentNumberLabel(
  documentName
) {
  const option =
    getDocumentOption(
      documentName
    );

  return (
    option
      ?.documentNumberLabel ||
    "Document Number"
  );
}

export function getDocumentNumberPlaceholder(
  documentName
) {
  const option =
    getDocumentOption(
      documentName
    );

  return (
    option
      ?.documentNumberPlaceholder ||
    "Enter document number"
  );
}

function getManilaDateOnly(
  value = new Date()
) {
  const date =
    value instanceof Date
      ? value
      : new Date(
          value
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          COMPLIANCE_TIME_ZONE,
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      }
    ).formatToParts(
      date
    );

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            [
              "year",
              "month",
              "day",
            ].includes(
              part.type
            )
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ]
        )
    );

  if (
    !values.year ||
    !values.month ||
    !values.day
  ) {
    return "";
  }

  return (
    `${values.year}-` +
    `${values.month}-` +
    `${values.day}`
  );
}

function normalizeComplianceDate(
  value
) {
  if (!value) {
    return "";
  }

  if (
    typeof value ===
    "string"
  ) {
    const normalized =
      value.trim();

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        normalized
      )
    ) {
      return normalized;
    }

    if (
      /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(
        normalized
      )
    ) {
      return normalized.slice(
        0,
        10
      );
    }
  }

  return getManilaDateOnly(
    value
  );
}

function businessDateToDayIndex(
  value
) {
  const normalized =
    normalizeComplianceDate(
      value
    );

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      normalized
    )
  ) {
    return null;
  }

  const [
    year,
    month,
    day,
  ] =
    normalized
      .split("-")
      .map(Number);

  const timestamp =
    Date.UTC(
      year,
      month - 1,
      day
    );

  const date =
    new Date(
      timestamp
    );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    return null;
  }

  return Math.floor(
    timestamp /
      MILLISECONDS_PER_DAY
  );
}

export function getDocumentStatus(
  expirationDate
) {
  if (!expirationDate) {
    return "No Data";
  }

  const todayDate =
    getManilaDateOnly();

  const todayDayIndex =
    businessDateToDayIndex(
      todayDate
    );

  const expirationDayIndex =
    businessDateToDayIndex(
      expirationDate
    );

  if (
    todayDayIndex ===
      null ||
    expirationDayIndex ===
      null
  ) {
    return "No Data";
  }

  const daysRemaining =
    expirationDayIndex -
    todayDayIndex;

  if (
    daysRemaining < 0
  ) {
    return "Expired";
  }

  if (
    daysRemaining <= 30
  ) {
    return "Expiring Soon";
  }

  return "Valid";
}