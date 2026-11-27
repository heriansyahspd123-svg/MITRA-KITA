import { useState } from 'react';
import { LogOut, MailCheck, RefreshCw, Send } from 'lucide-react';
import { ArkasImportModal } from './components/ArkasImportModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ToastContainer } from './components/ToastContainer';
import { MitraKitaProvider, useMitraKita } from './context/MitraKitaContext';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { AiAnalysisPage } from './pages/AiAnalysisPage';
import { DashboardPage } from './pages/DashboardPage';
import { EvidencePage } from './pages/EvidencePage';
import { LoginPage } from './pages/LoginPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { PartnersPage } from './pages/PartnersPage';
import { ProgramsPage } from './pages/ProgramsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NavPageId, Partner } from './types/mitraKita';

export type ProgramNavIntent =
  | { type: 'createForPartner'; partner: Partner }
  | { type: 'filterByPartner'; partnerId: string }
  | { type: 'openDetail'; programId: string };

export type PartnerNavIntent = { type: 'openDetail'; partnerId: string };

function EmailVerificationGate() {
  const {
    unverifiedEmail,
    resendVerificationEmail,
    refreshEmailVerification,
    logoutPengawas,
  } = useMitraKita();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    setBusy(true);
    setError('');
    await refreshEmailVerification();
    setBusy(false);
  };

  const handleResend = async () => {
    setBusy(true);
    setError('');
    const res = await resendVerificationEmail();
    if (!res.ok && res.error) setError(res.error);
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F8F7] px-4 py-10 text-[#14221B]">
      <div className="w-full max-w-md rounded-xl border border-[#E2E8E4] bg-white p-7 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#14532D]">
          <MailCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-[#14221B]">
          Verifikasi Email Diperlukan
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#52635A]">
          Demi keamanan database Firestore, silakan buka tautan verifikasi yang
          dikirim ke{' '}
          <span className="font-semibold text-[#14221B]">
            {unverifiedEmail || 'alamat email Anda'}
          </span>{' '}
          (periksa juga folder Spam).
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-[#B91C1C]">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={handleCheck}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0F3F22] disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Saya Sudah Verifikasi (Cek Status)</span>
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#D4DDD7] bg-white px-4 py-2.5 text-sm font-medium text-[#14221B] hover:bg-[#F6F8F7] disabled:opacity-60"
          >
            <Send className="h-4 w-4 text-[#14532D]" />
            <span>Kirim Ulang Email Verifikasi</span>
          </button>
          <button
            type="button"
            onClick={() => void logoutPengawas()}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-[#52635A] hover:text-[#14221B]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Keluar / Ganti Akun</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MitraKitaAppShell() {
  const { session, authReady, needsEmailVerification } = useMitraKita();
  const [activePage, setActivePage] = useState<NavPageId>('dashboard');
  const [programNavIntent, setProgramNavIntent] =
    useState<ProgramNavIntent | null>(null);
  const [partnerNavIntent, setPartnerNavIntent] =
    useState<PartnerNavIntent | null>(null);
  const [arkasModalOpen, setArkasModalOpen] = useState(false);

  const handleCreateProgramForPartner = (partner: Partner) => {
    setProgramNavIntent({ type: 'createForPartner', partner });
    setActivePage('program');
  };

  const handleViewPartnerPrograms = (partnerId: string) => {
    setProgramNavIntent({ type: 'filterByPartner', partnerId });
    setActivePage('program');
  };

  const handleOpenProgramDetail = (programId: string) => {
    setProgramNavIntent({ type: 'openDetail', programId });
    setActivePage('program');
  };

  const handleOpenPartnerDetail = (partnerId: string) => {
    setPartnerNavIntent({ type: 'openDetail', partnerId });
    setActivePage('mitra');
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8F7] text-[#14221B]">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-[#DCE5DF] border-t-[#14532D]" />
          <p className="text-sm font-medium text-[#52635A]">
            Memuat sesi Pengawas Sekolah...
          </p>
        </div>
      </div>
    );
  }

  if (needsEmailVerification) {
    return (
      <>
        <EmailVerificationGate />
        <ToastContainer />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigate={setActivePage}
            onOpenArkasImport={() => setArkasModalOpen(true)}
          />
        );
      case 'mitra':
        return (
          <PartnersPage
            navIntent={partnerNavIntent}
            onClearNavIntent={() => setPartnerNavIntent(null)}
            onCreateProgramForPartner={handleCreateProgramForPartner}
            onViewPartnerPrograms={handleViewPartnerPrograms}
            onOpenProgramDetail={handleOpenProgramDetail}
          />
        );
      case 'program':
        return (
          <ProgramsPage
            navIntent={programNavIntent}
            onClearNavIntent={() => setProgramNavIntent(null)}
            onOpenPartnerDetail={handleOpenPartnerDetail}
            onOpenArkasImport={() => setArkasModalOpen(true)}
          />
        );
      case 'kegiatan':
        return (
          <ActivitiesPage onOpenArkasImport={() => setArkasModalOpen(true)} />
        );
      case 'dokumentasi':
        return <EvidencePage />;
      case 'monitoring':
        return <MonitoringPage />;
      case 'analisis-ai':
        return <AiAnalysisPage onNavigate={setActivePage} />;
      case 'laporan':
        return <ReportsPage />;
      case 'pengaturan':
        return <SettingsPage />;
      default:
        return (
          <DashboardPage
            onNavigate={setActivePage}
            onOpenArkasImport={() => setArkasModalOpen(true)}
          />
        );
    }
  };

  return (
    <>
      <Layout activePage={activePage} onNavigate={setActivePage}>
        {renderPage()}
      </Layout>
      <ArkasImportModal
        open={arkasModalOpen}
        onClose={() => setArkasModalOpen(false)}
        onNavigate={setActivePage}
      />
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MitraKitaProvider>
        <MitraKitaAppShell />
      </MitraKitaProvider>
    </ErrorBoundary>
  );
}
