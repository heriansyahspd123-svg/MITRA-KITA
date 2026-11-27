import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Eye,
  FileSpreadsheet,
  Link2,
  MessageSquarePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import type { ProgramNavIntent } from '../App';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  FieldExampleHint,
  FormFillExampleBar,
} from '../components/FieldExampleHint';
import { Modal } from '../components/Modal';
import { useMitraKita } from '../context/MitraKitaContext';
import {
  PARTNER_FIELD_EXAMPLES,
  PROGRAM_FIELD_EXAMPLES,
} from '../data/fieldExamples';
import {
  PARTNER_CATEGORIES,
  PM_LEADERSHIP_AREAS,
  PROGRAM_STATUSES,
  Partner,
  PartnerCategory,
  PartnershipProgram,
  PmLeadershipArea,
  ProgramStatus,
} from '../types/mitraKita';
import {
  formatCurrencyIDR,
  formatDateID,
  getPmAreaCode,
  getStatusTextClass,
  getTodayISO,
} from '../utils/formatters';

function suggestPmAreaForCategory(category?: PartnerCategory): PmLeadershipArea {
  if (category === 'Puskesmas') return 'Lingkungan Belajar';
  return 'Kemitraan Pembelajaran';
}

function summarizePartnerContributions(partners: Partner[]): string {
  const unique = Array.from(
    new Set(
      partners
        .map((p) => p.jenisKontribusi.trim())
        .filter((text) => text.length > 0)
    )
  );
  return unique.join('; ').slice(0, 950);
}

interface ProgramFormState {
  namaSekolah: string;
  kodeProgram: string;
  namaProgram: string;
  latarBelakang: string;
  tujuan: string;
  areaPm: PmLeadershipArea;
  partnerIds: string[];
  sasaran: string;
  bentukKontribusi: string;
  strategiPelaksanaan: string;
  waktuPelaksanaan: string;
  penanggungJawab: string;
  sumberPembiayaan: string;
  anggaranRencana: string;
  indikatorKeberhasilan: string;
  targetHasil: string;
  status: ProgramStatus;
}

interface ProgramsPageProps {
  navIntent?: ProgramNavIntent | null;
  onClearNavIntent?: () => void;
  onOpenPartnerDetail?: (partnerId: string) => void;
  onOpenArkasImport?: () => void;
}

