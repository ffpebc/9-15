import fs from 'fs';
import path from 'path';

const starterBankPath = path.resolve('src/data/starterBank.json');
const starterBank = JSON.parse(fs.readFileSync(starterBankPath, 'utf8'));

console.log('--- AUDITING starterBank.json ---');
let starterErrors: string[] = [];

// Audit starterBank words
for (const [idx, w] of (starterBank.words || []).entries()) {
  if (!w.word) {
    starterErrors.push(`Word at index ${idx} missing word`);
    continue;
  }
  if (!w.task) {
    starterErrors.push(`Word ${w.word} missing task`);
  }
  if (w.task === '14') {
    if (!['СЛИТНО', 'РАЗДЕЛЬНО', 'ДЕФИСНО'].includes(w.missingLetter)) {
      starterErrors.push(`Task 14 word ${w.word} has invalid missingLetter: ${w.missingLetter}`);
    }
    // Check if word contains hyphen where it shouldn't
    if (/ПО-ТОМУ|ПО-ЭТОМУ|ЗА-ТО|ОТ-ТОГО|ПРИ-ТОМ|ПРИ-ЧЕМ|ТО-ЖЕ|ТАК-ЖЕ|ЧТО-БЫ/.test(w.word)) {
      starterErrors.push(`Task 14 word ${w.word} has bad hyphenation`);
    }
  }
  if (w.task === '15') {
    if (!['Н', 'НН'].includes(w.missingLetter)) {
      starterErrors.push(`Task 15 word ${w.word} has invalid missingLetter: ${w.missingLetter}`);
    }
  }
  if (!w.rule || w.rule.length < 10) {
    starterErrors.push(`Word ${w.word} (task ${w.task}) has empty or too short rule: "${w.rule}"`);
  }
}

// Audit starterBank fipi
for (const q of (starterBank.fipi || [])) {
  if (!q.rows || q.rows.length === 0) {
    starterErrors.push(`FIPI task ${q.id} has no rows`);
    continue;
  }
  if (q.task !== '15' && q.rows.length !== 5) {
    starterErrors.push(`FIPI task ${q.id} (task ${q.task}) has ${q.rows.length} rows instead of 5`);
  }
  const expectedIndices: number[] = [];
  q.rows.forEach((r: any, idx: number) => {
    if (r.isCorrectRow) expectedIndices.push(idx + 1);
  });
  const corrStr = (q.correctIndices || []).slice().sort().join(',');
  const expStr = expectedIndices.slice().sort().join(',');
  if (corrStr !== expStr) {
    starterErrors.push(`FIPI task ${q.id} (task ${q.task}) correctIndices mismatch: got [${corrStr}], expected [${expStr}]`);
  }
}
console.log(`starterBank errors: ${starterErrors.length}`);
if (starterErrors.length > 0) {
  console.log('Sample starter errors:', starterErrors.slice(0, 10));
}

// Audit public fipi
console.log('\n--- AUDITING public/data/fipiTasksBank9_15.json ---');
const fipiPublicPath = path.resolve('public/data/fipiTasksBank9_15.json');
const fipiTasks = JSON.parse(fs.readFileSync(fipiPublicPath, 'utf8'));
let fipiErrors: string[] = [];

