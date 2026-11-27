import React, { useMemo, useRef, useState } from 'react';
import {
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  FieldExampleHint,
  FormFillExampleBar,
} from '../components/FieldExampleHint';
import { Modal } from '../components/Modal';
import { useMitraKita } from '../context/MitraKitaContext';
import { EVIDENCE_FIELD_EXAMPLES } from '../data/fieldExamples';
import {
  EVIDENCE_TYPES,
  EvidenceItem,
  EvidenceType,
} from '../types/mitraKita';
import {
  formatDateID,
  formatFileSize,
  getTodayISO,
} from '../utils/formatters';

interface EvidenceFormState {
  namaSekolah: string;
  namaDokumen: string;
  jenis: EvidenceType;
  programId: string;
  activityId: string;
  tanggalUnggah: string;
  keterangan: string;
  fileUrl: string;
  fileName: string;
  fileMimeType: string;
  fileSize?: number;
}

async function compressImageFile(file: File): Promise<{
  dataUrl: string;
  size: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Berkas gambar tidak valid.'));
      img.onload = () => {
        const maxDim = 800;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        if (dataUrl.length > 650000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        }
        resolve({ dataUrl, size: Math.round((dataUrl.length * 3) / 4) });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const EvidencePage: React.FC = () => {
  const {
    dataset,
    isAdmin,
    addEvidence,
    updateEvidence,
    deleteEvidence,
    notify,
  } = useMitraKita();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [programFilter, setProgramFilter] = useState<string>('ALL');

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EvidenceItem | null>(null);
  const [previewItem, setPreviewItem] = useState<EvidenceItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EvidenceItem | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<EvidenceFormState>({
    namaSekolah: '',
    namaDokumen: '',
    jenis: 'Foto Kegiatan',
    programId: '',
    activityId: '',
    tanggalUnggah: getTodayISO(),
    keterangan: '',
    fileUrl: '',
    fileName: '',
    fileMimeType: '',
    fileSize: undefined,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const programMap = useMemo(() => {
    const map = new Map<
      string,
      { kode: string; nama: string; namaSekolah: string }
    >();
    for (const p of dataset.programs) {
      map.set(p.id, {
        kode: p.kodeProgram,
        nama: p.namaProgram,
        namaSekolah: p.namaSekolah ?? '',
      });
    }
    return map;
  }, [dataset.programs]);

  const activityMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of dataset.activities) {
      map.set(a.id, a.namaKegiatan);
    }
    return map;
  }, [dataset.activities]);

  const filteredEvidences = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...dataset.evidences]
      .sort((a, b) => b.tanggalUnggah.localeCompare(a.tanggalUnggah))
      .filter((ev) => {
        const matchType = typeFilter === 'ALL' || ev.jenis === typeFilter;
        const matchProg =
          programFilter === 'ALL' || ev.programId === programFilter;
        const progName = programMap.get(ev.programId)?.nama ?? '';
        const actName = ev.activityId ? activityMap.get(ev.activityId) ?? '' : '';
        const matchSearch =
          q === '' ||
          (ev.namaSekolah ?? '').toLowerCase().includes(q) ||
          ev.namaDokumen.toLowerCase().includes(q) ||
          ev.keterangan.toLowerCase().includes(q) ||
          progName.toLowerCase().includes(q) ||
          actName.toLowerCase().includes(q) ||
          (ev.fileName ?? '').toLowerCase().includes(q);
        return matchType && matchProg && matchSearch;
      });
  }, [
    dataset.evidences,
    search,
    typeFilter,
    programFilter,
    programMap,
    activityMap,
  ]);

  const activitiesForSelectedProgram = useMemo(() => {
    if (!form.programId) return [];
    return dataset.activities.filter((a) => a.programId === form.programId);
  }, [dataset.activities, form.programId]);

  const openCreateModal = () => {
    const firstProg = dataset.programs[0];
    setEditingItem(null);
    setFormErrors({});
    setForm({
      namaSekolah:
        firstProg?.namaSekolah ||
        (dataset.schoolProfile.namaSekolah !== 'Nama Sekolah Binaan'
          ? dataset.schoolProfile.namaSekolah
          : ''),
      namaDokumen: '',
      jenis: 'Foto Kegiatan',
      programId: firstProg?.id ?? '',
      activityId: '',
      tanggalUnggah: getTodayISO(),
      keterangan: '',
      fileUrl: '',
      fileName: '',
      fileMimeType: '',
      fileSize: undefined,
    });
    setFormOpen(true);
  };

  const openEditModal = (item: EvidenceItem) => {
    setEditingItem(item);
    setFormErrors({});
    setForm({
      namaSekolah: item.namaSekolah ?? '',
      namaDokumen: item.namaDokumen,
      jenis: item.jenis,
      programId: item.programId,
      activityId: item.activityId ?? '',
      tanggalUnggah: item.tanggalUnggah,
      keterangan: item.keterangan,
      fileUrl: item.fileUrl ?? '',
      fileName: item.fileName ?? '',
      fileMimeType: item.fileMimeType ?? '',
      fileSize: item.fileSize,
    });
    setFormOpen(true);
  };

  const fillEvidenceExample = () => {
    setFormErrors({});
    setForm((prev) => ({
      ...prev,
      namaSekolah:
        prev.namaSekolah.trim() || EVIDENCE_FIELD_EXAMPLES.namaSekolah[0],
      namaDokumen: EVIDENCE_FIELD_EXAMPLES.namaDokumen[0],
      jenis: 'Dokumen Kerja Sama',
      keterangan: EVIDENCE_FIELD_EXAMPLES.keterangan[0],
    }));
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      try {
        const compressed = await compressImageFile(file);
        setForm((prev) => ({
          ...prev,
          namaDokumen: prev.namaDokumen || file.name.replace(/\.[^/.]+$/, ''),
          fileUrl: compressed.dataUrl,
          fileName: file.name,
          fileMimeType: 'image/jpeg',
          fileSize: compressed.size,
        }));
      } catch {
        notify('error', 'Gagal memproses foto', 'Pilih berkas gambar JPG/PNG yang valid.');
      }
      return;
    }

    // Non-image document: store DataURL if <= 400KB (safely below Firestore 1MB limit), otherwise store metadata
    if (file.size <= 400 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        setForm((prev) => ({
          ...prev,
          namaDokumen: prev.namaDokumen || file.name.replace(/\.[^/.]+$/, ''),
          fileUrl: String(reader.result),
          fileName: file.name,
          fileMimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
        }));
      };
      reader.readAsDataURL(file);
    } else {
      setForm((prev) => ({
        ...prev,
        namaDokumen: prev.namaDokumen || file.name.replace(/\.[^/.]+$/, ''),
        fileUrl: '',
        fileName: file.name,
        fileMimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
      }));
      notify(
        'info',
        'Metadata berkas dicatat',
        'Ukuran dokumen di atas 400 KB. Nama dan keterangan berkas tetap tersimpan di Cloud Firestore tanpa melampaui batas ukuran dokumen 1 MB.'
      );
    }
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.namaSekolah.trim())
      errs.namaSekolah = 'Nama sekolah wajib diisi.';
    if (!form.namaDokumen.trim())
      errs.namaDokumen = 'Nama dokumen/bukti wajib diisi.';
    if (!form.programId) errs.programId = 'Pilih program terkait.';
    if (!form.tanggalUnggah)
      errs.tanggalUnggah = 'Tanggal unggah wajib diisi.';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      namaSekolah: form.namaSekolah.trim(),
      namaDokumen: form.namaDokumen.trim(),
      jenis: form.jenis,
      programId: form.programId,
      activityId: form.activityId || undefined,
      tanggalUnggah: form.tanggalUnggah,
      keterangan: form.keterangan.trim(),
      fileUrl: form.fileUrl || undefined,
      fileName: form.fileName || undefined,
      fileMimeType: form.fileMimeType || undefined,
      fileSize: form.fileSize,
    };

    const ok = editingItem
      ? updateEvidence(editingItem.id, payload)
      : addEvidence(payload);
    if (ok) setFormOpen(false);
  };

  const isImageEvidence = (ev: EvidenceItem) =>
    Boolean(
      ev.fileUrl &&
        (ev.fileMimeType?.startsWith('image/') ||
          ev.fileUrl.startsWith('data:image/') ||
          /\.(jpg|jpeg|png|webp)$/i.test(ev.fileUrl))
    );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs text-[#52635A] tabular-nums">
            {dataset.evidences.length} berkas bukti &amp; dokumentasi terarsip dalam
            sistem
          </p>
          <h2 className="mt-0.5 text-xl font-bold text-[#14221B]">
            Bukti &amp; Dokumentasi Kemitraan
          </h2>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            disabled={dataset.programs.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#14532D] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0F3F22] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Unggah Bukti</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama dokumen, program, kegiatan, atau keterangan..."
              className="w-full rounded-lg border border-[#D4DDD7] bg-white py-2 pr-3.5 pl-10 text-sm text-[#14221B] placeholder:text-[#7C8C84] focus:border-[#14532D] focus:outline-none"
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter jenis dokumen"
              className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            >
              <option value="ALL">Semua Jenis Bukti</option>
              {EVIDENCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              aria-label="Filter berdasarkan program"
              className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            >
              <option value="ALL">Semua Program Kemitraan</option>
              {dataset.programs.map((prg) => (
                <option key={prg.id} value={prg.id}>
                  {prg.kodeProgram} — {prg.namaProgram}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Evidence Grid + Document Register */}
      {filteredEvidences.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8E4] bg-white px-6 py-14 text-center">
          <p className="text-sm font-semibold text-[#14221B]">
            {dataset.evidences.length === 0
              ? 'Belum ada bukti dokumentasi yang tersimpan'
              : 'Tidak ada bukti yang sesuai dengan pencarian atau filter'}
          </p>
          <p className="mt-1 text-xs text-[#52635A]">
            Simpan foto kegiatan, dokumen kerja sama (MoU), daftar hadir, notulen,
            dan laporan kegiatan dalam satu repositori terpadu.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredEvidences.map((ev) => {
            const prog = programMap.get(ev.programId);
            const actName = ev.activityId ? activityMap.get(ev.activityId) : undefined;
            const showImage = isImageEvidence(ev) && !brokenImages[ev.id];

            return (
              <article
                key={ev.id}
                className="flex flex-col overflow-hidden rounded-xl border border-[#E2E8E4] bg-white"
              >
                {/* Media Preview / Document Header */}
                {showImage ? (
                  <button
                    type="button"
                    onClick={() => setPreviewItem(ev)}
                    className="group relative aspect-[4/3] w-full overflow-hidden bg-[#EAF0EC] text-left"
                  >
                    <img
                      src={ev.fileUrl}
                      alt={ev.namaDokumen}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setBrokenImages((prev) => ({ ...prev, [ev.id]: true }))
                      }
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPreviewItem(ev)}
                    className="flex aspect-[4/3] w-full flex-col items-center justify-center bg-[#F4F7F5] px-6 text-center transition-colors hover:bg-[#ECF3EE]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#14532D] border border-[#DCE5DF]">
                      {ev.jenis === 'Foto Kegiatan' ? (
                        <ImageIcon className="h-6 w-6" />
                      ) : (
                        <FileText className="h-6 w-6" />
                      )}
                    </div>
                    <span className="mt-3 text-xs font-semibold text-[#14532D]">
                      {ev.jenis}
                    </span>
                    {ev.fileName && (
                      <span className="mt-1 max-w-full truncate font-mono text-[11px] text-[#52635A]">
                        {ev.fileName}
                      </span>
                    )}
                  </button>
                )}

                {/* Metadata & Actions */}
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#52635A]">
                      {ev.namaSekolah && (
                        <>
                          <span className="font-semibold text-[#14221B]">
                            {ev.namaSekolah}
                          </span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="font-semibold text-[#14532D]">
                        {ev.jenis}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {formatDateID(ev.tanggalUnggah)}
                      </span>
                    </div>

                    <h3 className="mt-1.5 text-sm font-semibold leading-snug text-[#14221B]">
                      {ev.namaDokumen}
                    </h3>

                    <p className="mt-1 text-xs text-[#52635A]">
                      Program:{' '}
                      <span className="font-medium text-[#14221B]">
                        {prog ? `${prog.kode} ${prog.nama}` : '-'}
                      </span>
                    </p>
                    {actName && (
                      <p className="mt-0.5 text-xs text-[#52635A] line-clamp-1">
                        Kegiatan: {actName}
                      </p>
                    )}
                    {ev.keterangan && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#52635A]">
                        {ev.keterangan}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#EEF2EF] pt-3">
                    <button
                      type="button"
                      onClick={() => setPreviewItem(ev)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14532D] hover:underline"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Lihat Bukti</span>
                    </button>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(ev)}
                          className="rounded-md p-1.5 text-[#52635A] hover:bg-[#ECFDF5] hover:text-[#14532D]"
                          title="Edit keterangan bukti"
                          aria-label={`Edit ${ev.namaDokumen}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(ev)}
                          className="rounded-md p-1.5 text-[#52635A] hover:bg-red-50 hover:text-[#B91C1C]"
                          title="Hapus bukti"
                          aria-label={`Hapus ${ev.namaDokumen}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Upload / Edit Evidence Modal */}
      <Modal
        open={formOpen}
        title={
          editingItem
            ? 'Edit Bukti & Dokumentasi'
            : 'Unggah Bukti & Dokumentasi Baru'
        }
        subtitle="Hubungkan foto kegiatan atau dokumen kerja sama dengan program dan kegiatan terkait."
        onClose={() => setFormOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormFillExampleBar onFillAll={fillEvidenceExample} />

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
              examples={EVIDENCE_FIELD_EXAMPLES.namaSekolah}
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
              Nama Dokumen / Bukti *
            </label>
            <input
              type="text"
              value={form.namaDokumen}
              onChange={(e) =>
                setForm({ ...form, namaDokumen: e.target.value })
              }
              placeholder="Contoh: Nota Kesepakatan Kerja Sama Puskesmas 2026"
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
            <FieldExampleHint
              examples={EVIDENCE_FIELD_EXAMPLES.namaDokumen}
              onApply={(val) => setForm({ ...form, namaDokumen: val })}
            />
            {formErrors.namaDokumen && (
              <p className="mt-1 text-xs text-[#B91C1C]">
                {formErrors.namaDokumen}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Jenis Bukti *
              </label>
              <select
                value={form.jenis}
                onChange={(e) =>
                  setForm({ ...form, jenis: e.target.value as EvidenceType })
                }
                className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              >
                {EVIDENCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Tanggal Unggah *
              </label>
              <input
                type="date"
                value={form.tanggalUnggah}
                onChange={(e) =>
                  setForm({ ...form, tanggalUnggah: e.target.value })
                }
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              {formErrors.tanggalUnggah && (
                <p className="mt-1 text-xs text-[#B91C1C]">
                  {formErrors.tanggalUnggah}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Program Kemitraan Terkait *
              </label>
              <select
                value={form.programId}
                onChange={(e) => {
                  const prg = programMap.get(e.target.value);
                  setForm({
                    ...form,
                    programId: e.target.value,
                    namaSekolah: prg?.namaSekolah || form.namaSekolah,
                    activityId: '',
                  });
                }}
                className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              >
                <option value="">— Pilih Program —</option>
                {dataset.programs.map((prg) => (
                  <option key={prg.id} value={prg.id}>
                    {prg.kodeProgram} — {prg.namaProgram}
                  </option>
                ))}
              </select>
              {formErrors.programId && (
                <p className="mt-1 text-xs text-[#B91C1C]">
                  {formErrors.programId}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Kegiatan Terkait (Opsional)
              </label>
              <select
                value={form.activityId}
                onChange={(e) =>
                  setForm({ ...form, activityId: e.target.value })
                }
                className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              >
                <option value="">— Tingkat Program (Umum) —</option>
                {activitiesForSelectedProgram.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.namaKegiatan}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* File Upload Area */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#14221B]">
              Lampirkan Berkas Foto / Dokumen
            </label>
            <div className="rounded-lg border border-dashed border-[#B7C7BD] bg-[#F9FBFA] p-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileSelected}
                className="hidden"
              />
              <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 text-xs text-[#52635A]">
                  {form.fileName ? (
                    <>
                      <p className="truncate font-semibold text-[#14221B]">
                        {form.fileName}
                      </p>
                      <p className="mt-0.5 tabular-nums">
                        {formatFileSize(form.fileSize) || 'Berkas terpilih'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-[#14221B]">
                        Pilih foto (JPG/PNG) atau dokumen (PDF/Word/Excel)
                      </p>
                      <p className="mt-0.5">
                        Foto otomatis dikompresi agar optimal disimpan di Cloud
                        Firestore.
                      </p>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#14532D]/30 bg-white px-3.5 py-2 text-xs font-semibold text-[#14532D] hover:bg-[#ECFDF5] whitespace-nowrap shrink-0"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{form.fileName ? 'Ganti Berkas' : 'Pilih Berkas'}</span>
                </button>
              </div>
              {form.fileUrl && form.fileMimeType.startsWith('image/') && (
                <div className="mt-3 overflow-hidden rounded-lg border border-[#DCE5DF]">
                  <img
                    src={form.fileUrl}
                    alt="Pratinjau foto"
                    referrerPolicy="no-referrer"
                    className="max-h-44 w-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#14221B]">
              Keterangan
            </label>
            <textarea
              rows={3}
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              placeholder="Ringkasan isi dokumen, nomor surat, atau konteks foto kegiatan"
              className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
            />
            <FieldExampleHint
              examples={EVIDENCE_FIELD_EXAMPLES.keterangan}
              onApply={(val) => setForm({ ...form, keterangan: val })}
            />
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
              {editingItem ? 'Simpan Perubahan' : 'Simpan Bukti'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Preview Evidence Modal */}
      <Modal
        open={Boolean(previewItem)}
        title={previewItem?.namaDokumen ?? 'Detail Bukti'}
        subtitle={
          previewItem
            ? `${previewItem.jenis} · Diunggah ${formatDateID(previewItem.tanggalUnggah)}`
            : undefined
        }
        maxWidthClass="max-w-3xl"
        onClose={() => setPreviewItem(null)}
      >
        {previewItem && (
          <div className="space-y-4 text-sm">
            {isImageEvidence(previewItem) && !brokenImages[previewItem.id] ? (
              <div className="overflow-hidden rounded-lg border border-[#E2E8E4] bg-[#F4F7F5]">
                <img
                  src={previewItem.fileUrl}
                  alt={previewItem.namaDokumen}
                  referrerPolicy="no-referrer"
                  className="max-h-[460px] w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-[#E2E8E4] bg-[#F9FBFA] p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-6 w-6 shrink-0 text-[#14532D]" />
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-semibold text-[#14221B]">
                      {previewItem.fileName || 'Arsip Dokumen Terdaftar'}
                    </div>
                    <div className="text-xs text-[#52635A]">
                      {previewItem.jenis}
                      {previewItem.fileSize
                        ? ` · ${formatFileSize(previewItem.fileSize)}`
                        : ''}
                    </div>
                  </div>
                </div>
                {previewItem.fileUrl && (
                  <a
                    href={previewItem.fileUrl}
                    download={previewItem.fileName || previewItem.namaDokumen}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-3 py-2 text-xs font-medium text-white hover:bg-[#0F3F22] whitespace-nowrap shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Unduh</span>
                  </a>
                )}
              </div>
            )}

            <dl className="grid grid-cols-1 gap-3 border-t border-[#EEF2EF] pt-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">
                  Nama Sekolah
                </dt>
                <dd className="mt-0.5 font-semibold text-[#14532D]">
                  {previewItem.namaSekolah || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Program Terkait
                </dt>
                <dd className="mt-0.5 font-medium text-[#14221B]">
                  {programMap.get(previewItem.programId)?.kode} —{' '}
                  {programMap.get(previewItem.programId)?.nama ?? '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Kegiatan Terkait
                </dt>
                <dd className="mt-0.5 text-[#14221B]">
                  {previewItem.activityId
                    ? activityMap.get(previewItem.activityId) ?? '-'
                    : 'Dokumentasi tingkat program'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">Keterangan</dt>
                <dd className="mt-0.5 leading-relaxed text-[#14221B]">
                  {previewItem.keterangan || '-'}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Bukti Dokumentasi?"
        description={
          deleteTarget
            ? `Dokumen "${deleteTarget.namaDokumen}" akan dihapus permanen dari daftar dokumentasi.`
            : ''
        }
        confirmLabel="Ya, Hapus Bukti"
        onConfirm={() => {
          if (deleteTarget) deleteEvidence(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
