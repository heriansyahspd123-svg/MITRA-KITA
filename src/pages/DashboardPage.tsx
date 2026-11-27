import React, { useMemo } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  FolderKanban,
  Handshake,
  AlertCircle,
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
  NavPageId,
  PARTNER_CATEGORIES,
  PM_LEADERSHIP_AREAS,
} from '../types/mitraKita';
import {
  formatDateID,
  getPmAreaCode,
  getStatusTextClass,
} from '../utils/formatters';

interface DashboardPageProps {
  onNavigate: (page: NavPageId) => void;
  onOpenArkasImport?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenArkasImport,
}) => {
  const { dataset, isAdmin } = useMitraKita();
  const { partners, programs, activities, evidences, evaluations, supervisorNotes } =
    dataset;

  const stats = useMemo(() => {
    const totalMitra = partners.length;
    const totalProgram = programs.length;
    const direncanakan = programs.filter((p) => p.status === 'Direncanakan').length;
    const sedangBerjalan = programs.filter(
      (p) => p.status === 'Sedang Berjalan'
    ).length;
    const selesai = programs.filter((p) => p.status === 'Selesai').length;
    const ditunda = programs.filter((p) => p.status === 'Ditunda').length;
    const dibatalkan = programs.filter((p) => p.status === 'Dibatalkan').length;
    const belumTerlaksana = direncanakan + ditunda + dibatalkan;

    const realisasiPersen =
      totalProgram > 0 ? Math.round((selesai / totalProgram) * 100) : 0;
    const aktifAtauSelesaiPersen =
      totalProgram > 0
        ? Math.round(((selesai + sedangBerjalan) / totalProgram) * 100)
        : 0;

    const kegiatanSelesai = activities.filter((a) => a.status === 'Selesai').length;
    const realisasiKegiatanPersen =
      activities.length > 0
        ? Math.round((kegiatanSelesai / activities.length) * 100)
        : 0;

    return {
      totalMitra,
      totalProgram,
      direncanakan,
      sedangBerjalan,
      selesai,
      ditunda,
      dibatalkan,
      belumTerlaksana,
      realisasiPersen,
      aktifAtauSelesaiPersen,
      kegiatanSelesai,
      realisasiKegiatanPersen,
    };
  }, [partners, programs, activities]);

  // Grafik 1: Program berdasarkan jenis mitra (real calculation via partnerIds relation)
  const programsByPartnerCategory = useMemo(() => {
    const partnerCategoryMap = new Map<string, string>();
    for (const p of partners) {
      partnerCategoryMap.set(p.id, p.kategori);
    }

    const counts = new Map<string, number>();
    for (const cat of PARTNER_CATEGORIES) {
      counts.set(cat, 0);
    }

    for (const prg of programs) {
      const seenCategories = new Set<string>();
      for (const pid of prg.partnerIds) {
        const cat = partnerCategoryMap.get(pid);
        if (cat) seenCategories.add(cat);
      }
      for (const cat of seenCategories) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([kategori, jumlah]) => ({
        kategori:
          kategori === 'Pemerintah Desa/Kelurahan'
            ? 'Pemdes/Kelurahan'
            : kategori === 'Organisasi Masyarakat'
              ? 'Ormas'
              : kategori === 'Komunitas Pendidikan'
                ? 'Komunitas Pend.'
                : kategori,
        kategoriLengkap: kategori,
        jumlah,
      }))
      .filter((item) => item.jumlah > 0);
  }, [partners, programs]);

  // Grafik 2: Kegiatan berdasarkan 4 Area Kepemimpinan PM
  const activitiesByPmArea = useMemo(() => {
    const programAreaMap = new Map<string, string>();
    for (const prg of programs) {
      programAreaMap.set(prg.id, prg.areaPm);
    }

    return PM_LEADERSHIP_AREAS.map((area) => {
      const jumlah = activities.filter(
        (act) => programAreaMap.get(act.programId) === area.label
      ).length;
      const selesai = activities.filter(
        (act) =>
          programAreaMap.get(act.programId) === area.label &&
          act.status === 'Selesai'
      ).length;
      return {
        kode: `${area.code}. ${area.label.split(' ')[0]}`,
        areaLengkap: `${area.code}. ${area.label}`,
        jumlah,
        selesai,
      };
    });
  }, [programs, activities]);

  const recentActivities = useMemo(() => {
    return [...activities]
      .sort((a, b) => b.tanggalPelaksanaan.localeCompare(a.tanggalPelaksanaan))
      .slice(0, 5);
  }, [activities]);

  // Program yang perlu ditindaklanjuti (calculated dynamically from real records)
  const followUpPrograms = useMemo(() => {
    return programs
      .map((prg) => {
        const linkedActs = activities.filter((a) => a.programId === prg.id);
        const linkedEvs = evidences.filter((e) => e.programId === prg.id);
        let alasan = '';

        if (prg.status === 'Ditunda') {
          alasan = 'Status program ditunda — perlu penjadwalan ulang pelaksanaan.';
        } else if (prg.status === 'Direncanakan' && linkedActs.length === 0) {
          alasan = 'Belum memiliki jadwal kegiatan pelaksana.';
        } else if (prg.status === 'Sedang Berjalan' && linkedEvs.length === 0) {
          alasan = 'Sedang berjalan namun belum ada bukti dokumentasi terunggah.';
        } else if (prg.status === 'Direncanakan') {
          alasan = 'Masih tahap perencanaan — siap masuk pelaksanaan.';
        }

        return { program: prg, alasan, linkedActsCount: linkedActs.length };
      })
      .filter((item) => item.alasan !== '')
      .slice(0, 5);
  }, [programs, activities, evidences]);

  const latestEvaluation = useMemo(() => {
    if (evaluations.length === 0) return null;
    return [...evaluations].sort((a, b) =>
      b.tanggalPenilaian.localeCompare(a.tanggalPenilaian)
    )[0];
  }, [evaluations]);

  const programNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of programs) map.set(p.id, p.namaProgram);
    return map;
  }, [programs]);

  const statCards = [
    {
      label: 'Total Mitra',
      value: stats.totalMitra,
      sub: `${partners.filter((p) => p.status === 'Aktif').length} mitra berstatus aktif`,
      icon: Handshake,
      target: 'mitra' as NavPageId,
    },
    {
      label: 'Total Program Kemitraan',
      value: stats.totalProgram,
      sub: `${activities.length} kegiatan tercatat`,
      icon: FolderKanban,
      target: 'program' as NavPageId,
    },
    {
      label: 'Program Direncanakan',
      value: stats.direncanakan,
      sub: 'Menunggu tahap pelaksanaan',
      icon: Clock,
      target: 'program' as NavPageId,
    },
    {
      label: 'Program Sedang Berjalan',
      value: stats.sedangBerjalan,
      sub: 'Aktif dilaksanakan saat ini',
      icon: CalendarCheck,
      target: 'program' as NavPageId,
    },
    {
      label: 'Program Selesai',
      value: stats.selesai,
      sub: `${stats.realisasiPersen}% dari total program`,
      icon: CheckCircle2,
      target: 'program' as NavPageId,
    },
    {
      label: 'Program Belum Terlaksana',
      value: stats.belumTerlaksana,
      sub: `${stats.direncanakan} direncanakan · ${stats.ditunda} ditunda · ${stats.dibatalkan} batal`,
      icon: AlertCircle,
      target: 'program' as NavPageId,
    },
  ];

  const BAR_COLORS = ['#14532D', '#166534', '#15803D', '#22C55E', '#4ADE80', '#86EFAC'];

  return (
    <div className="space-y-6">
      {/* Page Intro & Primary Action */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-[#52635A]">
            Ringkasan Kemitraan Sekolah · Tahun Ajaran{' '}
            {dataset.schoolProfile.tahunAjaran}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#14221B]">
            Ikhtisar Ekosistem Kemitraan
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && onOpenArkasImport && (
            <button
              type="button"
              onClick={onOpenArkasImport}
              className="inline-flex items-center gap-2 rounded-xl border border-[#14532D]/30 bg-[#EEF8F2] px-4 py-2.5 text-sm font-semibold text-[#14532D] hover:bg-[#E1F3E8] whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Impor ARKAS (PDF/Excel)</span>
            </button>
          )}
          {isAdmin ? (
            <button
              type="button"
              onClick={() => onNavigate('program')}
              className="rounded-xl bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0F3F22] whitespace-nowrap shrink-0"
            >
              Kelola Program Kemitraan
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('monitoring')}
              className="rounded-xl bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0F3F22] whitespace-nowrap shrink-0"
            >
              Buka Monitoring &amp; Pembinaan
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('laporan')}
            className="rounded-xl border border-[#D4E0D9] bg-white px-4 py-2.5 text-sm font-medium text-[#11221A] shadow-[0_1px_2px_rgba(16,38,26,0.03)] hover:border-[#B8CBBF] hover:bg-[#F5FAF7] whitespace-nowrap shrink-0"
          >
            Lihat Laporan
          </button>
        </div>
      </div>

      {/* 6 Required Stat Cards */}
      <section aria-label="Statistik utama kemitraan">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.label}
                type="button"
                onClick={() => onNavigate(card.target)}
                className="group flex flex-col justify-between rounded-xl border border-[#E2EAE5] bg-white p-5 text-left shadow-[0_1px_3px_rgba(16,38,26,0.04)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#14532D]/30 hover:shadow-[0_6px_18px_rgba(20,83,45,0.07)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13.5px] font-semibold text-[#4E6358]">
                    {card.label}
                  </span>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDF6F0] text-[#14532D] transition-colors group-hover:bg-[#14532D] group-hover:text-white">
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                </div>
                <div className="mt-3.5 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-3xl font-bold tracking-tight text-[#11221A] tabular-nums">
                    {card.value}
                  </span>
                  <span className="text-xs font-semibold text-[#14532D] opacity-0 transition-opacity group-hover:opacity-100">
                    Buka modul →
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#5B6F65] tabular-nums">
                  {card.sub}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Realisasi Program & Hasil Monitoring Strip */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-[#E2EAE5] bg-white p-5 shadow-[0_1px_3px_rgba(16,38,26,0.04)] sm:p-6 lg:col-span-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#11221A]">
                Persentase Realisasi Program
              </h3>
              <p className="mt-0.5 text-xs text-[#5B6F65]">
                Dihitung otomatis dari rasio program berstatus selesai terhadap
                seluruh program tersimpan.
              </p>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl font-bold text-[#14532D] tabular-nums">
                {stats.realisasiPersen}%
              </div>
              <div className="text-xs text-[#5B6F65] tabular-nums">
                {stats.selesai} dari {stats.totalProgram} program selesai
              </div>
            </div>
          </div>

          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-[#E8F0EB]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#14532D] to-[#16A34A] transition-all duration-300"
              style={{ width: `${stats.realisasiPersen}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#EDF2EF] pt-3.5 text-xs text-[#5B6F65] tabular-nums">
            <span>
              Program aktif &amp; selesai:{' '}
              <strong className="text-[#11221A]">
                {stats.aktifAtauSelesaiPersen}%
              </strong>
            </span>
            <span>
              Kegiatan terlaksana:{' '}
              <strong className="text-[#11221A]">
                {stats.kegiatanSelesai}/{activities.length} (
                {stats.realisasiKegiatanPersen}%)
              </strong>
            </span>
            <span>
              Bukti dokumentasi:{' '}
              <strong className="text-[#11221A]">
                {evidences.length} dokumen
              </strong>
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-[#E2EAE5] bg-white p-5 shadow-[0_1px_3px_rgba(16,38,26,0.04)] sm:p-6 lg:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#14221B]">
                Hasil Monitoring Terakhir
              </h3>
              <p className="mt-0.5 text-xs text-[#52635A]">
                {latestEvaluation
                  ? `${latestEvaluation.periode} · ${formatDateID(latestEvaluation.tanggalPenilaian)}`
                  : 'Belum ada penilaian monitoring tersimpan'}
              </p>
            </div>
            <ClipboardCheck className="h-5 w-5 shrink-0 text-[#14532D]" />
          </div>

          {latestEvaluation ? (
            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-[#EEF2EF] pt-4">
              <div>
                <span className="font-mono text-3xl font-bold text-[#14221B] tabular-nums">
                  {latestEvaluation.nilaiAkhir}
                </span>
                <span className="ml-1 text-sm text-[#52635A]">/ 100</span>
                <div
                  className={`mt-1 text-sm ${getStatusTextClass(
                    latestEvaluation.kategoriHasil
                  )}`}
                >
                  {latestEvaluation.kategoriHasil}
                </div>
              </div>
              <div className="text-right text-xs text-[#52635A] tabular-nums">
                <div>
                  Skor: {latestEvaluation.totalSkorPerolehan}/
                  {latestEvaluation.totalSkorMaksimal}
                </div>
                <div className="mt-1">
                  Catatan pengawas: {supervisorNotes.length}
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('monitoring')}
                  className="mt-2 inline-flex items-center gap-1 font-semibold text-[#14532D] hover:underline"
                >
                  Detail evaluasi <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between border-t border-[#EEF2EF] pt-4">
              <p className="text-xs text-[#52635A]">
                Isi instrumen 10 indikator untuk melihat capaian kemitraan.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('monitoring')}
                className="rounded-lg bg-[#14532D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0F3F22] whitespace-nowrap shrink-0"
              >
                Isi Instrumen
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Two Required Recharts Visuals */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Chart 1: Program berdasarkan Jenis Mitra */}
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-[#14221B]">
              Program Berdasarkan Jenis Mitra
            </h3>
            <p className="mt-0.5 text-xs text-[#52635A]">
              Distribusi keterlibatan kategori mitra pada program kemitraan sekolah.
            </p>
          </div>
          {programsByPartnerCategory.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-[#D4DDD7] bg-[#F9FBFA] p-6 text-center">
              <p className="text-sm font-medium text-[#14221B]">
                Belum ada relasi program dan mitra
              </p>
              <p className="mt-1 text-xs text-[#52635A]">
                Tambahkan mitra lalu hubungkan ke program kemitraan untuk melihat grafik.
              </p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={programsByPartnerCategory}
                  margin={{ top: 8, right: 12, left: -16, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7ECE9" vertical={false} />
                  <XAxis
                    dataKey="kategori"
                    tick={{ fontSize: 11, fill: '#52635A' }}
                    axisLine={{ stroke: '#D4DDD7' }}
                    tickLine={false}
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                    height={46}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#52635A' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => [`${value} program`, 'Jumlah Program']}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.kategoriLengkap ?? ''
                    }
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #DCE5DF',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="jumlah" radius={[5, 5, 0, 0]} maxBarSize={42}>
                    {programsByPartnerCategory.map((_, index) => (
                      <Cell
                        key={`cell-cat-${index}`}
                        fill={BAR_COLORS[index % BAR_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 2: Kegiatan berdasarkan 4 Area Kepemimpinan PM */}
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-[#14221B]">
              Kegiatan Berdasarkan 4 Area Kepemimpinan PM
            </h3>
            <p className="mt-0.5 text-xs text-[#52635A]">
              Pemetaan jumlah kegiatan kemitraan pada empat area Pembelajaran Mendalam.
            </p>
          </div>
          {activities.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-[#D4DDD7] bg-[#F9FBFA] p-6 text-center">
              <p className="text-sm font-medium text-[#14221B]">
                Belum ada kegiatan tercatat
              </p>
              <p className="mt-1 text-xs text-[#52635A]">
                Catat kegiatan pada modul Kegiatan untuk melihat sebaran area PM.
              </p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={activitiesByPmArea}
                  margin={{ top: 8, right: 12, left: -16, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7ECE9" vertical={false} />
                  <XAxis
                    dataKey="kode"
                    tick={{ fontSize: 11, fill: '#52635A' }}
                    axisLine={{ stroke: '#D4DDD7' }}
                    tickLine={false}
                    interval={0}
                    height={36}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#52635A' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `${value} kegiatan`,
                      name === 'jumlah' ? 'Total Kegiatan' : 'Sudah Selesai',
                    ]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.areaLengkap ?? ''
                    }
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #DCE5DF',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="jumlah"
                    name="jumlah"
                    fill="#14532D"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={36}
                  />
                  <Bar
                    dataKey="selesai"
                    name="selesai"
                    fill="#4ADE80"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Bottom Two Lists: Kegiatan Terbaru & Program Perlu Tindak Lanjut */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Daftar Kegiatan Terbaru */}
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-5">
          <div className="flex items-center justify-between gap-2 border-b border-[#EEF2EF] pb-3.5">
            <div>
              <h3 className="text-base font-semibold text-[#14221B]">
                Kegiatan Terbaru
              </h3>
              <p className="text-xs text-[#52635A]">
                Lima pelaksanaan kegiatan kemitraan terbaru
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('kegiatan')}
              className="text-xs font-semibold text-[#14532D] hover:underline whitespace-nowrap shrink-0"
            >
              Semua kegiatan
            </button>
          </div>

          {recentActivities.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-[#52635A]">Belum ada kegiatan yang dicatat.</p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onNavigate('kegiatan')}
                  className="mt-3 rounded-lg bg-[#14532D] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#0F3F22]"
                >
                  Catat Kegiatan Pertama
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-[#EEF2EF]">
              {recentActivities.map((act) => (
                <li key={act.id} className="py-3.5 first:pt-3 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#14221B]">
                        {act.namaKegiatan}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#52635A]">
                        <span>
                          {programNameMap.get(act.programId) ?? 'Program terkait'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {formatDateID(act.tanggalPelaksanaan)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {act.jumlahPeserta} peserta
                        </span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-xs ${getStatusTextClass(act.status)}`}
                    >
                      {act.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Daftar Program yang Perlu Ditindaklanjuti */}
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-5">
          <div className="flex items-center justify-between gap-2 border-b border-[#EEF2EF] pb-3.5">
            <div>
              <h3 className="text-base font-semibold text-[#14221B]">
                Program yang Perlu Ditindaklanjuti
              </h3>
              <p className="text-xs text-[#52635A]">
                Program tertunda, belum terjadwal, atau belum memiliki bukti dokumentasi
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('program')}
              className="text-xs font-semibold text-[#14532D] hover:underline whitespace-nowrap shrink-0"
            >
              Kelola program
            </button>
          </div>

          {followUpPrograms.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-[#15803D]">
                Seluruh program terpantau berjalan baik.
              </p>
              <p className="mt-1 text-xs text-[#52635A]">
                Tidak ada program tertunda atau tanpa tindak lanjut saat ini.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#EEF2EF]">
              {followUpPrograms.map(({ program, alasan }) => (
                <li key={program.id} className="py-3.5 first:pt-3 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#52635A]">
                        <span className="font-mono font-medium text-[#14532D]">
                          {program.kodeProgram}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{getPmAreaCode(program.areaPm)}</span>
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-[#14221B]">
                        {program.namaProgram}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#52635A]">
                        {alasan}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs ${getStatusTextClass(program.status)}`}
                    >
                      {program.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};
