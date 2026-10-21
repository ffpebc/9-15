import type { TaskId, FipiQuestion, SprintQuestion } from '../utils/trainerLogic.ts';
import allWordsData from './allWordsBank9_15.json' with { type: 'json' };
import fipiTasks from './fipiTasksBank9_15.json' with { type: 'json' };
import sprintTasks from './sprintBank9_15.json' with { type: 'json' };

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

// Извлекаем массив слов (18 070 слов)
const rawWords = Array.isArray(allWordsData) ? allWordsData : (allWordsData as any).words || [];

export const PARSED_WORDS: WordEntry[] = rawWords as WordEntry[];
export const PARSED_FIPI_QUESTIONS: FipiQuestion[] = (fipiTasks as any) as FipiQuestion[];
export const PARSED_SPRINT_QUESTIONS: SprintQuestion[] = (sprintTasks as any) as SprintQuestion[];

export const PARSED_TASKS_MAP: Record<TaskId, FipiQuestion[]> = {
  '9': PARSED_FIPI_QUESTIONS.filter((q) => q.task === '9'),
  '10': PARSED_FIPI_QUESTIONS.filter((q) => q.task === '10'),
  '11': PARSED_FIPI_QUESTIONS.filter((q) => q.task === '11'),
  '12': PARSED_FIPI_QUESTIONS.filter((q) => q.task === '12'),
  '13': PARSED_FIPI_QUESTIONS.filter((q) => q.task === '13'),
  '14': PARSED_FIPI_QUESTIONS.filter((q) => q.task === '14'),
  '15': PARSED_FIPI_QUESTIONS.filter((q) => q.task === '15'),
};

export const PARSED_WORDS_DATABASE: Record<TaskId, WordEntry[]> = {
  '9': PARSED_WORDS.filter((w) => w.task === '9'),
  '10': PARSED_WORDS.filter((w) => w.task === '10'),
  '11': PARSED_WORDS.filter((w) => w.task === '11'),
  '12': PARSED_WORDS.filter((w) => w.task === '12'),
  '13': PARSED_WORDS.filter((w) => w.task === '13'),
  '14': PARSED_WORDS.filter((w) => w.task === '14'),
  '15': PARSED_WORDS.filter((w) => w.task === '15'),
};
