import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
  subMessage?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  message = "Không tìm thấy dữ liệu",
  subMessage = "Hệ thống hiện chưa có bản ghi nào khớp với điều kiện lọc."
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 rounded-[20px] bg-white p-6 shadow-sm">
      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
        <Inbox size={24} className="text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-700 text-sm">{message}</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-xs">{subMessage}</p>
    </div>
  );
};

export default EmptyState;
