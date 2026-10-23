import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTrainerBank,
  createInitialState,
  calculateTotalPlanned,
  stepTaskQty,
  buildWorkoutQueue,
  applyAnswerToState,
  encodeBackupCode,
  decodeBackupCode,
  calculateAccuracyPercent,
  normalizeKimDigits,
  FLASHCARDS_BANK,
  HOMOPHONE_PAIRS_BANK,
} from './trainerLogic.ts';
import {
  isolateTargetWordExplanation,
  parseStructuredExplanation,
  cleanDisplayText,
} from '../components/WorkWindows.tsx';

test('FIPI bank generates 5,000 sprint + 250 FIPI sets + 25 KIM variants + flashcards & homophones', () => {
  const bank = getTrainerBank();
  assert.equal(bank.sprintQuestions.length >= 5000, true);
  assert.equal(bank.fipiQuestions.length >= 250, true);
  assert.equal(bank.trapQuestions.length >= 15, true);
  assert.equal(bank.kimVariants.length >= 25, true);
  assert.equal(FLASHCARDS_BANK.length >= 14, true);
  assert.equal(HOMOPHONE_PAIRS_BANK.length >= 8, true);

  // Verify KIM Variant 1 has varied correctIndices across tasks 9-15 (not all identical)
  const v1 = bank.kimVariants[0];
  const distinctAnswers = new Set(
    (['9', '10', '11', '12', '13', '14', '15'] as const).map((t) => v1.tasks[t].correctIndices.join(''))
  );
  assert.equal(distinctAnswers.size >= 3, true);
});

test('task quantities step, clamp, and sum accurately for tasks 9-15 including tasks 14 and 15', () => {
  const state = createInitialState();
  assert.equal(calculateTotalPlanned(state.quantities), 35);
  assert.equal(stepTaskQty(5, -10), 0);
  assert.equal(stepTaskQty(995, 20), 1000);

  const q14 = buildWorkoutQueue({ '9': 0, '10': 0, '11': 0, '12': 0, '13': 0, '14': 5, '15': 0 }, 'sprint');
  assert.equal(q14.length, 5);
  assert.equal(q14.every((q) => q.task === '14'), true);

  const q15 = buildWorkoutQueue({ '9': 0, '10': 0, '11': 0, '12': 0, '13': 0, '14': 0, '15': 5 }, 'sprint');
  assert.equal(q15.length, 5);
  assert.equal(q15.every((q) => q.task === '15'), true);
});

test('KIM blank digit normalization sorts and deduplicates answer digits 1-5', () => {
  assert.equal(normalizeKimDigits('41319'), '134');
  assert.equal(normalizeKimDigits('52'), '25');
});

test('applyAnswerToState updates streaks, taskStats, and errorBank accurately', () => {
  const bank = getTrainerBank();
  const sampleQ = bank.sprintQuestions[0];
  let state = createInitialState();

  state = applyAnswerToState(state, sampleQ, false, 'А', true);
  assert.equal(state.totalSolved, 1);
  assert.equal(state.errorBank.length, 1);

  state = applyAnswerToState(state, sampleQ, true, sampleQ.answer, true);
  assert.equal(state.totalSolved, 2);
  assert.equal(state.totalCorrect, 1);
  assert.equal(state.bestStreak, 1);
  assert.equal(state.errorBank.length, 0);
  assert.equal(calculateAccuracyPercent(state.totalCorrect, state.totalSolved), 50);
});

test('Backup code encodes and restores all 5-tab state fields including records and journal', () => {
  const bank = getTrainerBank();
  let state = createInitialState();
  state = applyAnswerToState(state, bank.sprintQuestions[2], false, 'А', false);
  state.sessionsCompleted = 4;
  state.bestStreak = 18;
  state.bestBlitz60 = 24;
  state.bestSurvival = 15;
  state.darkMode = true;
  state.profilePin = 'ALEX99';
  state.sessionJournal = [
    {
      id: 'sj-1',
      title: 'Занятие (25 заданий)',
      total: 25,
      correct: 23,
      accuracy: 92,
      dateLabel: 'Сегодня',
    },
  ];

  const code = encodeBackupCode(state);
  const restored = decodeBackupCode(code);
  assert.notEqual(restored, null);
  assert.equal(restored?.totalSolved, 1);
  assert.equal(restored?.bestStreak, 18);
  assert.equal(restored?.bestBlitz60, 24);
  assert.equal(restored?.bestSurvival, 15);
  assert.equal(restored?.darkMode, true);
  assert.equal(restored?.profilePin, 'ALEX99');
  assert.equal(restored?.errorBank.length, 1);
  assert.equal(restored?.sessionJournal.length, 1);
});

