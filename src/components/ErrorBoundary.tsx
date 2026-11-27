import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let friendly =
      'Terjadi kendala saat mengakses layanan database. Silakan muat ulang halaman atau masuk kembali.';
    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && typeof parsed === 'object' && parsed.error) {
        if (parsed.error.toLowerCase().includes('permission')) {
          friendly = `Akses database ditolak pada operasi ${parsed.operationType ?? 'data'} (${parsed.path ?? 'Firestore'}). Pastikan Anda sudah masuk menggunakan akun Google terverifikasi.`;
        } else {
          friendly = parsed.error;
        }
      }
    } catch {
      if (error.message) {
        friendly = error.message;
      }
    }
    return { hasError: true, message: friendly };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F6F8F7] px-4 py-10 text-[#14221B]">
          <div className="w-full max-w-md rounded-xl border border-[#E2E8E4] bg-white p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-[#B91C1C]">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-[#14221B]">
              Terjadi Gangguan Sistem
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#52635A]">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0F3F22]"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Muat Ulang Aplikasi</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
