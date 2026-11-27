import React, { useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useMitraKita } from '../context/MitraKitaContext';
import { PM_LEADERSHIP_AREAS, PmLeadershipArea } from '../types/mitraKita';

const QUICK_ADD_OPTION_VALUE = '__QUICK_ADD_PROGRAM__';

interface ProgramSelectWithQuickAddProps {
  label: string;
  value: string;
  onChange: (programId: string) => void;
  namaSekolah?: string;
  penanggungJawab?: string;
  emptyOptionLabel?: string;
  error?: string;
  canCreate?: boolean;
}

interface PendingProgramOption {
  id: string;
  kodeProgram: string;
  namaProgram: string;
  namaSekolah: string;
}

export const ProgramSelectWithQuickAdd: React.FC<
  ProgramSelectWithQuickAddProps
> = ({
  label,
  value,
  onChange,
  namaSekolah,
  penanggungJawab,
  emptyOptionLabel = '— Pilih Program —',
  error,
  canCreate = true,
}) => {
  const { dataset, isAdmin, addProgram, getNextProgramCode } = useMitraKita();

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [kodeProgram, setKodeProgram] = useState('');
  const [namaProgram, setNamaProgram] = useState('');
  const [areaPm, setAreaPm] = useState<PmLeadershipArea>(
    'Kemitraan Pembelajaran'
  );
  const [sumberPembiayaan, setSumberPembiayaan] = useState(
    'RKAS / BOSP & Dukungan Mitra'
  );
  const [anggaranRencana, setAnggaranRencana] = useState('0');
  const [quickError, setQuickError] = useState('');
  const [pendingOption, setPendingOption] =
    useState<PendingProgramOption | null>(null);

  const allowQuickAdd = canCreate && isAdmin;

  const openQuickAdd = () => {
    setKodeProgram(getNextProgramCode());
    setNamaProgram('');
    setAreaPm('Kemitraan Pembelajaran');
    setSumberPembiayaan('RKAS / BOSP & Dukungan Mitra');
    setAnggaranRencana('0');
    setQuickError('');
    setQuickAddOpen(true);
  };

  const closeQuickAdd = () => {
    setQuickAddOpen(false);
    setQuickError('');
  };

  const handleCreateQuickProgram = () => {
    const cleanName = namaProgram.trim();
    if (!cleanName) {
      setQuickError('Nama program wajib diisi.');
      return;
    }
    const cleanCode = kodeProgram.trim() || getNextProgramCode();
    const resolvedSchool =
      (namaSekolah || '').trim() ||
      (dataset.schoolProfile.namaSekolah !== 'Nama Sekolah Binaan'
        ? dataset.schoolProfile.namaSekolah
        : '') ||
      'Sekolah Binaan';
    const resolvedPj =
      (penanggungJawab || '').trim() ||
      dataset.schoolProfile.kepalaSekolah ||
      'Tim Pengembang Kemitraan';
    const budget = Math.max(0, Number(anggaranRencana) || 0);

    const ok = addProgram(
      {
        namaSekolah: resolvedSchool,
        kodeProgram: cleanCode,
        namaProgram: cleanName,
        latarBelakang: `Program kemitraan yang diinput langsung untuk mendukung kegiatan ${resolvedSchool}.`,
        tujuan: `Mendukung keterlaksanaan program ${cleanName} secara kolaboratif bersama mitra sekolah.`,
        areaPm,
        partnerIds: [],
        sasaran: `Peserta didik & pendidik ${resolvedSchool}`,
        bentukKontribusi: 'Dukungan program, narasumber, sarana, atau pendampingan',
        strategiPelaksanaan: `Koordinasi dan pelaksanaan terpadu bersama mitra terkait di ${resolvedSchool}.`,
        waktuPelaksanaan: `Tahun Ajaran ${dataset.schoolProfile.tahunAjaran || '2026/2027'}`,
        penanggungJawab: resolvedPj,
        sumberPembiayaan:
          sumberPembiayaan.trim() || 'RKAS / BOSP & Dukungan Mitra',
        anggaranRencana: budget,
        indikatorKeberhasilan: `Terlaksananya kegiatan pada program ${cleanName} sesuai jadwal dan terdokumentasi.`,
        targetHasil: `Peningkatan mutu layanan dan capaian Pembelajaran Mendalam di ${resolvedSchool}.`,
        status: 'Sedang Berjalan',
      },
      (newId) => {
        setPendingOption({
          id: newId,
          kodeProgram: cleanCode,
          namaProgram: cleanName,
          namaSekolah: resolvedSchool,
        });
        onChange(newId);
      }
    );

    if (ok) {
      setQuickAddOpen(false);
      setQuickError('');
    }
  };

  // Detect if multiple schools exist so we show school names clearly beside duplicate RKAS codes
  const { matchingPrograms, otherPrograms, showSchoolTag } = useMemo(() => {
    const schoolSet = new Set(
      dataset.programs
        .map((p) => (p.namaSekolah || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const hasMultipleSchools = schoolSet.size > 1;
    const activeSchoolKey = (namaSekolah || '').trim().toLowerCase();

    if (!activeSchoolKey) {
      return {
        matchingPrograms: dataset.programs,
        otherPrograms: [] as typeof dataset.programs,
        showSchoolTag: hasMultipleSchools,
      };
    }

    const matched: typeof dataset.programs = [];
    const others: typeof dataset.programs = [];
    for (const prg of dataset.programs) {
      if ((prg.namaSekolah || '').trim().toLowerCase() === activeSchoolKey) {
        matched.push(prg);
      } else {
        others.push(prg);
      }
    }

    return {
      matchingPrograms: matched,
      otherPrograms: others,
      showSchoolTag: hasMultipleSchools,
    };
  }, [dataset.programs, namaSekolah]);

  const showPendingInList =
    pendingOption &&
    !dataset.programs.some((p) => p.id === pendingOption.id);

  const formatOptionLabel = (
    kode: string,
    nama: string,
    school: string | undefined,
    includeSchool: boolean
  ) => {
    const base = `${kode} — ${nama}`;
    if (includeSchool && school && school.trim()) {
      return `${base} (${school.trim()})`;
    }
    return base;
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-[#14221B]">
          {label}
        </label>
        {allowQuickAdd && (
          <button
            type="button"
            onClick={() => (quickAddOpen ? closeQuickAdd() : openQuickAdd())}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-semibold text-[#14532D] transition-colors hover:bg-[#EAF4EE]"
          >
            {quickAddOpen ? (
              <>
                <X className="h-3 w-3" />
                <span>Tutup Input</span>
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" />
                <span>Program Baru</span>
              </>
            )}
          </button>
        )}
      </div>

      <select
        value={value}
        onChange={(e) => {
          const nextVal = e.target.value;
          if (nextVal === QUICK_ADD_OPTION_VALUE) {
            openQuickAdd();
            return;
          }
          onChange(nextVal);
        }}
        className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
      >
        <option value="">{emptyOptionLabel}</option>
        {allowQuickAdd && (
          <option value={QUICK_ADD_OPTION_VALUE}>
            + Input Program Baru (Manual / Non-RKAS)...
          </option>
        )}
        {showPendingInList && pendingOption && (
          <option value={pendingOption.id}>
            {formatOptionLabel(
              pendingOption.kodeProgram,
              pendingOption.namaProgram,
              pendingOption.namaSekolah,
              showSchoolTag
            )}
          </option>
        )}

        {namaSekolah?.trim() &&
        matchingPrograms.length > 0 &&
        otherPrograms.length > 0 ? (
          <>
            <optgroup
              label={`Program ${namaSekolah.trim()} (${matchingPrograms.length})`}
            >
              {matchingPrograms.map((prg) => (
                <option key={prg.id} value={prg.id}>
                  {formatOptionLabel(
                    prg.kodeProgram,
                    prg.namaProgram,
                    prg.namaSekolah,
                    false
                  )}
                </option>
              ))}
            </optgroup>
            <optgroup label={`Program Sekolah Lainnya (${otherPrograms.length})`}>
              {otherPrograms.map((prg) => (
                <option key={prg.id} value={prg.id}>
                  {formatOptionLabel(
                    prg.kodeProgram,
                    prg.namaProgram,
                    prg.namaSekolah,
                    true
                  )}
                </option>
              ))}
            </optgroup>
          </>
        ) : (
          dataset.programs.map((prg) => (
            <option key={prg.id} value={prg.id}>
              {formatOptionLabel(
                prg.kodeProgram,
                prg.namaProgram,
                prg.namaSekolah,
                showSchoolTag
              )}
            </option>
          ))
        )}
      </select>

      {error && <p className="mt-1 text-xs text-[#B91C1C]">{error}</p>}

      {quickAddOpen && allowQuickAdd && (
        <div className="mt-2.5 space-y-3 rounded-xl border border-[#C7DCD0] bg-[#F5FAF7] p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-[#14532D]">
                Input Program Kemitraan Baru
              </p>
              <p className="text-[11px] text-[#4D6358]">
                Otomatis tersimpan ke Data Program &amp; langsung dipilih di
                formulir ini.
              </p>
            </div>
            <button
              type="button"
              onClick={closeQuickAdd}
              className="rounded-md p-1 text-[#5B6F65] hover:bg-white/80 hover:text-[#11221A]"
              aria-label="Tutup form program baru"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                Nama Program Baru *
              </label>
              <input
                type="text"
                value={namaProgram}
                onChange={(e) => {
                  setNamaProgram(e.target.value);
                  if (quickError) setQuickError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateQuickProgram();
                  }
                }}
                placeholder="Contoh: Gerakan Literasi Sekolah Bersama Komunitas Baca"
                className="w-full rounded-lg border border-[#C7DCD0] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                  Kode Program
                </label>
                <input
                  type="text"
                  value={kodeProgram}
                  onChange={(e) => setKodeProgram(e.target.value)}
                  placeholder="Misal: RKAS-03.05 / PRG-01"
                  className="w-full rounded-lg border border-[#C7DCD0] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                  Area PM
                </label>
                <select
                  value={areaPm}
                  onChange={(e) =>
                    setAreaPm(e.target.value as PmLeadershipArea)
                  }
                  className="w-full rounded-lg border border-[#C7DCD0] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                >
                  {PM_LEADERSHIP_AREAS.map((area) => (
                    <option key={area.code} value={area.label}>
                      {area.code}. {area.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                  Sumber Dana
                </label>
                <input
                  type="text"
                  value={sumberPembiayaan}
                  onChange={(e) => setSumberPembiayaan(e.target.value)}
                  placeholder="BOSP / Swadaya Mitra"
                  className="w-full rounded-lg border border-[#C7DCD0] bg-white px-2.5 py-1.5 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#14221B]">
                  Anggaran Rencana (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={anggaranRencana}
                  onChange={(e) => setAnggaranRencana(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-[#C7DCD0] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {quickError && (
            <p className="text-[11.5px] font-medium text-[#B91C1C]">
              {quickError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={closeQuickAdd}
              className="rounded-lg border border-[#CFDCD4] bg-white px-3 py-1.5 text-xs font-medium text-[#4A5E54] hover:bg-[#F3F6F4]"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleCreateQuickProgram}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0E3F22]"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Simpan &amp; Pilih Program</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
