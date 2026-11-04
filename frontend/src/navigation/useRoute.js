import { useSyncExternalStore } from "react";
import { readRoute } from "./route.js";

function subscribe(listener) {
  window.addEventListener("popstate", listener);
  window.addEventListener("app-navigation", listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("app-navigation", listener);
  };
}

export function useRoute() {
  const search = useSyncExternalStore(subscribe, () => window.location.search);
  return readRoute(search);
}
