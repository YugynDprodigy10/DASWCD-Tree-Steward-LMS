import { useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import App from "./App.jsx";

export default function Auth0App({ audience }) {
  const { isLoading, isAuthenticated, user, error, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();
  const getApiToken = useCallback(
    () => getAccessTokenSilently({ authorizationParams: { audience } }),
    [audience, getAccessTokenSilently],
  );
  const auth0 = {
    configured: true,
    isLoading,
    isAuthenticated,
    profile: user,
    error: error?.message,
    login: loginWithRedirect,
    logout: () => logout({ logoutParams: { returnTo: window.location.origin } }),
    getAccessTokenSilently: getApiToken,
  };
  return <App auth0={auth0} />;
}
