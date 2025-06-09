import Image from 'next/image';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

const Header = () => {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Check if user is logged in by checking for flow state
    const flowStateRaw = sessionStorage.getItem('laac_flow_state');
    if (flowStateRaw) {
      try {
        const flowState = JSON.parse(flowStateRaw);
        if (flowState.email) {
          setCurrentUser({ email: flowState.email });
        }
      } catch (e) {
        // Flow state invalid
      }
    }
  }, []);

  const handleLogout = () => {
    // Clear session data
    sessionStorage.removeItem('laac_flow_state');
    sessionStorage.removeItem('user_email');
    sessionStorage.removeItem('saml_relay_state');
    // Redirect to logout endpoint
    window.location.href = '/api/saml/logout';
  };

  const getPageTitle = () => {
    switch (router.pathname) {
      case '/':
        return 'Home';
      case '/login':
        return 'Sign In';
      case '/laac':
        return 'Location Verification';
      case '/admin/users':
        return 'User Management';
      case '/callback':
        return 'Authentication';
      default:
        return 'LAAC';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="container-professional">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Image
                  src="/Genesys_logo.jpg"
                  alt="Genesys Logo"
                  width={120}
                  height={40}
                  priority
                  className="h-8 w-auto"
                />
              </div>
              <div className="hidden sm:block h-6 w-px bg-gray-300"></div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <h1 className="text-lg font-semibold text-gray-900">LAAC</h1>
              </div>
            </div>
          </div>

          {/* Navigation and User Info */}
          <div className="flex items-center space-x-4">
            {/* Page Title */}
            <div className="hidden md:flex items-center space-x-2">
              <span className="text-sm text-gray-500">Current:</span>
              <span className="text-sm font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                {getPageTitle()}
              </span>
            </div>

            {/* User Info */}
            {currentUser && (
              <div className="hidden sm:flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="font-medium">{currentUser.email}</span>
                </div>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* Desktop Logout Button */}
            {currentUser && (
              <button
                onClick={handleLogout}
                className="hidden md:inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 hover:border-red-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-4 space-y-3">
              <div className="text-sm font-medium text-gray-900 mb-2">Navigation</div>
              <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                Current Page: {getPageTitle()}
              </div>
              
              {currentUser && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-sm font-medium text-gray-900 mb-2">Account</div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600 mb-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>{currentUser.email}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 hover:border-red-300 transition-all duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Subtle gradient line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30"></div>
    </header>
  );
};

export default Header; 
