import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { createEmptyDataset } from '../services/storageRepository';
import {
  ActivityStatus,
  EvidenceItem,
  EvidenceType,
  MitraKitaDataset,
  MonitoringCategory,
  MonitoringEvaluation,
  Partner,
  PartnerCategory,
  PartnerStatus,
  PartnershipActivity,
  PartnershipProgram,
  PmLeadershipArea,
  ProgramStatus,
  SchoolProfile,
  SupervisorNote,
  SupervisorSession,
  ToastMessage,
  UserRole,
} from '../types/mitraKita';
import {
  buildFirestoreErrorInfo,
  handleFirestoreError,
  OperationType,
} from '../utils/firestoreError';
import {
  AiImpactDimension,
  AiPartnershipRecommendation,
  AiSupervisorActionItem,
  PartnershipAiAnalysisResult,
  SavedAiAnalysis,
} from '../types/aiAnalysis';
import { ArkasImportBundleInput } from '../types/arkasImport';
import {
  computeMonitoringResult,
  generateNextId,
  generateUid,
} from '../utils/formatters';

interface MitraKitaContextValue {
  dataset: MitraKitaDataset;
  session: SupervisorSession | null;
  authReady: boolean;
  authLoading: boolean;
  dataLoading: boolean;
  needsEmailVerification: boolean;
  unverifiedEmail: string | null;
  role: UserRole;
  isAdmin: boolean;
  isPengawas: boolean;
  loginWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  loginWithEmailPassword: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  sendResetPassword: (
    email: string
  ) => Promise<{ ok: boolean; error?: string }>;
  resendVerificationEmail: () => Promise<{ ok: boolean; error?: string }>;
  refreshEmailVerification: () => Promise<boolean>;
  updateSupervisorProfile: (
    namaPengawas: string,
    nip: string
  ) => Promise<boolean>;
  logoutPengawas: () => Promise<void>;
  schoolNameSuggestions: string[];
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  notify: (
    type: ToastMessage['type'],
    title: string,
    description?: string
  ) => void;

  // Partners CRUD
  addPartner: (
    data: Omit<Partner, 'createdAt' | 'updatedAt' | 'isDemo'>
  ) => boolean;
  updatePartner: (
    id: string,
    data: Omit<Partner, 'id' | 'createdAt' | 'updatedAt' | 'isDemo'>
  ) => boolean;
  deletePartner: (id: string) => void;
  getNextPartnerId: () => string;
  syncPartnerProgramLinks: (partnerId: string, linkedProgramIds: string[]) => void;

  // Programs CRUD
  addProgram: (
    data: Omit<PartnershipProgram, 'id' | 'createdAt' | 'updatedAt' | 'isDemo'>
  ) => boolean;
  updateProgram: (
    id: string,
    data: Omit<PartnershipProgram, 'id' | 'createdAt' | 'updatedAt' | 'isDemo'>
  ) => boolean;
  deleteProgram: (id: string) => void;
  getNextProgramCode: () => string;

  // Activities CRUD
  addActivity: (
    data: Omit<PartnershipActivity, 'id' | 'createdAt' | 'updatedAt' | 'isDemo'>
  ) => boolean;
  updateActivity: (
    id: string,
    data: Omit<PartnershipActivity, 'id' | 'createdAt' | 'updatedAt' | 'isDemo'>
  ) => boolean;
  markActivityComplete: (id: string) => void;
  deleteActivity: (id: string) => void;

  // Evidences CRUD
  addEvidence: (
    data: Omit<EvidenceItem, 'id' | 'createdAt' | 'isDemo'>
  ) => boolean;
  updateEvidence: (
    id: string,
    data: Omit<EvidenceItem, 'id' | 'createdAt' | 'isDemo'>
  ) => boolean;
  deleteEvidence: (id: string) => void;

  // Monitoring & Evaluations CRUD
  addEvaluation: (
    data: Omit<
      MonitoringEvaluation,
      'id' | 'createdAt' | 'updatedAt' | 'isDemo'
    >
  ) => boolean;
  updateEvaluation: (
    id: string,
    data: Partial<Omit<MonitoringEvaluation, 'id' | 'createdAt'>>
  ) => boolean;
  deleteEvaluation: (id: string) => void;

  // Supervisor Notes (Pengawas)
  addSupervisorNote: (
    data: Omit<SupervisorNote, 'id' | 'createdAt' | 'isDemo'>
  ) => boolean;
  deleteSupervisorNote: (id: string) => void;

  // AI Analysis Persistence
  saveAiAnalysis: (
    analysis: PartnershipAiAnalysisResult,
    namaSekolah: string,
    focusPrompt: string
  ) => Promise<string | null>;
  deleteAiAnalysis: (id: string) => void;

  // School Profile & Data Management
  updateSchoolProfile: (profile: SchoolProfile) => boolean;
  resetAllData: () => Promise<void>;
  importDatasetJson: (
    rawJson: string
  ) => Promise<{ ok: boolean; error?: string }>;
  importArkasBundle: (bundle: ArkasImportBundleInput) => Promise<{
    ok: boolean;
    partnersCreated: number;
    programsCreated: number;
    activitiesCreated: number;
    error?: string;
  }>;
}

const MitraKitaContext = createContext<MitraKitaContextValue | null>(null);

const ID_REGEX = /^[a-zA-Z0-9_-]+$/;

function sanitizeId(raw: string, fallbackPrefix: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
  return cleaned && ID_REGEX.test(cleaned)
    ? cleaned
    : generateUid(fallbackPrefix);
}

function clampStr(value: unknown, maxLen: number): string {
  const s = typeof value === 'string' ? value.trim() : '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return new Date().toISOString();
}

function sortByCreatedDesc<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function normalizeScores(scores: Record<string, number>): Record<string, number> {
  const clean: Record<string, number> = {};
  for (let i = 1; i <= 10; i += 1) {
    const key = `ind_${i}`;
    const raw = Math.round(Number(scores?.[key] ?? 1));
    clean[key] = Math.min(4, Math.max(1, Number.isFinite(raw) ? raw : 1));
  }
  return clean;
}

function isPermissionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return msg.includes('permission') || msg.includes('insufficient');
}

