const MINIMUM_EMPLOYEE_AGE = 17;

function parseDateOnly(value) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      String(value || "").trim()
    );

  if (!match) {
    return null;
  }

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };

  const probe = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day
    )
  );

  if (
    probe.getUTCFullYear() !==
      parts.year ||
    probe.getUTCMonth() !==
      parts.month - 1 ||
    probe.getUTCDate() !==
      parts.day
  ) {
    return null;
  }

  return parts;
}

function calculateExactAge(
  birthday,
  referenceDate
) {
  const birth = parseDateOnly(
    birthday
  );
  const reference = parseDateOnly(
    referenceDate
  );

  if (!birth || !reference) {
    return null;
  }

  let age =
    reference.year - birth.year;

  const birthdayHasNotOccurred =
    reference.month < birth.month ||
    (
      reference.month === birth.month &&
      reference.day < birth.day
    );

  if (birthdayHasNotOccurred) {
    age -= 1;
  }

  return age;
}

function validateEmployeeMinimumAge(
  birthday,
  referenceDate,
  {
    required = false,
    minimumAge =
      MINIMUM_EMPLOYEE_AGE,
    referenceLabel =
      "Date Hired",
  } = {}
) {
  const normalizedBirthday =
    String(
      birthday || ""
    ).trim();

  if (!normalizedBirthday) {
    return required
      ? "Birthday is required."
      : "";
  }

  const age = calculateExactAge(
    normalizedBirthday,
    referenceDate
  );

  if (age === null) {
    return "Birthday and age reference date must be valid dates.";
  }

  if (age < minimumAge) {
    return `Employee must be at least ${minimumAge} years old on ${referenceLabel}.`;
  }

  return "";
}

module.exports = {
  MINIMUM_EMPLOYEE_AGE,
  calculateExactAge,
  validateEmployeeMinimumAge,
};
