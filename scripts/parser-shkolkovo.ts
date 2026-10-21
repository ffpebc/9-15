import fs from 'node:fs';
import path from 'node:path';
import type { TaskId, FipiQuestion, SprintQuestion } from '../src/utils/trainerLogic.ts';
import {
  cleanHtmlText,
  normalizeRawQuestionToTrainer,
} from './normalizer.ts';
import type {
  RawParsedQuestion,
  WordEntry,
} from './normalizer.ts';

export interface ShkolkovoCategoryConfig {
  task: TaskId;
  name: string;
  id: number;
  priority: number;
}

export const SHKOLKOVO_CATEGORIES: ShkolkovoCategoryConfig[] = [
  // Task 9: Правописание корней
  { task: '9', name: 'Дощинский-2026 (36 вар.)', id: 11550, priority: 1 },
  { task: '9', name: 'Демоверсии', id: 2342, priority: 2 },
  { task: '9', name: 'Банк ФИПИ', id: 2378, priority: 3 },
  { task: '9', name: 'Реальный ЕГЭ', id: 9089, priority: 4 },
  { task: '9', name: 'Авторские задания', id: 3747, priority: 5 },

  // Task 10: Правописание приставок
  { task: '10', name: 'Дощинский-2026 (36 вар.)', id: 11551, priority: 1 },
  { task: '10', name: 'Демоверсии', id: 2343, priority: 2 },
  { task: '10', name: 'Банк ФИПИ', id: 2312, priority: 3 },
  { task: '10', name: 'Реальный ЕГЭ', id: 9090, priority: 4 },
  { task: '10', name: 'Авторские задания', id: 3766, priority: 5 },

  // Task 11: Правописание суффиксов
  { task: '11', name: 'Дощинский-2026 (36 вар.)', id: 11552, priority: 1 },
  { task: '11', name: 'Демоверсии', id: 2344, priority: 2 },
  { task: '11', name: 'Банк ФИПИ', id: 2313, priority: 3 },
  { task: '11', name: 'Реальный ЕГЭ', id: 9091, priority: 4 },
  { task: '11', name: 'Авторские задания', id: 3767, priority: 5 },

  // Task 12: Спряжения и личные окончания
  { task: '12', name: 'Дощинский-2026 (36 вар.)', id: 10979, priority: 1 },
  { task: '12', name: 'Демоверсии', id: 2345, priority: 2 },
  { task: '12', name: 'Банк ФИПИ', id: 2379, priority: 3 },
  { task: '12', name: 'Реальный ЕГЭ', id: 9092, priority: 4 },
  { task: '12', name: 'Авторские задания', id: 3768, priority: 5 },

  // Task 13: Правописание НЕ и НИ
  { task: '13', name: 'Дощинский-2026 (36 вар.)', id: 11553, priority: 1 },
  { task: '13', name: 'Демоверсии', id: 2346, priority: 2 },
  { task: '13', name: 'Банк ФИПИ', id: 2315, priority: 3 },
  { task: '13', name: 'Реальный ЕГЭ', id: 9093, priority: 4 },
  { task: '13', name: 'Авторские задания', id: 6456, priority: 5 },
];

export interface ShkolkovoParseOptions {
  categories?: number[];
  tasks?: TaskId[];
  limitPerCategory?: number;
  useCache?: boolean;
  cacheDir?: string;
}

export interface ShkolkovoParseResult {
  fipiQuestions: FipiQuestion[];
  sprintQuestions: SprintQuestion[];
  words: WordEntry[];
  totalParsed: number;
}

export function extractQuestionListFromHtml(html: string): any {
  const startIdx = html.indexOf('"questionList":');
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  let endIdx = -1;
  const jsonStart = startIdx + '"questionList":'.length;

  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }
  }

  if (endIdx === -1) return null;
  try {
    return JSON.parse(html.slice(jsonStart, endIdx));
  } catch (e) {
    return null;
  }
}

