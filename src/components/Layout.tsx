import React, { useEffect, useState } from 'react';
import {
  CalendarCheck,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  FileArchive,
  FileBarChart,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  LogOut,
  Maximize2,
  Menu,
  PanelLeft,
  PanelLeftOpen,
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

type DesktopSidebarMode = 'expanded' | 'compact' | 'hidden';

const SIDEBAR_STORAGE_KEY = 'mitra_kita_sidebar_mode';

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

function readStoredSidebarMode(): DesktopSidebarMode {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (raw === 'expanded' || raw === 'compact' || raw === 'hidden') {
      return raw;
    }
  } catch {
    // Ignore storage read errors in restricted iframe environments
  }
  return 'expanded';
}

export const Layout: React.FC<LayoutProps> = ({
  activePage,
  onNavigate,
  children,
}) => {
  const { session, schoolNameSuggestions, logoutPengawas } = useMitraKita();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<DesktopSidebarMode>(() =>
    readStoredSidebarMode()
  );
  const [confirmLogout, setConfirmLogout] = useState(false);

  const isCompact = sidebarMode === 'compact';
  const isHidden = sidebarMode === 'hidden';

  const updateSidebarMode = (nextMode: DesktopSidebarMode) => {
    setSidebarMode(nextMode);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, nextMode);
    } catch {
      // Ignore storage write errors
    }
  };

  const handleToggleDesktopSidebar = () => {
    if (sidebarMode === 'expanded') {
      updateSidebarMode('compact');
    } else {
      updateSidebarMode('expanded');
    }
  };

  // Keyboard shortcuts: Ctrl/Cmd+B to toggle sidebar, Escape to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const target = e.target as HTMLElement | null;
        const isEditable =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable);
        if (isEditable) return;
        e.preventDefault();
        setSidebarMode((prev) => {
          const next: DesktopSidebarMode =
            prev === 'expanded' ? 'compact' : 'expanded';
          try {
            window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next);
          } catch {
            // Ignore
          }
          return next;
        });
      } else if (e.key === 'Escape' && mobileNavOpen) {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileNavOpen]);

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

  const renderSidebarContent = (compact: boolean, isMobileDrawer: boolean) => (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0E3F22] via-[#134E2B] to-[#0C351D] text-white">
      {/* Brand Block */}
      <div
        className={`border-b border-white/10 ${
          compact ? 'px-3 py-4' : 'px-5 py-5'
        }`}
      >
        <div
          className={`flex items-center ${
            compact ? 'flex-col gap-3' : 'justify-between gap-2'
          }`}
        >
          <button
            type="button"
            onClick={() => handleSelectNav('dashboard')}
            title="MITRA KITA — Dashboard"
            className={`flex items-center text-left focus-visible:outline-none ${
              compact ? 'justify-center' : 'gap-3 min-w-0'
            }`}
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
            {!compact && (
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold tracking-tight text-white">
                  MITRA KITA
                </div>
                <p className="mt-0.5 truncate text-[11px] leading-snug text-[#BBF7D0]/85">
                  Ekosistem Kemitraan Sekolah
                </p>
              </div>
            )}
          </button>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 lg:hidden"
              aria-label="Tutup menu navigasi"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggleDesktopSidebar}
              title={
                compact
                  ? 'Perluas Sidebar (Ctrl+B)'
                  : 'Ringkas Sidebar ke Mode Ikon (Ctrl+B)'
              }
              aria-label={
                compact ? 'Perluas sidebar' : 'Ringkas sidebar ke mode ikon'
              }
              className="hidden rounded-lg p-1.5 text-[#BBF7D0]/85 transition-colors hover:bg-white/12 hover:text-white lg:inline-flex"
            >
              {compact ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <ChevronsLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav
        className={`flex-1 py-4 ${
          compact
            ? 'overflow-visible px-2.5'
            : 'overflow-y-auto px-3'
        }`}
        aria-label="Navigasi utama"
      >
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <li key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => handleSelectNav(item.id)}
                  title={compact ? item.label : undefined}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full items-center rounded-xl text-left text-[13.5px] transition-all whitespace-nowrap ${
                    compact
                      ? 'justify-center px-0 py-2.5'
                      : 'gap-3 px-3.5 py-2.5'
                  } ${
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
                  {!compact && <span className="truncate">{item.label}</span>}
                </button>

                {/* Floating label tooltip in compact icon rail mode */}
                {compact && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 rounded-lg bg-[#0E3F22] px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg ring-1 ring-white/15 transition-opacity duration-150 group-hover:opacity-100 whitespace-nowrap"
                  >
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logged-in Pengawas Sekolah Info & Flexible Mode Actions */}
      <div
        className={`border-t border-white/10 bg-black/10 ${
          compact ? 'px-2.5 py-3.5' : 'p-4'
        }`}
      >
        {compact ? (
          <div className="flex flex-col items-center gap-2">
            <div
              title={`${session?.namaPengawas || 'Pengawas Sekolah'}${
                session?.nip ? ` · NIP ${session.nip}` : ''
              }`}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 font-mono text-xs font-bold text-[#DCFCE7] ring-1 ring-white/20"
            >
              {supervisorInitials}
            </div>
            {!isMobileDrawer && (
              <button
                type="button"
                onClick={() => updateSidebarMode('hidden')}
                title="Sembunyikan Sidebar (Mode Layar Penuh)"
                aria-label="Sembunyikan sidebar"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/8 text-[#ECFDF5] transition-colors hover:bg-white/15"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              title="Keluar Sesi"
              aria-label="Keluar sesi"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/8 text-[#ECFDF5] transition-colors hover:bg-white/15"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
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

            <div className="mt-3 flex items-center gap-2">
              {!isMobileDrawer && (
                <button
                  type="button"
                  onClick={() => updateSidebarMode('hidden')}
                  title="Sembunyikan Sidebar agar tampilan layar penuh"
                  className="hidden flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-2.5 py-2 text-xs font-medium text-[#ECFDF5] transition-colors hover:bg-white/15 whitespace-nowrap lg:inline-flex"
                >
                  <Maximize2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Sembunyikan</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-2.5 py-2 text-xs font-medium text-[#ECFDF5] transition-colors hover:bg-white/15 whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span>Keluar</span>
              </button>
            </div>

            <p className="mt-3.5 border-t border-white/10 pt-3 text-center text-[10.5px] leading-relaxed text-[#BBF7D0]/75">
              &copy; {new Date().getFullYear()} HERIANSYAH. S.Si., S.Pd., M.Pd
            </p>
          </>
        )}
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

      {/* Desktop Flexible Sidebar (Expanded / Compact Rail / Hidden) */}
      <aside
        aria-hidden={isHidden}
        className={`no-print hidden shrink-0 transition-all duration-200 ease-out lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block ${
          isHidden
            ? 'lg:w-0 lg:-translate-x-full lg:pointer-events-none lg:opacity-0'
            : isCompact
              ? 'lg:w-[76px] lg:translate-x-0 lg:opacity-100'
              : 'lg:w-[264px] lg:translate-x-0 lg:opacity-100'
        }`}
      >
        {!isHidden && renderSidebarContent(isCompact, false)}
      </aside>

      {/* Mobile & Tablet Drawer Sidebar */}
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
            {renderSidebarContent(false, true)}
          </div>
        </div>
      )}

      {/* Main Content Area — adapts smoothly to sidebar mode */}
      <div
        className={`flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out ${
          isHidden
            ? 'lg:pl-0'
            : isCompact
              ? 'lg:pl-[76px]'
              : 'lg:pl-[264px]'
        }`}
      >
        {/* Top Header */}
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[#E2EAE5] bg-white/92 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {/* Mobile Drawer Trigger */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg border border-[#D8E2DC] bg-white p-2 text-[#11221A] hover:bg-[#F3F6F4] lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Desktop Flexible Sidebar Toggle */}
            <button
              type="button"
              onClick={handleToggleDesktopSidebar}
              title={
                isHidden
                  ? 'Tampilkan Sidebar (Ctrl+B)'
                  : isCompact
                    ? 'Perluas Sidebar (Ctrl+B)'
                    : 'Ringkas Sidebar (Ctrl+B)'
              }
              aria-label={
                isHidden
                  ? 'Tampilkan sidebar'
                  : isCompact
                    ? 'Perluas sidebar'
                    : 'Ringkas sidebar'
              }
              className={`hidden items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors lg:inline-flex ${
                isHidden
                  ? 'border-[#14532D]/30 bg-[#EDF6F0] text-[#14532D] hover:bg-[#DCFCE7]'
                  : 'border-[#D8E2DC] bg-white text-[#334A3E] hover:border-[#B6C9BD] hover:bg-[#F3F6F4]'
              }`}
            >
              {isHidden ? (
                <>
                  <PanelLeftOpen className="h-4 w-4 shrink-0" />
                  <span>Menu</span>
                </>
              ) : (
                <PanelLeft className="h-4 w-4 shrink-0" />
              )}
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

        {/* Viewport Content — expands cleanly when sidebar is compact or hidden */}
        <main
          className={`mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-7 ${
            isHidden || isCompact ? 'max-w-[1440px]' : 'max-w-7xl'
          }`}
        >
          {children}
        </main>

        {/* Application Copyright Footer */}
        <footer className="border-t border-[#E2EAE5] bg-white/60 px-4 py-3.5 sm:px-6 lg:px-8">
          <div
            className={`mx-auto flex flex-col items-center justify-between gap-1 text-center text-xs text-[#5B6F65] sm:flex-row sm:text-left ${
              isHidden || isCompact ? 'max-w-[1440px]' : 'max-w-7xl'
            }`}
          >
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
