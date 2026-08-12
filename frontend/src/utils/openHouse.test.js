import {
  getOpenHouseRemarks,
  getOpenHouseDetails,
  formatTime,
} from "./openHouse";

const blob = (fields) => JSON.stringify(fields);

describe("getOpenHouseRemarks", () => {
  test("reads remarks out of the raw JSON string", () => {
    expect(getOpenHouseRemarks(blob({ OpenHouseRemarks: "  Open Sunday  " })))
      .toBe("Open Sunday");
  });

  // The majority of rows store this key as JSON null, not as a missing key.
  test("returns null when remarks are JSON null", () => {
    expect(getOpenHouseRemarks(blob({ OpenHouseRemarks: null }))).toBeNull();
  });

  test("survives a malformed blob", () => {
    expect(getOpenHouseRemarks("{not json")).toBeNull();
  });
});

describe("getOpenHouseDetails", () => {
  test("surfaces the populated feed fields in display order", () => {
    expect(
      getOpenHouseDetails(
        blob({
          OpenHouseType: "Public",
          ShowingAgentFirstName: "Cathy",
          ShowingAgentLastName: "Kaiser",
          OpenHouseAttendedBy: "Agent",
        })
      )
    ).toEqual([
      { label: "Type", value: "Public" },
      { label: "Showing agent", value: "Cathy Kaiser" },
      { label: "Attended by", value: "Agent" },
    ]);
  });

  test("omits fields held as JSON null rather than rendering empty rows", () => {
    expect(
      getOpenHouseDetails(
        blob({
          OpenHouseType: "Broker",
          ShowingAgentFirstName: null,
          OpenHouseAttendedBy: null,
          Refreshments: null,
        })
      )
    ).toEqual([{ label: "Type", value: "Broker" }]);
  });

  test("spaces out the camel-cased type the feed sends", () => {
    expect(getOpenHouseDetails(blob({ OpenHouseType: "LivestreamPublic" })))
      .toEqual([{ label: "Type", value: "Livestream Public" }]);
  });

  // The feed is inconsistent here: "Yes", "Y", "yes", "N" and "n" all appear.
  test.each([
    ["Yes", "Yes"],
    ["Y", "Yes"],
    ["yes", "Yes"],
    ["N", "No"],
    ["n", "No"],
  ])("normalizes Refreshments %s to %s", (raw, expected) => {
    expect(getOpenHouseDetails(blob({ Refreshments: raw })))
      .toEqual([{ label: "Refreshments", value: expected }]);
  });

  test("keeps a partial agent name when only one half is present", () => {
    expect(getOpenHouseDetails(blob({ ShowingAgentFirstName: "Kathryn" })))
      .toEqual([{ label: "Showing agent", value: "Kathryn" }]);
  });

  test("returns an empty list for a malformed blob", () => {
    expect(getOpenHouseDetails("{not json")).toEqual([]);
  });
});

describe("formatTime", () => {
  test("converts the SQL time to a 12-hour clock", () => {
    expect(formatTime("13:00:00")).toBe("1:00 PM");
    expect(formatTime("00:30:00")).toBe("12:30 AM");
  });
});