export function parseShkolkovoQuestionHtml(qHtml: string, task: TaskId): {
  instruction: string;
  source: string;
  rows: Array<{ rowNum: number; rawText: string; words: string[] }>;
} {
  const clean = cleanHtmlText(qHtml);
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);

  let instruction = '';
  let source = '';
  const rows: Array<{ rowNum: number; rawText: string; words: string[] }> = [];

  for (const line of lines) {
    const rowMatch = line.match(/^([1-5])\)\s*(.*)/);
    if (rowMatch) {
      const rowNum = parseInt(rowMatch[1], 10);
      const rawText = rowMatch[2].trim();

      let words: string[] = [];
      if (task === '13') {
        words = [rawText];
      } else {
        // Tasks 9, 10, 11, 12: split words by comma
        words = rawText.split(',').map((w) => w.trim()).filter(Boolean);
      }

      rows.push({ rowNum, rawText, words });
    } else if (line.startsWith('(') && line.endsWith(')')) {
      source = line.slice(1, -1).trim();
    } else if (!instruction && (line.includes('Укажите варианты') || line.includes('ответов'))) {
      instruction = line;
    }
  }

  if (!instruction) {
    if (task === '13') {
      instruction = 'Укажите варианты ответов, в которых НЕ (НИ) с выделенным словом пишется СЛИТНО. Запишите номера ответов.';
    } else if (task === '11' || task === '12') {
      instruction = 'Укажите варианты ответов, в которых в обоих словах одного ряда пропущена одна и та же буква. Запишите номера ответов.';
    } else {
      instruction = 'Укажите варианты ответов, в которых во всех словах одного ряда пропущена одна и та же буква. Запишите номера ответов.';
    }
  }

  return { instruction, source, rows };
}

export function parseShkolkovoSolutionHtml(sHtml: string, task: TaskId): {
  rowsExplanation: string[];
  lettersByRow: string[];
} {
  const clean = cleanHtmlText(sHtml);
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);

  const rowsExplanation: string[] = ['', '', '', '', ''];
  let currentRow: number | null = null;

  for (const line of lines) {
    const match = line.match(/^([1-5])\)\s*(.*)/);
    if (match) {
      const idx = parseInt(match[1], 10) - 1;
      currentRow = idx;
      rowsExplanation[idx] = (rowsExplanation[idx] ? rowsExplanation[idx] + ' ' : '') + match[2];
    } else if (currentRow !== null && !line.startsWith('Ответ:')) {
      rowsExplanation[currentRow] += ' ' + line;
    }
  }

  // Extract letters per row
  const lettersByRow: string[] = ['', '', '', '', ''];

  if (task === '13') {
    rowsExplanation.forEach((exp, idx) => {
      const lower = exp.toLowerCase();
      if (lower.includes('слитно')) {
        lettersByRow[idx] = 'СЛИТНО';
      } else if (lower.includes('раздельно')) {
        lettersByRow[idx] = 'РАЗДЕЛЬНО';
      } else {
        lettersByRow[idx] = '—';
      }
    });
  } else {
    // For tasks 9-12, extract strong letters from HTML for each row
    // Look at each paragraph in sHtml
    const pMatches = [...sHtml.matchAll(/<p[^>]*>(.*?)<\/p>/gis)];
    let pIdx = 0;
    for (const p of pMatches) {
      const pText = cleanHtmlText(p[1]);
      const rowMatch = pText.match(/^([1-5])\)/);
      if (rowMatch) {
        const rNum = parseInt(rowMatch[1], 10) - 1;
        const strongs = [...p[1].matchAll(/<strong>\s*([А-ЯЁа-яё])\s*<\/strong>/gi)].map((m) =>
          m[1].toUpperCase()
        );
        if (strongs.length > 0) {
          const allSame = strongs.every((s) => s === strongs[0]);
          lettersByRow[rNum] = allSame ? strongs[0] : '—';
        }
      }
    }
  }

  return { rowsExplanation, lettersByRow };
}

