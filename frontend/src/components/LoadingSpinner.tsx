import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      <p className="mt-4 text-sm text-slate-500 font-medium animate-pulse">Đang tải dữ liệu...</p>
    </div>
  );
};

export default LoadingSpinner;
