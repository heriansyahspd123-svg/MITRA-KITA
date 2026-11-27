import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookmarkPlus,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Compass,
  FolderPlus,
  History,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMitraKita } from '../context/MitraKitaContext';
import {
  AiPartnershipRecommendation,
  PartnershipAiAnalysisResult,
  SavedAiAnalysis,
} from '../types/aiAnalysis';
import { NavPageId } from '../types/mitraKita';
import {
  formatCurrencyIDR,
  formatDateID,
  getPmAreaCode,
  getTodayISO,
} from '../utils/formatters';

interface AiAnalysisPageProps {
  onNavigate?: (page: NavPageId) => void;
}

const QUICK_FOCUS_PRESETS = [
  {
    label: 'Analisis Menyeluruh',
    prompt:
      'Analisis menyeluruh ekosistem kemitraan sekolah, peluang mitra strategis baru, dan analisis dampak terhadap Pembelajaran Mendalam.',
  },
  {
    label: 'Peluang Mitra Eksternal',
    prompt:
      'Fokus mengidentifikasi celah kategori mitra yang belum tergarap (Puskesmas, UMKM, Perguruan Tinggi, Dunia Usaha, Pemerintah Desa) beserta strategi kolaborasinya.',
  },
  {
    label: 'Dampak Pembelajaran',
    prompt:
      'Fokus mengevaluasi dampak nyata program kemitraan terhadap kualitas praktik pedagogis, karakter peserta didik, dan pemanfaatan digital.',
  },
  {
    label: 'Efektivitas Anggaran RKAS',
    prompt:
      'Fokus menganalisis keselarasan alokasi anggaran rencana RKAS/BOSP dengan jumlah peserta, realisasi kegiatan, dan optimalisasi kontribusi non-tunai mitra.',
  },
] as const;

type ResultSectionTab = 'all' | 'recommendations' | 'impact' | 'action-plan';

function getScoreColor(score: number): string {
  if (score >= 75) return '#14532D';
  if (score >= 50) return '#D97706';
  return '#B91C1C';
}

function getImpactStatusTextClass(
  status: 'Tinggi' | 'Moderat' | 'Perlu Penguatan'
): string {
  if (status === 'Tinggi') return 'font-semibold text-[#15803D]';
  if (status === 'Moderat') return 'font-semibold text-[#B45309]';
  return 'font-semibold text-[#B91C1C]';
}

function getPriorityTextClass(
  prio: 'Tinggi' | 'Sedang' | 'Strategis'
): string {
  if (prio === 'Tinggi') return 'font-semibold text-[#B91C1C]';
  if (prio === 'Strategis') return 'font-semibold text-[#14532D]';
  return 'font-semibold text-[#B45309]';
}

