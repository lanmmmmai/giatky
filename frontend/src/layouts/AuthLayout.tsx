import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  const location = useLocation();
  const isLogin = location.pathname.endsWith('/login') || location.pathname === '/login';

  return (
    <div 
      className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 10% 10%, rgba(37, 99, 235, 0.04) 0%, transparent 45%), radial-gradient(circle at 90% 90%, rgba(6, 182, 212, 0.04) 0%, transparent 45%), #fafafa'
      }}
    >
      {/* Soft abstract graphic indicators */}
      <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-blue-500/5 rounded-full mix-blend-multiply filter blur-3xl opacity-60"></div>
      <div className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-indigo-500/5 rounded-full mix-blend-multiply filter blur-3xl opacity-60"></div>

      {isLogin ? (
        // Split-screen large container for Login page
        <div className="w-full max-w-[1040px] min-h-[580px] lg:min-h-[640px] bg-white rounded-[32px] shadow-[0_20px_50px_rgba(15,23,42,0.03)] border border-slate-200/60 overflow-hidden relative z-10 animate-in zoom-in-95 duration-300 flex flex-col lg:flex-row">
          <Outlet />
        </div>
      ) : (
        // Standard card wrapper for other auth pages
        <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.03)] border border-slate-200/60 overflow-hidden relative z-10 animate-in zoom-in-95 duration-300">
          <div className="p-8">
            <Outlet />
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthLayout;
