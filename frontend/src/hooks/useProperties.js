import { useEffect, useState } from "react";
import { fetchProperties } from "../api/client";
export function useProperties(requestParams, requestKey) {
  const [status, setStatus] = useState("loading"); // loading | error | ready
  const [data, setData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    fetchProperties(requestParams)
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err.message);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  return { status, data, errorMessage };
}