export const AiAnalysisPage: React.FC<AiAnalysisPageProps> = ({
  onNavigate,
}) => {
  const {
    dataset,
    session,
    schoolNameSuggestions,
    addPartner,
    getNextPartnerId,
    addProgram,
    getNextProgramCode,
    addSupervisorNote,
    saveAiAnalysis,
    deleteAiAnalysis,
    notify,
  } = useMitraKita();

  const [schoolFilter, setSchoolFilter] = useState('ALL');
  const [focusPrompt, setFocusPrompt] = useState<string>(
    QUICK_FOCUS_PRESETS[0].prompt
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(
    null
  );
  const [transientResult, setTransientResult] =
    useState<PartnershipAiAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<ResultSectionTab>('all');

  const [savedPartnerIndexes, setSavedPartnerIndexes] = useState<Set<number>>(
    () => new Set()
  );
  const [savedProgramIndexes, setSavedProgramIndexes] = useState<Set<number>>(
    () => new Set()
  );
  const [savedCoachingNote, setSavedCoachingNote] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Sync selectedAnalysisId to latest saved record in Firestore if available
  useEffect(() => {
    if (dataset.aiAnalyses.length === 0) {
      setSelectedAnalysisId(null);
      return;
    }
    if (
      !selectedAnalysisId ||
      !dataset.aiAnalyses.some((a) => a.id === selectedAnalysisId)
    ) {
      setSelectedAnalysisId(dataset.aiAnalyses[0].id);
    }
  }, [dataset.aiAnalyses, selectedAnalysisId]);

  const activeSavedAnalysis: SavedAiAnalysis | null = useMemo(() => {
    if (!selectedAnalysisId) return dataset.aiAnalyses[0] ?? null;
    return (
      dataset.aiAnalyses.find((a) => a.id === selectedAnalysisId) ??
      dataset.aiAnalyses[0] ??
      null
    );
  }, [dataset.aiAnalyses, selectedAnalysisId]);

  const result: PartnershipAiAnalysisResult | null =
    transientResult ?? activeSavedAnalysis;

  // Scoped dataset slice
  const scopedData = useMemo(() => {
    const matchSchool = (name?: string) =>
      schoolFilter === 'ALL' || (name || '') === schoolFilter;

    const partners = dataset.partners.filter((p) => matchSchool(p.namaSekolah));
    const programs = dataset.programs.filter((p) => matchSchool(p.namaSekolah));
    const activities = dataset.activities.filter((a) =>
      matchSchool(a.namaSekolah)
    );
    const evidences = dataset.evidences.filter((e) =>
      matchSchool(e.namaSekolah)
    );
    const evaluations = dataset.evaluations.filter((e) =>
      matchSchool(e.namaSekolah)
    );

    const totalBudget = programs.reduce(
      (sum, p) => sum + (p.anggaranRencana || 0),
      0
    );
    const totalParticipants = activities.reduce(
      (sum, a) => sum + (a.jumlahPeserta || 0),
      0
    );

    return {
      partners,
      programs,
      activities,
      evidences,
      evaluations,
      totalBudget,
      totalParticipants,
    };
  }, [dataset, schoolFilter]);

  const resolvedSchoolName =
    schoolFilter !== 'ALL'
      ? schoolFilter
      : dataset.schoolProfile.namaSekolah ||
        schoolNameSuggestions[0] ||
        'Sekolah Binaan';

  const handleRunAnalysis = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const partnerNameMap = new Map(
        scopedData.partners.map((p) => [p.id, `${p.nama} (${p.kategori})`])
      );
      const programNameMap = new Map(
        scopedData.programs.map((p) => [p.id, p.namaProgram])
      );

      // Category distribution summary
      const categoryCounts: Record<string, number> = {};
      for (const p of scopedData.partners) {
        categoryCounts[p.kategori] = (categoryCounts[p.kategori] || 0) + 1;
      }

      // PM Area distribution summary
      const pmAreaCounts: Record<string, number> = {
        'Praktik Pedagogis': 0,
        'Lingkungan Belajar': 0,
        'Pemanfaatan Digital': 0,
        'Kemitraan Pembelajaran': 0,
      };
      for (const prg of scopedData.programs) {
        pmAreaCounts[prg.areaPm] = (pmAreaCounts[prg.areaPm] || 0) + 1;
      }

      const snapshot = {
        ringkasanKuantitatif: {
          totalMitra: scopedData.partners.length,
          mitraAktif: scopedData.partners.filter((p) => p.status === 'Aktif')
            .length,
          totalProgram: scopedData.programs.length,
          programSelesai: scopedData.programs.filter(
            (p) => p.status === 'Selesai'
          ).length,
          programBerjalan: scopedData.programs.filter(
            (p) => p.status === 'Sedang Berjalan'
          ).length,
          totalAnggaranRencana: scopedData.totalBudget,
          totalKegiatan: scopedData.activities.length,
          kegiatanSelesai: scopedData.activities.filter(
            (a) => a.status === 'Selesai'
          ).length,
          totalPesertaKegiatan: scopedData.totalParticipants,
          totalBuktiDokumentasi: scopedData.evidences.length,
          totalEvaluasiMonitoring: scopedData.evaluations.length,
          distribusiKategoriMitra: categoryCounts,
          distribusiAreaPM: pmAreaCounts,
        },
        daftarMitra: scopedData.partners.slice(0, 40).map((p) => ({
          id: p.id,
          sekolah: p.namaSekolah,
          nama: p.nama,
          kategori: p.kategori,
          kontribusi: p.jenisKontribusi,
          potensi: p.potensiKerjaSama,
          status: p.status,
        })),
        daftarProgram: scopedData.programs.slice(0, 40).map((prg) => ({
          kode: prg.kodeProgram,
          sekolah: prg.namaSekolah,
          nama: prg.namaProgram,
          areaPm: prg.areaPm,
          mitra: prg.partnerIds.map((id) => partnerNameMap.get(id) ?? id),
          sasaran: prg.sasaran,
          anggaran: prg.anggaranRencana,
          targetHasil: prg.targetHasil,
          status: prg.status,
        })),
        daftarKegiatan: scopedData.activities.slice(0, 40).map((act) => ({
          nama: act.namaKegiatan,
          program: programNameMap.get(act.programId) ?? act.programId,
          tanggal: act.tanggalPelaksanaan,
          peserta: act.jumlahPeserta,
          hasil: act.hasilKegiatan,
          kendala: act.kendala,
          status: act.status,
        })),
        hasilMonitoring: scopedData.evaluations.slice(0, 15).map((ev) => ({
          periode: ev.periode,
          tanggal: ev.tanggalPenilaian,
          nilaiAkhir: ev.nilaiAkhir,
          kategori: ev.kategoriHasil,
          temuan: ev.temuanMonitoring,
          kekuatan: ev.kekuatan,
          kelemahan: ev.kelemahan,
          rekomendasi: ev.rekomendasi,
        })),
      };

      const res = await fetch('/api/ai/partnership-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolScope:
            schoolFilter === 'ALL'
              ? `Semua Sekolah Binaan (${schoolNameSuggestions.length || 1} sekolah)`
              : schoolFilter,
          tahunAjaran: dataset.schoolProfile.tahunAjaran || '2026/2027',
          focusPrompt: focusPrompt.trim(),
          snapshot,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as Partial<
        PartnershipAiAnalysisResult & { error?: string }
      >;
      if (!res.ok) {
        throw new Error(
          data?.error || 'Terjadi kesalahan saat menjalankan Analisis AI.'
        );
      }

      const parsedResult = data as PartnershipAiAnalysisResult;
      setTransientResult(parsedResult);
      setActiveTab('all');
      setSavedPartnerIndexes(new Set());
      setSavedProgramIndexes(new Set());
      setSavedCoachingNote(false);

      const savedId = await saveAiAnalysis(
        parsedResult,
        schoolFilter === 'ALL' ? '' : schoolFilter,
        focusPrompt.trim()
      );
      if (savedId) {
        setSelectedAnalysisId(savedId);
        setTransientResult(null);
      }

      notify(
        'success',
        'Analisis AI & Dampak tersimpan',
        'Hasil analisis otomatis tercatat di database dan siap dicetak di menu Laporan.'
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal terhubung ke layanan Analisis AI.';
      setErrorMsg(msg);
      notify('error', 'Analisis AI gagal', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecommendationAsPartner = (
    rec: AiPartnershipRecommendation,
    idx: number
  ) => {
    const nextId = getNextPartnerId();
    const ok = addPartner({
      id: nextId,
      namaSekolah: resolvedSchoolName,
      nama: rec.calonMitra,
      kategori: rec.kategoriMitra,
      penanggungJawab:
        dataset.schoolProfile.kepalaSekolah || 'Koordinator Kemitraan Sekolah',
      telepon: '',
      alamat: dataset.schoolProfile.alamatSekolah || '',
      jenisKontribusi: rec.bentukKolaborasi,
      potensiKerjaSama: rec.estimasiDampak,
      status: 'Dalam Penjajakan',
      catatan: `Rekomendasi AI (${rec.judul}) · Area PM: ${rec.areaPm}. ${rec.alasanStrategis}`,
    });
    if (ok) {
      setSavedPartnerIndexes((prev) => new Set(prev).add(idx));
    }
  };

  const handleSaveRecommendationAsProgram = (
    rec: AiPartnershipRecommendation,
    idx: number
  ) => {
    const nextCode = getNextProgramCode();
    const ok = addProgram({
      namaSekolah: resolvedSchoolName,
      kodeProgram: nextCode,
      namaProgram: rec.judul,
      latarBelakang: rec.alasanStrategis,
      tujuan: rec.estimasiDampak,
      areaPm: rec.areaPm,
      partnerIds: [],
      sasaran: `Peserta didik & pendidik ${resolvedSchoolName}`,
      bentukKontribusi: rec.bentukKolaborasi,
      strategiPelaksanaan: `Penjajakan dan pelaksanaan kolaborasi bersama ${rec.calonMitra} (${rec.kategoriMitra}) melalui ${rec.bentukKolaborasi}`,
      waktuPelaksanaan: `Tahun Ajaran ${dataset.schoolProfile.tahunAjaran || '2026/2027'}`,
      penanggungJawab:
        dataset.schoolProfile.kepalaSekolah || 'Tim Pengembang Kemitraan',
      sumberPembiayaan: 'RKAS / BOSP & Dukungan Mitra',
      anggaranRencana: 0,
      indikatorKeberhasilan: `Terlaksananya program bersama ${rec.calonMitra} dengan bukti dokumentasi lengkap.`,
      targetHasil: rec.estimasiDampak,
      status: 'Direncanakan',
    });
    if (ok) {
      setSavedProgramIndexes((prev) => new Set(prev).add(idx));
    }
  };

  const handleSaveToSupervisorNotes = () => {
    if (!result) return;
    const topRecs = result.partnershipRecommendations
      .slice(0, 3)
      .map((r, i) => `${i + 1}. ${r.judul} (${r.calonMitra} — ${r.areaPm})`)
      .join(' | ');

    const ok = addSupervisorNote({
      namaSekolah: resolvedSchoolName,
      targetType: 'SEKOLAH',
      tanggal: getTodayISO(),
      pengawasNama:
        dataset.schoolProfile.namaPengawas ||
        session?.namaPengawas ||
        'Pengawas Sekolah',
      catatanPembinaan: `[Analisis AI · Skor Kematangan ${result.maturityScore}/100 · Indeks Dampak ${result.impactAnalysis.overallImpactIndex}/100] ${result.executiveSummary}`,
      rekomendasi: `Prioritas Rekomendasi Kemitraan: ${topRecs}`,
    });

    if (ok) {
      setSavedCoachingNote(true);
    }
  };

  const handleCopySummary = async () => {
    if (!result) return;
    const lines = [
      `HASIL ANALISIS AI & DAMPAK KEMITRAAN — MITRA KITA`,
      `Cakupan: ${result.schoolScope}`,
      `Skor Kematangan Kemitraan: ${result.maturityScore}/100 (${result.maturityLevel})`,
      `Indeks Dampak Pembelajaran: ${result.impactAnalysis.overallImpactIndex}/100`,
      ``,
      `RINGKASAN EKSEKUTIF:`,
      result.executiveSummary,
      ``,
      `REKOMENDASI KEMITRAAN STRATEGIS:`,
      ...result.partnershipRecommendations.map(
        (r, i) =>
          `${i + 1}. [${r.prioritas}] ${r.judul} — Calon Mitra: ${r.calonMitra} (${r.kategoriMitra} | ${r.areaPm})\n   Kolaborasi: ${r.bentukKolaborasi}\n   Estimasi Dampak: ${r.estimasiDampak}`
      ),
      ``,
      `ANALISIS DAMPAK:`,
      ...result.impactAnalysis.dimensions.map(
        (d) => `- ${d.dimensi}: ${d.skor}/100 (${d.status}) — ${d.analisis}`
      ),
      ``,
      `Efektivitas Anggaran: ${result.impactAnalysis.budgetEfficiencyNote}`,
      `Dampak Peserta Didik: ${result.impactAnalysis.studentOutcomeNarrative}`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedSummary(true);
      notify('success', 'Ringkasan analisis berhasil disalin ke clipboard');
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      notify('error', 'Gagal menyalin teks ke clipboard');
    }
  };

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.impactAnalysis.dimensions.map((d) => ({
      name:
        d.dimensi.length > 26 ? `${d.dimensi.slice(0, 26)}…` : d.dimensi,
      fullName: d.dimensi,
      skor: d.skor,
      status: d.status,
    }));
  }, [result]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-[#5B6F65]">
            Kecerdasan buatan berbasis data nyata untuk memetakan peluang mitra
            baru, mengevaluasi dampak pembelajaran, dan menyusun pembinaan.
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#11221A]">
            Analisis AI, Rekomendasi &amp; Dampak
          </h2>
        </div>

        <button
          type="button"
          onClick={handleRunAnalysis}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14532D] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0E3F22] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Sedang Menganalisis...</span>
            </>
          ) : result ? (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Analisis Ulang dengan AI</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Jalankan Analisis AI</span>
            </>
          )}
        </button>
      </div>

      {/* Live Data Scope Summary Strip */}
      <div className="grid grid-cols-2 divide-y divide-[#E7EFEA] overflow-hidden rounded-2xl border border-[#DFE8E2] bg-white shadow-[0_1px_3px_rgba(16,38,26,0.04)] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-[#5B6F65]">
            Mitra Dianalisis
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#11221A] tabular-nums">
            {scopedData.partners.length}
          </div>
          <div className="mt-0.5 text-[11.5px] text-[#5B6F65]">
            {scopedData.partners.filter((p) => p.status === 'Aktif').length}{' '}
            mitra aktif
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-[#5B6F65]">
            Program &amp; Anggaran
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#14532D] tabular-nums">
            {scopedData.programs.length}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11.5px] text-[#5B6F65] tabular-nums">
            {formatCurrencyIDR(scopedData.totalBudget)}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-[#5B6F65]">
            Kegiatan &amp; Peserta
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#11221A] tabular-nums">
            {scopedData.activities.length}
          </div>
          <div className="mt-0.5 text-[11.5px] text-[#5B6F65] tabular-nums">
            {scopedData.totalParticipants.toLocaleString('id-ID')} peserta
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-[#5B6F65]">
            Bukti &amp; Evaluasi
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#11221A] tabular-nums">
            {scopedData.evidences.length} / {scopedData.evaluations.length}
          </div>
          <div className="mt-0.5 text-[11.5px] text-[#5B6F65]">
            Dokumen / Monitoring
          </div>
        </div>
      </div>

      {/* Scope & Focus Controls */}
      <div className="rounded-2xl border border-[#DFE8E2] bg-white p-5 shadow-[0_1px_3px_rgba(16,38,26,0.04)] space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label className="mb-1.5 block text-xs font-semibold text-[#11221A]">
              Cakupan Sekolah Analisis
            </label>
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-[#D4E0D9] bg-[#FAFDFB] px-3.5 py-2.5 text-sm text-[#11221A] focus:border-[#14532D] focus:bg-white focus:outline-none"
            >
              <option value="ALL">
                Semua Sekolah Binaan ({schoolNameSuggestions.length || 1})
              </option>
              {schoolNameSuggestions.map((school) => (
                <option key={school} value={school}>
                  {school}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-8">
            <label className="mb-1.5 block text-xs font-semibold text-[#11221A]">
              Fokus Pertanyaan / Prioritas Analisis Pengawas
            </label>
            <input
              type="text"
              value={focusPrompt}
              onChange={(e) => setFocusPrompt(e.target.value)}
              disabled={loading}
              placeholder="Contoh: Fokuskan rekomendasi mitra untuk peningkatan literasi & pemanfaatan digital..."
              className="w-full rounded-xl border border-[#D4E0D9] bg-[#FAFDFB] px-3.5 py-2.5 text-sm text-[#11221A] placeholder:text-[#7D9186] focus:border-[#14532D] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-medium text-[#5B6F65]">
            Preset fokus cepat:
          </span>
          {QUICK_FOCUS_PRESETS.map((preset) => {
            const isSelected = focusPrompt === preset.prompt;
            return (
              <button
                key={preset.label}
                type="button"
                disabled={loading}
                onClick={() => setFocusPrompt(preset.prompt)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'border-[#14532D] bg-[#EDF6F0] font-semibold text-[#14532D]'
                    : 'border-[#DCE5DF] bg-white text-[#4A5E54] hover:border-[#B6C9BD] hover:bg-[#F5FAF7]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium leading-relaxed text-[#B91C1C]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {dataset.aiAnalyses.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#EEF3F0] pt-3.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#4A5E54]">
              <History className="h-3.5 w-3.5 text-[#14532D]" />
              <span className="font-semibold text-[#11221A]">
                Riwayat Tersimpan ({dataset.aiAnalyses.length}):
              </span>
              <select
                value={activeSavedAnalysis?.id ?? ''}
                onChange={(e) => {
                  setTransientResult(null);
                  setSelectedAnalysisId(e.target.value);
                  setSavedPartnerIndexes(new Set());
                  setSavedProgramIndexes(new Set());
                  setSavedCoachingNote(false);
                }}
                className="rounded-lg border border-[#D4E0D9] bg-[#FAFDFB] px-2.5 py-1.5 text-xs font-medium text-[#11221A] focus:border-[#14532D] focus:outline-none"
              >
                {dataset.aiAnalyses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatDateID(item.generatedAt.slice(0, 10))} ·{' '}
                    {item.schoolScope} (Skor {item.maturityScore}/100 · Dampak{' '}
                    {item.impactAnalysis.overallImpactIndex}/100)
                  </option>
                ))}
              </select>
            </div>
            {activeSavedAnalysis && (
              <button
                type="button"
                onClick={() => {
                  setTransientResult(null);
                  deleteAiAnalysis(activeSavedAnalysis.id);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E2EAE5] bg-white px-2.5 py-1.5 text-xs font-medium text-[#5B6F65] hover:border-red-200 hover:bg-red-50 hover:text-[#B91C1C]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Hapus Riwayat Ini</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty State Before First Run */}
      {!result && !loading && (
        <div className="rounded-2xl border border-[#DFE8E2] bg-white p-8 text-center shadow-[0_1px_3px_rgba(16,38,26,0.04)] sm:p-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EDF6F0] text-[#14532D]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-[#11221A]">
            Siap Menganalisis Ekosistem Kemitraan Sekolah
          </h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-[#5B6F65]">
            AI akan membaca seluruh data mitra, program kemitraan, realisasi
            kegiatan, bukti dokumentasi, dan hasil monitoring pada cakupan
            sekolah terpilih untuk menghasilkan tiga keluaran utama secara
            otomatis:
          </p>
          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-[#E6EEE9] bg-[#FAFDFB] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#14532D]">
                <Compass className="h-4 w-4" />
                <span>1. Diagnosis &amp; Skor Kematangan</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#5B6F65]">
                Menilai tingkat kematangan ekosistem kemitraan (0–100), kekuatan
                utama, serta celah prioritas berdasarkan 4 Area PM.
              </p>
            </div>
            <div className="rounded-xl border border-[#E6EEE9] bg-[#FAFDFB] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#14532D]">
                <Target className="h-4 w-4" />
                <span>2. Rekomendasi Kemitraan Baru</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#5B6F65]">
                Menyarankan calon mitra &amp; program strategis yang bisa
                langsung disimpan 1-klik ke Data Mitra atau Program Kemitraan.
              </p>
            </div>
            <div className="rounded-xl border border-[#E6EEE9] bg-[#FAFDFB] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#14532D]">
                <TrendingUp className="h-4 w-4" />
                <span>3. Analisis Dampak &amp; Tindak Lanjut</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#5B6F65]">
                Mengukur dampak pada kualitas belajar, karakter, digitalisasi,
                efektivitas anggaran RKAS, serta rencana pembinaan Pengawas.
              </p>
            </div>
          </div>
          <div className="mt-7">
            <button
              type="button"
              onClick={handleRunAnalysis}
              className="inline-flex items-center gap-2 rounded-xl bg-[#14532D] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0E3F22]"
            >
              <Sparkles className="h-4 w-4" />
              <span>Mulai Analisis AI Sekarang</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton State */}
      {loading && (
        <div className="rounded-2xl border border-[#DFE8E2] bg-white p-10 text-center shadow-[0_1px_3px_rgba(16,38,26,0.04)]">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#14532D]" />
          <h3 className="mt-4 text-base font-bold text-[#11221A]">
            Sedang Memproses Analisis AI &amp; Pemetaan Dampak...
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[#5B6F65]">
            Mengevaluasi {scopedData.partners.length} mitra,{' '}
            {scopedData.programs.length} program kemitraan, dan{' '}
            {scopedData.activities.length} kegiatan pada{' '}
            <strong className="text-[#11221A]">
              {schoolFilter === 'ALL' ? 'seluruh sekolah binaan' : schoolFilter}
            </strong>
            . Mohon tunggu sekitar 10–20 detik.
          </p>
        </div>
      )}

      {/* Full AI Analysis Results */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Result Navigation Tabs & Quick Utility Actions */}
          <div className="flex flex-col justify-between gap-3 border-b border-[#DFE8E2] pb-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'Semua Hasil' },
                  {
                    id: 'recommendations',
                    label: `Rekomendasi Kemitraan (${result.partnershipRecommendations.length})`,
                  },
                  {
                    id: 'impact',
                    label: `Analisis Dampak (${result.impactAnalysis.overallImpactIndex}/100)`,
                  },
                  {
                    id: 'action-plan',
                    label: `Rencana Pembinaan (${result.supervisorActionPlan.length})`,
                  },
                ] as { id: ResultSectionTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#14532D] text-white shadow-sm'
                      : 'bg-white text-[#4A5E54] border border-[#DCE5DF] hover:bg-[#F5FAF7]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E0D9] bg-white px-3.5 py-2 text-xs font-semibold text-[#11221A] hover:bg-[#F5FAF7] whitespace-nowrap"
              >
                {copiedSummary ? (
                  <Check className="h-3.5 w-3.5 text-[#15803D]" />
                ) : (
                  <ClipboardCopy className="h-3.5 w-3.5 text-[#14532D]" />
                )}
                <span>{copiedSummary ? 'Tersalin' : 'Salin Ringkasan'}</span>
              </button>
              <button
                type="button"
                onClick={handleSaveToSupervisorNotes}
                disabled={savedCoachingNote}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#14532D]/30 bg-[#EDF6F0] px-3.5 py-2 text-xs font-semibold text-[#14532D] hover:bg-[#DCFCE7] disabled:opacity-65 whitespace-nowrap"
              >
                {savedCoachingNote ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <BookmarkPlus className="h-3.5 w-3.5" />
                )}
                <span>
                  {savedCoachingNote
                    ? 'Tersimpan di Catatan Pembinaan'
                    : 'Simpan ke Catatan Pembinaan'}
                </span>
              </button>
            </div>
          </div>

          {/* SECTION 1: Executive Summary & Maturity Scores */}
          {activeTab === 'all' && (
            <section className="overflow-hidden rounded-2xl border border-[#DFE8E2] bg-white shadow-[0_1px_3px_rgba(16,38,26,0.04)]">
              <div className="grid grid-cols-1 divide-y divide-[#E7EFEA] lg:grid-cols-12 lg:divide-x lg:divide-y-0">
                {/* Score Gauges */}
                <div className="grid grid-cols-2 divide-x divide-[#E7EFEA] bg-[#FAFDFB] lg:col-span-4 lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
                  <div className="p-5">
                    <div className="text-xs font-medium text-[#5B6F65]">
                      Skor Kematangan Kemitraan
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-mono text-3xl font-bold text-[#14532D] tabular-nums">
                        {result.maturityScore}
                      </span>
                      <span className="font-mono text-xs text-[#6B7F74]">
                        / 100
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-[#11221A]">
                      Tahap: {result.maturityLevel}
                    </div>
                    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#E5EEE8]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#14532D] to-[#16A34A]"
                        style={{
                          width: `${Math.min(100, Math.max(4, result.maturityScore))}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="text-xs font-medium text-[#5B6F65]">
                      Indeks Dampak Pembelajaran
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span
                        className="font-mono text-3xl font-bold tabular-nums"
                        style={{
                          color: getScoreColor(
                            result.impactAnalysis.overallImpactIndex
                          ),
                        }}
                      >
                        {result.impactAnalysis.overallImpactIndex}
                      </span>
                      <span className="font-mono text-xs text-[#6B7F74]">
                        / 100
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-[#5B6F65]">
                      Cakupan: {result.schoolScope}
                    </div>
                    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#E5EEE8]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(4, result.impactAnalysis.overallImpactIndex))}%`,
                          backgroundColor: getScoreColor(
                            result.impactAnalysis.overallImpactIndex
                          ),
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Executive Narrative + Strengths/Gaps */}
                <div className="p-6 lg:col-span-8 space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-[#14532D]">
                      Ringkasan Eksekutif Analisis AI
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#11221A]">
                      {result.executiveSummary}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-5 border-t border-[#EEF3F0] pt-5 sm:grid-cols-2">
                    <div>
                      <h4 className="text-xs font-bold tracking-wide text-[#15803D] uppercase">
                        Kekuatan Utama Ekosistem
                      </h4>
                      <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-[#2C3F35]">
                        {result.keyStrengths.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#16A34A]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold tracking-wide text-[#B45309] uppercase">
                        Celah &amp; Tantangan Prioritas
                      </h4>
                      <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-[#2C3F35]">
                        {result.priorityGaps.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D97706]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 2: Rekomendasi Kemitraan Strategis */}
          {(activeTab === 'all' || activeTab === 'recommendations') && (
            <section className="space-y-3.5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[#11221A]">
                    Rekomendasi Kemitraan Strategis
                  </h3>
                  <p className="text-xs text-[#5B6F65]">
                    Usulan mitra &amp; kolaborasi baru berbasis celah data
                    sekolah. Anda dapat menyimpannya langsung ke Data Mitra atau
                    Program Kemitraan.
                  </p>
                </div>
                {onNavigate && (
                  <div className="flex items-center gap-3 text-xs font-semibold text-[#14532D]">
                    <button
                      type="button"
                      onClick={() => onNavigate('mitra')}
                      className="hover:underline"
                    >
                      Buka Data Mitra →
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('program')}
                      className="hover:underline"
                    >
                      Buka Program →
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {result.partnershipRecommendations.map((rec, idx) => {
                  const partnerSaved = savedPartnerIndexes.has(idx);
                  const programSaved = savedProgramIndexes.has(idx);
                  return (
                    <article
                      key={`${rec.judul}-${idx}`}
                      className="flex flex-col justify-between rounded-2xl border border-[#DFE8E2] bg-white p-5 shadow-[0_1px_3px_rgba(16,38,26,0.04)] transition-all hover:border-[#C5D6CB]"
                    >
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                          <span className={getPriorityTextClass(rec.prioritas)}>
                            Prioritas {rec.prioritas}
                          </span>
                          <span aria-hidden="true" className="text-[#A8B8AF]">
                            ·
                          </span>
                          <span className="font-mono font-semibold text-[#14532D]">
                            Area {getPmAreaCode(rec.areaPm)}
                          </span>
                          <span aria-hidden="true" className="text-[#A8B8AF]">
                            ·
                          </span>
                          <span className="font-medium text-[#4A5E54]">
                            {rec.kategoriMitra}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-[15px] font-bold leading-snug text-[#11221A]">
                            {rec.judul}
                          </h4>
                          <p className="mt-1 text-xs font-semibold text-[#14532D]">
                            Calon Mitra: {rec.calonMitra}
                          </p>
                        </div>

                        <div className="space-y-2 border-t border-[#EEF3F0] pt-3 text-xs leading-relaxed text-[#3D5247]">
                          <p>
                            <strong className="text-[#11221A]">
                              Alasan Strategis:
                            </strong>{' '}
                            {rec.alasanStrategis}
                          </p>
                          <p>
                            <strong className="text-[#11221A]">
                              Bentuk Kolaborasi:
                            </strong>{' '}
                            {rec.bentukKolaborasi}
                          </p>
                          <p>
                            <strong className="text-[#11221A]">
                              Estimasi Dampak:
                            </strong>{' '}
                            {rec.estimasiDampak}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#EEF3F0] pt-3.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveRecommendationAsPartner(rec, idx)
                          }
                          disabled={partnerSaved}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4E0D9] bg-white px-3 py-1.5 text-xs font-semibold text-[#11221A] hover:border-[#14532D]/40 hover:bg-[#EDF6F0] hover:text-[#14532D] disabled:border-[#BBF7D0] disabled:bg-[#ECFDF5] disabled:text-[#15803D]"
                        >
                          {partnerSaved ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <UserPlus className="h-3.5 w-3.5 text-[#14532D]" />
                          )}
                          <span>
                            {partnerSaved
                              ? 'Tersimpan di Data Mitra'
                              : '+ Simpan ke Data Mitra'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveRecommendationAsProgram(rec, idx)
                          }
                          disabled={programSaved}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4E0D9] bg-white px-3 py-1.5 text-xs font-semibold text-[#11221A] hover:border-[#14532D]/40 hover:bg-[#EDF6F0] hover:text-[#14532D] disabled:border-[#BBF7D0] disabled:bg-[#ECFDF5] disabled:text-[#15803D]"
                        >
                          {programSaved ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <FolderPlus className="h-3.5 w-3.5 text-[#14532D]" />
                          )}
                          <span>
                            {programSaved
                              ? 'Tersimpan di Program'
                              : '+ Jadikan Program'}
                          </span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* SECTION 3: Analisis Dampak */}
          {(activeTab === 'all' || activeTab === 'impact') && (
            <section className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#11221A]">
                  Analisis Dampak Kemitraan (4 Dimensi)
                </h3>
                <p className="text-xs text-[#5B6F65]">
                  Evaluasi dampak implementasi kemitraan terhadap mutu
                  pembelajaran, karakter, digitalisasi, dan tata kelola
                  anggaran.
                </p>
              </div>

              {/* Impact Bar Chart */}
              {chartData.length > 0 && (
                <div className="rounded-2xl border border-[#DFE8E2] bg-white p-5 shadow-[0_1px_3px_rgba(16,38,26,0.04)]">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#11221A]">
                      Profil Skor Dampak per Dimensi (Skala 0–100)
                    </span>
                    <span className="font-mono text-xs font-bold text-[#14532D] tabular-nums">
                      Indeks Rata-rata: {result.impactAnalysis.overallImpactIndex}/100
                    </span>
                  </div>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 4, right: 24, left: 10, bottom: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="#E7EFEA"
                        />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: '#5B6F65' }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={175}
                          tick={{ fontSize: 11, fill: '#11221A' }}
                        />
                        <Tooltip
                          formatter={(val: unknown) => [
                            `${val} / 100`,
                            'Skor Dampak',
                          ]}
                          labelFormatter={(_label, payload) =>
                            payload?.[0]?.payload?.fullName || ''
                          }
                          contentStyle={{
                            borderRadius: '12px',
                            borderColor: '#D4E0D9',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="skor" radius={[0, 6, 6, 0]} barSize={22}>
                          {chartData.map((entry, idx) => (
                            <Cell
                              key={`cell-${idx}`}
                              fill={getScoreColor(entry.skor)}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 4 Dimension Breakdown Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {result.impactAnalysis.dimensions.map((dim, idx) => (
                  <div
                    key={`${dim.dimensi}-${idx}`}
                    className="rounded-2xl border border-[#DFE8E2] bg-white p-5 shadow-[0_1px_3px_rgba(16,38,26,0.04)] space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-[#11221A]">
                          {dim.dimensi}
                        </h4>
                        <span
                          className={`text-xs ${getImpactStatusTextClass(dim.status)}`}
                        >
                          Dampak {dim.status}
                        </span>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <span
                          className="text-xl font-bold"
                          style={{ color: getScoreColor(dim.skor) }}
                        >
                          {dim.skor}
                        </span>
                        <span className="text-xs text-[#6B7F74]">/100</span>
                      </div>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EAF1EC]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(4, dim.skor))}%`,
                          backgroundColor: getScoreColor(dim.skor),
                        }}
                      />
                    </div>

                    <div className="space-y-2 text-xs leading-relaxed text-[#3D5247]">
                      <p>{dim.analisis}</p>
                      <p className="rounded-lg bg-[#F7FBF8] px-3 py-2 text-[#2C3F35]">
                        <strong className="text-[#11221A]">
                          Bukti Data:
                        </strong>{' '}
                        {dim.buktiPendukung}
                      </p>
                      <p>
                        <strong className="text-[#14532D]">
                          Saran Penguatan:
                        </strong>{' '}
                        {dim.saranPeningkatan}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Budget Efficiency & Student Outcomes */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[#DFE8E2] bg-white p-5 shadow-[0_1px_3px_rgba(16,38,26,0.04)]">
                  <h4 className="text-xs font-bold tracking-wide text-[#14532D] uppercase">
                    Analisis Efektivitas Anggaran &amp; Sumber Daya
                  </h4>
                  <p className="mt-2 text-xs leading-relaxed text-[#2C3F35]">
                    {result.impactAnalysis.budgetEfficiencyNote}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#DFE8E2] bg-white p-5 shadow-[0_1px_3px_rgba(16,38,26,0.04)]">
                  <h4 className="text-xs font-bold tracking-wide text-[#14532D] uppercase">
                    Dampak terhadap Pengalaman Belajar Peserta Didik
                  </h4>
                  <p className="mt-2 text-xs leading-relaxed text-[#2C3F35]">
                    {result.impactAnalysis.studentOutcomeNarrative}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 4: Rencana Pembinaan Pengawas */}
          {(activeTab === 'all' || activeTab === 'action-plan') && (
            <section className="overflow-hidden rounded-2xl border border-[#DFE8E2] bg-white shadow-[0_1px_3px_rgba(16,38,26,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7EFEA] px-5 py-4">
                <div>
                  <h3 className="text-sm font-bold text-[#11221A]">
                    Rencana Tindak Lanjut Pembinaan Pengawas Sekolah
                  </h3>
                  <p className="text-xs text-[#5B6F65]">
                    Langkah pendampingan konkret yang direkomendasikan AI untuk
                    siklus pembinaan berikutnya.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-[#EEF3F0]">
                {result.supervisorActionPlan.map((step, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-[#F7FBF8] md:grid-cols-12 md:items-start"
                  >
                    <div className="md:col-span-5">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#EDF6F0] font-mono text-[11px] font-bold text-[#14532D]">
                          {idx + 1}
                        </span>
                        <p className="text-xs font-semibold leading-relaxed text-[#11221A]">
                          {step.langkah}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-[#4A5E54] md:col-span-2">
                      <div className="text-[10.5px] font-medium text-[#7D9186] md:hidden">
                        Target Waktu
                      </div>
                      <span className="font-mono font-medium text-[#14532D]">
                        {step.targetWaktu}
                      </span>
                    </div>
                    <div className="text-xs text-[#4A5E54] md:col-span-2">
                      <div className="text-[10.5px] font-medium text-[#7D9186] md:hidden">
                        Pihak Terlibat
                      </div>
                      <span>{step.pihakTerlibat}</span>
                    </div>
                    <div className="text-xs leading-relaxed text-[#3D5247] md:col-span-3">
                      <div className="text-[10.5px] font-medium text-[#7D9186] md:hidden">
                        Indikator Keberhasilan
                      </div>
                      <span>{step.indikatorKeberhasilan}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
