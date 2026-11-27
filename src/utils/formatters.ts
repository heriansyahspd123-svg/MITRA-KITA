import {
  MONITORING_INDICATORS,
  MonitoringCategory,
  PM_LEADERSHIP_AREAS,
  PmLeadershipArea,
} from '../types/mitraKita';

export function formatCurrencyIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDateID(isoDate: string): string {
  if (!isoDate) return '-';
  const parsed = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getPmAreaCode(area: PmLeadershipArea): string {
  const found = PM_LEADERSHIP_AREAS.find((item) => item.label === area);
  return found ? `${found.code}. ${found.label}` : area;
}

export function computeMonitoringResult(scores: Record<string, number>): {
  totalSkorPerolehan: number;
  totalSkorMaksimal: number;
  nilaiAkhir: number;
  kategoriHasil: MonitoringCategory;
  answeredCount: number;
} {
  const totalSkorMaksimal = MONITORING_INDICATORS.length * 4;
  let totalSkorPerolehan = 0;
  let answeredCount = 0;

  for (const ind of MONITORING_INDICATORS) {
    const val = scores[ind.id];
    if (typeof val === 'number' && val >= 1 && val <= 4) {
      totalSkorPerolehan += val;
      answeredCount += 1;
    }
  }

  const rawScore =
    totalSkorMaksimal > 0 ? (totalSkorPerolehan / totalSkorMaksimal) * 100 : 0;
  const nilaiAkhir = Math.round(rawScore * 10) / 10;

  let kategoriHasil: MonitoringCategory;
  if (nilaiAkhir >= 86) {
    kategoriHasil = 'Sangat Baik';
  } else if (nilaiAkhir >= 76) {
    kategoriHasil = 'Baik';
  } else if (nilaiAkhir >= 60) {
    kategoriHasil = 'Cukup';
  } else {
    kategoriHasil = 'Perlu Pembinaan Intensif';
  }

  return {
    totalSkorPerolehan,
    totalSkorMaksimal,
    nilaiAkhir,
    kategoriHasil,
    answeredCount,
  };
}

export function generateNextId(prefix: string, existingIds: string[]): string {
  const nums = existingIds
    .map((id) => {
      const match = id.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => Number.isFinite(n));
  const nextNum = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(nextNum).padStart(3, '0')}`;
}

export function generateUid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getStatusTextClass(status: string): string {
  switch (status) {
    case 'Selesai':
    case 'Aktif':
    case 'Sangat Baik':
      return 'text-[#15803D] font-semibold';
    case 'Sedang Berjalan':
    case 'Sedang Berlangsung':
    case 'Baik':
      return 'text-[#0F766E] font-semibold';
    case 'Direncanakan':
    case 'Terjadwal':
    case 'Dalam Penjajakan':
    case 'Cukup':
      return 'text-[#B45309] font-semibold';
    case 'Ditunda':
    case 'Tertunda':
    case 'Dibatalkan':
    case 'Tidak Aktif':
    case 'Perlu Pembinaan Intensif':
      return 'text-[#B91C1C] font-semibold';
    default:
      return 'text-[#475569] font-medium';
  }
}

export function escapeCsvCell(value: string | number | undefined | null): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsvFile(filename: string, rows: (string | number)[][]): void {
  const csvContent =
    '\uFEFF' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
