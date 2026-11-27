import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  FieldExampleHint,
  FormFillExampleBar,
} from '../components/FieldExampleHint';
import { Modal } from '../components/Modal';
import { ProgramSelectWithQuickAdd } from '../components/ProgramSelectWithQuickAdd';
import { useMitraKita } from '../context/MitraKitaContext';
import { ACTIVITY_FIELD_EXAMPLES } from '../data/fieldExamples';
import {
  ACTIVITY_STATUSES,
  ActivityStatus,
  PartnershipActivity,
} from '../types/mitraKita';
import {
  formatDateID,
  getStatusTextClass,
  getTodayISO,
} from '../utils/formatters';

interface ActivityFormState {
  namaSekolah: string;
  namaKegiatan: string;
  programId: string;
  tanggalPelaksanaan: string;
  lokasi: string;
  partnerIds: string[];
  penanggungJawab: string;
  jumlahPeserta: string;
  deskripsiPelaksanaan: string;
  hasilKegiatan: string;
  kendala: string;
  status: ActivityStatus;
}

interface ActivitiesPageProps {
  onOpenArkasImport?: () => void;
}

export const ActivitiesPage: React.FC<ActivitiesPageProps> = ({
  onOpenArkasImport,
}) => {
  const {
    dataset,
    isAdmin,
    addActivity,
    updateActivity,
    markActivityComplete,
    deleteActivity,
  } = useMitraKita();

  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [formOpen, setFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] =
    useState<PartnershipActivity | null>(null);
  const [detailActivity, setDetailActivity] =
    useState<PartnershipActivity | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<PartnershipActivity | null>(null);

  const [form, setForm] = useState<ActivityFormState>({
    namaSekolah: '',
    namaKegiatan: '',
    programId: '',
    tanggalPelaksanaan: getTodayISO(),
    lokasi: '',
    partnerIds: [],
    penanggungJawab: '',
    jumlahPeserta: '0',
    deskripsiPelaksanaan: '',
    hasilKegiatan: '',
    kendala: '',
    status: 'Terjadwal',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const programMap = useMemo(() => {
    const map = new Map<
      string,
      { nama: string; kode: string; namaSekolah: string; partnerIds: string[] }
    >();
    for (const p of dataset.programs) {
      map.set(p.id, {
        nama: p.namaProgram,
        kode: p.kodeProgram,
        namaSekolah: p.namaSekolah ?? '',
        partnerIds: p.partnerIds,
      });
    }
    return map;
  }, [dataset.programs]);

  const partnerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of dataset.partners) map.set(p.id, p.nama);
    return map;
  }, [dataset.partners]);

  const filteredActivities = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...dataset.activities]
      .sort((a, b) => b.tanggalPelaksanaan.localeCompare(a.tanggalPelaksanaan))
      .filter((act) => {
        const matchProg =
          programFilter === 'ALL' || act.programId === programFilter;
        const matchStatus =
          statusFilter === 'ALL' || act.status === statusFilter;
        const progName = programMap.get(act.programId)?.nama ?? '';
        const matchSearch =
          q === '' ||
          (act.namaSekolah ?? '').toLowerCase().includes(q) ||
          act.namaKegiatan.toLowerCase().includes(q) ||
          act.lokasi.toLowerCase().includes(q) ||
          act.penanggungJawab.toLowerCase().includes(q) ||
          progName.toLowerCase().includes(q);
        return matchProg && matchStatus && matchSearch;
      });
  }, [dataset.activities, search, programFilter, statusFilter, programMap]);

  const openCreateModal = () => {
    const defaultProg = dataset.programs[0];
    setEditingActivity(null);
    setFormErrors({});
    setForm({
      namaSekolah:
        defaultProg?.namaSekolah ||
        (dataset.schoolProfile.namaSekolah !== 'Nama Sekolah Binaan'
          ? dataset.schoolProfile.namaSekolah
          : ''),
      namaKegiatan: '',
      programId: defaultProg?.id ?? '',
      tanggalPelaksanaan: getTodayISO(),
      lokasi: '',
      partnerIds: defaultProg ? [...defaultProg.partnerIds] : [],
      penanggungJawab: defaultProg?.penanggungJawab ?? '',
      jumlahPeserta: '0',
      deskripsiPelaksanaan: '',
      hasilKegiatan: '',
      kendala: '',
      status: 'Terjadwal',
    });
    setFormOpen(true);
  };

  const openEditModal = (act: PartnershipActivity) => {
    setEditingActivity(act);
    setFormErrors({});
    setForm({
      namaSekolah: act.namaSekolah ?? '',
      namaKegiatan: act.namaKegiatan,
      programId: act.programId,
      tanggalPelaksanaan: act.tanggalPelaksanaan,
      lokasi: act.lokasi,
      partnerIds: [...act.partnerIds],
      penanggungJawab: act.penanggungJawab,
      jumlahPeserta: String(act.jumlahPeserta),
      deskripsiPelaksanaan: act.deskripsiPelaksanaan,
      hasilKegiatan: act.hasilKegiatan,
      kendala: act.kendala,
      status: act.status,
    });
    setFormOpen(true);
  };

  const handleProgramChange = (newProgramId: string) => {
    const prg = programMap.get(newProgramId);
    setForm((prev) => ({
      ...prev,
      programId: newProgramId,
      namaSekolah: prg?.namaSekolah || prev.namaSekolah,
      partnerIds:
        !editingActivity && prg ? [...prg.partnerIds] : prev.partnerIds,
    }));
  };

  const togglePartnerId = (partnerId: string) => {
    setForm((prev) => ({
      ...prev,
      partnerIds: prev.partnerIds.includes(partnerId)
        ? prev.partnerIds.filter((id) => id !== partnerId)
        : [...prev.partnerIds, partnerId],
    }));
  };

  const fillActivityExample = () => {
    setFormErrors({});
    setForm((prev) => ({
      ...prev,
      namaSekolah:
        prev.namaSekolah.trim() || ACTIVITY_FIELD_EXAMPLES.namaSekolah[0],
      namaKegiatan: ACTIVITY_FIELD_EXAMPLES.namaKegiatan[0],
      lokasi: ACTIVITY_FIELD_EXAMPLES.lokasi[0],
      jumlahPeserta: ACTIVITY_FIELD_EXAMPLES.jumlahPeserta[0],
      penanggungJawab: ACTIVITY_FIELD_EXAMPLES.penanggungJawab[0],
      deskripsiPelaksanaan: ACTIVITY_FIELD_EXAMPLES.deskripsiPelaksanaan[0],
      hasilKegiatan: ACTIVITY_FIELD_EXAMPLES.hasilKegiatan[0],
      kendala: ACTIVITY_FIELD_EXAMPLES.kendala[0],
    }));
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.namaSekolah.trim())
      errs.namaSekolah = 'Nama sekolah wajib diisi.';
    if (!form.namaKegiatan.trim())
      errs.namaKegiatan = 'Nama kegiatan wajib diisi.';
    if (!form.programId) errs.programId = 'Pilih program kemitraan terkait.';
    if (!form.tanggalPelaksanaan)
      errs.tanggalPelaksanaan = 'Tanggal pelaksanaan wajib diisi.';
    if (!form.lokasi.trim()) errs.lokasi = 'Lokasi kegiatan wajib diisi.';
    if (!form.penanggungJawab.trim())
      errs.penanggungJawab = 'Penanggung jawab wajib diisi.';
    const count = Number(form.jumlahPeserta);
    if (Number.isNaN(count) || count < 0)
      errs.jumlahPeserta = 'Jumlah peserta harus berupa angka 0 atau lebih.';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      namaSekolah: form.namaSekolah.trim(),
      namaKegiatan: form.namaKegiatan.trim(),
      programId: form.programId,
      tanggalPelaksanaan: form.tanggalPelaksanaan,
      lokasi: form.lokasi.trim(),
      partnerIds: form.partnerIds,
      penanggungJawab: form.penanggungJawab.trim(),
      jumlahPeserta: Number(form.jumlahPeserta) || 0,
      deskripsiPelaksanaan: form.deskripsiPelaksanaan.trim(),
      hasilKegiatan: form.hasilKegiatan.trim(),
      kendala: form.kendala.trim(),
      status: form.status,
    };

    const ok = editingActivity
      ? updateActivity(editingActivity.id, payload)
      : addActivity(payload);
    if (ok) setFormOpen(false);
  };

  const completedCount = dataset.activities.filter(
    (a) => a.status === 'Selesai'
  ).length;
  const scheduledCount = dataset.activities.filter(
    (a) => a.status === 'Terjadwal' || a.status === 'Sedang Berlangsung'
  ).length;
  const totalParticipants = dataset.activities.reduce(
    (sum, a) => sum + (Number(a.jumlahPeserta) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-[#5B6F65]">
            Jadwal, pelaksanaan, dan capaian kegiatan dari setiap program
            kemitraan
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#11221A]">
            Realisasi Kegiatan Kemitraan
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
              disabled={dataset.programs.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0F3F22] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Kegiatan</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 divide-y divide-[#EBF0ED] overflow-hidden rounded-xl border border-[#E2EAE5] bg-white shadow-[0_1px_3px_rgba(16,38,26,0.04)] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#5B6F65]">Total Kegiatan</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#11221A] tabular-nums">
            {dataset.activities.length}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#5B6F65]">
            Terjadwal &amp; Berjalan
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#11221A] tabular-nums">
            {scheduledCount}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#5B6F65]">Telah Selesai</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#14532D] tabular-nums">
            {completedCount}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[#5B6F65]">Total Peserta</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#11221A] tabular-nums">
            {totalParticipants.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {dataset.programs.length === 0 && isAdmin && (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#D4E4DA] bg-[#F2FAF5] p-4 text-xs text-[#14532D] sm:flex-row sm:items-center">
          <span>
            Buat minimal satu Program Kemitraan terlebih dahulu—atau langsung
            impor dokumen ARKAS (PDF/Excel) untuk menghasilkan Program dan
            Kegiatan secara otomatis.
          </span>
          {onOpenArkasImport && (
            <button
              type="button"
              onClick={onOpenArkasImport}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#14532D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0F3F22]"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Impor ARKAS Sekarang</span>
            </button>
          )}
        </div>
      )}

      {/* Search & Filters */}
      <div className="rounded-xl border border-[#E2EAE5] bg-white p-4 shadow-[0_1px_3px_rgba(16,38,26,0.04)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B7F74]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama kegiatan, lokasi, program, atau penanggung jawab..."
              className="w-full rounded-lg border border-[#D4E0D9] bg-[#FAFDFB] py-2.5 pr-3.5 pl-10 text-sm text-[#11221A] placeholder:text-[#7B8E84] focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/15 focus:outline-none"
            />
          </div>
          <div className="md:col-span-4">
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              aria-label="Filter berdasarkan program"
              className="w-full rounded-lg border border-[#D4E0D9] bg-[#FAFDFB] px-3.5 py-2.5 text-sm text-[#11221A] focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/15 focus:outline-none"
            >
              <option value="ALL">Semua Program Kemitraan</option>
              {dataset.programs.map((prg) => (
                <option key={prg.id} value={prg.id}>
                  {prg.kodeProgram} — {prg.namaProgram}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter status kegiatan"
              className="w-full rounded-lg border border-[#D4E0D9] bg-[#FAFDFB] px-3.5 py-2.5 text-sm text-[#11221A] focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/15 focus:outline-none"
            >
              <option value="ALL">Semua Status Kegiatan</option>
              {ACTIVITY_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Activities Table / Cards */}
      <div className="overflow-hidden rounded-xl border border-[#E2EAE5] bg-white shadow-[0_1px_3px_rgba(16,38,26,0.04)]">
        {filteredActivities.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-semibold text-[#11221A]">
              {dataset.activities.length === 0
                ? 'Belum ada kegiatan kemitraan yang dicatat'
                : 'Tidak ada kegiatan yang sesuai dengan filter'}
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[#5B6F65]">
              Catat jadwal, lokasi, peserta, hasil, dan kendala pelaksanaan
              setiap program kemitraan.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EDF2EF]">
            {filteredActivities.map((act) => {
              const prog = programMap.get(act.programId);
              const partnersText = act.partnerIds
                .map((id) => partnerMap.get(id))
                .filter(Boolean)
                .join(', ');

              return (
                <div
                  key={act.id}
                  className="flex flex-col justify-between gap-4 p-5 transition-colors hover:bg-[#F5FAF7]/80 sm:px-6 lg:flex-row lg:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#5B6F65]">
                      <span className="font-mono font-semibold text-[#14532D]">
                        {formatDateID(act.tanggalPelaksanaan)}
                      </span>
                      {act.namaSekolah && (
                        <>
                          <span aria-hidden="true" className="text-[#A8B8AF]">
                            ·
                          </span>
                          <span className="font-semibold text-[#11221A]">
                            {act.namaSekolah}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true" className="text-[#A8B8AF]">
                        ·
                      </span>
                      <span className="text-[#3D5247]">
                        {prog ? `${prog.kode} ${prog.nama}` : 'Program'}
                      </span>
                      <span aria-hidden="true" className="text-[#A8B8AF]">
                        ·
                      </span>
                      <span className={getStatusTextClass(act.status)}>
                        {act.status}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDetailActivity(act)}
                      className="text-left text-[15.5px] font-semibold leading-snug text-[#11221A] hover:text-[#14532D]"
                    >
                      {act.namaKegiatan}
                    </button>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5B6F65] tabular-nums">
                      <span>
                        Lokasi:{' '}
                        <strong className="font-medium text-[#11221A]">
                          {act.lokasi}
                        </strong>
                      </span>
                      <span>
                        Peserta:{' '}
                        <strong className="font-mono font-medium text-[#11221A]">
                          {act.jumlahPeserta} orang
                        </strong>
                      </span>
                      <span>
                        PJ:{' '}
                        <strong className="font-medium text-[#11221A]">
                          {act.penanggungJawab}
                        </strong>
                      </span>
                      {partnersText && (
                        <span>
                          Mitra:{' '}
                          <strong className="font-medium text-[#14532D]">
                            {partnersText}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Required 5 Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDetailActivity(act)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-xs font-medium text-[#14221B] hover:bg-[#F6F8F7] whitespace-nowrap"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Lihat Detail</span>
                    </button>

                    {isAdmin && act.status !== 'Selesai' && (
                      <button
                        type="button"
                        onClick={() => markActivityComplete(act.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#ECFDF5] px-3 py-2 text-xs font-semibold text-[#14532D] hover:bg-[#DCFCE7] whitespace-nowrap"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Tandai Selesai</span>
                      </button>
                    )}

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(act)}
                          disabled={act.status === 'Selesai'}
                          className="rounded-lg border border-[#D4DDD7] bg-white p-2 text-[#52635A] hover:bg-[#ECFDF5] hover:text-[#14532D] disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            act.status === 'Selesai'
                              ? 'Kegiatan selesai terkunci dari pengubahan'
                              : 'Edit kegiatan'
                          }
                          aria-label={`Edit ${act.namaKegiatan}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(act)}
                          className="rounded-lg border border-[#D4DDD7] bg-white p-2 text-[#52635A] hover:bg-red-50 hover:text-[#B91C1C]"
                          title="Hapus kegiatan"
                          aria-label={`Hapus ${act.namaKegiatan}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Activity Modal */}
      <Modal
        open={formOpen}
        title={editingActivity ? 'Edit Kegiatan' : 'Catat Kegiatan Baru'}
        subtitle="Hubungkan kegiatan ke program kemitraan dan catat realisasi pelaksanaannya."
        maxWidthClass="max-w-3xl"
        onClose={() => setFormOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormFillExampleBar onFillAll={fillActivityExample} />

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
              examples={ACTIVITY_FIELD_EXAMPLES.namaSekolah}
              onApply={(val) => setForm({ ...form, namaSekolah: val })}
            />
            {formErrors.namaSekolah && (
              <p className="mt-1 text-xs text-[#B91C1C]">
                {formErrors.namaSekolah}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#14221B]">
              Nama Kegiatan *
            </label>
            <input
              type="text"
              value={form.namaKegiatan}
              onChange={(e) => setForm({ ...form, namaKegiatan: e.target.value })}
              placeholder="Contoh: Skrining Kesehatan Gigi & Praktik Cuci Tangan"
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
            <FieldExampleHint
              examples={ACTIVITY_FIELD_EXAMPLES.namaKegiatan}
              onApply={(val) => setForm({ ...form, namaKegiatan: val })}
            />
            {formErrors.namaKegiatan && (
              <p className="mt-1 text-xs text-[#B91C1C]">
                {formErrors.namaKegiatan}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProgramSelectWithQuickAdd
              label="Program Terkait *"
              value={form.programId}
              onChange={handleProgramChange}
              namaSekolah={form.namaSekolah}
              penanggungJawab={form.penanggungJawab}
              emptyOptionLabel="— Pilih Program —"
              error={formErrors.programId}
            />
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Status Kegiatan *
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as ActivityStatus })
                }
                className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              >
                {ACTIVITY_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Tanggal Pelaksanaan *
              </label>
              <input
                type="date"
                value={form.tanggalPelaksanaan}
                onChange={(e) =>
                  setForm({ ...form, tanggalPelaksanaan: e.target.value })
                }
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              {formErrors.tanggalPelaksanaan && (
                <p className="mt-1 text-xs text-[#B91C1C]">
                  {formErrors.tanggalPelaksanaan}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Lokasi *
              </label>
              <input
                type="text"
                value={form.lokasi}
                onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                placeholder="Aula sekolah / lokasi mitra"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={ACTIVITY_FIELD_EXAMPLES.lokasi}
                onApply={(val) => setForm({ ...form, lokasi: val })}
              />
              {formErrors.lokasi && (
                <p className="mt-1 text-xs text-[#B91C1C]">{formErrors.lokasi}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Jumlah Peserta
              </label>
              <input
                type="number"
                min={0}
                value={form.jumlahPeserta}
                onChange={(e) =>
                  setForm({ ...form, jumlahPeserta: e.target.value })
                }
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 font-mono text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={ACTIVITY_FIELD_EXAMPLES.jumlahPeserta}
                onApply={(val) => setForm({ ...form, jumlahPeserta: val })}
              />
              {formErrors.jumlahPeserta && (
                <p className="mt-1 text-xs text-[#B91C1C]">
                  {formErrors.jumlahPeserta}
                </p>
              )}
            </div>
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
              placeholder="Nama guru penanggung jawab kegiatan"
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
            <FieldExampleHint
              examples={ACTIVITY_FIELD_EXAMPLES.penanggungJawab}
              onApply={(val) => setForm({ ...form, penanggungJawab: val })}
            />
            {formErrors.penanggungJawab && (
              <p className="mt-1 text-xs text-[#B91C1C]">
                {formErrors.penanggungJawab}
              </p>
            )}
          </div>

          {/* Mitra Terlibat */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#14221B]">
              Mitra yang Terlibat dalam Kegiatan
            </label>
            <div className="grid max-h-36 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-[#D4DDD7] p-3 sm:grid-cols-2">
              {dataset.partners.map((partner) => {
                const checked = form.partnerIds.includes(partner.id);
                return (
                  <label
                    key={partner.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                      checked ? 'bg-[#ECFDF5] font-semibold text-[#14532D]' : 'text-[#14221B]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePartnerId(partner.id)}
                      className="h-4 w-4 accent-[#14532D]"
                    />
                    <span className="truncate">{partner.nama}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#14221B]">
              Deskripsi Pelaksanaan
            </label>
            <textarea
              rows={2}
              value={form.deskripsiPelaksanaan}
              onChange={(e) =>
                setForm({ ...form, deskripsiPelaksanaan: e.target.value })
              }
              placeholder="Ringkasan jalannya kegiatan bersama mitra"
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
            <FieldExampleHint
              examples={ACTIVITY_FIELD_EXAMPLES.deskripsiPelaksanaan}
              onApply={(val) =>
                setForm({ ...form, deskripsiPelaksanaan: val })
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Hasil Kegiatan
              </label>
              <textarea
                rows={2}
                value={form.hasilKegiatan}
                onChange={(e) =>
                  setForm({ ...form, hasilKegiatan: e.target.value })
                }
                placeholder="Capaian atau produk belajar dari kegiatan"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={ACTIVITY_FIELD_EXAMPLES.hasilKegiatan}
                onApply={(val) => setForm({ ...form, hasilKegiatan: val })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Kendala
              </label>
              <textarea
                rows={2}
                value={form.kendala}
                onChange={(e) => setForm({ ...form, kendala: e.target.value })}
                placeholder="Hambatan pelaksanaan (jika ada)"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={ACTIVITY_FIELD_EXAMPLES.kendala}
                onApply={(val) => setForm({ ...form, kendala: val })}
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
              {editingActivity ? 'Simpan Perubahan' : 'Simpan Kegiatan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Activity Detail Modal */}
      <Modal
        open={Boolean(detailActivity)}
        title={detailActivity?.namaKegiatan ?? 'Detail Kegiatan'}
        subtitle={
          detailActivity
            ? `${formatDateID(detailActivity.tanggalPelaksanaan)} · ${detailActivity.status}`
            : undefined
        }
        onClose={() => setDetailActivity(null)}
      >
        {detailActivity && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">
                  Nama Sekolah
                </dt>
                <dd className="mt-1 font-semibold text-[#14221B]">
                  {detailActivity.namaSekolah || '-'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">
                  Program Kemitraan Terkait
                </dt>
                <dd className="mt-1 font-semibold text-[#14532D]">
                  {programMap.get(detailActivity.programId)?.kode} —{' '}
                  {programMap.get(detailActivity.programId)?.nama ?? '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">Lokasi</dt>
                <dd className="mt-1 text-[#14221B]">{detailActivity.lokasi}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Jumlah Peserta
                </dt>
                <dd className="mt-1 font-mono font-semibold text-[#14221B] tabular-nums">
                  {detailActivity.jumlahPeserta} orang
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Penanggung Jawab
                </dt>
                <dd className="mt-1 text-[#14221B]">
                  {detailActivity.penanggungJawab}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Mitra yang Terlibat
                </dt>
                <dd className="mt-1 text-[#14221B]">
                  {detailActivity.partnerIds.length > 0
                    ? detailActivity.partnerIds
                        .map((id) => partnerMap.get(id) ?? id)
                        .join(', ')
                    : '-'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">
                  Deskripsi Pelaksanaan
                </dt>
                <dd className="mt-1 leading-relaxed text-[#14221B]">
                  {detailActivity.deskripsiPelaksanaan || '-'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">
                  Hasil Kegiatan
                </dt>
                <dd className="mt-1 leading-relaxed text-[#14221B]">
                  {detailActivity.hasilKegiatan || '-'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">Kendala</dt>
                <dd className="mt-1 leading-relaxed text-[#52635A]">
                  {detailActivity.kendala || '-'}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Data Kegiatan?"
        description={
          deleteTarget
            ? `Apakah Anda yakin ingin menghapus kegiatan "${deleteTarget.namaKegiatan}"?`
            : ''
        }
        confirmLabel="Ya, Hapus Kegiatan"
        onConfirm={() => {
          if (deleteTarget) deleteActivity(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