export const MitraKitaProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [session, setSession] = useState<SupervisorSession | null>(null);
  const [dataset, setDataset] = useState<MitraKitaDataset>(() =>
    createEmptyDataset()
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const userProfileExistsRef = useRef(false);
  const schoolProfileExistsRef = useRef(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = generateUid('toast');
      setToasts((prev) => [...prev.slice(-3), { id, type, title, description }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 4200);
    },
    []
  );

  const reportFirestoreFailure = useCallback(
    (
      error: unknown,
      operationType: OperationType,
      path: string,
      friendlyTitle: string
    ) => {
      const errInfo = buildFirestoreErrorInfo(error, operationType, path);
      console.error('Firestore Error: ', JSON.stringify(errInfo));
      if (isPermissionError(error)) {
        setFatalError(new Error(JSON.stringify(errInfo)));
      } else {
        notify('error', friendlyTitle, errInfo.error);
      }
    },
    [notify]
  );

  const initializeVerifiedUserSession = useCallback(
    async (user: User) => {
      const fallbackName =
        clampStr(user.displayName, 150) ||
        clampStr(user.email?.split('@')[0], 150) ||
        'Pengawas Sekolah';

      setSession({
        uid: user.uid,
        namaPengawas: fallbackName,
        nip: '',
        email: clampStr(user.email, 200),
        photoURL: clampStr(user.photoURL, 1000),
        loggedInAt: new Date().toISOString(),
      });

      const userDocPath = `users/${user.uid}`;
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            ownerUid: user.uid,
            namaPengawas: fallbackName,
            nip: '',
            email: clampStr(user.email, 200),
            photoURL: clampStr(user.photoURL, 1000),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          userProfileExistsRef.current = true;
        } else {
          userProfileExistsRef.current = true;
        }
      } catch (error) {
        reportFirestoreFailure(
          error,
          OperationType.WRITE,
          userDocPath,
          'Gagal menginisialisasi profil Pengawas'
        );
      }
    },
    [reportFirestoreFailure]
  );

  // 1. Firebase Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setIsEmailVerified(false);
        setSession(null);
        setDataset(createEmptyDataset());
        userProfileExistsRef.current = false;
        schoolProfileExistsRef.current = false;
        setDataLoading(false);
        setAuthReady(true);
        return;
      }

      if (!user.emailVerified) {
        setIsEmailVerified(false);
        setSession(null);
        setDataset(createEmptyDataset());
        userProfileExistsRef.current = false;
        schoolProfileExistsRef.current = false;
        setDataLoading(false);
        setAuthReady(true);
        return;
      }

      setIsEmailVerified(true);
      await initializeVerifiedUserSession(user);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [initializeVerifiedUserSession]);

  // 2. Real-time Firestore subscriptions (only when authenticated AND email verified)
  useEffect(() => {
    if (!authReady || !firebaseUser || !isEmailVerified) {
      return;
    }

    const uid = firebaseUser.uid;
    setDataLoading(true);
    const loadedFlags = {
      partners: false,
      programs: false,
      activities: false,
      evidences: false,
      evaluations: false,
      notes: false,
    };
    const markLoaded = (key: keyof typeof loadedFlags) => {
      loadedFlags[key] = true;
      if (Object.values(loadedFlags).every(Boolean)) {
        setDataLoading(false);
      }
    };

    const unsubscribers: Array<() => void> = [];

    // User profile
    unsubscribers.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          userProfileExistsRef.current = snap.exists();
          if (snap.exists()) {
            const d = snap.data();
            setSession((prev) => ({
              uid,
              namaPengawas:
                (typeof d.namaPengawas === 'string' && d.namaPengawas) ||
                prev?.namaPengawas ||
                firebaseUser.displayName ||
                'Pengawas Sekolah',
              nip: typeof d.nip === 'string' ? d.nip : '',
              email:
                typeof d.email === 'string'
                  ? d.email
                  : firebaseUser.email ?? '',
              photoURL:
                typeof d.photoURL === 'string'
                  ? d.photoURL
                  : firebaseUser.photoURL ?? '',
              loggedInAt: prev?.loggedInAt ?? new Date().toISOString(),
            }));
          }
        },
        (error) => {
          reportFirestoreFailure(
            error,
            OperationType.GET,
            `users/${uid}`,
            'Gagal memuat profil Pengawas'
          );
        }
      )
    );

    // School profile
    unsubscribers.push(
      onSnapshot(
        doc(db, 'schoolProfiles', uid),
        (snap) => {
          schoolProfileExistsRef.current = snap.exists();
          if (snap.exists()) {
            const d = snap.data();
            setDataset((prev) => ({
              ...prev,
              schoolProfile: {
                namaSekolah: String(d.namaSekolah ?? ''),
                npsn: String(d.npsn ?? ''),
                kepalaSekolah: String(d.kepalaSekolah ?? ''),
                nipKepalaSekolah: String(d.nipKepalaSekolah ?? ''),
                namaPengawas: String(d.namaPengawas ?? ''),
                nipPengawas: String(d.nipPengawas ?? ''),
                alamatSekolah: String(d.alamatSekolah ?? ''),
                tahunAjaran: String(d.tahunAjaran ?? '2026/2027'),
              },
            }));
          } else {
            setDataset((prev) => ({
              ...prev,
              schoolProfile: createEmptyDataset().schoolProfile,
            }));
          }
        },
        (error) => {
          reportFirestoreFailure(
            error,
            OperationType.GET,
            `schoolProfiles/${uid}`,
            'Gagal memuat identitas sekolah'
          );
        }
      )
    );

    // Partners
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'partners'), where('ownerUid', '==', uid)),
        (snap) => {
          const items: Partner[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: String(d.id ?? docSnap.id),
              namaSekolah: String(d.namaSekolah ?? ''),
              nama: String(d.nama ?? ''),
              kategori: d.kategori as PartnerCategory,
              penanggungJawab: String(d.penanggungJawab ?? ''),
              telepon: String(d.telepon ?? ''),
              alamat: String(d.alamat ?? ''),
              jenisKontribusi: String(d.jenisKontribusi ?? ''),
              potensiKerjaSama: String(d.potensiKerjaSama ?? ''),
              status: d.status as PartnerStatus,
              catatan: String(d.catatan ?? ''),
              createdAt: timestampToIso(d.createdAt),
              updatedAt: timestampToIso(d.updatedAt),
            };
          });
          setDataset((prev) => ({
            ...prev,
            partners: sortByCreatedDesc(items),
          }));
          markLoaded('partners');
        },
        (error) => {
          markLoaded('partners');
          reportFirestoreFailure(
            error,
            OperationType.LIST,
            'partners',
            'Gagal memuat data mitra'
          );
        }
      )
    );

    // Programs
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'programs'), where('ownerUid', '==', uid)),
        (snap) => {
          const items: PartnershipProgram[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: String(d.id ?? docSnap.id),
              namaSekolah: String(d.namaSekolah ?? ''),
              kodeProgram: String(d.kodeProgram ?? ''),
              namaProgram: String(d.namaProgram ?? ''),
              latarBelakang: String(d.latarBelakang ?? ''),
              tujuan: String(d.tujuan ?? ''),
              areaPm: d.areaPm as PmLeadershipArea,
              partnerIds: Array.isArray(d.partnerIds)
                ? d.partnerIds.map(String)
                : [],
              sasaran: String(d.sasaran ?? ''),
              bentukKontribusi: String(d.bentukKontribusi ?? ''),
              strategiPelaksanaan: String(d.strategiPelaksanaan ?? ''),
              waktuPelaksanaan: String(d.waktuPelaksanaan ?? ''),
              penanggungJawab: String(d.penanggungJawab ?? ''),
              sumberPembiayaan: String(d.sumberPembiayaan ?? ''),
              anggaranRencana: Number(d.anggaranRencana ?? 0),
              indikatorKeberhasilan: String(d.indikatorKeberhasilan ?? ''),
              targetHasil: String(d.targetHasil ?? ''),
              status: d.status as ProgramStatus,
              createdAt: timestampToIso(d.createdAt),
              updatedAt: timestampToIso(d.updatedAt),
            };
          });
          setDataset((prev) => ({
            ...prev,
            programs: sortByCreatedDesc(items),
          }));
          markLoaded('programs');
        },
        (error) => {
          markLoaded('programs');
          reportFirestoreFailure(
            error,
            OperationType.LIST,
            'programs',
            'Gagal memuat program kemitraan'
          );
        }
      )
    );

    // Activities
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'activities'), where('ownerUid', '==', uid)),
        (snap) => {
          const items: PartnershipActivity[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: String(d.id ?? docSnap.id),
              namaSekolah: String(d.namaSekolah ?? ''),
              namaKegiatan: String(d.namaKegiatan ?? ''),
              programId: String(d.programId ?? ''),
              tanggalPelaksanaan: String(d.tanggalPelaksanaan ?? ''),
              lokasi: String(d.lokasi ?? ''),
              partnerIds: Array.isArray(d.partnerIds)
                ? d.partnerIds.map(String)
                : [],
              penanggungJawab: String(d.penanggungJawab ?? ''),
              jumlahPeserta: Number(d.jumlahPeserta ?? 0),
              deskripsiPelaksanaan: String(d.deskripsiPelaksanaan ?? ''),
              hasilKegiatan: String(d.hasilKegiatan ?? ''),
              kendala: String(d.kendala ?? ''),
              status: d.status as ActivityStatus,
              createdAt: timestampToIso(d.createdAt),
              updatedAt: timestampToIso(d.updatedAt),
            };
          });
          setDataset((prev) => ({
            ...prev,
            activities: sortByCreatedDesc(items),
          }));
          markLoaded('activities');
        },
        (error) => {
          markLoaded('activities');
          reportFirestoreFailure(
            error,
            OperationType.LIST,
            'activities',
            'Gagal memuat data kegiatan'
          );
        }
      )
    );

    // Evidences
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'evidences'), where('ownerUid', '==', uid)),
        (snap) => {
          const items: EvidenceItem[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: String(d.id ?? docSnap.id),
              namaSekolah: String(d.namaSekolah ?? ''),
              namaDokumen: String(d.namaDokumen ?? ''),
              jenis: d.jenis as EvidenceType,
              programId: String(d.programId ?? ''),
              activityId: d.activityId ? String(d.activityId) : undefined,
              tanggalUnggah: String(d.tanggalUnggah ?? ''),
              keterangan: String(d.keterangan ?? ''),
              fileUrl: d.fileUrl ? String(d.fileUrl) : undefined,
              fileName: d.fileName ? String(d.fileName) : undefined,
              fileMimeType: d.fileMimeType ? String(d.fileMimeType) : undefined,
              fileSize: Number(d.fileSize ?? 0) || undefined,
              createdAt: timestampToIso(d.createdAt),
            };
          });
          setDataset((prev) => ({
            ...prev,
            evidences: sortByCreatedDesc(items),
          }));
          markLoaded('evidences');
        },
        (error) => {
          markLoaded('evidences');
          reportFirestoreFailure(
            error,
            OperationType.LIST,
            'evidences',
            'Gagal memuat bukti & dokumentasi'
          );
        }
      )
    );

    // Monitoring Evaluations
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'evaluations'), where('ownerUid', '==', uid)),
        (snap) => {
          const items: MonitoringEvaluation[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: String(d.id ?? docSnap.id),
              namaSekolah: String(d.namaSekolah ?? ''),
              periode: String(d.periode ?? ''),
              tanggalPenilaian: String(d.tanggalPenilaian ?? ''),
              penilai: String(d.penilai ?? ''),
              peranPenilai: 'PENGAWAS',
              programId: d.programId ? String(d.programId) : undefined,
              scores:
                d.scores && typeof d.scores === 'object'
                  ? (d.scores as Record<string, number>)
                  : {},
              totalSkorPerolehan: Number(d.totalSkorPerolehan ?? 10),
              totalSkorMaksimal: Number(d.totalSkorMaksimal ?? 40),
              nilaiAkhir: Number(d.nilaiAkhir ?? 25),
              kategoriHasil: d.kategoriHasil as MonitoringCategory,
              temuanMonitoring: String(d.temuanMonitoring ?? ''),
              kekuatan: String(d.kekuatan ?? ''),
              kelemahan: String(d.kelemahan ?? ''),
              rekomendasi: String(d.rekomendasi ?? ''),
              rencanaTindakLanjut: String(d.rencanaTindakLanjut ?? ''),
              catatanPembinaanPengawas: d.catatanPembinaanPengawas
                ? String(d.catatanPembinaanPengawas)
                : undefined,
              createdAt: timestampToIso(d.createdAt),
              updatedAt: timestampToIso(d.updatedAt),
            };
          });
          setDataset((prev) => ({
            ...prev,
            evaluations: sortByCreatedDesc(items),
          }));
          markLoaded('evaluations');
        },
        (error) => {
          markLoaded('evaluations');
          reportFirestoreFailure(
            error,
            OperationType.LIST,
            'evaluations',
            'Gagal memuat data monitoring & evaluasi'
          );
        }
      )
    );

    // Supervisor Notes
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'supervisorNotes'), where('ownerUid', '==', uid)),
        (snap) => {
          const items: SupervisorNote[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: String(d.id ?? docSnap.id),
              namaSekolah: String(d.namaSekolah ?? ''),
              targetType: d.targetType as SupervisorNote['targetType'],
              targetId: d.targetId ? String(d.targetId) : undefined,
              tanggal: String(d.tanggal ?? ''),
              pengawasNama: String(d.pengawasNama ?? ''),
              catatanPembinaan: String(d.catatanPembinaan ?? ''),
              rekomendasi: String(d.rekomendasi ?? ''),
              createdAt: timestampToIso(d.createdAt),
            };
          });
          setDataset((prev) => ({
            ...prev,
            supervisorNotes: sortByCreatedDesc(items),
          }));
          markLoaded('notes');
        },
        (error) => {
          markLoaded('notes');
          reportFirestoreFailure(
            error,
            OperationType.LIST,
            'supervisorNotes',
            'Gagal memuat catatan pembinaan'
          );
        }
      )
    );

    // AI Analyses History
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'aiAnalyses'), where('ownerUid', '==', uid)),
        (snap) => {
          const items: SavedAiAnalysis[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            let parsedDetails: {
              keyStrengths?: string[];
              priorityGaps?: string[];
              partnershipRecommendations?: AiPartnershipRecommendation[];
              dimensions?: AiImpactDimension[];
              supervisorActionPlan?: AiSupervisorActionItem[];
            } = {};
            try {
              if (typeof d.detailsJson === 'string' && d.detailsJson.trim()) {
                parsedDetails = JSON.parse(d.detailsJson);
              }
            } catch {
              parsedDetails = {};
            }
            return {
              id: String(d.id ?? docSnap.id),
              namaSekolah: String(d.namaSekolah ?? ''),
              schoolScope: String(d.schoolScope ?? 'Semua Sekolah Binaan'),
              focusPrompt: String(d.focusPrompt ?? ''),
              generatedAt: String(d.generatedAt ?? timestampToIso(d.createdAt)),
              executiveSummary: String(d.executiveSummary ?? ''),
              maturityScore: Number(d.maturityScore ?? 0),
              maturityLevel: (d.maturityLevel ??
                'Berkembang') as SavedAiAnalysis['maturityLevel'],
              keyStrengths: Array.isArray(parsedDetails.keyStrengths)
                ? parsedDetails.keyStrengths
                : [],
              priorityGaps: Array.isArray(parsedDetails.priorityGaps)
                ? parsedDetails.priorityGaps
                : [],
              partnershipRecommendations: Array.isArray(
                parsedDetails.partnershipRecommendations
              )
                ? parsedDetails.partnershipRecommendations
                : [],
              impactAnalysis: {
                overallImpactIndex: Number(d.overallImpactIndex ?? 0),
                dimensions: Array.isArray(parsedDetails.dimensions)
                  ? parsedDetails.dimensions
                  : [],
                budgetEfficiencyNote: String(d.budgetEfficiencyNote ?? ''),
                studentOutcomeNarrative: String(
                  d.studentOutcomeNarrative ?? ''
                ),
              },
              supervisorActionPlan: Array.isArray(
                parsedDetails.supervisorActionPlan
              )
                ? parsedDetails.supervisorActionPlan
                : [],
              createdAt: timestampToIso(d.createdAt),
            };
          });
          setDataset((prev) => ({
            ...prev,
            aiAnalyses: sortByCreatedDesc(items),
          }));
        },
        (error) => {
          reportFirestoreFailure(
            error,
            OperationType.LIST,
            'aiAnalyses',
            'Gagal memuat riwayat Analisis AI'
          );
        }
      )
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [authReady, firebaseUser, isEmailVerified, reportFirestoreFailure]);

  // Auth Actions
  const loginWithGoogle = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    setAuthLoading(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const user = credential.user;
      notify(
        'success',
        'Berhasil masuk sebagai Pengawas Sekolah',
        `Selamat datang, ${user.displayName || user.email || 'Pengawas Sekolah'}.`
      );
      return { ok: true };
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: string }).code)
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return { ok: false, error: 'Jendela masuk Google ditutup sebelum selesai.' };
      }
      if (code === 'auth/popup-blocked') {
        return {
          ok: false,
          error:
            'Popup login diblokir browser. Izinkan popup untuk situs ini lalu coba kembali.',
        };
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal masuk dengan akun Google.';
      return { ok: false, error: message };
    } finally {
      setAuthLoading(false);
    }
  }, [notify]);

  const mapAuthErrorMessage = (error: unknown, fallback: string): string => {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: string }).code)
        : '';
    switch (code) {
      case 'auth/operation-not-allowed':
        return 'Metode login Email & Kata Sandi belum diaktifkan di Firebase Console (Authentication → Sign-in method → Email/Password).';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email atau kata sandi tidak sesuai. Pastikan akun sudah terdaftar di Firebase Authentication.';
      case 'auth/invalid-email':
        return 'Format alamat email tidak valid.';
      case 'auth/email-already-in-use':
        return 'Alamat email ini sudah terdaftar. Silakan gunakan tab Masuk.';
      case 'auth/weak-password':
        return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
      case 'auth/too-many-requests':
        return 'Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat sebelum mencoba lagi.';
      default:
        return error instanceof Error ? error.message : fallback;
    }
  };

  const loginWithEmailPassword = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const cleanEmail = email.trim();
      if (!cleanEmail || !password) {
        return { ok: false, error: 'Email dan kata sandi wajib diisi.' };
      }
      setAuthLoading(true);
      try {
        const credential = await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );
        const user = credential.user;
        if (!user.emailVerified) {
          notify(
            'info',
            'Verifikasi email diperlukan',
            'Silakan verifikasi tautan yang dikirim ke email Anda untuk mengakses database.'
          );
        } else {
          notify(
            'success',
            'Berhasil masuk sebagai Pengawas Sekolah',
            `Selamat datang, ${user.displayName || user.email || 'Pengawas Sekolah'}.`
          );
        }
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: mapAuthErrorMessage(
            error,
            'Gagal masuk dengan email dan kata sandi.'
          ),
        };
      } finally {
        setAuthLoading(false);
      }
    },
    [notify]
  );

  const sendResetPassword = useCallback(
    async (email: string): Promise<{ ok: boolean; error?: string }> => {
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        return {
          ok: false,
          error: 'Masukkan alamat email terlebih dahulu untuk reset kata sandi.',
        };
      }
      setAuthLoading(true);
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        notify(
          'success',
          'Email reset kata sandi terkirim',
          `Periksa kotak masuk atau spam pada ${cleanEmail}.`
        );
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: mapAuthErrorMessage(
            error,
            'Gagal mengirim email reset kata sandi.'
          ),
        };
      } finally {
        setAuthLoading(false);
      }
    },
    [notify]
  );

  const resendVerificationEmail = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    if (!auth.currentUser) {
      return { ok: false, error: 'Sesi pengguna tidak ditemukan.' };
    }
    try {
      await sendEmailVerification(auth.currentUser);
      notify(
        'success',
        'Email verifikasi dikirim ulang',
        `Periksa kotak masuk atau folder spam pada ${auth.currentUser.email ?? 'email Anda'}.`
      );
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: mapAuthErrorMessage(
          error,
          'Gagal mengirim ulang email verifikasi.'
        ),
      };
    }
  }, [notify]);

  const refreshEmailVerification = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      if (auth.currentUser.emailVerified) {
        setIsEmailVerified(true);
        await initializeVerifiedUserSession(auth.currentUser);
        notify(
          'success',
          'Email berhasil terverifikasi',
          'Selamat datang di dashboard MITRA KITA.'
        );
        return true;
      }
      notify(
        'info',
        'Email belum terverifikasi',
        'Klik tautan verifikasi pada email Anda lalu coba cek kembali.'
      );
      return false;
    } catch (error) {
      notify(
        'error',
        'Gagal memeriksa status verifikasi',
        error instanceof Error ? error.message : undefined
      );
      return false;
    }
  }, [initializeVerifiedUserSession, notify]);

  const updateSupervisorProfile = useCallback(
    async (namaPengawas: string, nip: string): Promise<boolean> => {
      if (!firebaseUser) return false;
      const uid = firebaseUser.uid;
      const cleanName = clampStr(namaPengawas, 150);
      const cleanNip = clampStr(nip, 50);
      if (!cleanName) {
        notify('error', 'Nama Pengawas Sekolah wajib diisi');
        return false;
      }

      const path = `users/${uid}`;
      try {
        const ref = doc(db, 'users', uid);
        if (userProfileExistsRef.current) {
          await updateDoc(ref, {
            namaPengawas: cleanName,
            nip: cleanNip,
            email: clampStr(firebaseUser.email, 200),
            photoURL: clampStr(firebaseUser.photoURL, 1000),
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(ref, {
            ownerUid: uid,
            namaPengawas: cleanName,
            nip: cleanNip,
            email: clampStr(firebaseUser.email, 200),
            photoURL: clampStr(firebaseUser.photoURL, 1000),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          userProfileExistsRef.current = true;
        }
        notify('success', 'Identitas Pengawas Sekolah diperbarui', cleanName);
        return true;
      } catch (error) {
        reportFirestoreFailure(
          error,
          OperationType.UPDATE,
          path,
          'Gagal memperbarui identitas Pengawas'
        );
        return false;
      }
    },
    [firebaseUser, notify, reportFirestoreFailure]
  );

  const logoutPengawas = useCallback(async () => {
    try {
      await signOut(auth);
      notify('info', 'Anda telah keluar dari sesi Pengawas Sekolah');
    } catch (error) {
      notify(
        'error',
        'Gagal keluar dari sesi',
        error instanceof Error ? error.message : undefined
      );
    }
  }, [notify]);

  const schoolNameSuggestions = useMemo(() => {
    const names = new Set<string>();
    const add = (val?: string) => {
      const t = (val ?? '').trim();
      if (t && t !== 'Nama Sekolah Binaan') names.add(t);
    };
    add(dataset.schoolProfile.namaSekolah);
    dataset.partners.forEach((x) => add(x.namaSekolah));
    dataset.programs.forEach((x) => add(x.namaSekolah));
    dataset.activities.forEach((x) => add(x.namaSekolah));
    dataset.evidences.forEach((x) => add(x.namaSekolah));
    dataset.evaluations.forEach((x) => add(x.namaSekolah));
    dataset.supervisorNotes.forEach((x) => add(x.namaSekolah));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'id'));
  }, [dataset]);

  // --- PARTNERS ---
  const getNextPartnerId = useCallback(
    () => generateNextId('MTR', dataset.partners.map((p) => p.id)),
    [dataset.partners]
  );

  const addPartner = useCallback(
    (data: Omit<Partner, 'createdAt' | 'updatedAt' | 'isDemo'>) => {
      if (!firebaseUser) return false;
      const trimmedId = data.id.trim();
      if (!ID_REGEX.test(trimmedId) || trimmedId.length > 40) {
        notify(
          'error',
          'Format ID Mitra tidak valid',
          'ID Mitra hanya boleh berisi huruf, angka, tanda hubung (-), atau garis bawah (_), maksimal 40 karakter.'
        );
        return false;
      }
      if (
        dataset.partners.some(
          (p) => p.id.toLowerCase() === trimmedId.toLowerCase()
        )
      ) {
        notify(
          'error',
          'ID Mitra sudah digunakan',
          `Gunakan ID lain selain ${trimmedId}.`
        );
        return false;
      }

      const uid = firebaseUser.uid;
      const partnerDocId = `${uid}__${trimmedId}`;
      const path = `partners/${partnerDocId}`;

      void (async () => {
        try {
          await setDoc(doc(db, 'partners', partnerDocId), {
            ownerUid: uid,
            id: trimmedId,
            namaSekolah: clampStr(data.namaSekolah, 200),
            nama: clampStr(data.nama, 200),
            kategori: data.kategori,
            penanggungJawab: clampStr(data.penanggungJawab, 150),
            telepon: clampStr(data.telepon, 40),
            alamat: clampStr(data.alamat, 400),
            jenisKontribusi: clampStr(data.jenisKontribusi, 500),
            potensiKerjaSama: clampStr(data.potensiKerjaSama, 500),
            status: data.status,
            catatan: clampStr(data.catatan, 1500),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          notify('success', 'Data mitra berhasil ditambahkan', data.nama);
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.CREATE,
            path,
            'Gagal menambahkan data mitra'
          );
        }
      })();
      return true;
    },
    [dataset.partners, firebaseUser, notify, reportFirestoreFailure]
  );

  const updatePartner = useCallback(
    (
      id: string,
      data: Omit<Partner, 'id' | 'createdAt' | 'updatedAt' | 'isDemo'>
    ) => {
      if (!firebaseUser) return false;
      const uid = firebaseUser.uid;
      const partnerDocId = `${uid}__${id}`;
      const path = `partners/${partnerDocId}`;

      void (async () => {
        try {
          await updateDoc(doc(db, 'partners', partnerDocId), {
            namaSekolah: clampStr(data.namaSekolah, 200),
            nama: clampStr(data.nama, 200),
            kategori: data.kategori,
            penanggungJawab: clampStr(data.penanggungJawab, 150),
            telepon: clampStr(data.telepon, 40),
            alamat: clampStr(data.alamat, 400),
            jenisKontribusi: clampStr(data.jenisKontribusi, 500),
            potensiKerjaSama: clampStr(data.potensiKerjaSama, 500),
            status: data.status,
            catatan: clampStr(data.catatan, 1500),
            updatedAt: serverTimestamp(),
          });
          notify('success', 'Data mitra diperbarui', data.nama);
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.UPDATE,
            path,
            'Gagal memperbarui data mitra'
          );
        }
      })();
      return true;
    },
    [firebaseUser, notify, reportFirestoreFailure]
  );

  const deletePartner = useCallback(
    (id: string) => {
      if (!firebaseUser) return;
      const uid = firebaseUser.uid;
      const target = dataset.partners.find((p) => p.id === id);
      const partnerDocId = `${uid}__${id}`;
      const path = `partners/${partnerDocId}`;

      void (async () => {
        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, 'partners', partnerDocId));

          dataset.programs
            .filter(
              (prg) =>
                prg.status !== 'Dibatalkan' && prg.partnerIds.includes(id)
            )
            .forEach((prg) => {
              batch.update(doc(db, 'programs', prg.id), {
                partnerIds: prg.partnerIds.filter((pid) => pid !== id),
                updatedAt: serverTimestamp(),
              });
            });

          dataset.activities
            .filter(
              (act) => act.status !== 'Selesai' && act.partnerIds.includes(id)
            )
            .forEach((act) => {
              batch.update(doc(db, 'activities', act.id), {
                partnerIds: act.partnerIds.filter((pid) => pid !== id),
                updatedAt: serverTimestamp(),
              });
            });

          await batch.commit();
          notify(
            'success',
            'Data mitra dihapus',
            target ? `${target.nama} telah dihapus dari sistem.` : undefined
          );
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.DELETE,
            path,
            'Gagal menghapus data mitra'
          );
        }
      })();
    },
    [
      dataset.activities,
      dataset.partners,
      dataset.programs,
      firebaseUser,
      notify,
      reportFirestoreFailure,
    ]
  );

  const syncPartnerProgramLinks = useCallback(
    (partnerId: string, linkedProgramIds: string[]) => {
      if (!firebaseUser || !partnerId.trim()) return;
      const desiredSet = new Set(linkedProgramIds);
      const changedPrograms = dataset.programs.filter((prg) => {
        if (prg.status === 'Dibatalkan') return false;
        const currentlyLinked = prg.partnerIds.includes(partnerId);
        const shouldBeLinked = desiredSet.has(prg.id);
        return currentlyLinked !== shouldBeLinked;
      });

      if (changedPrograms.length === 0) return;

      void (async () => {
        try {
          const batch = writeBatch(db);
          changedPrograms.forEach((prg) => {
            const shouldBeLinked = desiredSet.has(prg.id);
            const nextPartnerIds = shouldBeLinked
              ? Array.from(new Set([...prg.partnerIds, partnerId])).slice(0, 50)
              : prg.partnerIds.filter((pid) => pid !== partnerId);
            batch.update(doc(db, 'programs', prg.id), {
              partnerIds: nextPartnerIds,
              updatedAt: serverTimestamp(),
            });
          });
          await batch.commit();
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.UPDATE,
            'programs',
            'Gagal menautkan mitra ke program kemitraan'
          );
        }
      })();
    },
    [dataset.programs, firebaseUser, reportFirestoreFailure]
  );

  // --- PROGRAMS ---
  const getNextProgramCode = useCallback(() => {
    const year = new Date().getFullYear();
    const prefix = `PRG-${year}`;
    const existingNums = dataset.programs
      .map((p) => {
        const m = p.kodeProgram.match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => Number.isFinite(n));
    const next = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
    return `${prefix}-${String(next).padStart(2, '0')}`;
  }, [dataset.programs]);

  const addProgram = useCallback(
    (
      data: Omit<
        PartnershipProgram,
        'id' | 'createdAt' | 'updatedAt' | 'isDemo'
      >
    ) => {
      if (!firebaseUser) return false;
      const uid = firebaseUser.uid;
      const id = generateUid('prg');
      const path = `programs/${id}`;

      void (async () => {
        try {
          await setDoc(doc(db, 'programs', id), {
            ownerUid: uid,
            id,
            namaSekolah: clampStr(data.namaSekolah, 200),
            kodeProgram: clampStr(data.kodeProgram, 40),
            namaProgram: clampStr(data.namaProgram, 200),
            latarBelakang: clampStr(data.latarBelakang, 2000),
            tujuan: clampStr(data.tujuan, 2000),
            areaPm: data.areaPm,
            partnerIds: (data.partnerIds ?? []).slice(0, 50),
            sasaran: clampStr(data.sasaran, 400),
            bentukKontribusi: clampStr(data.bentukKontribusi, 1000),
            strategiPelaksanaan: clampStr(data.strategiPelaksanaan, 2000),
            waktuPelaksanaan: clampStr(data.waktuPelaksanaan, 120),
            penanggungJawab: clampStr(data.penanggungJawab, 150),
            sumberPembiayaan: clampStr(data.sumberPembiayaan, 200),
            anggaranRencana: Math.max(
              0,
              Math.min(1000000000000, Number(data.anggaranRencana) || 0)
            ),
            indikatorKeberhasilan: clampStr(data.indikatorKeberhasilan, 1500),
            targetHasil: clampStr(data.targetHasil, 1500),
            status: data.status,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          notify(
            'success',
            'Program kemitraan berhasil disimpan',
            data.namaProgram
          );
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.CREATE,
            path,
            'Gagal menyimpan program kemitraan'
          );
        }
      })();
      return true;
    },
    [firebaseUser, notify, reportFirestoreFailure]
  );

  const updateProgram = useCallback(
    (
      id: string,
      data: Omit<
        PartnershipProgram,
        'id' | 'createdAt' | 'updatedAt' | 'isDemo'
      >
    ) => {
      if (!firebaseUser) return false;
      const existingProg = dataset.programs.find((p) => p.id === id);
      if (existingProg?.status === 'Dibatalkan') {
        notify(
          'error',
          'Program sudah dibatalkan',
          'Program berstatus Dibatalkan terkunci dan tidak dapat diubah lagi.'
        );
        return false;
      }

      const path = `programs/${id}`;
      void (async () => {
        try {
          await updateDoc(doc(db, 'programs', id), {
            namaSekolah: clampStr(data.namaSekolah, 200),
            kodeProgram: clampStr(data.kodeProgram, 40),
            namaProgram: clampStr(data.namaProgram, 200),
            latarBelakang: clampStr(data.latarBelakang, 2000),
            tujuan: clampStr(data.tujuan, 2000),
            areaPm: data.areaPm,
            partnerIds: (data.partnerIds ?? []).slice(0, 50),
            sasaran: clampStr(data.sasaran, 400),
            bentukKontribusi: clampStr(data.bentukKontribusi, 1000),
            strategiPelaksanaan: clampStr(data.strategiPelaksanaan, 2000),
            waktuPelaksanaan: clampStr(data.waktuPelaksanaan, 120),
            penanggungJawab: clampStr(data.penanggungJawab, 150),
            sumberPembiayaan: clampStr(data.sumberPembiayaan, 200),
            anggaranRencana: Math.max(
              0,
              Math.min(1000000000000, Number(data.anggaranRencana) || 0)
            ),
            indikatorKeberhasilan: clampStr(data.indikatorKeberhasilan, 1500),
            targetHasil: clampStr(data.targetHasil, 1500),
            status: data.status,
            updatedAt: serverTimestamp(),
          });
          notify('success', 'Program kemitraan diperbarui', data.namaProgram);
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.UPDATE,
            path,
            'Gagal memperbarui program kemitraan'
          );
        }
      })();
      return true;
    },
    [dataset.programs, firebaseUser, notify, reportFirestoreFailure]
  );

  const deleteProgram = useCallback(
    (id: string) => {
      if (!firebaseUser) return;
      const target = dataset.programs.find((p) => p.id === id);
      const path = `programs/${id}`;

      void (async () => {
        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, 'programs', id));
          dataset.activities
            .filter((a) => a.programId === id)
            .forEach((a) => batch.delete(doc(db, 'activities', a.id)));
          dataset.evidences
            .filter((e) => e.programId === id)
            .forEach((e) => batch.delete(doc(db, 'evidences', e.id)));
          dataset.supervisorNotes
            .filter((n) => n.targetType === 'PROGRAM' && n.targetId === id)
            .forEach((n) => batch.delete(doc(db, 'supervisorNotes', n.id)));

          await batch.commit();
          notify(
            'success',
            'Program kemitraan dihapus',
            target
              ? `${target.namaProgram} beserta relasi kegiatannya telah dihapus.`
              : undefined
          );
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.DELETE,
            path,
            'Gagal menghapus program kemitraan'
          );
        }
      })();
    },
    [
      dataset.activities,
      dataset.evidences,
      dataset.programs,
      dataset.supervisorNotes,
      firebaseUser,
      notify,
      reportFirestoreFailure,
    ]
  );

  // --- ACTIVITIES ---
  const addActivity = useCallback(
    (
      data: Omit<
        PartnershipActivity,
        'id' | 'createdAt' | 'updatedAt' | 'isDemo'
      >
    ) => {
      if (!firebaseUser) return false;
      const uid = firebaseUser.uid;
      const id = generateUid('act');
      const path = `activities/${id}`;

      void (async () => {
        try {
          await setDoc(doc(db, 'activities', id), {
            ownerUid: uid,
            id,
            namaSekolah: clampStr(data.namaSekolah, 200),
            namaKegiatan: clampStr(data.namaKegiatan, 200),
            programId: data.programId,
            tanggalPelaksanaan: clampStr(data.tanggalPelaksanaan, 30),
            lokasi: clampStr(data.lokasi, 300),
            partnerIds: (data.partnerIds ?? []).slice(0, 50),
            penanggungJawab: clampStr(data.penanggungJawab, 150),
            jumlahPeserta: Math.max(
              0,
              Math.min(1000000, Math.round(Number(data.jumlahPeserta) || 0))
            ),
            deskripsiPelaksanaan: clampStr(data.deskripsiPelaksanaan, 2500),
            hasilKegiatan: clampStr(data.hasilKegiatan, 2500),
            kendala: clampStr(data.kendala, 2000),
            status: data.status,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          notify('success', 'Kegiatan berhasil dicatat', data.namaKegiatan);
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.CREATE,
            path,
            'Gagal menyimpan kegiatan'
          );
        }
      })();
      return true;
    },
    [firebaseUser, notify, reportFirestoreFailure]
  );

  const updateActivity = useCallback(
    (
      id: string,
      data: Omit<
        PartnershipActivity,
        'id' | 'createdAt' | 'updatedAt' | 'isDemo'
      >
    ) => {
      if (!firebaseUser) return false;
      const existingAct = dataset.activities.find((a) => a.id === id);
      if (existingAct?.status === 'Selesai') {
        notify(
          'error',
          'Kegiatan sudah selesai',
          'Kegiatan berstatus Selesai terkunci untuk menjaga integritas catatan realisasi.'
        );
        return false;
      }

      const path = `activities/${id}`;
      void (async () => {
        try {
          await updateDoc(doc(db, 'activities', id), {
            namaSekolah: clampStr(data.namaSekolah, 200),
            namaKegiatan: clampStr(data.namaKegiatan, 200),
            programId: data.programId,
            tanggalPelaksanaan: clampStr(data.tanggalPelaksanaan, 30),
            lokasi: clampStr(data.lokasi, 300),
            partnerIds: (data.partnerIds ?? []).slice(0, 50),
            penanggungJawab: clampStr(data.penanggungJawab, 150),
            jumlahPeserta: Math.max(
              0,
              Math.min(1000000, Math.round(Number(data.jumlahPeserta) || 0))
            ),
            deskripsiPelaksanaan: clampStr(data.deskripsiPelaksanaan, 2500),
            hasilKegiatan: clampStr(data.hasilKegiatan, 2500),
            kendala: clampStr(data.kendala, 2000),
            status: data.status,
            updatedAt: serverTimestamp(),
          });
          notify('success', 'Data kegiatan diperbarui', data.namaKegiatan);
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.UPDATE,
            path,
            'Gagal memperbarui kegiatan'
          );
        }
      })();
      return true;
    },
    [dataset.activities, firebaseUser, notify, reportFirestoreFailure]
  );

  const markActivityComplete = useCallback(
    (id: string) => {
      if (!firebaseUser) return;
      const target = dataset.activities.find((a) => a.id === id);
      if (!target || target.status === 'Selesai') return;
      const path = `activities/${id}`;

      void (async () => {
        try {
          await updateDoc(doc(db, 'activities', id), {
            status: 'Selesai',
            updatedAt: serverTimestamp(),
          });
          notify('success', 'Kegiatan ditandai selesai', target.namaKegiatan);
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.UPDATE,
            path,
            'Gagal menandai kegiatan selesai'
          );
        }
      })();
    },
    [dataset.activities, firebaseUser, notify, reportFirestoreFailure]
  );

  const deleteActivity = useCallback(
    (id: string) => {
      if (!firebaseUser) return;
      const target = dataset.activities.find((a) => a.id === id);
      const path = `activities/${id}`;

      void (async () => {
        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, 'activities', id));
          dataset.evidences
            .filter((ev) => ev.activityId === id)
            .forEach((ev) => {
              batch.update(doc(db, 'evidences', ev.id), {
                activityId: '',
                updatedAt: serverTimestamp(),
              });
            });
          await batch.commit();
          notify(
            'success',
            'Kegiatan dihapus',
            target ? target.namaKegiatan : undefined
          );
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.DELETE,
            path,
            'Gagal menghapus kegiatan'
          );
        }
      })();
    },
    [
      dataset.activities,
      dataset.evidences,
      firebaseUser,
      notify,
      reportFirestoreFailure,
    ]
  );

  // --- EVIDENCES ---
  const addEvidence = useCallback(
    (data: Omit<EvidenceItem, 'id' | 'createdAt' | 'isDemo'>) => {
      if (!firebaseUser) return false;
      const fileUrl = data.fileUrl ?? '';
      if (fileUrl.length > 700000) {
        notify(
          'error',
          'Ukuran berkas melebihi batas Firestore',
          'Gunakan foto terkompresi atau dokumen di bawah 400 KB.'
        );
        return false;
      }

      const uid = firebaseUser.uid;
      const id = generateUid('evd');
      const path = `evidences/${id}`;

      void (async () => {
        try {
          await setDoc(doc(db, 'evidences', id), {
            ownerUid: uid,
            id,
            namaSekolah: clampStr(data.namaSekolah, 200),
            namaDokumen: clampStr(data.namaDokumen, 200),
            jenis: data.jenis,
            programId: data.programId,
            activityId: data.activityId ? data.activityId.trim() : '',
            tanggalUnggah: clampStr(data.tanggalUnggah, 30),
            keterangan: clampStr(data.keterangan, 2000),
            fileUrl,
            fileName: clampStr(data.fileName, 255),
            fileMimeType: clampStr(data.fileMimeType, 120),
            fileSize: Math.max(
              0,
              Math.min(50000000, Math.round(Number(data.fileSize) || 0))
            ),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          notify('success', 'Bukti dokumentasi disimpan', data.namaDokumen);
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.CREATE,
            path,
            'Gagal menyimpan bukti dokumentasi'
          );
        }
      })();
      return true;
    },
    [firebaseUser, notify, reportFirestoreFailure]
  );

  const updateEvidence = useCallback(
    (id: string, data: Omit<EvidenceItem, 'id' | 'createdAt' | 'isDemo'>) => {
      if (!firebaseUser) return false;
      const fileUrl = data.fileUrl ?? '';
      if (fileUrl.length > 700000) {
        notify(
          'error',
          'Ukuran berkas melebihi batas Firestore',
          'Gunakan foto terkompresi atau dokumen di bawah 400 KB.'
        );
        return false;
      }

      const path = `evidences/${id}`;
      void (async () => {
        try {
          await updateDoc(doc(db, 'evidences', id), {
            namaSekolah: clampStr(data.namaSekolah, 200),
            namaDokumen: clampStr(data.namaDokumen, 200),
            jenis: data.jenis,
            programId: data.programId,
            activityId: data.activityId ? data.activityId.trim() : '',
            tanggalUnggah: clampStr(data.tanggalUnggah, 30),
            keterangan: clampStr(data.keterangan, 2000),
            fileUrl,
            fileName: clampStr(data.fileName, 255),
            fileMimeType: clampStr(data.fileMimeType, 120),
            fileSize: Math.max(
              0,
              Math.min(50000000, Math.round(Number(data.fileSize) || 0))
            ),
            updatedAt: serverTimestamp(),
          });
          notify('success', 'Bukti dokumentasi diperbarui', data.namaDokumen);
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.UPDATE,
            path,
            'Gagal memperbarui bukti dokumentasi'
          );
        }
      })();
      return true;
    },
    [firebaseUser, notify, reportFirestoreFailure]
  );

  const deleteEvidence = useCallback(
    (id: string) => {
      if (!firebaseUser) return;
      const target = dataset.evidences.find((e) => e.id === id);
      const path = `evidences/${id}`;

      void (async () => {
        try {
          await deleteDoc(doc(db, 'evidences', id));
          notify(
            'success',
            'Dokumentasi dihapus',
            target ? target.namaDokumen : undefined
          );
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.DELETE,
            path,
            'Gagal menghapus dokumentasi'
          );
        }
      })();
    },
    [dataset.evidences, firebaseUser, notify, reportFirestoreFailure]
  );

  // --- EVALUATIONS ---
  const addEvaluation = useCallback(
    (
      data: Omit<
        MonitoringEvaluation,
        'id' | 'createdAt' | 'updatedAt' | 'isDemo'
      >
    ) => {
      if (!firebaseUser) return false;
      const uid = firebaseUser.uid;
      const id = generateUid('eval');
      const path = `evaluations/${id}`;
      const cleanScores = normalizeScores(data.scores);
      const computed = computeMonitoringResult(cleanScores);

      void (async () => {
        try {
          await setDoc(doc(db, 'evaluations', id), {
            ownerUid: uid,
            id,
            namaSekolah: clampStr(data.namaSekolah, 200),
            periode: clampStr(data.periode, 120),
            tanggalPenilaian: clampStr(data.tanggalPenilaian, 30),
            penilai: clampStr(data.penilai, 150),
            peranPenilai: 'PENGAWAS',
            programId: data.programId ? data.programId.trim() : '',
            scores: cleanScores,
            totalSkorPerolehan: computed.totalSkorPerolehan,
            totalSkorMaksimal: 40,
            nilaiAkhir: computed.nilaiAkhir,
            kategoriHasil: computed.kategoriHasil,
            temuanMonitoring: clampStr(data.temuanMonitoring, 2500),
            kekuatan: clampStr(data.kekuatan, 2500),
            kelemahan: clampStr(data.kelemahan, 2500),
            rekomendasi: clampStr(data.rekomendasi, 2500),
            rencanaTindakLanjut: clampStr(data.rencanaTindakLanjut, 2500),
            catatanPembinaanPengawas: clampStr(
              data.catatanPembinaanPengawas,
              2500
            ),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          notify(
            'success',
            'Hasil monitoring berhasil disimpan',
            `Nilai ${computed.nilaiAkhir} (${computed.kategoriHasil})`
          );
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.CREATE,
            path,
            'Gagal menyimpan hasil monitoring'
          );
        }
      })();
      return true;
    },
    [firebaseUser, notify, reportFirestoreFailure]
  );

  const updateEvaluation = useCallback(
    (
      id: string,
      data: Partial<Omit<MonitoringEvaluation, 'id' | 'createdAt'>>
    ) => {
      if (!firebaseUser) return false;
      const path = `evaluations/${id}`;
      const payload: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };

      if (data.namaSekolah !== undefined)
        payload.namaSekolah = clampStr(data.namaSekolah, 200);
      if (data.periode !== undefined)
        payload.periode = clampStr(data.periode, 120);
      if (data.tanggalPenilaian !== undefined)
        payload.tanggalPenilaian = clampStr(data.tanggalPenilaian, 30);
      if (data.penilai !== undefined)
        payload.penilai = clampStr(data.penilai, 150);
      if (data.programId !== undefined)
        payload.programId = data.programId ? data.programId.trim() : '';
      if (data.scores !== undefined) {
        const cleanScores = normalizeScores(data.scores);
        const computed = computeMonitoringResult(cleanScores);
        payload.scores = cleanScores;
        payload.totalSkorPerolehan = computed.totalSkorPerolehan;
        payload.totalSkorMaksimal = 40;
        payload.nilaiAkhir = computed.nilaiAkhir;
        payload.kategoriHasil = computed.kategoriHasil;
      }
      if (data.temuanMonitoring !== undefined)
        payload.temuanMonitoring = clampStr(data.temuanMonitoring, 2500);
      if (data.kekuatan !== undefined)
        payload.kekuatan = clampStr(data.kekuatan, 2500);
      if (data.kelemahan !== undefined)
        payload.kelemahan = clampStr(data.kelemahan, 2500);
      if (data.rekomendasi !== undefined)
        payload.rekomendasi = clampStr(data.rekomendasi, 2500);
      if (data.rencanaTindakLanjut !== undefined)
        payload.rencanaTindakLanjut = clampStr(data.rencanaTindakLanjut, 2500);
      if (data.catatanPembinaanPengawas !== undefined)
        payload.catatanPembinaanPengawas = clampStr(
          data.catatanPembinaanPengawas,
          2500
        );

      void (async () => {
        try {
          await updateDoc(doc(db, 'evaluations', id), payload);
          notify('success', 'Data monitoring & evaluasi diperbarui');
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.UPDATE,
            path,
            'Gagal memperbarui data monitoring'
          );
        }
      })();
      return true;
    },
    [firebaseUser, notify, reportFirestoreFailure]
  );

  const deleteEvaluation = useCallback(
    (id: string) => {
      if (!firebaseUser) return;
      const path = `evaluations/${id}`;

      void (async () => {
        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, 'evaluations', id));
          dataset.supervisorNotes
            .filter((n) => n.targetType === 'EVALUASI' && n.targetId === id)
            .forEach((n) => batch.delete(doc(db, 'supervisorNotes', n.id)));
          await batch.commit();
          notify('success', 'Catatan monitoring dihapus');
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.DELETE,
            path,
            'Gagal menghapus catatan monitoring'
          );
        }
      })();
    },
    [dataset.supervisorNotes, firebaseUser, notify, reportFirestoreFailure]
  );

  // --- SUPERVISOR NOTES ---
  const addSupervisorNote = useCallback(
    (data: Omit<SupervisorNote, 'id' | 'createdAt' | 'isDemo'>) => {
      if (!firebaseUser) return false;
      const uid = firebaseUser.uid;
      const id = generateUid('note');
      const path = `supervisorNotes/${id}`;
      const targetId =
        data.targetType === 'SEKOLAH' ? '' : (data.targetId ?? '').trim();

      void (async () => {
        try {
          await setDoc(doc(db, 'supervisorNotes', id), {
            ownerUid: uid,
            id,
            namaSekolah: clampStr(data.namaSekolah, 200),
            targetType: data.targetType,
            targetId,
            tanggal: clampStr(data.tanggal, 30),
            pengawasNama: clampStr(data.pengawasNama, 150),
            catatanPembinaan: clampStr(data.catatanPembinaan, 2500),
            rekomendasi: clampStr(data.rekomendasi, 2500),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          notify('success', 'Catatan pembinaan pengawas tersimpan');
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.CREATE,
            path,
            'Gagal menyimpan catatan pembinaan'
          );
        }
      })();
      return true;
    },
    [firebaseUser, notify, reportFirestoreFailure]
  );

  const deleteSupervisorNote = useCallback(
    (id: string) => {
      if (!firebaseUser) return;
      const path = `supervisorNotes/${id}`;

      void (async () => {
        try {
          await deleteDoc(doc(db, 'supervisorNotes', id));
          notify('success', 'Catatan pembinaan dihapus');
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.DELETE,
            path,
            'Gagal menghapus catatan pembinaan'
          );
        }
      })();
    },
    [firebaseUser, notify, reportFirestoreFailure]
  );

  // --- SCHOOL PROFILE & DATA MANAGEMENT ---
  const updateSchoolProfile = useCallback(
    (profile: SchoolProfile) => {
      if (!firebaseUser) return false;
      const uid = firebaseUser.uid;
      const path = `schoolProfiles/${uid}`;

      void (async () => {
        try {
          const ref = doc(db, 'schoolProfiles', uid);
          const fields = {
            namaSekolah: clampStr(profile.namaSekolah, 200),
            npsn: clampStr(profile.npsn, 40),
            kepalaSekolah: clampStr(profile.kepalaSekolah, 150),
            nipKepalaSekolah: clampStr(profile.nipKepalaSekolah, 50),
            namaPengawas: clampStr(profile.namaPengawas, 150),
            nipPengawas: clampStr(profile.nipPengawas, 50),
            alamatSekolah: clampStr(profile.alamatSekolah, 400),
            tahunAjaran: clampStr(profile.tahunAjaran, 40),
            updatedAt: serverTimestamp(),
          };
          if (schoolProfileExistsRef.current) {
            await updateDoc(ref, fields);
          } else {
            await setDoc(ref, {
              ownerUid: uid,
              ...fields,
              createdAt: serverTimestamp(),
            });
            schoolProfileExistsRef.current = true;
          }
          notify('success', 'Profil sekolah disimpan', profile.namaSekolah);
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.WRITE,
            path,
            'Gagal menyimpan profil sekolah'
          );
        }
      })();
      return true;
    },
    [firebaseUser, notify, reportFirestoreFailure]
  );

  const saveAiAnalysis = useCallback(
    async (
      analysis: PartnershipAiAnalysisResult,
      namaSekolah: string,
      focusPrompt: string
    ): Promise<string | null> => {
      if (!firebaseUser) return null;
      const uid = firebaseUser.uid;
      const id = generateUid('ai');
      const path = `aiAnalyses/${id}`;

      try {
        let detailsJson = JSON.stringify({
          keyStrengths: analysis.keyStrengths ?? [],
          priorityGaps: analysis.priorityGaps ?? [],
          partnershipRecommendations: analysis.partnershipRecommendations ?? [],
          dimensions: analysis.impactAnalysis?.dimensions ?? [],
          supervisorActionPlan: analysis.supervisorActionPlan ?? [],
        });

        if (detailsJson.length > 34500) {
          detailsJson = JSON.stringify({
            keyStrengths: (analysis.keyStrengths ?? []).slice(0, 4),
            priorityGaps: (analysis.priorityGaps ?? []).slice(0, 4),
            partnershipRecommendations: (
              analysis.partnershipRecommendations ?? []
            ).slice(0, 5),
            dimensions: (analysis.impactAnalysis?.dimensions ?? []).slice(0, 4),
            supervisorActionPlan: (analysis.supervisorActionPlan ?? []).slice(
              0,
              4
            ),
          }).slice(0, 34500);
        }

        const validMaturity = ['Rintisan', 'Berkembang', 'Berdaya', 'Unggul'];
        const maturityLevel = validMaturity.includes(analysis.maturityLevel)
          ? analysis.maturityLevel
          : 'Berkembang';

        await setDoc(doc(db, 'aiAnalyses', id), {
          ownerUid: uid,
          id,
          namaSekolah: clampStr(namaSekolah, 200),
          schoolScope: clampStr(
            analysis.schoolScope || namaSekolah || 'Semua Sekolah Binaan',
            250
          ),
          focusPrompt: clampStr(focusPrompt, 500),
          generatedAt: clampStr(
            analysis.generatedAt || new Date().toISOString(),
            40
          ),
          executiveSummary: clampStr(analysis.executiveSummary, 2000),
          maturityScore: Math.min(
            100,
            Math.max(0, Math.round(Number(analysis.maturityScore) || 0))
          ),
          maturityLevel,
          overallImpactIndex: Math.min(
            100,
            Math.max(
              0,
              Math.round(
                Number(analysis.impactAnalysis?.overallImpactIndex) || 0
              )
            )
          ),
          budgetEfficiencyNote: clampStr(
            analysis.impactAnalysis?.budgetEfficiencyNote,
            1200
          ),
          studentOutcomeNarrative: clampStr(
            analysis.impactAnalysis?.studentOutcomeNarrative,
            1200
          ),
          detailsJson,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return id;
      } catch (error) {
        reportFirestoreFailure(
          error,
          OperationType.CREATE,
          path,
          'Gagal menyimpan hasil Analisis AI ke database'
        );
        return null;
      }
    },
    [firebaseUser, reportFirestoreFailure]
  );

  const deleteAiAnalysis = useCallback(
    (id: string) => {
      if (!firebaseUser) return;
      const path = `aiAnalyses/${id}`;
      void (async () => {
        try {
          await deleteDoc(doc(db, 'aiAnalyses', id));
          notify('info', 'Riwayat Analisis AI dihapus');
        } catch (error) {
          reportFirestoreFailure(
            error,
            OperationType.DELETE,
            path,
            'Gagal menghapus riwayat Analisis AI'
          );
        }
      })();
    },
    [firebaseUser, notify, reportFirestoreFailure]
  );

  const resetAllData = useCallback(async () => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;

    try {
      const deleteTargets: Array<{ col: string; id: string }> = [
        ...dataset.aiAnalyses.map((a) => ({ col: 'aiAnalyses', id: a.id })),
        ...dataset.supervisorNotes.map((n) => ({
          col: 'supervisorNotes',
          id: n.id,
        })),
        ...dataset.evaluations.map((e) => ({ col: 'evaluations', id: e.id })),
        ...dataset.evidences.map((e) => ({ col: 'evidences', id: e.id })),
        ...dataset.activities.map((a) => ({ col: 'activities', id: a.id })),
        ...dataset.programs.map((p) => ({ col: 'programs', id: p.id })),
        ...dataset.partners.map((p) => ({
          col: 'partners',
          id: `${uid}__${p.id}`,
        })),
      ];

      for (let i = 0; i < deleteTargets.length; i += 400) {
        const chunk = deleteTargets.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((item) => batch.delete(doc(db, item.col, item.id)));
        await batch.commit();
      }

      if (schoolProfileExistsRef.current) {
        await deleteDoc(doc(db, 'schoolProfiles', uid));
        schoolProfileExistsRef.current = false;
      }

      notify(
        'success',
        'Seluruh data berhasil dikosongkan',
        'Database Firestore Anda siap diisi kembali dengan data kemitraan sekolah.'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'batch-reset');
    }
  }, [dataset, firebaseUser, notify]);

  const importDatasetJson = useCallback(
    async (rawJson: string): Promise<{ ok: boolean; error?: string }> => {
      if (!firebaseUser) {
        return { ok: false, error: 'Anda harus masuk terlebih dahulu.' };
      }
      const uid = firebaseUser.uid;

      try {
        const parsed = JSON.parse(rawJson) as Partial<MitraKitaDataset>;
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          !Array.isArray(parsed.partners)
        ) {
          return {
            ok: false,
            error:
              'Format berkas JSON tidak sesuai dengan struktur data MITRA KITA.',
          };
        }

        const commitOps = async (
          ops: Array<(batch: ReturnType<typeof writeBatch>) => void>
        ) => {
          for (let i = 0; i < ops.length; i += 350) {
            const batch = writeBatch(db);
            ops.slice(i, i + 350).forEach((fn) => fn(batch));
            await batch.commit();
          }
        };

        // Stage 1: School profile, partners, programs
        const stage1: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
        const validProgramIds = new Set<string>(
          dataset.programs.map((p) => p.id)
        );
        const programIdMap = new Map<string, string>();

        if (parsed.schoolProfile) {
          const sp = parsed.schoolProfile;
          stage1.push((batch) => {
            const ref = doc(db, 'schoolProfiles', uid);
            const fields = {
              namaSekolah: clampStr(sp.namaSekolah, 200),
              npsn: clampStr(sp.npsn, 40),
              kepalaSekolah: clampStr(sp.kepalaSekolah, 150),
              nipKepalaSekolah: clampStr(sp.nipKepalaSekolah, 50),
              namaPengawas: clampStr(sp.namaPengawas, 150),
              nipPengawas: clampStr(sp.nipPengawas, 50),
              alamatSekolah: clampStr(sp.alamatSekolah, 400),
              tahunAjaran: clampStr(sp.tahunAjaran || '2026/2027', 40),
              updatedAt: serverTimestamp(),
            };
            if (schoolProfileExistsRef.current) {
              batch.update(ref, fields);
            } else {
              batch.set(ref, {
                ownerUid: uid,
                ...fields,
                createdAt: serverTimestamp(),
              });
            }
          });
        }

        const existingPartnerIds = new Set(
          dataset.partners.map((p) => p.id)
        );
        for (const p of (parsed.partners ?? []).filter((x) => !x.isDemo)) {
          const cleanId = sanitizeId(p.id || '', 'MTR');
          const partnerDocId = `${uid}__${cleanId}`;
          const commonFields = {
            namaSekolah: clampStr(p.namaSekolah || 'Sekolah Binaan', 200),
            nama: clampStr(p.nama || 'Mitra', 200),
            kategori: p.kategori || 'Lainnya',
            penanggungJawab: clampStr(p.penanggungJawab || '-', 150),
            telepon: clampStr(p.telepon, 40),
            alamat: clampStr(p.alamat, 400),
            jenisKontribusi: clampStr(p.jenisKontribusi, 500),
            potensiKerjaSama: clampStr(p.potensiKerjaSama, 500),
            status: p.status || 'Aktif',
            catatan: clampStr(p.catatan, 1500),
            updatedAt: serverTimestamp(),
          };
          const alreadyExists = existingPartnerIds.has(cleanId);
          existingPartnerIds.add(cleanId);
          stage1.push((batch) => {
            const ref = doc(db, 'partners', partnerDocId);
            if (alreadyExists) {
              batch.update(ref, commonFields);
            } else {
              batch.set(ref, {
                ownerUid: uid,
                id: cleanId,
                ...commonFields,
                createdAt: serverTimestamp(),
              });
            }
          });
        }

        for (const prg of (parsed.programs ?? []).filter((x) => !x.isDemo)) {
          const newId = generateUid('prg');
          if (prg.id) programIdMap.set(prg.id, newId);
          validProgramIds.add(newId);
          stage1.push((batch) => {
            batch.set(doc(db, 'programs', newId), {
              ownerUid: uid,
              id: newId,
              namaSekolah: clampStr(prg.namaSekolah || 'Sekolah Binaan', 200),
              kodeProgram: clampStr(prg.kodeProgram || 'PRG-IMP', 40),
              namaProgram: clampStr(prg.namaProgram || 'Program Kemitraan', 200),
              latarBelakang: clampStr(prg.latarBelakang, 2000),
              tujuan: clampStr(prg.tujuan, 2000),
              areaPm: prg.areaPm || 'Kemitraan Pembelajaran',
              partnerIds: Array.isArray(prg.partnerIds)
                ? prg.partnerIds.slice(0, 50).map(String)
                : [],
              sasaran: clampStr(prg.sasaran, 400),
              bentukKontribusi: clampStr(prg.bentukKontribusi, 1000),
              strategiPelaksanaan: clampStr(prg.strategiPelaksanaan, 2000),
              waktuPelaksanaan: clampStr(prg.waktuPelaksanaan, 120),
              penanggungJawab: clampStr(prg.penanggungJawab, 150),
              sumberPembiayaan: clampStr(prg.sumberPembiayaan, 200),
              anggaranRencana: Math.max(
                0,
                Math.min(1000000000000, Number(prg.anggaranRencana) || 0)
              ),
              indikatorKeberhasilan: clampStr(prg.indikatorKeberhasilan, 1500),
              targetHasil: clampStr(prg.targetHasil, 1500),
              status: prg.status || 'Direncanakan',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
        }
        await commitOps(stage1);
        if (parsed.schoolProfile) schoolProfileExistsRef.current = true;

        // Stage 2: Activities & Evaluations
        const stage2: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
        const activityIdMap = new Map<string, string>();
        const evalIdMap = new Map<string, string>();

        for (const act of (parsed.activities ?? []).filter((x) => !x.isDemo)) {
          const mappedProgId = programIdMap.get(act.programId) ?? act.programId;
          if (!validProgramIds.has(mappedProgId)) continue;
          const newId = generateUid('act');
          if (act.id) activityIdMap.set(act.id, newId);
          stage2.push((batch) => {
            batch.set(doc(db, 'activities', newId), {
              ownerUid: uid,
              id: newId,
              namaSekolah: clampStr(act.namaSekolah || 'Sekolah Binaan', 200),
              namaKegiatan: clampStr(act.namaKegiatan || 'Kegiatan', 200),
              programId: mappedProgId,
              tanggalPelaksanaan: clampStr(
                act.tanggalPelaksanaan || new Date().toISOString().slice(0, 10),
                30
              ),
              lokasi: clampStr(act.lokasi, 300),
              partnerIds: Array.isArray(act.partnerIds)
                ? act.partnerIds.slice(0, 50).map(String)
                : [],
              penanggungJawab: clampStr(act.penanggungJawab, 150),
              jumlahPeserta: Math.max(
                0,
                Math.min(1000000, Math.round(Number(act.jumlahPeserta) || 0))
              ),
              deskripsiPelaksanaan: clampStr(act.deskripsiPelaksanaan, 2500),
              hasilKegiatan: clampStr(act.hasilKegiatan, 2500),
              kendala: clampStr(act.kendala, 2000),
              status: act.status || 'Terjadwal',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
        }

        for (const ev of (parsed.evaluations ?? []).filter((x) => !x.isDemo)) {
          const newId = generateUid('eval');
          if (ev.id) evalIdMap.set(ev.id, newId);
          const rawProg = ev.programId
            ? programIdMap.get(ev.programId) ?? ev.programId
            : '';
          const finalProg = validProgramIds.has(rawProg) ? rawProg : '';
          const cleanScores = normalizeScores(ev.scores || {});
          const computed = computeMonitoringResult(cleanScores);
          stage2.push((batch) => {
            batch.set(doc(db, 'evaluations', newId), {
              ownerUid: uid,
              id: newId,
              namaSekolah: clampStr(ev.namaSekolah || 'Sekolah Binaan', 200),
              periode: clampStr(ev.periode || 'Periode Impor', 120),
              tanggalPenilaian: clampStr(
                ev.tanggalPenilaian || new Date().toISOString().slice(0, 10),
                30
              ),
              penilai: clampStr(
                ev.penilai || session?.namaPengawas || 'Pengawas Sekolah',
                150
              ),
              peranPenilai: 'PENGAWAS',
              programId: finalProg,
              scores: cleanScores,
              totalSkorPerolehan: computed.totalSkorPerolehan,
              totalSkorMaksimal: 40,
              nilaiAkhir: computed.nilaiAkhir,
              kategoriHasil: computed.kategoriHasil,
              temuanMonitoring: clampStr(ev.temuanMonitoring, 2500),
              kekuatan: clampStr(ev.kekuatan, 2500),
              kelemahan: clampStr(ev.kelemahan, 2500),
              rekomendasi: clampStr(ev.rekomendasi, 2500),
              rencanaTindakLanjut: clampStr(ev.rencanaTindakLanjut, 2500),
              catatanPembinaanPengawas: clampStr(
                ev.catatanPembinaanPengawas,
                2500
              ),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
        }
        await commitOps(stage2);

        // Stage 3: Evidences & Supervisor Notes
        const stage3: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

        for (const evd of (parsed.evidences ?? []).filter((x) => !x.isDemo)) {
          const mappedProgId = programIdMap.get(evd.programId) ?? evd.programId;
          if (!validProgramIds.has(mappedProgId)) continue;
          const mappedActId = evd.activityId
            ? activityIdMap.get(evd.activityId) ?? ''
            : '';
          const safeFileUrl =
            typeof evd.fileUrl === 'string' && evd.fileUrl.length <= 700000
              ? evd.fileUrl
              : '';
          const newId = generateUid('evd');
          stage3.push((batch) => {
            batch.set(doc(db, 'evidences', newId), {
              ownerUid: uid,
              id: newId,
              namaSekolah: clampStr(evd.namaSekolah || 'Sekolah Binaan', 200),
              namaDokumen: clampStr(evd.namaDokumen || 'Dokumen', 200),
              jenis: evd.jenis || 'Dokumen Pendukung Lainnya',
              programId: mappedProgId,
              activityId: mappedActId,
              tanggalUnggah: clampStr(
                evd.tanggalUnggah || new Date().toISOString().slice(0, 10),
                30
              ),
              keterangan: clampStr(evd.keterangan, 2000),
              fileUrl: safeFileUrl,
              fileName: clampStr(evd.fileName, 255),
              fileMimeType: clampStr(evd.fileMimeType, 120),
              fileSize: Math.max(
                0,
                Math.min(50000000, Math.round(Number(evd.fileSize) || 0))
              ),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
        }

        for (const note of (parsed.supervisorNotes ?? []).filter(
          (x) => !x.isDemo
        )) {
          let targetType = note.targetType || 'SEKOLAH';
          let targetId = '';
          if (targetType === 'PROGRAM') {
            const mapped = note.targetId
              ? programIdMap.get(note.targetId) ?? note.targetId
              : '';
            if (validProgramIds.has(mapped)) {
              targetId = mapped;
            } else {
              targetType = 'SEKOLAH';
            }
          } else if (targetType === 'EVALUASI') {
            const mapped = note.targetId
              ? evalIdMap.get(note.targetId) ?? ''
              : '';
            if (mapped) {
              targetId = mapped;
            } else {
              targetType = 'SEKOLAH';
            }
          }

          const newId = generateUid('note');
          stage3.push((batch) => {
            batch.set(doc(db, 'supervisorNotes', newId), {
              ownerUid: uid,
              id: newId,
              namaSekolah: clampStr(note.namaSekolah || 'Sekolah Binaan', 200),
              targetType,
              targetId,
              tanggal: clampStr(
                note.tanggal || new Date().toISOString().slice(0, 10),
                30
              ),
              pengawasNama: clampStr(
                note.pengawasNama || session?.namaPengawas || 'Pengawas Sekolah',
                150
              ),
              catatanPembinaan: clampStr(
                note.catatanPembinaan || 'Catatan pembinaan',
                2500
              ),
              rekomendasi: clampStr(note.rekomendasi, 2500),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
        }
        await commitOps(stage3);

        notify(
          'success',
          'Data berhasil dipulihkan ke Firebase Firestore',
          'Seluruh data cadangan telah disinkronkan.'
        );
        return { ok: true };
      } catch (error) {
        if (isPermissionError(error)) {
          reportFirestoreFailure(
            error,
            OperationType.WRITE,
            'batch-import',
            'Gagal memulihkan data'
          );
        }
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Berkas JSON tidak valid atau rusak.',
        };
      }
    },
    [
      dataset.partners,
      dataset.programs,
      firebaseUser,
      notify,
      reportFirestoreFailure,
      session?.namaPengawas,
    ]
  );

  const importArkasBundle = useCallback(
    async (
      bundle: ArkasImportBundleInput
    ): Promise<{
      ok: boolean;
      partnersCreated: number;
      programsCreated: number;
      activitiesCreated: number;
      error?: string;
    }> => {
      if (!firebaseUser) {
        return {
          ok: false,
          partnersCreated: 0,
          programsCreated: 0,
          activitiesCreated: 0,
          error: 'Sesi pengguna tidak aktif. Silakan masuk kembali.',
        };
      }

      const uid = firebaseUser.uid;
      const cleanSchoolName =
        clampStr(bundle.schoolInfo.namaSekolah, 200) ||
        clampStr(dataset.schoolProfile.namaSekolah, 200) ||
        'Sekolah Binaan';

      const selectedPrograms = bundle.programs.filter((p) => p.selected);
      const selectedPartners = bundle.partners.filter((p) => p.selected);

      if (selectedPrograms.length === 0 && selectedPartners.length === 0) {
        return {
          ok: false,
          partnersCreated: 0,
          programsCreated: 0,
          activitiesCreated: 0,
          error: 'Pilih minimal satu program kemitraan atau mitra untuk disimpan.',
        };
      }

      try {
        // Map suggested partner tempKey -> real partnerId (either matched existing or newly created)
        const existingPartnerIdSet = new Set(dataset.partners.map((p) => p.id));
        const usedPartnerIds = [...dataset.partners.map((p) => p.id)];
        const tempKeyToPartnerId = new Map<string, string>();
        const partnersToCreate: Array<{
          partnerId: string;
          docId: string;
          payload: Record<string, unknown>;
        }> = [];

        for (const sp of selectedPartners) {
          if (sp.existingPartnerId && existingPartnerIdSet.has(sp.existingPartnerId)) {
            tempKeyToPartnerId.set(sp.tempKey, sp.existingPartnerId);
            continue;
          }
          const nextId = generateNextId('MTR', usedPartnerIds);
          usedPartnerIds.push(nextId);
          tempKeyToPartnerId.set(sp.tempKey, nextId);
          partnersToCreate.push({
            partnerId: nextId,
            docId: `${uid}__${nextId}`,
            payload: {
              ownerUid: uid,
              id: nextId,
              namaSekolah: cleanSchoolName,
              nama: clampStr(sp.nama, 200) || `Mitra ${nextId}`,
              kategori: sp.kategori,
              penanggungJawab:
                clampStr(sp.penanggungJawab, 150) ||
                clampStr(bundle.schoolInfo.kepalaSekolah, 150) ||
                'Koordinator Kemitraan',
              telepon: clampStr(sp.telepon, 40),
              alamat:
                clampStr(sp.alamat, 400) ||
                clampStr(bundle.schoolInfo.alamatSekolah, 400),
              jenisKontribusi: clampStr(sp.jenisKontribusi, 500),
              potensiKerjaSama: clampStr(sp.potensiKerjaSama, 500),
              status: sp.status,
              catatan: clampStr(sp.catatan, 1500),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          });
        }

        // Prepare Programs & Activities payloads
        const programsToCreate: Array<{
          id: string;
          payload: Record<string, unknown>;
        }> = [];
        const activitiesToCreate: Array<{
          id: string;
          payload: Record<string, unknown>;
        }> = [];

        const fallbackYearMatch = (bundle.schoolInfo.tahunAnggaran || '').match(/\d{4}/);
        const fallbackYear = fallbackYearMatch
          ? fallbackYearMatch[0]
          : String(new Date().getFullYear());

        for (let idx = 0; idx < selectedPrograms.length; idx += 1) {
          const prg = selectedPrograms[idx];
          const programId = generateUid('prg');

          const resolvedPartnerIds = Array.from(
            new Set([
              ...prg.existingPartnerIds.filter((id) =>
                existingPartnerIdSet.has(id)
              ),
              ...prg.suggestedPartnerKeys
                .map((k) => tempKeyToPartnerId.get(k))
                .filter((id): id is string => Boolean(id)),
            ])
          ).slice(0, 50);

          programsToCreate.push({
            id: programId,
            payload: {
              ownerUid: uid,
              id: programId,
              namaSekolah: cleanSchoolName,
              kodeProgram:
                clampStr(prg.kodeProgram, 40) ||
                `RKAS-${fallbackYear}-${String(idx + 1).padStart(2, '0')}`,
              namaProgram:
                clampStr(prg.namaProgram, 200) ||
                `Program Kemitraan ARKAS ${idx + 1}`,
              latarBelakang: clampStr(prg.latarBelakang, 2000),
              tujuan: clampStr(prg.tujuan, 2000),
              areaPm: prg.areaPm,
              partnerIds: resolvedPartnerIds,
              sasaran: clampStr(prg.sasaran, 400),
              bentukKontribusi: clampStr(prg.bentukKontribusi, 1000),
              strategiPelaksanaan: clampStr(prg.strategiPelaksanaan, 2000),
              waktuPelaksanaan:
                clampStr(prg.waktuPelaksanaan, 120) ||
                `Tahun Anggaran ${fallbackYear}`,
              penanggungJawab:
                clampStr(prg.penanggungJawab, 150) ||
                clampStr(bundle.schoolInfo.kepalaSekolah, 150) ||
                'Kepala Sekolah',
              sumberPembiayaan:
                clampStr(prg.sumberPembiayaan, 200) ||
                clampStr(bundle.schoolInfo.sumberDana, 200) ||
                'BOSP Reguler',
              anggaranRencana: Math.max(
                0,
                Math.min(1000000000000, Number(prg.anggaranRencana) || 0)
              ),
              indikatorKeberhasilan: clampStr(prg.indikatorKeberhasilan, 1500),
              targetHasil: clampStr(prg.targetHasil, 1500),
              status: prg.status,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          });

          const selectedActs = prg.activities.filter((a) => a.selected);
          for (let aIdx = 0; aIdx < selectedActs.length; aIdx += 1) {
            const act = selectedActs[aIdx];
            const activityId = generateUid('act');
            const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(
              act.tanggalPelaksanaan.trim()
            )
              ? act.tanggalPelaksanaan.trim()
              : `${fallbackYear}-07-15`;

            activitiesToCreate.push({
              id: activityId,
              payload: {
                ownerUid: uid,
                id: activityId,
                namaSekolah: cleanSchoolName,
                namaKegiatan:
                  clampStr(act.namaKegiatan, 200) || `Kegiatan ${aIdx + 1}`,
                programId,
                tanggalPelaksanaan: clampStr(cleanDate, 30),
                lokasi: clampStr(act.lokasi, 300) || cleanSchoolName,
                partnerIds: resolvedPartnerIds,
                penanggungJawab:
                  clampStr(act.penanggungJawab, 150) ||
                  clampStr(prg.penanggungJawab, 150) ||
                  'Tim Pelaksana Sekolah',
                jumlahPeserta: Math.max(
                  0,
                  Math.min(
                    1000000,
                    Math.round(Number(act.jumlahPeserta) || 0)
                  )
                ),
                deskripsiPelaksanaan: clampStr(act.deskripsiPelaksanaan, 2500),
                hasilKegiatan: clampStr(act.hasilKegiatan, 2500),
                kendala: clampStr(act.kendala, 2000),
                status: act.status,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
            });
          }
        }

        // Phase 1: Commit Partners & Programs FIRST so firestore.rules ownsProgram(programId) succeeds
        const phase1Ops: Array<() => { ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [
          ...partnersToCreate.map((p) => () => ({
            ref: doc(db, 'partners', p.docId),
            data: p.payload,
          })),
          ...programsToCreate.map((p) => () => ({
            ref: doc(db, 'programs', p.id),
            data: p.payload,
          })),
        ];

        for (let i = 0; i < phase1Ops.length; i += 400) {
          const chunk = phase1Ops.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((makeOp) => {
            const { ref, data } = makeOp();
            batch.set(ref, data);
          });
          await batch.commit();
        }

        // Phase 2: Commit Activities referencing the committed Programs
        for (let i = 0; i < activitiesToCreate.length; i += 400) {
          const chunk = activitiesToCreate.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((act) => {
            batch.set(doc(db, 'activities', act.id), act.payload);
          });
          await batch.commit();
        }

        // Optional Phase 3: Update School Profile with extracted ARKAS school header
        if (bundle.updateSchoolProfile) {
          const currentProfile = dataset.schoolProfile;
          const nextProfile: SchoolProfile = {
            namaSekolah: cleanSchoolName,
            npsn: clampStr(bundle.schoolInfo.npsn, 40) || currentProfile.npsn,
            kepalaSekolah:
              clampStr(bundle.schoolInfo.kepalaSekolah, 150) ||
              currentProfile.kepalaSekolah,
            nipKepalaSekolah: currentProfile.nipKepalaSekolah || '',
            namaPengawas:
              currentProfile.namaPengawas ||
              session?.namaPengawas ||
              '',
            nipPengawas:
              currentProfile.nipPengawas ||
              session?.nip ||
              '',
            alamatSekolah:
              clampStr(bundle.schoolInfo.alamatSekolah, 400) ||
              currentProfile.alamatSekolah,
            tahunAjaran:
              clampStr(bundle.schoolInfo.tahunAnggaran, 40) ||
              currentProfile.tahunAjaran,
          };
          updateSchoolProfile(nextProfile);
        }

        notify(
          'success',
          'Impor ARKAS berhasil disimpan',
          `${partnersToCreate.length} mitra baru, ${programsToCreate.length} program kemitraan, dan ${activitiesToCreate.length} kegiatan telah ditambahkan ke database.`
        );

        return {
          ok: true,
          partnersCreated: partnersToCreate.length,
          programsCreated: programsToCreate.length,
          activitiesCreated: activitiesToCreate.length,
        };
      } catch (error) {
        reportFirestoreFailure(
          error,
          OperationType.CREATE,
          'programs',
          'Gagal menyimpan hasil impor ARKAS'
        );
        return {
          ok: false,
          partnersCreated: 0,
          programsCreated: 0,
          activitiesCreated: 0,
          error:
            error instanceof Error
              ? error.message
              : 'Terjadi kesalahan saat menyimpan data ARKAS ke Firestore.',
        };
      }
    },
    [
      dataset.partners,
      dataset.schoolProfile,
      firebaseUser,
      notify,
      reportFirestoreFailure,
      session?.namaPengawas,
      updateSchoolProfile,
    ]
  );

  // Surface permission errors to ErrorBoundary
  if (fatalError) {
    throw fatalError;
  }

  const needsEmailVerification = Boolean(firebaseUser && !isEmailVerified);
  const unverifiedEmail = needsEmailVerification
    ? firebaseUser?.email ?? null
    : null;

  const value = useMemo<MitraKitaContextValue>(
    () => ({
      dataset,
      session,
      authReady,
      authLoading,
      dataLoading,
      needsEmailVerification,
      unverifiedEmail,
      role: 'PENGAWAS',
      isAdmin: true,
      isPengawas: true,
      loginWithGoogle,
      loginWithEmailPassword,
      sendResetPassword,
      resendVerificationEmail,
      refreshEmailVerification,
      updateSupervisorProfile,
      logoutPengawas,
      schoolNameSuggestions,
      toasts,
      dismissToast,
      notify,
      addPartner,
      updatePartner,
      deletePartner,
      getNextPartnerId,
      syncPartnerProgramLinks,
      addProgram,
      updateProgram,
      deleteProgram,
      getNextProgramCode,
      addActivity,
      updateActivity,
      markActivityComplete,
      deleteActivity,
      addEvidence,
      updateEvidence,
      deleteEvidence,
      addEvaluation,
      updateEvaluation,
      deleteEvaluation,
      addSupervisorNote,
      deleteSupervisorNote,
      saveAiAnalysis,
      deleteAiAnalysis,
      updateSchoolProfile,
      resetAllData,
      importDatasetJson,
      importArkasBundle,
    }),
    [
      dataset,
      session,
      authReady,
      authLoading,
      dataLoading,
      needsEmailVerification,
      unverifiedEmail,
      loginWithGoogle,
      loginWithEmailPassword,
      sendResetPassword,
      resendVerificationEmail,
      refreshEmailVerification,
      updateSupervisorProfile,
      logoutPengawas,
      schoolNameSuggestions,
      toasts,
      dismissToast,
      notify,
      addPartner,
      updatePartner,
      deletePartner,
      getNextPartnerId,
      syncPartnerProgramLinks,
      addProgram,
      updateProgram,
      deleteProgram,
      getNextProgramCode,
      addActivity,
      updateActivity,
      markActivityComplete,
      deleteActivity,
      addEvidence,
      updateEvidence,
      deleteEvidence,
      addEvaluation,
      updateEvaluation,
      deleteEvaluation,
      addSupervisorNote,
      deleteSupervisorNote,
      saveAiAnalysis,
      deleteAiAnalysis,
      updateSchoolProfile,
      resetAllData,
      importDatasetJson,
      importArkasBundle,
    ]
  );

  return (
    <MitraKitaContext.Provider value={value}>
      {children}
    </MitraKitaContext.Provider>
  );
};

export function useMitraKita(): MitraKitaContextValue {
  const ctx = useContext(MitraKitaContext);
  if (!ctx) {
    throw new Error('useMitraKita must be used within MitraKitaProvider');
  }
  return ctx;
}
