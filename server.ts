import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const VALID_PARTNER_CATEGORIES = new Set([
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
]);

const VALID_PM_AREAS = new Set([
  'Praktik Pedagogis',
  'Lingkungan Belajar',
  'Pemanfaatan Digital',
  'Kemitraan Pembelajaran',
]);

const VALID_PROGRAM_STATUSES = new Set([
  'Direncanakan',
  'Sedang Berjalan',
  'Selesai',
  'Ditunda',
  'Dibatalkan',
]);

const VALID_ACTIVITY_STATUSES = new Set([
  'Terjadwal',
  'Sedang Berlangsung',
  'Selesai',
  'Tertunda',
]);

interface ExistingPartnerHint {
  id: string;
  nama: string;
  kategori: string;
  namaSekolah: string;
}

interface ParseArkasRequestBody {
  fileName?: string;
  mimeType?: string;
  base64Data?: string;
  existingPartners?: ExistingPartnerHint[];
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_GEMINI_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isExcelOrCsv(fileName: string, mimeType: string): boolean {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();
  return (
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.csv') ||
    lowerMime.includes('spreadsheet') ||
    lowerMime.includes('excel') ||
    lowerMime.includes('csv')
  );
}

function isPdf(fileName: string, mimeType: string): boolean {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();
  return lowerName.endsWith('.pdf') || lowerMime === 'application/pdf';
}

function extractSpreadsheetText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];
  const maxChars = 140000;
  let totalChars = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    const sheetLines: string[] = [`=== SHEET: ${sheetName} ===`];
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const cells = row.map((cell) =>
        String(cell ?? '')
          .replace(/\s+/g, ' ')
          .trim()
      );
      if (cells.every((c) => c === '')) continue;
      const line = cells.join(' | ');
      if (totalChars + line.length > maxChars) {
        sheetLines.push('... (baris lanjutan dipotong karena batas ukuran)');
        break;
      }
      sheetLines.push(line);
      totalChars += line.length + 1;
    }

    if (sheetLines.length > 1) {
      parts.push(sheetLines.join('\n'));
    }
    if (totalChars >= maxChars) break;
  }

  return parts.join('\n\n');
}

function clampString(val: unknown, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val.trim() : '';
  const result = str || fallback;
  return result.length > maxLen ? result.slice(0, maxLen) : result;
}

function normalizeIsoDate(val: unknown, fallbackYear: string): string {
  const str = typeof val === 'string' ? val.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const yearMatch = fallbackYear.match(/\d{4}/);
  const yr = yearMatch ? yearMatch[0] : String(new Date().getFullYear());
  return `${yr}-07-15`;
}

function normalizeNumber(val: unknown, maxVal: number): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.min(maxVal, Math.round(num));
}