test('buildWorkoutQueue randomizes selection and assigns unique instanceIds across sessions', () => {
  const qA = buildWorkoutQueue({ '9': 10, '10': 0, '11': 0, '12': 0, '13': 0, '14': 0, '15': 0 }, 'sprint');
  const qB = buildWorkoutQueue({ '9': 10, '10': 0, '11': 0, '12': 0, '13': 0, '14': 0, '15': 0 }, 'sprint');

  assert.equal(qA.length, 10);
  assert.equal(qB.length, 10);

  // Every question in a session has a unique instanceId
  const instanceIdsA = new Set(qA.map((q) => q.instanceId));
  assert.equal(instanceIdsA.size, 10);

  // Multiple sessions generate different starting word sequences (randomized, realistic exam practice)
  const idsA = qA.map((q) => q.id).join(',');
  const idsB = qB.map((q) => q.id).join(',');
  assert.notEqual(idsA, idsB);
});

test('sprint questions have exact per-word topics and mark exceptions explicitly', () => {
  const bank = getTrainerBank();

  const raskachatsya = bank.sprintQuestions.find(
    (q) => q.prefix === 'раск' && q.suffix === 'чаться'
  );
  assert.ok(raskachatsya);
  assert.equal(raskachatsya.topic, 'Проверяемая безударная гласная в корне');
  assert.equal(Boolean(raskachatsya.isTrap), false);

  const rostok = bank.sprintQuestions.find(
    (q) => q.prefix === 'р' && q.suffix === 'сток'
  );
  assert.ok(rostok);
  assert.ok(rostok.topic.startsWith('Исключение:'));
  assert.equal(rostok.isTrap, true);

  const utvar = bank.sprintQuestions.find(
    (q) => q.prefix === 'утв' && q.suffix === 'рь'
  );
  assert.ok(utvar);
  assert.equal(utvar.topic, 'Исключение: корень -ТВАР-/-ТВОР-');
  assert.equal(utvar.isTrap, true);

  const nedoumevaya = bank.sprintQuestions.find(
    (q) => q.prefix === 'недоум' && q.suffix === 'вая'
  );
  assert.ok(nedoumevaya);
  assert.equal(nedoumevaya.topic, 'Исключение: глаголы перед ударным -ВА-');
  assert.equal(nedoumevaya.isTrap, true);
});

test('Homophone pairs and Task 12 conjugation questions have balanced non-obvious options', () => {
  // 1. Homophone pairs have 50/50 split and never > 2 identical correct button positions in a row
  let maxStreak = 0;
  let currentStreak = 0;
  let lastBtn = -1;
  let btn0Count = 0;

  for (const p of HOMOPHONE_PAIRS_BANK) {
    const btnIdx = p.options.indexOf(p.correctOption);
    assert.notEqual(btnIdx, -1);
    if (btnIdx === 0) btn0Count++;
    if (btnIdx === lastBtn) {
      currentStreak++;
    } else {
      lastBtn = btnIdx;
      currentStreak = 1;
    }
    if (currentStreak > maxStreak) maxStreak = currentStreak;
  }

  assert.equal(maxStreak <= 2, true);
  // Strict 50/50 split across all pairs
  assert.equal(btn0Count, HOMOPHONE_PAIRS_BANK.length / 2);

  // Verify task 14 and 15 homophone pairs exist
  const task14Pairs = HOMOPHONE_PAIRS_BANK.filter((p) => p.task === '14');
  const task15Pairs = HOMOPHONE_PAIRS_BANK.filter((p) => p.task === '15');
  assert.equal(task14Pairs.length >= 8, true);
  assert.equal(task15Pairs.length >= 8, true);

  // Verify task 14 and 15 flashcards exist
  const task14Cards = FLASHCARDS_BANK.filter((c) => c.task === '14');
  const task15Cards = FLASHCARDS_BANK.filter((c) => c.task === '15');
  assert.equal(task14Cards.length >= 8, true);
  assert.equal(task15Cards.length >= 8, true);

  // 2. Task 12 questions never pair same-conjugation У/Ю or А/Я together
  const bank = getTrainerBank();
  const task12Questions = bank.sprintQuestions.filter((q) => q.task === '12');
  for (const q of task12Questions) {
    const sortedPair = q.options.slice().sort().join('/');
    assert.notEqual(sortedPair, 'У/Ю', `Word ${q.prefix}..${q.suffix} had same-conjugation У/Ю`);
    assert.notEqual(sortedPair, 'А/Я', `Word ${q.prefix}..${q.suffix} had same-conjugation А/Я`);
  }
});

test('explanation isolating and structuring strips row numbers and parses check words', () => {
  const multiDump = "5) сокрАщать — в безударной позиции в корне слова пишется проверяемая А (кра́ткий).\\nзакАзать — в безударной позиции в корне слова пишется проверяемая А (зака́з).\\nосчАстливить — в безударной позиции в корне слова пишется проверяемая А (сча́стье).";
  const isolated = isolateTargetWordExplanation(multiDump, 'сокрАщать');
  assert.ok(!isolated.includes('закАзать'), 'Should not contain neighbor word закАзать');
  assert.ok(!isolated.includes('5)'), 'Should not contain row number 5)');
  assert.ok(isolated.includes('сокрАщать'), 'Should contain target word сокрАщать');

  const structured = parseStructuredExplanation(isolated, 'сокрАщать');
  assert.equal(structured.checkWord, 'кра́ткий');
  assert.ok(structured.ruleNote.includes('В безударной позиции'));
});

