// The API sends all_data as a raw JSON STRING (the column is longtext, so
// nothing along the way parses it). Reading .OpenHouseRemarks off that string
// silently yields undefined -- it must be parsed first.
function parseAllData(rawAllData) {
  if (!rawAllData) return null;

  let parsed;
  try {
    parsed = JSON.parse(rawAllData);
  } catch {
    return null; // malformed blob: skip these fields, keep the rest of the card
  }

  return parsed && typeof parsed === "object" ? parsed : null;
}

// KEY: most fields in the blob are JSON null rather than absent, so every read
// needs a type check -- not just a truthiness check on the key existing.
function readString(parsed, key) {
  const value = parsed[key];
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

export function getOpenHouseRemarks(rawAllData) {
  const parsed = parseAllData(rawAllData);
  if (!parsed) return null;

  // About 3053 of the 4282 rows store OpenHouseRemarks as JSON null.
  return readString(parsed, "OpenHouseRemarks");
}

// "LivestreamPublic" -> "Livestream Public"
function splitCamelCase(value) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

// Refreshments arrives unnormalized across rows: "Yes", "Y", "yes", "N", "n".
function normalizeYesNo(value) {
  if (/^y(es)?$/i.test(value)) return "Yes";
  if (/^n(o)?$/i.test(value)) return "No";
  return value;
}

// The blob carries ~47 feed fields, but most are plumbing (system keys,
// timestamps, permissions). These are the ones that are both populated often
// enough to be worth surfacing and meaningful to someone reading a listing.
// Fill rates across the 4282 rows: type 100%, showing agent 69%, attended by
// 48%, refreshments 6%. Anything absent is simply omitted rather than shown
// as an empty row.
export function getOpenHouseDetails(rawAllData) {
  const parsed = parseAllData(rawAllData);
  if (!parsed) return [];

  const details = [];

  const type = readString(parsed, "OpenHouseType");
  if (type) details.push({ label: "Type", value: splitCamelCase(type) });

  const first = readString(parsed, "ShowingAgentFirstName");
  const last = readString(parsed, "ShowingAgentLastName");
  const agent = [first, last].filter(Boolean).join(" ");
  if (agent) details.push({ label: "Showing agent", value: agent });

  const attendedBy = readString(parsed, "OpenHouseAttendedBy");
  if (attendedBy) details.push({ label: "Attended by", value: attendedBy });

  const refreshments = readString(parsed, "Refreshments");
  if (refreshments) {
    details.push({ label: "Refreshments", value: normalizeYesNo(refreshments) });
  }

  const livestream = readString(parsed, "LivestreamOpenHouseURL");
  if (livestream) details.push({ label: "Livestream", value: livestream });

  return details;
}

// OH_StartTime arrives as a MySQL TIME string like "13:00:00".
export function formatTime(sqlTime) {
  if (typeof sqlTime !== "string") return "";

  const [hours, minutes] = sqlTime.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "";

  const suffix = hours >= 12 ? "PM" : "AM";
  // 0 and 12 both display as 12 (12:00 AM and 12:00 PM).
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

// KEY: OpenHouseDate arrives as a full ISO timestamp such as
// "2026-06-21T00:00:00.000Z" because mysql2 turns DATE columns into JS Date
// objects. Passing that straight to new Date() re-interprets the instant in
// the viewer's timezone and can land on the PREVIOUS DAY. The calendar day we
// want is literally the first 10 characters, so read those and rebuild the
// date from explicit parts -- no UTC round-trip, no shifting.
export function formatOpenHouseDate(isoDate) {
  if (typeof isoDate !== "string" || isoDate.length < 10) return "";

  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
