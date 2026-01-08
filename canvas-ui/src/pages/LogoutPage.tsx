import React, { useEffect } from 'react';
import { doLogin, isAuthenticated } from "@/src/lib/auth";

const LogoutPage: React.FC = () => {
  console.log("LogoutPage rendered");

  useEffect(() => {
    // Clear any remaining session data when logout page loads
    const authenticated = isAuthenticated();
    console.log("LogoutPage - checking auth status:", authenticated);
    
    if (authenticated) {
      // If somehow still authenticated, clear everything
      console.log("Still authenticated on logout page, clearing session...");
      sessionStorage.clear();
      localStorage.clear();
    }
  }, []);

  const handleReturnToDashboard = () => {
    console.log("Return to Dashboard clicked");
    
    // Clear all session data
    sessionStorage.clear();
    localStorage.clear();
    
    // Navigate to root and trigger login
    window.history.replaceState(null, '', '/');
    
    // Trigger Keycloak login which will redirect to dashboard after successful auth
    doLogin();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <h1 className="text-2xl font-bold">You have been logged out</h1>
      <p className="text-muted-foreground">Your session has ended successfully.</p>
      <button 
        onClick={handleReturnToDashboard} 
        className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
      >
        Return to Dashboard
      </button>
    </div>
  );
};

export default LogoutPage;