import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  Download,
  FileDown,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  PenLine,
  Printer,
  RotateCcw,
  Save,
} from 'lucide-react';
import { FieldExampleHint } from '../components/FieldExampleHint';
import { Modal } from '../components/Modal';
import { useMitraKita } from '../context/MitraKitaContext';
import { SETTINGS_FIELD_EXAMPLES } from '../data/fieldExamples';
import {
  PARTNER_CATEGORIES,
  PM_LEADERSHIP_AREAS,
} from '../types/mitraKita';
import {
  downloadCsvFile,
  formatCurrencyIDR,
  formatDateID,
  getPmAreaCode,
  getStatusTextClass,
  getTodayISO,
} from '../utils/formatters';
import {
  exportReportToPdf,
  exportReportToWord,
  ReportExportPayload,
} from '../utils/reportExporters';

export const ReportsPage: React.FC = () => {
  const {
    dataset,
    session,
    schoolNameSuggestions,
    updateSchoolProfile,
    updateSupervisorProfile,
    notify,
  } = useMitraKita();

  const [schoolFilter, setSchoolFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [partnerCategoryFilter, setPartnerCategoryFilter] = useState('ALL');
  const [pmAreaFilter, setPmAreaFilter] = useState('ALL');
  const [exportingType, setExportingType] = useState<'pdf' | 'word' | null>(
    null
  );
  const [signerModalOpen, setSignerModalOpen] = useState(false);
  const [signerForm, setSignerForm] = useState({
    namaPengawas: '',
    nipPengawas: '',
    kepalaSekolah: '',
    nipKepalaSekolah: '',
  });
  const [savingSigners, setSavingSigners] = useState(false);

  // Per-school & report letterhead metadata (Alamat Sekolah, NPSN, Tahun Ajaran, Dicetak, Periode)
  const REPORT_META_STORAGE_KEY = 'mitra_kita_report_meta_v1';
  interface SavedReportMeta {
    perSchool: Record<string, { alamatSekolah: string; npsn: string }>;
    printedDate: string;
    printCity: string;
    customPeriodLabel: string;
  }
  const [reportMeta, setReportMeta] = useState<SavedReportMeta>(() => {
    try {
      const raw = window.localStorage.getItem(REPORT_META_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedReportMeta>;
        return {
          perSchool:
            parsed.perSchool && typeof parsed.perSchool === 'object'
              ? parsed.perSchool
              : {},
          printedDate: typeof parsed.printedDate === 'string' ? parsed.printedDate : '',
          printCity: typeof parsed.printCity === 'string' ? parsed.printCity : '',
          customPeriodLabel:
            typeof parsed.customPeriodLabel === 'string'
              ? parsed.customPeriodLabel
              : '',
        };
      }
    } catch {
      // ignore storage errors
    }
    return {
      perSchool: {},
      printedDate: '',
      printCity: '',
      customPeriodLabel: '',
    };
  });

  const [headerModalOpen, setHeaderModalOpen] = useState(false);
  const [headerModalFocus, setHeaderModalFocus] = useState<'alamat' | 'meta'>(
    'alamat'
  );
  const [headerForm, setHeaderForm] = useState({
    alamatSekolah: '',
    npsn: '',
    tahunAjaran: '',
    printedDate: '',
    printCity: '',
    customPeriodLabel: '',
  });

  const activeSchoolTitle =
    schoolFilter !== 'ALL'
      ? schoolFilter
      : dataset.schoolProfile.namaSekolah || 'Semua Sekolah Binaan';
  const activeSchoolKey =
    schoolFilter !== 'ALL' ? schoolFilter.trim().toLowerCase() : '__DEFAULT__';

  const savedSchoolOverride = reportMeta.perSchool[activeSchoolKey];
  const effectiveAlamatSekolah =
    savedSchoolOverride?.alamatSekolah !== undefined
      ? savedSchoolOverride.alamatSekolah
      : dataset.schoolProfile.alamatSekolah || '';
  const effectiveNpsn =
    savedSchoolOverride?.npsn !== undefined
      ? savedSchoolOverride.npsn
      : dataset.schoolProfile.npsn || '';
  const effectiveTahunAjaran = dataset.schoolProfile.tahunAjaran || '2026/2027';
  const effectivePrintedDate = reportMeta.printedDate || getTodayISO();
  const effectivePrintCity = reportMeta.printCity || '';
  const autoPeriodLabel =
    startDate || endDate
      ? `${startDate ? formatDateID(startDate) : 'Awal'} – ${
          endDate ? formatDateID(endDate) : 'Sekarang'
        }`
      : 'Semua Periode';
  const effectivePeriodLabel =
    reportMeta.customPeriodLabel.trim() || autoPeriodLabel;
  const effectiveSignatureDate = effectivePrintCity.trim()
    ? `${effectivePrintCity.trim()}, ${formatDateID(effectivePrintedDate)}`
    : formatDateID(effectivePrintedDate);

  const openHeaderModal = (focusSection: 'alamat' | 'meta' = 'alamat') => {
    setHeaderModalFocus(focusSection);
    setHeaderForm({
      alamatSekolah: effectiveAlamatSekolah,
      npsn: effectiveNpsn,
      tahunAjaran: effectiveTahunAjaran,
      printedDate: effectivePrintedDate,
      printCity: effectivePrintCity,
      customPeriodLabel: reportMeta.customPeriodLabel,
    });
    setHeaderModalOpen(true);
  };

  const handleSaveHeaderMeta = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAlamat = headerForm.alamatSekolah.trim().slice(0, 400);
    const cleanNpsn = headerForm.npsn.trim().slice(0, 40);
    const cleanTahunAjaran = headerForm.tahunAjaran.trim().slice(0, 40) || '2026/2027';
    const cleanPrintedDate = headerForm.printedDate.trim();
    const cleanPrintCity = headerForm.printCity.trim().slice(0, 80);
    const cleanPeriodLabel = headerForm.customPeriodLabel.trim().slice(0, 100);

    const nextMeta: SavedReportMeta = {
      perSchool: {
        ...reportMeta.perSchool,
        [activeSchoolKey]: {
          alamatSekolah: cleanAlamat,
          npsn: cleanNpsn,
        },
      },
      printedDate: cleanPrintedDate,
      printCity: cleanPrintCity,
      customPeriodLabel: cleanPeriodLabel,
    };

    setReportMeta(nextMeta);
    try {
      window.localStorage.setItem(
        REPORT_META_STORAGE_KEY,
        JSON.stringify(nextMeta)
      );
    } catch {
      // ignore storage quota errors
    }

    // Persist Tahun Ajaran (and default Alamat/NPSN when viewing default or when profile address is empty) to Firestore
    const shouldSyncProfileAddress =
      schoolFilter === 'ALL' || !dataset.schoolProfile.alamatSekolah.trim();
    updateSchoolProfile({
      ...dataset.schoolProfile,
      tahunAjaran: cleanTahunAjaran,
      alamatSekolah: shouldSyncProfileAddress
        ? cleanAlamat
        : dataset.schoolProfile.alamatSekolah,
      npsn: shouldSyncProfileAddress ? cleanNpsn : dataset.schoolProfile.npsn,
    });

    setHeaderModalOpen(false);
    notify(
      'success',
      'Kop & metadata laporan diperbarui',
      'Perubahan langsung tampil di pratinjau, PDF, Word, dan Print.'
    );
  };

  const effectiveNamaPengawas =
    dataset.schoolProfile.namaPengawas || session?.namaPengawas || '';
  const effectiveNipPengawas =
    dataset.schoolProfile.nipPengawas || session?.nip || '';
  const effectiveKepalaSekolah = dataset.schoolProfile.kepalaSekolah || '';
  const effectiveNipKepalaSekolah =
    dataset.schoolProfile.nipKepalaSekolah || '';

  const openSignerModal = () => {
    setSignerForm({
      namaPengawas: effectiveNamaPengawas,
      nipPengawas: effectiveNipPengawas,
      kepalaSekolah: effectiveKepalaSekolah,
      nipKepalaSekolah: effectiveNipKepalaSekolah,
    });
    setSignerModalOpen(true);
  };

  const handleSaveSigners = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSigners(true);
    const cleanNamaPengawas = signerForm.namaPengawas.trim();
    const cleanNipPengawas = signerForm.nipPengawas.trim();
    const cleanKepalaSekolah = signerForm.kepalaSekolah.trim();
    const cleanNipKepalaSekolah = signerForm.nipKepalaSekolah.trim();

    updateSchoolProfile({
      ...dataset.schoolProfile,
      namaPengawas: cleanNamaPengawas,
      nipPengawas: cleanNipPengawas,
      kepalaSekolah: cleanKepalaSekolah,
      nipKepalaSekolah: cleanNipKepalaSekolah,
    });

    if (cleanNamaPengawas) {
      await updateSupervisorProfile(cleanNamaPengawas, cleanNipPengawas);
    }

    setSavingSigners(false);
    setSignerModalOpen(false);
  };

  const partnerMap = useMemo(() => {
    const map = new Map<string, { nama: string; kategori: string }>();
    for (const p of dataset.partners) {
      map.set(p.id, { nama: p.nama, kategori: p.kategori });
    }
    return map;
  }, [dataset.partners]);

  const inDateRange = (dateStr?: string) => {
    if (!dateStr) return true;
    const d = dateStr.slice(0, 10);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  // Filtered Partners
  const filteredPartners = useMemo(() => {
    return dataset.partners.filter((p) => {
      if (schoolFilter !== 'ALL' && (p.namaSekolah || '') !== schoolFilter) {
        return false;
      }
      if (
        partnerCategoryFilter !== 'ALL' &&
        p.kategori !== partnerCategoryFilter
      ) {
        return false;
      }
      return true;
    });
  }, [dataset.partners, schoolFilter, partnerCategoryFilter]);

  const filteredPartnerIds = useMemo(
    () => new Set(filteredPartners.map((p) => p.id)),
    [filteredPartners]
  );

  // Filtered Programs
  const filteredPrograms = useMemo(() => {
    return dataset.programs.filter((prg) => {
      if (schoolFilter !== 'ALL' && (prg.namaSekolah || '') !== schoolFilter) {
        return false;
      }
      if (pmAreaFilter !== 'ALL' && prg.areaPm !== pmAreaFilter) return false;
      if (
        partnerCategoryFilter !== 'ALL' &&
        !prg.partnerIds.some((pid) => filteredPartnerIds.has(pid))
      ) {
        return false;
      }
      return true;
    });
  }, [
    dataset.programs,
    schoolFilter,
    pmAreaFilter,
    partnerCategoryFilter,
    filteredPartnerIds,
  ]);

  const filteredProgramIds = useMemo(
    () => new Set(filteredPrograms.map((p) => p.id)),
    [filteredPrograms]
  );

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return dataset.activities
      .filter((act) => {
        if (schoolFilter !== 'ALL' && (act.namaSekolah || '') !== schoolFilter) {
          return false;
        }
        if (!filteredProgramIds.has(act.programId)) return false;
        if (!inDateRange(act.tanggalPelaksanaan)) return false;
        return true;
      })
      .sort((a, b) => b.tanggalPelaksanaan.localeCompare(a.tanggalPelaksanaan));
  }, [dataset.activities, schoolFilter, filteredProgramIds, startDate, endDate]);

  // Filtered Evidences
  const filteredEvidences = useMemo(() => {
    return dataset.evidences
      .filter((ev) => {
        if (schoolFilter !== 'ALL' && (ev.namaSekolah || '') !== schoolFilter) {
          return false;
        }
        if (!filteredProgramIds.has(ev.programId)) return false;
        if (!inDateRange(ev.tanggalUnggah)) return false;
        return true;
      })
      .sort((a, b) => b.tanggalUnggah.localeCompare(a.tanggalUnggah));
  }, [dataset.evidences, schoolFilter, filteredProgramIds, startDate, endDate]);

  // Filtered Evaluations
  const filteredEvaluations = useMemo(() => {
    return dataset.evaluations
      .filter((ev) => {
        if (schoolFilter !== 'ALL' && (ev.namaSekolah || '') !== schoolFilter) {
          return false;
        }
        if (!inDateRange(ev.tanggalPenilaian)) return false;
        if (ev.programId && !filteredProgramIds.has(ev.programId)) return false;
        return true;
      })
      .sort((a, b) => b.tanggalPenilaian.localeCompare(a.tanggalPenilaian));
  }, [dataset.evaluations, schoolFilter, filteredProgramIds, startDate, endDate]);

  const programNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of dataset.programs) {
      map.set(p.id, `${p.kodeProgram} — ${p.namaProgram}`);
    }
    return map;
  }, [dataset.programs]);

  const totalBudget = useMemo(
    () => filteredPrograms.reduce((sum, p) => sum + (p.anggaranRencana || 0), 0),
    [filteredPrograms]
  );

  const totalParticipants = useMemo(
    () =>
      filteredActivities.reduce((sum, a) => sum + (a.jumlahPeserta || 0), 0),
    [filteredActivities]
  );

  const filteredSupervisorNotes = useMemo(() => {
    return dataset.supervisorNotes.filter((note) => {
      if (schoolFilter !== 'ALL' && (note.namaSekolah || '') !== schoolFilter) {
        return false;
      }
      if (!inDateRange(note.tanggal)) return false;
      return true;
    });
  }, [dataset.supervisorNotes, schoolFilter, startDate, endDate]);

  const activeAiAnalysis = useMemo(() => {
    const list = dataset.aiAnalyses ?? [];
    if (list.length === 0) return null;
    if (schoolFilter === 'ALL') {
      return (
        list.find((a) => !(a.namaSekolah || '').trim()) ?? list[0] ?? null
      );
    }
    const targetKey = schoolFilter.trim().toLowerCase();
    return (
      list.find(
        (a) => (a.namaSekolah || '').trim().toLowerCase() === targetKey
      ) ??
      list.find((a) => !(a.namaSekolah || '').trim()) ??
      null
    );
  }, [dataset.aiAnalyses, schoolFilter]);

  const handleResetFilters = () => {
    setSchoolFilter('ALL');
    setStartDate('');
    setEndDate('');
    setPartnerCategoryFilter('ALL');
    setPmAreaFilter('ALL');
  };

  const buildExportPayload = (): ReportExportPayload => ({
    schoolProfile: {
      ...dataset.schoolProfile,
      alamatSekolah: effectiveAlamatSekolah,
      npsn: effectiveNpsn,
      tahunAjaran: effectiveTahunAjaran,
      namaPengawas: effectiveNamaPengawas,
      nipPengawas: effectiveNipPengawas,
      kepalaSekolah: effectiveKepalaSekolah,
      nipKepalaSekolah: effectiveNipKepalaSekolah,
    },
    schoolFilter,
    startDate,
    endDate,
    printedDate: effectivePrintedDate,
    periodLabel: reportMeta.customPeriodLabel.trim() || undefined,
    printCity: effectivePrintCity || undefined,
    partnerCategoryFilter,
    pmAreaFilter,
    partners: filteredPartners,
    programs: filteredPrograms,
    activities: filteredActivities,
    evidences: filteredEvidences,
    evaluations: filteredEvaluations,
    supervisorNotes: filteredSupervisorNotes,
    aiAnalysis: activeAiAnalysis,
    partnerMap,
    programNameMap,
    totalBudget,
    totalParticipants,
  });

  const handleExportPdf = () => {
    try {
      setExportingType('pdf');
      exportReportToPdf(buildExportPayload());
      notify(
        'success',
        'Laporan PDF berhasil diunduh',
        'Dokumen PDF siap dibuka atau dicetak.'
      );
    } catch (err) {
      console.error(err);
      notify(
        'error',
        'Gagal membuat file PDF',
        'Silakan coba beberapa saat lagi.'
      );
    } finally {
      setExportingType(null);
    }
  };

  const handleExportWord = async () => {
    try {
      setExportingType('word');
      await exportReportToWord(buildExportPayload());
      notify(
        'success',
        'Laporan Word (.docx) berhasil diunduh',
        'Dokumen dapat langsung dibuka dan diedit di Microsoft Word.'
      );
    } catch (err) {
      console.error(err);
      notify(
        'error',
        'Gagal membuat file Word',
        'Silakan coba beberapa saat lagi.'
      );
    } finally {
      setExportingType(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportFullCsv = () => {
    const rows: (string | number)[][] = [
      ['LAPORAN KEMITRAAN SEKOLAH — MITRA KITA'],
      [
        'Filter Sekolah',
        schoolFilter === 'ALL' ? 'Semua Sekolah' : schoolFilter,
      ],
      ['Alamat Sekolah', effectiveAlamatSekolah || '-'],
      ['NPSN', effectiveNpsn || '-'],
      ['Tahun Ajaran', effectiveTahunAjaran],
      ['Tanggal Dicetak', formatDateID(effectivePrintedDate)],
      ['Periode', effectivePeriodLabel],
      [
        'Filter Jenis Mitra',
        partnerCategoryFilter === 'ALL' ? 'Semua Kategori' : partnerCategoryFilter,
      ],
      [
        'Filter Area PM',
        pmAreaFilter === 'ALL' ? 'Semua Area PM' : pmAreaFilter,
      ],
      [],
      ['BAGIAN 1: DATA MITRA'],
      [
        'ID Mitra',
        'Nama Sekolah',
        'Nama Mitra/Lembaga',
        'Kategori',
        'Penanggung Jawab',
        'Telepon',
        'Alamat',
        'Jenis Kontribusi',
        'Status',
      ],
      ...filteredPartners.map((p) => [
        p.id,
        p.namaSekolah || '-',
        p.nama,
        p.kategori,
        p.penanggungJawab,
        p.telepon,
        p.alamat,
        p.jenisKontribusi,
        p.status,
      ]),
      [],
      ['BAGIAN 2: PROGRAM KEMITRAAN'],
      [
        'Kode Program',
        'Nama Sekolah',
        'Nama Program',
        'Area Kepemimpinan PM',
        'Mitra Terlibat',
        'Sasaran',
        'Waktu Pelaksanaan',
        'Penanggung Jawab',
        'Sumber Pembiayaan',
        'Anggaran Rencana',
        'Status',
      ],
      ...filteredPrograms.map((prg) => [
        prg.kodeProgram,
        prg.namaSekolah || '-',
        prg.namaProgram,
        prg.areaPm,
        prg.partnerIds
          .map((id) => partnerMap.get(id)?.nama ?? id)
          .join('; '),
        prg.sasaran,
        prg.waktuPelaksanaan,
        prg.penanggungJawab,
        prg.sumberPembiayaan,
        prg.anggaranRencana,
        prg.status,
      ]),
      [],
      ['BAGIAN 3: REALISASI KEGIATAN'],
      [
        'Tanggal',
        'Nama Sekolah',
        'Nama Kegiatan',
        'Program Terkait',
        'Lokasi',
        'Jumlah Peserta',
        'Penanggung Jawab',
        'Hasil Kegiatan',
        'Kendala',
        'Status',
      ],
      ...filteredActivities.map((act) => [
        act.tanggalPelaksanaan,
        act.namaSekolah || '-',
        act.namaKegiatan,
        programNameMap.get(act.programId) ?? act.programId,
        act.lokasi,
        act.jumlahPeserta,
        act.penanggungJawab,
        act.hasilKegiatan,
        act.kendala,
        act.status,
      ]),
      [],
      ['BAGIAN 4: BUKTI & DOKUMENTASI'],
      [
        'Tanggal Unggah',
        'Nama Sekolah',
        'Nama Dokumen',
        'Jenis',
        'Program Terkait',
        'Nama Berkas',
        'Keterangan',
      ],
      ...filteredEvidences.map((ev) => [
        ev.tanggalUnggah,
        ev.namaSekolah || '-',
        ev.namaDokumen,
        ev.jenis,
        programNameMap.get(ev.programId) ?? ev.programId,
        ev.fileName ?? '-',
        ev.keterangan,
      ]),
      [],
      ['BAGIAN 5: HASIL MONITORING & EVALUASI'],
      [
        'Nama Sekolah',
        'Periode',
        'Tanggal Penilaian',
        'Penilai',
        'Skor Perolehan',
        'Skor Maksimal',
        'Nilai Akhir',
        'Kategori Hasil',
        'Temuan Monitoring',
        'Kekuatan',
        'Kelemahan',
        'Rekomendasi',
        'Rencana Tindak Lanjut',
        'Catatan Pengawas',
      ],
      ...filteredEvaluations.map((ev) => [
        ev.namaSekolah || '-',
        ev.periode,
        ev.tanggalPenilaian,
        ev.penilai,
        ev.totalSkorPerolehan,
        ev.totalSkorMaksimal,
        ev.nilaiAkhir,
        ev.kategoriHasil,
        ev.temuanMonitoring,
        ev.kekuatan,
        ev.kelemahan,
        ev.rekomendasi,
        ev.rencanaTindakLanjut,
        ev.catatanPembinaanPengawas ?? '-',
      ]),
      ...(activeAiAnalysis
        ? [
            [],
            ['BAGIAN 6: HASIL ANALISIS AI, REKOMENDASI KEMITRAAN & ANALISIS DAMPAK'],
            [
              'Tanggal Analisis',
              'Cakupan Sekolah',
              'Skor Kematangan',
              'Tahap Kematangan',
              'Indeks Dampak',
              'Ringkasan Eksekutif',
              'Efektivitas Anggaran',
              'Dampak Peserta Didik',
            ],
            [
              activeAiAnalysis.generatedAt.slice(0, 10),
              activeAiAnalysis.schoolScope,
              activeAiAnalysis.maturityScore,
              activeAiAnalysis.maturityLevel,
              activeAiAnalysis.impactAnalysis.overallImpactIndex,
              activeAiAnalysis.executiveSummary,
              activeAiAnalysis.impactAnalysis.budgetEfficiencyNote,
              activeAiAnalysis.impactAnalysis.studentOutcomeNarrative,
            ],
            [],
            ['REKOMENDASI KEMITRAAN STRATEGIS (AI)'],
            [
              'Prioritas',
              'Judul Rekomendasi',
              'Calon Mitra',
              'Kategori Mitra',
              'Area PM',
              'Bentuk Kolaborasi',
              'Estimasi Dampak',
            ],
            ...activeAiAnalysis.partnershipRecommendations.map((r) => [
              r.prioritas,
              r.judul,
              r.calonMitra,
              r.kategoriMitra,
              r.areaPm,
              r.bentukKolaborasi,
              r.estimasiDampak,
            ]),
            [],
            ['ANALISIS DAMPAK 4 DIMENSI (AI)'],
            ['Dimensi', 'Skor', 'Status', 'Analisis', 'Saran Peningkatan'],
            ...activeAiAnalysis.impactAnalysis.dimensions.map((d) => [
              d.dimensi,
              d.skor,
              d.status,
              d.analisis,
              d.saranPeningkatan,
            ]),
          ]
        : []),
    ];

    downloadCsvFile(`Laporan_Kemitraan_MITRA_KITA_${getTodayISO()}.csv`, rows);
    notify('success', 'Laporan CSV berhasil diunduh');
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Actions (Hidden when printing) */}
      <div className="no-print flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-medium text-[#5B6F65]">
            Rekapitulasi lengkap kemitraan sekolah yang dapat difilter serta
            dicetak atau diunduh ke PDF, Word (.docx), dan CSV.
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#11221A]">
            Laporan Kemitraan Sekolah
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openHeaderModal('alamat')}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D4E0D9] bg-white px-3.5 py-2.5 text-sm font-medium text-[#11221A] shadow-[0_1px_2px_rgba(16,38,26,0.03)] hover:border-[#14532D]/40 hover:bg-[#F5FAF7] hover:text-[#14532D] whitespace-nowrap shrink-0"
          >
            <Pencil className="h-4 w-4 text-[#14532D]" />
            <span>Edit Kop &amp; Periode</span>
          </button>
          <button
            type="button"
            onClick={openSignerModal}
            className="inline-flex items-center gap-2 rounded-xl border border-[#14532D]/30 bg-[#EDF6F0] px-3.5 py-2.5 text-sm font-semibold text-[#14532D] shadow-[0_1px_2px_rgba(16,38,26,0.03)] hover:border-[#14532D]/50 hover:bg-[#DCFCE7] whitespace-nowrap shrink-0"
          >
            <PenLine className="h-4 w-4" />
            <span>Input Nama &amp; NIP</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingType !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0E3F22] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {exportingType === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            <span>Cetak PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportWord}
            disabled={exportingType !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-[#1D4ED8]/25 bg-[#EFF6FF] px-4 py-2.5 text-sm font-semibold text-[#1E40AF] shadow-[0_1px_2px_rgba(16,38,26,0.03)] hover:border-[#1D4ED8]/45 hover:bg-[#DBEAFE] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {exportingType === 'word' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span>Cetak Word (.docx)</span>
          </button>
          <button
            type="button"
            onClick={handleExportFullCsv}
            disabled={exportingType !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D4E0D9] bg-white px-3.5 py-2.5 text-sm font-medium text-[#11221A] shadow-[0_1px_2px_rgba(16,38,26,0.03)] hover:border-[#B6C9BD] hover:bg-[#F5FAF7] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4 text-[#14532D]" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={exportingType !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D4E0D9] bg-white px-3.5 py-2.5 text-sm font-medium text-[#11221A] shadow-[0_1px_2px_rgba(16,38,26,0.03)] hover:border-[#B6C9BD] hover:bg-[#F5FAF7] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
            title="Cetak langsung ke printer browser"
          >
            <Printer className="h-4 w-4 text-[#5B6F65]" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Filter Panel (Hidden when printing) */}
      <div className="no-print rounded-xl border border-[#E2E8E4] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#52635A]">
              Nama Sekolah
            </label>
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            >
              <option value="ALL">Semua Sekolah</option>
              {schoolNameSuggestions.map((school) => (
                <option key={school} value={school}>
                  {school}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#52635A]">
              Periode Mulai
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#52635A]">
              Periode Selesai
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#52635A]">
              Jenis Mitra
            </label>
            <select
              value={partnerCategoryFilter}
              onChange={(e) => setPartnerCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            >
              <option value="ALL">Semua Kategori Mitra</option>
              {PARTNER_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#52635A]">
              Area Kepemimpinan PM
            </label>
            <select
              value={pmAreaFilter}
              onChange={(e) => setPmAreaFilter(e.target.value)}
              className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            >
              <option value="ALL">Semua Area PM</option>
              {PM_LEADERSHIP_AREAS.map((area) => (
                <option key={area.code} value={area.label}>
                  {area.code}. {area.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(schoolFilter !== 'ALL' ||
          startDate ||
          endDate ||
          partnerCategoryFilter !== 'ALL' ||
          pmAreaFilter !== 'ALL') && (
          <div className="mt-3 flex justify-end border-t border-[#EEF2EF] pt-3">
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14532D] hover:underline"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Semua Filter</span>
            </button>
          </div>
        )}
      </div>

      {/* Printable Official Report Document */}
      <div className="print-full-width space-y-8 rounded-xl border border-[#E2E8E4] bg-white p-6 sm:p-8">
        {/* Report Letterhead / Kop Laporan */}
        <header className="border-b-2 border-[#14532D] pb-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="text-[11px] font-bold tracking-[0.08em] text-[#14532D] uppercase">
                LAPORAN PENGELOLAAN KEMITRAAN SEKOLAH · MITRA KITA
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[#11221A] sm:text-2xl">
                {activeSchoolTitle}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-0.5 text-xs text-[#52635A]">
                {effectiveAlamatSekolah || effectiveNpsn ? (
                  <span className="inline-flex items-start gap-1.5 leading-relaxed">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#14532D]/70" />
                    <span>
                      {effectiveAlamatSekolah || 'Alamat sekolah belum diisi'}
                      {effectiveNpsn ? (
                        <span className="font-mono text-[#334155]">
                          {' '}
                          · NPSN: {effectiveNpsn}
                        </span>
                      ) : null}
                    </span>
                  </span>
                ) : (
                  <span className="no-print italic text-[#73857B]">
                    Alamat sekolah belum diisi
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => openHeaderModal('alamat')}
                  className="no-print inline-flex items-center gap-1 rounded-md border border-[#D4DDD7] bg-[#F8FBF9] px-2 py-0.5 text-[11px] font-medium text-[#14532D] transition-colors hover:border-[#14532D]/40 hover:bg-[#EDF6F0]"
                  title="Edit alamat sekolah dan NPSN"
                >
                  <Pencil className="h-3 w-3" />
                  <span>
                    {effectiveAlamatSekolah ? 'Edit Alamat' : 'Isi Alamat Sekolah'}
                  </span>
                </button>
              </div>
            </div>

            <div className="shrink-0 rounded-xl border border-[#DCE6DF] bg-[#F8FBF9] px-4 py-3 text-xs tabular-nums md:min-w-[260px]">
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[#5B6F65]">Tahun Ajaran</span>
                  <span className="font-semibold text-[#11221A]">
                    {effectiveTahunAjaran}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[#5B6F65]">Dicetak</span>
                  <span className="font-semibold text-[#11221A]">
                    {formatDateID(effectivePrintedDate)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[#5B6F65]">Periode</span>
                  <span className="text-right font-semibold text-[#14532D]">
                    {effectivePeriodLabel}
                  </span>
                </div>
              </div>
              <div className="no-print mt-2.5 flex justify-end border-t border-[#E4EDE7] pt-2">
                <button
                  type="button"
                  onClick={() => openHeaderModal('meta')}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#14532D] hover:underline"
                >
                  <CalendarDays className="h-3 w-3" />
                  <span>Edit Tahun Ajaran, Dicetak &amp; Periode</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Executive Summary Metrics */}
        <section className="grid grid-cols-2 gap-4 border-b border-[#EEF2EF] pb-6 sm:grid-cols-4">
          <div>
            <div className="text-xs text-[#52635A]">Total Mitra</div>
            <div className="mt-1 font-mono text-2xl font-bold text-[#14221B] tabular-nums">
              {filteredPartners.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#52635A]">Program Kemitraan</div>
            <div className="mt-1 font-mono text-2xl font-bold text-[#14221B] tabular-nums">
              {filteredPrograms.length}
            </div>
            <div className="text-[11px] text-[#52635A] tabular-nums">
              Anggaran: {formatCurrencyIDR(totalBudget)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#52635A]">Realisasi Kegiatan</div>
            <div className="mt-1 font-mono text-2xl font-bold text-[#14221B] tabular-nums">
              {filteredActivities.length}
            </div>
            <div className="text-[11px] text-[#52635A] tabular-nums">
              {totalParticipants} total peserta
            </div>
          </div>
          <div>
            <div className="text-xs text-[#52635A]">Bukti &amp; Monitoring</div>
            <div className="mt-1 font-mono text-2xl font-bold text-[#14221B] tabular-nums">
              {filteredEvidences.length} / {filteredEvaluations.length}
            </div>
            <div className="text-[11px] text-[#52635A]">
              Dokumen / Evaluasi
            </div>
          </div>
        </section>

        {/* 1. Data Seluruh Mitra */}
        <section className="print-break-inside-avoid space-y-3">
          <h3 className="text-sm font-bold text-[#14532D]">
            1. Data Mitra Sekolah ({filteredPartners.length})
          </h3>
          {filteredPartners.length === 0 ? (
            <p className="text-xs text-[#52635A]">
              Tidak ada data mitra pada filter aktif.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#DCE5DF] bg-[#F9FBFA] text-[#52635A]">
                    <th className="px-3 py-2 font-semibold">ID</th>
                    <th className="px-3 py-2 font-semibold">Nama Mitra</th>
                    <th className="px-3 py-2 font-semibold">Kategori</th>
                    <th className="px-3 py-2 font-semibold">Penanggung Jawab</th>
                    <th className="px-3 py-2 font-semibold">Kontribusi</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2EF]">
                  {filteredPartners.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 font-mono text-[#14532D] whitespace-nowrap">
                        {p.id}
                      </td>
                      <td className="px-3 py-2 font-medium text-[#14221B]">
                        {p.nama}
                      </td>
                      <td className="px-3 py-2 text-[#334155] whitespace-nowrap">
                        {p.kategori}
                      </td>
                      <td className="px-3 py-2 text-[#334155]">
                        {p.penanggungJawab}
                      </td>
                      <td className="px-3 py-2 text-[#52635A]">
                        {p.jenisKontribusi}
                      </td>
                      <td className={`px-3 py-2 whitespace-nowrap ${getStatusTextClass(p.status)}`}>
                        {p.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 2. Program Kemitraan */}
        <section className="print-break-inside-avoid space-y-3">
          <h3 className="text-sm font-bold text-[#14532D]">
            2. Program Kemitraan ({filteredPrograms.length})
          </h3>
          {filteredPrograms.length === 0 ? (
            <p className="text-xs text-[#52635A]">
              Tidak ada program kemitraan pada filter aktif.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#DCE5DF] bg-[#F9FBFA] text-[#52635A]">
                    <th className="px-3 py-2 font-semibold">Kode</th>
                    <th className="px-3 py-2 font-semibold">Nama Program</th>
                    <th className="px-3 py-2 font-semibold">Area PM</th>
                    <th className="px-3 py-2 font-semibold">Mitra Terlibat</th>
                    <th className="px-3 py-2 font-semibold text-right">Anggaran</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2EF]">
                  {filteredPrograms.map((prg) => (
                    <tr key={prg.id}>
                      <td className="px-3 py-2 font-mono text-[#14532D] whitespace-nowrap">
                        {prg.kodeProgram}
                      </td>
                      <td className="px-3 py-2 font-medium text-[#14221B]">
                        {prg.namaProgram}
                      </td>
                      <td className="px-3 py-2 text-[#334155] whitespace-nowrap">
                        {getPmAreaCode(prg.areaPm)}
                      </td>
                      <td className="px-3 py-2 text-[#52635A]">
                        {prg.partnerIds
                          .map((id) => partnerMap.get(id)?.nama ?? id)
                          .join(', ') || '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatCurrencyIDR(prg.anggaranRencana)}
                      </td>
                      <td className={`px-3 py-2 whitespace-nowrap ${getStatusTextClass(prg.status)}`}>
                        {prg.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 3. Realisasi Kegiatan */}
        <section className="print-break-inside-avoid space-y-3">
          <h3 className="text-sm font-bold text-[#14532D]">
            3. Realisasi Kegiatan ({filteredActivities.length})
          </h3>
          {filteredActivities.length === 0 ? (
            <p className="text-xs text-[#52635A]">
              Tidak ada kegiatan pada filter aktif.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#DCE5DF] bg-[#F9FBFA] text-[#52635A]">
                    <th className="px-3 py-2 font-semibold">Tanggal</th>
                    <th className="px-3 py-2 font-semibold">Nama Kegiatan</th>
                    <th className="px-3 py-2 font-semibold">Program</th>
                    <th className="px-3 py-2 font-semibold text-right">Peserta</th>
                    <th className="px-3 py-2 font-semibold">Hasil</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2EF]">
                  {filteredActivities.map((act) => (
                    <tr key={act.id}>
                      <td className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                        {formatDateID(act.tanggalPelaksanaan)}
                      </td>
                      <td className="px-3 py-2 font-medium text-[#14221B]">
                        {act.namaKegiatan}
                      </td>
                      <td className="px-3 py-2 text-[#52635A]">
                        {programNameMap.get(act.programId) ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {act.jumlahPeserta}
                      </td>
                      <td className="px-3 py-2 text-[#52635A]">
                        {act.hasilKegiatan || '-'}
                      </td>
                      <td className={`px-3 py-2 whitespace-nowrap ${getStatusTextClass(act.status)}`}>
                        {act.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 4. Bukti Dokumentasi */}
        <section className="print-break-inside-avoid space-y-3">
          <h3 className="text-sm font-bold text-[#14532D]">
            4. Daftar Bukti &amp; Dokumentasi ({filteredEvidences.length})
          </h3>
          {filteredEvidences.length === 0 ? (
            <p className="text-xs text-[#52635A]">
              Belum ada bukti dokumentasi pada filter aktif.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#DCE5DF] bg-[#F9FBFA] text-[#52635A]">
                    <th className="px-3 py-2 font-semibold">Tanggal</th>
                    <th className="px-3 py-2 font-semibold">Nama Dokumen</th>
                    <th className="px-3 py-2 font-semibold">Jenis</th>
                    <th className="px-3 py-2 font-semibold">Program</th>
                    <th className="px-3 py-2 font-semibold">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2EF]">
                  {filteredEvidences.map((ev) => (
                    <tr key={ev.id}>
                      <td className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                        {formatDateID(ev.tanggalUnggah)}
                      </td>
                      <td className="px-3 py-2 font-medium text-[#14221B]">
                        {ev.namaDokumen}
                      </td>
                      <td className="px-3 py-2 text-[#334155] whitespace-nowrap">
                        {ev.jenis}
                      </td>
                      <td className="px-3 py-2 text-[#52635A]">
                        {programNameMap.get(ev.programId) ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-[#52635A]">
                        {ev.keterangan || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 5 & 6. Hasil Monitoring, Evaluasi, Tindak Lanjut & Catatan Pengawas */}
        <section className="print-break-inside-avoid space-y-3">
          <h3 className="text-sm font-bold text-[#14532D]">
            5. Hasil Monitoring, Evaluasi &amp; Tindak Lanjut ({filteredEvaluations.length})
          </h3>
          {filteredEvaluations.length === 0 ? (
            <p className="text-xs text-[#52635A]">
              Belum ada hasil monitoring pada periode atau filter yang dipilih.
            </p>
          ) : (
            <div className="space-y-4">
              {filteredEvaluations.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-lg border border-[#E2E8E4] p-4 text-xs space-y-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#EEF2EF] pb-2">
                    <div>
                      <strong className="text-sm text-[#14221B]">
                        {ev.periode}
                      </strong>
                      <span className="ml-2 text-[#52635A]">
                        · {formatDateID(ev.tanggalPenilaian)} · Penilai: {ev.penilai}
                      </span>
                    </div>
                    <div className="font-mono font-bold tabular-nums">
                      Nilai {ev.nilaiAkhir} ({ev.totalSkorPerolehan}/
                      {ev.totalSkorMaksimal}) —{' '}
                      <span className={`font-sans ${getStatusTextClass(ev.kategoriHasil)}`}>
                        {ev.kategoriHasil}
                      </span>
                    </div>
                  </div>
                  <p>
                    <strong>Temuan:</strong> {ev.temuanMonitoring || '-'}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <p>
                      <strong>Kekuatan:</strong> {ev.kekuatan || '-'}
                    </p>
                    <p>
                      <strong>Kelemahan:</strong> {ev.kelemahan || '-'}
                    </p>
                    <p>
                      <strong>Rekomendasi:</strong> {ev.rekomendasi || '-'}
                    </p>
                    <p>
                      <strong>Rencana Tindak Lanjut:</strong>{' '}
                      {ev.rencanaTindakLanjut || '-'}
                    </p>
                  </div>
                  {ev.catatanPembinaanPengawas && (
                    <p className="border-t border-[#EEF2EF] pt-2 text-[#14532D]">
                      <strong>Catatan Pembinaan Pengawas:</strong>{' '}
                      {ev.catatanPembinaanPengawas}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Catatan Pembinaan Pengawas Umum */}
        {filteredSupervisorNotes.length > 0 && (
          <section className="print-break-inside-avoid space-y-2">
            <h3 className="text-sm font-bold text-[#14532D]">
              6. Rekap Catatan Pembinaan Pengawas ({filteredSupervisorNotes.length})
            </h3>
            <ul className="divide-y divide-[#EEF2EF] rounded-lg border border-[#E2E8E4]">
              {filteredSupervisorNotes.map((note) => (
                <li key={note.id} className="p-3 text-xs">
                  <div className="text-[#52635A]">
                    <strong className="text-[#14221B]">{note.pengawasNama}</strong>{' '}
                    · {formatDateID(note.tanggal)}
                  </div>
                  <p className="mt-1 text-[#14221B]">{note.catatanPembinaan}</p>
                  {note.rekomendasi && note.rekomendasi !== '-' && (
                    <p className="mt-0.5 text-[#14532D]">
                      <strong>Rekomendasi:</strong> {note.rekomendasi}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 7. Hasil Analisis AI, Rekomendasi Kemitraan & Analisis Dampak */}
        <section className="print-break-inside-avoid space-y-3">
          <h3 className="text-sm font-bold text-[#14532D]">
            {filteredSupervisorNotes.length > 0 ? '7' : '6'}. Hasil Analisis AI,
            Rekomendasi Kemitraan &amp; Analisis Dampak
          </h3>
          {!activeAiAnalysis ? (
            <p className="text-xs text-[#52635A]">
              Belum ada hasil Analisis AI tersimpan untuk cakupan sekolah ini.
              Jalankan analisis pada menu <strong>Analisis AI &amp; Dampak</strong>{' '}
              agar hasilnya otomatis tercantum dan tercetak di sini.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-[#E2E8E4] bg-[#FAFDFB] p-4 text-xs space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E6EEE9] pb-2">
                  <div>
                    <strong className="text-sm text-[#14221B]">
                      {activeAiAnalysis.schoolScope}
                    </strong>
                    <span className="ml-2 text-[#52635A]">
                      · Analisis tanggal{' '}
                      {formatDateID(activeAiAnalysis.generatedAt.slice(0, 10))}
                    </span>
                  </div>
                  <div className="font-mono font-bold text-[#14532D] tabular-nums">
                    Kematangan {activeAiAnalysis.maturityScore}/100 (
                    {activeAiAnalysis.maturityLevel}) · Indeks Dampak{' '}
                    {activeAiAnalysis.impactAnalysis.overallImpactIndex}/100
                  </div>
                </div>
                <p className="leading-relaxed text-[#14221B]">
                  {activeAiAnalysis.executiveSummary}
                </p>
                <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                  <p className="text-[#334155]">
                    <strong className="text-[#14221B]">
                      Efektivitas Anggaran:
                    </strong>{' '}
                    {activeAiAnalysis.impactAnalysis.budgetEfficiencyNote}
                  </p>
                  <p className="text-[#334155]">
                    <strong className="text-[#14221B]">
                      Dampak Peserta Didik:
                    </strong>{' '}
                    {activeAiAnalysis.impactAnalysis.studentOutcomeNarrative}
                  </p>
                </div>
              </div>

              {activeAiAnalysis.impactAnalysis.dimensions.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#DCE5DF] bg-[#F9FBFA] text-[#52635A]">
                        <th className="px-3 py-2 font-semibold">
                          Dimensi Dampak
                        </th>
                        <th className="px-3 py-2 font-semibold text-right">
                          Skor
                        </th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">
                          Analisis &amp; Saran Penguatan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF2EF]">
                      {activeAiAnalysis.impactAnalysis.dimensions.map((d, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-medium text-[#14221B]">
                            {d.dimensi}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-[#14532D] tabular-nums whitespace-nowrap">
                            {d.skor}/100
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap font-medium text-[#334155]">
                            {d.status}
                          </td>
                          <td className="px-3 py-2 text-[#52635A]">
                            <div>{d.analisis}</div>
                            <div className="mt-0.5 text-[#14532D]">
                              <strong>Saran:</strong> {d.saranPeningkatan}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeAiAnalysis.partnershipRecommendations.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#DCE5DF] bg-[#F9FBFA] text-[#52635A]">
                        <th className="px-3 py-2 font-semibold">Prioritas</th>
                        <th className="px-3 py-2 font-semibold">
                          Rekomendasi Kemitraan
                        </th>
                        <th className="px-3 py-2 font-semibold">Calon Mitra</th>
                        <th className="px-3 py-2 font-semibold">Area PM</th>
                        <th className="px-3 py-2 font-semibold">
                          Kolaborasi &amp; Estimasi Dampak
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF2EF]">
                      {activeAiAnalysis.partnershipRecommendations.map(
                        (r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-semibold text-[#14532D] whitespace-nowrap">
                              {r.prioritas}
                            </td>
                            <td className="px-3 py-2 font-medium text-[#14221B]">
                              {r.judul}
                            </td>
                            <td className="px-3 py-2 text-[#334155]">
                              <div>{r.calonMitra}</div>
                              <div className="text-[11px] text-[#52635A]">
                                {r.kategoriMitra}
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-[#334155]">
                              {getPmAreaCode(r.areaPm)}
                            </td>
                            <td className="px-3 py-2 text-[#52635A]">
                              <div>{r.bentukKolaborasi}</div>
                              <div className="mt-0.5 text-[#14221B]">
                                <strong>Dampak:</strong> {r.estimasiDampak}
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Print Signature Block */}
        <footer className="print-break-inside-avoid mt-10 border-t border-[#EEF2EF] pt-8 text-xs text-[#14221B]">
          <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-[#C7D8CD] bg-[#F7FBF8] px-4 py-2.5">
            <span className="text-xs text-[#3D5247]">
              Nama dan NIP penanda tangan di bawah ini otomatis muncul pada hasil{' '}
              <strong>Cetak PDF</strong>, <strong>Cetak Word (.docx)</strong>, dan{' '}
              <strong>Print</strong>.
            </span>
            <button
              type="button"
              onClick={openSignerModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0E3F22] whitespace-nowrap"
            >
              <PenLine className="h-3.5 w-3.5" />
              <span>Isi / Ubah Nama &amp; NIP</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <div>Mengetahui,</div>
              <div className="font-semibold">Pengawas Sekolah</div>
              <div className="mt-14 font-semibold underline">
                {effectiveNamaPengawas || '....................................'}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-[#52635A] tabular-nums">
                NIP. {effectiveNipPengawas || '....................................'}
              </div>
            </div>
            <div className="text-right">
              <div>{effectiveSignatureDate}</div>
              <div className="font-semibold">Kepala Sekolah</div>
              <div className="mt-14 font-semibold underline">
                {effectiveKepalaSekolah || '....................................'}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-[#52635A] tabular-nums">
                NIP. {effectiveNipKepalaSekolah || '....................................'}
              </div>
            </div>
          </div>
          <p className="mt-8 border-t border-[#EEF2EF] pt-3 text-center text-[11px] text-[#5B6F65]">
            &copy; {new Date().getFullYear()} MITRA KITA · Hak Cipta{' '}
            <strong className="font-semibold text-[#11221A]">
              HERIANSYAH. S.Si., S.Pd., M.Pd
            </strong>
          </p>
        </footer>
      </div>

      {/* Modal Input Nama & NIP Penanda Tangan */}
      <Modal
        open={signerModalOpen}
        title="Input Nama & NIP Penanda Tangan Laporan"
        subtitle="Isi nama lengkap beserta gelar dan NIP Pengawas Sekolah serta Kepala Sekolah. Data disimpan otomatis dan langsung tampil pada dokumen PDF, Word, dan Print."
        maxWidthClass="max-w-2xl"
        onClose={() => setSignerModalOpen(false)}
      >
        <form onSubmit={handleSaveSigners} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Pengawas Sekolah */}
            <div className="space-y-3 rounded-xl border border-[#E2EAE5] bg-[#FAFDFB] p-4">
              <div className="text-xs font-bold tracking-wide text-[#14532D] uppercase">
                1. Pengawas Sekolah
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#11221A]">
                  Nama Lengkap &amp; Gelar
                </label>
                <input
                  type="text"
                  value={signerForm.namaPengawas}
                  onChange={(e) =>
                    setSignerForm({ ...signerForm, namaPengawas: e.target.value })
                  }
                  placeholder="Contoh: HERIANSYAH. S.Si., S.Pd., M.Pd"
                  className="w-full rounded-lg border border-[#D4E0D9] bg-white px-3 py-2 text-sm text-[#11221A] focus:border-[#14532D] focus:outline-none"
                />
                <FieldExampleHint
                  examples={SETTINGS_FIELD_EXAMPLES.namaPengawas}
                  onApply={(val) =>
                    setSignerForm({ ...signerForm, namaPengawas: val })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#11221A]">
                  NIP Pengawas Sekolah
                </label>
                <input
                  type="text"
                  value={signerForm.nipPengawas}
                  onChange={(e) =>
                    setSignerForm({ ...signerForm, nipPengawas: e.target.value })
                  }
                  placeholder="Contoh: 197504122000031002"
                  className="w-full rounded-lg border border-[#D4E0D9] bg-white px-3 py-2 font-mono text-sm text-[#11221A] focus:border-[#14532D] focus:outline-none"
                />
                <FieldExampleHint
                  examples={SETTINGS_FIELD_EXAMPLES.nipPengawas}
                  onApply={(val) =>
                    setSignerForm({ ...signerForm, nipPengawas: val })
                  }
                />
              </div>
            </div>

            {/* Kepala Sekolah */}
            <div className="space-y-3 rounded-xl border border-[#E2EAE5] bg-[#FAFDFB] p-4">
              <div className="text-xs font-bold tracking-wide text-[#14532D] uppercase">
                2. Kepala Sekolah
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#11221A]">
                  Nama Lengkap &amp; Gelar
                </label>
                <input
                  type="text"
                  value={signerForm.kepalaSekolah}
                  onChange={(e) =>
                    setSignerForm({ ...signerForm, kepalaSekolah: e.target.value })
                  }
                  placeholder="Contoh: Hj. Kartini Rahmawati, S.Pd., M.Pd."
                  className="w-full rounded-lg border border-[#D4E0D9] bg-white px-3 py-2 text-sm text-[#11221A] focus:border-[#14532D] focus:outline-none"
                />
                <FieldExampleHint
                  examples={SETTINGS_FIELD_EXAMPLES.kepalaSekolah}
                  onApply={(val) =>
                    setSignerForm({ ...signerForm, kepalaSekolah: val })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#11221A]">
                  NIP Kepala Sekolah
                </label>
                <input
                  type="text"
                  value={signerForm.nipKepalaSekolah}
                  onChange={(e) =>
                    setSignerForm({
                      ...signerForm,
                      nipKepalaSekolah: e.target.value,
                    })
                  }
                  placeholder="Contoh: 197408211998022001"
                  className="w-full rounded-lg border border-[#D4E0D9] bg-white px-3 py-2 font-mono text-sm text-[#11221A] focus:border-[#14532D] focus:outline-none"
                />
                <FieldExampleHint
                  examples={SETTINGS_FIELD_EXAMPLES.nipKepalaSekolah}
                  onApply={(val) =>
                    setSignerForm({ ...signerForm, nipKepalaSekolah: val })
                  }
                />
              </div>
            </div>
          </div>

          {/* Live Preview Blok Tanda Tangan */}
          <div className="rounded-xl border border-[#E2EAE5] bg-white p-4">
            <div className="mb-3 text-[11px] font-semibold tracking-wide text-[#5B6F65] uppercase">
              Pratinjau Blok Tanda Tangan
            </div>
            <div className="grid grid-cols-2 gap-6 text-xs text-[#11221A]">
              <div>
                <div>Mengetahui,</div>
                <div className="font-semibold">Pengawas Sekolah</div>
                <div className="mt-9 font-semibold underline">
                  {signerForm.namaPengawas.trim() ||
                    '....................................'}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-[#5B6F65]">
                  NIP.{' '}
                  {signerForm.nipPengawas.trim() ||
                    '....................................'}
                </div>
              </div>
              <div className="text-right">
                <div>{effectiveSignatureDate}</div>
                <div className="font-semibold">Kepala Sekolah</div>
                <div className="mt-9 font-semibold underline">
                  {signerForm.kepalaSekolah.trim() ||
                    '....................................'}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-[#5B6F65]">
                  NIP.{' '}
                  {signerForm.nipKepalaSekolah.trim() ||
                    '....................................'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-[#EEF3F0] pt-4">
            <button
              type="button"
              onClick={() => setSignerModalOpen(false)}
              className="rounded-xl border border-[#D4E0D9] bg-white px-4 py-2 text-sm font-medium text-[#11221A] hover:bg-[#F5FAF7]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingSigners}
              className="inline-flex items-center gap-2 rounded-xl bg-[#14532D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0E3F22] disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span>{savingSigners ? 'Menyimpan...' : 'Simpan Nama & NIP'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Kop Laporan: Alamat Sekolah, NPSN, Tahun Ajaran, Dicetak & Periode */}
      <Modal
        open={headerModalOpen}
        title="Edit Kop & Metadata Laporan"
        subtitle={`Sesuaikan alamat sekolah, tahun ajaran, tanggal cetak, dan keterangan periode untuk "${activeSchoolTitle}".`}
        maxWidthClass="max-w-2xl"
        onClose={() => setHeaderModalOpen(false)}
      >
        <form onSubmit={handleSaveHeaderMeta} className="space-y-5">
          {/* Section 1: Alamat Sekolah & NPSN */}
          <div
            className={`space-y-3 rounded-xl border p-4 ${
              headerModalFocus === 'alamat'
                ? 'border-[#14532D]/40 bg-[#F7FBF8]'
                : 'border-[#E2EAE5] bg-[#FAFDFB]'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-[#14532D] uppercase">
              <MapPin className="h-3.5 w-3.5" />
              <span>1. Identitas &amp; Alamat Sekolah</span>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#11221A]">
                Alamat Lengkap Sekolah ({activeSchoolTitle})
              </label>
              <textarea
                rows={2}
                value={headerForm.alamatSekolah}
                onChange={(e) =>
                  setHeaderForm({ ...headerForm, alamatSekolah: e.target.value })
                }
                placeholder="Contoh: Jl. Poros Parepare–Sengkang Km. 5, Desa Wanio, Kec. Panca Lautang, Kab. Sidenreng Rappang"
                className="w-full rounded-lg border border-[#D4E0D9] bg-white px-3 py-2 text-sm text-[#11221A] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={SETTINGS_FIELD_EXAMPLES.alamatSekolah}
                onApply={(val) =>
                  setHeaderForm({ ...headerForm, alamatSekolah: val })
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#11221A]">
                  NPSN (Opsional)
                </label>
                <input
                  type="text"
                  value={headerForm.npsn}
                  onChange={(e) =>
                    setHeaderForm({ ...headerForm, npsn: e.target.value })
                  }
                  placeholder="Contoh: 40305512"
                  className="w-full rounded-lg border border-[#D4E0D9] bg-white px-3 py-2 font-mono text-sm text-[#11221A] focus:border-[#14532D] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#11221A]">
                  Kota / Kecamatan Tanda Tangan (Opsional)
                </label>
                <input
                  type="text"
                  value={headerForm.printCity}
                  onChange={(e) =>
                    setHeaderForm({ ...headerForm, printCity: e.target.value })
                  }
                  placeholder="Contoh: Panca Lautang / Sidrap"
                  className="w-full rounded-lg border border-[#D4E0D9] bg-white px-3 py-2 text-sm text-[#11221A] focus:border-[#14532D] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Tahun Ajaran, Tanggal Dicetak & Periode */}
          <div
            className={`space-y-3 rounded-xl border p-4 ${
              headerModalFocus === 'meta'
                ? 'border-[#14532D]/40 bg-[#F7FBF8]'
                : 'border-[#E2EAE5] bg-[#FAFDFB]'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-[#14532D] uppercase">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>2. Tahun Ajaran, Tanggal Dicetak &amp; Periode</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#11221A]">
                  Tahun Ajaran
                </label>
                <input
                  type="text"
                  value={headerForm.tahunAjaran}
                  onChange={(e) =>
                    setHeaderForm({ ...headerForm, tahunAjaran: e.target.value })
                  }
                  placeholder="2026/2027"
                  className="w-full rounded-lg border border-[#D4E0D9] bg-white px-3 py-2 text-sm text-[#11221A] focus:border-[#14532D] focus:outline-none"
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {['2025/2026', '2026/2027', '2027/2028'].map((ta) => (
                    <button
                      key={ta}
                      type="button"
                      onClick={() =>
                        setHeaderForm({ ...headerForm, tahunAjaran: ta })
                      }
                      className="rounded-md border border-[#D4DDD7] bg-white px-2 py-0.5 text-[11px] font-medium text-[#334155] hover:border-[#14532D]/40 hover:text-[#14532D]"
                    >
                      {ta}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#11221A]">
                    Tanggal Dicetak
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setHeaderForm({ ...headerForm, printedDate: getTodayISO() })
                    }
                    className="text-[11px] font-semibold text-[#14532D] hover:underline"
                  >
                    Hari Ini
                  </button>
                </div>
                <input
                  type="date"
                  value={headerForm.printedDate}
                  onChange={(e) =>
                    setHeaderForm({ ...headerForm, printedDate: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#D4E0D9] bg-white px-3 py-2 text-sm text-[#11221A] focus:border-[#14532D] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-[#11221A]">
                  Keterangan Periode Laporan
                </label>
                {headerForm.customPeriodLabel && (
                  <button
                    type="button"
                    onClick={() =>
                      setHeaderForm({ ...headerForm, customPeriodLabel: '' })
                    }
                    className="text-[11px] font-semibold text-[#5B6F65] hover:text-[#14532D] hover:underline"
                  >
                    Ikuti Filter Tanggal ({autoPeriodLabel})
                  </button>
                )}
              </div>
              <input
                type="text"
                value={headerForm.customPeriodLabel}
                onChange={(e) =>
                  setHeaderForm({
                    ...headerForm,
                    customPeriodLabel: e.target.value,
                  })
                }
                placeholder={`Kosongkan untuk otomatis (${autoPeriodLabel}) atau ketik mis. Semester Ganjil 2026/2027`}
                className="w-full rounded-lg border border-[#D4E0D9] bg-white px-3 py-2 text-sm text-[#11221A] focus:border-[#14532D] focus:outline-none"
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[
                  `Semester Ganjil ${headerForm.tahunAjaran || '2026/2027'}`,
                  `Semester Genap ${headerForm.tahunAjaran || '2026/2027'}`,
                  `Tahun Pelajaran ${headerForm.tahunAjaran || '2026/2027'}`,
                  'Triwulan I',
                  'Triwulan II',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setHeaderForm({ ...headerForm, customPeriodLabel: preset })
                    }
                    className="rounded-md border border-[#D4DDD7] bg-white px-2 py-0.5 text-[11px] font-medium text-[#334155] hover:border-[#14532D]/40 hover:text-[#14532D]"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Preview Kop Laporan */}
          <div className="rounded-xl border border-[#E2EAE5] bg-white p-4">
            <div className="mb-2.5 text-[11px] font-semibold tracking-wide text-[#5B6F65] uppercase">
              Pratinjau Kop Laporan
            </div>
            <div className="flex flex-col justify-between gap-3 border-b-2 border-[#14532D] pb-3.5 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold tracking-wider text-[#14532D] uppercase">
                  LAPORAN PENGELOLAAN KEMITRAAN SEKOLAH · MITRA KITA
                </div>
                <div className="mt-0.5 text-base font-bold text-[#11221A]">
                  {activeSchoolTitle}
                </div>
                <div className="mt-0.5 text-[11px] text-[#52635A]">
                  {headerForm.alamatSekolah.trim() || 'Alamat sekolah belum diisi'}
                  {headerForm.npsn.trim()
                    ? ` · NPSN: ${headerForm.npsn.trim()}`
                    : ''}
                </div>
              </div>
              <div className="shrink-0 rounded-lg border border-[#DCE6DF] bg-[#F8FBF9] px-3 py-2 text-[11px] tabular-nums sm:min-w-[205px]">
                <div className="flex justify-between gap-3">
                  <span className="text-[#5B6F65]">Tahun Ajaran</span>
                  <span className="font-semibold text-[#11221A]">
                    {headerForm.tahunAjaran.trim() || '2026/2027'}
                  </span>
                </div>
                <div className="mt-0.5 flex justify-between gap-3">
                  <span className="text-[#5B6F65]">Dicetak</span>
                  <span className="font-semibold text-[#11221A]">
                    {formatDateID(headerForm.printedDate || getTodayISO())}
                  </span>
                </div>
                <div className="mt-0.5 flex justify-between gap-3">
                  <span className="text-[#5B6F65]">Periode</span>
                  <span className="font-semibold text-[#14532D]">
                    {headerForm.customPeriodLabel.trim() || autoPeriodLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-[#EEF3F0] pt-4">
            <button
              type="button"
              onClick={() => setHeaderModalOpen(false)}
              className="rounded-xl border border-[#D4E0D9] bg-white px-4 py-2 text-sm font-medium text-[#11221A] hover:bg-[#F5FAF7]"
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#14532D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0E3F22]"
            >
              <Save className="h-4 w-4" />
              <span>Simpan Kop Laporan</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
