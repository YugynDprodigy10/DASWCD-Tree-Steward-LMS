import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import './index.css'
import App from './App.jsx'
import Auth0App from './Auth0App.jsx'

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE
const auth0Configured = Boolean(auth0Domain && auth0ClientId && auth0Audience)
const testLoginEnabled = import.meta.env.VITE_ENABLE_TEST_LOGIN === 'true'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {auth0Configured ? (
      <Auth0Provider
        domain={auth0Domain}
        clientId={auth0ClientId}
        cacheLocation="localstorage"
        useRefreshTokens
        authorizationParams={{
          redirect_uri: window.location.origin,
          audience: auth0Audience,
        }}
      >
        <Auth0App audience={auth0Audience} testLoginEnabled={testLoginEnabled} />
      </Auth0Provider>
    ) : (
      <App testLoginEnabled={testLoginEnabled} />
    )}
  </StrictMode>,
)
