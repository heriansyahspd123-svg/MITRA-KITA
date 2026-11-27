import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  title,
  subtitle,
  maxWidthClass = 'max-w-2xl',
  onClose,
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`my-auto flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-[#DCE5DF] bg-white shadow-xl ${maxWidthClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E7ECE9] px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[#14221B]">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-sm text-[#52635A]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#52635A] hover:bg-[#F1F5F2] hover:text-[#14221B]"
            aria-label="Tutup jendela"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
};
