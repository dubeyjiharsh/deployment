import Keycloak from "keycloak-js";

// Runtime config type definition
declare global {
  interface Window {
    APP_CONFIG: {
      KEYCLOAK_URL: string;
      KEYCLOAK_REALM: string;
      KEYCLOAK_CLIENT_ID: string;
      API_BASE_URL: string;
      BASE_PATH: string;
    };
  }
}

// Get config from runtime (injected by entrypoint.sh)
// Fallback to import.meta.env for local development
const getConfig = () => {
  if (typeof window !== 'undefined' && window.APP_CONFIG) {
    return window.APP_CONFIG;
  }
  // Fallback for local development
  return {
    KEYCLOAK_URL: import.meta.env.VITE_KEYCLOAK_URL ,
    KEYCLOAK_REALM: import.meta.env.VITE_KEYCLOAK_REALM ,
    KEYCLOAK_CLIENT_ID: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL ,
    BASE_PATH: import.meta.env.VITE_BASE_PATH ,
  };
};

const config = getConfig();

const keycloak = new Keycloak({
  url: config.KEYCLOAK_URL,
  realm: config.KEYCLOAK_REALM,
  clientId: config.KEYCLOAK_CLIENT_ID,
});

// Ensure authServerUrl is set correctly
if (!keycloak.authServerUrl) {
  keycloak.authServerUrl = config.KEYCLOAK_URL;
}

// Backend API base URL
const API_BASE_URL = config.API_BASE_URL;

