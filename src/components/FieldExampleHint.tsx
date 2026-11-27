import React, { useState } from 'react';
import { MousePointerClick, RefreshCw, Sparkles } from 'lucide-react';

export interface ExampleOption {
  label?: string;
  value: string;
}

interface FieldExampleHintProps {
  examples: ReadonlyArray<string | ExampleOption>;
  onApply: (value: string) => void;
  disabled?: boolean;
}

function normalizeExample(item: string | ExampleOption): ExampleOption {
  return typeof item === 'string' ? { value: item } : item;
}

export const FieldExampleHint: React.FC<FieldExampleHintProps> = ({
  examples,
  onApply,
  disabled = false,
}) => {
  const [index, setIndex] = useState(0);

  if (disabled || examples.length === 0) return null;

  const safeIndex = index % examples.length;
  const current = normalizeExample(examples[safeIndex]);
  const hasMultiple = examples.length > 1;

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onApply(current.value)}
        title={`Klik untuk mengisi otomatis: ${current.value}`}
        className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-[#DCE8E0] bg-[#F7FAF8] px-2.5 py-1 text-left text-[11px] leading-snug text-[#52635A] transition-colors hover:border-[#14532D]/40 hover:bg-[#ECFDF5] hover:text-[#14532D]"
      >
        <MousePointerClick className="h-3 w-3 shrink-0 text-[#14532D]" />
        <span className="shrink-0 font-semibold text-[#14532D]">
          {current.label ? `Contoh (${current.label}):` : 'Contoh:'}
        </span>
        <span className="min-w-0 flex-1 truncate text-[#334155] group-hover:text-[#14532D]">
          {current.value}
        </span>
      </button>
      {hasMultiple && (
        <button
          type="button"
          onClick={() => setIndex((prev) => (prev + 1) % examples.length)}
          title={`Lihat contoh lain (${safeIndex + 1}/${examples.length})`}
          aria-label="Ganti contoh pengisian"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#DCE8E0] bg-white px-2 py-1 text-[11px] font-medium text-[#52635A] transition-colors hover:border-[#14532D]/40 hover:bg-[#F6F8F7] hover:text-[#14532D] tabular-nums"
        >
          <RefreshCw className="h-3 w-3" />
          <span>
            {safeIndex + 1}/{examples.length}
          </span>
        </button>
      )}
    </div>
  );
};

interface FormFillExampleBarProps {
  onFillAll: () => void;
  label?: string;
}

export const FormFillExampleBar: React.FC<FormFillExampleBarProps> = ({
  onFillAll,
  label = 'Isi Semua Contoh',
}) => (
  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#DCE8E0] bg-[#F4FAF6] px-3.5 py-2.5 text-xs text-[#334155]">
    <div className="flex items-center gap-2 min-w-0">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#14532D]" />
      <span className="leading-snug">
        Klik kotak <strong className="text-[#14532D]">Contoh</strong> di bawah
        setiap kolom untuk mengisi otomatis, atau isi seluruh formulir sekaligus.
      </span>
    </div>
    <button
      type="button"
      onClick={onFillAll}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#14532D]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#14532D] transition-colors hover:bg-[#ECFDF5] whitespace-nowrap"
    >
      <MousePointerClick className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  </div>
);