export const ProgramsPage: React.FC<ProgramsPageProps> = ({
  navIntent,
  onClearNavIntent,
  onOpenPartnerDetail,
  onOpenArkasImport,
}) => {
  const {
    dataset,
    session,
    isAdmin,
    isPengawas,
    addPartner,
    getNextPartnerId,
    addProgram,
    updateProgram,
    deleteProgram,
    getNextProgramCode,
    addSupervisorNote,
    deleteSupervisorNote,
  } = useMitraKita();

  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [partnerFilter, setPartnerFilter] = useState<string>('ALL');

  const [formOpen, setFormOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<PartnershipProgram | null>(
    null
  );
  const [detailProgramId, setDetailProgramId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartnershipProgram | null>(null);
  const [onlySchoolPartners, setOnlySchoolPartners] = useState(false);

  // Inline quick-add partner state inside Program modal
  const [quickPartnerOpen, setQuickPartnerOpen] = useState(false);
  const [quickPartnerForm, setQuickPartnerForm] = useState<{
    nama: string;
    kategori: PartnerCategory;
    penanggungJawab: string;
    telepon: string;
    jenisKontribusi: string;
  }>({
    nama: '',
    kategori: 'Puskesmas',
    penanggungJawab: '',
    telepon: '',
    jenisKontribusi: '',
  });
  const [quickPartnerError, setQuickPartnerError] = useState('');

  const [form, setForm] = useState<ProgramFormState>({
    namaSekolah: '',
    kodeProgram: '',
    namaProgram: '',
    latarBelakang: '',
    tujuan: '',
    areaPm: 'Kemitraan Pembelajaran',
    partnerIds: [],
    sasaran: '',
    bentukKontribusi: '',
    strategiPelaksanaan: '',
    waktuPelaksanaan: '',
    penanggungJawab: '',
    sumberPembiayaan: '',
    anggaranRencana: '0',
    indikatorKeberhasilan: '',
    targetHasil: '',
    status: 'Direncanakan',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Pengawas coaching note state inside program detail
  const [noteText, setNoteText] = useState('');
  const [noteRec, setNoteRec] = useState('');

  const partnerById = useMemo(() => {
    const map = new Map<string, Partner>();
    for (const p of dataset.partners) map.set(p.id, p);
    return map;
  }, [dataset.partners]);

  const partnerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of dataset.partners) map.set(p.id, p.nama);
    return map;
  }, [dataset.partners]);

  const filteredPrograms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.programs.filter((prg) => {
      const matchArea = areaFilter === 'ALL' || prg.areaPm === areaFilter;
      const matchStatus = statusFilter === 'ALL' || prg.status === statusFilter;
      const matchPartner =
        partnerFilter === 'ALL' || prg.partnerIds.includes(partnerFilter);
      const linkedNames = prg.partnerIds
        .map((id) => partnerMap.get(id) ?? '')
        .join(' ')
        .toLowerCase();
      const matchSearch =
        q === '' ||
        (prg.namaSekolah ?? '').toLowerCase().includes(q) ||
        prg.kodeProgram.toLowerCase().includes(q) ||
        prg.namaProgram.toLowerCase().includes(q) ||
        prg.penanggungJawab.toLowerCase().includes(q) ||
        prg.tujuan.toLowerCase().includes(q) ||
        linkedNames.includes(q);
      return matchArea && matchStatus && matchPartner && matchSearch;
    });
  }, [
    dataset.programs,
    search,
    areaFilter,
    statusFilter,
    partnerFilter,
    partnerMap,
  ]);

  const detailProgram = useMemo(
    () => dataset.programs.find((p) => p.id === detailProgramId) ?? null,
    [dataset.programs, detailProgramId]
  );

  const detailActivities = useMemo(
    () =>
      detailProgram
        ? dataset.activities.filter((a) => a.programId === detailProgram.id)
        : [],
    [dataset.activities, detailProgram]
  );

  const detailEvidences = useMemo(
    () =>
      detailProgram
        ? dataset.evidences.filter((e) => e.programId === detailProgram.id)
        : [],
    [dataset.evidences, detailProgram]
  );

  const detailNotes = useMemo(
    () =>
      detailProgram
        ? dataset.supervisorNotes.filter(
            (n) => n.targetType === 'PROGRAM' && n.targetId === detailProgram.id
          )
        : [],
    [dataset.supervisorNotes, detailProgram]
  );

  useEffect(() => {
    if (!navIntent) return;
    if (navIntent.type === 'createForPartner') {
      const targetPartner = navIntent.partner;
      setEditingProgram(null);
      setFormErrors({});
      setQuickPartnerOpen(false);
      setOnlySchoolPartners(false);
      setForm({
        namaSekolah:
          targetPartner.namaSekolah ||
          (dataset.schoolProfile.namaSekolah !== 'Nama Sekolah Binaan'
            ? dataset.schoolProfile.namaSekolah
            : ''),
        kodeProgram: getNextProgramCode(),
        namaProgram: '',
        latarBelakang: '',
        tujuan: '',
        areaPm: suggestPmAreaForCategory(targetPartner.kategori),
        partnerIds: [targetPartner.id],
        sasaran: '',
        bentukKontribusi: targetPartner.jenisKontribusi ?? '',
        strategiPelaksanaan: '',
        waktuPelaksanaan: '',
        penanggungJawab: '',
        sumberPembiayaan: '',
        anggaranRencana: '0',
        indikatorKeberhasilan: '',
        targetHasil: '',
        status: 'Direncanakan',
      });
      setFormOpen(true);
    } else if (navIntent.type === 'filterByPartner') {
      setPartnerFilter(navIntent.partnerId);
    } else if (navIntent.type === 'openDetail') {
      setDetailProgramId(navIntent.programId);
    }
    onClearNavIntent?.();
  }, [
    navIntent,
    onClearNavIntent,
    dataset.schoolProfile.namaSekolah,
    getNextProgramCode,
  ]);

  const openCreateModal = () => {
    const preselectedPartner =
      partnerFilter !== 'ALL' ? partnerById.get(partnerFilter) : undefined;
    setEditingProgram(null);
    setFormErrors({});
    setQuickPartnerOpen(false);
    setOnlySchoolPartners(false);
    setForm({
      namaSekolah:
        preselectedPartner?.namaSekolah ||
        (dataset.schoolProfile.namaSekolah !== 'Nama Sekolah Binaan'
          ? dataset.schoolProfile.namaSekolah
          : ''),
      kodeProgram: getNextProgramCode(),
      namaProgram: '',
      latarBelakang: '',
      tujuan: '',
      areaPm: suggestPmAreaForCategory(preselectedPartner?.kategori),
      partnerIds: preselectedPartner ? [preselectedPartner.id] : [],
      sasaran: '',
      bentukKontribusi: preselectedPartner?.jenisKontribusi ?? '',
      strategiPelaksanaan: '',
      waktuPelaksanaan: '',
      penanggungJawab: '',
      sumberPembiayaan: '',
      anggaranRencana: '0',
      indikatorKeberhasilan: '',
      targetHasil: '',
      status: 'Direncanakan',
    });
    setFormOpen(true);
  };

  const openEditModal = (prg: PartnershipProgram) => {
    setEditingProgram(prg);
    setFormErrors({});
    setQuickPartnerOpen(false);
    setOnlySchoolPartners(false);
    setForm({
      namaSekolah: prg.namaSekolah ?? '',
      kodeProgram: prg.kodeProgram,
      namaProgram: prg.namaProgram,
      latarBelakang: prg.latarBelakang,
      tujuan: prg.tujuan,
      areaPm: prg.areaPm,
      partnerIds: [...prg.partnerIds],
      sasaran: prg.sasaran,
      bentukKontribusi: prg.bentukKontribusi,
      strategiPelaksanaan: prg.strategiPelaksanaan,
      waktuPelaksanaan: prg.waktuPelaksanaan,
      penanggungJawab: prg.penanggungJawab,
      sumberPembiayaan: prg.sumberPembiayaan,
      anggaranRencana: String(prg.anggaranRencana),
      indikatorKeberhasilan: prg.indikatorKeberhasilan,
      targetHasil: prg.targetHasil,
      status: prg.status,
    });
    setFormOpen(true);
  };

  const togglePartnerId = (partnerId: string) => {
    setForm((prev) => {
      const isAdding = !prev.partnerIds.includes(partnerId);
      const nextPartnerIds = isAdding
        ? [...prev.partnerIds, partnerId]
        : prev.partnerIds.filter((id) => id !== partnerId);

      const addedPartner = isAdding ? partnerById.get(partnerId) : undefined;
      const nextSchool =
        !prev.namaSekolah.trim() && addedPartner?.namaSekolah
          ? addedPartner.namaSekolah
          : prev.namaSekolah;

      const selectedPartners = nextPartnerIds
        .map((id) => partnerById.get(id))
        .filter((p): p is Partner => Boolean(p));
      const nextContribution =
        isAdding && !prev.bentukKontribusi.trim() && selectedPartners.length > 0
          ? summarizePartnerContributions(selectedPartners)
          : prev.bentukKontribusi;

      return {
        ...prev,
        namaSekolah: nextSchool,
        partnerIds: nextPartnerIds,
        bentukKontribusi: nextContribution,
      };
    });
  };

  const syncContributionFromSelectedPartners = () => {
    const selectedPartners = form.partnerIds
      .map((id) => partnerById.get(id))
      .filter((p): p is Partner => Boolean(p));
    if (selectedPartners.length === 0) return;
    const summary = summarizePartnerContributions(selectedPartners);
    if (summary) {
      setForm((prev) => ({ ...prev, bentukKontribusi: summary }));
    }
  };

  const handleQuickAddPartner = () => {
    const schoolName =
      form.namaSekolah.trim() ||
      (dataset.schoolProfile.namaSekolah !== 'Nama Sekolah Binaan'
        ? dataset.schoolProfile.namaSekolah
        : '') ||
      PARTNER_FIELD_EXAMPLES.namaSekolah[0];

    if (!quickPartnerForm.nama.trim()) {
      setQuickPartnerError('Nama mitra/lembaga wajib diisi.');
      return;
    }
    if (!quickPartnerForm.penanggungJawab.trim()) {
      setQuickPartnerError('Nama penanggung jawab mitra wajib diisi.');
      return;
    }

    const newId = getNextPartnerId();
    const contribution = quickPartnerForm.jenisKontribusi.trim();
    const ok = addPartner({
      id: newId,
      namaSekolah: schoolName,
      nama: quickPartnerForm.nama.trim(),
      kategori: quickPartnerForm.kategori,
      penanggungJawab: quickPartnerForm.penanggungJawab.trim(),
      telepon: quickPartnerForm.telepon.trim(),
      alamat: '',
      jenisKontribusi: contribution,
      potensiKerjaSama: '',
      status: 'Aktif',
      catatan: '',
    });

    if (ok) {
      setForm((prev) => ({
        ...prev,
        namaSekolah: prev.namaSekolah.trim() || schoolName,
        partnerIds: Array.from(new Set([...prev.partnerIds, newId])),
        bentukKontribusi: prev.bentukKontribusi.trim()
          ? prev.bentukKontribusi
          : contribution,
      }));
      setQuickPartnerForm({
        nama: '',
        kategori: 'Puskesmas',
        penanggungJawab: '',
        telepon: '',
        jenisKontribusi: '',
      });
      setQuickPartnerError('');
      setQuickPartnerOpen(false);
    }
  };

  const sortedSelectablePartners = useMemo(() => {
    const schoolNorm = form.namaSekolah.trim().toLowerCase();
    const base = onlySchoolPartners && schoolNorm
      ? dataset.partners.filter(
          (p) =>
            (p.namaSekolah ?? '').trim().toLowerCase() === schoolNorm ||
            form.partnerIds.includes(p.id)
        )
      : [...dataset.partners];

    return base.sort((a, b) => {
      const aChecked = form.partnerIds.includes(a.id);
      const bChecked = form.partnerIds.includes(b.id);
      if (aChecked !== bChecked) return aChecked ? -1 : 1;
      const aMatch =
        schoolNorm !== '' &&
        (a.namaSekolah ?? '').trim().toLowerCase() === schoolNorm;
      const bMatch =
        schoolNorm !== '' &&
        (b.namaSekolah ?? '').trim().toLowerCase() === schoolNorm;
      if (aMatch !== bMatch) return aMatch ? -1 : 1;
      return a.nama.localeCompare(b.nama, 'id');
    });
  }, [dataset.partners, form.namaSekolah, form.partnerIds, onlySchoolPartners]);

  const matchingSchoolPartnerCount = useMemo(() => {
    const schoolNorm = form.namaSekolah.trim().toLowerCase();
    if (!schoolNorm) return 0;
    return dataset.partners.filter(
      (p) => (p.namaSekolah ?? '').trim().toLowerCase() === schoolNorm
    ).length;
  }, [dataset.partners, form.namaSekolah]);

  const fillProgramExample = () => {
    setFormErrors({});
    setForm((prev) => {
      const targetSchool =
        prev.namaSekolah.trim() || PROGRAM_FIELD_EXAMPLES.namaSekolah[0];
      const schoolNorm = targetSchool.toLowerCase();

      // Auto-link matching partner(s) from Data Mitra when none are selected yet
      let nextPartnerIds = prev.partnerIds;
      if (nextPartnerIds.length === 0 && dataset.partners.length > 0) {
        const sameSchoolPartners = dataset.partners.filter(
          (p) =>
            p.status !== 'Tidak Aktif' &&
            (p.namaSekolah ?? '').trim().toLowerCase() === schoolNorm
        );
        if (sameSchoolPartners.length > 0) {
          nextPartnerIds = [sameSchoolPartners[0].id];
        } else {
          const activePartner = dataset.partners.find(
            (p) => p.status !== 'Tidak Aktif'
          );
          if (activePartner) nextPartnerIds = [activePartner.id];
        }
      }

      const linkedPartners = nextPartnerIds
        .map((id) => partnerById.get(id))
        .filter((p): p is Partner => Boolean(p));
      const syncedContribution = summarizePartnerContributions(linkedPartners);

      return {
        ...prev,
        namaSekolah: targetSchool,
        kodeProgram: prev.kodeProgram.trim() || getNextProgramCode(),
        namaProgram: PROGRAM_FIELD_EXAMPLES.namaProgram[0],
        latarBelakang: PROGRAM_FIELD_EXAMPLES.latarBelakang[0],
        tujuan: PROGRAM_FIELD_EXAMPLES.tujuan[0],
        areaPm: 'Lingkungan Belajar',
        partnerIds: nextPartnerIds,
        sasaran: PROGRAM_FIELD_EXAMPLES.sasaran[0],
        bentukKontribusi:
          syncedContribution || PROGRAM_FIELD_EXAMPLES.bentukKontribusi[0],
        strategiPelaksanaan: PROGRAM_FIELD_EXAMPLES.strategiPelaksanaan[0],
        waktuPelaksanaan: PROGRAM_FIELD_EXAMPLES.waktuPelaksanaan[0],
        penanggungJawab: PROGRAM_FIELD_EXAMPLES.penanggungJawab[0],
        sumberPembiayaan: PROGRAM_FIELD_EXAMPLES.sumberPembiayaan[0],
        anggaranRencana: PROGRAM_FIELD_EXAMPLES.anggaranRencana[0],
        indikatorKeberhasilan: PROGRAM_FIELD_EXAMPLES.indikatorKeberhasilan[0],
        targetHasil: PROGRAM_FIELD_EXAMPLES.targetHasil[0],
        status: editingProgram ? prev.status : 'Direncanakan',
      };
    });
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.namaSekolah.trim())
      errs.namaSekolah = 'Nama sekolah wajib diisi.';
    if (!form.kodeProgram.trim()) errs.kodeProgram = 'Kode program wajib diisi.';
    if (!form.namaProgram.trim()) errs.namaProgram = 'Nama program wajib diisi.';
    if (!form.tujuan.trim()) errs.tujuan = 'Tujuan program wajib diisi.';
    if (!form.penanggungJawab.trim())
      errs.penanggungJawab = 'Penanggung jawab wajib diisi.';
    if (!form.waktuPelaksanaan.trim())
      errs.waktuPelaksanaan = 'Waktu pelaksanaan wajib diisi.';
    const budget = Number(form.anggaranRencana);
    if (Number.isNaN(budget) || budget < 0)
      errs.anggaranRencana = 'Anggaran harus berupa angka nol atau positif.';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      namaSekolah: form.namaSekolah.trim(),
      kodeProgram: form.kodeProgram.trim(),
      namaProgram: form.namaProgram.trim(),
      latarBelakang: form.latarBelakang.trim(),
      tujuan: form.tujuan.trim(),
      areaPm: form.areaPm,
      partnerIds: form.partnerIds,
      sasaran: form.sasaran.trim(),
      bentukKontribusi: form.bentukKontribusi.trim(),
      strategiPelaksanaan: form.strategiPelaksanaan.trim(),
      waktuPelaksanaan: form.waktuPelaksanaan.trim(),
      penanggungJawab: form.penanggungJawab.trim(),
      sumberPembiayaan: form.sumberPembiayaan.trim(),
      anggaranRencana: Number(form.anggaranRencana) || 0,
      indikatorKeberhasilan: form.indikatorKeberhasilan.trim(),
      targetHasil: form.targetHasil.trim(),
      status: form.status,
    };

    const ok = editingProgram
      ? updateProgram(editingProgram.id, payload)
      : addProgram(payload);
    if (ok) setFormOpen(false);
  };

  const handleAddSupervisorNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailProgram || !noteText.trim()) return;
    const ok = addSupervisorNote({
      namaSekolah: detailProgram.namaSekolah || '',
      targetType: 'PROGRAM',
      targetId: detailProgram.id,
      tanggal: getTodayISO(),
      pengawasNama:
        session?.namaPengawas ||
        dataset.schoolProfile.namaPengawas ||
        'Pengawas Sekolah',
      catatanPembinaan: noteText.trim(),
      rekomendasi: noteRec.trim() || '-',
    });
    if (ok) {
      setNoteText('');
      setNoteRec('');
    }
  };

  const programSummary = useMemo(() => {
    const activeCount = dataset.programs.filter(
      (p) => p.status === 'Sedang Berjalan' || p.status === 'Direncanakan'
    ).length;
    const totalBudget = dataset.programs.reduce(
      (sum, p) => sum + (Number(p.anggaranRencana) || 0),
      0
    );
    return {
      total: dataset.programs.length,
      activeCount,
      totalBudget,
      totalActivities: dataset.activities.length,
    };
  }, [dataset.activities.length, dataset.programs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-[#5B6F65]">
            Terintegrasi dengan 4 Area Kepemimpinan Pembelajaran Mendalam &amp;
            dokumen ARKAS
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#11221A]">
            Program Kemitraan Sekolah
          </h2>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenArkasImport && (
              <button
                type="button"
                onClick={onOpenArkasImport}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#14532D]/30 bg-[#EEF8F2] px-4 py-2.5 text-sm font-semibold text-[#14532D] hover:bg-[#E1F3E8] whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Impor ARKAS (PDF/Excel)</span>
              </button>
            )}
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0F3F22] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Buat Program Baru</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 divide-y divide-[#EBF0ED] overflow-hidden rounded-xl border border-[#E2EAE5] bg-white shadow-[0_1px_3px_rgba(16,38,26,0.04)] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#5B6F65]">Total Program</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#11221A] tabular-nums">
            {programSummary.total}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#5B6F65]">
            Direncanakan &amp; Berjalan
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#14532D] tabular-nums">
            {programSummary.activeCount}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#5B6F65]">
            Total Anggaran Rencana
          </p>
          <p className="mt-1 truncate font-mono text-xl font-bold tracking-tight text-[#11221A] tabular-nums">
            {formatCurrencyIDR(programSummary.totalBudget)}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#5B6F65]">
            Kegiatan Terhubung
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#11221A] tabular-nums">
            {programSummary.totalActivities}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-xl border border-[#E2EAE5] bg-white p-4 shadow-[0_1px_3px_rgba(16,38,26,0.04)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-4">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B7F74]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode, program, mitra, atau PJ..."
              className="w-full rounded-lg border border-[#D4E0D9] bg-[#FAFDFB] py-2.5 pr-3.5 pl-10 text-sm text-[#11221A] placeholder:text-[#7B8E84] focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/15 focus:outline-none"
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={partnerFilter}
              onChange={(e) => setPartnerFilter(e.target.value)}
              aria-label="Filter berdasarkan mitra"
              className="w-full rounded-lg border border-[#D4E0D9] bg-[#FAFDFB] px-3.5 py-2.5 text-sm text-[#11221A] focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/15 focus:outline-none"
            >
              <option value="ALL">Semua Mitra Terkait</option>
              {dataset.partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} ({p.id})
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              aria-label="Filter Area Kepemimpinan PM"
              className="w-full rounded-lg border border-[#D4E0D9] bg-[#FAFDFB] px-3.5 py-2.5 text-sm text-[#11221A] focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/15 focus:outline-none"
            >
              <option value="ALL">Semua Area Kepemimpinan PM</option>
              {PM_LEADERSHIP_AREAS.map((area) => (
                <option key={area.code} value={area.label}>
                  {area.code}. {area.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter status program"
              className="w-full rounded-lg border border-[#D4E0D9] bg-[#FAFDFB] px-3.5 py-2.5 text-sm text-[#11221A] focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/15 focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              {PROGRAM_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {partnerFilter !== 'ALL' && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#D4E4DA] bg-[#F3FAF5] px-3.5 py-2.5 text-xs text-[#14532D]">
            <div className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              <span>
                Menampilkan program yang tertaut dengan mitra:{' '}
                <strong>{partnerMap.get(partnerFilter) ?? partnerFilter}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPartnerFilter('ALL')}
              className="inline-flex items-center gap-1 font-semibold text-[#14532D] hover:underline"
            >
              <X className="h-3.5 w-3.5" />
              <span>Tampilkan Semua</span>
            </button>
          </div>
        )}
      </div>

      {/* Programs List */}
      <div className="overflow-hidden rounded-xl border border-[#E2EAE5] bg-white shadow-[0_1px_3px_rgba(16,38,26,0.04)]">
        {filteredPrograms.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-semibold text-[#11221A]">
              {dataset.programs.length === 0
                ? 'Belum ada program kemitraan tersimpan'
                : 'Tidak ada program yang sesuai dengan filter'}
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[#5B6F65]">
              Rancang program kemitraan sekolah yang terhubung dengan mitra dan
              area Pembelajaran Mendalam, atau impor langsung dari file ARKAS.
            </p>
            {isAdmin && dataset.programs.length === 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                {onOpenArkasImport && (
                  <button
                    type="button"
                    onClick={onOpenArkasImport}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#14532D]/30 bg-[#EEF8F2] px-4 py-2.5 text-sm font-semibold text-[#14532D] hover:bg-[#E1F3E8]"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Impor dari File ARKAS</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0F3F22]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Buat Program Pertama</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#EDF2EF]">
            {filteredPrograms.map((prg) => {
              const linkedPartners = prg.partnerIds
                .map((id) => ({ id, name: partnerMap.get(id) }))
                .filter(
                  (item): item is { id: string; name: string } =>
                    Boolean(item.name)
                );
              const actCount = dataset.activities.filter(
                (a) => a.programId === prg.id
              ).length;
              const evCount = dataset.evidences.filter(
                (e) => e.programId === prg.id
              ).length;

              return (
                <div
                  key={prg.id}
                  className="flex flex-col justify-between gap-4 p-5 transition-colors hover:bg-[#F5FAF7]/80 sm:px-6 lg:flex-row lg:items-start"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5B6F65]">
                      <span className="font-mono font-semibold text-[#14532D]">
                        {prg.kodeProgram}
                      </span>
                      {prg.namaSekolah && (
                        <>
                          <span aria-hidden="true" className="text-[#A8B8AF]">
                            ·
                          </span>
                          <span className="font-semibold text-[#11221A]">
                            {prg.namaSekolah}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true" className="text-[#A8B8AF]">
                        ·
                      </span>
                      <span className="font-medium text-[#3D5247]">
                        {getPmAreaCode(prg.areaPm)}
                      </span>
                      <span aria-hidden="true" className="text-[#A8B8AF]">
                        ·
                      </span>
                      <span className={getStatusTextClass(prg.status)}>
                        {prg.status}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDetailProgramId(prg.id)}
                      className="text-left text-[15.5px] font-semibold leading-snug text-[#11221A] hover:text-[#14532D]"
                    >
                      {prg.namaProgram}
                    </button>

                    <p className="line-clamp-2 max-w-3xl text-[13.5px] leading-relaxed text-[#53675D]">
                      {prg.tujuan}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-xs text-[#5B6F65] tabular-nums">
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <span>Mitra:</span>
                        {linkedPartners.length > 0 ? (
                          linkedPartners.map((lp, idx) => (
                            <React.Fragment key={lp.id}>
                              {idx > 0 && (
                                <span className="text-[#94A3B8]">,</span>
                              )}
                              <button
                                type="button"
                                onClick={() => onOpenPartnerDetail?.(lp.id)}
                                className="inline-flex items-center gap-0.5 font-semibold text-[#14532D] hover:underline"
                                title={`Lihat detail mitra ${lp.name}`}
                              >
                                <span>{lp.name}</span>
                                <ArrowUpRight className="h-3 w-3" />
                              </button>
                            </React.Fragment>
                          ))
                        ) : (
                          <strong className="font-medium text-[#6B7F74]">
                            Belum ditautkan
                          </strong>
                        )}
                      </span>
                      <span>
                        Waktu:{' '}
                        <strong className="font-medium text-[#11221A]">
                          {prg.waktuPelaksanaan}
                        </strong>
                      </span>
                      <span>
                        Realisasi:{' '}
                        <strong className="font-medium text-[#11221A]">
                          {actCount} kegiatan · {evCount} bukti
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-t border-[#EEF3F0] pt-3 lg:flex-col lg:items-end lg:border-t-0 lg:pt-0">
                    <div className="text-left lg:text-right">
                      <p className="text-[11px] font-medium text-[#5B6F65]">
                        Anggaran Rencana
                      </p>
                      <p className="font-mono text-sm font-bold text-[#14532D] tabular-nums">
                        {formatCurrencyIDR(prg.anggaranRencana)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailProgramId(prg.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4E0D9] bg-white px-3 py-2 text-xs font-semibold text-[#11221A] hover:border-[#B8CBBF] hover:bg-[#F5FAF7] whitespace-nowrap"
                      >
                        <Eye className="h-3.5 w-3.5 text-[#14532D]" />
                        <span>
                          {isPengawas ? 'Pantau & Pembinaan' : 'Detail'}
                        </span>
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(prg)}
                            disabled={prg.status === 'Dibatalkan'}
                            className="rounded-lg border border-[#D4E0D9] bg-white p-2 text-[#5B6F65] hover:border-[#B8CBBF] hover:bg-[#E7F5EC] hover:text-[#14532D] disabled:cursor-not-allowed disabled:opacity-40"
                            title={
                              prg.status === 'Dibatalkan'
                                ? 'Program dibatalkan terkunci dari pengubahan'
                                : 'Edit program'
                            }
                            aria-label={`Edit ${prg.namaProgram}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(prg)}
                            className="rounded-lg border border-[#D4E0D9] bg-white p-2 text-[#5B6F65] hover:border-red-200 hover:bg-red-50 hover:text-[#B91C1C]"
                            title="Hapus program"
                            aria-label={`Hapus ${prg.namaProgram}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Program Modal */}
      <Modal
        open={formOpen}
        title={
          editingProgram ? 'Edit Program Kemitraan' : 'Buat Program Kemitraan Baru'
        }
        subtitle="Isi rencana program kemitraan lengkap beserta area PM dan mitra yang terlibat."
        maxWidthClass="max-w-3xl"
        onClose={() => setFormOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormFillExampleBar onFillAll={fillProgramExample} />

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#14221B]">
              Nama Sekolah *
            </label>
            <input
              type="text"
              list="mitra-kita-school-list"
              value={form.namaSekolah}
              onChange={(e) =>
                setForm({ ...form, namaSekolah: e.target.value })
              }
              placeholder="Contoh: SD Negeri 01 Harapan Nusantara"
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
            <FieldExampleHint
              examples={PROGRAM_FIELD_EXAMPLES.namaSekolah}
              onApply={(val) => setForm({ ...form, namaSekolah: val })}
            />
            {formErrors.namaSekolah && (
              <p className="mt-1 text-xs text-[#B91C1C]">
                {formErrors.namaSekolah}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Kode Program *
              </label>
              <input
                type="text"
                value={form.kodeProgram}
                onChange={(e) =>
                  setForm({ ...form, kodeProgram: e.target.value })
                }
                placeholder="PRG-2026-01"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 font-mono text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={[getNextProgramCode(), ...PROGRAM_FIELD_EXAMPLES.kodeProgram]}
                onApply={(val) => setForm({ ...form, kodeProgram: val })}
              />
              {formErrors.kodeProgram && (
                <p className="mt-1 text-xs text-[#B91C1C]">
                  {formErrors.kodeProgram}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Area Kepemimpinan PM *
              </label>
              <select
                value={form.areaPm}
                onChange={(e) =>
                  setForm({
                    ...form,
                    areaPm: e.target.value as PmLeadershipArea,
                  })
                }
                className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              >
                {PM_LEADERSHIP_AREAS.map((area) => (
                  <option key={area.code} value={area.label}>
                    {area.code}. {area.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Status Program *
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as ProgramStatus })
                }
                className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              >
                {PROGRAM_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#14221B]">
              Nama Program *
            </label>
            <input
              type="text"
              value={form.namaProgram}
              onChange={(e) => setForm({ ...form, namaProgram: e.target.value })}
              placeholder="Contoh: Kelas Inspirasi Orang Tua"
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
            <FieldExampleHint
              examples={PROGRAM_FIELD_EXAMPLES.namaProgram}
              onApply={(val) => setForm({ ...form, namaProgram: val })}
            />
            {formErrors.namaProgram && (
              <p className="mt-1 text-xs text-[#B91C1C]">
                {formErrors.namaProgram}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Latar Belakang
              </label>
              <textarea
                rows={3}
                value={form.latarBelakang}
                onChange={(e) =>
                  setForm({ ...form, latarBelakang: e.target.value })
                }
                placeholder="Kebutuhan sekolah atau tantangan pembelajaran yang melatarbelakangi program"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={PROGRAM_FIELD_EXAMPLES.latarBelakang}
                onApply={(val) => setForm({ ...form, latarBelakang: val })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Tujuan Program *
              </label>
              <textarea
                rows={3}
                value={form.tujuan}
                onChange={(e) => setForm({ ...form, tujuan: e.target.value })}
                placeholder="Hasil pembelajaran dan kemitraan yang ingin dicapai"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={PROGRAM_FIELD_EXAMPLES.tujuan}
                onApply={(val) => setForm({ ...form, tujuan: val })}
              />
              {formErrors.tujuan && (
                <p className="mt-1 text-xs text-[#B91C1C]">{formErrors.tujuan}</p>
              )}
            </div>
          </div>

          {/* Multi-select Partners + Inline Quick-Add */}
          <div className="rounded-lg border border-[#DCE8E0] bg-[#F7FAF8] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#14221B]">
                <Link2 className="h-3.5 w-3.5 text-[#14532D]" />
                <span>
                  Mitra yang Terlibat ({form.partnerIds.length} dipilih)
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {matchingSchoolPartnerCount > 0 &&
                  dataset.partners.length > matchingSchoolPartnerCount && (
                    <button
                      type="button"
                      onClick={() => setOnlySchoolPartners((v) => !v)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                        onlySchoolPartners
                          ? 'border-[#14532D] bg-[#14532D] text-white'
                          : 'border-[#D4DDD7] bg-white text-[#52635A] hover:text-[#14532D]'
                      }`}
                    >
                      {onlySchoolPartners
                        ? `Hanya sekolah ini (${matchingSchoolPartnerCount})`
                        : `Semua sekolah (${dataset.partners.length})`}
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => {
                    setQuickPartnerError('');
                    setQuickPartnerOpen((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-[#14532D]/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#14532D] hover:bg-[#ECFDF5]"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>
                    {quickPartnerOpen
                      ? 'Tutup Form Mitra Cepat'
                      : '+ Tambah Mitra Baru & Tautkan'}
                  </span>
                </button>
              </div>
            </div>

            {/* Inline Quick-Add Partner Panel */}
            {quickPartnerOpen && (
              <div className="mt-3 space-y-3 rounded-lg border border-[#14532D]/25 bg-white p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#14532D]">
                    Tambah Mitra Cepat (otomatis tersimpan ke Data Mitra &amp; tertaut ke program ini)
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                      Nama Mitra / Lembaga *
                    </label>
                    <input
                      type="text"
                      value={quickPartnerForm.nama}
                      onChange={(e) =>
                        setQuickPartnerForm((prev) => ({
                          ...prev,
                          nama: e.target.value,
                        }))
                      }
                      placeholder="Contoh: Puskesmas Kecamatan Cendekia"
                      className="w-full rounded-lg border border-[#D4DDD7] px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                    />
                    <FieldExampleHint
                      examples={PARTNER_FIELD_EXAMPLES.nama}
                      onApply={(val) =>
                        setQuickPartnerForm((prev) => ({ ...prev, nama: val }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                      Kategori Mitra *
                    </label>
                    <select
                      value={quickPartnerForm.kategori}
                      onChange={(e) =>
                        setQuickPartnerForm((prev) => ({
                          ...prev,
                          kategori: e.target.value as PartnerCategory,
                        }))
                      }
                      className="w-full rounded-lg border border-[#D4DDD7] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                    >
                      {PARTNER_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                      Penanggung Jawab *
                    </label>
                    <input
                      type="text"
                      value={quickPartnerForm.penanggungJawab}
                      onChange={(e) =>
                        setQuickPartnerForm((prev) => ({
                          ...prev,
                          penanggungJawab: e.target.value,
                        }))
                      }
                      placeholder="Nama kontak utama mitra"
                      className="w-full rounded-lg border border-[#D4DDD7] px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                    />
                    <FieldExampleHint
                      examples={PARTNER_FIELD_EXAMPLES.penanggungJawab}
                      onApply={(val) =>
                        setQuickPartnerForm((prev) => ({
                          ...prev,
                          penanggungJawab: val,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                      Nomor Telepon
                    </label>
                    <input
                      type="text"
                      value={quickPartnerForm.telepon}
                      onChange={(e) =>
                        setQuickPartnerForm((prev) => ({
                          ...prev,
                          telepon: e.target.value,
                        }))
                      }
                      placeholder="0812-xxxx-xxxx"
                      className="w-full rounded-lg border border-[#D4DDD7] px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                    />
                    <FieldExampleHint
                      examples={PARTNER_FIELD_EXAMPLES.telepon}
                      onApply={(val) =>
                        setQuickPartnerForm((prev) => ({
                          ...prev,
                          telepon: val,
                        }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                      Jenis Kontribusi Mitra
                    </label>
                    <input
                      type="text"
                      value={quickPartnerForm.jenisKontribusi}
                      onChange={(e) =>
                        setQuickPartnerForm((prev) => ({
                          ...prev,
                          jenisKontribusi: e.target.value,
                        }))
                      }
                      placeholder="Kontribusi mitra yang akan disinkronkan ke program"
                      className="w-full rounded-lg border border-[#D4DDD7] px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                    />
                    <FieldExampleHint
                      examples={PARTNER_FIELD_EXAMPLES.jenisKontribusi}
                      onApply={(val) =>
                        setQuickPartnerForm((prev) => ({
                          ...prev,
                          jenisKontribusi: val,
                        }))
                      }
                    />
                  </div>
                </div>
                {quickPartnerError && (
                  <p className="text-xs font-medium text-[#B91C1C]">
                    {quickPartnerError}
                  </p>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickPartnerOpen(false)}
                    className="rounded-md border border-[#D4DDD7] bg-white px-3 py-1.5 text-xs font-medium text-[#14221B] hover:bg-[#F6F8F7]"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickAddPartner}
                    className="rounded-md bg-[#14532D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0F3F22]"
                  >
                    Simpan &amp; Tautkan Mitra
                  </button>
                </div>
              </div>
            )}

            {dataset.partners.length === 0 ? (
              <p className="mt-2.5 rounded-lg border border-dashed border-[#D4DDD7] bg-white p-3 text-xs text-[#52635A]">
                Belum ada data mitra tersimpan. Klik tombol{' '}
                <strong>+ Tambah Mitra Baru &amp; Tautkan</strong> di atas untuk
                menambahkan mitra langsung dari sini tanpa menutup formulir program.
              </p>
            ) : (
              <div className="mt-2.5 grid max-h-44 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-[#D4DDD7] bg-white p-2.5 sm:grid-cols-2">
                {sortedSelectablePartners.map((partner) => {
                  const checked = form.partnerIds.includes(partner.id);
                  const sameSchool =
                    form.namaSekolah.trim() !== '' &&
                    (partner.namaSekolah ?? '').trim().toLowerCase() ===
                      form.namaSekolah.trim().toLowerCase();
                  return (
                    <label
                      key={partner.id}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-md p-2 text-xs transition-colors ${
                        checked ? 'bg-[#ECFDF5] text-[#14532D]' : 'hover:bg-[#F6F8F7]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePartnerId(partner.id)}
                        className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] accent-[#14532D]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-[#14221B]">
                          {partner.nama}
                        </span>
                        <span className="block text-[11px] text-[#52635A]">
                          {partner.id} · {partner.kategori}
                          {partner.namaSekolah ? ` · ${partner.namaSekolah}` : ''}
                        </span>
                        {sameSchool && (
                          <span className="mt-0.5 inline-block text-[10px] font-semibold text-[#14532D]">
                            Sesuai sekolah ini
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Sasaran
              </label>
              <input
                type="text"
                value={form.sasaran}
                onChange={(e) => setForm({ ...form, sasaran: e.target.value })}
                placeholder="Contoh: Siswa kelas IV–VI (120 peserta didik)"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={PROGRAM_FIELD_EXAMPLES.sasaran}
                onApply={(val) => setForm({ ...form, sasaran: val })}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-[#14221B]">
                  Bentuk Kontribusi Mitra
                </label>
                {form.partnerIds.length > 0 && (
                  <button
                    type="button"
                    onClick={syncContributionFromSelectedPartners}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#14532D] hover:underline"
                    title="Tarik jenis kontribusi dari mitra yang dipilih"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Tarik dari Mitra Terpilih</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={form.bentukKontribusi}
                onChange={(e) =>
                  setForm({ ...form, bentukKontribusi: e.target.value })
                }
                placeholder="Narasumber, fasilitas, tenaga ahli, atau bahan praktik"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={PROGRAM_FIELD_EXAMPLES.bentukKontribusi}
                onApply={(val) => setForm({ ...form, bentukKontribusi: val })}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#14221B]">
              Strategi Pelaksanaan
            </label>
            <textarea
              rows={2}
              value={form.strategiPelaksanaan}
              onChange={(e) =>
                setForm({ ...form, strategiPelaksanaan: e.target.value })
              }
              placeholder="Langkah koordinasi dan integrasi program dalam pembelajaran"
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
            <FieldExampleHint
              examples={PROGRAM_FIELD_EXAMPLES.strategiPelaksanaan}
              onApply={(val) => setForm({ ...form, strategiPelaksanaan: val })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Waktu Pelaksanaan *
              </label>
              <input
                type="text"
                value={form.waktuPelaksanaan}
                onChange={(e) =>
                  setForm({ ...form, waktuPelaksanaan: e.target.value })
                }
                placeholder="Contoh: September – Desember 2026"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={PROGRAM_FIELD_EXAMPLES.waktuPelaksanaan}
                onApply={(val) => setForm({ ...form, waktuPelaksanaan: val })}
              />
              {formErrors.waktuPelaksanaan && (
                <p className="mt-1 text-xs text-[#B91C1C]">
                  {formErrors.waktuPelaksanaan}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Penanggung Jawab *
              </label>
              <input
                type="text"
                value={form.penanggungJawab}
                onChange={(e) =>
                  setForm({ ...form, penanggungJawab: e.target.value })
                }
                placeholder="Nama guru/koordinator program"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={PROGRAM_FIELD_EXAMPLES.penanggungJawab}
                onApply={(val) => setForm({ ...form, penanggungJawab: val })}
              />
              {formErrors.penanggungJawab && (
                <p className="mt-1 text-xs text-[#B91C1C]">
                  {formErrors.penanggungJawab}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Sumber Pembiayaan
              </label>
              <input
                type="text"
                value={form.sumberPembiayaan}
                onChange={(e) =>
                  setForm({ ...form, sumberPembiayaan: e.target.value })
                }
                placeholder="Contoh: RKAS (BOS Reguler) / Swadaya Mitra"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={PROGRAM_FIELD_EXAMPLES.sumberPembiayaan}
                onApply={(val) => setForm({ ...form, sumberPembiayaan: val })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Anggaran Rencana (Rp)
              </label>
              <input
                type="number"
                min={0}
                step={50000}
                value={form.anggaranRencana}
                onChange={(e) =>
                  setForm({ ...form, anggaranRencana: e.target.value })
                }
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 font-mono text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={PROGRAM_FIELD_EXAMPLES.anggaranRencana}
                onApply={(val) => setForm({ ...form, anggaranRencana: val })}
              />
              {formErrors.anggaranRencana && (
                <p className="mt-1 text-xs text-[#B91C1C]">
                  {formErrors.anggaranRencana}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Indikator Keberhasilan
              </label>
              <textarea
                rows={2}
                value={form.indikatorKeberhasilan}
                onChange={(e) =>
                  setForm({ ...form, indikatorKeberhasilan: e.target.value })
                }
                placeholder="Ukuran ketercapaian pelaksanaan program"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={PROGRAM_FIELD_EXAMPLES.indikatorKeberhasilan}
                onApply={(val) =>
                  setForm({ ...form, indikatorKeberhasilan: val })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Target Hasil
              </label>
              <textarea
                rows={2}
                value={form.targetHasil}
                onChange={(e) =>
                  setForm({ ...form, targetHasil: e.target.value })
                }
                placeholder="Dampak nyata yang diharapkan pada siswa/sekolah"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={PROGRAM_FIELD_EXAMPLES.targetHasil}
                onApply={(val) => setForm({ ...form, targetHasil: val })}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-[#EEF2EF] pt-4">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-[#D4DDD7] bg-white px-4 py-2 text-sm font-medium text-[#14221B] hover:bg-[#F6F8F7]"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#14532D] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F3F22]"
            >
              {editingProgram ? 'Simpan Perubahan' : 'Simpan Program'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Program Modal (including Pengawas Pembinaan Section) */}
      <Modal
        open={Boolean(detailProgram)}
        title={detailProgram?.namaProgram ?? 'Detail Program'}
        subtitle={
          detailProgram
            ? `${detailProgram.kodeProgram} · ${getPmAreaCode(detailProgram.areaPm)} · ${detailProgram.status}`
            : undefined
        }
        maxWidthClass="max-w-3xl"
        onClose={() => setDetailProgramId(null)}
      >
        {detailProgram && (
          <div className="space-y-6 text-sm">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">Nama Sekolah</dt>
                <dd className="mt-1 font-semibold text-[#14532D]">
                  {detailProgram.namaSekolah || '-'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">Latar Belakang</dt>
                <dd className="mt-1 leading-relaxed text-[#14221B]">
                  {detailProgram.latarBelakang || '-'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">Tujuan</dt>
                <dd className="mt-1 leading-relaxed text-[#14221B]">
                  {detailProgram.tujuan}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">Mitra Terlibat</dt>
                <dd className="mt-1 font-medium text-[#14221B]">
                  {detailProgram.partnerIds.length > 0 ? (
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {detailProgram.partnerIds.map((pid) => {
                        const partner = partnerById.get(pid);
                        return (
                          <button
                            key={pid}
                            type="button"
                            onClick={() => {
                              setDetailProgramId(null);
                              onOpenPartnerDetail?.(pid);
                            }}
                            className="inline-flex items-center gap-1 text-left font-medium text-[#14532D] hover:underline"
                          >
                            <span>{partner ? partner.nama : pid}</span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    'Belum ada mitra ditautkan'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">Sasaran</dt>
                <dd className="mt-1 text-[#14221B]">
                  {detailProgram.sasaran || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Bentuk Kontribusi Mitra
                </dt>
                <dd className="mt-1 text-[#14221B]">
                  {detailProgram.bentukKontribusi || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Strategi Pelaksanaan
                </dt>
                <dd className="mt-1 text-[#14221B]">
                  {detailProgram.strategiPelaksanaan || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Waktu Pelaksanaan
                </dt>
                <dd className="mt-1 text-[#14221B]">
                  {detailProgram.waktuPelaksanaan}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Penanggung Jawab
                </dt>
                <dd className="mt-1 text-[#14221B]">
                  {detailProgram.penanggungJawab}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Sumber Pembiayaan
                </dt>
                <dd className="mt-1 text-[#14221B]">
                  {detailProgram.sumberPembiayaan || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Anggaran Rencana
                </dt>
                <dd className="mt-1 font-mono font-semibold text-[#14221B] tabular-nums">
                  {formatCurrencyIDR(detailProgram.anggaranRencana)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Indikator Keberhasilan
                </dt>
                <dd className="mt-1 text-[#14221B]">
                  {detailProgram.indikatorKeberhasilan || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">Target Hasil</dt>
                <dd className="mt-1 text-[#14221B]">
                  {detailProgram.targetHasil || '-'}
                </dd>
              </div>
            </dl>

            {/* Linked Activities & Evidence summary */}
            <div className="grid grid-cols-1 gap-4 border-t border-[#EEF2EF] pt-4 sm:grid-cols-2">
              <div>
                <h4 className="text-xs font-semibold text-[#14221B]">
                  Kegiatan Terkait ({detailActivities.length})
                </h4>
                {detailActivities.length === 0 ? (
                  <p className="mt-1.5 text-xs text-[#52635A]">
                    Belum ada kegiatan pada program ini.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2 text-xs">
                    {detailActivities.map((act) => (
                      <li key={act.id} className="flex justify-between gap-2">
                        <span className="text-[#14221B]">{act.namaKegiatan}</span>
                        <span className={`shrink-0 ${getStatusTextClass(act.status)}`}>
                          {act.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#14221B]">
                  Bukti Dokumentasi ({detailEvidences.length})
                </h4>
                {detailEvidences.length === 0 ? (
                  <p className="mt-1.5 text-xs text-[#52635A]">
                    Belum ada bukti terunggah.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2 text-xs">
                    {detailEvidences.map((ev) => (
                      <li key={ev.id} className="text-[#14221B]">
                        {ev.namaDokumen}{' '}
                        <span className="text-[#52635A]">({ev.jenis})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Catatan Pembinaan Pengawas */}
            <div className="border-t border-[#EEF2EF] pt-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-[#14221B]">
                  Catatan Pembinaan &amp; Rekomendasi Pengawas ({detailNotes.length})
                </h4>
              </div>

              {detailNotes.length === 0 ? (
                <p className="mt-2 text-xs text-[#52635A]">
                  Belum ada catatan pembinaan pengawas untuk program ini.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {detailNotes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-lg border border-[#E2E8E4] bg-[#F9FBFA] p-3.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 text-[#52635A]">
                        <span>
                          <strong className="text-[#14221B]">
                            {note.pengawasNama}
                          </strong>{' '}
                          · {formatDateID(note.tanggal)}
                        </span>
                        {isPengawas && (
                          <button
                            type="button"
                            onClick={() => deleteSupervisorNote(note.id)}
                            className="text-[#B91C1C] hover:underline"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                      <p className="mt-1.5 leading-relaxed text-[#14221B]">
                        {note.catatanPembinaan}
                      </p>
                      {note.rekomendasi && note.rekomendasi !== '-' && (
                        <p className="mt-1.5 text-[#14532D]">
                          <span className="font-semibold">Rekomendasi:</span>{' '}
                          {note.rekomendasi}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {isPengawas && (
                <form
                  onSubmit={handleAddSupervisorNote}
                  className="mt-4 space-y-3 rounded-lg border border-[#DCE5DF] bg-[#F0FDF4]/60 p-4"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#14532D]">
                    <MessageSquarePlus className="h-4 w-4" />
                    <span>Tambah Catatan Pembinaan Pengawas</span>
                  </div>
                  <div>
                    <textarea
                      rows={2}
                      required
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Tuliskan temuan atau catatan pembinaan untuk program ini..."
                      className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                    />
                    <FieldExampleHint
                      examples={PROGRAM_FIELD_EXAMPLES.supervisorNoteText}
                      onApply={setNoteText}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={noteRec}
                      onChange={(e) => setNoteRec(e.target.value)}
                      placeholder="Rekomendasi tindak lanjut (opsional)"
                      className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                    />
                    <FieldExampleHint
                      examples={PROGRAM_FIELD_EXAMPLES.supervisorNoteRec}
                      onApply={setNoteRec}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-lg bg-[#14532D] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#0F3F22]"
                    >
                      Simpan Catatan Pembinaan
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Program Kemitraan?"
        description={
          deleteTarget
            ? `Program "${deleteTarget.namaProgram}" (${deleteTarget.kodeProgram}) beserta kegiatan dan bukti dokumentasi yang terhubung dengannya akan dihapus permanen.`
            : ''
        }
        confirmLabel="Ya, Hapus Program"
        onConfirm={() => {
          if (deleteTarget) deleteProgram(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