const ARKAS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    schoolInfo: {
      type: Type.OBJECT,
      properties: {
        namaSekolah: { type: Type.STRING },
        npsn: { type: Type.STRING },
        alamatSekolah: { type: Type.STRING },
        tahunAnggaran: { type: Type.STRING },
        sumberDana: { type: Type.STRING },
        totalAnggaran: { type: Type.NUMBER },
        kepalaSekolah: { type: Type.STRING },
        bendaharaSekolah: { type: Type.STRING },
        komiteSekolah: { type: Type.STRING },
      },
      required: ['namaSekolah', 'tahunAnggaran', 'sumberDana', 'totalAnggaran'],
    },
    summary: {
      type: Type.STRING,
      description:
        'Ringkasan singkat (2-3 kalimat Bahasa Indonesia) hasil pembacaan ARKAS dan pemetaannya ke Program Kemitraan.',
    },
    suggestedPartners: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tempKey: {
            type: Type.STRING,
            description: 'Kunci unik singkat seperti P1, P2, P3',
          },
          existingPartnerId: {
            type: Type.STRING,
            description:
              'ID mitra yang sudah ada jika cocok dengan daftar existingPartners, atau string kosong jika mitra baru.',
          },
          nama: { type: Type.STRING },
          kategori: {
            type: Type.STRING,
            description:
              'Harus salah satu dari: Orang Tua, Komite Sekolah, Puskesmas, UMKM, Dunia Usaha, Pemerintah Desa/Kelurahan, Perguruan Tinggi, Komunitas Pendidikan, Organisasi Masyarakat, Lainnya',
          },
          penanggungJawab: { type: Type.STRING },
          telepon: { type: Type.STRING },
          alamat: { type: Type.STRING },
          jenisKontribusi: { type: Type.STRING },
          potensiKerjaSama: { type: Type.STRING },
          catatan: { type: Type.STRING },
        },
        required: [
          'tempKey',
          'nama',
          'kategori',
          'penanggungJawab',
          'jenisKontribusi',
          'potensiKerjaSama',
        ],
      },
    },
    programs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tempKey: {
            type: Type.STRING,
            description: 'Kunci unik singkat seperti PRG1, PRG2',
          },
          kodeProgram: {
            type: Type.STRING,
            description: 'Kode program berbasis kode ARKAS, misal RKAS-03.03',
          },
          namaProgram: { type: Type.STRING },
          latarBelakang: { type: Type.STRING },
          tujuan: { type: Type.STRING },
          areaPm: {
            type: Type.STRING,
            description:
              'Harus tepat salah satu dari: Praktik Pedagogis, Lingkungan Belajar, Pemanfaatan Digital, Kemitraan Pembelajaran',
          },
          sasaran: { type: Type.STRING },
          bentukKontribusi: { type: Type.STRING },
          strategiPelaksanaan: { type: Type.STRING },
          waktuPelaksanaan: { type: Type.STRING },
          penanggungJawab: { type: Type.STRING },
          sumberPembiayaan: { type: Type.STRING },
          anggaranRencana: { type: Type.NUMBER },
          indikatorKeberhasilan: { type: Type.STRING },
          targetHasil: { type: Type.STRING },
          status: {
            type: Type.STRING,
            description: 'Direncanakan atau Sedang Berjalan',
          },
          suggestedPartnerKeys: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'Daftar tempKey dari suggestedPartners yang relevan dengan program ini',
          },
          activities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                kodeArkas: { type: Type.STRING },
                namaKegiatan: { type: Type.STRING },
                tanggalPelaksanaan: {
                  type: Type.STRING,
                  description: 'Format YYYY-MM-DD',
                },
                lokasi: { type: Type.STRING },
                penanggungJawab: { type: Type.STRING },
                jumlahPeserta: { type: Type.NUMBER },
                deskripsiPelaksanaan: { type: Type.STRING },
                hasilKegiatan: { type: Type.STRING },
                kendala: { type: Type.STRING },
                status: {
                  type: Type.STRING,
                  description: 'Terjadwal atau Sedang Berlangsung',
                },
              },
              required: [
                'namaKegiatan',
                'tanggalPelaksanaan',
                'lokasi',
                'penanggungJawab',
                'jumlahPeserta',
                'deskripsiPelaksanaan',
                'status',
              ],
            },
          },
        },
        required: [
          'tempKey',
          'kodeProgram',
          'namaProgram',
          'latarBelakang',
          'tujuan',
          'areaPm',
          'sasaran',
          'bentukKontribusi',
          'strategiPelaksanaan',
          'waktuPelaksanaan',
          'penanggungJawab',
          'sumberPembiayaan',
          'anggaranRencana',
          'indikatorKeberhasilan',
          'targetHasil',
          'status',
          'suggestedPartnerKeys',
          'activities',
        ],
      },
    },
  },
  required: ['schoolInfo', 'summary', 'suggestedPartners', 'programs'],
};

