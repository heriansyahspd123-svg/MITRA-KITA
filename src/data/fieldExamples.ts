import { ExampleOption } from '../components/FieldExampleHint';

export const SCHOOL_NAME_EXAMPLES: ReadonlyArray<string> = [
  'SD Negeri 01 Harapan Nusantara',
  'SMP Negeri 2 Cendekia',
  'SD Negeri 04 Mekar Jaya',
];

export const PARTNER_FIELD_EXAMPLES = {
  namaSekolah: SCHOOL_NAME_EXAMPLES,
  nama: [
    { label: 'Puskesmas', value: 'Puskesmas Kecamatan Cendekia' },
    { label: 'Orang Tua', value: 'Paguyuban Orang Tua Siswa Kelas VII–IX' },
    { label: 'UMKM', value: 'UMKM Batik Tulis Sekar Jaya' },
  ] as ReadonlyArray<ExampleOption>,
  penanggungJawab: [
    'dr. Ratna Dewi Lestari',
    'H. Sutrisno, S.Pd.',
    'Ibu Sri Wahyuni, S.E.',
  ],
  telepon: ['0812-3456-7890', '(021) 7482-1190', '0856-9120-4431'],
  alamat: [
    'Jl. Kesehatan No. 14, Kec. Cendekia, Kab. Nusantara',
    'Jl. Pendidikan Raya No. 7, Kec. Sukamaju',
    'Jl. Merdeka Timur No. 28, Kel. Harapan Jaya',
  ],
  jenisKontribusi: [
    'Pemeriksaan kesehatan berkala, penyuluhan gizi seimbang, serta pendampingan kader dokter kecil dan UKS.',
    'Narasumber Kelas Inspirasi profesi orang tua, modul literasi digital keluarga, serta dukungan panen karya siswa.',
    'Narasumber praktik kewirausahaan lokal, penyediaan bahan praktik membatik, dan fasilitas kunjungan belajar.',
  ],
  potensiKerjaSama: [
    'Pengembangan program Sekolah Sehat berkelanjutan dan pelatihan kader kesehatan remaja tingkat gugus.',
    'Kolaborasi literasi keluarga dan pendampingan pemanfaatan teknologi belajar yang aman di rumah.',
    'Integrasi projek kewirausahaan kearifan lokal ke dalam pameran hasil belajar akhir semester.',
  ],
  catatan: [
    'Nota kesepakatan kerja sama (MoU) berlaku 2 tahun ajaran; koordinasi jadwal setiap awal bulan melalui pembina UKS.',
    'Komunikasi rutin dilakukan melalui forum koordinasi Komite Sekolah dan wali kelas.',
    'Mitra bersedia menerima kunjungan belajar maksimal 40 siswa per sesi pada hari Selasa dan Kamis.',
  ],
} as const;

