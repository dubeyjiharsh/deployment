import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL, 
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});

// Ensure authServerUrl is set correctly
if (!keycloak.authServerUrl) {
  keycloak.authServerUrl = import.meta.env.VITE_KEYCLOAK_URL;
}

export const initKeycloak = (onAuthenticatedCallback: () => void) => {
  // Check if we're returning from a logout
  const urlParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  
  // Check for logout indicators
  const hasLogoutParam = urlParams.get('fromLogout') === 'true';
  const hasMalformedHash = hash.includes('%2Flogin=') || 
                          hash.includes('/login=') || 
                          hash === '#%2Flogin=' ||
                          hash.includes('%2Flogout') ||
                          hash === '#/logout';
  
  const isPostLogout = hasLogoutParam || hasMalformedHash || hash === '#/logout';
  
  // Clean up the URL before initialization
  if (hasLogoutParam) {
    urlParams.delete('fromLogout');
    const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + '#/logout';
    window.history.replaceState(null, '', newUrl);
  }
  
  if (hasMalformedHash && hash !== '#/logout') {
    console.log("Detected malformed logout hash, cleaning up...");
    window.history.replaceState(null, '', window.location.origin + '/#/logout');
  }
  
  console.log("Initializing Keycloak, isPostLogout:", isPostLogout, "reason:", hasLogoutParam ? "param" : hasMalformedHash ? "malformed hash" : "none");
  
  keycloak
    .init({
      onLoad: "check-sso",
      pkceMethod: "S256",
      checkLoginIframe: false,
      responseMode: 'fragment',
    })
    .then((authenticated) => {
      console.log("Keycloak initialized. Authenticated:", authenticated);
      console.log("Token exists:", !!keycloak.token);
      
      if (authenticated && keycloak.token) {
        sessionStorage.setItem("userId", keycloak.tokenParsed?.preferred_username || "");
        sessionStorage.setItem("isAuthenticated", "true");
        console.log("User authenticated, userId set:", keycloak.tokenParsed?.preferred_username);
      } else {
        sessionStorage.removeItem("userId");
        sessionStorage.removeItem("isAuthenticated");
        console.log("User not authenticated, userId cleared");
      }
      
      // Clean up OAuth params from URL
      if (window.location.hash.includes('state=') || window.location.hash.includes('session_state=')) {
        console.log("Cleaning up OAuth params from URL");
        const targetHash = isPostLogout ? '#/logout' : '#/';
        window.history.replaceState(null, '', window.location.origin + '/' + targetHash);
      }
      
      onAuthenticatedCallback();
    })
    .catch((error) => {
      console.error("Keycloak init failed:", error);
      sessionStorage.clear();
    });
};

export const doLogin = () => {
  console.log("Redirecting to Keycloak login...");
  keycloak.login({
    redirectUri: `${window.location.origin}/`
  });
};

export const doLogout = () => {
  console.log("Starting logout process...");
  
  // Clear all local data first
  sessionStorage.clear();
  localStorage.clear();
  
  // Build the logout URL - Keycloak will redirect to base URL without hash
  // Our app will then handle the #/logout routing client-side
  const logoutRedirectUri = `${window.location.origin}/`;
  const logoutUrl = `${keycloak.authServerUrl}/realms/${keycloak.realm}/protocol/openid-connect/logout`;
  
  const params = new URLSearchParams({
    post_logout_redirect_uri: logoutRedirectUri,
    client_id: keycloak.clientId || 'canvas-client'
  });
  
  // Add ID token if available for a cleaner logout
  if (keycloak.idToken) {
    params.append('id_token_hint', keycloak.idToken);
  }
  
  const fullLogoutUrl = `${logoutUrl}?${params.toString()}`;
  console.log("Redirecting to Keycloak logout:", fullLogoutUrl);
  
  // Set the hash before redirecting so when we return, we go to logout page
  window.location.hash = '#/logout';
  
  // Small delay to ensure hash is set
  setTimeout(() => {
    window.location.href = fullLogoutUrl;
  }, 100);
};

// Main logout function to be called from UI
export const logout = () => {
  console.log('User clicked logout - starting full logout process');
  doLogout();
};

export const getToken = () => keycloak.token;

export const isAuthenticated = () => {
  const hasToken = !!keycloak.token;
  const hasUserId = !!sessionStorage.getItem("userId");
  const isAuthFlag = sessionStorage.getItem("isAuthenticated") === "true";
  console.log("Auth check - hasToken:", hasToken, "hasUserId:", hasUserId, "isAuthFlag:", isAuthFlag);
  return hasToken && hasUserId && isAuthFlag;
};

export const updateToken = (minValidity = 5) => {
  return keycloak.updateToken(minValidity);
};

export default keycloak;