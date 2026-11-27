import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useMitraKita } from '../context/MitraKitaContext';

export const LoginPage: React.FC = () => {
  const {
    loginWithGoogle,
    loginWithEmailPassword,
    sendResetPassword,
    authLoading,
  } = useMitraKita();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await loginWithEmailPassword(email, password);
    if (!res.ok && res.error) setError(res.error);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    const result = await loginWithGoogle();
    if (!result.ok && result.error) {
      setError(result.error);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    const res = await sendResetPassword(email);
    if (!res.ok && res.error) {
      setError(res.error);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F6F8F7] text-[#14221B]">
      {/* Left Institutional Panel (Desktop) */}
      <div className="hidden w-[44%] flex-col justify-between bg-[#14532D] p-12 text-white lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#DCFCE7] text-[#14532D]">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3L3 8l9 5 9-5-9-5z" />
                <path d="M5 11.5v5.2c0 1.4 3.1 3.3 7 3.3s7-1.9 7-3.3v-5.2" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">MITRA KITA</div>
              <div className="text-xs text-[#BBF7D0]">
                Sistem Pengelolaan Kemitraan Sekolah
              </div>
            </div>
          </div>

          <div className="mt-16 max-w-md space-y-4">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
              Bersama Membangun Ekosistem Pembelajaran
            </h1>
            <p className="text-sm leading-relaxed text-[#D1FAE5]/90">
              Portal khusus Pengawas Sekolah untuk memantau kemitraan sekolah
              binaan, memeriksa dokumentasi pelaksanaan, menilai instrumen
              monitoring 10 indikator, serta mencatat rekomendasi pembinaan secara
              sistematis.
            </p>
          </div>
        </div>

        <div className="border-t border-white/15 pt-6 text-xs text-[#BBF7D0]/85">
          <div className="font-semibold text-white">
            Empat Area Kepemimpinan Pembelajaran Mendalam
          </div>
          <p className="mt-1.5 leading-relaxed">
            Praktik Pedagogis · Lingkungan Belajar · Pemanfaatan Digital ·
            Kemitraan Pembelajaran
          </p>
          <p className="mt-4 border-t border-white/10 pt-3 text-[11.5px] text-[#BBF7D0]/80">
            &copy; {new Date().getFullYear()} Hak Cipta{' '}
            <span className="font-semibold text-white">
              HERIANSYAH. S.Si., S.Pd., M.Pd
            </span>
          </p>
        </div>
      </div>

      {/* Right Login Panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* Mobile Brand Header */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#14532D] text-[#DCFCE7]">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3L3 8l9 5 9-5-9-5z" />
                <path d="M5 11.5v5.2c0 1.4 3.1 3.3 7 3.3s7-1.9 7-3.3v-5.2" />
              </svg>
            </div>
            <div>
              <div className="text-base font-bold text-[#14532D]">MITRA KITA</div>
              <div className="text-xs text-[#52635A]">
                Bersama Membangun Ekosistem Pembelajaran
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8E4] bg-white p-7 sm:p-8">
            <div className="flex items-center gap-2.5 text-[#14532D]">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <span className="text-xs font-semibold">
                Portal Khusus Pengawas Sekolah
              </span>
            </div>

            <h2 className="mt-2.5 text-2xl font-bold tracking-tight text-[#14221B]">
              Masuk Pengawas Sekolah
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#52635A]">
              Masuk menggunakan email &amp; kata sandi atau akun Google Anda untuk
              mengakses dashboard kemitraan.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-1.5 block text-xs font-semibold text-[#14221B]"
                >
                  Username / Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="nama@email.com"
                    className="w-full rounded-lg border border-[#D4DDD7] bg-white py-2.5 pr-3.5 pl-10 text-sm text-[#14221B] placeholder:text-[#7C8C84] focus:border-[#14532D] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-[#14221B]"
                  >
                    Kata Sandi
                  </label>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={authLoading}
                    className="text-xs font-medium text-[#14532D] hover:underline disabled:opacity-50"
                  >
                    Lupa kata sandi?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Masukkan kata sandi"
                    className="w-full rounded-lg border border-[#D4DDD7] bg-white py-2.5 pr-10 pl-10 text-sm text-[#14221B] placeholder:text-[#7C8C84] focus:border-[#14532D] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-[#64748B] hover:text-[#14221B]"
                    aria-label={
                      showPassword
                        ? 'Sembunyikan kata sandi'
                        : 'Tampilkan kata sandi'
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-[#B91C1C]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-lg bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0F3F22] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authLoading ? 'Memproses...' : 'Masuk dengan Email'}
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3 text-xs text-[#7C8C84]">
              <div className="h-px flex-1 bg-[#E2E8E4]" />
              <span>atau</span>
              <div className="h-px flex-1 bg-[#E2E8E4]" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#D4DDD7] bg-white px-4 py-2.5 text-sm font-semibold text-[#14221B] transition-colors hover:bg-[#F6F8F7] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.29 14.29A7.19 7.19 0 0 1 4.91 12c0-.79.14-1.56.38-2.29V6.61H1.29a12 12 0 0 0 0 10.78l4-3.1z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.61l4 3.1C6.23 6.87 8.88 4.76 12 4.76z"
                />
              </svg>
              <span>Masuk dengan Google</span>
            </button>

            <p className="mt-5 border-t border-[#EEF2EF] pt-4 text-xs leading-relaxed text-[#52635A]">
              Autentikasi dikelola secara aman oleh Firebase Authentication dan
              data tersimpan per akun di Cloud Firestore.
            </p>
          </div>

          <p className="mt-5 text-center text-xs text-[#5B6F65]">
            &copy; {new Date().getFullYear()} Hak Cipta{' '}
            <strong className="font-semibold text-[#11221A]">
              HERIANSYAH. S.Si., S.Pd., M.Pd
            </strong>
          </p>
        </div>
      </div>
    </div>
  );
};
