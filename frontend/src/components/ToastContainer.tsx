import React from 'react';
import { useToastStore } from '../stores/toastStore';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const icon = {
          success: <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={20} />,
          error: <XCircle className="text-rose-500 flex-shrink-0" size={20} />,
          warning: <AlertTriangle className="text-amber-500 flex-shrink-0" size={20} />,
          info: <Info className="text-primary flex-shrink-0" size={20} />,
        }[toast.type];

        const bgClass = {
          success: 'bg-emerald-50 border-emerald-200 text-emerald-950',
          error: 'bg-rose-50 border-rose-200 text-rose-950',
          warning: 'bg-amber-50 border-amber-200 text-amber-950',
          info: 'bg-primary/10 border-primary/20 text-blue-950',
        }[toast.type];

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg pointer-events-auto animate-in slide-in-from-bottom-5 duration-200 ${bgClass}`}
          >
            {icon}
            <div className="flex-1 text-sm font-medium leading-5">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 flex-shrink-0 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