for (const q of fipiTasks) {
  if (q.task !== '15' && q.rows.length !== 5) {
    fipiErrors.push(`FIPI task ${q.id} (task ${q.task}) has ${q.rows.length} rows`);
  }
  const expectedIndices: number[] = [];
  q.rows.forEach((r: any, idx: number) => {
    if (r.isCorrectRow) expectedIndices.push(idx + 1);
    if (!r.explanation || r.explanation.length < 5) {
      fipiErrors.push(`FIPI task ${q.id} row ${idx + 1} has empty explanation`);
    }
    // Check if task 14 explanation has bad hyphenation
    if (q.task === '14') {
      if (/ПО-ТОМУ|ПО-ЭТОМУ|ЗА-ТО|ОТ-ТОГО|ПРИ-ТОМ|ПРИ-ЧЕМ|ТО-ЖЕ|ТАК-ЖЕ|ЧТО-БЫ/.test(r.explanation)) {
        fipiErrors.push(`FIPI task 14 (${q.id}) row ${idx + 1} explanation has bad hyphenation`);
      }
    }
  });
  const corrStr = (q.correctIndices || []).slice().sort().join(',');
  const expStr = expectedIndices.slice().sort().join(',');
  if (corrStr !== expStr) {
    fipiErrors.push(`FIPI task ${q.id} (task ${q.task}) correctIndices mismatch: got [${corrStr}], expected [${expStr}]`);
  }
}
console.log(`fipiTasksBank errors: ${fipiErrors.length}`);
if (fipiErrors.length > 0) {
  console.log('Sample fipi errors:', fipiErrors.slice(0, 10));
}

// Audit sprintBank
console.log('\n--- AUDITING public/data/sprintBank9_15.json ---');
const sprintPublicPath = path.resolve('public/data/sprintBank9_15.json');
const sprintQuestions = JSON.parse(fs.readFileSync(sprintPublicPath, 'utf8'));
let sprintErrors: string[] = [];

for (const s of sprintQuestions) {
  if (!s.options || !s.options.includes(s.answer)) {
    sprintErrors.push(`Sprint question ${s.id} answer "${s.answer}" not in options [${s.options?.join(', ')}]`);
  }
  if (!s.rule || s.rule.length < 5) {
    sprintErrors.push(`Sprint question ${s.id} empty rule`);
  }
  if (!s.explanation || s.explanation.length < 5) {
    sprintErrors.push(`Sprint question ${s.id} empty explanation`);
  }
  if (s.task === '14') {
    const rawWord = `${s.prefix || ''}${s.suffix || ''}`;
    if (/ПО-ТОМУ|ПО-ЭТОМУ|ЗА-ТО|ОТ-ТОГО|ПРИ-ТОМ|ПРИ-ЧЕМ|ТО-ЖЕ|ТАК-ЖЕ|ЧТО-БЫ/.test(rawWord)) {
      sprintErrors.push(`Sprint question ${s.id} has bad hyphenation in raw word: ${rawWord}`);
    }
  }
  if (s.task === '15') {
    if (!['Н', 'НН'].includes(s.answer)) {
      sprintErrors.push(`Sprint question ${s.id} invalid task 15 answer: ${s.answer}`);
    }
  }
}
console.log(`sprintBank errors: ${sprintErrors.length}`);
if (sprintErrors.length > 0) {
  console.log('Sample sprint errors:', sprintErrors.slice(0, 10));
}

// Audit allWordsBank
console.log('\n--- AUDITING public/data/allWordsBank9_15.json ---');
const allWordsPath = path.resolve('public/data/allWordsBank9_15.json');
const allWordsObj = JSON.parse(fs.readFileSync(allWordsPath, 'utf8'));
const allWords = Array.isArray(allWordsObj) ? allWordsObj : (allWordsObj.words || []);
let allWordsErrors: string[] = [];

for (const [idx, w] of allWords.entries()) {
  if (!w.word) {
    allWordsErrors.push(`Word at index ${idx} missing word`);
    continue;
  }
  if (w.task === '14') {
    if (/ПО-ТОМУ|ПО-ЭТОМУ|ЗА-ТО|ОТ-ТОГО|ПРИ-ТОМ|ПРИ-ЧЕМ|ТО-ЖЕ|ТАК-ЖЕ|ЧТО-БЫ/.test(w.word)) {
      allWordsErrors.push(`allWords item ${w.word} has bad hyphenation`);
    }
  }
  if (!w.rule || w.rule.length < 5) {
    allWordsErrors.push(`allWords item ${w.word} has empty rule`);
  }
}
console.log(`allWordsBank errors: ${allWordsErrors.length}`);
if (allWordsErrors.length > 0) {
  console.log('Sample allWords errors:', allWordsErrors.slice(0, 10));
}
