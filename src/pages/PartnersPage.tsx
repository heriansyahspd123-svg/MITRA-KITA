import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Eye,
  FolderPlus,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { PartnerNavIntent } from '../App';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  FieldExampleHint,
  FormFillExampleBar,
} from '../components/FieldExampleHint';
import { Modal } from '../components/Modal';
import { useMitraKita } from '../context/MitraKitaContext';
import { PARTNER_FIELD_EXAMPLES } from '../data/fieldExamples';
import {
  PARTNER_CATEGORIES,
  PARTNER_STATUSES,
  Partner,
  PartnerCategory,
  PartnerStatus,
} from '../types/mitraKita';
import { formatDateID, getStatusTextClass } from '../utils/formatters';

interface PartnerFormState {
  id: string;
  namaSekolah: string;
  nama: string;
  kategori: PartnerCategory;
  penanggungJawab: string;
  telepon: string;
  alamat: string;
  jenisKontribusi: string;
  potensiKerjaSama: string;
  status: PartnerStatus;
  catatan: string;
}

interface PartnersPageProps {
  navIntent?: PartnerNavIntent | null;
  onClearNavIntent?: () => void;
  onCreateProgramForPartner?: (partner: Partner) => void;
  onViewPartnerPrograms?: (partnerId: string) => void;
  onOpenProgramDetail?: (programId: string) => void;
}