export async function parseShkolkovo(
  options: ShkolkovoParseOptions = {}
): Promise<ShkolkovoParseResult> {
  const cacheDir = options.cacheDir || path.join(process.cwd(), '.cache', 'shkolkovo');
  if (options.useCache !== false && !fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const selectedCategories = SHKOLKOVO_CATEGORIES.filter((c) => {
    if (options.tasks && !options.tasks.includes(c.task)) return false;
    if (options.categories && !options.categories.includes(c.id)) return false;
    return true;
  });

  const fipiQuestions: FipiQuestion[] = [];
  const sprintQuestions: SprintQuestion[] = [];
  const words: WordEntry[] = [];
  let totalParsed = 0;

  for (const cat of selectedCategories) {
    const cacheFile = path.join(cacheDir, `cat_${cat.id}.json`);
    let qList: any = null;

    if (options.useCache !== false && fs.existsSync(cacheFile)) {
      try {
        qList = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      } catch (e) {
        qList = null;
      }
    }

    if (!qList) {
      try {
        const url = `https://3.shkolkovo.online/catalog/${cat.id}`;
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`[Shkolkovo Parser] Category ${cat.id} returned status ${res.status}`);
          continue;
        }
        const html = await res.text();
        qList = extractQuestionListFromHtml(html);
        if (qList && options.useCache !== false) {
          fs.writeFileSync(cacheFile, JSON.stringify(qList), 'utf-8');
        }
      } catch (err: any) {
        console.warn(`[Shkolkovo Parser] Failed to fetch category ${cat.id}: ${err.message}`);
        continue;
      }
    }

    if (!qList || !qList.questions || !Array.isArray(qList.questions)) {
      continue;
    }

    const questionsToProcess = options.limitPerCategory
      ? qList.questions.slice(0, options.limitPerCategory)
      : qList.questions;

    for (const q of questionsToProcess) {
      try {
        const qHtml = qList.dependencies?.TexSessionsMap?.[q.QuestionTexSessionId]?.Html || '';
        const sHtml = qList.dependencies?.TexSessionsMap?.[q.SolutionTexSessionId]?.Html || '';
        const answerRaw = String(q.Answer?.text || '').trim();

        // Parse answer digits 1-5
        const answerDigits = [...new Set(answerRaw.match(/[1-5]/g) || [])]
          .map((d) => parseInt(d, 10))
          .sort((a, b) => a - b);

        if (answerDigits.length < 2 || answerDigits.length > 4) {
          // If answer digits are invalid, skip
          continue;
        }

        const parsedQ = parseShkolkovoQuestionHtml(qHtml, cat.task);
        if (parsedQ.rows.length !== 5) {
          // Official format must have exactly 5 rows
          continue;
        }

        const parsedS = parseShkolkovoSolutionHtml(sHtml, cat.task);

        const rows = parsedQ.rows.map((r, rIdx) => {
          const isCorrect = answerDigits.includes(r.rowNum);
          const letter = parsedS.lettersByRow[rIdx] || (isCorrect ? '✓' : '—');
          const explanation = parsedS.rowsExplanation[rIdx] || r.rawText;

          return {
            rawText: r.rawText,
            words: r.words,
            solvedWords: r.words,
            letter,
            explanation,
          };
        });

        const rawObj: RawParsedQuestion = {
          externalId: `shkolkovo-${cat.task}-${q.Id}`,
          task: cat.task,
          source: parsedQ.source || `${cat.name} (№${q.Name || q.Id})`,
          instruction: parsedQ.instruction,
          rows,
          correctIndices: answerDigits,
        };

        const normalized = normalizeRawQuestionToTrainer(rawObj);
        fipiQuestions.push(normalized.fipiQuestion);
        sprintQuestions.push(...normalized.sprintQuestions);
        words.push(...normalized.words);
        totalParsed++;
      } catch (err: any) {
        // Keep parsing remaining questions
      }
    }
  }

  return {
    fipiQuestions,
    sprintQuestions,
    words,
    totalParsed,
  };
}

if (process.argv[1] && process.argv[1].endsWith('parser-shkolkovo.ts')) {
  console.log('--- Testing Shkolkovo Parser ---');
  parseShkolkovo({ limitPerCategory: 5 }).then((res) => {
    console.log(`Parsed ${res.fipiQuestions.length} FIPI questions`);
    console.log(`Extracted ${res.sprintQuestions.length} Sprint questions`);
    console.log(`Extracted ${res.words.length} Words`);
    if (res.fipiQuestions[0]) {
      console.log('Sample Task 9:', res.fipiQuestions[0].id, res.fipiQuestions[0].rule);
      console.log('Sample Rows:', res.fipiQuestions[0].rows);
      console.log('Answer:', res.fipiQuestions[0].correctIndices);
    }
  });
}
