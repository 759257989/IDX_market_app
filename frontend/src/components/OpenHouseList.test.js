import { render, screen, fireEvent } from "@testing-library/react";
import OpenHouseList from "./OpenHouseList";

// all_data arrives as a raw JSON STRING, not an object: the column is longtext
// and nothing between MySQL and the component parses it.
function allData(fields) {
  return JSON.stringify(fields);
}

const openHouse = {
  id: 4021,
  OpenHouseDate: "2026-06-21T00:00:00.000Z",
  OH_StartTime: "13:00:00",
  OH_EndTime: "16:00:00",
  all_data: null,
};

test("an empty list says so rather than rendering nothing", () => {
  render(<OpenHouseList openHouses={[]} />);

  expect(screen.getByText("No open houses scheduled")).toBeInTheDocument();
});

test("always renders the heading, empty or not", () => {
  render(<OpenHouseList openHouses={[]} />);

  expect(screen.getByRole("heading", { name: "Open Houses" })).toBeInTheDocument();
});

// KEY: OpenHouseDate comes back as a full UTC timestamp because mysql2 turns
// DATE columns into JS Date objects. Reading it with new Date() would shift a
// Pacific-timezone viewer back to the previous day -- Jun 21 would display as
// Jun 20. The date below must survive as the 21st.
test("shows the calendar day the feed meant, with no timezone shift", () => {
  render(<OpenHouseList openHouses={[openHouse]} />);

  expect(screen.getByText(/Sun, Jun 21/)).toBeInTheDocument();
});

test("renders the times as a 12-hour range", () => {
  render(<OpenHouseList openHouses={[openHouse]} />);

  expect(screen.getByText(/1:00 PM/)).toBeInTheDocument();
  expect(screen.getByText(/4:00 PM/)).toBeInTheDocument();
});

test("renders one entry per open house", () => {
  render(
    <OpenHouseList
      openHouses={[
        openHouse,
        { ...openHouse, id: 4022, OpenHouseDate: "2026-06-22T00:00:00.000Z" },
      ]}
    />,
  );

  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});

test("shows the remarks when the blob has them", () => {
  render(
    <OpenHouseList
      openHouses={[
        { ...openHouse, all_data: allData({ OpenHouseRemarks: "Side entrance." }) },
      ]}
    />,
  );

  expect(screen.getByText("Side entrance.")).toBeInTheDocument();
});

// KEY: about 3053 of the 4282 rows store OpenHouseRemarks as JSON null, so
// "the key exists" is not the same as "there is something to show".
test("a JSON null remark renders nothing, not the word null", () => {
  render(
    <OpenHouseList
      openHouses={[{ ...openHouse, all_data: allData({ OpenHouseRemarks: null }) }]}
    />,
  );

  // The entry carries its when-line and nothing else. Checking for the literal
  // string is the point: reading a JSON null straight into JSX is exactly how
  // "null" ends up printed at the user.
  const entry = screen.getByRole("listitem");
  expect(entry).toHaveTextContent("Sun, Jun 21");
  expect(entry).not.toHaveTextContent("null");
});

test("the details block is hidden when the blob has nothing worth showing", () => {
  render(<OpenHouseList openHouses={[openHouse]} />);

  expect(screen.queryByText("Open house details")).not.toBeInTheDocument();
});

test("the details block lists the fields the blob does carry", () => {
  render(
    <OpenHouseList
      openHouses={[
        {
          ...openHouse,
          all_data: allData({
            OpenHouseType: "LivestreamPublic",
            ShowingAgentFirstName: "Dana",
            ShowingAgentLastName: "Reyes",
            Refreshments: "y",
          }),
        },
      ]}
    />,
  );

  fireEvent.click(screen.getByText("Open house details"));

  // Camel case is split for readability, and the yes/no field is normalised
  // because the feed sends "Yes", "Y", "yes" and "y" interchangeably.
  expect(screen.getByText("Livestream Public")).toBeInTheDocument();
  expect(screen.getByText("Dana Reyes")).toBeInTheDocument();
  expect(screen.getByText("Yes")).toBeInTheDocument();
});

// One malformed blob must not take down the whole list.
test("survives malformed all_data and still shows the date and times", () => {
  render(<OpenHouseList openHouses={[{ ...openHouse, all_data: "{not json" }]} />);

  expect(screen.getByText(/Sun, Jun 21/)).toBeInTheDocument();
  expect(screen.queryByText("Open house details")).not.toBeInTheDocument();
});
