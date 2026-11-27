import React from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useMitraKita } from '../context/MitraKitaContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useMitraKita();

  if (toasts.length === 0) return null;

  return (
    <div
      className="no-print fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2.5 sm:right-6 sm:bottom-6"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-start gap-3 rounded-xl border border-[#DCE5DF] bg-white p-4 shadow-lg"
        >
          {toast.type === 'success' && (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#15803D]" />
          )}
          {toast.type === 'error' && (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#B91C1C]" />
          )}
          {toast.type === 'info' && (
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#14532D]" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#14221B]">{toast.title}</p>
            {toast.description && (
              <p className="mt-0.5 text-xs leading-relaxed text-[#52635A]">
                {toast.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="rounded-md p-1 text-[#64748B] hover:bg-[#F1F5F2] hover:text-[#14221B]"
            aria-label="Tutup notifikasi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
