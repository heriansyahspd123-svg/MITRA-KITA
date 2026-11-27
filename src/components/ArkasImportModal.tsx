import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Handshake,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useMitraKita } from '../context/MitraKitaContext';
import {
  ArkasDraftActivity,
  ArkasDraftProgram,
  ArkasParseResult,
  ArkasSchoolInfo,
  ArkasSuggestedPartner,
} from '../types/arkasImport';
import {
  ACTIVITY_STATUSES,
  ActivityStatus,
  NavPageId,
  PARTNER_CATEGORIES,
  PartnerCategory,
  PM_LEADERSHIP_AREAS,
  PmLeadershipArea,
  PROGRAM_STATUSES,
  ProgramStatus,
} from '../types/mitraKita';
import { formatCurrencyIDR, getPmAreaCode } from '../utils/formatters';

interface ArkasImportModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate?: (page: NavPageId) => void;
}

type ModalStep = 'upload' | 'parsing' | 'preview' | 'done';
type PreviewTab = 'programs' | 'partners';

const ATTACHED_ARKAS_URL =
  '/assets/aistudio/arkas__SDN_4_MASSEPE_1e954e4b.pdf';
const ATTACHED_ARKAS_FILENAME = 'ARKAS_UPT_SD_NEGERI_4_MASSEPE_2026.pdf';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export const ArkasImportModal: React.FC<ArkasImportModalProps> = ({
  open,
  onClose,
  onNavigate,
}) => {
  const { dataset, importArkasBundle } = useMitraKita();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<ModalStep>('upload');
  const [activeTab, setActiveTab] = useState<PreviewTab>('programs');
  const [dragOver, setDragOver] = useState(false);
  const [sourceFileName, setSourceFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Parsed & editable draft state
  const [schoolInfo, setSchoolInfo] = useState<ArkasSchoolInfo>({
    namaSekolah: '',
    npsn: '',
    alamatSekolah: '',
    tahunAnggaran: String(new Date().getFullYear()),
    sumberDana: 'BOSP Reguler',
    totalAnggaran: 0,
    kepalaSekolah: '',
    bendaharaSekolah: '',
    komiteSekolah: '',
  });
  const [summary, setSummary] = useState('');
  const [updateSchoolProfile, setUpdateSchoolProfile] = useState(true);
  const [partners, setPartners] = useState<ArkasSuggestedPartner[]>([]);
  const [programs, setPrograms] = useState<ArkasDraftProgram[]>([]);
  const [expandedPrograms, setExpandedPrograms] = useState<
    Record<string, boolean>
  >({});
  const [savedCounts, setSavedCounts] = useState({
    partnersCreated: 0,
    programsCreated: 0,
    activitiesCreated: 0,
  });

  const resetModalState = () => {
    setStep('upload');
    setActiveTab('programs');
    setErrorMsg('');
    setSourceFileName('');
    setSaving(false);
    setExpandedPrograms({});
  };

  const handleClose = () => {
    if (step === 'parsing' || saving) return;
    resetModalState();
    onClose();
  };

  const parseArkasBase64 = async (
    fileName: string,
    mimeType: string,
    base64Data: string
  ) => {
    setErrorMsg('');
    setSourceFileName(fileName);
    setStep('parsing');

    try {
      const existingPartners = dataset.partners.map((p) => ({
        id: p.id,
        nama: p.nama,
        kategori: p.kategori,
        namaSekolah: p.namaSekolah,
      }));

      const res = await fetch('/api/arkas/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          mimeType,
          base64Data,
          existingPartners,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as Partial<
        ArkasParseResult & { error?: string }
      >;

      if (!res.ok) {
        throw new Error(
          payload.error ||
            'Gagal memproses file ARKAS. Pastikan file valid dan coba lagi.'
        );
      }

      if (!payload.schoolInfo || !Array.isArray(payload.programs)) {
        throw new Error(
          'Hasil pembacaan ARKAS tidak lengkap. Silakan coba unggah kembali.'
        );
      }

      setSchoolInfo(payload.schoolInfo);
      setSummary(payload.summary || '');
      setPartners(payload.suggestedPartners ?? []);
      setPrograms(payload.programs);
      setUpdateSchoolProfile(true);
      setActiveTab('programs');

      // Expand first program by default so user sees editable fields immediately
      const initialExpand: Record<string, boolean> = {};
      if (payload.programs[0]) {
        initialExpand[payload.programs[0].tempKey] = true;
      }
      setExpandedPrograms(initialExpand);
      setStep('preview');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat membaca file ARKAS.'
      );
      setStep('upload');
    }
  };

  const handleFileSelected = async (file: File | null | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isValidExt =
      lower.endsWith('.pdf') ||
      lower.endsWith('.xlsx') ||
      lower.endsWith('.xls') ||
      lower.endsWith('.csv');

    if (!isValidExt) {
      setErrorMsg(
        'Format file tidak didukung. Pilih file ARKAS berformat .pdf, .xlsx, .xls, atau .csv.'
      );
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('Ukuran file melebihi batas 20 MB.');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      await parseArkasBase64(file.name, file.type || '', base64);
    } catch {
      setErrorMsg('Gagal membaca file dari perangkat Anda.');
      setStep('upload');
    }
  };

  const handleLoadAttachedSample = async () => {
    setErrorMsg('');
    setSourceFileName(ATTACHED_ARKAS_FILENAME);
    setStep('parsing');
    try {
      const resp = await fetch(ATTACHED_ARKAS_URL);
      if (!resp.ok) {
        throw new Error('Berkas ARKAS terlampir tidak ditemukan di server.');
      }
      const buffer = await resp.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      await parseArkasBase64(
        ATTACHED_ARKAS_FILENAME,
        'application/pdf',
        base64
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal memuat file ARKAS UPT SD Negeri 4 Massepe.'
      );
      setStep('upload');
    }
  };

  // --- Draft state updaters ---
  const toggleProgramExpanded = (tempKey: string) => {
    setExpandedPrograms((prev) => ({ ...prev, [tempKey]: !prev[tempKey] }));
  };

  const updateProgramField = <K extends keyof ArkasDraftProgram>(
    tempKey: string,
    field: K,
    value: ArkasDraftProgram[K]
  ) => {
    setPrograms((prev) =>
      prev.map((p) => (p.tempKey === tempKey ? { ...p, [field]: value } : p))
    );
  };

  const toggleProgramSuggestedPartner = (
    programKey: string,
    partnerKey: string
  ) => {
    setPrograms((prev) =>
      prev.map((p) => {
        if (p.tempKey !== programKey) return p;
        const exists = p.suggestedPartnerKeys.includes(partnerKey);
        return {
          ...p,
          suggestedPartnerKeys: exists
            ? p.suggestedPartnerKeys.filter((k) => k !== partnerKey)
            : [...p.suggestedPartnerKeys, partnerKey],
        };
      })
    );
  };

  const toggleProgramExistingPartner = (
    programKey: string,
    partnerId: string
  ) => {
    setPrograms((prev) =>
      prev.map((p) => {
        if (p.tempKey !== programKey) return p;
        const exists = p.existingPartnerIds.includes(partnerId);
        return {
          ...p,
          existingPartnerIds: exists
            ? p.existingPartnerIds.filter((id) => id !== partnerId)
            : [...p.existingPartnerIds, partnerId],
        };
      })
    );
  };

  const updateActivityField = <K extends keyof ArkasDraftActivity>(
    programKey: string,
    actTempId: string,
    field: K,
    value: ArkasDraftActivity[K]
  ) => {
    setPrograms((prev) =>
      prev.map((p) => {
        if (p.tempKey !== programKey) return p;
        return {
          ...p,
          activities: p.activities.map((a) =>
            a.tempId === actTempId ? { ...a, [field]: value } : a
          ),
        };
      })
    );
  };

  const addDraftActivity = (programKey: string) => {
    const yrMatch = (schoolInfo.tahunAnggaran || '').match(/\d{4}/);
    const yr = yrMatch ? yrMatch[0] : String(new Date().getFullYear());
    setPrograms((prev) =>
      prev.map((p) => {
        if (p.tempKey !== programKey) return p;
        const newAct: ArkasDraftActivity = {
          tempId: `act_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          selected: true,
          namaKegiatan: `Kegiatan Pendukung ${p.namaProgram.slice(0, 60)}`,
          tanggalPelaksanaan: `${yr}-08-15`,
          lokasi: schoolInfo.namaSekolah || 'Lingkungan Sekolah',
          penanggungJawab:
            p.penanggungJawab || schoolInfo.kepalaSekolah || 'Tim Sekolah',
          jumlahPeserta: 30,
          deskripsiPelaksanaan: '',
          hasilKegiatan: '',
          kendala: '',
          status: 'Terjadwal',
        };
        return { ...p, activities: [...p.activities, newAct] };
      })
    );
  };

  const removeDraftActivity = (programKey: string, actTempId: string) => {
    setPrograms((prev) =>
      prev.map((p) => {
        if (p.tempKey !== programKey) return p;
        return {
          ...p,
          activities: p.activities.filter((a) => a.tempId !== actTempId),
        };
      })
    );
  };

  const updatePartnerField = <K extends keyof ArkasSuggestedPartner>(
    tempKey: string,
    field: K,
    value: ArkasSuggestedPartner[K]
  ) => {
    setPartners((prev) =>
      prev.map((pt) => (pt.tempKey === tempKey ? { ...pt, [field]: value } : pt))
    );
  };

  const selectionSummary = useMemo(() => {
    const selectedPrograms = programs.filter((p) => p.selected);
    const selectedActivities = selectedPrograms.reduce(
      (sum, p) => sum + p.activities.filter((a) => a.selected).length,
      0
    );
    const newPartnersCount = partners.filter(
      (pt) => pt.selected && !pt.existingPartnerId
    ).length;
    const matchedPartnersCount = partners.filter(
      (pt) => pt.selected && Boolean(pt.existingPartnerId)
    ).length;
    const totalSelectedBudget = selectedPrograms.reduce(
      (sum, p) => sum + (Number(p.anggaranRencana) || 0),
      0
    );
    return {
      selectedProgramsCount: selectedPrograms.length,
      selectedActivitiesCount: selectedActivities,
      newPartnersCount,
      matchedPartnersCount,
      totalSelectedBudget,
    };
  }, [partners, programs]);

  const handleSelectAllPrograms = (selected: boolean) => {
    setPrograms((prev) => prev.map((p) => ({ ...p, selected })));
  };

  const handleSaveToApp = async () => {
    if (
      selectionSummary.selectedProgramsCount === 0 &&
      selectionSummary.newPartnersCount === 0
    ) {
      setErrorMsg('Pilih minimal satu Program Kemitraan atau Mitra untuk disimpan.');
      return;
    }

    setErrorMsg('');
    setSaving(true);
    const res = await importArkasBundle({
      schoolInfo,
      updateSchoolProfile,
      partners,
      programs,
    });
    setSaving(false);

    if (!res.ok) {
      setErrorMsg(
        res.error || 'Gagal menyimpan data hasil impor ARKAS ke database.'
      );
      return;
    }

    setSavedCounts({
      partnersCreated: res.partnersCreated,
      programsCreated: res.programsCreated,
      activitiesCreated: res.activitiesCreated,
    });
    setStep('done');
  };

  const handleJumpAndClose = (page: NavPageId) => {
    resetModalState();
    onClose();
    onNavigate?.(page);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/55 p-3 sm:p-5">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#DCE5DF] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8E4] px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#14532D]" />
              <h3 className="text-base font-bold text-[#14221B] sm:text-lg">
                Impor Dokumen ARKAS (PDF / Excel)
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-[#52635A]">
              {step === 'upload' &&
                'Unggah RKAS / Kertas Kerja ARKAS sekolah untuk dibaca otomatis menjadi Program Kemitraan, Kegiatan, dan Usulan Mitra.'}
              {step === 'parsing' &&
                `Sedang membaca dan memetakan dokumen ${sourceFileName}...`}
              {step === 'preview' &&
                `Pratinjau & edit hasil pembacaan ${sourceFileName} sebelum disimpan ke database aplikasi.`}
              {step === 'done' &&
                'Seluruh data ARKAS terpilih telah masuk ke menu aplikasi dan tetap dapat Anda edit kapan saja.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={step === 'parsing' || saving}
            aria-label="Tutup modal impor ARKAS"
            className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F2] hover:text-[#14221B] disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {errorMsg && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-[#991B1B]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B91C1C]" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void handleFileSelected(e.dataTransfer.files?.[0]);
                }}
                className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  dragOver
                    ? 'border-[#14532D] bg-[#ECFDF5]'
                    : 'border-[#CBD7CF] bg-[#FAFCFB] hover:border-[#14532D]/60'
                }`}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#14532D]">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-[#14221B]">
                  Tarik & lepaskan file ARKAS di sini, atau pilih dari perangkat
                </p>
                <p className="mt-1 text-xs text-[#52635A]">
                  Mendukung format <strong>PDF (.pdf)</strong> dan{' '}
                  <strong>Excel (.xlsx, .xls, .csv)</strong> hingga 20 MB (Kertas
                  Kerja RKAS per Tahap, per Bulan, atau Ekspor ARKAS).
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={(e) => {
                    void handleFileSelected(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F3F22]"
                >
                  <Upload className="h-4 w-4" />
                  <span>Pilih File ARKAS (PDF / Excel)</span>
                </button>
              </div>

              {/* Quick-load attached SDN 4 Massepe ARKAS PDF */}
              <div className="rounded-xl border border-[#CBE2D3] bg-[#F2FBF5] p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#14532D] text-white">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#14532D]">
                        File ARKAS Terlampir Siap Diproses
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-[#14221B]">
                        Kertas Kerja RKAS 2026 — UPT SD NEGERI 4 MASSEPE
                      </p>
                      <p className="mt-0.5 text-xs text-[#52635A]">
                        NPSN 40305450 · BOSP Reguler Rp 172.800.000 · 13 Halaman
                        (Tahap I & II)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleLoadAttachedSample()}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F3F22]"
                  >
                    <span>Baca & Petakan Otomatis</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* 3-step explanation */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-[#E2E8E4] bg-white p-3.5">
                  <p className="text-xs font-bold text-[#14532D]">
                    1. Pembacaan Otomatis
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#52635A]">
                    Membaca identitas sekolah, kode program ARKAS, rincian
                    kegiatan, jadwal tahap, dan anggaran secara akurat.
                  </p>
                </div>
                <div className="rounded-lg border border-[#E2E8E4] bg-white p-3.5">
                  <p className="text-xs font-bold text-[#14532D]">
                    2. Pratinjau & Edit Bebas
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#52635A]">
                    Pilih program/kegiatan yang diinginkan, ubah nama, area PM,
                    penanggung jawab, anggaran, serta tautan mitra.
                  </p>
                </div>
                <div className="rounded-lg border border-[#E2E8E4] bg-white p-3.5">
                  <p className="text-xs font-bold text-[#14532D]">
                    3. Masuk Menu & Terhubung
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#52635A]">
                    Tersimpan langsung ke Data Mitra, Program Kemitraan, dan
                    Kegiatan serta tetap bisa diedit kapan saja.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PARSING */}
          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#14532D]">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
              <h4 className="mt-4 text-base font-bold text-[#14221B]">
                Menganalisis Dokumen ARKAS...
              </h4>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#52635A]">
                Sistem sedang membaca struktur kode program, sub-kegiatan,
                rincian anggaran, dan memetakannya ke 4 Area Pembelajaran
                Mendalam beserta usulan Mitra & Kegiatan. Proses ini biasanya
                memerlukan 10–25 detik untuk dokumen beberapa halaman.
              </p>
              <p className="mt-3 rounded-md bg-[#F3F6F4] px-3 py-1 font-mono text-xs text-[#334155]">
                {sourceFileName}
              </p>
            </div>
          )}

          {/* STEP 3: PREVIEW & EDIT */}
          {step === 'preview' && (
            <div className="space-y-5">
              {/* School Header Summary (Editable) */}
              <div className="rounded-xl border border-[#DCE5DF] bg-[#F8FBF9] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#14532D]" />
                    <span className="text-xs font-bold uppercase tracking-wide text-[#14532D]">
                      Identitas Sekolah dari ARKAS
                    </span>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#14221B]">
                    <input
                      type="checkbox"
                      checked={updateSchoolProfile}
                      onChange={(e) => setUpdateSchoolProfile(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-[#CBD5E1] accent-[#14532D]"
                    />
                    <span>Perbarui Profil Sekolah di Pengaturan</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#52635A]">
                      Nama Sekolah *
                    </label>
                    <input
                      type="text"
                      value={schoolInfo.namaSekolah}
                      onChange={(e) =>
                        setSchoolInfo((s) => ({
                          ...s,
                          namaSekolah: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#14221B] focus:border-[#14532D] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#52635A]">
                      NPSN
                    </label>
                    <input
                      type="text"
                      value={schoolInfo.npsn}
                      onChange={(e) =>
                        setSchoolInfo((s) => ({ ...s, npsn: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#52635A]">
                      Kepala Sekolah
                    </label>
                    <input
                      type="text"
                      value={schoolInfo.kepalaSekolah}
                      onChange={(e) =>
                        setSchoolInfo((s) => ({
                          ...s,
                          kepalaSekolah: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#52635A]">
                      Tahun & Total BOSP/RKAS
                    </label>
                    <div className="mt-1 flex items-center justify-between rounded-lg border border-[#E2E8E4] bg-white px-2.5 py-1.5 text-xs">
                      <span className="font-semibold text-[#14221B]">
                        {schoolInfo.tahunAnggaran}
                      </span>
                      <span className="font-mono font-semibold text-[#14532D]">
                        {formatCurrencyIDR(schoolInfo.totalAnggaran)}
                      </span>
                    </div>
                  </div>
                </div>

                {summary && (
                  <p className="border-t border-[#E2E8E4] pt-2.5 text-xs leading-relaxed text-[#334155]">
                    {summary}
                  </p>
                )}
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8E4]">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('programs')}
                    className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                      activeTab === 'programs'
                        ? 'border-[#14532D] text-[#14532D]'
                        : 'border-transparent text-[#52635A] hover:text-[#14221B]'
                    }`}
                  >
                    <FolderKanban className="h-4 w-4" />
                    <span>
                      Program & Kegiatan ({selectionSummary.selectedProgramsCount}/
                      {programs.length} Program ·{' '}
                      {selectionSummary.selectedActivitiesCount} Kegiatan)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('partners')}
                    className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                      activeTab === 'partners'
                        ? 'border-[#14532D] text-[#14532D]'
                        : 'border-transparent text-[#52635A] hover:text-[#14221B]'
                    }`}
                  >
                    <Handshake className="h-4 w-4" />
                    <span>
                      Usulan Mitra ({partners.filter((p) => p.selected).length}/
                      {partners.length})
                    </span>
                  </button>
                </div>

                {activeTab === 'programs' && (
                  <div className="flex items-center gap-3 pb-2 text-xs">
                    <span className="font-mono font-semibold text-[#14532D]">
                      Terpilih:{' '}
                      {formatCurrencyIDR(selectionSummary.totalSelectedBudget)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllPrograms(true)}
                      className="font-medium text-[#14532D] hover:underline"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectAllPrograms(false)}
                      className="font-medium text-[#64748B] hover:underline"
                    >
                      Kosongkan
                    </button>
                  </div>
                )}
              </div>

              {/* TAB 1: PROGRAMS & ACTIVITIES */}
              {activeTab === 'programs' && (
                <div className="space-y-3">
                  {programs.map((prg) => {
                    const isExpanded = Boolean(expandedPrograms[prg.tempKey]);
                    const selectedActsCount = prg.activities.filter(
                      (a) => a.selected
                    ).length;
                    const linkedPartnerLabels = [
                      ...prg.suggestedPartnerKeys
                        .map((k) => partners.find((pt) => pt.tempKey === k))
                        .filter(
                          (pt): pt is ArkasSuggestedPartner =>
                            Boolean(pt && pt.selected)
                        )
                        .map((pt) => pt.nama),
                      ...prg.existingPartnerIds
                        .map((id) => dataset.partners.find((p) => p.id === id))
                        .filter(Boolean)
                        .map((p) => p!.nama),
                    ];

                    return (
                      <div
                        key={prg.tempKey}
                        className={`rounded-xl border transition-colors ${
                          prg.selected
                            ? 'border-[#D4DDD7] bg-white'
                            : 'border-[#E5EAE7] bg-[#F8FAF9] opacity-65'
                        }`}
                      >
                        {/* Program Card Top Bar */}
                        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={prg.selected}
                              onChange={(e) =>
                                updateProgramField(
                                  prg.tempKey,
                                  'selected',
                                  e.target.checked
                                )
                              }
                              aria-label={`Pilih program ${prg.namaProgram}`}
                              className="mt-1 h-4 w-4 shrink-0 rounded border-[#CBD5E1] accent-[#14532D]"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                <span className="font-mono font-bold text-[#14532D]">
                                  {prg.kodeProgram}
                                </span>
                                <span className="text-[#94A3B8]">·</span>
                                <span className="font-medium text-[#334155]">
                                  {getPmAreaCode(prg.areaPm)}
                                </span>
                                <span className="text-[#94A3B8]">·</span>
                                <span className="font-mono font-semibold text-[#14221B]">
                                  {formatCurrencyIDR(prg.anggaranRencana)}
                                </span>
                                <span className="text-[#94A3B8]">·</span>
                                <span className="text-[#52635A]">
                                  {selectedActsCount} kegiatan
                                </span>
                              </div>
                              <p className="mt-1 text-sm font-bold text-[#14221B]">
                                {prg.namaProgram}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-xs text-[#52635A]">
                                {prg.tujuan}
                              </p>
                              {linkedPartnerLabels.length > 0 && (
                                <p className="mt-1.5 text-[11px] text-[#52635A]">
                                  Mitra terkait:{' '}
                                  <span className="font-semibold text-[#14532D]">
                                    {linkedPartnerLabels.join(', ')}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleProgramExpanded(prg.tempKey)}
                            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#D4DDD7] bg-white px-3 py-1.5 text-xs font-semibold text-[#14221B] hover:bg-[#F3F6F4]"
                          >
                            <span>
                              {isExpanded ? 'Tutup Edit' : 'Edit Program & Kegiatan'}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Expanded Editable Form + Nested Activities */}
                        {isExpanded && (
                          <div className="border-t border-[#E2E8E4] bg-[#FAFCFB] p-4 space-y-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-[#52635A]">
                                  Kode Program
                                </label>
                                <input
                                  type="text"
                                  value={prg.kodeProgram}
                                  onChange={(e) =>
                                    updateProgramField(
                                      prg.tempKey,
                                      'kodeProgram',
                                      e.target.value
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-[11px] font-semibold text-[#52635A]">
                                  Nama Program Kemitraan
                                </label>
                                <input
                                  type="text"
                                  value={prg.namaProgram}
                                  onChange={(e) =>
                                    updateProgramField(
                                      prg.tempKey,
                                      'namaProgram',
                                      e.target.value
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                              <div>
                                <label className="block text-[11px] font-semibold text-[#52635A]">
                                  Area Pembelajaran Mendalam
                                </label>
                                <select
                                  value={prg.areaPm}
                                  onChange={(e) =>
                                    updateProgramField(
                                      prg.tempKey,
                                      'areaPm',
                                      e.target.value as PmLeadershipArea
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                >
                                  {PM_LEADERSHIP_AREAS.map((area) => (
                                    <option key={area.code} value={area.label}>
                                      {area.code}. {area.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-[#52635A]">
                                  Anggaran Rencana (Rp)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={prg.anggaranRencana}
                                  onChange={(e) =>
                                    updateProgramField(
                                      prg.tempKey,
                                      'anggaranRencana',
                                      Math.max(0, Number(e.target.value) || 0)
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-[#52635A]">
                                  Penanggung Jawab
                                </label>
                                <input
                                  type="text"
                                  value={prg.penanggungJawab}
                                  onChange={(e) =>
                                    updateProgramField(
                                      prg.tempKey,
                                      'penanggungJawab',
                                      e.target.value
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-[#52635A]">
                                  Status Program
                                </label>
                                <select
                                  value={prg.status}
                                  onChange={(e) =>
                                    updateProgramField(
                                      prg.tempKey,
                                      'status',
                                      e.target.value as ProgramStatus
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                >
                                  {PROGRAM_STATUSES.filter(
                                    (st) => st !== 'Dibatalkan'
                                  ).map((st) => (
                                    <option key={st} value={st}>
                                      {st}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-[#52635A]">
                                  Waktu Pelaksanaan
                                </label>
                                <input
                                  type="text"
                                  value={prg.waktuPelaksanaan}
                                  onChange={(e) =>
                                    updateProgramField(
                                      prg.tempKey,
                                      'waktuPelaksanaan',
                                      e.target.value
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-[#52635A]">
                                  Sumber Pembiayaan
                                </label>
                                <input
                                  type="text"
                                  value={prg.sumberPembiayaan}
                                  onChange={(e) =>
                                    updateProgramField(
                                      prg.tempKey,
                                      'sumberPembiayaan',
                                      e.target.value
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-[#52635A]">
                                  Sasaran
                                </label>
                                <input
                                  type="text"
                                  value={prg.sasaran}
                                  onChange={(e) =>
                                    updateProgramField(
                                      prg.tempKey,
                                      'sasaran',
                                      e.target.value
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <label className="block text-[11px] font-semibold text-[#52635A]">
                                  Tujuan Program
                                </label>
                                <textarea
                                  rows={2}
                                  value={prg.tujuan}
                                  onChange={(e) =>
                                    updateProgramField(
                                      prg.tempKey,
                                      'tujuan',
                                      e.target.value
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-[#52635A]">
                                  Bentuk Kontribusi Mitra
                                </label>
                                <textarea
                                  rows={2}
                                  value={prg.bentukKontribusi}
                                  onChange={(e) =>
                                    updateProgramField(
                                      prg.tempKey,
                                      'bentukKontribusi',
                                      e.target.value
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* Partner linking inside Program */}
                            <div className="rounded-lg border border-[#E2E8E4] bg-white p-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-[#52635A]">
                                Tautan Mitra untuk Program Ini
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {partners
                                  .filter((pt) => pt.selected)
                                  .map((pt) => {
                                    const checked =
                                      prg.suggestedPartnerKeys.includes(
                                        pt.tempKey
                                      );
                                    return (
                                      <label
                                        key={pt.tempKey}
                                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                                          checked
                                            ? 'border-[#14532D] bg-[#ECFDF5] font-semibold text-[#14532D]'
                                            : 'border-[#D4DDD7] bg-white text-[#334155]'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() =>
                                            toggleProgramSuggestedPartner(
                                              prg.tempKey,
                                              pt.tempKey
                                            )
                                          }
                                          className="h-3.5 w-3.5 accent-[#14532D]"
                                        />
                                        <span>{pt.nama}</span>
                                      </label>
                                    );
                                  })}
                                {dataset.partners.map((ep) => {
                                  const checked =
                                    prg.existingPartnerIds.includes(ep.id);
                                  return (
                                    <label
                                      key={ep.id}
                                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                                        checked
                                          ? 'border-[#14532D] bg-[#ECFDF5] font-semibold text-[#14532D]'
                                          : 'border-[#E2E8E4] bg-[#F8FAF9] text-[#52635A]'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() =>
                                          toggleProgramExistingPartner(
                                            prg.tempKey,
                                            ep.id
                                          )
                                        }
                                        className="h-3.5 w-3.5 accent-[#14532D]"
                                      />
                                      <span>
                                        {ep.nama} ({ep.id})
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Nested Activities */}
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-[#14221B]">
                                  Kegiatan Pelaksanaan di Bawah Program Ini (
                                  {selectedActsCount}/{prg.activities.length})
                                </p>
                                <button
                                  type="button"
                                  onClick={() => addDraftActivity(prg.tempKey)}
                                  className="inline-flex items-center gap-1 rounded-md border border-[#14532D]/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#14532D] hover:bg-[#ECFDF5]"
                                >
                                  <Plus className="h-3 w-3" />
                                  <span>Tambah Kegiatan</span>
                                </button>
                              </div>

                              {prg.activities.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-[#D4DDD7] bg-white px-3 py-3 text-center text-xs text-[#64748B]">
                                  Belum ada kegiatan di bawah program ini.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {prg.activities.map((act) => (
                                    <div
                                      key={act.tempId}
                                      className={`rounded-lg border p-3 ${
                                        act.selected
                                          ? 'border-[#D4DDD7] bg-white'
                                          : 'border-[#E5EAE7] bg-[#F4F7F5] opacity-60'
                                      }`}
                                    >
                                      <div className="flex items-start gap-2.5">
                                        <input
                                          type="checkbox"
                                          checked={act.selected}
                                          onChange={(e) =>
                                            updateActivityField(
                                              prg.tempKey,
                                              act.tempId,
                                              'selected',
                                              e.target.checked
                                            )
                                          }
                                          className="mt-1.5 h-3.5 w-3.5 shrink-0 accent-[#14532D]"
                                        />
                                        <div className="min-w-0 flex-1 space-y-2">
                                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                                            <div className="sm:col-span-6">
                                              <input
                                                type="text"
                                                value={act.namaKegiatan}
                                                onChange={(e) =>
                                                  updateActivityField(
                                                    prg.tempKey,
                                                    act.tempId,
                                                    'namaKegiatan',
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Nama kegiatan"
                                                className="w-full rounded-md border border-[#D4DDD7] bg-white px-2.5 py-1 text-xs font-semibold text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                              />
                                            </div>
                                            <div className="sm:col-span-3">
                                              <input
                                                type="date"
                                                value={act.tanggalPelaksanaan}
                                                onChange={(e) =>
                                                  updateActivityField(
                                                    prg.tempKey,
                                                    act.tempId,
                                                    'tanggalPelaksanaan',
                                                    e.target.value
                                                  )
                                                }
                                                className="w-full rounded-md border border-[#D4DDD7] bg-white px-2 py-1 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                              />
                                            </div>
                                            <div className="sm:col-span-3">
                                              <select
                                                value={act.status}
                                                onChange={(e) =>
                                                  updateActivityField(
                                                    prg.tempKey,
                                                    act.tempId,
                                                    'status',
                                                    e.target
                                                      .value as ActivityStatus
                                                  )
                                                }
                                                className="w-full rounded-md border border-[#D4DDD7] bg-white px-2 py-1 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                              >
                                                {ACTIVITY_STATUSES.map((st) => (
                                                  <option key={st} value={st}>
                                                    {st}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                                            <div className="sm:col-span-5">
                                              <input
                                                type="text"
                                                value={act.lokasi}
                                                onChange={(e) =>
                                                  updateActivityField(
                                                    prg.tempKey,
                                                    act.tempId,
                                                    'lokasi',
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Lokasi pelaksanaan"
                                                className="w-full rounded-md border border-[#D4DDD7] bg-white px-2.5 py-1 text-xs text-[#334155] focus:border-[#14532D] focus:outline-none"
                                              />
                                            </div>
                                            <div className="sm:col-span-4">
                                              <input
                                                type="text"
                                                value={act.penanggungJawab}
                                                onChange={(e) =>
                                                  updateActivityField(
                                                    prg.tempKey,
                                                    act.tempId,
                                                    'penanggungJawab',
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Penanggung jawab"
                                                className="w-full rounded-md border border-[#D4DDD7] bg-white px-2.5 py-1 text-xs text-[#334155] focus:border-[#14532D] focus:outline-none"
                                              />
                                            </div>
                                            <div className="sm:col-span-3">
                                              <div className="flex items-center gap-1.5">
                                                <input
                                                  type="number"
                                                  min={0}
                                                  value={act.jumlahPeserta}
                                                  onChange={(e) =>
                                                    updateActivityField(
                                                      prg.tempKey,
                                                      act.tempId,
                                                      'jumlahPeserta',
                                                      Math.max(
                                                        0,
                                                        Number(e.target.value) ||
                                                          0
                                                      )
                                                    )
                                                  }
                                                  className="w-full rounded-md border border-[#D4DDD7] bg-white px-2 py-1 font-mono text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                                                />
                                                <span className="shrink-0 text-[11px] text-[#64748B]">
                                                  org
                                                </span>
                                              </div>
                                            </div>
                                          </div>

                                          <textarea
                                            rows={2}
                                            value={act.deskripsiPelaksanaan}
                                            onChange={(e) =>
                                              updateActivityField(
                                                prg.tempKey,
                                                act.tempId,
                                                'deskripsiPelaksanaan',
                                                e.target.value
                                              )
                                            }
                                            placeholder="Deskripsi pelaksanaan & rincian ARKAS"
                                            className="w-full rounded-md border border-[#D4DDD7] bg-white px-2.5 py-1 text-xs text-[#334155] focus:border-[#14532D] focus:outline-none"
                                          />
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeDraftActivity(
                                              prg.tempKey,
                                              act.tempId
                                            )
                                          }
                                          title="Hapus kegiatan ini dari pratinjau"
                                          className="mt-1 rounded p-1 text-[#94A3B8] hover:bg-red-50 hover:text-[#B91C1C]"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: SUGGESTED PARTNERS */}
              {activeTab === 'partners' && (
                <div className="space-y-3">
                  <p className="text-xs text-[#52635A]">
                    Mitra berikut diidentifikasi otomatis dari kegiatan ARKAS dan
                    otomatis ditautkan ke Program Kemitraan terkait. Anda dapat
                    mengedit rinciannya, menautkannya ke mitra yang sudah ada,
                    atau menghapus centang jika tidak diperlukan.
                  </p>

                  {partners.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#D4DDD7] p-8 text-center text-xs text-[#64748B]">
                      Tidak ada usulan mitra baru dari dokumen ini.
                    </div>
                  ) : (
                    partners.map((pt) => (
                      <div
                        key={pt.tempKey}
                        className={`rounded-xl border p-4 space-y-3 ${
                          pt.selected
                            ? 'border-[#D4DDD7] bg-white'
                            : 'border-[#E5EAE7] bg-[#F8FAF9] opacity-60'
                        }`}
                      >
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                          <label className="inline-flex cursor-pointer items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={pt.selected}
                              onChange={(e) =>
                                updatePartnerField(
                                  pt.tempKey,
                                  'selected',
                                  e.target.checked
                                )
                              }
                              className="h-4 w-4 rounded border-[#CBD5E1] accent-[#14532D]"
                            />
                            <span className="text-sm font-bold text-[#14221B]">
                              {pt.nama}
                            </span>
                            <span className="font-mono text-[11px] text-[#64748B]">
                              ({pt.kategori})
                            </span>
                          </label>

                          {dataset.partners.length > 0 && (
                            <select
                              value={pt.existingPartnerId}
                              onChange={(e) =>
                                updatePartnerField(
                                  pt.tempKey,
                                  'existingPartnerId',
                                  e.target.value
                                )
                              }
                              aria-label="Pilih buat baru atau tautkan mitra existing"
                              className="rounded-lg border border-[#D4DDD7] bg-[#FAFCFB] px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                            >
                              <option value="">+ Buat sebagai Mitra Baru</option>
                              {dataset.partners.map((ep) => (
                                <option key={ep.id} value={ep.id}>
                                  Tautkan ke: {ep.nama} ({ep.id})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {!pt.existingPartnerId && pt.selected && (
                          <div className="grid grid-cols-1 gap-3 border-t border-[#EEF2EF] pt-3 sm:grid-cols-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-[#52635A]">
                                Nama Mitra
                              </label>
                              <input
                                type="text"
                                value={pt.nama}
                                onChange={(e) =>
                                  updatePartnerField(
                                    pt.tempKey,
                                    'nama',
                                    e.target.value
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-[#52635A]">
                                Kategori Mitra
                              </label>
                              <select
                                value={pt.kategori}
                                onChange={(e) =>
                                  updatePartnerField(
                                    pt.tempKey,
                                    'kategori',
                                    e.target.value as PartnerCategory
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                              >
                                {PARTNER_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-[#52635A]">
                                Penanggung Jawab / Kontak
                              </label>
                              <input
                                type="text"
                                value={pt.penanggungJawab}
                                onChange={(e) =>
                                  updatePartnerField(
                                    pt.tempKey,
                                    'penanggungJawab',
                                    e.target.value
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <label className="block text-[11px] font-semibold text-[#52635A]">
                                Jenis Kontribusi
                              </label>
                              <input
                                type="text"
                                value={pt.jenisKontribusi}
                                onChange={(e) =>
                                  updatePartnerField(
                                    pt.tempKey,
                                    'jenisKontribusi',
                                    e.target.value
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: DONE */}
          {step === 'done' && (
            <div className="py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#14532D]">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h4 className="mt-4 text-lg font-bold text-[#14221B]">
                Data ARKAS Berhasil Masuk ke Aplikasi
              </h4>
              <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-[#52635A]">
                Seluruh program kemitraan, kegiatan, dan mitra yang Anda pilih
                telah tersimpan di Firebase dan saling tertaut. Anda dapat
                langsung membuka menu terkait untuk meninjau atau mengeditnya
                kapan saja.
              </p>

              <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3">
                <div className="rounded-xl border border-[#DCE5DF] bg-[#F8FBF9] p-3">
                  <p className="font-mono text-2xl font-bold text-[#14532D]">
                    {savedCounts.partnersCreated}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-[#52635A]">
                    Mitra Baru
                  </p>
                </div>
                <div className="rounded-xl border border-[#DCE5DF] bg-[#F8FBF9] p-3">
                  <p className="font-mono text-2xl font-bold text-[#14532D]">
                    {savedCounts.programsCreated}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-[#52635A]">
                    Program
                  </p>
                </div>
                <div className="rounded-xl border border-[#DCE5DF] bg-[#F8FBF9] p-3">
                  <p className="font-mono text-2xl font-bold text-[#14532D]">
                    {savedCounts.activitiesCreated}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-[#52635A]">
                    Kegiatan
                  </p>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleJumpAndClose('program')}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0F3F22]"
                >
                  <FolderKanban className="h-4 w-4" />
                  <span>Buka Program Kemitraan</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleJumpAndClose('kegiatan')}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#D4DDD7] bg-white px-4 py-2.5 text-xs font-semibold text-[#14221B] hover:bg-[#F3F6F4]"
                >
                  <CalendarCheck className="h-4 w-4 text-[#14532D]" />
                  <span>Buka Daftar Kegiatan</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleJumpAndClose('mitra')}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#D4DDD7] bg-white px-4 py-2.5 text-xs font-semibold text-[#14221B] hover:bg-[#F3F6F4]"
                >
                  <Handshake className="h-4 w-4 text-[#14532D]" />
                  <span>Buka Data Mitra</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        {step === 'preview' && (
          <div className="flex flex-col justify-between gap-3 border-t border-[#E2E8E4] bg-[#FAFCFB] px-5 py-3.5 sm:flex-row sm:items-center sm:px-6">
            <button
              type="button"
              onClick={resetModalState}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D4DDD7] bg-white px-3.5 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F1F5F2] disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Unggah File Lain</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="rounded-lg border border-[#D4DDD7] bg-white px-4 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F1F5F2] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleSaveToApp()}
                disabled={
                  saving ||
                  (selectionSummary.selectedProgramsCount === 0 &&
                    selectionSummary.newPartnersCount === 0)
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#14532D] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0F3F22] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyimpan ke Database...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>
                      Simpan ({selectionSummary.newPartnersCount} Mitra ·{' '}
                      {selectionSummary.selectedProgramsCount} Program ·{' '}
                      {selectionSummary.selectedActivitiesCount} Kegiatan)
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
