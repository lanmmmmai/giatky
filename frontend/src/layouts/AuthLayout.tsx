import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EFF6FF] via-[#F8FAFC] to-[#DBEAFE] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Decorative background shapes - kept very soft to avoid glare */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>

      {isLogin ? (
        // Split-screen large container for Login page
        <div className="w-full max-w-[1100px] min-h-[600px] lg:min-h-[680px] bg-white rounded-[32px] shadow-2xl border border-slate-200/50 overflow-hidden relative z-10 animate-in zoom-in-95 duration-300 flex flex-col lg:flex-row">
          <Outlet />
        </div>
      ) : (
        // Standard card wrapper for other auth pages
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative z-10 animate-in zoom-in-95 duration-300">
          <div className="p-8">
            <Outlet />
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthLayout;
