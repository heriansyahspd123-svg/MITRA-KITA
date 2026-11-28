import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { SavedAiAnalysis } from '../types/aiAnalysis';
import {
  EvidenceItem,
  MonitoringEvaluation,
  Partner,
  PartnershipActivity,
  PartnershipProgram,
  SchoolProfile,
  SupervisorNote,
} from '../types/mitraKita';
import {
  formatCurrencyIDR,
  formatDateID,
  getPmAreaCode,
  getTodayISO,
} from './formatters';

export interface ReportExportPayload {
  schoolProfile: SchoolProfile;
  schoolFilter: string;
  startDate: string;
  endDate: string;
  printedDate?: string;
  periodLabel?: string;
  printCity?: string;
  partnerCategoryFilter: string;
  pmAreaFilter: string;
  partners: Partner[];
  programs: PartnershipProgram[];
  activities: PartnershipActivity[];
  evidences: EvidenceItem[];
  evaluations: MonitoringEvaluation[];
  supervisorNotes: SupervisorNote[];
  aiAnalysis?: SavedAiAnalysis | null;
  partnerMap: Map<string, { nama: string; kategori: string }>;
  programNameMap: Map<string, string>;
  totalBudget: number;
  totalParticipants: number;
}

const COPYRIGHT_TEXT = `© ${new Date().getFullYear()} MITRA KITA · Hak Cipta HERIANSYAH. S.Si., S.Pd., M.Pd`;

