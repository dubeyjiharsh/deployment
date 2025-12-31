import React, { useState } from 'react';
import { navigate } from '@/lib/router';
import { API_ENDPOINTS } from '@/config/api';

const LoginPage = () => {
  const [userId, setUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!userId.trim()) {
      setError('Please enter a user ID');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(API_ENDPOINTS.canvasList(userId), {
      // const response = await fetch(`http://localhost:8030/api/canvas/list/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Login successful:', data);
        
        // Store userId in sessionStorage
        sessionStorage.setItem('userId', userId);
        
        // Navigate to dashboard
        navigate('/DashboardPage');
      } else {
        setError('Login failed. Please check your user ID.');
        console.error('Login failed');
      }
    } catch (error) {
      console.error('Error during login:', error);
      setError('An error occurred during login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-10 space-y-6 bg-white rounded-lg shadow-sm">
        <div className="text-center space-y-3">
          <h1 className="text-sm font-semibold text-gray-600 tracking-wide">
            Business Canvas AI
          </h1>
          <h2 className="text-3xl font-bold text-gray-900">
            Welcome back
          </h2>
          <p className="text-sm text-gray-500">
            Login to your Business Canvas AI account
          </p>
        </div>
        
        <div className="space-y-5 mt-8">
          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
              User ID
            </label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your user ID"
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              required
              disabled={isLoading}
            />
          </div>
          
          {error && (
            <div className="text-sm text-red-600 text-center">
              {error}
            </div>
          )}
          
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full px-4 py-3 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </div>
        
        <p className="text-center text-xs text-gray-500 mt-6">
          Contact your administrator for login credentials
        </p>
      </div>
    </div>
  );
};

export default LoginPage;