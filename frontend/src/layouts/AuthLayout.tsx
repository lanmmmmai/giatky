import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  const location = useLocation();
  const isLogin = location.pathname.endsWith('/login') || location.pathname === '/login';

  return (
    <div 
      className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 12% 12%, rgba(108, 99, 255, 0.12) 0%, transparent 34%), radial-gradient(circle at 88% 84%, rgba(155, 140, 255, 0.12) 0%, transparent 38%), #F7F8FC'
      }}
    >
      {/* Soft abstract graphic indicators */}
      <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/5 rounded-full mix-blend-multiply filter blur-3xl opacity-60"></div>
      <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-secondary/10 rounded-full mix-blend-multiply filter blur-3xl opacity-60"></div>

      {isLogin ? (
        // Split-screen large container for Login page
        <div className="w-full max-w-[1040px] min-h-[580px] lg:min-h-[640px] bg-white rounded-[32px] shadow-card border border-white overflow-hidden relative z-10 animate-in zoom-in-95 duration-300 flex flex-col lg:flex-row">
          <Outlet />
        </div>
      ) : (
        // Standard card wrapper for other auth pages
        <div className="w-full max-w-md bg-white rounded-[24px] shadow-card border border-white overflow-hidden relative z-10 animate-in zoom-in-95 duration-300">
          <div className="p-8">
            <Outlet />
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthLayout;
