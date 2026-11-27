import { MitraKitaDataset, SupervisorSession } from '../types/mitraKita';

/**
 * Storage Repository Abstraction (MVP: Browser LocalStorage)
 *
 * Designed with clean collection boundaries so future migration to
 * Firebase Authentication, Firestore collections, and Firebase Storage
 * requires replacing only this repository adapter.
 */

const STORAGE_KEYS = {
  dataset: 'mitra_kita_v1_dataset',
  session: 'mitra_kita_v1_supervisor_session',
} as const;

export function createEmptyDataset(): MitraKitaDataset {
  return {
    schoolProfile: {
      namaSekolah: 'Nama Sekolah Binaan',
      npsn: '',
      kepalaSekolah: '',
      nipKepalaSekolah: '',
      namaPengawas: '',
      nipPengawas: '',
      alamatSekolah: '',
      tahunAjaran: '2026/2027',
    },
    partners: [],
    programs: [],
    activities: [],
    evidences: [],
    evaluations: [],
    supervisorNotes: [],
    aiAnalyses: [],
  };
}

export interface StorageRepository {
  loadDataset(): MitraKitaDataset;
  saveDataset(dataset: MitraKitaDataset): { ok: boolean; error?: string };
  loadSession(): SupervisorSession | null;
  saveSession(session: SupervisorSession | null): void;
}

export const localStorageRepository: StorageRepository = {
  loadDataset(): MitraKitaDataset {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.dataset);
      if (!raw) {
        const empty = createEmptyDataset();
        window.localStorage.setItem(STORAGE_KEYS.dataset, JSON.stringify(empty));
        return empty;
      }
      const parsed = JSON.parse(raw) as Partial<MitraKitaDataset>;
      const fallback = createEmptyDataset();

      // Strip any legacy demo records automatically
      const rawProfile = parsed.schoolProfile ?? fallback.schoolProfile;
      const isDemoSchool =
        /DATA DEMO/i.test(rawProfile.namaSekolah) ||
        rawProfile.namaSekolah === 'SD Negeri 01 Harapan Nusantara (DATA DEMO)';

      const cleaned: MitraKitaDataset = {
        schoolProfile: isDemoSchool
          ? fallback.schoolProfile
          : {
              ...fallback.schoolProfile,
              ...rawProfile,
            },
        partners: Array.isArray(parsed.partners)
          ? parsed.partners
              .filter((x) => !x.isDemo)
              .map((x) => ({ ...x, namaSekolah: x.namaSekolah ?? '' }))
          : [],
        programs: Array.isArray(parsed.programs)
          ? parsed.programs
              .filter((x) => !x.isDemo)
              .map((x) => ({ ...x, namaSekolah: x.namaSekolah ?? '' }))
          : [],
        activities: Array.isArray(parsed.activities)
          ? parsed.activities
              .filter((x) => !x.isDemo)
              .map((x) => ({ ...x, namaSekolah: x.namaSekolah ?? '' }))
          : [],
        evidences: Array.isArray(parsed.evidences)
          ? parsed.evidences
              .filter((x) => !x.isDemo)
              .map((x) => ({ ...x, namaSekolah: x.namaSekolah ?? '' }))
          : [],
        evaluations: Array.isArray(parsed.evaluations)
          ? parsed.evaluations
              .filter((x) => !x.isDemo)
              .map((x) => ({ ...x, namaSekolah: x.namaSekolah ?? '' }))
          : [],
        supervisorNotes: Array.isArray(parsed.supervisorNotes)
          ? parsed.supervisorNotes
              .filter((x) => !x.isDemo)
              .map((x) => ({ ...x, namaSekolah: x.namaSekolah ?? '' }))
          : [],
        aiAnalyses: Array.isArray(parsed.aiAnalyses) ? parsed.aiAnalyses : [],
      };

      window.localStorage.setItem(STORAGE_KEYS.dataset, JSON.stringify(cleaned));
      return cleaned;
    } catch {
      return createEmptyDataset();
    }
  },

  saveDataset(dataset: MitraKitaDataset): { ok: boolean; error?: string } {
    try {
      window.localStorage.setItem(STORAGE_KEYS.dataset, JSON.stringify(dataset));
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'QuotaExceededError'
          ? 'Kapasitas penyimpanan browser penuh. Gunakan berkas gambar berukuran lebih kecil atau hapus lampiran lama.'
          : 'Gagal menyimpan data ke penyimpanan lokal browser.';
      return { ok: false, error: message };
    }
  },

  loadSession(): SupervisorSession | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.session);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<SupervisorSession>;
      if (parsed && typeof parsed.namaPengawas === 'string' && parsed.namaPengawas.trim()) {
        return {
          uid: typeof parsed.uid === 'string' ? parsed.uid : '',
          namaPengawas: parsed.namaPengawas,
          nip: typeof parsed.nip === 'string' ? parsed.nip : '',
          email: typeof parsed.email === 'string' ? parsed.email : '',
          photoURL: typeof parsed.photoURL === 'string' ? parsed.photoURL : undefined,
          loggedInAt:
            typeof parsed.loggedInAt === 'string'
              ? parsed.loggedInAt
              : new Date().toISOString(),
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  saveSession(session: SupervisorSession | null): void {
    try {
      if (!session) {
        window.localStorage.removeItem(STORAGE_KEYS.session);
      } else {
        window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
      }
    } catch {
      // Ignore storage write errors on session
    }
  },
};
