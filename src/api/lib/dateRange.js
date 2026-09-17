// Validates start_date/end_date and converts an IST calendar date range into
// the UTC instants MySQL needs. Asia/Kolkata has a fixed +05:30
// offset (no DST), so this is plain arithmetic rather than a timezone library.

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isValidCalendarDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidDateParam(value) {
  return typeof value === "string" && DATE_FORMAT.test(value) && isValidCalendarDate(value);
}

// IST midnight of the given YYYY-MM-DD date, as a UTC Date instant.
function istMidnightToUtc(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - IST_OFFSET_MS);
}

// Validates start_date/end_date and, if valid, returns the resolved range.
// Returns { error: { status, body } } on failure, otherwise { range }.
export function resolveDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    return {
      error: {
        status: 400,
        body: {
          error: "invalid_request",
          message: "Both start_date and end_date are required, in YYYY-MM-DD format.",
        },
      },
    };
  }

  if (!isValidDateParam(startDate) || !isValidDateParam(endDate)) {
    return {
      error: {
        status: 400,
        body: {
          error: "invalid_request",
          message: "start_date and end_date must be valid dates in YYYY-MM-DD format.",
        },
      },
    };
  }

  if (endDate < startDate) {
    return {
      error: {
        status: 400,
        body: {
          error: "invalid_request",
          message: "end_date must be greater than or equal to start_date.",
        },
      },
    };
  }

  const startUtc = istMidnightToUtc(startDate);
  // Exclusive upper bound: IST midnight of the day AFTER end_date.
  const endUtcExclusive = new Date(istMidnightToUtc(endDate).getTime() + ONE_DAY_MS);

  return {
    range: {
      startDate,
      endDate,
      startUtc,
      endUtcExclusive,
    },
  };
}
