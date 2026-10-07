// this is a simple component that checks if server is alive and shows the database time
// to be rendered at the bottom of page in footer

import { useEffect, useState } from "react";

export default function ApiStatus() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        const data = await res.json();
        setHealth(data);       // saving state makes React redraw
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, []);

  if (error) return <p className="subtle">Can't reach the server: {error}</p>;
  if (!health) return <p className="subtle">Checking connection…</p>;
  return <p className="subtle">Connected · database time: {health.databaseTime}</p>;
}