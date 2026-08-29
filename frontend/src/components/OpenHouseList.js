import PropTypes from "prop-types";
import {
  getOpenHouseRemarks,
  getOpenHouseDetails,
  formatTime,
  formatOpenHouseDate,
} from "../utils/openHouse";
import "./OpenHouseList.css";

function OpenHouseList({ openHouses }) {
  return (
    <section className="open-houses">
      <h2>Open Houses</h2>

      {openHouses.length === 0 ? (
        // An empty list is normal, not an error: most listings have none.
        <p className="open-houses-empty">No open houses scheduled</p>
      ) : (
        <ul>
          {openHouses.map((openHouse) => {
            const remarks = getOpenHouseRemarks(openHouse.all_data);
            const details = getOpenHouseDetails(openHouse.all_data);

            return (
              <li key={openHouse.id}>
                <p className="open-house-when">
                  <strong>
                    {formatOpenHouseDate(openHouse.OpenHouseDate)}
                  </strong>
                  {" · "}
                  {formatTime(openHouse.OH_StartTime)} –{" "}
                  {formatTime(openHouse.OH_EndTime)}
                </p>

                {remarks && <p className="open-house-remarks">{remarks}</p>}

                {/* <details> gives keyboard and screen-reader support for free. */}
                {details.length > 0 && (
                  <details className="open-house-details">
                    <summary>Open house details</summary>
                    <dl>
                      {details.map(({ label, value }) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

OpenHouseList.propTypes = {
  // Required array, but it may be empty: a listing with no scheduled open
  // house is the normal case, not an error.
  openHouses: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      OpenHouseDate: PropTypes.string.isRequired,
      OH_StartTime: PropTypes.string,
      OH_EndTime: PropTypes.string,
      // A raw JSON string, parsed in the component -- not a parsed object.
      all_data: PropTypes.string,
    })
  ).isRequired,
};

export default OpenHouseList;
