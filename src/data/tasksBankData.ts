import type { FipiQuestion, SprintQuestion, TaskId } from '../utils/trainerLogic.ts';
import allWordsBank from './allWordsBank9_15.json';
import fipiTasksBank from './fipiTasksBank9_15.json';
import sprintBank from './sprintBank9_15.json';

export interface BankWordItem {
  id: string;
  task: TaskId;
  word: string;
  wordGap?: string;
  prefix?: string;
  missingLetter?: string;
  suffix?: string;
  topic?: string;
  category?: string;
  rule?: string;
  context?: string;
  source?: string;
  isTrap?: boolean;
}

export const BANK_METADATA = {
  generatedAt: '2026-10-21T00:00:00.000Z',
  schoolYear: '2026-2027',
  version: '3.0.0-fipi-tasks-9-15',
  sources: [
    'ФИПИ (Официальные Демоверсии и Открытый банк 2025–2027)',
    'Школково (Дощинский-2026, Банк ФИПИ, Авторские)',
  ],
  taskCounts: {
    '9': 68,
    '10': 70,
    '11': 69,
    '12': 67,
    '13': 54,
    '14': 35,
    '15': 35,
  },
  totalTasks: (fipiTasksBank as FipiQuestion[]).length,
  totalSprintQuestions: (sprintBank as SprintQuestion[]).length,
  totalWords: (allWordsBank as BankWordItem[]).length,
} as const;

export const PARSED_FIPI_QUESTIONS: FipiQuestion[] = fipiTasksBank as unknown as FipiQuestion[];
export const PARSED_SPRINT_QUESTIONS: SprintQuestion[] = sprintBank as unknown as SprintQuestion[];
export const PARSED_WORDS_DATABASE: BankWordItem[] = allWordsBank as unknown as BankWordItem[];

export const PARSED_TASKS_MAP: Record<TaskId, FipiQuestion[]> = {
  '9': [],
  '10': [],
  '11': [],
  '12': [],
  '13': [],
  '14': [],
  '15': [],
};

for (const q of PARSED_FIPI_QUESTIONS) {
  if (PARSED_TASKS_MAP[q.task]) {
    PARSED_TASKS_MAP[q.task].push(q);
  }
}

export function getParsedWordsDatabase(): BankWordItem[] {
  return PARSED_WORDS_DATABASE;
}
