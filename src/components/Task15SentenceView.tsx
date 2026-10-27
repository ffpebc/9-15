import React from 'react';
import { FipiRow } from '../utils/trainerLogic';

export interface Task15SentenceViewProps {
  sentence: string;
  rows: FipiRow[];
  selectedDigits: number[];
  isSubmitted: boolean;
  onToggleDigit?: (digit: number) => void;
  className?: string;
}

export const Task15SentenceView: React.FC<Task15SentenceViewProps> = React.memo(({
  sentence,
  rows,
  selectedDigits,
  isSubmitted,
  onToggleDigit,
  className = '',
}) => {
  const effectiveSentence = React.useMemo(() => {
    let s = (sentence || '').trim();
    s = s
      .replace(/«\.\.\.—\s*«\.\.\./g, '')
      .replace(/—\s*«\.\.\.[^»]*»*/g, '')
      .replace(/—\s*«\.\.\..*$/, '')
      .replace(/«\.\.\./g, '')
      .replace(/\.\.\.»/g, '')
      .replace(/[«»]/g, '')
      .trim();

    const testRe = /([А-Яа-яЁё]+)\((\d+)\)([А-Яа-яЁё]*)/;
    if (!s || !testRe.test(s)) {
      if (Array.isArray(rows) && rows.length > 0) {
        const parts = rows.map((r, i) => {
          const raw = r.words?.[0] || '';
          const m = raw.match(/([А-Яа-яЁё]+)\((\d+)\)([А-Яа-яЁё]*)/);
          if (m) return `${m[1]}(${m[2]})${m[3]}`;
          const clean = raw.replace(/\s*—\s*.*$/, '').replace(/[«»]/g, '').trim();
          return `${clean}(${i + 1})`;
        });
        return `В данном предложении пропущены буквы: ${parts.join(', ')}.`;
      }
      return 'Укажите цифры на месте пропусков в словах предложения.';
    }
    return s;
  }, [sentence, rows]);

  // Pattern matches words with gaps like: деревя(1)ая, письме(2)ый, etc.
  const regex = /([А-Яа-яЁё]+)\((\d+)\)([А-Яа-яЁё]*)/g;
  const elements: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(effectiveSentence)) !== null) {
    const matchStart = match.index;
    const matchEnd = regex.lastIndex;
    const [fullMatch, prefix, digitStr, suffix] = match;
    const digit = parseInt(digitStr, 10);
    const rowIdx = digit - 1;
    const row = rows[rowIdx] || rows.find((_, i) => i === rowIdx);

    // Append preceding plain text
    if (matchStart > lastIdx) {
      elements.push(effectiveSentence.slice(lastIdx, matchStart));
    }

    const isSelected = selectedDigits.includes(digit);

    let badgeClass = 'inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 rounded-md text-[11px] font-extrabold transition-all select-none ';
    let badgeText = `(${digit})`;

    if (isSubmitted && row) {
      if (row.isCorrectRow && isSelected) {
        // User picked correctly
        badgeClass += 'bg-[var(--ios-green-soft)] text-[var(--ios-green)] border border-[rgba(52,199,89,0.4)] shadow-xs';
        badgeText = `${row.letter} (${digit}) ✓`;
      } else if (row.isCorrectRow && !isSelected) {
        // Correct, but missed by user
        badgeClass += 'bg-[var(--ios-orange-soft)] text-[var(--ios-orange)] border border-[rgba(255,149,0,0.4)]';
        badgeText = `${row.letter} (${digit}) !`;
      } else if (!row.isCorrectRow && isSelected) {
        // Wrongly picked
        badgeClass += 'bg-[var(--ios-red-soft)] text-[var(--ios-red)] border border-[rgba(255,59,48,0.4)]';
        badgeText = `${row.letter} (${digit}) ✕`;
      } else {
        // Correctly not picked
        badgeClass += 'bg-[var(--ios-bg-tertiary)] text-[var(--ios-label-sec)] border border-transparent opacity-80';
        badgeText = `${row.letter} (${digit})`;
      }
    } else if (isSelected) {
      badgeClass += 'bg-[var(--ios-blue)] text-white shadow-xs scale-105 active:scale-95';
    } else {
      badgeClass += 'bg-[var(--ios-bg-tertiary)] text-[var(--ios-blue)] hover:bg-[var(--ios-blue-soft)] active:scale-95 cursor-pointer';
    }

    elements.push(
      <span
        key={`gap-${digit}-${matchStart}`}
        className="inline-flex items-baseline align-baseline whitespace-nowrap font-bold cursor-pointer transition-transform"
        onClick={() => {
          if (!isSubmitted && onToggleDigit) {
            onToggleDigit(digit);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Слово ${digit}: ${fullMatch}`}
      >
        <span>{prefix}</span>
        <span className={badgeClass}>{badgeText}</span>
        <span>{suffix}</span>
      </span>
    );

    lastIdx = matchEnd;
  }

  // Append trailing plain text
  if (lastIdx < effectiveSentence.length) {
    elements.push(effectiveSentence.slice(lastIdx));
  }

  return (
    <div className={`leading-relaxed text-[14px] sm:text-[15.5px] font-medium ${className}`}>
      {elements}
    </div>
  );
});

Task15SentenceView.displayName = 'Task15SentenceView';