export const PROGRAM_FIELD_EXAMPLES = {
  namaSekolah: SCHOOL_NAME_EXAMPLES,
  kodeProgram: ['PRG-2026-01', 'PRG-2026-02', 'PRG-2026-03'],
  namaProgram: [
    'Program Sekolah Sehat & Kantin Gizi Seimbang',
    'Kelas Inspirasi & Literasi Digital Bersama Orang Tua',
    'Projek Kewirausahaan Kearifan Lokal Bersama UMKM',
  ],
  latarBelakang: [
    'Masih ditemukan kebiasaan jajan kurang higienis di sekitar sekolah sehingga diperlukan pembiasaan perilaku hidup bersih dan sehat (PHBS) yang terintegrasi dalam lingkungan belajar peserta didik.',
    'Peserta didik membutuhkan pengalaman belajar kontekstual mengenai beragam profesi serta pendampingan literasi digital yang aman dengan melibatkan orang tua dan komunitas pendidikan.',
    'Potensi usaha kecil dan kerajinan lokal di sekitar sekolah belum dimanfaatkan secara optimal sebagai sumber belajar nyata dalam pembelajaran projek siswa.',
  ],
  tujuan: [
    'Mewujudkan lingkungan belajar sehat melalui skrining kesehatan berkala, edukasi gizi seimbang, serta penataan kantin sekolah yang higienis bersama Puskesmas.',
    'Meningkatkan motivasi belajar, wawasan karier, dan kecakapan literasi digital peserta didik melalui kolaborasi aktif orang tua dan komunitas pendidikan.',
    'Mengembangkan kreativitas, kemandirian, dan pemahaman ekonomi kreatif peserta didik melalui pendampingan praktik langsung bersama pelaku UMKM setempat.',
  ],
  sasaran: [
    'Seluruh peserta didik kelas I–VI (240 siswa), 14 guru, dan 6 pengelola kantin sekolah',
    'Peserta didik kelas IV–VI (120 siswa) beserta orang tua/wali murid',
    'Peserta didik kelas V–VI (84 siswa) dan tim guru pengampu projek pembelajaran',
  ],
  bentukKontribusi: [
    'Tenaga medis narasumber penyuluhan gizi, peralatan skrining kesehatan dasar, dan media edukasi PHBS',
    'Narasumber praktisi profesi orang tua, modul literasi digital keluarga, dan pendampingan proyek kelas',
    'Pelatih keterampilan produksi lokal, bahan praktik dasar, dan tempat kunjungan belajar lapangan',
  ],
  strategiPelaksanaan: [
    'Koordinasi penyusunan jadwal bersama Puskesmas dan Komite Sekolah, penandatanganan kesepakatan kerja sama, integrasi materi PHBS pada pembelajaran IPAS/PJOK, serta monitoring bulanan oleh tim UKS.',
    'Pemetaan keahlian orang tua, penyusunan kalender sesi tematik bulanan, pelaksanaan kelas inspirasi interaktif di kelas, serta refleksi portofolio belajar peserta didik.',
    'Observasi ke sentra UMKM, praktik pembuatan karya secara berkelompok di sekolah bersama mentor mitra, serta pameran hasil karya pada akhir semester.',
  ],
  waktuPelaksanaan: [
    'Agustus – Desember 2026 (Semester Ganjil)',
    'Januari – Mei 2027 (Semester Genap)',
    'September – November 2026 (3 Bulan)',
  ],
  penanggungJawab: [
    'Siti Aminah, S.Pd. (Koordinator UKS & Kemitraan)',
    'Budi Santoso, S.Pd. (Wakil Kepala Sekolah Bidang Kesiswaan)',
    'Dewi Kartika, S.Pd., Gr. (Koordinator Pembelajaran Mendalam)',
  ],
  sumberPembiayaan: [
    'RKAS (BOS Reguler) dan Swadaya Mitra Puskesmas',
    'Dana BOS Reguler dan Dukungan Komite Sekolah',
    'RKAS Sekolah dan Kontribusi Bahan Praktik Mitra UMKM',
  ],
  anggaranRencana: ['3500000', '2000000', '5000000'],
  indikatorKeberhasilan: [
    'Minimal 90% peserta didik mengikuti skrining kesehatan, terbentuk 20 kader dokter kecil aktif, dan 100% kantin memenuhi standar kebersihan pangan.',
    'Terlaksana minimal 4 sesi kelas inspirasi per semester dengan partisipasi siswa minimal 95% dan umpan balik positif dari orang tua.',
    'Seluruh kelompok siswa menyelesaikan produk karya lokal beserta laporan refleksi pembelajaran yang dipresentasikan pada panen karya.',
  ],
  targetHasil: [
    'Tersusun rapor kesehatan siswa semesteran, meningkatnya pembiasaan cuci tangan pakai sabun, dan terwujudnya kantin sehat sekolah.',
    'Peserta didik menghasilkan portofolio refleksi cita-cita serta terbangun budaya komunikasi aktif antara guru dan orang tua.',
    'Meningkatnya keterampilan kolaborasi, komunikasi, dan pemahaman kewirausahaan berbasis potensi daerah pada peserta didik.',
  ],
  supervisorNoteText: [
    'Perencanaan program telah selaras dengan RKT dan memanfaatkan potensi mitra lokal. Pastikan instrumen keterukuran dampak pada pembelajaran siswa disiapkan sebelum kegiatan dimulai.',
    'Pelaksanaan kemitraan berjalan baik dan melibatkan orang tua secara aktif. Perlu konsistensi pengarsipan daftar hadir dan notulen evaluasi di setiap pertemuan.',
  ],
  supervisorNoteRec: [
    'Lakukan rapat evaluasi tengah semester bersama mitra dan dokumentasikan tindak lanjut hasil refleksi dalam laporan sekolah.',
    'Integrasikan hasil karya siswa dari kegiatan kemitraan ini ke dalam portofolio asesmen Pembelajaran Mendalam.',
  ],
} as const;

