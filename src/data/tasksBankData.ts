import type { TaskId, FipiQuestion, SprintQuestion } from '../utils/trainerLogic.ts';
import starterBank from './starterBank.json' with { type: 'json' };

export interface WordEntry {
  id: string;
  word: string;
  wordGap: string;
  prefix: string;
  missingLetter: string;
  suffix: string;
  task: TaskId;
  topic: string;
  category: string;
  rule: string;
  context: string;
  source: string;
  isTrap?: boolean;
}

let initialWords: WordEntry[] = (starterBank.words || []) as WordEntry[];
let initialFipi: FipiQuestion[] = (starterBank.fipi || []) as FipiQuestion[];
let initialSprint: SprintQuestion[] = (starterBank.sprint || []) as SprintQuestion[];

// В среде Node.js (при прогоне тестов) считываем полную базу из локальных файлов
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dataDir = path.resolve(process.cwd(), 'src/data');
    const allWordsPath = path.join(dataDir, 'allWordsBank9_15.json');
    if (fs.existsSync(allWordsPath)) {
      const parsed = JSON.parse(fs.readFileSync(allWordsPath, 'utf8'));
      initialWords = Array.isArray(parsed) ? parsed : parsed.words || [];
    }
    const fipiPath = path.join(dataDir, 'fipiTasksBank9_15.json');
    if (fs.existsSync(fipiPath)) {
      initialFipi = JSON.parse(fs.readFileSync(fipiPath, 'utf8'));
    }
    const sprintPath = path.join(dataDir, 'sprintBank9_15.json');
    if (fs.existsSync(sprintPath)) {
      initialSprint = JSON.parse(fs.readFileSync(sprintPath, 'utf8'));
    }
  } catch (err) {
    // fallback на starterBank
  }
}

export const PARSED_WORDS: WordEntry[] = [...initialWords];
export const PARSED_FIPI_QUESTIONS: FipiQuestion[] = [...initialFipi];
export const PARSED_SPRINT_QUESTIONS: SprintQuestion[] = [...initialSprint];

export const PARSED_TASKS_MAP: Record<TaskId, FipiQuestion[]> = {
  '9': [],
  '10': [],
  '11': [],
  '12': [],
  '13': [],
  '14': [],
  '15': [],
};

export const PARSED_WORDS_DATABASE: Record<TaskId, WordEntry[]> = {
  '9': [],
  '10': [],
  '11': [],
  '12': [],
  '13': [],
  '14': [],
  '15': [],
};

export function refreshMaps() {
  const tasks: TaskId[] = ['9', '10', '11', '12', '13', '14', '15'];
  for (const t of tasks) {
    PARSED_TASKS_MAP[t] = PARSED_FIPI_QUESTIONS.filter((q) => q.task === t);
    PARSED_WORDS_DATABASE[t] = PARSED_WORDS.filter((w) => w.task === t);
  }
}

// Первоначальное заполнение карт
refreshMaps();

async function fetchJsonWithCache(url: string, fallbackUrl?: string): Promise<any> {
  const cacheName = 'ege-bank-cache-v1';
  let cache: Cache | null = null;
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      cache = await window.caches.open(cacheName);
      const cached = await cache.match(url);
      if (cached) {
        return await cached.json();
      }
    } catch {}
  }

  // 1. Попытка загрузить из локального сервера разработки (если файл есть локально)
  const filename = url.split('/').pop();
  try {
    const localRes = await fetch(`/src/data/${filename}`);
    if (localRes.ok) {
      const data = await localRes.json();
      if (cache) {
        try {
          await cache.put(url, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
        } catch {}
      }
      return data;
    }
  } catch {}

  // 2. Основной CDN (jsDelivr с глобальным edge-кэшированием)
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (cache) {
        try {
          await cache.put(url, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
        } catch {}
      }
      return data;
    }
  } catch (err) {
    console.warn(`[EGE Bank] Failed to fetch from CDN ${url}:`, err);
  }

  // 3. Fallback на GitHub Raw
  if (fallbackUrl) {
    try {
      const res = await fetch(fallbackUrl);
      if (res.ok) {
        const data = await res.json();
        if (cache) {
          try {
            await cache.put(url, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
          } catch {}
        }
        return data;
      }
    } catch (err) {
      console.warn(`[EGE Bank] Failed to fetch from fallback ${fallbackUrl}:`, err);
    }
  }

  return null;
}

let isFullBankLoaded = false;
let isFullBankLoading = false;

export async function loadFullDataBank(): Promise<boolean> {
  if (isFullBankLoaded || isFullBankLoading) return isFullBankLoaded;
  isFullBankLoading = true;

  try {
    const cdnBase = 'https://cdn.jsdelivr.net/gh/ffpebc/9-15@main/src/data';
    const rawBase = 'https://raw.githubusercontent.com/ffpebc/9-15/main/src/data';

    const [allWordsData, fipiData, sprintData] = await Promise.all([
      fetchJsonWithCache(`${cdnBase}/allWordsBank9_15.json`, `${rawBase}/allWordsBank9_15.json`),
      fetchJsonWithCache(`${cdnBase}/fipiTasksBank9_15.json`, `${rawBase}/fipiTasksBank9_15.json`),
      fetchJsonWithCache(`${cdnBase}/sprintBank9_15.json`, `${rawBase}/sprintBank9_15.json`),
    ]);

    let updated = false;

    if (allWordsData) {
      const wordsArr = Array.isArray(allWordsData) ? allWordsData : allWordsData.words || [];
      if (wordsArr.length > PARSED_WORDS.length) {
        PARSED_WORDS.length = 0;
        PARSED_WORDS.push(...wordsArr);
        updated = true;
      }
    }

    if (Array.isArray(fipiData) && fipiData.length > PARSED_FIPI_QUESTIONS.length) {
      PARSED_FIPI_QUESTIONS.length = 0;
      PARSED_FIPI_QUESTIONS.push(...fipiData);
      updated = true;
    }

    if (Array.isArray(sprintData) && sprintData.length > PARSED_SPRINT_QUESTIONS.length) {
      PARSED_SPRINT_QUESTIONS.length = 0;
      PARSED_SPRINT_QUESTIONS.push(...sprintData);
      updated = true;
    }

    if (updated) {
      refreshMaps();
      isFullBankLoaded = true;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ege-bank-loaded', {
            detail: {
              totalWords: PARSED_WORDS.length,
              totalFipi: PARSED_FIPI_QUESTIONS.length,
              totalSprint: PARSED_SPRINT_QUESTIONS.length,
            },
          })
        );
      }
    }
    return true;
  } catch (err) {
    console.error('[EGE Bank] Failed to load full bank:', err);
    return false;
  } finally {
    isFullBankLoading = false;
  }
}

// Автоматический запуск предзагрузки в фоновом режиме браузера
if (typeof window !== 'undefined') {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => {
      loadFullDataBank();
    });
  } else {
    setTimeout(() => {
      loadFullDataBank();
    }, 200);
  }
}