function buildArkasPrompt(existingPartners: ExistingPartnerHint[]): string {
  const existingPartnersText =
    existingPartners.length > 0
      ? existingPartners
          .slice(0, 60)
          .map(
            (p) =>
              `- ID: ${p.id} | Nama: ${p.nama} | Kategori: ${p.kategori} | Sekolah: ${p.namaSekolah}`
          )
          .join('\n')
      : '(Belum ada data mitra tersimpan di aplikasi)';

  return `Anda adalah konsultan ahli manajemen pendidikan, Pengawas Sekolah, dan analis dokumen ARKAS/RKAS Kemendikdasmen Indonesia untuk aplikasi "MITRA KITA" (Pengelolaan Kemitraan Sekolah untuk Pembelajaran Mendalam).

TUGAS ANDA:
Baca secara menyeluruh dokumen ARKAS / Kertas Kerja RKAS sekolah yang diberikan (baik PDF maupun tabel Excel/CSV), lalu petakan seluruh program & sub-kegiatan penting di dalamnya menjadi rancangan terstruktur:
1. Identitas Sekolah (schoolInfo): ekstrak Nama Sekolah, NPSN, Alamat Lengkap (gabungkan jalan/kecamatan/kabupaten/provinsi jika tersedia), Tahun Anggaran, Sumber Dana (misal BOSP Reguler), Total Anggaran (angka rupiah penuh tanpa titik), Kepala Sekolah, Bendahara Sekolah, dan nama Komite Sekolah (jika tercantum di halaman pengesahan).
2. Usulan Mitra Kemitraan (suggestedPartners): identifikasi 4 sampai 8 mitra nyata yang relevan berdasarkan kegiatan & rincian belanja di ARKAS (contoh: Komite Sekolah dengan nama ketua komite dari dokumen bila ada, Kwarran/Pembina Pramuka & Tim Profesi Ahli, Pelatih Olahraga / Sanggar Seni Budaya Daerah, Orang Tua/Wali Murid, Komunitas Belajar/KKG/Narasumber Pelatihan STEM & RBD, Penerbit/Komunitas Literasi Perpustakaan, Penyedia Layanan TIK/Internet & Teknisi).
   - Jika ada mitra yang cocok dengan daftar Mitra Existing di bawah, isi field "existingPartnerId" dengan ID-nya. Jika tidak ada yang cocok, kosongkan "".
   - Field "kategori" WAJIB tepat salah satu dari: "Orang Tua", "Komite Sekolah", "Puskesmas", "UMKM", "Dunia Usaha", "Pemerintah Desa/Kelurahan", "Perguruan Tinggi", "Komunitas Pendidikan", "Organisasi Masyarakat", "Lainnya".
3. Program Kemitraan (programs): kelompokkan kegiatan ARKAS secara rapi dan logis menjadi 6 sampai 12 Program Kemitraan yang siap dikelola dan diedit Pengawas/Sekolah:
   - Gunakan kode ARKAS pada "kodeProgram", misalnya "RKAS-03.01", "RKAS-03.03A", "RKAS-03.03B", "RKAS-04.06", "RKAS-05.02", "RKAS-05.08", "RKAS-06.05", "RKAS-06.07", "RKAS-07.05", "RKAS-08.04".
   - Pastikan "anggaranRencana" berupa ANGKA RUPIAH AKURAT sesuai jumlah pada pos/sub-kegiatan ARKAS yang digabungkan ke program tersebut!
   - Petakan "areaPm" secara tepat ke salah satu dari 4 Area Kepemimpinan Pembelajaran Mendalam:
     * "Praktik Pedagogis" (pembelajaran aktif, English Camp, pelatihan guru/STEM/RBD, lomba OSNK/FLS3N, pengembangan perpustakaan/buku literasi, asesmen/TKA/sumatif)
     * "Lingkungan Belajar" (pemeliharaan sarana prasarana, taman, sanitasi/kebersihan, ruang belajar nyaman, perlengkapan kelas)
     * "Pemanfaatan Digital" (pengembangan website & media sosial sekolah, langganan internet/daya digital, perangkat TIK/laptop/printer, asesmen berbasis komputer)
     * "Kemitraan Pembelajaran" (ekstrakurikuler pramuka & olahraga bersama pembina/pelatih, perayaan hari besar & seni budaya bersama masyarakat/orang tua, penerimaan murid baru, sosialisasi program & pelaporan keuangan bersama komite sekolah)
   - "sumberPembiayaan" tuliskan misal "BOSP Reguler (ARKAS 2026)" sesuai dokumen.
   - "waktuPelaksanaan" tuliskan sesuai Tahap 1 (Januari – Juni) dan/atau Tahap 2 (Juli – Desember) Tahun Anggaran pada dokumen.
   - "penanggungJawab" gunakan nama Kepala Sekolah / Bendahara / Koordinator relevan dari dokumen jika ada, atau jabatan spesifik (misal "Koordinator Ekstrakurikuler & Pembina Pramuka").
   - Hubungkan setiap program ke mitra relevan melalui "suggestedPartnerKeys".
4. Kegiatan Pelaksanaan (activities) di dalam setiap Program:
   - Setiap Program WAJIB memiliki minimal 1 hingga 5 Kegiatan turunan langsung dari baris sub-kegiatan ARKAS (misal kode 03.03.06, 03.03.07, 03.03.14, 03.03.19, 03.03.21, 03.03.22, 04.06.13, 04.06.25, 05.02.03, 05.08.01, 05.08.14, 06.05.12, 07.05.03, 08.04.01, dll).
   - "tanggalPelaksanaan": format YYYY-MM-DD sesuai Tahap 1 (bulan 02–06) atau Tahap 2 (bulan 07–11) dari Tahun Anggaran ARKAS.
   - "jumlahPeserta": ekstrak estimasi jumlah peserta/orang dari uraian atau volume ARKAS (misal "32 org", "180 orang", "25 orang", atau estimasi wajar jika tidak disebut).
   - "deskripsiPelaksanaan": sebutkan rincian pos penting, volume, dan alokasi anggaran (Rp) dari ARKAS agar mudah ditinjau & diedit pengguna!
   - "status": gunakan "Terjadwal".

DAFTAR MITRA EXISTING DI APLIKASI:
${existingPartnersText}

ATURAN KETAT:
- Semua teks harus dalam Bahasa Indonesia yang rapi, formal, operasional, dan sesuai konteks sekolah di dokumen.
- Jangan mengarang angka anggaran; gunakan angka nyata dari dokumen ARKAS.
- Keluarkan HANYA JSON valid sesuai schema.`;
}