export const ACTIVITY_FIELD_EXAMPLES = {
  namaSekolah: SCHOOL_NAME_EXAMPLES,
  namaKegiatan: [
    'Skrining Kesehatan Gigi, THT & Praktik Cuci Tangan Pakai Sabun',
    'Kelas Inspirasi Orang Tua: Mengenal Dunia Sains & Literasi Digital',
    'Kunjungan Belajar & Praktik Pembuatan Karya Bersama UMKM Lokal',
  ],
  lokasi: [
    'Aula Utama SD Negeri 01 Harapan Nusantara',
    'Ruang Kelas IV–VI & Lapangan Sekolah',
    'Sentra Produksi UMKM Batik Tulis Sekar Jaya',
  ],
  jumlahPeserta: ['125', '84', '210'],
  penanggungJawab: [
    'Rina Kartika, S.Pd. (Pembina UKS)',
    'Ahmad Hidayat, S.Pd. (Koordinator Kelas V)',
    'Nurul Huda, S.Pd. (Guru Pembimbing Projek)',
  ],
  deskripsiPelaksanaan: [
    'Kegiatan diawali penyuluhan pentingnya gizi seimbang dan kesehatan gigi oleh tenaga medis Puskesmas, dilanjutkan pemeriksaan kesehatan bergilir per rombel serta praktik 6 langkah cuci tangan bersama kader dokter kecil.',
    'Narasumber orang tua berbagi pengalaman kerja nyata dan praktik keamanan digital secara interaktif selama 90 menit, diikuti sesi tanya jawab dan penugasan refleksi kelompok.',
    'Peserta didik mengamati alur produksi di lokasi UMKM, mewawancarai pengrajin tentang pengelolaan bahan ramah lingkungan, lalu mempraktikkan pembuatan motif dasar secara berkelompok.',
  ],
  hasilKegiatan: [
    'Sebanyak 125 peserta didik menjalani skrining kesehatan, 18 siswa dengan indikasi karies gigi memperoleh surat rujukan tindak lanjut kepada orang tua, dan setiap kelas memiliki poster PHBS.',
    'Peserta didik menyusun 120 lembar refleksi cita-cita dan kesepakatan penggunaan gawai sehat di rumah bersama orang tua.',
    'Terkumpul 24 karya prototipe kelompok serta laporan hasil wawancara yang dipresentasikan pada forum kelas.',
  ],
  kendala: [
    'Jadwal pemeriksaan sempat bergeser 20 menit karena penyesuaian jam istirahat; teratasi dengan pengaturan antrean per kelas.',
    'Sebagian proyektor ruang kelas memerlukan adaptor tambahan; teratasi dengan memindahkan sesi ke aula sekolah.',
    'Tidak ada kendala berarti; koordinasi transportasi dan pendampingan guru berjalan tepat waktu.',
  ],
} as const;

export const EVIDENCE_FIELD_EXAMPLES = {
  namaSekolah: SCHOOL_NAME_EXAMPLES,
  namaDokumen: [
    'Nota Kesepakatan Kerja Sama (MoU) Sekolah & Puskesmas Tahun 2026',
    'Dokumentasi Foto Kegiatan Skrining Kesehatan & Praktik PHBS',
    'Daftar Hadir & Notulen Rapat Koordinasi Komite Sekolah',
  ],
  keterangan: [
    'Dokumen MoU Nomor 421.2/048/SDN01/2026 ditandatangani Kepala Sekolah dan Kepala Puskesmas Kecamatan, berlaku selama 2 tahun ajaran.',
    'Foto dokumentasi pelaksanaan penyuluhan gizi seimbang dan praktik cuci tangan siswa kelas IV–VI bersama tim tenaga kesehatan mitra.',
    'Rekap daftar hadir 32 peserta (unsur komite, orang tua, dan guru) beserta notulen kesepakatan jadwal program semester ganjil.',
  ],
} as const;