export const PartnersPage: React.FC<PartnersPageProps> = ({
  navIntent,
  onClearNavIntent,
  onCreateProgramForPartner,
  onViewPartnerPrograms,
  onOpenProgramDetail,
}) => {
  const {
    dataset,
    isAdmin,
    addPartner,
    updatePartner,
    deletePartner,
    getNextPartnerId,
    syncPartnerProgramLinks,
  } = useMitraKita();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [detailPartnerId, setDetailPartnerId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);
  const [linkedProgramIds, setLinkedProgramIds] = useState<string[]>([]);

  const detailPartner = useMemo(
    () => dataset.partners.find((p) => p.id === detailPartnerId) ?? null,
    [dataset.partners, detailPartnerId]
  );

  useEffect(() => {
    if (!navIntent) return;
    if (navIntent.type === 'openDetail') {
      setDetailPartnerId(navIntent.partnerId);
    }
    onClearNavIntent?.();
  }, [navIntent, onClearNavIntent]);

  const [form, setForm] = useState<PartnerFormState>({
    id: '',
    namaSekolah: '',
    nama: '',
    kategori: 'Orang Tua',
    penanggungJawab: '',
    telepon: '',
    alamat: '',
    jenisKontribusi: '',
    potensiKerjaSama: '',
    status: 'Aktif',
    catatan: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.partners.filter((partner) => {
      const matchCategory =
        categoryFilter === 'ALL' || partner.kategori === categoryFilter;
      const matchStatus =
        statusFilter === 'ALL' || partner.status === statusFilter;
      const matchSearch =
        q === '' ||
        partner.id.toLowerCase().includes(q) ||
        (partner.namaSekolah ?? '').toLowerCase().includes(q) ||
        partner.nama.toLowerCase().includes(q) ||
        partner.penanggungJawab.toLowerCase().includes(q) ||
        partner.alamat.toLowerCase().includes(q) ||
        partner.jenisKontribusi.toLowerCase().includes(q);
      return matchCategory && matchStatus && matchSearch;
    });
  }, [dataset.partners, search, categoryFilter, statusFilter]);

  const openCreateModal = () => {
    setEditingPartner(null);
    setFormErrors({});
    setLinkedProgramIds([]);
    setForm({
      id: getNextPartnerId(),
      namaSekolah:
        dataset.schoolProfile.namaSekolah !== 'Nama Sekolah Binaan'
          ? dataset.schoolProfile.namaSekolah
          : '',
      nama: '',
      kategori: 'Orang Tua',
      penanggungJawab: '',
      telepon: '',
      alamat: '',
      jenisKontribusi: '',
      potensiKerjaSama: '',
      status: 'Aktif',
      catatan: '',
    });
    setFormModalOpen(true);
  };

  const openEditModal = (partner: Partner) => {
    setEditingPartner(partner);
    setFormErrors({});
    setLinkedProgramIds(
      dataset.programs
        .filter((p) => p.partnerIds.includes(partner.id))
        .map((p) => p.id)
    );
    setForm({
      id: partner.id,
      namaSekolah: partner.namaSekolah ?? '',
      nama: partner.nama,
      kategori: partner.kategori,
      penanggungJawab: partner.penanggungJawab,
      telepon: partner.telepon,
      alamat: partner.alamat,
      jenisKontribusi: partner.jenisKontribusi,
      potensiKerjaSama: partner.potensiKerjaSama,
      status: partner.status,
      catatan: partner.catatan,
    });
    setFormModalOpen(true);
  };

  const toggleLinkedProgramId = (programId: string) => {
    setLinkedProgramIds((prev) =>
      prev.includes(programId)
        ? prev.filter((id) => id !== programId)
        : [...prev, programId]
    );
  };

  const linkablePrograms = useMemo(() => {
    const schoolNorm = form.namaSekolah.trim().toLowerCase();
    return dataset.programs
      .filter((p) => p.status !== 'Dibatalkan')
      .sort((a, b) => {
        const aMatch =
          schoolNorm !== '' &&
          (a.namaSekolah ?? '').trim().toLowerCase() === schoolNorm;
        const bMatch =
          schoolNorm !== '' &&
          (b.namaSekolah ?? '').trim().toLowerCase() === schoolNorm;
        if (aMatch !== bMatch) return aMatch ? -1 : 1;
        return a.kodeProgram.localeCompare(b.kodeProgram);
      });
  }, [dataset.programs, form.namaSekolah]);

  const fillPartnerExample = () => {
    setFormErrors({});
    setForm((prev) => ({
      ...prev,
      id: editingPartner ? prev.id : prev.id.trim() || getNextPartnerId(),
      namaSekolah:
        prev.namaSekolah.trim() || PARTNER_FIELD_EXAMPLES.namaSekolah[0],
      nama: PARTNER_FIELD_EXAMPLES.nama[0].value,
      kategori: 'Puskesmas',
      penanggungJawab: PARTNER_FIELD_EXAMPLES.penanggungJawab[0],
      telepon: PARTNER_FIELD_EXAMPLES.telepon[0],
      alamat: PARTNER_FIELD_EXAMPLES.alamat[0],
      jenisKontribusi: PARTNER_FIELD_EXAMPLES.jenisKontribusi[0],
      potensiKerjaSama: PARTNER_FIELD_EXAMPLES.potensiKerjaSama[0],
      status: 'Aktif',
      catatan: PARTNER_FIELD_EXAMPLES.catatan[0],
    }));
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.id.trim()) errs.id = 'ID Mitra wajib diisi.';
    if (!form.namaSekolah.trim()) errs.namaSekolah = 'Nama sekolah wajib diisi.';
    if (!form.nama.trim()) errs.nama = 'Nama mitra/lembaga wajib diisi.';
    if (!form.penanggungJawab.trim())
      errs.penanggungJawab = 'Nama penanggung jawab wajib diisi.';
    if (!form.telepon.trim()) errs.telepon = 'Nomor telepon wajib diisi.';
    if (!form.alamat.trim()) errs.alamat = 'Alamat wajib diisi.';
    if (!form.jenisKontribusi.trim())
      errs.jenisKontribusi = 'Jenis kontribusi wajib diisi.';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (editingPartner) {
      const ok = updatePartner(editingPartner.id, {
        namaSekolah: form.namaSekolah.trim(),
        nama: form.nama.trim(),
        kategori: form.kategori,
        penanggungJawab: form.penanggungJawab.trim(),
        telepon: form.telepon.trim(),
        alamat: form.alamat.trim(),
        jenisKontribusi: form.jenisKontribusi.trim(),
        potensiKerjaSama: form.potensiKerjaSama.trim(),
        status: form.status,
        catatan: form.catatan.trim(),
      });
      if (ok) {
        syncPartnerProgramLinks(editingPartner.id, linkedProgramIds);
        setFormModalOpen(false);
      }
    } else {
      const newPartnerId = form.id.trim();
      const ok = addPartner({
        id: newPartnerId,
        namaSekolah: form.namaSekolah.trim(),
        nama: form.nama.trim(),
        kategori: form.kategori,
        penanggungJawab: form.penanggungJawab.trim(),
        telepon: form.telepon.trim(),
        alamat: form.alamat.trim(),
        jenisKontribusi: form.jenisKontribusi.trim(),
        potensiKerjaSama: form.potensiKerjaSama.trim(),
        status: form.status,
        catatan: form.catatan.trim(),
      });
      if (ok) {
        if (linkedProgramIds.length > 0) {
          syncPartnerProgramLinks(newPartnerId, linkedProgramIds);
        }
        setFormModalOpen(false);
      }
    }
  };

  const getPartnerPrograms = (partnerId: string) =>
    dataset.programs.filter((p) => p.partnerIds.includes(partnerId));

  const detailLinkedPrograms = useMemo(() => {
    if (!detailPartner) return [];
    return dataset.programs.filter((p) => p.partnerIds.includes(detailPartner.id));
  }, [dataset.programs, detailPartner]);

  const detailLinkedActivities = useMemo(() => {
    if (!detailPartner) return [];
    return dataset.activities.filter((a) =>
      a.partnerIds.includes(detailPartner.id)
    );
  }, [dataset.activities, detailPartner]);

  const partnerSummary = useMemo(() => {
    const aktifCount = dataset.partners.filter((p) => p.status === 'Aktif').length;
    const uniqueSchools = new Set(
      dataset.partners
        .map((p) => p.namaSekolah.trim().toLowerCase())
        .filter(Boolean)
    ).size;
    const linkedProgramIds = new Set(
      dataset.programs
        .filter((prg) => prg.partnerIds.length > 0)
        .map((prg) => prg.id)
    ).size;
    return {
      total: dataset.partners.length,
      aktifCount,
      uniqueSchools,
      linkedProgramIds,
    };
  }, [dataset.partners, dataset.programs]);

  const hasActiveFilter =
    search.trim() !== '' || categoryFilter !== 'ALL' || statusFilter !== 'ALL';

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-[#5B6F65]">
            Pengelolaan lembaga dan jejaring pendukung pembelajaran sekolah
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#11221A]">
            Direktori Mitra Sekolah
          </h2>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0F3F22] whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Mitra</span>
          </button>
        )}
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 divide-y divide-[#EBF0ED] overflow-hidden rounded-xl border border-[#E2EAE5] bg-white shadow-[0_1px_3px_rgba(16,38,26,0.04)] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#5B6F65]">Total Mitra</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#11221A] tabular-nums">
            {partnerSummary.total}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#5B6F65]">Mitra Aktif</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#14532D] tabular-nums">
            {partnerSummary.aktifCount}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#5B6F65]">Sekolah Tercakup</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#11221A] tabular-nums">
            {partnerSummary.uniqueSchools}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#5B6F65]">Program Tertaut</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#11221A] tabular-nums">
            {partnerSummary.linkedProgramIds}
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="rounded-xl border border-[#E2EAE5] bg-white p-4 shadow-[0_1px_3px_rgba(16,38,26,0.04)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B7F74]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ID mitra, nama lembaga, sekolah, penanggung jawab..."
              className="w-full rounded-lg border border-[#D4E0D9] bg-[#FAFDFB] py-2.5 pr-3.5 pl-10 text-sm text-[#11221A] placeholder:text-[#7B8E84] focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/15 focus:outline-none"
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter kategori mitra"
              className="w-full rounded-lg border border-[#D4E0D9] bg-[#FAFDFB] px-3.5 py-2.5 text-sm text-[#11221A] focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/15 focus:outline-none"
            >
              <option value="ALL">Semua Kategori Mitra</option>
              {PARTNER_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter status kemitraan"
              className="w-full rounded-lg border border-[#D4E0D9] bg-[#FAFDFB] px-3.5 py-2.5 text-sm text-[#11221A] focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/15 focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              {PARTNER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
        {hasActiveFilter && (
          <div className="mt-3 flex items-center justify-between border-t border-[#EEF3F0] pt-2.5 text-xs text-[#5B6F65]">
            <span className="tabular-nums">
              Menampilkan{' '}
              <strong className="font-semibold text-[#11221A]">
                {filteredPartners.length}
              </strong>{' '}
              dari {dataset.partners.length} mitra
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategoryFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="font-semibold text-[#14532D] hover:underline"
            >
              Reset filter
            </button>
          </div>
        )}
      </div>

      {/* Data Table / Empty State */}
      <div className="overflow-hidden rounded-xl border border-[#E2EAE5] bg-white shadow-[0_1px_3px_rgba(16,38,26,0.04)]">
        {filteredPartners.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-semibold text-[#11221A]">
              {dataset.partners.length === 0
                ? 'Belum ada data mitra tersimpan'
                : 'Tidak ada mitra yang sesuai dengan pencarian atau filter'}
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[#5B6F65]">
              {dataset.partners.length === 0
                ? 'Mulai catat mitra sekolah seperti Orang Tua, Komite Sekolah, Puskesmas, UMKM, atau impor langsung dari dokumen ARKAS.'
                : 'Coba ubah kata kunci pencarian atau reset pilihan filter.'}
            </p>
            {isAdmin && dataset.partners.length === 0 && (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0F3F22]"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Mitra Pertama</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Spacious 5-Column Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5EDE8] bg-[#F7FAF8] text-xs font-semibold text-[#53685D]">
                    <th className="w-[38%] px-5 py-3.5">Mitra &amp; Sekolah</th>
                    <th className="w-[17%] px-4 py-3.5">Kategori</th>
                    <th className="w-[21%] px-4 py-3.5">Penanggung Jawab</th>
                    <th className="w-[12%] px-4 py-3.5">Program &amp; Status</th>
                    <th className="w-[12%] px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDF2EF]">
                  {filteredPartners.map((partner) => {
                    const linked = getPartnerPrograms(partner.id);
                    return (
                      <tr
                        key={partner.id}
                        className="group transition-colors hover:bg-[#F5FAF7]/80"
                      >
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[#5B6F65]">
                            <span className="font-mono font-semibold text-[#14532D]">
                              {partner.id}
                            </span>
                            {partner.namaSekolah && (
                              <>
                                <span aria-hidden="true" className="text-[#A8B8AF]">
                                  ·
                                </span>
                                <span className="font-medium text-[#3D5247]">
                                  {partner.namaSekolah}
                                </span>
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setDetailPartnerId(partner.id)}
                            className="mt-1 text-left text-[14.5px] font-semibold leading-snug text-[#11221A] hover:text-[#14532D]"
                          >
                            {partner.nama}
                          </button>
                          {partner.jenisKontribusi && (
                            <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-[#5B6F65]">
                              {partner.jenisKontribusi}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <span className="text-[13px] font-medium text-[#2A3F34]">
                            {partner.kategori}
                          </span>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="text-[13px] font-medium leading-snug text-[#11221A]">
                            {partner.penanggungJawab}
                          </div>
                          {partner.telepon && (
                            <div className="mt-0.5 font-mono text-xs text-[#5B6F65] tabular-nums">
                              {partner.telepon}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 align-top whitespace-nowrap">
                          <div>
                            {linked.length === 0 ? (
                              onCreateProgramForPartner && isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => onCreateProgramForPartner(partner)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#D4E4DA] bg-[#F4FAF6] px-2.5 py-1 text-xs font-semibold text-[#14532D] hover:bg-[#E6F6EC]"
                                  title="Buat program kemitraan pertama untuk mitra ini"
                                >
                                  <FolderPlus className="h-3.5 w-3.5" />
                                  <span>Buat Program</span>
                                </button>
                              ) : (
                                <span className="font-mono text-xs text-[#6B7F74] tabular-nums">
                                  0 program
                                </span>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => onViewPartnerPrograms?.(partner.id)}
                                title={`Lihat ${linked.length} program tertaut`}
                                className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#14532D] hover:underline tabular-nums"
                              >
                                <span>{linked.length} program</span>
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="mt-1.5">
                            <span
                              className={`text-xs ${getStatusTextClass(partner.status)}`}
                            >
                              {partner.status}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right align-top whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {isAdmin && onCreateProgramForPartner && (
                              <button
                                type="button"
                                onClick={() => onCreateProgramForPartner(partner)}
                                className="rounded-lg p-2 text-[#14532D] hover:bg-[#E7F5EC]"
                                title="Buat Program Kemitraan dengan mitra ini"
                                aria-label={`Buat program untuk ${partner.nama}`}
                              >
                                <FolderPlus className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDetailPartnerId(partner.id)}
                              className="rounded-lg p-2 text-[#5B6F65] hover:bg-[#E7F5EC] hover:text-[#14532D]"
                              title="Lihat detail mitra"
                              aria-label={`Detail ${partner.nama}`}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(partner)}
                                  className="rounded-lg p-2 text-[#5B6F65] hover:bg-[#E7F5EC] hover:text-[#14532D]"
                                  title="Edit mitra"
                                  aria-label={`Edit ${partner.nama}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(partner)}
                                  className="rounded-lg p-2 text-[#5B6F65] hover:bg-red-50 hover:text-[#B91C1C]"
                                  title="Hapus mitra"
                                  aria-label={`Hapus ${partner.nama}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="divide-y divide-[#EDF2EF] md:hidden">
              {filteredPartners.map((partner) => {
                const linkedCount = getPartnerPrograms(partner.id).length;
                return (
                  <div key={partner.id} className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#5B6F65]">
                          <span className="font-mono font-semibold text-[#14532D]">
                            {partner.id}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{partner.kategori}</span>
                        </div>
                        <h3 className="mt-1 text-[15px] font-semibold text-[#11221A]">
                          {partner.nama}
                        </h3>
                      </div>
                      <span
                        className={`shrink-0 text-xs ${getStatusTextClass(partner.status)}`}
                      >
                        {partner.status}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-[#5B6F65]">
                      {partner.namaSekolah ? `${partner.namaSekolah} · ` : ''}
                      PJ: {partner.penanggungJawab}
                      {partner.telepon ? ` · ${partner.telepon}` : ''}
                    </p>
                    {partner.jenisKontribusi && (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#5B6F65]">
                        {partner.jenisKontribusi}
                      </p>
                    )}
                    <div className="mt-3.5 flex flex-wrap items-center gap-3.5 border-t border-[#EFF4F1] pt-3 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setDetailPartnerId(partner.id)}
                        className="text-[#14532D] hover:underline"
                      >
                        Lihat Detail
                      </button>
                      {linkedCount > 0 && onViewPartnerPrograms && (
                        <button
                          type="button"
                          onClick={() => onViewPartnerPrograms(partner.id)}
                          className="text-[#14532D] hover:underline"
                        >
                          {linkedCount} Program Tertaut
                        </button>
                      )}
                      {isAdmin && onCreateProgramForPartner && (
                        <button
                          type="button"
                          onClick={() => onCreateProgramForPartner(partner)}
                          className="text-[#14532D] hover:underline"
                        >
                          + Buat Program
                        </button>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(partner)}
                            className="text-[#334155] hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(partner)}
                            className="text-[#B91C1C] hover:underline"
                          >
                            Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={formModalOpen}
        title={editingPartner ? 'Edit Data Mitra' : 'Tambah Data Mitra Baru'}
        subtitle="Lengkapi informasi mitra sekolah secara jelas dan terstruktur."
        onClose={() => setFormModalOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormFillExampleBar onFillAll={fillPartnerExample} />

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#14221B]">
              Nama Sekolah *
            </label>
            <input
              type="text"
              list="mitra-kita-school-list"
              value={form.namaSekolah}
              onChange={(e) => setForm({ ...form, namaSekolah: e.target.value })}
              placeholder="Contoh: SD Negeri 01 Harapan Nusantara"
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
            <FieldExampleHint
              examples={PARTNER_FIELD_EXAMPLES.namaSekolah}
              onApply={(val) => setForm({ ...form, namaSekolah: val })}
            />
            {formErrors.namaSekolah && (
              <p className="mt-1 text-xs text-[#B91C1C]">
                {formErrors.namaSekolah}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                ID Mitra *
              </label>
              <input
                type="text"
                value={form.id}
                disabled={Boolean(editingPartner)}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="MTR-001"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 font-mono text-sm text-[#14221B] disabled:bg-[#F3F6F4] disabled:text-[#52635A] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={[getNextPartnerId(), 'MTR-001']}
                disabled={Boolean(editingPartner)}
                onApply={(val) => setForm({ ...form, id: val })}
              />
              {formErrors.id && (
                <p className="mt-1 text-xs text-[#B91C1C]">{formErrors.id}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Kategori Mitra *
              </label>
              <select
                value={form.kategori}
                onChange={(e) =>
                  setForm({ ...form, kategori: e.target.value as PartnerCategory })
                }
                className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              >
                {PARTNER_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#14221B]">
              Nama Mitra / Lembaga *
            </label>
            <input
              type="text"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              placeholder="Contoh: Puskesmas Kecamatan Cendekia"
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
            <FieldExampleHint
              examples={PARTNER_FIELD_EXAMPLES.nama}
              onApply={(val) => setForm({ ...form, nama: val })}
            />
            {formErrors.nama && (
              <p className="mt-1 text-xs text-[#B91C1C]">{formErrors.nama}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Nama Penanggung Jawab *
              </label>
              <input
                type="text"
                value={form.penanggungJawab}
                onChange={(e) =>
                  setForm({ ...form, penanggungJawab: e.target.value })
                }
                placeholder="Nama kontak utama mitra"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={PARTNER_FIELD_EXAMPLES.penanggungJawab}
                onApply={(val) => setForm({ ...form, penanggungJawab: val })}
              />
              {formErrors.penanggungJawab && (
                <p className="mt-1 text-xs text-[#B91C1C]">
                  {formErrors.penanggungJawab}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Nomor Telepon *
              </label>
              <input
                type="text"
                value={form.telepon}
                onChange={(e) => setForm({ ...form, telepon: e.target.value })}
                placeholder="0812-xxxx-xxxx"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={PARTNER_FIELD_EXAMPLES.telepon}
                onApply={(val) => setForm({ ...form, telepon: val })}
              />
              {formErrors.telepon && (
                <p className="mt-1 text-xs text-[#B91C1C]">{formErrors.telepon}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Alamat *
              </label>
              <input
                type="text"
                value={form.alamat}
                onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                placeholder="Alamat lengkap mitra/lembaga"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={PARTNER_FIELD_EXAMPLES.alamat}
                onApply={(val) => setForm({ ...form, alamat: val })}
              />
              {formErrors.alamat && (
                <p className="mt-1 text-xs text-[#B91C1C]">{formErrors.alamat}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Status Kemitraan
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as PartnerStatus })
                }
                className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              >
                {PARTNER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#14221B]">
              Jenis Kontribusi *
            </label>
            <textarea
              rows={2}
              value={form.jenisKontribusi}
              onChange={(e) =>
                setForm({ ...form, jenisKontribusi: e.target.value })
              }
              placeholder="Contoh: Narasumber kelas inspirasi, pemeriksaan kesehatan, fasilitas kunjungan belajar"
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
            <FieldExampleHint
              examples={PARTNER_FIELD_EXAMPLES.jenisKontribusi}
              onApply={(val) => setForm({ ...form, jenisKontribusi: val })}
            />
            {formErrors.jenisKontribusi && (
              <p className="mt-1 text-xs text-[#B91C1C]">
                {formErrors.jenisKontribusi}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#14221B]">
              Potensi Kerja Sama
            </label>
            <textarea
              rows={2}
              value={form.potensiKerjaSama}
              onChange={(e) =>
                setForm({ ...form, potensiKerjaSama: e.target.value })
              }
              placeholder="Peluang kolaborasi lanjutan untuk semester berikutnya"
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
            <FieldExampleHint
              examples={PARTNER_FIELD_EXAMPLES.potensiKerjaSama}
              onApply={(val) => setForm({ ...form, potensiKerjaSama: val })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#14221B]">
              Catatan
            </label>
            <textarea
              rows={2}
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              placeholder="Catatan tambahan (misalnya status MoU atau jadwal komunikasi)"
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
            <FieldExampleHint
              examples={PARTNER_FIELD_EXAMPLES.catatan}
              onApply={(val) => setForm({ ...form, catatan: val })}
            />
          </div>

          {/* Tautkan langsung ke Program Kemitraan yang sudah ada */}
          <div className="rounded-lg border border-[#DCE8E0] bg-[#F7FAF8] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#14221B]">
                <Link2 className="h-3.5 w-3.5 text-[#14532D]" />
                <span>Tautkan ke Program Kemitraan (Opsional)</span>
              </label>
              <span className="text-[11px] font-medium text-[#14532D] tabular-nums">
                {linkedProgramIds.length} program ditautkan
              </span>
            </div>
            {linkablePrograms.length === 0 ? (
              <p className="mt-2 text-xs text-[#52635A]">
                Belum ada program kemitraan aktif. Setelah menyimpan mitra ini, Anda
                dapat langsung menekan tombol <strong>Buat Program</strong> pada baris
                mitra untuk membuat program yang otomatis tertaut.
              </p>
            ) : (
              <div className="mt-2.5 grid max-h-40 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-[#D4DDD7] bg-white p-2.5 sm:grid-cols-2">
                {linkablePrograms.map((prg) => {
                  const checked = linkedProgramIds.includes(prg.id);
                  const sameSchool =
                    form.namaSekolah.trim() !== '' &&
                    (prg.namaSekolah ?? '').trim().toLowerCase() ===
                      form.namaSekolah.trim().toLowerCase();
                  return (
                    <label
                      key={prg.id}
                      className={`flex cursor-pointer items-start gap-2 rounded-md p-2 text-xs transition-colors ${
                        checked
                          ? 'bg-[#ECFDF5] text-[#14532D]'
                          : 'hover:bg-[#F6F8F7]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLinkedProgramId(prg.id)}
                        className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] accent-[#14532D]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-[#14221B]">
                          {prg.namaProgram}
                        </span>
                        <span className="block text-[11px] text-[#52635A]">
                          {prg.kodeProgram}
                          {prg.namaSekolah ? ` · ${prg.namaSekolah}` : ''}
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

          <div className="flex items-center justify-end gap-2.5 border-t border-[#EEF2EF] pt-4">
            <button
              type="button"
              onClick={() => setFormModalOpen(false)}
              className="rounded-lg border border-[#D4DDD7] bg-white px-4 py-2 text-sm font-medium text-[#14221B] hover:bg-[#F6F8F7]"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#14532D] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F3F22]"
            >
              {editingPartner ? 'Simpan Perubahan' : 'Simpan Mitra'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Partner Modal */}
      <Modal
        open={Boolean(detailPartner)}
        title={detailPartner?.nama ?? 'Detail Mitra'}
        subtitle={
          detailPartner
            ? `${detailPartner.id} · ${detailPartner.kategori} · ${detailPartner.status}`
            : undefined
        }
        onClose={() => setDetailPartnerId(null)}
      >
        {detailPartner && (
          <div className="space-y-5 text-sm">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">
                  Nama Sekolah
                </dt>
                <dd className="mt-1 font-semibold text-[#14532D]">
                  {detailPartner.namaSekolah || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Penanggung Jawab
                </dt>
                <dd className="mt-1 font-medium text-[#14221B]">
                  {detailPartner.penanggungJawab}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Nomor Telepon
                </dt>
                <dd className="mt-1 font-mono text-[#14221B]">
                  {detailPartner.telepon}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">Alamat</dt>
                <dd className="mt-1 text-[#14221B]">{detailPartner.alamat}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">
                  Jenis Kontribusi
                </dt>
                <dd className="mt-1 leading-relaxed text-[#14221B]">
                  {detailPartner.jenisKontribusi}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">
                  Potensi Kerja Sama
                </dt>
                <dd className="mt-1 leading-relaxed text-[#14221B]">
                  {detailPartner.potensiKerjaSama || '-'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">Catatan</dt>
                <dd className="mt-1 leading-relaxed text-[#52635A]">
                  {detailPartner.catatan || '-'}
                </dd>
              </div>
            </dl>

            <div className="border-t border-[#EEF2EF] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-[#14221B]">
                  Program Kemitraan Terkait ({detailLinkedPrograms.length})
                </h4>
                {isAdmin && onCreateProgramForPartner && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailPartner;
                      setDetailPartnerId(null);
                      onCreateProgramForPartner(target);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#14532D] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#0F3F22]"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    <span>Buat Program dengan Mitra Ini</span>
                  </button>
                )}
              </div>
              {detailLinkedPrograms.length === 0 ? (
                <p className="mt-2 text-xs text-[#52635A]">
                  Mitra ini belum dihubungkan ke program kemitraan. Klik tombol di
                  atas untuk langsung membuat program dengan data mitra ini.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-[#EEF2EF]">
                  {detailLinkedPrograms.map((prg) => (
                    <li
                      key={prg.id}
                      className="flex items-center justify-between gap-3 py-2 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setDetailPartnerId(null);
                          onOpenProgramDetail?.(prg.id);
                        }}
                        className="group flex items-center gap-1.5 text-left hover:text-[#14532D]"
                      >
                        <span className="font-mono text-[#14532D]">
                          {prg.kodeProgram}
                        </span>
                        <span className="text-[#CBD5E1]">·</span>
                        <span className="font-medium text-[#14221B] group-hover:text-[#14532D] group-hover:underline">
                          {prg.namaProgram}
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#52635A] group-hover:text-[#14532D]" />
                      </button>
                      <span className={`shrink-0 ${getStatusTextClass(prg.status)}`}>
                        {prg.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-[#EEF2EF] pt-4">
              <h4 className="text-xs font-semibold text-[#14221B]">
                Riwayat Keterlibatan Kegiatan ({detailLinkedActivities.length})
              </h4>
              {detailLinkedActivities.length === 0 ? (
                <p className="mt-2 text-xs text-[#52635A]">
                  Belum ada kegiatan tercatat bersama mitra ini.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-[#EEF2EF]">
                  {detailLinkedActivities.map((act) => (
                    <li
                      key={act.id}
                      className="flex items-center justify-between gap-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-medium text-[#14221B]">
                          {act.namaKegiatan}
                        </span>
                        <span className="mx-1.5 text-[#CBD5E1]">·</span>
                        <span className="text-[#52635A] tabular-nums">
                          {formatDateID(act.tanggalPelaksanaan)}
                        </span>
                      </div>
                      <span className={getStatusTextClass(act.status)}>
                        {act.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Data Mitra?"
        description={
          deleteTarget
            ? `Apakah Anda yakin ingin menghapus "${deleteTarget.nama}" (${deleteTarget.id})? Keterkaitan mitra ini pada program dan kegiatan juga akan dilepaskan.`
            : ''
        }
        confirmLabel="Ya, Hapus Mitra"
        onConfirm={() => {
          if (deleteTarget) deletePartner(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