function sanitizeParseResult(
  raw: Record<string, unknown>,
  existingPartners: ExistingPartnerHint[]
) {
  const existingPartnerIdsSet = new Set(existingPartners.map((p) => p.id));
  const rawSchool =
    (raw.schoolInfo as Record<string, unknown> | undefined) ?? {};
  const tahunAnggaran = clampString(
    rawSchool.tahunAnggaran,
    40,
    String(new Date().getFullYear())
  );
  const namaSekolah = clampString(
    rawSchool.namaSekolah,
    200,
    'Sekolah (Dari ARKAS)'
  );
  const sumberDana = clampString(rawSchool.sumberDana, 120, 'BOSP Reguler');

  const schoolInfo = {
    namaSekolah,
    npsn: clampString(rawSchool.npsn, 40),
    alamatSekolah: clampString(rawSchool.alamatSekolah, 400),
    tahunAnggaran,
    sumberDana,
    totalAnggaran: normalizeNumber(rawSchool.totalAnggaran, 1000000000000),
    kepalaSekolah: clampString(rawSchool.kepalaSekolah, 150),
    bendaharaSekolah: clampString(rawSchool.bendaharaSekolah, 150),
    komiteSekolah: clampString(rawSchool.komiteSekolah, 150),
  };

  const rawPartners = Array.isArray(raw.suggestedPartners)
    ? (raw.suggestedPartners as Array<Record<string, unknown>>)
    : [];

  const validPartnerKeys = new Set<string>();
  const suggestedPartners = rawPartners.slice(0, 20).map((p, idx) => {
    const tempKey =
      clampString(p.tempKey, 20) || `P${idx + 1}`;
    validPartnerKeys.add(tempKey);
    const rawCat = clampString(p.kategori, 60, 'Lainnya');
    const kategori = VALID_PARTNER_CATEGORIES.has(rawCat) ? rawCat : 'Lainnya';
    const rawExistingId = clampString(p.existingPartnerId, 40);
    const existingPartnerId = existingPartnerIdsSet.has(rawExistingId)
      ? rawExistingId
      : '';

    return {
      tempKey,
      selected: true,
      existingPartnerId,
      nama: clampString(p.nama, 200, `Mitra ARKAS ${idx + 1}`),
      kategori,
      penanggungJawab: clampString(
        p.penanggungJawab,
        150,
        schoolInfo.kepalaSekolah || 'Koordinator Kemitraan'
      ),
      telepon: clampString(p.telepon, 40),
      alamat: clampString(p.alamat, 400, schoolInfo.alamatSekolah),
      jenisKontribusi: clampString(p.jenisKontribusi, 500),
      potensiKerjaSama: clampString(p.potensiKerjaSama, 500),
      status: 'Aktif' as const,
      catatan: clampString(
        p.catatan,
        1500,
        `Diidentifikasi otomatis dari dokumen ARKAS ${tahunAnggaran} (${namaSekolah}).`
      ),
    };
  });

  const rawPrograms = Array.isArray(raw.programs)
    ? (raw.programs as Array<Record<string, unknown>>)
    : [];

  const programs = rawPrograms.slice(0, 25).map((prg, pIdx) => {
    const rawArea = clampString(prg.areaPm, 60, 'Kemitraan Pembelajaran');
    const areaPm = VALID_PM_AREAS.has(rawArea)
      ? rawArea
      : 'Kemitraan Pembelajaran';

    const rawStatus = clampString(prg.status, 30, 'Direncanakan');
    const status =
      VALID_PROGRAM_STATUSES.has(rawStatus) && rawStatus !== 'Dibatalkan'
        ? rawStatus
        : 'Direncanakan';

    const rawKeys = Array.isArray(prg.suggestedPartnerKeys)
      ? (prg.suggestedPartnerKeys as unknown[])
          .map((k) => String(k ?? '').trim())
          .filter((k) => validPartnerKeys.has(k))
      : [];

    const rawActs = Array.isArray(prg.activities)
      ? (prg.activities as Array<Record<string, unknown>>)
      : [];

    const activities = rawActs.slice(0, 25).map((act, aIdx) => {
      const rawActStatus = clampString(act.status, 30, 'Terjadwal');
      const actStatus = VALID_ACTIVITY_STATUSES.has(rawActStatus)
        ? rawActStatus
        : 'Terjadwal';

      return {
        tempId: `act_${pIdx + 1}_${aIdx + 1}`,
        selected: true,
        kodeArkas: clampString(act.kodeArkas, 30),
        namaKegiatan: clampString(
          act.namaKegiatan,
          200,
          `Kegiatan ${aIdx + 1}`
        ),
        tanggalPelaksanaan: normalizeIsoDate(
          act.tanggalPelaksanaan,
          tahunAnggaran
        ),
        lokasi: clampString(act.lokasi, 300, namaSekolah),
        penanggungJawab: clampString(
          act.penanggungJawab,
          150,
          clampString(
            prg.penanggungJawab,
            150,
            schoolInfo.kepalaSekolah || 'Tim Pelaksana Sekolah'
          )
        ),
        jumlahPeserta: normalizeNumber(act.jumlahPeserta, 1000000),
        deskripsiPelaksanaan: clampString(act.deskripsiPelaksanaan, 2500),
        hasilKegiatan: clampString(act.hasilKegiatan, 2500),
        kendala: clampString(act.kendala, 2000),
        status: actStatus,
      };
    });

    return {
      tempKey: clampString(prg.tempKey, 20) || `PRG${pIdx + 1}`,
      selected: true,
      kodeProgram: clampString(
        prg.kodeProgram,
        40,
        `RKAS-${tahunAnggaran}-${String(pIdx + 1).padStart(2, '0')}`
      ),
      namaProgram: clampString(
        prg.namaProgram,
        200,
        `Program Kemitraan ARKAS ${pIdx + 1}`
      ),
      latarBelakang: clampString(prg.latarBelakang, 2000),
      tujuan: clampString(prg.tujuan, 2000),
      areaPm,
      sasaran: clampString(prg.sasaran, 400),
      bentukKontribusi: clampString(prg.bentukKontribusi, 1000),
      strategiPelaksanaan: clampString(prg.strategiPelaksanaan, 2000),
      waktuPelaksanaan: clampString(
        prg.waktuPelaksanaan,
        120,
        `Tahun Anggaran ${tahunAnggaran}`
      ),
      penanggungJawab: clampString(
        prg.penanggungJawab,
        150,
        schoolInfo.kepalaSekolah || 'Kepala Sekolah'
      ),
      sumberPembiayaan: clampString(
        prg.sumberPembiayaan,
        200,
        `${sumberDana} (ARKAS ${tahunAnggaran})`
      ),
      anggaranRencana: normalizeNumber(prg.anggaranRencana, 1000000000000),
      indikatorKeberhasilan: clampString(prg.indikatorKeberhasilan, 1500),
      targetHasil: clampString(prg.targetHasil, 1500),
      status,
      suggestedPartnerKeys: Array.from(new Set(rawKeys)),
      existingPartnerIds: [] as string[],
      activities,
    };
  });

  return {
    schoolInfo,
    summary: clampString(
      raw.summary,
      800,
      `Berhasil membaca dokumen ARKAS ${namaSekolah} (${tahunAnggaran}) menjadi ${programs.length} program kemitraan.`
    ),
    suggestedPartners,
    programs,
  };
}