function sanitizeFilenameSegment(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function getEffectivePrintedDateIso(payload: ReportExportPayload): string {
  return (payload.printedDate || '').trim() || getTodayISO();
}

function getSignatureDateText(payload: ReportExportPayload): string {
  const dateLabel = formatDateID(getEffectivePrintedDateIso(payload));
  const city = (payload.printCity || '').trim();
  return city ? `${city}, ${dateLabel}` : dateLabel;
}

function buildReportFilename(payload: ReportExportPayload, ext: 'pdf' | 'docx'): string {
  const datePart = getEffectivePrintedDateIso(payload);
  const schoolSlug =
    payload.schoolFilter !== 'ALL'
      ? `_${sanitizeFilenameSegment(payload.schoolFilter)}`
      : '';
  return `Laporan_Kemitraan_MITRA_KITA${schoolSlug}_${datePart}.${ext}`;
}

function getPeriodText(payload: ReportExportPayload): string {
  const custom = (payload.periodLabel || '').trim();
  if (custom) return custom;
  if (!payload.startDate && !payload.endDate) return 'Semua Periode';
  const startLabel = payload.startDate ? formatDateID(payload.startDate) : 'Awal';
  const endLabel = payload.endDate ? formatDateID(payload.endDate) : 'Sekarang';
  return `${startLabel} – ${endLabel}`;
}

function getHeaderSchoolTitle(payload: ReportExportPayload): string {
  return payload.schoolFilter !== 'ALL'
    ? payload.schoolFilter
    : payload.schoolProfile.namaSekolah || 'Semua Sekolah Binaan';
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================================================================
 * 1. PDF EXPORTER (jsPDF + jspdf-autotable)
 * ========================================================================== */

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

export function exportReportToPdf(payload: ReportExportPayload): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as JsPdfWithAutoTable;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  const forestRgb: [number, number, number] = [20, 83, 45]; // #14532D
  const softTintRgb: [number, number, number] = [243, 248, 245];
  const inkRgb: [number, number, number] = [17, 34, 26];
  const mutedRgb: [number, number, number] = [91, 111, 101];
  const borderRgb: [number, number, number] = [214, 224, 218];

  let cursorY = 14;

  const ensureSpace = (neededMm: number) => {
    if (cursorY + neededMm > pageHeight - 20) {
      doc.addPage();
      cursorY = 16;
    }
  };

  // --- Kop Laporan / Institutional Letterhead ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...forestRgb);
  doc.text('LAPORAN PENGELOLAAN KEMITRAAN SEKOLAH · MITRA KITA', marginX, cursorY);

  cursorY += 5.5;
  doc.setFontSize(14);
  doc.setTextColor(...inkRgb);
  const schoolTitleLines = doc.splitTextToSize(
    getHeaderSchoolTitle(payload),
    contentWidth * 0.65
  );
  doc.text(schoolTitleLines, marginX, cursorY);

  // Right metadata block
  const rightX = pageWidth - marginX;
  const printedDateLabel = formatDateID(getEffectivePrintedDateIso(payload));
  const periodText = getPeriodText(payload);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedRgb);
  doc.text(
    `Tahun Ajaran: ${payload.schoolProfile.tahunAjaran || '-'}`,
    rightX,
    14,
    { align: 'right' }
  );
  doc.text(`Dicetak: ${printedDateLabel}`, rightX, 18.5, {
    align: 'right',
  });
  doc.text(`Periode: ${periodText}`, rightX, 23, { align: 'right' });

  cursorY += Math.max(schoolTitleLines.length * 5.2, 5.2) + 1;
  const addressParts = [
    (payload.schoolProfile.alamatSekolah || '').trim(),
    payload.schoolProfile.npsn ? `NPSN: ${payload.schoolProfile.npsn}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  if (addressParts) {
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedRgb);
    const addressLines = doc.splitTextToSize(addressParts, contentWidth * 0.62);
    doc.text(addressLines, marginX, cursorY);
    cursorY += addressLines.length * 4 + 3;
  } else {
    cursorY = Math.max(cursorY + 3, 27);
  }
  cursorY = Math.max(cursorY, 27);

  // Green bottom divider line
  doc.setDrawColor(...forestRgb);
  doc.setLineWidth(0.7);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  cursorY += 5;

  // Active filter line if any
  const activeFilters: string[] = [];
  if (payload.partnerCategoryFilter !== 'ALL') {
    activeFilters.push(`Kategori Mitra: ${payload.partnerCategoryFilter}`);
  }
  if (payload.pmAreaFilter !== 'ALL') {
    activeFilters.push(`Area PM: ${payload.pmAreaFilter}`);
  }
  if (activeFilters.length > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...mutedRgb);
    doc.text(`Filter Aktif: ${activeFilters.join(' · ')}`, marginX, cursorY);
    cursorY += 5;
  }

  // --- Executive Summary Metric Strip ---
  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 3,
      lineColor: borderRgb,
      lineWidth: 0.2,
      textColor: inkRgb,
    },
    headStyles: {
      fillColor: softTintRgb,
      textColor: mutedRgb,
      fontStyle: 'normal',
      fontSize: 8,
    },
    bodyStyles: {
      fontStyle: 'bold',
      fontSize: 10.5,
    },
    head: [
      [
        'Total Mitra',
        'Program Kemitraan',
        'Realisasi Kegiatan',
        'Bukti & Monitoring',
      ],
    ],
    body: [
      [
        `${payload.partners.length} Mitra`,
        `${payload.programs.length} Program\n(${formatCurrencyIDR(payload.totalBudget)})`,
        `${payload.activities.length} Kegiatan\n(${payload.totalParticipants} peserta)`,
        `${payload.evidences.length} Dokumen\n${payload.evaluations.length} Evaluasi`,
      ],
    ],
  });
  cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 7;

  const addSectionHeading = (title: string) => {
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...forestRgb);
    doc.text(title, marginX, cursorY);
    cursorY += 4;
  };

  const addEmptyNote = (text: string) => {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedRgb);
    doc.text(text, marginX, cursorY + 1);
    cursorY += 8;
  };

  const baseTableOptions = {
    margin: { left: marginX, right: marginX, bottom: 18 },
    theme: 'grid' as const,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.3,
      lineColor: borderRgb,
      lineWidth: 0.2,
      textColor: inkRgb,
      valign: 'top' as const,
      overflow: 'linebreak' as const,
    },
    headStyles: {
      fillColor: forestRgb,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold' as const,
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: softTintRgb,
    },
  };

  // --- 1. Data Mitra Sekolah ---
  addSectionHeading(`1. Data Mitra Sekolah (${payload.partners.length})`);
  if (payload.partners.length === 0) {
    addEmptyNote('Tidak ada data mitra pada filter aktif.');
  } else {
    autoTable(doc, {
      ...baseTableOptions,
      startY: cursorY,
      head: [['ID', 'Nama Mitra / Lembaga', 'Kategori', 'Penanggung Jawab', 'Kontribusi', 'Status']],
      body: payload.partners.map((p) => [
        p.id,
        p.namaSekolah ? `${p.nama}\n(${p.namaSekolah})` : p.nama,
        p.kategori,
        p.penanggungJawab || '-',
        p.jenisKontribusi || '-',
        p.status,
      ]),
      columnStyles: {
        0: { cellWidth: 18, fontStyle: 'bold' },
        1: { cellWidth: 42 },
        2: { cellWidth: 28 },
        3: { cellWidth: 30 },
        4: { cellWidth: 46 },
        5: { cellWidth: 18 },
      },
    });
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 7;
  }

  // --- 2. Program Kemitraan ---
  addSectionHeading(`2. Program Kemitraan (${payload.programs.length})`);
  if (payload.programs.length === 0) {
    addEmptyNote('Tidak ada program kemitraan pada filter aktif.');
  } else {
    autoTable(doc, {
      ...baseTableOptions,
      startY: cursorY,
      head: [['Kode', 'Nama Program', 'Area PM', 'Mitra Terlibat', 'Anggaran', 'Status']],
      body: payload.programs.map((prg) => [
        prg.kodeProgram,
        prg.namaProgram,
        getPmAreaCode(prg.areaPm),
        prg.partnerIds
          .map((id) => payload.partnerMap.get(id)?.nama ?? id)
          .join(', ') || '-',
        formatCurrencyIDR(prg.anggaranRencana),
        prg.status,
      ]),
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold' },
        1: { cellWidth: 46 },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 48 },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 22 },
      },
    });
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 7;
  }

  // --- 3. Realisasi Kegiatan ---
  addSectionHeading(`3. Realisasi Kegiatan (${payload.activities.length})`);
  if (payload.activities.length === 0) {
    addEmptyNote('Tidak ada kegiatan pada filter aktif.');
  } else {
    autoTable(doc, {
      ...baseTableOptions,
      startY: cursorY,
      head: [['Tanggal', 'Nama Kegiatan', 'Program', 'Peserta', 'Hasil', 'Status']],
      body: payload.activities.map((act) => [
        formatDateID(act.tanggalPelaksanaan),
        act.namaKegiatan,
        payload.programNameMap.get(act.programId) ?? '-',
        String(act.jumlahPeserta),
        act.hasilKegiatan || '-',
        act.status,
      ]),
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 38 },
        2: { cellWidth: 40 },
        3: { cellWidth: 16, halign: 'right' },
        4: { cellWidth: 44 },
        5: { cellWidth: 20 },
      },
    });
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 7;
  }

  // --- 4. Daftar Bukti & Dokumentasi ---
  addSectionHeading(`4. Daftar Bukti & Dokumentasi (${payload.evidences.length})`);
  if (payload.evidences.length === 0) {
    addEmptyNote('Belum ada bukti dokumentasi pada filter aktif.');
  } else {
    autoTable(doc, {
      ...baseTableOptions,
      startY: cursorY,
      head: [['Tanggal', 'Nama Dokumen', 'Jenis', 'Program', 'Keterangan']],
      body: payload.evidences.map((ev) => [
        formatDateID(ev.tanggalUnggah),
        ev.namaDokumen,
        ev.jenis,
        payload.programNameMap.get(ev.programId) ?? '-',
        ev.keterangan || '-',
      ]),
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 42 },
        2: { cellWidth: 30 },
        3: { cellWidth: 44 },
        4: { cellWidth: 42 },
      },
    });
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 7;
  }

  // --- 5. Hasil Monitoring, Evaluasi & Tindak Lanjut ---
  addSectionHeading(
    `5. Hasil Monitoring, Evaluasi & Tindak Lanjut (${payload.evaluations.length})`
  );
  if (payload.evaluations.length === 0) {
    addEmptyNote('Belum ada hasil monitoring pada periode atau filter yang dipilih.');
  } else {
    autoTable(doc, {
      ...baseTableOptions,
      startY: cursorY,
      head: [['Periode & Penilai', 'Nilai & Kategori', 'Temuan & Kekuatan / Kelemahan', 'Rekomendasi & RTL']],
      body: payload.evaluations.map((ev) => [
        `${ev.periode}\n${formatDateID(ev.tanggalPenilaian)}\nPenilai: ${ev.penilai}`,
        `Nilai: ${ev.nilaiAkhir}\n(${ev.totalSkorPerolehan}/${ev.totalSkorMaksimal})\n${ev.kategoriHasil}`,
        `Temuan: ${ev.temuanMonitoring || '-'}\nKekuatan: ${ev.kekuatan || '-'}\nKelemahan: ${ev.kelemahan || '-'}`,
        `Rekomendasi: ${ev.rekomendasi || '-'}\nRTL: ${ev.rencanaTindakLanjut || '-'}${
          ev.catatanPembinaanPengawas
            ? `\nCatatan Pengawas: ${ev.catatanPembinaanPengawas}`
            : ''
        }`,
      ]),
      columnStyles: {
        0: { cellWidth: 36 },
        1: { cellWidth: 28, fontStyle: 'bold' },
        2: { cellWidth: 60 },
        3: { cellWidth: 58 },
      },
    });
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 7;
  }

  // --- 6. Rekap Catatan Pembinaan Pengawas ---
  if (payload.supervisorNotes.length > 0) {
    addSectionHeading(
      `6. Rekap Catatan Pembinaan Pengawas (${payload.supervisorNotes.length})`
    );
    autoTable(doc, {
      ...baseTableOptions,
      startY: cursorY,
      head: [['Tanggal', 'Pengawas Sekolah', 'Catatan Pembinaan', 'Rekomendasi']],
      body: payload.supervisorNotes.map((note) => [
        formatDateID(note.tanggal),
        note.pengawasNama,
        note.catatanPembinaan,
        note.rekomendasi || '-',
      ]),
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 36 },
        2: { cellWidth: 68 },
        3: { cellWidth: 52 },
      },
    });
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 8;
  }

  // --- 7. Hasil Analisis AI, Rekomendasi Kemitraan & Analisis Dampak ---
  if (payload.aiAnalysis) {
    const ai = payload.aiAnalysis;
    const sectionNum = payload.supervisorNotes.length > 0 ? 7 : 6;
    addSectionHeading(
      `${sectionNum}. Hasil Analisis AI, Rekomendasi Kemitraan & Analisis Dampak`
    );

    autoTable(doc, {
      ...baseTableOptions,
      startY: cursorY,
      head: [
        [
          'Cakupan & Tanggal Analisis',
          'Skor Kematangan',
          'Indeks Dampak',
          'Ringkasan Eksekutif AI',
        ],
      ],
      body: [
        [
          `${ai.schoolScope}\n${formatDateID(ai.generatedAt.slice(0, 10))}`,
          `${ai.maturityScore} / 100\n(${ai.maturityLevel})`,
          `${ai.impactAnalysis.overallImpactIndex} / 100`,
          ai.executiveSummary || '-',
        ],
      ],
      columnStyles: {
        0: { cellWidth: 36 },
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { cellWidth: 24, fontStyle: 'bold' },
        3: { cellWidth: 96 },
      },
    });
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 5;

    if (ai.impactAnalysis.dimensions.length > 0) {
      autoTable(doc, {
        ...baseTableOptions,
        startY: cursorY,
        head: [['Dimensi Dampak', 'Skor', 'Status', 'Analisis & Saran Penguatan']],
        body: ai.impactAnalysis.dimensions.map((d) => [
          d.dimensi,
          `${d.skor}/100`,
          d.status,
          `${d.analisis}\nSaran: ${d.saranPeningkatan}`,
        ]),
        columnStyles: {
          0: { cellWidth: 42, fontStyle: 'bold' },
          1: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
          2: { cellWidth: 24 },
          3: { cellWidth: 98 },
        },
      });
      cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 5;
    }

    if (ai.partnershipRecommendations.length > 0) {
      autoTable(doc, {
        ...baseTableOptions,
        startY: cursorY,
        head: [
          [
            'Rekomendasi Kemitraan',
            'Calon Mitra & Kategori',
            'Area PM',
            'Kolaborasi & Estimasi Dampak',
          ],
        ],
        body: ai.partnershipRecommendations.map((r) => [
          `[${r.prioritas}] ${r.judul}`,
          `${r.calonMitra}\n(${r.kategoriMitra})`,
          getPmAreaCode(r.areaPm),
          `Kolaborasi: ${r.bentukKolaborasi}\nDampak: ${r.estimasiDampak}`,
        ]),
        columnStyles: {
          0: { cellWidth: 42, fontStyle: 'bold' },
          1: { cellWidth: 38 },
          2: { cellWidth: 16, halign: 'center' },
          3: { cellWidth: 86 },
        },
      });
      cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 8;
    }
  }

  // --- Signature Block ---
  ensureSpace(44);
  cursorY += 4;
  doc.setDrawColor(...borderRgb);
  doc.setLineWidth(0.25);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  cursorY += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...inkRgb);
  doc.text('Mengetahui,', marginX, cursorY);
  doc.text(getSignatureDateText(payload), rightX, cursorY, { align: 'right' });

  cursorY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text('Pengawas Sekolah', marginX, cursorY);
  doc.text('Kepala Sekolah', rightX, cursorY, { align: 'right' });

  cursorY += 18;
  const pengawasName =
    payload.schoolProfile.namaPengawas || '....................................';
  const kepalaName =
    payload.schoolProfile.kepalaSekolah || '....................................';
  doc.text(pengawasName, marginX, cursorY);
  doc.text(kepalaName, rightX, cursorY, { align: 'right' });

  // Underline signature names
  const pengawasWidth = doc.getTextWidth(pengawasName);
  const kepalaWidth = doc.getTextWidth(kepalaName);
  doc.setDrawColor(...inkRgb);
  doc.setLineWidth(0.25);
  doc.line(marginX, cursorY + 1, marginX + pengawasWidth, cursorY + 1);
  doc.line(rightX - kepalaWidth, cursorY + 1, rightX, cursorY + 1);

  // NIP lines
  cursorY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedRgb);
  doc.text(
    `NIP. ${payload.schoolProfile.nipPengawas || '....................................'}`,
    marginX,
    cursorY
  );
  doc.text(
    `NIP. ${payload.schoolProfile.nipKepalaSekolah || '....................................'}`,
    rightX,
    cursorY,
    { align: 'right' }
  );

  // --- Page Footer & Page Numbers on every page ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...borderRgb);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedRgb);
    doc.text(COPYRIGHT_TEXT, marginX, pageHeight - 8.5);
    doc.text(`Halaman ${i} dari ${totalPages}`, rightX, pageHeight - 8.5, {
      align: 'right',
    });
  }

  doc.save(buildReportFilename(payload, 'pdf'));
}

/* ============================================================================
 * 2. WORD (.docx) EXPORTER (docx)
 * ========================================================================== */

const DOC_FONT = 'Calibri';
const COLOR_FOREST = '14532D';
const COLOR_INK = '11221A';
const COLOR_MUTED = '5B6F65';
const COLOR_BORDER = 'CBD8D0';
const COLOR_TINT = 'F3F8F5';

const CELL_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
};

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

function createSectionTitle(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    keepNext: true,
    children: [
      new TextRun({
        text,
        bold: true,
        size: 22, // 11pt
        color: COLOR_FOREST,
        font: DOC_FONT,
      }),
    ],
  });
}

function createEmptyParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 140 },
    children: [
      new TextRun({
        text,
        italics: true,
        size: 18,
        color: COLOR_MUTED,
        font: DOC_FONT,
      }),
    ],
  });
}

function createDataTable(
  headers: string[],
  rows: string[][],
  rightAlignCols: number[] = []
): Table {
  const rightSet = new Set(rightAlignCols);

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (headerText, colIdx) =>
        new TableCell({
          shading: {
            type: ShadingType.CLEAR,
            color: 'auto',
            fill: COLOR_FOREST,
          },
          borders: CELL_BORDERS,
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: rightSet.has(colIdx)
                ? AlignmentType.RIGHT
                : AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: headerText,
                  bold: true,
                  size: 17, // 8.5pt
                  color: 'FFFFFF',
                  font: DOC_FONT,
                }),
              ],
            }),
          ],
        })
    ),
  });

  const bodyRows = rows.map(
    (cells, rowIdx) =>
      new TableRow({
        children: cells.map((cellText, colIdx) => {
          const lines = (cellText || '-').split('\n');
          return new TableCell({
            shading:
              rowIdx % 2 === 1
                ? { type: ShadingType.CLEAR, color: 'auto', fill: COLOR_TINT }
                : undefined,
            borders: CELL_BORDERS,
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            children: lines.map(
              (line, lineIdx) =>
                new Paragraph({
                  spacing: { after: lineIdx < lines.length - 1 ? 40 : 0 },
                  alignment: rightSet.has(colIdx)
                    ? AlignmentType.RIGHT
                    : AlignmentType.LEFT,
                  children: [
                    new TextRun({
                      text: line,
                      size: 17,
                      color: COLOR_INK,
                      font: DOC_FONT,
                    }),
                  ],
                })
            ),
          });
        }),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

export async function exportReportToWord(
  payload: ReportExportPayload
): Promise<void> {
  const schoolTitle = getHeaderSchoolTitle(payload);
  const addressLine = [
    (payload.schoolProfile.alamatSekolah || '').trim(),
    payload.schoolProfile.npsn ? `NPSN: ${payload.schoolProfile.npsn}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const printedDateLabel = formatDateID(getEffectivePrintedDateIso(payload));
  const periodText = getPeriodText(payload);

  const children: (Paragraph | Table)[] = [];

  // --- Kop Laporan ---
  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'LAPORAN PENGELOLAAN KEMITRAAN SEKOLAH · MITRA KITA',
          bold: true,
          size: 18,
          color: COLOR_FOREST,
          font: DOC_FONT,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: schoolTitle,
          bold: true,
          size: 30, // 15pt
          color: COLOR_INK,
          font: DOC_FONT,
        }),
      ],
    }),
    ...(addressLine
      ? [
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: addressLine,
                size: 18,
                color: COLOR_MUTED,
                font: DOC_FONT,
              }),
            ],
          }),
        ]
      : []),
    new Paragraph({
      spacing: { after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 16, color: COLOR_FOREST },
      },
      children: [
        new TextRun({
          text: `Tahun Ajaran: ${payload.schoolProfile.tahunAjaran || '-'}   |   Dicetak: ${printedDateLabel}   |   Periode: ${periodText}`,
          size: 17,
          color: COLOR_MUTED,
          font: DOC_FONT,
        }),
      ],
    })
  );

  // Active filter note if any
  const activeFilters: string[] = [];
  if (payload.partnerCategoryFilter !== 'ALL') {
    activeFilters.push(`Kategori Mitra: ${payload.partnerCategoryFilter}`);
  }
  if (payload.pmAreaFilter !== 'ALL') {
    activeFilters.push(`Area PM: ${payload.pmAreaFilter}`);
  }
  if (activeFilters.length > 0) {
    children.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: `Filter Aktif: ${activeFilters.join(' · ')}`,
            italics: true,
            size: 17,
            color: COLOR_MUTED,
            font: DOC_FONT,
          }),
        ],
      })
    );
  }

  // --- Executive Summary Table ---
  const summaryCells = [
    { label: 'Total Mitra', value: `${payload.partners.length}`, sub: 'Mitra tercatat' },
    {
      label: 'Program Kemitraan',
      value: `${payload.programs.length}`,
      sub: `Anggaran: ${formatCurrencyIDR(payload.totalBudget)}`,
    },
    {
      label: 'Realisasi Kegiatan',
      value: `${payload.activities.length}`,
      sub: `${payload.totalParticipants} total peserta`,
    },
    {
      label: 'Bukti & Monitoring',
      value: `${payload.evidences.length} / ${payload.evaluations.length}`,
      sub: 'Dokumen / Evaluasi',
    },
  ];

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: summaryCells.map(
            (metric) =>
              new TableCell({
                shading: {
                  type: ShadingType.CLEAR,
                  color: 'auto',
                  fill: COLOR_TINT,
                },
                borders: CELL_BORDERS,
                margins: { top: 100, bottom: 100, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    spacing: { after: 40 },
                    children: [
                      new TextRun({
                        text: metric.label,
                        size: 16,
                        color: COLOR_MUTED,
                        font: DOC_FONT,
                      }),
                    ],
                  }),
                  new Paragraph({
                    spacing: { after: 30 },
                    children: [
                      new TextRun({
                        text: metric.value,
                        bold: true,
                        size: 26,
                        color: COLOR_FOREST,
                        font: DOC_FONT,
                      }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: metric.sub,
                        size: 15,
                        color: COLOR_MUTED,
                        font: DOC_FONT,
                      }),
                    ],
                  }),
                ],
              })
          ),
        }),
      ],
    })
  );

  // --- 1. Data Mitra Sekolah ---
  children.push(createSectionTitle(`1. Data Mitra Sekolah (${payload.partners.length})`));
  if (payload.partners.length === 0) {
    children.push(createEmptyParagraph('Tidak ada data mitra pada filter aktif.'));
  } else {
    children.push(
      createDataTable(
        ['ID', 'Nama Mitra / Lembaga', 'Kategori', 'Penanggung Jawab', 'Kontribusi', 'Status'],
        payload.partners.map((p) => [
          p.id,
          p.namaSekolah ? `${p.nama}\n(${p.namaSekolah})` : p.nama,
          p.kategori,
          p.penanggungJawab || '-',
          p.jenisKontribusi || '-',
          p.status,
        ])
      )
    );
  }

  // --- 2. Program Kemitraan ---
  children.push(createSectionTitle(`2. Program Kemitraan (${payload.programs.length})`));
  if (payload.programs.length === 0) {
    children.push(createEmptyParagraph('Tidak ada program kemitraan pada filter aktif.'));
  } else {
    children.push(
      createDataTable(
        ['Kode', 'Nama Program', 'Area PM', 'Mitra Terlibat', 'Anggaran', 'Status'],
        payload.programs.map((prg) => [
          prg.kodeProgram,
          prg.namaProgram,
          getPmAreaCode(prg.areaPm),
          prg.partnerIds
            .map((id) => payload.partnerMap.get(id)?.nama ?? id)
            .join(', ') || '-',
          formatCurrencyIDR(prg.anggaranRencana),
          prg.status,
        ]),
        [4]
      )
    );
  }

  // --- 3. Realisasi Kegiatan ---
  children.push(createSectionTitle(`3. Realisasi Kegiatan (${payload.activities.length})`));
  if (payload.activities.length === 0) {
    children.push(createEmptyParagraph('Tidak ada kegiatan pada filter aktif.'));
  } else {
    children.push(
      createDataTable(
        ['Tanggal', 'Nama Kegiatan', 'Program', 'Peserta', 'Hasil', 'Status'],
        payload.activities.map((act) => [
          formatDateID(act.tanggalPelaksanaan),
          act.namaKegiatan,
          payload.programNameMap.get(act.programId) ?? '-',
          String(act.jumlahPeserta),
          act.hasilKegiatan || '-',
          act.status,
        ]),
        [3]
      )
    );
  }

  // --- 4. Daftar Bukti & Dokumentasi ---
  children.push(
    createSectionTitle(`4. Daftar Bukti & Dokumentasi (${payload.evidences.length})`)
  );
  if (payload.evidences.length === 0) {
    children.push(
      createEmptyParagraph('Belum ada bukti dokumentasi pada filter aktif.')
    );
  } else {
    children.push(
      createDataTable(
        ['Tanggal', 'Nama Dokumen', 'Jenis', 'Program', 'Keterangan'],
        payload.evidences.map((ev) => [
          formatDateID(ev.tanggalUnggah),
          ev.namaDokumen,
          ev.jenis,
          payload.programNameMap.get(ev.programId) ?? '-',
          ev.keterangan || '-',
        ])
      )
    );
  }

  // --- 5. Hasil Monitoring, Evaluasi & Tindak Lanjut ---
  children.push(
    createSectionTitle(
      `5. Hasil Monitoring, Evaluasi & Tindak Lanjut (${payload.evaluations.length})`
    )
  );
  if (payload.evaluations.length === 0) {
    children.push(
      createEmptyParagraph(
        'Belum ada hasil monitoring pada periode atau filter yang dipilih.'
      )
    );
  } else {
    children.push(
      createDataTable(
        [
          'Periode & Penilai',
          'Nilai & Kategori',
          'Temuan, Kekuatan & Kelemahan',
          'Rekomendasi & Tindak Lanjut',
        ],
        payload.evaluations.map((ev) => [
          `${ev.periode}\n${formatDateID(ev.tanggalPenilaian)}\nPenilai: ${ev.penilai}`,
          `Nilai: ${ev.nilaiAkhir}\n(${ev.totalSkorPerolehan}/${ev.totalSkorMaksimal})\n${ev.kategoriHasil}`,
          `Temuan: ${ev.temuanMonitoring || '-'}\nKekuatan: ${ev.kekuatan || '-'}\nKelemahan: ${ev.kelemahan || '-'}`,
          `Rekomendasi: ${ev.rekomendasi || '-'}\nRTL: ${ev.rencanaTindakLanjut || '-'}${
            ev.catatanPembinaanPengawas
              ? `\nCatatan Pengawas: ${ev.catatanPembinaanPengawas}`
              : ''
          }`,
        ])
      )
    );
  }

  // --- 6. Rekap Catatan Pembinaan Pengawas ---
  if (payload.supervisorNotes.length > 0) {
    children.push(
      createSectionTitle(
        `6. Rekap Catatan Pembinaan Pengawas (${payload.supervisorNotes.length})`
      )
    );
    children.push(
      createDataTable(
        ['Tanggal', 'Pengawas Sekolah', 'Catatan Pembinaan', 'Rekomendasi'],
        payload.supervisorNotes.map((note) => [
          formatDateID(note.tanggal),
          note.pengawasNama,
          note.catatanPembinaan,
          note.rekomendasi || '-',
        ])
      )
    );
  }

  // --- 7. Hasil Analisis AI, Rekomendasi Kemitraan & Analisis Dampak ---
  if (payload.aiAnalysis) {
    const ai = payload.aiAnalysis;
    const sectionNum = payload.supervisorNotes.length > 0 ? 7 : 6;
    children.push(
      createSectionTitle(
        `${sectionNum}. Hasil Analisis AI, Rekomendasi Kemitraan & Analisis Dampak`
      ),
      createDataTable(
        [
          'Cakupan & Tanggal',
          'Skor Kematangan',
          'Indeks Dampak',
          'Ringkasan Eksekutif AI',
        ],
        [
          [
            `${ai.schoolScope}\n${formatDateID(ai.generatedAt.slice(0, 10))}`,
            `${ai.maturityScore}/100 (${ai.maturityLevel})`,
            `${ai.impactAnalysis.overallImpactIndex}/100`,
            ai.executiveSummary || '-',
          ],
        ]
      )
    );

    if (ai.impactAnalysis.dimensions.length > 0) {
      children.push(
        new Paragraph({ spacing: { before: 140, after: 60 }, children: [
          new TextRun({
            text: 'Analisis Dampak 4 Dimensi:',
            bold: true,
            size: 18,
            color: COLOR_INK,
            font: DOC_FONT,
          }),
        ] }),
        createDataTable(
          ['Dimensi Dampak', 'Skor', 'Status', 'Analisis & Saran Penguatan'],
          ai.impactAnalysis.dimensions.map((d) => [
            d.dimensi,
            `${d.skor}/100`,
            d.status,
            `${d.analisis}\nBukti: ${d.buktiPendukung}\nSaran: ${d.saranPeningkatan}`,
          ]),
          [1]
        )
      );
    }

    if (ai.partnershipRecommendations.length > 0) {
      children.push(
        new Paragraph({ spacing: { before: 140, after: 60 }, children: [
          new TextRun({
            text: 'Rekomendasi Kemitraan Strategis:',
            bold: true,
            size: 18,
            color: COLOR_INK,
            font: DOC_FONT,
          }),
        ] }),
        createDataTable(
          [
            'Rekomendasi',
            'Calon Mitra & Kategori',
            'Area PM',
            'Bentuk Kolaborasi & Estimasi Dampak',
          ],
          ai.partnershipRecommendations.map((r) => [
            `[${r.prioritas}] ${r.judul}`,
            `${r.calonMitra}\n(${r.kategoriMitra})`,
            getPmAreaCode(r.areaPm),
            `Kolaborasi: ${r.bentukKolaborasi}\nDampak: ${r.estimasiDampak}`,
          ])
        )
      );
    }

    children.push(
      new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({
            text: 'Efektivitas Anggaran: ',
            bold: true,
            size: 17,
            color: COLOR_INK,
            font: DOC_FONT,
          }),
          new TextRun({
            text: ai.impactAnalysis.budgetEfficiencyNote || '-',
            size: 17,
            color: COLOR_INK,
            font: DOC_FONT,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: 'Dampak Pengalaman Belajar Peserta Didik: ',
            bold: true,
            size: 17,
            color: COLOR_INK,
            font: DOC_FONT,
          }),
          new TextRun({
            text: ai.impactAnalysis.studentOutcomeNarrative || '-',
            size: 17,
            color: COLOR_INK,
            font: DOC_FONT,
          }),
        ],
      })
    );
  }

  // --- Signature Block ---
  const pengawasName =
    payload.schoolProfile.namaPengawas || '....................................';
  const pengawasNip =
    payload.schoolProfile.nipPengawas || '....................................';
  const kepalaName =
    payload.schoolProfile.kepalaSekolah || '....................................';
  const kepalaNip =
    payload.schoolProfile.nipKepalaSekolah || '....................................';

  children.push(
    new Paragraph({
      spacing: { before: 420, after: 80 },
      children: [],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              borders: NO_BORDERS,
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Mengetahui,',
                      size: 19,
                      color: COLOR_INK,
                      font: DOC_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { after: 900 },
                  children: [
                    new TextRun({
                      text: 'Pengawas Sekolah',
                      bold: true,
                      size: 19,
                      color: COLOR_INK,
                      font: DOC_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { after: 40 },
                  children: [
                    new TextRun({
                      text: pengawasName,
                      bold: true,
                      underline: {},
                      size: 19,
                      color: COLOR_INK,
                      font: DOC_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `NIP. ${pengawasNip}`,
                      size: 17,
                      color: COLOR_MUTED,
                      font: DOC_FONT,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: NO_BORDERS,
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: getSignatureDateText(payload),
                      size: 19,
                      color: COLOR_INK,
                      font: DOC_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 900 },
                  children: [
                    new TextRun({
                      text: 'Kepala Sekolah',
                      bold: true,
                      size: 19,
                      color: COLOR_INK,
                      font: DOC_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 40 },
                  children: [
                    new TextRun({
                      text: kepalaName,
                      bold: true,
                      underline: {},
                      size: 19,
                      color: COLOR_INK,
                      font: DOC_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: `NIP. ${kepalaNip}`,
                      size: 17,
                      color: COLOR_MUTED,
                      font: DOC_FONT,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  const document = new Document({
    creator: 'HERIANSYAH. S.Si., S.Pd., M.Pd',
    title: `Laporan Kemitraan Sekolah - ${schoolTitle}`,
    description: 'Laporan Pengelolaan Kemitraan Sekolah MITRA KITA',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1080, // 0.75 in
              right: 1080,
              bottom: 1080,
              left: 1080,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'MITRA KITA · Sistem Pengelolaan Kemitraan Sekolah',
                    size: 15,
                    color: COLOR_MUTED,
                    font: DOC_FONT,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
                },
                spacing: { before: 80 },
                children: [
                  new TextRun({
                    text: `${COPYRIGHT_TEXT}   |   Halaman `,
                    size: 15,
                    color: COLOR_MUTED,
                    font: DOC_FONT,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 15,
                    color: COLOR_MUTED,
                    font: DOC_FONT,
                  }),
                  new TextRun({
                    text: ' dari ',
                    size: 15,
                    color: COLOR_MUTED,
                    font: DOC_FONT,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 15,
                    color: COLOR_MUTED,
                    font: DOC_FONT,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  triggerBlobDownload(blob, buildReportFilename(payload, 'docx'));
}
