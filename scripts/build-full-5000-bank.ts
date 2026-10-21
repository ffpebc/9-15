import fs from 'node:fs';
import path from 'node:path';
import type { TaskId, SprintQuestion, FipiQuestion } from '../src/utils/trainerLogic.ts';
import { getSmartChoiceOptions } from '../src/utils/trainerLogic.ts';
import { PARSED_FIPI_QUESTIONS, PARSED_SPRINT_QUESTIONS } from '../src/data/tasksBankData.ts';

console.log('Building pristine, deduplicated 5050+ question bank...');
