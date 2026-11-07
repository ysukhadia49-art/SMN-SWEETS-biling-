import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => {
        let borderClass = 'border-emerald-500 bg-white text-emerald-900';
        let icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />;

        if (toast.type === 'error') {
          borderClass = 'border-rose-500 bg-white text-rose-900';
          icon = <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />;
        } else if (toast.type === 'warning') {
          borderClass = 'border-amber-500 bg-white text-amber-900';
          icon = <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />;
        } else if (toast.type === 'info') {
          borderClass = 'border-blue-500 bg-white text-blue-900';
          icon = <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-xl border-l-4 ${borderClass} flex items-start justify-between gap-3 animate-in slide-in-from-bottom-3 duration-200`}
          >
            <div className="flex items-start gap-3">
              {icon}
              <div>
                <h4 className="text-sm font-bold">{toast.title}</h4>
                {toast.message && (
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{toast.message}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

