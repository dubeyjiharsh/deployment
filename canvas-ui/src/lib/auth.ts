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

// Check if user is authenticated via AI Force
const isAIForceAuthenticated = () => {
  const userInfo = localStorage.getItem("user-info");
  const isLogin = localStorage.getItem("isLogin");
  const isUserAuthorized = localStorage.getItem("isUserAuthorized");
  
  if (userInfo && isLogin === "true" && isUserAuthorized === "true") {
    try {
      const parsedUserInfo = JSON.parse(userInfo);
      // Check if user has auth_token and user_id
      return !!(parsedUserInfo.auth_token && parsedUserInfo.user_id);
    } catch (e) {
      console.error("Failed to parse user-info from localStorage:", e);
      return false;
    }
  }
  return false;
};

// Setup session storage from localStorage (for AI Force authenticated users)
const setupSessionFromLocalStorage = () => {
  const userInfo = localStorage.getItem("user-info");
  if (userInfo) {
    try {
      const parsedUserInfo = JSON.parse(userInfo);
      sessionStorage.setItem("userId", parsedUserInfo.user_name || parsedUserInfo.user_id || "");
      sessionStorage.setItem("isAuthenticated", "true");
      console.log("Session setup from localStorage (AI Force auth):", parsedUserInfo.user_name);
    } catch (e) {
      console.error("Failed to setup session from localStorage:", e);
    }
  }
};

export const initKeycloak = (onAuthenticatedCallback: () => void) => {
  // First, check if user is already authenticated via AI Force
  if (isAIForceAuthenticated()) {
    console.log("User already authenticated via AI Force - skipping Keycloak initialization");
    setupSessionFromLocalStorage();
    onAuthenticatedCallback();
    return;
  }

  // If not AI Force authenticated, proceed with Keycloak flow
  console.log("No AI Force authentication found - initializing Keycloak");
  
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
        sessionStorage.setItem("isAuthenticated", JSON.stringify(true));
        console.log("User authenticated via Keycloak, userId set:", keycloak.tokenParsed?.preferred_username);

        // Store required data in local storage
        localStorage.setItem("fromLoginBtn", JSON.stringify(true));
        localStorage.setItem("isLogin", JSON.stringify(true));
        localStorage.setItem("isUserAuthorized", JSON.stringify(true));
        
        if (keycloak.refreshToken) {
          localStorage.setItem("refreshToken", keycloak.refreshToken);
        } else {
          console.warn("Refresh token is undefined");
        }
        
        localStorage.setItem("keycloak", JSON.stringify(true));

        const bottomMenuItems = JSON.stringify([
          {
            id: 10,
            menu_name: "Logout",
            description: "User profile related page",
            title: "Logout",
            icon_path: "bi bi-person-circle",
            project_id: null,
            display_order: 10,
            display_type_id: 1,
            route_type: 0,
            url: "/profile",
            parent_menu_id: null,
            permission_type: 2,
          },
        ]);
        localStorage.setItem("bottomMenuItems", bottomMenuItems);

        const userInfo = JSON.stringify({
          user_id: keycloak.tokenParsed?.sub,
          user_name: keycloak.tokenParsed?.preferred_username,
          role: "Super Admin",
          role_id: 1,
          project_id: 1,
          org_id: 1,
          auth_token: keycloak.token,
          is_super_admin: true,
          email_id: keycloak.tokenParsed?.email,
          user_type: "platform_user",
          role_type_id: 1,
          role_type: "Super Admin",
          first_name: "Super",
          last_name: "Admin",
        });
        localStorage.setItem("user-info", userInfo);
      } else {
        sessionStorage.removeItem("userId");
        sessionStorage.removeItem("isAuthenticated");
        console.log("User not authenticated via Keycloak, userId cleared");
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
    redirectUri: `${window.location.origin}/canvas`
  });
};

export const doLogout = () => {
  console.log("Starting logout process...");
  
  // Check if user was authenticated via Keycloak or AI Force
  const isKeycloakAuth = localStorage.getItem("keycloak") === "true";
  
  // Clear all local data first
  sessionStorage.clear();
  localStorage.clear();
  
  if (isKeycloakAuth && keycloak.token) {
    // Keycloak logout flow
    const logoutRedirectUri = `${window.location.origin}/`;
    const logoutUrl = `${keycloak.authServerUrl}/realms/${keycloak.realm}/protocol/openid-connect/logout`;
    
    const params = new URLSearchParams({
      post_logout_redirect_uri: logoutRedirectUri,
      client_id: keycloak.clientId || 'canvas-client'
    });
    
    if (keycloak.idToken) {
      params.append('id_token_hint', keycloak.idToken);
    }
    
    const fullLogoutUrl = `${logoutUrl}?${params.toString()}`;
    console.log("Redirecting to Keycloak logout:", fullLogoutUrl);
    
    window.location.hash = '#/logout';
    
    setTimeout(() => {
      window.location.href = fullLogoutUrl;
    }, 100);
  } else {
    // AI Force logout - just redirect to logout page
    console.log("AI Force logout - redirecting to logout page");
    window.location.hash = '#/logout';
    window.location.reload();
  }
};

export const logout = () => {
  console.log('User clicked logout - starting full logout process');
  doLogout();
};

export const getToken = () => {
  // First check if AI Force authenticated
  if (isAIForceAuthenticated()) {
    const userInfo = localStorage.getItem("user-info");
    if (userInfo) {
      try {
        const parsedUserInfo = JSON.parse(userInfo);
        return parsedUserInfo.auth_token;
      } catch (e) {
        console.error("Failed to get AI Force token:", e);
      }
    }
  }
  // Otherwise return Keycloak token
  return keycloak.token;
};

export const isAuthenticated = () => {
  // First check AI Force authentication
  if (isAIForceAuthenticated()) {
    console.log("Auth check - AI Force authenticated");
    return true;
  }
  
  // Otherwise check Keycloak authentication
  const hasToken = !!keycloak.token;
  const hasUserId = !!sessionStorage.getItem("userId");
  const isAuthFlag = sessionStorage.getItem("isAuthenticated") === "true";
  console.log("Auth check - Keycloak - hasToken:", hasToken, "hasUserId:", hasUserId, "isAuthFlag:", isAuthFlag);
  return hasToken && hasUserId && isAuthFlag;
};

export const updateToken = (minValidity = 5) => {
  // Only update token if using Keycloak
  if (localStorage.getItem("keycloak") === "true") {
    return keycloak.updateToken(minValidity);
  }
  // For AI Force, return a resolved promise (no token refresh needed)
  return Promise.resolve(true);
};

export default keycloak;