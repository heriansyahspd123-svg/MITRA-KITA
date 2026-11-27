import { PartnerCategory, PmLeadershipArea } from './mitraKita';

export interface AiPartnershipRecommendation {
  judul: string;
  kategoriMitra: PartnerCategory;
  calonMitra: string;
  areaPm: PmLeadershipArea;
  prioritas: 'Tinggi' | 'Sedang' | 'Strategis';
  alasanStrategis: string;
  bentukKolaborasi: string;
  estimasiDampak: string;
}

export interface AiImpactDimension {
  dimensi: string;
  skor: number; // 0 - 100
  status: 'Tinggi' | 'Moderat' | 'Perlu Penguatan';
  analisis: string;
  buktiPendukung: string;
  saranPeningkatan: string;
}

export interface AiSupervisorActionItem {
  langkah: string;
  targetWaktu: string;
  pihakTerlibat: string;
  indikatorKeberhasilan: string;
}

export interface PartnershipAiAnalysisResult {
  generatedAt: string;
  schoolScope: string;
  executiveSummary: string;
  maturityScore: number; // 0 - 100
  maturityLevel: 'Rintisan' | 'Berkembang' | 'Berdaya' | 'Unggul';
  keyStrengths: string[];
  priorityGaps: string[];
  partnershipRecommendations: AiPartnershipRecommendation[];
  impactAnalysis: {
    overallImpactIndex: number; // 0 - 100
    dimensions: AiImpactDimension[];
    budgetEfficiencyNote: string;
    studentOutcomeNarrative: string;
  };
  supervisorActionPlan: AiSupervisorActionItem[];
}

export interface SavedAiAnalysis extends PartnershipAiAnalysisResult {
  id: string;
  namaSekolah: string; // '' means all schools
  focusPrompt: string;
  createdAt: string;
}
