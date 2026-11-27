import React, { useEffect, useRef, useState } from 'react';
import {
  Database,
  Download,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  FieldExampleHint,
  FormFillExampleBar,
} from '../components/FieldExampleHint';
import { useMitraKita } from '../context/MitraKitaContext';
import { SETTINGS_FIELD_EXAMPLES } from '../data/fieldExamples';
import { SchoolProfile } from '../types/mitraKita';
import { getTodayISO } from '../utils/formatters';

export const SettingsPage: React.FC = () => {
  const {
    dataset,
    session,
    updateSupervisorProfile,
    updateSchoolProfile,
    resetAllData,
    importDatasetJson,
    notify,
  } = useMitraKita();

  const [supervisorName, setSupervisorName] = useState(
    session?.namaPengawas ?? ''
  );
  const [supervisorNip, setSupervisorNip] = useState(session?.nip ?? '');
  const [savingSupervisor, setSavingSupervisor] = useState(false);

  useEffect(() => {
    setSupervisorName(session?.namaPengawas ?? '');
    setSupervisorNip(session?.nip ?? '');
  }, [session?.namaPengawas, session?.nip]);

  const [profileForm, setProfileForm] = useState<SchoolProfile>(
    dataset.schoolProfile
  );
  useEffect(() => {
    setProfileForm(dataset.schoolProfile);
  }, [dataset.schoolProfile]);

  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleSaveSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorName.trim()) {
      notify('error', 'Nama Pengawas Sekolah wajib diisi');
      return;
    }
    setSavingSupervisor(true);
    await updateSupervisorProfile(supervisorName.trim(), supervisorNip.trim());
    setSavingSupervisor(false);
  };

  const fillSchoolProfileExample = () => {
    setProfileForm({
      namaSekolah: SETTINGS_FIELD_EXAMPLES.namaSekolah[0],
      npsn: SETTINGS_FIELD_EXAMPLES.npsn[0],
      kepalaSekolah: SETTINGS_FIELD_EXAMPLES.kepalaSekolah[0],
      nipKepalaSekolah: SETTINGS_FIELD_EXAMPLES.nipKepalaSekolah[0],
      namaPengawas: SETTINGS_FIELD_EXAMPLES.namaPengawas[0],
      nipPengawas: SETTINGS_FIELD_EXAMPLES.nipPengawas[0],
      tahunAjaran: SETTINGS_FIELD_EXAMPLES.tahunAjaran[0],
      alamatSekolah: SETTINGS_FIELD_EXAMPLES.alamatSekolah[0],
    });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.namaSekolah.trim()) {
      notify('error', 'Nama sekolah wajib diisi');
      return;
    }
    updateSchoolProfile({
      ...profileForm,
      namaSekolah: profileForm.namaSekolah.trim(),
      npsn: profileForm.npsn.trim(),
      kepalaSekolah: profileForm.kepalaSekolah.trim(),
      nipKepalaSekolah: (profileForm.nipKepalaSekolah ?? '').trim(),
      namaPengawas: profileForm.namaPengawas.trim(),
      nipPengawas: (profileForm.nipPengawas ?? '').trim(),
      alamatSekolah: profileForm.alamatSekolah.trim(),
      tahunAjaran: profileForm.tahunAjaran.trim(),
    });
  };

  const handleExportJson = () => {
    const jsonString = JSON.stringify(dataset, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Cadangan_MITRA_KITA_${getTodayISO()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify('success', 'Cadangan data JSON berhasil diunduh');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setBusyAction(true);
      const res = await importDatasetJson(String(reader.result));
      setBusyAction(false);
      if (!res.ok) {
        notify('error', 'Gagal memulihkan data', res.error);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-[#52635A]">
          Kelola profil Pengawas Sekolah, identitas sekolah binaan, serta
          cadangan data Cloud Firestore MITRA KITA.
        </p>
        <h2 className="mt-0.5 text-xl font-bold text-[#14221B]">
          Pengaturan Aplikasi
        </h2>
      </div>

      {/* 1. Profil Pengawas Sekolah (Akun Google) */}
      <section className="rounded-xl border border-[#E2E8E4] bg-white p-6">
        <div className="flex items-start gap-3 border-b border-[#EEF2EF] pb-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#14532D]" />
          <div>
            <h3 className="text-base font-semibold text-[#14221B]">
              Profil Pengawas Sekolah
            </h3>
            <p className="mt-0.5 text-xs text-[#52635A]">
              Lengkapi nama resmi beserta gelar dan NIP Pengawas Sekolah untuk
              penanda tangan laporan dan catatan pembinaan.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSupervisor} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Email Akun Google
              </label>
              <input
                type="text"
                value={session?.email ?? ''}
                disabled
                className="w-full rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] px-3 py-2 text-sm text-[#52635A]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Nama Pengawas Sekolah *
              </label>
              <input
                type="text"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                placeholder="Contoh: Drs. H. Ahmad Fauzi, M.M."
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={SETTINGS_FIELD_EXAMPLES.supervisorName}
                onApply={setSupervisorName}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                NIP / ID Pengawas
              </label>
              <input
                type="text"
                value={supervisorNip}
                onChange={(e) => setSupervisorNip(e.target.value)}
                placeholder="Contoh: 197504122000031002"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 font-mono text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={SETTINGS_FIELD_EXAMPLES.supervisorNip}
                onApply={setSupervisorNip}
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingSupervisor}
              className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F3F22] disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span>
                {savingSupervisor ? 'Menyimpan...' : 'Simpan Profil Pengawas'}
              </span>
            </button>
          </div>
        </form>
      </section>

      {/* 2. Identitas Sekolah */}
      <section className="rounded-xl border border-[#E2E8E4] bg-white p-6">
        <div className="border-b border-[#EEF2EF] pb-4">
          <h3 className="text-base font-semibold text-[#14221B]">
            Identitas Satuan Pendidikan Binaan
          </h3>
          <p className="mt-0.5 text-xs text-[#52635A]">
            Informasi ini ditampilkan pada kop header dan dokumen cetak Laporan
            Kemitraan Sekolah.
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
          <FormFillExampleBar onFillAll={fillSchoolProfileExample} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Nama Sekolah *
              </label>
              <input
                type="text"
                value={profileForm.namaSekolah}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    namaSekolah: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={SETTINGS_FIELD_EXAMPLES.namaSekolah}
                onApply={(val) =>
                  setProfileForm({ ...profileForm, namaSekolah: val })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                NPSN
              </label>
              <input
                type="text"
                value={profileForm.npsn}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, npsn: e.target.value })
                }
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 font-mono text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={SETTINGS_FIELD_EXAMPLES.npsn}
                onApply={(val) => setProfileForm({ ...profileForm, npsn: val })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Nama Kepala Sekolah
              </label>
              <input
                type="text"
                value={profileForm.kepalaSekolah}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    kepalaSekolah: e.target.value,
                  })
                }
                placeholder="Nama lengkap & gelar Kepala Sekolah"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={SETTINGS_FIELD_EXAMPLES.kepalaSekolah}
                onApply={(val) =>
                  setProfileForm({ ...profileForm, kepalaSekolah: val })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                NIP Kepala Sekolah
              </label>
              <input
                type="text"
                value={profileForm.nipKepalaSekolah ?? ''}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    nipKepalaSekolah: e.target.value,
                  })
                }
                placeholder="Contoh: 197408211998022001"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 font-mono text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={SETTINGS_FIELD_EXAMPLES.nipKepalaSekolah}
                onApply={(val) =>
                  setProfileForm({ ...profileForm, nipKepalaSekolah: val })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Nama Pengawas Pembina
              </label>
              <input
                type="text"
                value={profileForm.namaPengawas}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    namaPengawas: e.target.value,
                  })
                }
                placeholder="Nama lengkap & gelar Pengawas Sekolah"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={SETTINGS_FIELD_EXAMPLES.namaPengawas}
                onApply={(val) =>
                  setProfileForm({ ...profileForm, namaPengawas: val })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                NIP Pengawas Pembina
              </label>
              <input
                type="text"
                value={profileForm.nipPengawas ?? ''}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    nipPengawas: e.target.value,
                  })
                }
                placeholder="Contoh: 197504122000031002"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 font-mono text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={SETTINGS_FIELD_EXAMPLES.nipPengawas}
                onApply={(val) =>
                  setProfileForm({ ...profileForm, nipPengawas: val })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Tahun Ajaran
              </label>
              <input
                type="text"
                value={profileForm.tahunAjaran}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    tahunAjaran: e.target.value,
                  })
                }
                placeholder="2026/2027"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={SETTINGS_FIELD_EXAMPLES.tahunAjaran}
                onApply={(val) =>
                  setProfileForm({ ...profileForm, tahunAjaran: val })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Alamat Sekolah
              </label>
              <input
                type="text"
                value={profileForm.alamatSekolah}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    alamatSekolah: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={SETTINGS_FIELD_EXAMPLES.alamatSekolah}
                onApply={(val) =>
                  setProfileForm({ ...profileForm, alamatSekolah: val })
                }
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F3F22]"
            >
              <Save className="h-4 w-4" />
              <span>Simpan Identitas Sekolah</span>
            </button>
          </div>
        </form>
      </section>

      {/* 3. Ringkasan Data & Cadangan JSON */}
      <section className="rounded-xl border border-[#E2E8E4] bg-white p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-[#14532D]" />
          <div>
            <h3 className="text-base font-semibold text-[#14221B]">
              Cadangkan, Pulihkan &amp; Reset Data Cloud Firestore
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-[#52635A]">
              Seluruh data kemitraan tersimpan otomatis di database Firebase
              Cloud Firestore sesuai akun Pengawas Sekolah Anda. Anda dapat
              mengunduh cadangan JSON, memulihkan berkas cadangan, atau
              mengosongkan seluruh data.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#F6F8F7] p-4 text-xs sm:grid-cols-3 lg:grid-cols-6 tabular-nums">
          <div>
            <div className="text-[#52635A]">Mitra</div>
            <div className="mt-0.5 font-mono text-base font-bold text-[#14221B]">
              {dataset.partners.length}
            </div>
          </div>
          <div>
            <div className="text-[#52635A]">Program</div>
            <div className="mt-0.5 font-mono text-base font-bold text-[#14221B]">
              {dataset.programs.length}
            </div>
          </div>
          <div>
            <div className="text-[#52635A]">Kegiatan</div>
            <div className="mt-0.5 font-mono text-base font-bold text-[#14221B]">
              {dataset.activities.length}
            </div>
          </div>
          <div>
            <div className="text-[#52635A]">Bukti</div>
            <div className="mt-0.5 font-mono text-base font-bold text-[#14221B]">
              {dataset.evidences.length}
            </div>
          </div>
          <div>
            <div className="text-[#52635A]">Monitoring</div>
            <div className="mt-0.5 font-mono text-base font-bold text-[#14221B]">
              {dataset.evaluations.length}
            </div>
          </div>
          <div>
            <div className="text-[#52635A]">Catatan Pengawas</div>
            <div className="mt-0.5 font-mono text-base font-bold text-[#14221B]">
              {dataset.supervisorNotes.length}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportJson}
              disabled={busyAction}
              className="inline-flex items-center gap-2 rounded-lg border border-[#D4DDD7] bg-white px-4 py-2 text-xs font-semibold text-[#14221B] hover:bg-[#F6F8F7] disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5 text-[#14532D]" />
              <span>Unduh Cadangan (.json)</span>
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportJson}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={busyAction}
              className="inline-flex items-center gap-2 rounded-lg border border-[#D4DDD7] bg-white px-4 py-2 text-xs font-semibold text-[#14221B] hover:bg-[#F6F8F7] disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5 text-[#14532D]" />
              <span>
                {busyAction
                  ? 'Memproses data...'
                  : 'Pulihkan dari Cadangan (.json)'}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setConfirmResetAll(true)}
            disabled={busyAction}
            className="inline-flex items-center gap-2 rounded-lg bg-[#B91C1C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#991B1B] disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Kosongkan Seluruh Data</span>
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmResetAll}
        title="Kosongkan Seluruh Data Aplikasi?"
        description="Tindakan ini akan menghapus permanen seluruh data mitra, program, kegiatan, dokumentasi, monitoring, dan catatan pembinaan milik akun Anda di Firebase Firestore. Pastikan Anda sudah mengunduh cadangan JSON bila diperlukan."
        confirmLabel="Ya, Kosongkan Semua"
        onConfirm={async () => {
          setConfirmResetAll(false);
          setBusyAction(true);
          await resetAllData();
          setBusyAction(false);
        }}
        onCancel={() => setConfirmResetAll(false)}
      />
    </div>
  );
};
