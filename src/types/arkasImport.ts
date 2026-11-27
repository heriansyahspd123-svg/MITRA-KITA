import {
  ActivityStatus,
  PartnerCategory,
  PartnerStatus,
  PmLeadershipArea,
  ProgramStatus,
} from './mitraKita';

export interface ArkasSchoolInfo {
  namaSekolah: string;
  npsn: string;
  alamatSekolah: string;
  tahunAnggaran: string;
  sumberDana: string;
  totalAnggaran: number;
  kepalaSekolah: string;
  bendaharaSekolah: string;
  komiteSekolah: string;
}

export interface ArkasSuggestedPartner {
  tempKey: string;
  selected: boolean;
  existingPartnerId: string; // Empty means create new partner
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

export interface ArkasDraftActivity {
  tempId: string;
  selected: boolean;
  kodeArkas?: string;
  namaKegiatan: string;
  tanggalPelaksanaan: string; // YYYY-MM-DD
  lokasi: string;
  penanggungJawab: string;
  jumlahPeserta: number;
  deskripsiPelaksanaan: string;
  hasilKegiatan: string;
  kendala: string;
  status: ActivityStatus;
}

export interface ArkasDraftProgram {
  tempKey: string;
  selected: boolean;
  kodeProgram: string;
  namaProgram: string;
  latarBelakang: string;
  tujuan: string;
  areaPm: PmLeadershipArea;
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
  suggestedPartnerKeys: string[];
  existingPartnerIds: string[];
  activities: ArkasDraftActivity[];
}

export interface ArkasParseResult {
  schoolInfo: ArkasSchoolInfo;
  summary: string;
  suggestedPartners: ArkasSuggestedPartner[];
  programs: ArkasDraftProgram[];
}

export interface ArkasImportBundleInput {
  schoolInfo: ArkasSchoolInfo;
  updateSchoolProfile: boolean;
  partners: ArkasSuggestedPartner[];
  programs: ArkasDraftProgram[];
}