// Check if user is authenticated via AI Force
const isAIForceAuthenticated = () => {
  const userInfo = localStorage.getItem("user-info");
  const isLogin = localStorage.getItem("isLogin");
  const isUserAuthorized = localStorage.getItem("isUserAuthorized");
  
  if (userInfo && isLogin === "true" && isUserAuthorized === "true") {
    try {
      const parsedUserInfo = JSON.parse(userInfo);
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

// Validate user with backend and get user details
const validateUserWithBackend = async (username: string, authToken: string) => {
  try {
    const encodedUsername = encodeURIComponent(username);
    const response = await fetch(
      `${API_BASE_URL}/api/user/validate?user_id=${encodedUsername}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`User validation failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status === "success" && data.details) {
      return data.details;
    } else {
      throw new Error(data.message || "User validation failed");
    }
  } catch (error) {
    console.error("Error validating user with backend:", error);
    throw error;
  }
};

// Determine redirect URL based on user role
const getRedirectUrlByRole = (roleTypeName: string): string => {
  if (roleTypeName === "Project Admin") {
    return "#/admin-configure";
  }
  return "#/";
};

// Helper function to clean OAuth parameters from URL
const cleanOAuthParams = () => {
  const hash = window.location.hash;
  if (hash.includes('state=') || hash.includes('session_state=') || hash.includes('code=') || hash.includes('iss=')) {
    console.log("Cleaning OAuth params from URL");
    const cleanHash = hash.split('&')[0].split('?')[0];
    const targetHash = cleanHash || '#/';
    window.history.replaceState(null, '', window.location.origin + window.location.pathname + targetHash);
    return true;
  }
  return false;
};

export const initKeycloak = async (onAuthenticatedCallback: () => void) => {
  // First, check if user is already authenticated via AI Force
  if (isAIForceAuthenticated()) {
    console.log("User already authenticated via AI Force - validating with backend");
    
    try {
      const userInfo = localStorage.getItem("user-info");
      if (userInfo) {
        const parsedUserInfo = JSON.parse(userInfo);
        const username = parsedUserInfo.user_name || parsedUserInfo.user_id;
        const authToken = parsedUserInfo.auth_token;

        if (username && authToken) {
          // Validate the AI Force user with backend
          console.log("Validating AI Force user with backend:", username);
          const userDetails = await validateUserWithBackend(username, authToken);
          console.log("AI Force user validation successful:", userDetails);

          // Update user info with fresh data from backend
          const updatedUserInfo = JSON.stringify({
            user_id: userDetails.user_id,
            user_name: userDetails.user_name,
            role: userDetails.role_type_name,
            role_id: userDetails.role_id,
            project_id: userDetails.project_id,
            org_id: 1,
            auth_token: authToken,
            is_super_admin: userDetails.role_type_name === "Super Admin",
            is_project_admin: userDetails.role_type_name === "Project Admin",
            email_id: userDetails.email_id,
            user_type: "platform_user",
            role_type_id: userDetails.role_id,
            role_type: userDetails.role_type_name,
            first_name: userDetails.first_name,
            last_name: userDetails.last_name,
            is_active: userDetails.is_active,
            last_active: userDetails.last_active,
          });
          localStorage.setItem("user-info", updatedUserInfo);

          setupSessionFromLocalStorage();
          cleanOAuthParams();
          onAuthenticatedCallback();
          return;
        }
      }
      
      // If we get here, user info is missing or incomplete
      throw new Error("Invalid AI Force authentication data");
      
    } catch (error) {
      console.error("AI Force user validation failed:", error);
      
      // Clear all authentication state
      sessionStorage.clear();
      localStorage.clear();
      
      // Show error and redirect to login
      alert("Session validation failed. Please log in again.");
      cleanOAuthParams();
      window.location.hash = '#/login';
      
      // Don't call the callback since validation failed
      return;
    }
  }

  // If not AI Force authenticated, proceed with Keycloak flow
  console.log("No AI Force authentication found - initializing Keycloak");
  
  const urlParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  
  const hasLogoutParam = urlParams.get('fromLogout') === 'true';
  const hasMalformedHash = hash.includes('%2Flogin=') || 
                          hash.includes('/login=') || 
                          hash === '#%2Flogin=' ||
                          hash.includes('%2Flogout') ||
                          hash === '#/logout';
  
  const isPostLogout = hasLogoutParam || hasMalformedHash || hash === '#/logout';
  
  if (hasLogoutParam) {
    urlParams.delete('fromLogout');
    const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + '#/logout';
    window.history.replaceState(null, '', newUrl);
  }
  
  if (hasMalformedHash && hash !== '#/logout') {
    console.log("Detected malformed logout hash, cleaning up...");
    window.history.replaceState(null, '', window.location.origin + '/#/logout');
  }
  
  console.log("Initializing Keycloak, isPostLogout:", isPostLogout);
  
  keycloak
    .init({
      onLoad: "check-sso",
      pkceMethod: "S256",
      checkLoginIframe: false,
      responseMode: 'fragment',
    })
    .then(async (authenticated) => {
      console.log("Keycloak initialized. Authenticated:", authenticated);
      console.log("Token exists:", !!keycloak.token);
      
      if (authenticated && keycloak.token) {
        const username = keycloak.tokenParsed?.preferred_username || "";
        
        sessionStorage.setItem("userId", username);
        sessionStorage.setItem("isAuthenticated", JSON.stringify(true));
        console.log("User authenticated via Keycloak, userId set:", username);

        try {
          // Validate user with backend
          console.log("Validating user with backend:", username);
          const userDetails = await validateUserWithBackend(username, keycloak.token);
          
          console.log("User validation successful:", userDetails);

          // Store required data in local storage
          localStorage.setItem("fromLoginBtn", JSON.stringify(true));
          localStorage.setItem("isLogin", JSON.stringify(true));
          localStorage.setItem("isUserAuthorized", JSON.stringify(true));
          
          if (keycloak.refreshToken) {
            localStorage.setItem("refreshToken", keycloak.refreshToken);
          } else {
            console.warn("Refresh token is undefined");
          }
          
          // Store user info in localStorage
          const userInfo = JSON.stringify({
            user_id: userDetails.user_id,
            user_name: userDetails.user_name,
            role: userDetails.role_type_name,
            role_id: userDetails.role_id,
            project_id: userDetails.project_id,
            org_id: 1,
            auth_token: keycloak.token,
            is_super_admin: userDetails.role_type_name === "Super Admin",
            is_project_admin: userDetails.role_type_name === "Project Admin",
            email_id: userDetails.email_id,
            user_type: "keycloak_user",
            role_type_id: userDetails.role_id,
            role_type: userDetails.role_type_name,
            first_name: userDetails.first_name,
            last_name: userDetails.last_name,
            is_active: userDetails.is_active,
            last_active: userDetails.last_active,
          });
          localStorage.setItem("user-info", userInfo);
          localStorage.setItem("keycloak", JSON.stringify(true));

          console.log("User info stored in localStorage:");

          
          // console.log("User info stored in localStorage:", userInfo);

          // Clean up OAuth params from URL
          cleanOAuthParams();

          // Determine redirect based on role
          const redirectUrl = getRedirectUrlByRole(userDetails.role_type_name);
          console.log("Redirecting to:", redirectUrl);
          window.location.hash = redirectUrl;

          onAuthenticatedCallback();

        } catch (error) {
          console.error("Backend validation failed:", error);
          
          // Logout from Keycloak to clear the session
          if (keycloak.token) {
            try {
              await keycloak.logout({
                redirectUri: `${window.location.origin}${config.BASE_PATH}`
              });
            } catch (logoutError) {
              console.error("Keycloak logout failed:", logoutError);
            }
          }
          
          // Clear authentication state on validation failure
          sessionStorage.clear();
          localStorage.clear();
          
          // Show error message to user
          alert("User validation failed. You are not authorized to access this application. Please contact your administrator.");
          
          // Clean OAuth params and redirect to login page
          cleanOAuthParams();
          window.location.hash = '#/login';
          
          // Don't call the callback since authentication failed
          return;
        }
        
      } else {
        sessionStorage.removeItem("userId");
        sessionStorage.removeItem("isAuthenticated");
        console.log("User not authenticated via Keycloak, userId cleared");
        
        cleanOAuthParams();
        
        if (isPostLogout) {
          window.location.hash = '#/logout';
        }
        
        onAuthenticatedCallback();
      }
    })
    .catch((error) => {
      console.error("Keycloak init failed:", error);
      sessionStorage.clear();
      cleanOAuthParams();
    });
};

export const doLogin = () => {
  console.log("Redirecting to Keycloak login...");
  keycloak.login({
    redirectUri: `${window.location.origin}${config.BASE_PATH}`
  });
};

export const doLogout = () => {
  console.log("Starting logout process...");
  
  const isKeycloakAuth = localStorage.getItem("keycloak") === "true";
  
  sessionStorage.clear();
  localStorage.clear();
  
  if (isKeycloakAuth && keycloak.token) {
    const logoutRedirectUri = `${window.location.origin}${config.BASE_PATH}`;
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

    // Directly redirect to Keycloak logout without showing #/logout
    window.location.href = fullLogoutUrl;
  } else {
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
  return keycloak.token;
};

export const isAuthenticated = () => {
  if (isAIForceAuthenticated()) {
    console.log("Auth check - AI Force authenticated");
    return true;
  }
  
  const hasToken = !!keycloak.token;
  const hasUserId = !!sessionStorage.getItem("userId");
  const isAuthFlag = sessionStorage.getItem("isAuthenticated") === "true";
  console.log("Auth check - Keycloak - hasToken:", hasToken, "hasUserId:", hasUserId, "isAuthFlag:", isAuthFlag);
  return hasToken && hasUserId && isAuthFlag;
};

export const updateToken = (minValidity = 5) => {
  if (localStorage.getItem("keycloak") === "true") {
    return keycloak.updateToken(minValidity);
  }
  return Promise.resolve(true);
};

// Helper function to get user info from localStorage
export const getUserInfo = () => {
  const userInfo = localStorage.getItem("user-info");
  if (userInfo) {
    try {
      return JSON.parse(userInfo);
    } catch (e) {
      console.error("Failed to parse user-info:", e);
      return null;
    }
  }
  return null;
};

// Helper function to check if user is Project Admin
export const isProjectAdmin = () => {
  const userInfo = getUserInfo();
  return userInfo?.is_project_admin === true || userInfo?.role_type === "Project Admin";
};

// Helper function to check if user is Super Admin
export const isSuperAdmin = () => {
  const userInfo = getUserInfo();
  return userInfo?.is_super_admin === true || userInfo?.role_type === "Super Admin";
};

// Verify user on page load - validate with backend
export const verifyUserOnPageLoad = async () => {
  const userInfo = localStorage.getItem("user-info");

  try {
    if (userInfo) {
      const parsedUserInfo = JSON.parse(userInfo);
      const username = parsedUserInfo.user_name || parsedUserInfo.user_id;
      const authToken = parsedUserInfo.auth_token;

      if (username && authToken) {
        console.log("Validating user from backend on page load...");
        try {
          const userDetails = await validateUserWithBackend(username, authToken);
          console.log("User validated successfully from backend:", userDetails);
          
          // Update user info with fresh data from backend
          const updatedUserInfo = JSON.stringify({
            user_id: userDetails.user_id,
            user_name: userDetails.user_name,
            role: userDetails.role_type_name,
            role_id: userDetails.role_id,
            project_id: userDetails.project_id,
            org_id: 1,
            auth_token: authToken,
            is_super_admin: userDetails.role_type_name === "Super Admin",
            is_project_admin: userDetails.role_type_name === "Project Admin",
            email_id: userDetails.email_id,
            user_type: "platform_user",
            role_type_id: userDetails.role_id,
            role_type: userDetails.role_type_name,
            first_name: userDetails.first_name,
            last_name: userDetails.last_name,
            is_active: userDetails.is_active,
            last_active: userDetails.last_active,
          });
          localStorage.setItem("user-info", updatedUserInfo);
          
        } catch (error) {
          console.error("User validation failed from backend:", error);
          // Clear session and redirect to Keycloak login on validation failure
          sessionStorage.clear();
          localStorage.clear();
          console.log("Redirecting to Keycloak login...");
          keycloak.login({
            redirectUri: `${window.location.origin}${config.BASE_PATH}`
          });
        }
      } else {
        console.warn("Username or auth token missing in user info.");
        console.log("Redirecting to Keycloak login...");
        keycloak.login({
          redirectUri: `${window.location.origin}${config.BASE_PATH}`
        });
      }
    } else {
      console.warn("No user info found in localStorage.");
      console.log("Redirecting to Keycloak login...");
      keycloak.login({
        redirectUri: `${window.location.origin}${config.BASE_PATH}`
      });
    }
  } catch (e) {
    console.error("Unexpected error during user validation:", e);
    console.log("Redirecting to Keycloak login...");
    keycloak.login({
      redirectUri: `${window.location.origin}${config.BASE_PATH}`
    });
  }
};

export default keycloak;