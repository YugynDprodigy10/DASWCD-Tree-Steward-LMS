import { useEffect, useState } from "react";
import { apiRequest } from "../api/client.js";
import { modules as demoModules } from "../data/course";

// Signed-in users get the module list from the API, which leaves out modules
// an admin has hidden from them. The demo (no account) keeps the sample list.
export function useCourseModules(user) {
  const [state, setState] = useState({ user: null, modules: null });

  useEffect(() => {
    if (!user?.getAccessTokenSilently) return undefined;
    let active = true;
    apiRequest(user, "/modules")
      .then(({ modules }) => {
        if (active) setState({ user, modules });
      })
      .catch(() => {
        // Keep the sample list if the API is unreachable.
        if (active) setState({ user, modules: null });
      });
    return () => {
      active = false;
    };
  }, [user]);

  const loaded = state.user === user ? state.modules : null;
  return loaded ?? demoModules;
}