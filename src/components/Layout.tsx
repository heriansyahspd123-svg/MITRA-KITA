import React, { useState } from 'react';
import {
  CalendarCheck,
  ClipboardCheck,
  FileArchive,
  FileBarChart,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { useMitraKita } from '../context/MitraKitaContext';
import { NavPageId } from '../types/mitraKita';
import { ConfirmDialog } from './ConfirmDialog';

interface LayoutProps {
  activePage: NavPageId;
  onNavigate: (page: NavPageId) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: {
  id: NavPageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'mitra', label: 'Data Mitra', icon: Handshake },
  { id: 'program', label: 'Program Kemitraan', icon: FolderKanban },
  { id: 'kegiatan', label: 'Kegiatan', icon: CalendarCheck },
  { id: 'dokumentasi', label: 'Bukti & Dokumentasi', icon: FileArchive },
  { id: 'monitoring', label: 'Monitoring & Evaluasi', icon: ClipboardCheck },
  { id: 'analisis-ai', label: 'Analisis AI & Dampak', icon: Sparkles },
  { id: 'laporan', label: 'Laporan', icon: FileBarChart },
  { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
];

function getInitials(name?: string, email?: string): string {
  const source = (name || email || 'PS').trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export const Layout: React.FC<LayoutProps> = ({
  activePage,
  onNavigate,
  children,
}) => {
  const { session, schoolNameSuggestions, logoutPengawas } = useMitraKita();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const activeNav =
    NAV_ITEMS.find((item) => item.id === activePage) ?? NAV_ITEMS[0];

  const supervisorInitials = getInitials(
    session?.namaPengawas,
    session?.email
  );

  const handleSelectNav = (id: NavPageId) => {
    onNavigate(id);
    setMobileNavOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0E3F22] via-[#134E2B] to-[#0C351D] text-white">
      {/* Brand Block */}
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleSelectNav('dashboard')}
            className="flex items-center gap-3 text-left focus-visible:outline-none"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/14 text-[#DCFCE7] ring-1 ring-white/20">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3L3 8l9 5 9-5-9-5z" />
                <path d="M5 11.5v5.2c0 1.4 3.1 3.3 7 3.3s7-1.9 7-3.3v-5.2" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-bold tracking-tight text-white">
                MITRA KITA
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-[#BBF7D0]/85">
                Ekosistem Kemitraan Sekolah
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 lg:hidden"
            aria-label="Tutup menu navigasi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-5"
        aria-label="Navigasi utama"
      >
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleSelectNav(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[13.5px] transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white font-semibold text-[#14532D] shadow-sm'
                      : 'font-medium text-[#E2F5E8]/85 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 ${
                      isActive ? 'text-[#14532D]' : 'text-[#A7F3D0]/90'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logged-in Pengawas Sekolah Info */}
      <div className="border-t border-white/10 bg-black/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 font-mono text-xs font-bold text-[#DCFCE7] ring-1 ring-white/20">
            {supervisorInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-white">
              {session?.namaPengawas || 'Pengawas Sekolah'}
            </div>
            <div className="truncate text-[11px] text-[#BBF7D0]/80">
              {session?.nip
                ? `NIP ${session.nip}`
                : session?.email || 'Pengawas Sekolah'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs font-medium text-[#ECFDF5] transition-colors hover:bg-white/15 whitespace-nowrap"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          <span>Keluar Sesi</span>
        </button>
        <p className="mt-3.5 border-t border-white/10 pt-3 text-center text-[10.5px] leading-relaxed text-[#BBF7D0]/75">
          &copy; {new Date().getFullYear()} HERIANSYAH. S.Si., S.Pd., M.Pd
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F3F6F4] text-[#11221A]">
      {/* Shared datalist for Nama Sekolah autocomplete across all input forms */}
      <datalist id="mitra-kita-school-list">
        {schoolNameSuggestions.map((school) => (
          <option key={school} value={school} />
        ))}
      </datalist>

      {/* Desktop Fixed Sidebar */}
      <aside className="no-print hidden w-[264px] shrink-0 lg:fixed lg:inset-y-0 lg:left-0 lg:block">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileNavOpen && (
        <div
          className="no-print fixed inset-0 z-40 flex lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-[#0B1C13]/50 backdrop-blur-[1px]"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-50 w-[272px] max-w-[85vw] shadow-2xl">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[264px]">
        {/* Top Header */}
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[#E2EAE5] bg-white/92 px-4 backdrop-blur-md sm:px-6 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg border border-[#D8E2DC] bg-white p-2 text-[#11221A] hover:bg-[#F3F6F4] lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11.5px] text-[#5B6F65]">
                <span className="truncate font-medium">MITRA KITA</span>
                <span aria-hidden="true" className="text-[#A3B4AA]">
                  /
                </span>
                <span className="shrink-0 font-semibold text-[#14532D]">
                  {activeNav.label}
                </span>
              </div>
              <h1 className="truncate text-[17px] font-bold tracking-tight text-[#11221A]">
                {activeNav.label}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3.5">
            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="text-right">
                <div className="text-xs font-semibold text-[#11221A]">
                  {session?.namaPengawas || 'Pengawas Sekolah'}
                </div>
                <div className="text-[11.5px] text-[#5B6F65]">
                  Pengawas Sekolah
                  {session?.nip
                    ? ` · ${session.nip}`
                    : session?.email
                      ? ` · ${session.email}`
                      : ''}
                </div>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EE] font-mono text-xs font-bold text-[#14532D]">
                {supervisorInitials}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6E0DA] bg-white px-3.5 py-2 text-xs font-medium text-[#11221A] shadow-[0_1px_2px_rgba(16,38,26,0.03)] hover:border-[#B9CBC0] hover:bg-[#F6F9F7] whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5 text-[#5B6F65]" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-9 lg:py-7">
          {children}
        </main>

        {/* Application Copyright Footer */}
        <footer className="border-t border-[#E2EAE5] bg-white/60 px-4 py-3.5 sm:px-6 lg:px-9">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 text-center text-xs text-[#5B6F65] sm:flex-row sm:text-left">
            <span>
              <strong className="font-semibold text-[#14532D]">MITRA KITA</strong>{' '}
              · Sistem Pengelolaan Kemitraan Sekolah
            </span>
            <span className="font-medium text-[#3D5247]">
              &copy; {new Date().getFullYear()} Hak Cipta{' '}
              <strong className="font-semibold text-[#11221A]">
                HERIANSYAH. S.Si., S.Pd., M.Pd
              </strong>
            </span>
          </div>
        </footer>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Keluar dari Sesi Pengawas Sekolah?"
        description="Anda akan kembali ke halaman login Pengawas Sekolah. Seluruh data kemitraan yang telah disimpan tetap aman di Firebase Cloud Firestore."
        confirmLabel="Ya, Keluar"
        variant="primary"
        onConfirm={() => {
          setConfirmLogout(false);
          void logoutPengawas();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
};
