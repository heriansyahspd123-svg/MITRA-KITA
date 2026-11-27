import React, { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Search, X } from 'lucide-react';
import { useMitraKita } from '../context/MitraKitaContext';
import {
  PARTNER_CATEGORIES,
  PARTNER_STATUSES,
  Partner,
  PartnerCategory,
  PartnerStatus,
} from '../types/mitraKita';

interface PartnerMultiSelectWithQuickEditProps {
  label?: string;
  selectedIds: string[];
  onToggleId: (partnerId: string) => void;
  onSelectId: (partnerId: string) => void;
  namaSekolah?: string;
}

interface InlinePartnerForm {
  nama: string;
  kategori: PartnerCategory;
  namaSekolah: string;
  penanggungJawab: string;
  telepon: string;
  jenisKontribusi: string;
  status: PartnerStatus;
}

export const PartnerMultiSelectWithQuickEdit: React.FC<
  PartnerMultiSelectWithQuickEditProps
> = ({
  label = 'Mitra yang Terlibat dalam Kegiatan',
  selectedIds,
  onToggleId,
  onSelectId,
  namaSekolah,
}) => {
  const {
    dataset,
    isAdmin,
    addPartner,
    updatePartner,
    getNextPartnerId,
  } = useMitraKita();

  const [searchTerm, setSearchTerm] = useState('');
  const [editorMode, setEditorMode] = useState<'closed' | 'create' | 'edit'>(
    'closed'
  );
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formError, setFormError] = useState('');
  const [pendingPartner, setPendingPartner] = useState<Partner | null>(null);

  const [inlineForm, setInlineForm] = useState<InlinePartnerForm>({
    nama: '',
    kategori: 'Komite Sekolah',
    namaSekolah: '',
    penanggungJawab: '',
    telepon: '',
    jenisKontribusi: '',
    status: 'Aktif',
  });

  const resolvedDefaultSchool =
    (namaSekolah || '').trim() ||
    (dataset.schoolProfile.namaSekolah !== 'Nama Sekolah Binaan'
      ? dataset.schoolProfile.namaSekolah
      : '') ||
    '';

  const openCreateForm = () => {
    setEditingPartner(null);
    setFormError('');
    setInlineForm({
      nama: '',
      kategori: 'Komite Sekolah',
      namaSekolah: resolvedDefaultSchool,
      penanggungJawab: '',
      telepon: '',
      jenisKontribusi: '',
      status: 'Aktif',
    });
    setEditorMode('create');
  };

  const openEditForm = (partner: Partner) => {
    setEditingPartner(partner);
    setFormError('');
    setInlineForm({
      nama: partner.nama,
      kategori: partner.kategori,
      namaSekolah: partner.namaSekolah || resolvedDefaultSchool,
      penanggungJawab: partner.penanggungJawab || '',
      telepon: partner.telepon || '',
      jenisKontribusi: partner.jenisKontribusi || '',
      status: partner.status,
    });
    setEditorMode('edit');
  };

  const closeEditor = () => {
    setEditorMode('closed');
    setEditingPartner(null);
    setFormError('');
  };

  const handleSaveInlinePartner = () => {
    const cleanName = inlineForm.nama.trim();
    if (!cleanName) {
      setFormError('Nama mitra / lembaga wajib diisi.');
      return;
    }

    const cleanSchool =
      inlineForm.namaSekolah.trim() ||
      resolvedDefaultSchool ||
      'Sekolah Binaan';
    const cleanPj =
      inlineForm.penanggungJawab.trim() ||
      dataset.schoolProfile.kepalaSekolah ||
      'Koordinator Mitra';

    if (editorMode === 'create') {
      const nextId = getNextPartnerId();
      const nowIso = new Date().toISOString();
      const ok = addPartner({
        id: nextId,
        namaSekolah: cleanSchool,
        nama: cleanName,
        kategori: inlineForm.kategori,
        penanggungJawab: cleanPj,
        telepon: inlineForm.telepon.trim(),
        alamat: dataset.schoolProfile.alamatSekolah || '',
        jenisKontribusi: inlineForm.jenisKontribusi.trim(),
        potensiKerjaSama:
          inlineForm.jenisKontribusi.trim() ||
          'Dukungan pelaksanaan kegiatan kemitraan sekolah',
        status: inlineForm.status,
        catatan: 'Ditambahkan langsung melalui formulir kegiatan.',
      });

      if (ok) {
        setPendingPartner({
          id: nextId,
          namaSekolah: cleanSchool,
          nama: cleanName,
          kategori: inlineForm.kategori,
          penanggungJawab: cleanPj,
          telepon: inlineForm.telepon.trim(),
          alamat: dataset.schoolProfile.alamatSekolah || '',
          jenisKontribusi: inlineForm.jenisKontribusi.trim(),
          potensiKerjaSama:
            inlineForm.jenisKontribusi.trim() ||
            'Dukungan pelaksanaan kegiatan kemitraan sekolah',
          status: inlineForm.status,
          catatan: 'Ditambahkan langsung melalui formulir kegiatan.',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        onSelectId(nextId);
        closeEditor();
      }
      return;
    }

    if (editorMode === 'edit' && editingPartner) {
      const ok = updatePartner(editingPartner.id, {
        namaSekolah: cleanSchool,
        nama: cleanName,
        kategori: inlineForm.kategori,
        penanggungJawab: cleanPj,
        telepon: inlineForm.telepon.trim(),
        alamat: editingPartner.alamat || '',
        jenisKontribusi: inlineForm.jenisKontribusi.trim(),
        potensiKerjaSama: editingPartner.potensiKerjaSama || '',
        status: inlineForm.status,
        catatan: editingPartner.catatan || '',
      });
      if (ok) {
        closeEditor();
      }
    }
  };

  // Merge pending newly-created partner (if Firestore snapshot hasn't echoed yet) + sort matching school first
  const visiblePartners = useMemo(() => {
    const baseList =
      pendingPartner &&
      !dataset.partners.some((p) => p.id === pendingPartner.id)
        ? [pendingPartner, ...dataset.partners]
        : dataset.partners;

    const q = searchTerm.trim().toLowerCase();
    const activeSchoolKey = (namaSekolah || '').trim().toLowerCase();

    return [...baseList]
      .filter((p) => {
        if (!q) return true;
        return (
          p.nama.toLowerCase().includes(q) ||
          p.kategori.toLowerCase().includes(q) ||
          (p.namaSekolah || '').toLowerCase().includes(q) ||
          (p.penanggungJawab || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aSelected = selectedIds.includes(a.id) ? 0 : 1;
        const bSelected = selectedIds.includes(b.id) ? 0 : 1;
        if (aSelected !== bSelected) return aSelected - bSelected;
        if (activeSchoolKey) {
          const aMatch =
            (a.namaSekolah || '').trim().toLowerCase() === activeSchoolKey
              ? 0
              : 1;
          const bMatch =
            (b.namaSekolah || '').trim().toLowerCase() === activeSchoolKey
              ? 0
              : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
        }
        return a.nama.localeCompare(b.nama);
      });
  }, [dataset.partners, pendingPartner, searchTerm, namaSekolah, selectedIds]);

  const activeSchoolKey = (namaSekolah || '').trim().toLowerCase();

  return (
    <div className="space-y-2">
      {/* Label & Input Mitra Baru Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-semibold text-[#14221B]">
          {label}{' '}
          <span className="font-normal text-[#5B6F65]">
            ({selectedIds.length} dipilih)
          </span>
        </label>

        {isAdmin && (
          <button
            type="button"
            onClick={() =>
              editorMode === 'create' ? closeEditor() : openCreateForm()
            }
            className="inline-flex items-center gap-1 rounded-lg border border-[#14532D]/25 bg-[#EDF6F0] px-2.5 py-1 text-[11.5px] font-semibold text-[#14532D] transition-colors hover:bg-[#DCFCE7]"
          >
            {editorMode === 'create' ? (
              <>
                <X className="h-3.5 w-3.5" />
                <span>Tutup Form</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                <span>Input Mitra Baru</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Inline Create / Edit Partner Panel */}
      {editorMode !== 'closed' && isAdmin && (
        <div className="space-y-3 rounded-xl border border-[#C7DCD0] bg-[#F5FAF7] p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-[#14532D]">
                {editorMode === 'create'
                  ? 'Input Mitra Baru'
                  : `Edit Data Mitra (${editingPartner?.id ?? ''})`}
              </p>
              <p className="text-[11px] text-[#4D6358]">
                {editorMode === 'create'
                  ? 'Otomatis tersimpan ke Data Mitra & langsung dicentang untuk kegiatan ini.'
                  : 'Perubahan langsung tersimpan ke Data Mitra di seluruh aplikasi.'}
              </p>
            </div>
            <button
              type="button"
              onClick={closeEditor}
              className="rounded-md p-1 text-[#5B6F65] hover:bg-white/80 hover:text-[#11221A]"
              aria-label="Tutup editor mitra"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                Nama Mitra / Lembaga *
              </label>
              <input
                type="text"
                value={inlineForm.nama}
                onChange={(e) => {
                  setInlineForm({ ...inlineForm, nama: e.target.value });
                  if (formError) setFormError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveInlinePartner();
                  }
                }}
                placeholder="Contoh: Puskesmas Tellu Limpoe / UMKM Kuliner Massepe"
                className="w-full rounded-lg border border-[#C7DCD0] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                Kategori Mitra
              </label>
              <select
                value={inlineForm.kategori}
                onChange={(e) =>
                  setInlineForm({
                    ...inlineForm,
                    kategori: e.target.value as PartnerCategory,
                  })
                }
                className="w-full rounded-lg border border-[#C7DCD0] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
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
                Status Mitra
              </label>
              <select
                value={inlineForm.status}
                onChange={(e) =>
                  setInlineForm({
                    ...inlineForm,
                    status: e.target.value as PartnerStatus,
                  })
                }
                className="w-full rounded-lg border border-[#C7DCD0] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
              >
                {PARTNER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                Penanggung Jawab / Kontak
              </label>
              <input
                type="text"
                value={inlineForm.penanggungJawab}
                onChange={(e) =>
                  setInlineForm({
                    ...inlineForm,
                    penanggungJawab: e.target.value,
                  })
                }
                placeholder="Nama ketua / koordinator mitra"
                className="w-full rounded-lg border border-[#C7DCD0] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                No. Telepon / WhatsApp
              </label>
              <input
                type="text"
                value={inlineForm.telepon}
                onChange={(e) =>
                  setInlineForm({ ...inlineForm, telepon: e.target.value })
                }
                placeholder="08xxxxxxxxxx (opsional)"
                className="w-full rounded-lg border border-[#C7DCD0] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                Sekolah Terkait
              </label>
              <input
                type="text"
                list="mitra-kita-school-list"
                value={inlineForm.namaSekolah}
                onChange={(e) =>
                  setInlineForm({ ...inlineForm, namaSekolah: e.target.value })
                }
                placeholder="Nama sekolah binaan"
                className="w-full rounded-lg border border-[#C7DCD0] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                Jenis Kontribusi
              </label>
              <input
                type="text"
                value={inlineForm.jenisKontribusi}
                onChange={(e) =>
                  setInlineForm({
                    ...inlineForm,
                    jenisKontribusi: e.target.value,
                  })
                }
                placeholder="Narasumber, pendampingan, sarana, dll."
                className="w-full rounded-lg border border-[#C7DCD0] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
            </div>
          </div>

          {formError && (
            <p className="text-[11.5px] font-medium text-[#B91C1C]">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={closeEditor}
              className="rounded-lg border border-[#CFDCD4] bg-white px-3 py-1.5 text-xs font-medium text-[#4A5E54] hover:bg-[#F3F6F4]"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveInlinePartner}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0E3F22]"
            >
              <Check className="h-3.5 w-3.5" />
              <span>
                {editorMode === 'create'
                  ? 'Simpan & Pilih Mitra'
                  : 'Simpan Perubahan Mitra'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Partner Checklist Container */}
      <div className="rounded-lg border border-[#D4DDD7] bg-white p-2.5 space-y-2">
        {dataset.partners.length > 4 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7D9186]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama mitra, kategori, atau sekolah..."
              className="w-full rounded-md border border-[#E2EAE5] bg-[#FAFDFB] py-1.5 pl-8 pr-3 text-xs text-[#14221B] placeholder:text-[#7D9186] focus:border-[#14532D] focus:bg-white focus:outline-none"
            />
          </div>
        )}

        {visiblePartners.length === 0 ? (
          <p className="py-3 text-center text-xs text-[#5B6F65]">
            {dataset.partners.length === 0
              ? 'Belum ada data mitra. Klik "+ Input Mitra Baru" di atas untuk menambahkan.'
              : 'Tidak ada mitra yang cocok dengan pencarian.'}
          </p>
        ) : (
          <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-2">
            {visiblePartners.map((partner) => {
              const checked = selectedIds.includes(partner.id);
              const isBeingEdited =
                editorMode === 'edit' && editingPartner?.id === partner.id;
              const sameSchool =
                activeSchoolKey !== '' &&
                (partner.namaSekolah || '').trim().toLowerCase() ===
                  activeSchoolKey;

              return (
                <div
                  key={partner.id}
                  className={`flex items-start gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                    isBeingEdited
                      ? 'border-[#14532D] bg-[#EDF6F0]'
                      : checked
                        ? 'border-[#BFE0CB] bg-[#ECFDF5] text-[#14532D]'
                        : 'border-transparent hover:bg-[#F6F8F7] text-[#14221B]'
                  }`}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleId(partner.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#14532D]"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate ${
                          checked
                            ? 'font-semibold text-[#14532D]'
                            : 'font-medium text-[#14221B]'
                        }`}
                        title={partner.nama}
                      >
                        {partner.nama}
                      </span>
                      <span className="block truncate text-[10.5px] text-[#5B6F65]">
                        {partner.kategori}
                        {partner.namaSekolah ? ` · ${partner.namaSekolah}` : ''}
                        {sameSchool ? ' · Sekolah ini' : ''}
                      </span>
                    </span>
                  </label>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => openEditForm(partner)}
                      title={`Edit mitra ${partner.nama}`}
                      aria-label={`Edit mitra ${partner.nama}`}
                      className={`mt-0.5 shrink-0 rounded-md p-1 transition-colors ${
                        isBeingEdited
                          ? 'bg-[#14532D] text-white'
                          : 'text-[#6B7F74] hover:bg-white hover:text-[#14532D]'
                      }`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
