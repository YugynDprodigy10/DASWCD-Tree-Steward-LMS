import { useEffect, useState } from "react";
import { apiRequest } from "../api/client.js";

export function useAnnouncements(user, moduleId, enabled) {
  const owner = user?.id ?? "demo";
  const key = `${owner}:${moduleId}`;
  const [state, setState] = useState({
    key: null,
    items: [],
    error: "",
  });

  useEffect(() => {
    if (!enabled || !user) return undefined;
    let active = true;
    let requestNumber = 0;
    async function reload() {
      const request = ++requestNumber;
      try {
        const { announcements } = await apiRequest(
          user,
          `/modules/${moduleId}/announcements`,
        );
        if (active && request === requestNumber) {
          setState({ key, items: announcements, error: "" });
        }
      } catch (error) {
        if (active && request === requestNumber) {
          setState({ key, items: [], error: error.message });
        }
      }
    }
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    reload();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user, moduleId, enabled, key]);

  async function save(values) {
    if (!user) throw new Error("Sign in to save announcements.");
    const path = values.id
      ? `/announcements/${encodeURIComponent(values.id)}`
      : `/modules/${moduleId}/announcements`;
    const { announcement } = await apiRequest(
      user,
      path,
      values.id ? "PATCH" : "POST",
      values,
    );
    setState((previous) => ({
      ...previous,
      key,
      error: "",
      items: values.id
        ? previous.items.map((item) =>
            item.id === announcement.id ? announcement : item,
          )
        : [...previous.items, announcement],
    }));
    return announcement;
  }

  return {
    items: enabled && user && state.key === key ? state.items : [],
    error: enabled && user && state.key === key ? state.error : "",
    save,
  };
}