export const MONITORING_FIELD_EXAMPLES = {
  namaSekolah: SCHOOL_NAME_EXAMPLES,
  periode: [
    'Semester Ganjil 2026/2027',
    'Triwulan III Tahun 2026',
    'Semester Genap 2026/2027',
  ],
  penilai: [
    'Drs. H. Ahmad Fauzi, M.M. (Pengawas Sekolah)',
    'Dra. Hj. Nurlaila, M.Pd. (Pengawas Pembina)',
  ],
  temuanMonitoring: [
    'Program kemitraan telah tercantum dalam RKT dan didukung RKAS sesuai ketentuan. Keterlibatan orang tua, komite sekolah, dan Puskesmas berjalan aktif disertai bukti foto serta daftar hadir yang terdokumentasi.',
    'Sekolah telah membentuk penanggung jawab kemitraan dan melaksanakan 2 kegiatan bersama mitra eksternal, namun pencatatan evaluasi dampak pembelajaran perlu diperkuat.',
  ],
  kekuatan: [
    'Komitmen pimpinan sekolah dan komite sangat kuat, komunikasi dengan mitra eksternal terjadwal rapi, dan arsip bukti pelaksanaan mulai tertata secara digital.',
    'Antusiasme orang tua sebagai narasumber pembelajaran tinggi dan mendukung penguatan karakter peserta didik.',
  ],
  kelemahan: [
    'Pengukuran dampak kontribusi mitra terhadap capaian kompetensi siswa belum merata di seluruh kelas dan refleksi tindak lanjut pascakegiatan belum terdokumentasi rutin.',
    'Keragaman kategori mitra dari unsur UMKM dan perguruan tinggi masih terbatas sehingga perlu perluasan jejaring.',
  ],
  rekomendasi: [
    'Perluas kerja sama dengan UMKM/perguruan tinggi untuk mendukung projek Pembelajaran Mendalam serta jadwalkan rapat evaluasi berkala bersama mitra setiap akhir triwulan.',
    'Sediakan lembar refleksi dampak belajar siswa setelah setiap kegiatan kemitraan dan lampirkan ringkasannya dalam laporan semester.',
  ],
  rencanaTindakLanjut: [
    'Tim kemitraan sekolah menyusun instrumen umpan balik peserta didik dan melaksanakan rapat evaluasi bersama Komite Sekolah pada minggu kedua bulan depan.',
    'Kepala sekolah dan koordinator kemitraan menjadwalkan penjajakan kerja sama baru bersama pemerintah desa dan komunitas literasi setempat dalam 30 hari ke depan.',
  ],
  coachingNote: [
    'Apresiasi atas tersusunnya dokumen MoU dan arsip bukti kegiatan yang rapi. Pada siklus berikutnya, fokuskan pendampingan pada keterkaitan kontribusi mitra dengan peningkatan kualitas proses belajar di kelas.',
    'Sekolah perlu menindaklanjuti indikator evaluasi dan tindak lanjut melalui pertemuan refleksi terjadwal bersama komite dan mitra utama.',
  ],
  coachingRec: [
    'Susun jadwal evaluasi kemitraan triwulanan dan unggah notulen tindak lanjut ke modul Bukti & Dokumentasi.',
    'Libatkan perwakilan orang tua dan mitra UMKM dalam review RKT tahun ajaran berikutnya.',
  ],
} as const;

export const SETTINGS_FIELD_EXAMPLES = {
  supervisorName: ['HERIANSYAH. S.Si., S.Pd., M.Pd', 'Drs. H. Ahmad Fauzi, M.M.'],
  supervisorNip: ['197504122000031002', '197809152005012008'],
  namaSekolah: SCHOOL_NAME_EXAMPLES,
  npsn: ['20214567', '20218910'],
  kepalaSekolah: ['Hj. Kartini Rahmawati, S.Pd., M.Pd.', 'H. Bambang Prasetyo, M.Pd.'],
  nipKepalaSekolah: ['197408211998022001', '197611052002121004'],
  namaPengawas: ['HERIANSYAH. S.Si., S.Pd., M.Pd', 'Drs. H. Ahmad Fauzi, M.M.'],
  nipPengawas: ['197504122000031002', '197809152005012008'],
  tahunAjaran: ['2026/2027', '2025/2026'],
  alamatSekolah: [
    'Jl. Pendidikan No. 12, Kel. Harapan Jaya, Kec. Cendekia',
    'Jl. Ki Hajar Dewantara No. 45, Kec. Sukamaju',
  ],
} as const;
