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
  cleanScraperArtifacts,
  cleanWord,
  cleanExplanation,
  cleanQuestionRule,
  resolveTask15Sentence,
} from './trainerLogic.ts';

test('FIPI bank generates sprint questions + FIPI sets + KIM variants + flashcards & homophones', () => {
  const bank = getTrainerBank();
  const isFullBank = bank.sprintQuestions.length >= 1000;
  if (isFullBank) {
    assert.equal(bank.sprintQuestions.length >= 5000, true);
    assert.equal(bank.fipiQuestions.length >= 250, true);
  } else {
    assert.equal(bank.sprintQuestions.length >= 200, true);
    assert.equal(bank.fipiQuestions.length >= 25, true);
  }
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

test('Task 15 FIPI questions have authentic sentences, non-empty gap tokens, and zero scraper artifacts', () => {
  const bank = getTrainerBank();
  const t15Questions = bank.fipiQuestions.filter((q) => q.task === '15');
  assert.equal(t15Questions.length >= 6, true, 'At least 6 Task 15 FIPI questions available');

  for (const q of t15Questions) {
    const sentence = q.sentence || q.instruction;
    assert.ok(sentence, `Task 15 question ${q.id} must have a non-empty sentence`);
    assert.equal(sentence.includes('— «...'), false, `Question ${q.id} sentence contains scraper artifact`);
    assert.equal(sentence.includes('«...—'), false, `Question ${q.id} sentence contains scraper artifact`);
    assert.equal(q.rule.includes('— «...'), false, `Question ${q.id} rule contains scraper artifact`);
    assert.equal(q.rule.includes('Предложение:'), false, `Question ${q.id} rule should not embed "Предложение:"`);

    // Must contain gap numbers (1), (2), etc.
    const gapMatches = [...sentence.matchAll(/([А-Яа-яЁё]+)\((\d+)\)([А-Яа-яЁё]*)/g)];
    assert.ok(gapMatches.length >= 2, `Question ${q.id} must contain at least 2 gap tokens in sentence`);
    assert.equal(gapMatches.length, q.rows.length, `Question ${q.id} gaps count must match rows count`);

    // Verify rows are clean
    for (const r of q.rows) {
      for (const w of r.words) {
        assert.equal(w.includes('— «...'), false, `Word "${w}" in ${q.id} contains scraper artifact`);
        assert.equal(w.includes('«...'), false, `Word "${w}" in ${q.id} contains scraper artifact`);
      }
    }

    // Verify correctIndices are within 1..rows.length
    for (const idx of q.correctIndices) {
      assert.ok(idx >= 1 && idx <= q.rows.length, `correctIndex ${idx} out of range in ${q.id}`);
    }
  }
});

test('resolveTask15Sentence and clean helpers heal broken screenshot question format', () => {
  const brokenQ = {
    task: '15',
    rule: 'Укажите цифру(-ы), на месте которой(-ых) пишется Н. Предложение: «глиня(1)ые — «...— «...глиня(1)ые...»»',
    rows: [
      {
        words: ['глиня(1)ые — «...— «...глиня(1)ые...»'],
        solvedWords: ['глиняные'],
        letter: 'Н',
        isCorrectRow: true,
        explanation: 'глиняный — суффикс -ЯН- отыменного прилагательного → одна Н — «...глиня(1)ые...»',
      },
      {
        words: ['глиня(2)ые — «...глиня(1)ые...»'],
        solvedWords: ['глиняные'],
        letter: 'Н',
        isCorrectRow: true,
        explanation: 'глиняный — суффикс -ЯН- отыменного прилагательного → одна Н',
      },
    ],
    correctIndices: [1, 2],
  };

  const cleanedRule = cleanQuestionRule(brokenQ.rule, '15');
  assert.equal(cleanedRule, 'Укажите цифру(-ы), на месте которой(-ых) пишется Н.');

  const resolvedSent = resolveTask15Sentence(brokenQ);
  assert.ok(resolvedSent.length >= 15, 'Resolved sentence must not be empty');
  assert.equal(resolvedSent.includes('— «...'), false, 'Must not have scraper artifact');
  assert.equal(resolvedSent.includes('«...—'), false, 'Must not have scraper artifact');
  assert.equal(resolvedSent.includes('(1)'), true, 'Must contain gap (1)');
  assert.equal(resolvedSent.includes('(2)'), true, 'Must contain gap (2)');

  const cleanWord1 = cleanWord(brokenQ.rows[0].words[0]);
  assert.equal(cleanWord1, 'глиня(1)ые');

  const cleanWord2 = cleanWord(brokenQ.rows[1].words[0]);
  assert.equal(cleanWord2, 'глиня(2)ые');

  const cleanExp1 = cleanExplanation(brokenQ.rows[0].explanation);
  assert.ok(cleanExp1.includes('глиняный — суффикс -ЯН- отыменного прилагательного → одна Н'));
  assert.equal(cleanExp1.includes('— «...'), false);

  // Test Cyrillic Ze homoglyph conversion
  const homoglyphSent = resolveTask15Sentence({
    task: '15',
    sentence: 'На карти(1)е были изображе(2)ы ю(З)ая девушка и стари(4)ый дом.',
    rows: [
      { words: ['карти(1)е'], solvedWords: ['картиНе'] },
      { words: ['изображе(2)ы'], solvedWords: ['изображеНы'] },
      { words: ['ю(З)ая'], solvedWords: ['юНая'] },
      { words: ['стари(4)ый'], solvedWords: ['стариННый'] },
    ],
  });
  assert.equal(homoglyphSent.includes('(3)'), true, 'Cyrillic Ze must be converted to digit 3');
  assert.equal(homoglyphSent.includes('(З)'), false);
});

test('All FIPI questions across tasks 9-15 in trainer bank have strictly valid row counts and indices', () => {
  const bank = getTrainerBank();
  for (const q of bank.fipiQuestions) {
    assert.ok(q.rule, `Question ${q.id} must have a non-empty rule`);
    assert.ok(q.correctIndices.length >= 1, `Question ${q.id} must have at least 1 correctIndex`);

    if (q.task !== '15') {
      assert.equal(q.rows.length, 5, `Question ${q.id} (task ${q.task}) must have exactly 5 rows`);
    } else {
      assert.ok(q.rows.length >= 2, `Question ${q.id} (task 15) must have at least 2 rows`);
      const sent = q.sentence || q.instruction;
      assert.ok(sent && sent.length >= 15, `Question ${q.id} (task 15) must have a non-empty sentence`);
    }

    for (const c of q.correctIndices) {
      assert.ok(c >= 1 && c <= q.rows.length, `correctIndex ${c} out of range in ${q.id}`);
    }

    for (const r of q.rows) {
      assert.ok(r.words.length >= 1, `Row in ${q.id} has empty words`);
      assert.ok(r.solvedWords.length >= 1, `Row in ${q.id} has empty solvedWords`);
      for (const w of r.words) {
        assert.equal(w.includes('— «...'), false, `Scraper artifact in word "${w}" of ${q.id}`);
      }
    }
  }
});