function isTransientGeminiError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('DEADLINE_EXCEEDED') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('fetch failed')
  );
}

async function callGeminiWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientGeminiError(error) || attempt === maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw lastError;
}

function mapGeminiError(
  error: unknown,
  contextLabel = 'menganalisis file ARKAS'
): { status: number; message: string } {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg === 'MISSING_GEMINI_API_KEY') {
    return {
      status: 500,
      message:
        'Konfigurasi GEMINI_API_KEY belum tersedia di server. Periksa panel Settings > Secrets.',
    };
  }
  if (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('403')
  ) {
    return {
      status: 403,
      message:
        'Akses Gemini API ditolak atau API key tidak valid. Periksa kembali kunci API di Settings > Secrets.',
    };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return {
      status: 429,
      message:
        'Kuota pemrosesan AI sementara penuh (429). Silakan tunggu sebentar lalu coba lagi.',
    };
  }
  if (isTransientGeminiError(error)) {
    return {
      status: 503,
      message:
        'Server AI sedang mengalami lonjakan trafik sementara (503). Silakan tunggu sekitar 10–30 detik lalu coba kembali.',
    };
  }
  return {
    status: 500,
    message: `Gagal ${contextLabel}: ${msg}`,
  };
}

const PARTNERSHIP_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: {
      type: Type.STRING,
      description:
        'Ringkasan eksekutif 3-4 kalimat Bahasa Indonesia tentang kondisi ekosistem kemitraan sekolah saat ini berdasarkan data nyata.',
    },
    maturityScore: {
      type: Type.NUMBER,
      description: 'Skor kematangan ekosistem kemitraan sekolah dari 0 sampai 100.',
    },
    maturityLevel: {
      type: Type.STRING,
      description: 'Harus tepat salah satu dari: Rintisan, Berkembang, Berdaya, Unggul',
    },
    keyStrengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3 sampai 4 kekuatan utama yang teridentifikasi dari data nyata.',
    },
    priorityGaps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3 sampai 4 celah atau tantangan prioritas yang perlu segera dibenahi.',
    },
    partnershipRecommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          judul: { type: Type.STRING },
          kategoriMitra: {
            type: Type.STRING,
            description:
              'Harus tepat salah satu dari: Orang Tua, Komite Sekolah, Puskesmas, UMKM, Dunia Usaha, Pemerintah Desa/Kelurahan, Perguruan Tinggi, Komunitas Pendidikan, Organisasi Masyarakat, Lainnya',
          },
          calonMitra: { type: Type.STRING },
          areaPm: {
            type: Type.STRING,
            description:
              'Harus tepat salah satu dari: Praktik Pedagogis, Lingkungan Belajar, Pemanfaatan Digital, Kemitraan Pembelajaran',
          },
          prioritas: {
            type: Type.STRING,
            description: 'Harus tepat salah satu dari: Tinggi, Sedang, Strategis',
          },
          alasanStrategis: { type: Type.STRING },
          bentukKolaborasi: { type: Type.STRING },
          estimasiDampak: { type: Type.STRING },
        },
        required: [
          'judul',
          'kategoriMitra',
          'calonMitra',
          'areaPm',
          'prioritas',
          'alasanStrategis',
          'bentukKolaborasi',
          'estimasiDampak',
        ],
      },
    },
    impactAnalysis: {
      type: Type.OBJECT,
      properties: {
        overallImpactIndex: {
          type: Type.NUMBER,
          description: 'Indeks dampak kemitraan keseluruhan dari 0 sampai 100.',
        },
        dimensions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              dimensi: { type: Type.STRING },
              skor: { type: Type.NUMBER },
              status: {
                type: Type.STRING,
                description: 'Harus tepat salah satu dari: Tinggi, Moderat, Perlu Penguatan',
              },
              analisis: { type: Type.STRING },
              buktiPendukung: { type: Type.STRING },
              saranPeningkatan: { type: Type.STRING },
            },
            required: [
              'dimensi',
              'skor',
              'status',
              'analisis',
              'buktiPendukung',
              'saranPeningkatan',
            ],
          },
        },
        budgetEfficiencyNote: { type: Type.STRING },
        studentOutcomeNarrative: { type: Type.STRING },
      },
      required: [
        'overallImpactIndex',
        'dimensions',
        'budgetEfficiencyNote',
        'studentOutcomeNarrative',
      ],
    },
    supervisorActionPlan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          langkah: { type: Type.STRING },
          targetWaktu: { type: Type.STRING },
          pihakTerlibat: { type: Type.STRING },
          indikatorKeberhasilan: { type: Type.STRING },
        },
        required: [
          'langkah',
          'targetWaktu',
          'pihakTerlibat',
          'indikatorKeberhasilan',
        ],
      },
    },
  },
  required: [
    'executiveSummary',
    'maturityScore',
    'maturityLevel',
    'keyStrengths',
    'priorityGaps',
    'partnershipRecommendations',
    'impactAnalysis',
    'supervisorActionPlan',
  ],
};

