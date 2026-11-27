import { SavedAiAnalysis } from './aiAnalysis';

export type UserRole = 'PENGAWAS';

export interface SupervisorSession {
  uid: string;
  namaPengawas: string;
  nip: string;
  email: string;
  photoURL?: string;
  loggedInAt: string;
}

export type NavPageId =
  | 'dashboard'
  | 'mitra'
  | 'program'
  | 'kegiatan'
  | 'dokumentasi'
  | 'monitoring'
  | 'analisis-ai'
  | 'laporan'
  | 'pengaturan';

export const PARTNER_CATEGORIES = [
  'Orang Tua',
  'Komite Sekolah',
  'Puskesmas',
  'UMKM',
  'Dunia Usaha',
  'Pemerintah Desa/Kelurahan',
  'Perguruan Tinggi',
  'Komunitas Pendidikan',
  'Organisasi Masyarakat',
  'Lainnya',
] as const;

export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number];

export const PARTNER_STATUSES = [
  'Aktif',
  'Dalam Penjajakan',
  'Tidak Aktif',
] as const;

export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export interface Partner {
  id: string; // e.g., MTR-001
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
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const PM_LEADERSHIP_AREAS = [
  { code: 'A', label: 'Praktik Pedagogis' },
  { code: 'B', label: 'Lingkungan Belajar' },
  { code: 'C', label: 'Pemanfaatan Digital' },
  { code: 'D', label: 'Kemitraan Pembelajaran' },
] as const;

export type PmLeadershipArea = (typeof PM_LEADERSHIP_AREAS)[number]['label'];

export const PROGRAM_STATUSES = [
  'Direncanakan',
  'Sedang Berjalan',
  'Selesai',
  'Ditunda',
  'Dibatalkan',
] as const;

export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export interface PartnershipProgram {
  id: string;
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
  anggaranRencana: number;
  indikatorKeberhasilan: string;
  targetHasil: string;
  status: ProgramStatus;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const ACTIVITY_STATUSES = [
  'Terjadwal',
  'Sedang Berlangsung',
  'Selesai',
  'Tertunda',
] as const;

export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export interface PartnershipActivity {
  id: string;
  namaSekolah: string;
  namaKegiatan: string;
  programId: string;
  tanggalPelaksanaan: string; // YYYY-MM-DD
  lokasi: string;
  partnerIds: string[];
  penanggungJawab: string;
  jumlahPeserta: number;
  deskripsiPelaksanaan: string;
  hasilKegiatan: string;
  kendala: string;
  status: ActivityStatus;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const EVIDENCE_TYPES = [
  'Foto Kegiatan',
  'Dokumen Kerja Sama',
  'Daftar Hadir',
  'Notulen',
  'Laporan Kegiatan',
  'Dokumen Pendukung Lainnya',
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export interface EvidenceItem {
  id: string;
  namaSekolah: string;
  namaDokumen: string;
  jenis: EvidenceType;
  programId: string;
  activityId?: string;
  tanggalUnggah: string; // YYYY-MM-DD
  keterangan: string;
  fileUrl?: string;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  isDemo?: boolean;
  createdAt: string;
}

export const MONITORING_SCALE = [
  { value: 1, shortLabel: '1', label: 'Belum Dilaksanakan' },
  { value: 2, shortLabel: '2', label: 'Mulai Dilaksanakan' },
  { value: 3, shortLabel: '3', label: 'Dilaksanakan tetapi Belum Optimal' },
  { value: 4, shortLabel: '4', label: 'Dilaksanakan secara Terstruktur dan Berdampak' },
] as const;

export const MONITORING_INDICATORS = [
  { id: 'ind_1', number: 1, text: 'Program kemitraan tercantum dalam RKT.' },
  { id: 'ind_2', number: 2, text: 'Program didukung RKAS sesuai ketentuan.' },
  { id: 'ind_3', number: 3, text: 'Terdapat penanggung jawab kemitraan.' },
  { id: 'ind_4', number: 4, text: 'Terdapat keterlibatan orang tua.' },
  { id: 'ind_5', number: 5, text: 'Komite sekolah berperan aktif.' },
  { id: 'ind_6', number: 6, text: 'Terdapat kerja sama dengan mitra eksternal.' },
  { id: 'ind_7', number: 7, text: 'Mitra terlibat dalam kegiatan pembelajaran.' },
  { id: 'ind_8', number: 8, text: 'Terdapat bukti pelaksanaan kegiatan.' },
  { id: 'ind_9', number: 9, text: 'Terdapat evaluasi program.' },
  { id: 'ind_10', number: 10, text: 'Terdapat tindak lanjut hasil evaluasi.' },
] as const;

export type MonitoringCategory =
  | 'Sangat Baik'
  | 'Baik'
  | 'Cukup'
  | 'Perlu Pembinaan Intensif';

export interface MonitoringEvaluation {
  id: string;
  namaSekolah: string;
  periode: string;
  tanggalPenilaian: string; // YYYY-MM-DD
  penilai: string;
  peranPenilai: UserRole;
  programId?: string; // Empty means Evaluasi Kemitraan Tingkat Sekolah
  scores: Record<string, number>;
  totalSkorPerolehan: number;
  totalSkorMaksimal: number;
  nilaiAkhir: number;
  kategoriHasil: MonitoringCategory;
  temuanMonitoring: string;
  kekuatan: string;
  kelemahan: string;
  rekomendasi: string;
  rencanaTindakLanjut: string;
  catatanPembinaanPengawas?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupervisorNote {
  id: string;
  namaSekolah: string;
  targetType: 'SEKOLAH' | 'PROGRAM' | 'EVALUASI';
  targetId?: string;
  tanggal: string; // YYYY-MM-DD
  pengawasNama: string;
  catatanPembinaan: string;
  rekomendasi: string;
  isDemo?: boolean;
  createdAt: string;
}

export interface SchoolProfile {
  namaSekolah: string;
  npsn: string;
  kepalaSekolah: string;
  nipKepalaSekolah: string;
  namaPengawas: string;
  nipPengawas: string;
  alamatSekolah: string;
  tahunAjaran: string;
}

export interface MitraKitaDataset {
  partners: Partner[];
  programs: PartnershipProgram[];
  activities: PartnershipActivity[];
  evidences: EvidenceItem[];
  evaluations: MonitoringEvaluation[];
  supervisorNotes: SupervisorNote[];
  aiAnalyses: SavedAiAnalysis[];
  schoolProfile: SchoolProfile;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}
