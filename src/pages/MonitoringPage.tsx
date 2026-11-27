import React, { useMemo, useState } from 'react';
import {
  ClipboardCheck,
  Eye,
  MessageSquarePlus,
  Plus,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  FieldExampleHint,
  FormFillExampleBar,
} from '../components/FieldExampleHint';
import { Modal } from '../components/Modal';
import { useMitraKita } from '../context/MitraKitaContext';
import { MONITORING_FIELD_EXAMPLES } from '../data/fieldExamples';
import {
  MONITORING_INDICATORS,
  MONITORING_SCALE,
  MonitoringEvaluation,
} from '../types/mitraKita';
import {
  computeMonitoringResult,
  formatDateID,
  getStatusTextClass,
  getTodayISO,
} from '../utils/formatters';

export const MonitoringPage: React.FC = () => {
  const {
    dataset,
    session,
    role,
    isAdmin,
    isPengawas,
    addEvaluation,
    updateEvaluation,
    deleteEvaluation,
    addSupervisorNote,
    deleteSupervisorNote,
  } = useMitraKita();

  const [activeTab, setActiveTab] = useState<'riwayat' | 'instrumen' | 'pembinaan'>(
    'riwayat'
  );
  const [detailEvalId, setDetailEvalId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MonitoringEvaluation | null>(
    null
  );

  // New Monitoring Form State — IMPORTANT: all 10 indicators start UNANSWERED!
  const [namaSekolah, setNamaSekolah] = useState(
    dataset.schoolProfile.namaSekolah !== 'Nama Sekolah Binaan'
      ? dataset.schoolProfile.namaSekolah
      : ''
  );
  const [periode, setPeriode] = useState('Semester Ganjil 2026/2027');
  const [tanggalPenilaian, setTanggalPenilaian] = useState(getTodayISO());
  const [penilai, setPenilai] = useState(
    session?.namaPengawas ||
      dataset.schoolProfile.namaPengawas ||
      'Pengawas Sekolah'
  );
  const [programId, setProgramId] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [temuanMonitoring, setTemuanMonitoring] = useState('');
  const [kekuatan, setKekuatan] = useState('');
  const [kelemahan, setKelemahan] = useState('');
  const [rekomendasi, setRekomendasi] = useState('');
  const [rencanaTindakLanjut, setRencanaTindakLanjut] = useState('');
  const [formError, setFormError] = useState('');

  // Pengawas note inside Evaluation detail
  const [evalCoachingDraft, setEvalCoachingDraft] = useState('');

  // General Supervisor Coaching Form
  const [genNoteSchool, setGenNoteSchool] = useState(
    dataset.schoolProfile.namaSekolah !== 'Nama Sekolah Binaan'
      ? dataset.schoolProfile.namaSekolah
      : ''
  );
  const [genNoteTarget, setGenNoteTarget] = useState('');
  const [genNoteText, setGenNoteText] = useState('');
  const [genNoteRec, setGenNoteRec] = useState('');

  const liveCalc = useMemo(() => computeMonitoringResult(scores), [scores]);

  const sortedEvaluations = useMemo(
    () =>
      [...dataset.evaluations].sort((a, b) =>
        b.tanggalPenilaian.localeCompare(a.tanggalPenilaian)
      ),
    [dataset.evaluations]
  );

  const detailEval = useMemo(
    () => dataset.evaluations.find((e) => e.id === detailEvalId) ?? null,
    [dataset.evaluations, detailEvalId]
  );

  const programMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of dataset.programs) {
      map.set(p.id, `${p.kodeProgram} — ${p.namaProgram}`);
    }
    return map;
  }, [dataset.programs]);

  const resetInstrumentForm = () => {
    setScores({});
    setTemuanMonitoring('');
    setKekuatan('');
    setKelemahan('');
    setRekomendasi('');
    setRencanaTindakLanjut('');
    setFormError('');
    setTanggalPenilaian(getTodayISO());
  };

  const fillMonitoringExample = () => {
    setFormError('');
    setNamaSekolah((prev) => prev.trim() || MONITORING_FIELD_EXAMPLES.namaSekolah[0]);
    setPeriode(MONITORING_FIELD_EXAMPLES.periode[0]);
    setPenilai((prev) => prev.trim() || MONITORING_FIELD_EXAMPLES.penilai[0]);
    setTemuanMonitoring(MONITORING_FIELD_EXAMPLES.temuanMonitoring[0]);
    setKekuatan(MONITORING_FIELD_EXAMPLES.kekuatan[0]);
    setKelemahan(MONITORING_FIELD_EXAMPLES.kelemahan[0]);
    setRekomendasi(MONITORING_FIELD_EXAMPLES.rekomendasi[0]);
    setRencanaTindakLanjut(MONITORING_FIELD_EXAMPLES.rencanaTindakLanjut[0]);
  };

  const fillGeneralCoachingExample = () => {
    setGenNoteSchool((prev) => prev.trim() || MONITORING_FIELD_EXAMPLES.namaSekolah[0]);
    setGenNoteRec(MONITORING_FIELD_EXAMPLES.coachingRec[0]);
    setGenNoteText(MONITORING_FIELD_EXAMPLES.coachingNote[0]);
  };

  const handleSelectScore = (indicatorId: string, value: number) => {
    setScores((prev) => ({ ...prev, [indicatorId]: value }));
    if (formError) setFormError('');
  };

  const handleSubmitEvaluation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaSekolah.trim()) {
      setFormError('Nama sekolah wajib diisi.');
      return;
    }
    if (!periode.trim() || !penilai.trim() || !tanggalPenilaian) {
      setFormError('Periode, tanggal penilaian, dan nama penilai wajib diisi.');
      return;
    }
    if (liveCalc.answeredCount < MONITORING_INDICATORS.length) {
      setFormError(
        `Masih ada ${
          MONITORING_INDICATORS.length - liveCalc.answeredCount
        } indikator yang belum dinilai. Seluruh 10 indikator wajib diisi sesuai kondisi nyata.`
      );
      return;
    }
    if (!temuanMonitoring.trim()) {
      setFormError('Kolom Temuan Monitoring wajib diisi.');
      return;
    }

    const ok = addEvaluation({
      namaSekolah: namaSekolah.trim(),
      periode: periode.trim(),
      tanggalPenilaian,
      penilai: penilai.trim(),
      peranPenilai: role,
      programId: programId || undefined,
      scores: { ...scores },
      totalSkorPerolehan: liveCalc.totalSkorPerolehan,
      totalSkorMaksimal: liveCalc.totalSkorMaksimal,
      nilaiAkhir: liveCalc.nilaiAkhir,
      kategoriHasil: liveCalc.kategoriHasil,
      temuanMonitoring: temuanMonitoring.trim(),
      kekuatan: kekuatan.trim(),
      kelemahan: kelemahan.trim(),
      rekomendasi: rekomendasi.trim(),
      rencanaTindakLanjut: rencanaTindakLanjut.trim(),
    });

    if (ok) {
      resetInstrumentForm();
      setActiveTab('riwayat');
    }
  };

  const openEvalDetail = (ev: MonitoringEvaluation) => {
    setDetailEvalId(ev.id);
    setEvalCoachingDraft(ev.catatanPembinaanPengawas ?? '');
  };

  const handleSaveEvalCoaching = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailEval) return;
    updateEvaluation(detailEval.id, {
      catatanPembinaanPengawas: evalCoachingDraft.trim(),
    });
  };

  const handleSubmitGeneralSupervisorNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!genNoteText.trim()) return;
    const selectedProg = dataset.programs.find((p) => p.id === genNoteTarget);
    const ok = addSupervisorNote({
      namaSekolah:
        genNoteSchool.trim() || selectedProg?.namaSekolah || '',
      targetType: genNoteTarget ? 'PROGRAM' : 'SEKOLAH',
      targetId: genNoteTarget || undefined,
      tanggal: getTodayISO(),
      pengawasNama:
        session?.namaPengawas ||
        dataset.schoolProfile.namaPengawas ||
        'Pengawas Sekolah',
      catatanPembinaan: genNoteText.trim(),
      rekomendasi: genNoteRec.trim() || '-',
    });
    if (ok) {
      setGenNoteText('');
      setGenNoteRec('');
      setGenNoteTarget('');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Tabs */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs text-[#52635A] tabular-nums">
            Instrumen 10 indikator skala 1–4 · Nilai = (Skor Perolehan / 40) × 100
          </p>
          <h2 className="mt-0.5 text-xl font-bold text-[#14221B]">
            Monitoring &amp; Evaluasi Kemitraan
          </h2>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-[#E9EFEA] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('riwayat')}
            className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'riwayat'
                ? 'bg-white text-[#14532D] shadow-xs'
                : 'text-[#52635A] hover:text-[#14221B]'
            }`}
          >
            Hasil Monitoring ({dataset.evaluations.length})
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('instrumen')}
              className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'instrumen'
                  ? 'bg-white text-[#14532D] shadow-xs'
                  : 'text-[#52635A] hover:text-[#14221B]'
              }`}
            >
              Isi Instrumen Baru
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('pembinaan')}
            className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'pembinaan'
                ? 'bg-white text-[#14532D] shadow-xs'
                : 'text-[#52635A] hover:text-[#14221B]'
            }`}
          >
            Pembinaan Pengawas ({dataset.supervisorNotes.length})
          </button>
        </div>
      </div>

      {/* TAB 1: RIWAYAT HASIL MONITORING */}
      {activeTab === 'riwayat' && (
        <div className="space-y-4">
          {sortedEvaluations.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8E4] bg-white px-6 py-14 text-center">
              <ClipboardCheck className="mx-auto h-8 w-8 text-[#14532D]" />
              <p className="mt-3 text-sm font-semibold text-[#14221B]">
                Belum ada hasil monitoring &amp; evaluasi tersimpan
              </p>
              <p className="mt-1 text-xs text-[#52635A]">
                Nilai monitoring dihitung sepenuhnya dari jawaban Anda pada 10
                indikator instrumen.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('instrumen')}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F3F22]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Mulai Isi Instrumen Monitoring</span>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#EEF2EF] overflow-hidden rounded-xl border border-[#E2E8E4] bg-white">
              {sortedEvaluations.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
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
                        {ev.periode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {formatDateID(ev.tanggalPenilaian)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Penilai: {ev.penilai}</span>
                    </div>

                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="font-mono text-2xl font-bold text-[#14221B] tabular-nums">
                        {ev.nilaiAkhir}
                      </span>
                      <span className="text-xs text-[#52635A] tabular-nums">
                        ({ev.totalSkorPerolehan}/{ev.totalSkorMaksimal} skor)
                      </span>
                      <span
                        className={`text-sm ${getStatusTextClass(ev.kategoriHasil)}`}
                      >
                        {ev.kategoriHasil}
                      </span>
                    </div>

                    <p className="line-clamp-2 text-xs leading-relaxed text-[#52635A]">
                      <strong className="text-[#14221B]">Temuan:</strong>{' '}
                      {ev.temuanMonitoring}
                    </p>
                    {ev.programId && programMap.get(ev.programId) && (
                      <p className="text-xs text-[#52635A]">
                        Fokus program: {programMap.get(ev.programId)}
                      </p>
                    )}
                    {ev.catatanPembinaanPengawas && (
                      <p className="text-xs text-[#14532D]">
                        <strong>Catatan Pengawas:</strong>{' '}
                        {ev.catatanPembinaanPengawas}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEvalDetail(ev)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4DDD7] bg-white px-3.5 py-2 text-xs font-medium text-[#14221B] hover:bg-[#F6F8F7] whitespace-nowrap"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>
                        {isPengawas ? 'Periksa & Beri Catatan' : 'Lihat Detail'}
                      </span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(ev)}
                        className="rounded-lg border border-[#D4DDD7] bg-white p-2 text-[#52635A] hover:bg-red-50 hover:text-[#B91C1C]"
                        title="Hapus hasil monitoring"
                        aria-label="Hapus hasil monitoring"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FORM INSTRUMEN MONITORING BARU (10 INDIKATOR) */}
      {activeTab === 'instrumen' && isAdmin && (
        <form onSubmit={handleSubmitEvaluation} className="space-y-5">
          <FormFillExampleBar
            onFillAll={fillMonitoringExample}
            label="Isi Contoh Teks Evaluasi"
          />

          {/* Metadata */}
          <div className="rounded-xl border border-[#E2E8E4] bg-white p-5">
            <h3 className="text-base font-semibold text-[#14221B]">
              1. Identitas Penilaian Monitoring
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                  Nama Sekolah *
                </label>
                <input
                  type="text"
                  list="mitra-kita-school-list"
                  value={namaSekolah}
                  onChange={(e) => setNamaSekolah(e.target.value)}
                  placeholder="Nama sekolah yang dinilai"
                  className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
                />
                <FieldExampleHint
                  examples={MONITORING_FIELD_EXAMPLES.namaSekolah}
                  onApply={setNamaSekolah}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                  Periode Evaluasi *
                </label>
                <input
                  type="text"
                  value={periode}
                  onChange={(e) => setPeriode(e.target.value)}
                  placeholder="Semester Ganjil 2026/2027"
                  className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
                />
                <FieldExampleHint
                  examples={MONITORING_FIELD_EXAMPLES.periode}
                  onApply={setPeriode}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                  Tanggal Penilaian *
                </label>
                <input
                  type="date"
                  value={tanggalPenilaian}
                  onChange={(e) => setTanggalPenilaian(e.target.value)}
                  className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                  Nama Penilai *
                </label>
                <input
                  type="text"
                  value={penilai}
                  onChange={(e) => setPenilai(e.target.value)}
                  placeholder="Pengawas Sekolah / Tim Evaluasi"
                  className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
                />
                <FieldExampleHint
                  examples={MONITORING_FIELD_EXAMPLES.penilai}
                  onApply={setPenilai}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                  Cakupan Penilaian
                </label>
                <select
                  value={programId}
                  onChange={(e) => {
                    const selected = dataset.programs.find(
                      (p) => p.id === e.target.value
                    );
                    setProgramId(e.target.value);
                    if (selected?.namaSekolah) {
                      setNamaSekolah(selected.namaSekolah);
                    }
                  }}
                  className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
                >
                  <option value="">Seluruh Kemitraan Sekolah</option>
                  {dataset.programs.map((prg) => (
                    <option key={prg.id} value={prg.id}>
                      {prg.kodeProgram} — {prg.namaProgram}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 10 Indicators Rubric */}
          <div className="rounded-xl border border-[#E2E8E4] bg-white p-5">
            <div className="flex flex-col justify-between gap-3 border-b border-[#EEF2EF] pb-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-base font-semibold text-[#14221B]">
                  2. Instrumen 10 Indikator Monitoring
                </h3>
                <p className="mt-0.5 text-xs text-[#52635A]">
                  Pilih skor 1–4 pada setiap indikator berdasarkan bukti dan kondisi
                  aktual di sekolah.
                </p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-xs text-[#52635A] tabular-nums">
                  Terisi {liveCalc.answeredCount} / {MONITORING_INDICATORS.length}{' '}
                  indikator
                </div>
                <div className="mt-0.5 font-mono text-lg font-bold text-[#14532D] tabular-nums">
                  {liveCalc.answeredCount > 0
                    ? `Nilai: ${liveCalc.nilaiAkhir} (${liveCalc.kategoriHasil})`
                    : 'Nilai belum dihitung'}
                </div>
              </div>
            </div>

            {/* Scale Legend */}
            <div className="mt-4 grid grid-cols-1 gap-2 rounded-lg bg-[#F6F8F7] p-3 text-xs text-[#52635A] sm:grid-cols-2 lg:grid-cols-4">
              {MONITORING_SCALE.map((sc) => (
                <div key={sc.value}>
                  <strong className="font-mono text-[#14532D]">{sc.value}</strong> ={' '}
                  {sc.label}
                </div>
              ))}
            </div>

            <ol className="mt-4 divide-y divide-[#EEF2EF]">
              {MONITORING_INDICATORS.map((ind) => {
                const selectedVal = scores[ind.id];
                return (
                  <li
                    key={ind.id}
                    className="flex flex-col justify-between gap-3 py-4 lg:flex-row lg:items-center"
                  >
                    <div className="pr-2 text-sm text-[#14221B]">
                      <span className="mr-2 font-mono text-xs font-semibold text-[#14532D]">
                        {String(ind.number).padStart(2, '0')}.
                      </span>
                      <span className="font-medium">{ind.text}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 sm:w-auto sm:shrink-0">
                      {MONITORING_SCALE.map((sc) => {
                        const active = selectedVal === sc.value;
                        return (
                          <button
                            key={sc.value}
                            type="button"
                            onClick={() => handleSelectScore(ind.id, sc.value)}
                            title={sc.label}
                            className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors tabular-nums ${
                              active
                                ? 'border-[#14532D] bg-[#14532D] text-white'
                                : 'border-[#D4DDD7] bg-white text-[#334155] hover:border-[#14532D]/50 hover:bg-[#F0FDF4]'
                            }`}
                          >
                            {sc.shortLabel}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* Formula Summary Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DCE5DF] bg-[#F0FDF4] p-4 text-xs text-[#14221B] tabular-nums">
              <div>
                <span className="font-semibold text-[#14532D]">
                  Perhitungan Otomatis:
                </span>{' '}
                ({liveCalc.totalSkorPerolehan} / {liveCalc.totalSkorMaksimal}) × 100
                ={' '}
                <strong className="font-mono text-sm">
                  {liveCalc.nilaiAkhir}
                </strong>
              </div>
              <div>
                Kategori:{' '}
                <span className={getStatusTextClass(liveCalc.kategoriHasil)}>
                  {liveCalc.answeredCount === MONITORING_INDICATORS.length
                    ? liveCalc.kategoriHasil
                    : 'Lengkapi 10 indikator untuk hasil final'}
                </span>
              </div>
            </div>
          </div>

          {/* 5 Qualitative Reflection Fields */}
          <div className="rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-4">
            <h3 className="text-base font-semibold text-[#14221B]">
              3. Catatan Evaluasi &amp; Rencana Tindak Lanjut
            </h3>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                Temuan Monitoring *
              </label>
              <textarea
                rows={2}
                value={temuanMonitoring}
                onChange={(e) => setTemuanMonitoring(e.target.value)}
                placeholder="Ringkasan temuan utama dari pelaksanaan kemitraan berdasarkan bukti"
                className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
              />
              <FieldExampleHint
                examples={MONITORING_FIELD_EXAMPLES.temuanMonitoring}
                onApply={setTemuanMonitoring}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                  Kekuatan
                </label>
                <textarea
                  rows={2}
                  value={kekuatan}
                  onChange={(e) => setKekuatan(e.target.value)}
                  placeholder="Hal-hal yang sudah berjalan sangat baik dan perlu dipertahankan"
                  className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
                />
                <FieldExampleHint
                  examples={MONITORING_FIELD_EXAMPLES.kekuatan}
                  onApply={setKekuatan}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                  Kelemahan
                </label>
                <textarea
                  rows={2}
                  value={kelemahan}
                  onChange={(e) => setKelemahan(e.target.value)}
                  placeholder="Aspek kemitraan yang masih lemah atau belum optimal"
                  className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
                />
                <FieldExampleHint
                  examples={MONITORING_FIELD_EXAMPLES.kelemahan}
                  onApply={setKelemahan}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                  Rekomendasi
                </label>
                <textarea
                  rows={2}
                  value={rekomendasi}
                  onChange={(e) => setRekomendasi(e.target.value)}
                  placeholder="Saran perbaikan pelaksanaan kemitraan ke depan"
                  className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
                />
                <FieldExampleHint
                  examples={MONITORING_FIELD_EXAMPLES.rekomendasi}
                  onApply={setRekomendasi}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                  Rencana Tindak Lanjut
                </label>
                <textarea
                  rows={2}
                  value={rencanaTindakLanjut}
                  onChange={(e) => setRencanaTindakLanjut(e.target.value)}
                  placeholder="Langkah konkret, jadwal, dan penanggung jawab tindak lanjut"
                  className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
                />
                <FieldExampleHint
                  examples={MONITORING_FIELD_EXAMPLES.rencanaTindakLanjut}
                  onApply={setRencanaTindakLanjut}
                />
              </div>
            </div>

            {formError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]">
                {formError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 border-t border-[#EEF2EF] pt-4">
              <button
                type="button"
                onClick={resetInstrumentForm}
                className="rounded-lg border border-[#D4DDD7] bg-white px-4 py-2 text-sm font-medium text-[#14221B] hover:bg-[#F6F8F7]"
              >
                Reset Isian
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#14532D] px-5 py-2 text-sm font-medium text-white hover:bg-[#0F3F22]"
              >
                Simpan Hasil Monitoring
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: CATATAN PEMBINAAN & REKOMENDASI PENGAWAS */}
      {activeTab === 'pembinaan' && (
        <div className="space-y-4">
          {isPengawas && (
            <form
              onSubmit={handleSubmitGeneralSupervisorNote}
              className="rounded-xl border border-[#DCE5DF] bg-white p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4 text-[#14532D]" />
                <h3 className="text-base font-semibold text-[#14221B]">
                  Tulis Catatan Pembinaan &amp; Rekomendasi Pengawas
                </h3>
              </div>
              <FormFillExampleBar onFillAll={fillGeneralCoachingExample} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                    Nama Sekolah *
                  </label>
                  <input
                    type="text"
                    required
                    list="mitra-kita-school-list"
                    value={genNoteSchool}
                    onChange={(e) => setGenNoteSchool(e.target.value)}
                    placeholder="Nama sekolah binaan"
                    className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
                  />
                  <FieldExampleHint
                    examples={MONITORING_FIELD_EXAMPLES.namaSekolah}
                    onApply={setGenNoteSchool}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                    Objek Pembinaan
                  </label>
                  <select
                    value={genNoteTarget}
                    onChange={(e) => {
                      const selected = dataset.programs.find(
                        (p) => p.id === e.target.value
                      );
                      setGenNoteTarget(e.target.value);
                      if (selected?.namaSekolah) {
                        setGenNoteSchool(selected.namaSekolah);
                      }
                    }}
                    className="w-full rounded-lg border border-[#D4DDD7] bg-white px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
                  >
                    <option value="">Kemitraan Sekolah Secara Umum</option>
                    {dataset.programs.map((prg) => (
                      <option key={prg.id} value={prg.id}>
                        Program: {prg.kodeProgram} — {prg.namaProgram}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                    Rekomendasi Tindak Lanjut
                  </label>
                  <input
                    type="text"
                    value={genNoteRec}
                    onChange={(e) => setGenNoteRec(e.target.value)}
                    placeholder="Langkah perbaikan yang disarankan pengawas"
                    className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
                  />
                  <FieldExampleHint
                    examples={MONITORING_FIELD_EXAMPLES.coachingRec}
                    onApply={setGenNoteRec}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#14221B]">
                  Catatan Pembinaan *
                </label>
                <textarea
                  rows={3}
                  required
                  value={genNoteText}
                  onChange={(e) => setGenNoteText(e.target.value)}
                  placeholder="Tuliskan hasil pemantauan, apresiasi, atau arahan pembinaan untuk kepala sekolah..."
                  className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-sm text-[#14221B] focus:border-[#14532D] focus:outline-none"
                />
                <FieldExampleHint
                  examples={MONITORING_FIELD_EXAMPLES.coachingNote}
                  onApply={setGenNoteText}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg bg-[#14532D] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F3F22]"
                >
                  Simpan Catatan Pembinaan
                </button>
              </div>
            </form>
          )}

          <div className="overflow-hidden rounded-xl border border-[#E2E8E4] bg-white">
            {dataset.supervisorNotes.length === 0 ? (
              <div className="px-6 py-12 text-center text-xs text-[#52635A]">
                Belum ada catatan pembinaan dari Pengawas Sekolah.
                {!isPengawas &&
                  ' Beralih ke peran Pengawas pada panel kiri untuk menambahkan catatan pembinaan.'}
              </div>
            ) : (
              <ul className="divide-y divide-[#EEF2EF]">
                {dataset.supervisorNotes.map((note) => (
                  <li key={note.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#52635A]">
                          {note.namaSekolah && (
                            <>
                              <strong className="text-[#14532D]">
                                {note.namaSekolah}
                              </strong>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <strong className="text-[#14221B]">
                            {note.pengawasNama}
                          </strong>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {formatDateID(note.tanggal)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-[#14532D]">
                            {note.targetType === 'PROGRAM' && note.targetId
                              ? programMap.get(note.targetId) ?? 'Program Kemitraan'
                              : 'Pembinaan Tingkat Sekolah'}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-[#14221B]">
                          {note.catatanPembinaan}
                        </p>
                        {note.rekomendasi && note.rekomendasi !== '-' && (
                          <p className="text-xs text-[#14532D]">
                            <strong>Rekomendasi:</strong> {note.rekomendasi}
                          </p>
                        )}
                      </div>
                      {isPengawas && (
                        <button
                          type="button"
                          onClick={() => deleteSupervisorNote(note.id)}
                          className="rounded-md p-1.5 text-[#52635A] hover:bg-red-50 hover:text-[#B91C1C]"
                          title="Hapus catatan"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Detail Evaluation Modal */}
      <Modal
        open={Boolean(detailEval)}
        title={`Detail Monitoring — ${detailEval?.periode ?? ''}`}
        subtitle={
          detailEval
            ? `${detailEval.namaSekolah ? `${detailEval.namaSekolah} · ` : ''}Tanggal ${formatDateID(detailEval.tanggalPenilaian)} · Penilai: ${detailEval.penilai}`
            : undefined
        }
        maxWidthClass="max-w-3xl"
        onClose={() => setDetailEvalId(null)}
      >
        {detailEval && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-4 rounded-lg border border-[#DCE5DF] bg-[#F0FDF4] p-4">
              <div>
                <div className="text-xs text-[#52635A]">Nilai Akhir Monitoring</div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-bold text-[#14532D] tabular-nums">
                    {detailEval.nilaiAkhir}
                  </span>
                  <span className="text-xs text-[#52635A] tabular-nums">
                    ({detailEval.totalSkorPerolehan}/{detailEval.totalSkorMaksimal})
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#52635A]">Kategori Hasil</div>
                <div
                  className={`mt-1 text-base ${getStatusTextClass(
                    detailEval.kategoriHasil
                  )}`}
                >
                  {detailEval.kategoriHasil}
                </div>
              </div>
            </div>

            {/* Per-indicator breakdown */}
            <div>
              <h4 className="text-xs font-semibold text-[#14221B]">
                Rincian Skor 10 Indikator
              </h4>
              <div className="mt-2 divide-y divide-[#EEF2EF] rounded-lg border border-[#E2E8E4]">
                {MONITORING_INDICATORS.map((ind) => {
                  const scoreVal = detailEval.scores[ind.id] ?? 0;
                  const scaleLabel =
                    MONITORING_SCALE.find((s) => s.value === scoreVal)?.label ??
                    '-';
                  return (
                    <div
                      key={ind.id}
                      className="flex items-start justify-between gap-4 px-3.5 py-2.5 text-xs"
                    >
                      <span className="text-[#14221B]">
                        <span className="mr-1.5 font-mono text-[#14532D]">
                          {String(ind.number).padStart(2, '0')}.
                        </span>
                        {ind.text}
                      </span>
                      <span className="shrink-0 text-right font-mono font-semibold text-[#14532D] tabular-nums">
                        {scoreVal}/4
                        <span className="ml-1.5 hidden font-sans font-normal text-[#52635A] sm:inline">
                          ({scaleLabel})
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-3.5 border-t border-[#EEF2EF] pt-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[#52635A]">
                  Temuan Monitoring
                </dt>
                <dd className="mt-0.5 leading-relaxed text-[#14221B]">
                  {detailEval.temuanMonitoring || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">Kekuatan</dt>
                <dd className="mt-0.5 leading-relaxed text-[#14221B]">
                  {detailEval.kekuatan || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">Kelemahan</dt>
                <dd className="mt-0.5 leading-relaxed text-[#14221B]">
                  {detailEval.kelemahan || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">Rekomendasi</dt>
                <dd className="mt-0.5 leading-relaxed text-[#14221B]">
                  {detailEval.rekomendasi || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#52635A]">
                  Rencana Tindak Lanjut
                </dt>
                <dd className="mt-0.5 leading-relaxed text-[#14221B]">
                  {detailEval.rencanaTindakLanjut || '-'}
                </dd>
              </div>
            </dl>

            {/* Pengawas Coaching Feedback on Evaluation */}
            <div className="border-t border-[#EEF2EF] pt-4">
              <h4 className="text-xs font-semibold text-[#14532D]">
                Catatan Pembinaan Pengawas
              </h4>
              {isPengawas ? (
                <form onSubmit={handleSaveEvalCoaching} className="mt-2 space-y-2.5">
                  <div>
                    <textarea
                      rows={3}
                      value={evalCoachingDraft}
                      onChange={(e) => setEvalCoachingDraft(e.target.value)}
                      placeholder="Berikan catatan pembinaan dan rekomendasi langsung terhadap hasil monitoring ini..."
                      className="w-full rounded-lg border border-[#D4DDD7] px-3 py-2 text-xs text-[#14221B] focus:border-[#14532D] focus:outline-none"
                    />
                    <FieldExampleHint
                      examples={MONITORING_FIELD_EXAMPLES.coachingNote}
                      onApply={setEvalCoachingDraft}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-lg bg-[#14532D] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#0F3F22]"
                    >
                      Simpan Catatan Pengawas
                    </button>
                  </div>
                </form>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-[#14221B]">
                  {detailEval.catatanPembinaanPengawas ||
                    'Belum ada catatan pembinaan pengawas pada evaluasi ini.'}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Hasil Monitoring?"
        description={
          deleteTarget
            ? `Data monitoring periode "${deleteTarget.periode}" dengan nilai ${deleteTarget.nilaiAkhir} akan dihapus permanen.`
            : ''
        }
        confirmLabel="Ya, Hapus Data"
        onConfirm={() => {
          if (deleteTarget) deleteEvaluation(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