function sanitizePartnershipAnalysis(
  raw: Record<string, unknown>,
  schoolScope: string
) {
  const validMaturity = new Set(['Rintisan', 'Berkembang', 'Berdaya', 'Unggul']);
  const validPriority = new Set(['Tinggi', 'Sedang', 'Strategis']);
  const validImpactStatus = new Set(['Tinggi', 'Moderat', 'Perlu Penguatan']);

  const maturityScore = normalizeNumber(raw.maturityScore, 100);
  const rawLevel = clampString(raw.maturityLevel, 30, 'Berkembang');
  const maturityLevel = validMaturity.has(rawLevel)
    ? rawLevel
    : maturityScore >= 85
      ? 'Unggul'
      : maturityScore >= 70
        ? 'Berdaya'
        : maturityScore >= 45
          ? 'Berkembang'
          : 'Rintisan';

  const toStringList = (val: unknown, maxItems: number): string[] =>
    Array.isArray(val)
      ? val
          .slice(0, maxItems)
          .map((item) => clampString(item, 400))
          .filter(Boolean)
      : [];

  const rawRecs = Array.isArray(raw.partnershipRecommendations)
    ? (raw.partnershipRecommendations as Array<Record<string, unknown>>)
    : [];

  const partnershipRecommendations = rawRecs.slice(0, 8).map((rec, idx) => {
    const rawCat = clampString(rec.kategoriMitra, 60, 'Komunitas Pendidikan');
    const rawArea = clampString(rec.areaPm, 60, 'Kemitraan Pembelajaran');
    const rawPrio = clampString(rec.prioritas, 20, 'Tinggi');
    return {
      judul: clampString(rec.judul, 180, `Rekomendasi Kemitraan ${idx + 1}`),
      kategoriMitra: VALID_PARTNER_CATEGORIES.has(rawCat) ? rawCat : 'Lainnya',
      calonMitra: clampString(rec.calonMitra, 180, 'Mitra Eksternal Potensial'),
      areaPm: VALID_PM_AREAS.has(rawArea) ? rawArea : 'Kemitraan Pembelajaran',
      prioritas: validPriority.has(rawPrio) ? rawPrio : 'Strategis',
      alasanStrategis: clampString(rec.alasanStrategis, 600),
      bentukKolaborasi: clampString(rec.bentukKolaborasi, 600),
      estimasiDampak: clampString(rec.estimasiDampak, 500),
    };
  });

  const rawImpact =
    (raw.impactAnalysis as Record<string, unknown> | undefined) ?? {};
  const rawDims = Array.isArray(rawImpact.dimensions)
    ? (rawImpact.dimensions as Array<Record<string, unknown>>)
    : [];

  const dimensions = rawDims.slice(0, 6).map((dim, idx) => {
    const skor = normalizeNumber(dim.skor, 100);
    const rawStatus = clampString(dim.status, 30);
    const status = validImpactStatus.has(rawStatus)
      ? rawStatus
      : skor >= 75
        ? 'Tinggi'
        : skor >= 50
          ? 'Moderat'
          : 'Perlu Penguatan';
    return {
      dimensi: clampString(dim.dimensi, 120, `Dimensi Dampak ${idx + 1}`),
      skor,
      status,
      analisis: clampString(dim.analisis, 700),
      buktiPendukung: clampString(dim.buktiPendukung, 500),
      saranPeningkatan: clampString(dim.saranPeningkatan, 500),
    };
  });

  const rawPlan = Array.isArray(raw.supervisorActionPlan)
    ? (raw.supervisorActionPlan as Array<Record<string, unknown>>)
    : [];

  const supervisorActionPlan = rawPlan.slice(0, 6).map((item, idx) => ({
    langkah: clampString(item.langkah, 400, `Langkah Pembinaan ${idx + 1}`),
    targetWaktu: clampString(item.targetWaktu, 80, 'Triwulan Berjalan'),
    pihakTerlibat: clampString(item.pihakTerlibat, 200, 'Kepala Sekolah & Koordinator'),
    indikatorKeberhasilan: clampString(item.indikatorKeberhasilan, 350),
  }));

  return {
    generatedAt: new Date().toISOString(),
    schoolScope,
    executiveSummary: clampString(raw.executiveSummary, 1500),
    maturityScore,
    maturityLevel,
    keyStrengths: toStringList(raw.keyStrengths, 5),
    priorityGaps: toStringList(raw.priorityGaps, 5),
    partnershipRecommendations,
    impactAnalysis: {
      overallImpactIndex: normalizeNumber(rawImpact.overallImpactIndex, 100),
      dimensions,
      budgetEfficiencyNote: clampString(rawImpact.budgetEfficiencyNote, 900),
      studentOutcomeNarrative: clampString(rawImpact.studentOutcomeNarrative, 900),
    },
    supervisorActionPlan,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/arkas/parse', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as ParseArkasRequestBody;
      const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : '';
      const base64Data =
        typeof body.base64Data === 'string' ? body.base64Data.trim() : '';
      const existingPartners = Array.isArray(body.existingPartners)
        ? body.existingPartners.slice(0, 100)
        : [];

      if (!fileName || !base64Data) {
        res.status(400).json({
          error: 'File ARKAS tidak ditemukan. Unggah file PDF atau Excel (.xlsx/.xls/.csv).',
        });
        return;
      }

      const estimatedBytes = Math.ceil((base64Data.length * 3) / 4);
      if (estimatedBytes > 20 * 1024 * 1024) {
        res.status(413).json({
          error: 'Ukuran file terlalu besar (maksimal 20 MB).',
        });
        return;
      }

      const pdfFile = isPdf(fileName, mimeType);
      const excelFile = isExcelOrCsv(fileName, mimeType);

      if (!pdfFile && !excelFile) {
        res.status(400).json({
          error:
            'Format file belum didukung. Gunakan file ARKAS berformat PDF (.pdf) atau Excel (.xlsx, .xls, .csv).',
        });
        return;
      }

      const ai = getAiClient();
      const basePrompt = buildArkasPrompt(existingPartners);

      let parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;

      if (pdfFile) {
        parts = [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data,
            },
          },
          {
            text: `${basePrompt}\n\nNama file yang diunggah: ${fileName}`,
          },
        ];
      } else {
        const buffer = Buffer.from(base64Data, 'base64');
        const spreadsheetText = extractSpreadsheetText(buffer);
        if (!spreadsheetText.trim()) {
          res.status(400).json({
            error:
              'File Excel/CSV tampak kosong atau tidak memiliki baris data yang dapat dibaca.',
          });
          return;
        }
        parts = [
          {
            text: `${basePrompt}\n\nNama file yang diunggah: ${fileName}\n\nISI TABEL ARKAS (EKSPOR EXCEL/CSV):\n${spreadsheetText}`,
          },
        ];
      }

      let response;
      try {
        response = await callGeminiWithRetry(
          () =>
            ai.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: { parts },
              config: {
                responseMimeType: 'application/json',
                responseSchema: ARKAS_RESPONSE_SCHEMA,
                thinkingConfig: {
                  thinkingLevel: ThinkingLevel.LOW,
                },
              },
            }),
          2
        );
      } catch (primaryError) {
        if (!isTransientGeminiError(primaryError)) {
          throw primaryError;
        }
        // Fallback to active free-tier lite model during temporary 503 spikes
        response = await callGeminiWithRetry(
          () =>
            ai.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents: { parts },
              config: {
                responseMimeType: 'application/json',
                responseSchema: ARKAS_RESPONSE_SCHEMA,
              },
            }),
          1
        );
      }

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({
          error:
            'AI tidak mengembalikan hasil pembacaan. Pastikan file ARKAS jelas dan tidak terproteksi kata sandi.',
        });
        return;
      }

      let parsedJson: Record<string, unknown>;
      try {
        parsedJson = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        res.status(502).json({
          error:
            'Format keluaran analisis tidak dapat diproses. Silakan coba unggah ulang file ARKAS Anda.',
        });
        return;
      }

      const result = sanitizeParseResult(parsedJson, existingPartners);
      res.json(result);
    } catch (error) {
      const mapped = mapGeminiError(error, 'menganalisis file ARKAS');
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  app.post(
    '/api/ai/partnership-analysis',
    async (req: Request, res: Response) => {
      try {
        const body = (req.body ?? {}) as {
          schoolScope?: string;
          tahunAjaran?: string;
          focusPrompt?: string;
          snapshot?: Record<string, unknown>;
        };

        const schoolScope = clampString(
          body.schoolScope,
          200,
          'Semua Sekolah Binaan'
        );
        const tahunAjaran = clampString(body.tahunAjaran, 40, '2026/2027');
        const focusPrompt = clampString(body.focusPrompt, 400);
        const snapshot = body.snapshot ?? {};

        const serializedSnapshot = JSON.stringify(snapshot).slice(0, 65000);
        const prompt = `Anda adalah Konsultan Ahli Kepemimpinan Pembelajaran Mendalam dan Pengawas Sekolah Senior Indonesia pada sistem "MITRA KITA".

TUGAS ANDA:
Lakukan Analisis AI komprehensif atas data kemitraan sekolah berikut ini, lalu susun:
1. Ringkasan Eksekutif (executiveSummary) & Skor Kematangan Ekosistem Kemitraan (maturityScore 0-100, maturityLevel: Rintisan / Berkembang / Berdaya / Unggul) beserta 3-4 kekuatan utama (keyStrengths) dan 3-4 celah prioritas (priorityGaps).
2. Rekomendasi Kemitraan Strategis (partnershipRecommendations, 4-5 rekomendasi):
   - Prioritaskan kategori mitra yang BELUM banyak dimanfaatkan di data sekolah (misal Puskesmas, UMKM, Perguruan Tinggi, Dunia Usaha, Pemerintah Desa/Kelurahan, Komunitas Pendidikan) serta Area PM yang porsinya masih lemah.
   - Setiap rekomendasi harus operasional, realistis untuk satuan pendidikan di Indonesia, menyebutkan calon mitra konkret, bentuk kolaborasi, dan estimasi dampak belajar.
3. Analisis Dampak (impactAnalysis):
   - Berikan overallImpactIndex (0-100) yang objektif berdasarkan realisasi kegiatan, jumlah peserta, ketersediaan bukti dokumentasi, skor monitoring, dan keterlibatan mitra.
   - Evaluasi tepat 4 dimensi dampak berikut di field "dimensions":
     a) "Kualitas Pembelajaran & Praktik Pedagogis"
     b) "Lingkungan Belajar & Penguatan Karakter"
     c) "Transformasi & Pemanfaatan Digital"
     d) "Tata Kelola, Partisipasi & Efektivitas Anggaran"
   - Jelaskan budgetEfficiencyNote (analisis efektivitas anggaran rencana terhadap sasaran/kegiatan) dan studentOutcomeNarrative (dampak langsung ke peserta didik dalam kerangka Pembelajaran Mendalam).
4. Rencana Tindak Lanjut Pembinaan Pengawas Sekolah (supervisorActionPlan, 4 langkah operasional dengan target waktu, pihak terlibat, dan indikator keberhasilan).

KONTEKS ANALISIS:
- Cakupan Sekolah: ${schoolScope}
- Tahun Ajaran: ${tahunAjaran}
- Fokus Khusus Pengawas: ${focusPrompt || 'Analisis menyeluruh ekosistem kemitraan, peluang mitra baru, dan dampak terhadap Pembelajaran Mendalam.'}

DATA AKTUAL SEKOLAH (JSON):
${serializedSnapshot}

ATURAN KETAT:
- Gunakan Bahasa Indonesia formal, tajam, lugas, dan berbasis fakta dari data JSON di atas (sebutkan nama mitra/program/angka nyata yang ada di data, jangan mengarang data yang tidak ada).
- Jika sebagian data (seperti kegiatan selesai, bukti dokumentasi, atau hasil monitoring) masih sedikit atau 0, jadikan itu temuan objektif pada skor dampak & celah prioritas.
- Keluarkan HANYA JSON valid sesuai schema.`;

        const ai = getAiClient();
        let response;
        try {
          response = await callGeminiWithRetry(
            () =>
              ai.models.generateContent({
                model: 'gemini-4-hydrogen',
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: PARTNERSHIP_ANALYSIS_SCHEMA,
                  thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW,
                  },
                },
              }),
            2
          );
        } catch (primaryError) {
          if (!isTransientGeminiError(primaryError)) {
            throw primaryError;
          }
          response = await callGeminiWithRetry(
            () =>
              ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: PARTNERSHIP_ANALYSIS_SCHEMA,
                },
              }),
            1
          );
        }

        const rawText = (response.text ?? '').trim();
        if (!rawText) {
          res.status(502).json({
            error:
              'AI tidak mengembalikan hasil analisis. Silakan coba jalankan ulang analisis.',
          });
          return;
        }

        let parsedJson: Record<string, unknown>;
        try {
          parsedJson = JSON.parse(rawText) as Record<string, unknown>;
        } catch {
          res.status(502).json({
            error:
              'Format keluaran analisis AI tidak valid. Silakan jalankan ulang analisis.',
          });
          return;
        }

        res.json(sanitizePartnershipAnalysis(parsedJson, schoolScope));
      } catch (error) {
        const mapped = mapGeminiError(error, 'menjalankan analisis AI kemitraan');
        res.status(mapped.status).json({ error: mapped.message });
      }
    }
  );

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MITRA KITA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
