const fs = require('fs');
const path = require('path');

const srcFipiPath = path.resolve(__dirname, '../src/data/fipiTasksBank9_15.json');
const srcAllWordsPath = path.resolve(__dirname, '../src/data/allWordsBank9_15.json');
const srcSprintPath = path.resolve(__dirname, '../src/data/sprintBank9_15.json');
const srcStarterPath = path.resolve(__dirname, '../src/data/starterBank.json');

const pubFipiPath = path.resolve(__dirname, '../public/data/fipiTasksBank9_15.json');
const pubAllWordsPath = path.resolve(__dirname, '../public/data/allWordsBank9_15.json');
const pubSprintPath = path.resolve(__dirname, '../public/data/sprintBank9_15.json');

console.log('Loading databases...');
const fipiTasks = JSON.parse(fs.readFileSync(srcFipiPath, 'utf8'));
const allWordsObj = JSON.parse(fs.readFileSync(srcAllWordsPath, 'utf8'));
const allWords = Array.isArray(allWordsObj) ? allWordsObj : (allWordsObj.words || []);
const sprintQuestions = JSON.parse(fs.readFileSync(srcSprintPath, 'utf8'));
const starterBank = JSON.parse(fs.readFileSync(srcStarterPath, 'utf8'));

// ─────────────────────────────────────────────────────────────────────────────
// 1. Task 14 Healing Helpers
// ─────────────────────────────────────────────────────────────────────────────
function healTask14Token(tokenStr, sent, exp) {
  const clean = tokenStr.replace(/[()]/g, '').trim();
  const low = clean.toLowerCase().replace(/ё/g, 'е');
  const sentLow = (sent || '').toLowerCase().replace(/ё/g, 'е');
  const expLow = (exp || '').toLowerCase().replace(/ё/g, 'е');

  if (low === 'зато' || low === 'за-то') {
    if (
      /за то, что|за то что|за то, как|только за то|благодар|наказ|лишен|осужда|за то\b/i.test(sentLow) ||
      /указательное местоимение с предлогом|раздельно/i.test(expLow)
    ) {
      return {
        mode: 'РАЗДЕЛЬНО',
        word: 'ЗА ТО',
        rule: 'предлог «ЗА» с указательным местоимением «ТО» (местоимение сохраняет предметное указательное значение, к нему можно задать вопрос «за что?»); пишется РАЗДЕЛЬНО — «ЗА ТО».',
      };
    }
    return {
      mode: 'СЛИТНО',
      word: 'ЗАТО',
      rule: 'сочинительный противительный союз «ЗАТО» (равен по значению союзу «НО»); пишется СЛИТНО — «ЗАТО».',
    };
  }

  if (low === 'потому' || low === 'по-тому') {
    if (
      /по тому, что|по тому что|по тому мосту|по тому берегу|по тому пути/i.test(sentLow) &&
      !/потому что/i.test(sentLow)
    ) {
      return {
        mode: 'РАЗДЕЛЬНО',
        word: 'ПО ТОМУ',
        rule: 'предлог «ПО» с указательным местоимением «ТОМУ» (к местоимению можно задать вопрос «по какому?»); пишется РАЗДЕЛЬНО — «ПО ТОМУ».',
      };
    }
    return {
      mode: 'СЛИТНО',
      word: 'ПОТОМУ',
      rule: 'союз причины или местоименное наречие «ПОТОМУ» (входит в состав союза «потому что» или указывает на причину «по этой причине»); пишется СЛИТНО — «ПОТОМУ».',
    };
  }

  if (low === 'поэтому' || low === 'по-этому') {
    if (/по этому поводу|по этому пути|по этому вопросу/i.test(sentLow)) {
      return {
        mode: 'РАЗДЕЛЬНО',
        word: 'ПО ЭТОМУ',
        rule: 'предлог «ПО» с указательным местоимением «ЭТОМУ»; пишется РАЗДЕЛЬНО — «ПО ЭТОМУ».',
      };
    }
    return {
      mode: 'СЛИТНО',
      word: 'ПОЭТОМУ',
      rule: 'местоименное наречие со значением следствия «ПОЭТОМУ» (равно по значению «следовательно, оттого»); пишется СЛИТНО — «ПОЭТОМУ».',
    };
  }

  if (low === 'оттого' || low === 'от-того') {
    if (/от того дома|от того дерева/i.test(sentLow)) {
      return {
        mode: 'РАЗДЕЛЬНО',
        word: 'ОТ ТОГО',
        rule: 'предлог «ОТ» с указательным местоимением «ТОГО»; пишется РАЗДЕЛЬНО — «ОТ ТОГО».',
      };
    }
    return {
      mode: 'СЛИТНО',
      word: 'ОТТОГО',
      rule: 'союз причины «ОТТОГО» (в значении «потому что, так как»); пишется СЛИТНО — «ОТТОГО».',
    };
  }

  if (low === 'притом' || low === 'при-том') {
    if (/при том условии|при том доме/i.test(sentLow)) {
      return {
        mode: 'РАЗДЕЛЬНО',
        word: 'ПРИ ТОМ',
        rule: 'предлог «ПРИ» с указательным местоимением «ТОМ»; пишется РАЗДЕЛЬНО — «ПРИ ТОМ».',
      };
    }
    return {
      mode: 'СЛИТНО',
      word: 'ПРИТОМ',
      rule: 'присоединительный союз «ПРИТОМ» (в значении «вместе с тем, к тому же»); пишется СЛИТНО — «ПРИТОМ».',
    };
  }

  if (low === 'причем' || low === 'при-чем') {
    if (/при чем тут/i.test(sentLow)) {
      return {
        mode: 'РАЗДЕЛЬНО',
        word: 'ПРИ ЧЕМ',
        rule: 'предлог «ПРИ» с местоимением «ЧЕМ»; пишется РАЗДЕЛЬНО — «ПРИ ЧЕМ».',
      };
    }
    return {
      mode: 'СЛИТНО',
      word: 'ПРИЧЕМ',
      rule: 'присоединительный союз «ПРИЧЕМ» (в значении «вместе с тем, к тому же»); пишется СЛИТНО — «ПРИЧЕМ».',
    };
  }

  if (low === 'тоже' || low === 'то-же') {
    if (/то же самое|то же, что|то же что|одно и то же/i.test(sentLow) || /частицу же можно опустить|раздельно/i.test(expLow)) {
      return {
        mode: 'РАЗДЕЛЬНО',
        word: 'ТО ЖЕ',
        rule: 'сочетание указательного местоимения «ТО» с частицей «ЖЕ» (частицу ЖЕ можно опустить без потери смысла); пишется РАЗДЕЛЬНО — «ТО ЖЕ».',
      };
    }
    return {
      mode: 'СЛИТНО',
      word: 'ТОЖЕ',
      rule: 'сочинительный присоединительный союз «ТОЖЕ» (равен по значению союзу «И»); пишется СЛИТНО — «ТОЖЕ».',
    };
  }

  if (low === 'также' || low === 'так-же') {
    if (/так же, как|так же как|точно так же|так же легко|так же быстро/i.test(sentLow) || /в той же степени|раздельно/i.test(expLow)) {
      return {
        mode: 'РАЗДЕЛЬНО',
        word: 'ТАК ЖЕ',
        rule: 'наречие «ТАК» с частицей «ЖЕ» (в значении «таким же образом», часто перед «как»); пишется РАЗДЕЛЬНО — «ТАК ЖЕ».',
      };
    }
    return {
      mode: 'СЛИТНО',
      word: 'ТАКЖЕ',
      rule: 'сочинительный присоединительный союз «ТАКЖЕ» (равен по значению союзу «И»); пишется СЛИТНО — «ТАКЖЕ».',
    };
  }

  if (low === 'чтобы' || low === 'что-бы') {
    if (/что бы ни|что бы такое|что бы я|что бы мы|что бы то ни было/i.test(sentLow) || /частицу бы можно опустить|раздельно/i.test(expLow)) {
      return {
        mode: 'РАЗДЕЛЬНО',
        word: 'ЧТО БЫ',
        rule: 'местоимение «ЧТО» с частицей «БЫ» (частицу БЫ можно опустить или переставить в другое место предложения); пишется РАЗДЕЛЬНО — «ЧТО БЫ».',
      };
    }
    return {
      mode: 'СЛИТНО',
      word: 'ЧТОБЫ',
      rule: 'подчинительный целевой союз «ЧТОБЫ» (в значении «для того чтобы»); пишется СЛИТНО — «ЧТОБЫ».',
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Task 15 Rich Linguistic Explanation Generator
// ─────────────────────────────────────────────────────────────────────────────
function explainTask15Word(solvedWord, context) {
  const sLow = (solvedWord || '').toLowerCase().replace(/ё/g, 'е').trim();
  const ctxLow = (context || '').toLowerCase().replace(/ё/g, 'е');

  // Exceptions
  if (/(?:стеклянн|оловянн|деревянн)/.test(sLow)) {
    return `${solvedWord} — слово-исключение из правила отымённых прилагательных (суффикс -ЯНН- пишется с двумя НН).`;
  }
  if (sLow.includes('ветрен')) {
    if (/(?:безветрен|подветрен)/.test(sLow)) {
      return `${solvedWord} — отымённое прилагательное с приставкой, пишется две буквы НН (безветренный).`;
    }
    return `${solvedWord} — слово-исключение с суффиксом -ЕН- (без приставки), пишется с одной буквой Н.`;
  }
  if (/(?:кован|жеван|клеван)/.test(sLow)) {
    if (/(?:подкован|изжеван|перекован|переклеван)/.test(sLow)) {
      return `${solvedWord} — отглагольное причастие с приставкой, пишется две буквы НН.`;
    }
    return `${solvedWord} — отглагольное прилагательное несовершенного вида без приставок и зависимых слов (-ов-/-ев- в корне), пишется одна буква Н.`;
  }
  if (/(?:невиданн|неслыханн|нежданн|негаданн|желанн|медленн|деланн|обещанн|неожиданн|лелеянн|долгожданн|священн|приверженн|ухоженн)/.test(sLow)) {
    return `${solvedWord} — словарное слово-исключение, пишется с двумя буквами НН.`;
  }
  if (/(?:юный|единый|румяный|рьяный|пьяный|синий|багряный|зеленый|вороной|свиной|фазаний|вороний|бараний|тюлений|павлиний|олений)/.test(sLow)) {
    return `${solvedWord} — первообразное или притяжательное прилагательное, буква Н входит в корень (суффикс отсутствует), пишется одна буква Н.`;
  }
  if (/(?:поистине|приданое|труженик|масленица|пудреница|путаница|гостиная|гостиница)/.test(sLow)) {
    return `${solvedWord} — пишется одна буква Н (образовано от основы с одной Н).`;
  }
  if (/(?:совершенно|необыкновенно|немедленно|соответственно|злоумышленник|приверженность|настроенность|неизменность|собственность)/.test(sLow)) {
    return `${solvedWord} — пишется две буквы НН (образовано от основы с двумя НН).`;
  }
  if (/(?:преждевременно|сдержанно|прижизненно|уверенно|торжественно)/.test(sLow)) {
    return `${solvedWord} — наречие на -О, образовано от слова с двумя НН (в наречии пишется столько же Н, сколько в производящем слове); пишется две буквы НН.`;
  }
  if (/(?:времени|временн|безвременн|современн|племенн|семенн|именн)/.test(sLow)) {
    return `${solvedWord} — отымённое прилагательное, образованное от разносклоняемого существительного на -МЯ (основа на -ЕН- + суффикс -Н-) → пишется две буквы НН.`;
  }
  if (/(?:старинн|длинн|весенн|осенн|карманн|туманн|санн|каменн|ранн|истинн|картинн|лунн|сонн|диванн|конн|оконн|лимонн|чугунн)/.test(sLow)) {
    return `${solvedWord} — отымённое прилагательное на стыке морфем: основа оканчивается на -Н + суффикс -Н- → пишется две буквы НН.`;
  }
  if (/(?:лиственн|единственн|традиционн|торжественн|свойственн|соломенн|клюквенн|чувственн|государственн)/.test(sLow)) {
    return `${solvedWord} — отымённое прилагательное с суффиксом -ЕНН-/-ОНН- → пишется две буквы НН.`;
  }
  if (sLow.includes('странн')) {
    return `${solvedWord} — качественное прилагательное (корень стран- от «сторона/странь» + суффикс -н-) → пишется две буквы НН.`;
  }
  if (sLow.includes('причинн')) {
    return `${solvedWord} — сложное прилагательное, первая часть «причинный» на стыке морфем (причин- + -н-) → пишется две буквы НН.`;
  }

  // Short participles
  const isShortParticiple = /(?:решен|сделан|построен|написан|прочитан|украшен|увешан|измучен|затравлен|создан|увенчан|сохранен|освещен|поражен|доставлен|предъявлен|усыпан|покрыт|выкрашен|завешен|разрешен)(?:а|о|ы)?$/.test(sLow);
  if (isShortParticiple) {
    if (sLow.endsWith('н') || sLow.endsWith('на') || sLow.endsWith('но') || sLow.endsWith('ны')) {
      return `${solvedWord} — краткое страдательное причастие прошедшего времени, всегда пишется с одной буквой Н.`;
    }
  }

  // Perfective participles
  if (/нн/i.test(solvedWord)) {
    if (/(?:ованн|еванн|ированн)/.test(sLow)) {
      return `${solvedWord} — глагольное слово с суффиксом -ОВА-/-ЕВА-/-ИРОВА-, пишется две буквы НН.`;
    }
    return `${solvedWord} — полное страдательное причастие от глагола совершенного вида (с приставкой или зависимыми словами), пишется две буквы НН.`;
  } else {
    if (/(?:ан|ян|ин)(?:ый|ая|ое|ые|ом|ой|ых|ым|ую)?$/.test(sLow)) {
      return `${solvedWord} — отымённое прилагательное с суффиксом -АН-/-ЯН-/-ИН-, пишется одна буква Н.`;
    }
    return `${solvedWord} — отглагольное прилагательное несовершенного вида (без приставок и зависимых слов), пишется одна буква Н.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Heal FIPI Tasks Database
// ─────────────────────────────────────────────────────────────────────────────
console.log('Auditing and healing FIPI tasks...');
let fipiHealedRows = 0;
let fipiCorrectIndicesAdjusted = 0;

for (const q of fipiTasks) {
  if (q.task === '14') {
    const isTargetSlitno = /СЛИТНО/i.test(q.rule);
    const isTargetRazdelno = /РАЗДЕЛЬНО/i.test(q.rule);
    const isTargetDefisno = /ДЕФИС/i.test(q.rule);
    const targetMode = isTargetDefisno ? 'ДЕФИСНО' : isTargetRazdelno ? 'РАЗДЕЛЬНО' : 'СЛИТНО';

    q.rows.forEach((r, rIdx) => {
      let sent = (r.words && r.words[0]) || '';
      let solved = (r.solvedWords && r.solvedWords[0]) || '';
      let exp = r.explanation || '';
      let changed = false;

      // Check bad hyphen tokens in solved text: ПО-ТОМУ, ПО-ЭТОМУ, ЗА-ТО, ОТ-ТОГО, ПРИ-ТОМ, ПРИ-ЧЕМ, ТО-ЖЕ, ТАК-ЖЕ, ЧТО-БЫ
      const badMatches = solved.match(/(?:^|[^а-яёА-ЯЁ])(ПО-ТОМУ|ПО-ЭТОМУ|ЗА-ТО|ОТ-ТОГО|ПРИ-ТОМ|ПРИ-ЧЕМ|ТО-ЖЕ|ТАК-ЖЕ|ЧТО-БЫ)(?:$|[^а-яёА-ЯЁ])/g);
      if (badMatches) {
        for (const m of badMatches) {
          const tokClean = m.replace(/[^а-яёА-ЯЁ-]/g, '').trim();
          const healed = healTask14Token(tokClean, sent, exp);
          if (healed) {
            solved = solved.replace(new RegExp(`(^|[^а-яёА-ЯЁ])${tokClean}([^а-яёА-ЯЁ]|$)`, 'g'), `$1${healed.word}$2`);
            // Clean explanation of bogus rules
            exp = exp
              .replace(/по правилу частицы КОЕ-.*?«[^»]+»/gi, '')
              .replace(/наречие «[^»]+» с приставкой ПО- и суффиксом -ОМУ.*?«[^»]+»/gi, '')
              .replace(/\s{2,}/g, ' ')
              .trim();
            if (!exp.includes(healed.word)) {
              exp = `${healed.word} — ${healed.rule} ${exp}`.trim();
            }
            changed = true;
          }
        }
      }

      if (changed) {
        r.solvedWords = [solved];
        r.explanation = exp;
        fipiHealedRows++;
      }

      // Re-evaluate whether row matches targetMode
      // In Task 14, tokens in parenthesis e.g. (ПО)ТОМУ, (В)ТЕЧЕНИЕ, (КАК)ТО
      const tokenRe = /(?:В\s+КОНЦЕ\s*\(КОНЦОВ\)|\(ТОЧЬ\)\(В\)\(ТОЧЬ\)|\(БОК\)\(О\)\(БОК\)|\(ТАК\)\(ЖЕ\)|[А-ЯЁ]{1,}\([А-ЯЁ-]+\)[А-ЯЁ]{1,}|[А-ЯЁ]{1,}\([А-ЯЁ-]+\)|\([А-ЯЁ-]+\)[А-ЯЁ]{2,})/g;
      const tokens = sent.match(tokenRe) || [];
      const tokenModes = [];

      for (const tok of tokens) {
        const h = healTask14Token(tok, sent, exp);
        if (h) {
          tokenModes.push(h.mode);
        } else {
          // Check how it was solved in `solved`
          const m1 = tok.match(/^([А-ЯЁ]+)\(([А-ЯЁ-]+)\)$/);
          const m2 = tok.match(/^\(([А-ЯЁ-]+)\)([А-ЯЁ]+)$/);
          const p1 = m1 ? m1[1] : m2 ? m2[1] : '';
          const p2 = m1 ? m1[2] : m2 ? m2[2] : '';
          if (p1 && p2) {
            if (solved.includes(`${p1}-${p2}`)) tokenModes.push('ДЕФИСНО');
            else if (solved.includes(`${p1} ${p2}`)) tokenModes.push('РАЗДЕЛЬНО');
            else if (solved.includes(`${p1}${p2}`)) tokenModes.push('СЛИТНО');
          }
        }
      }

      if (tokenModes.length >= 2) {
        const allMatch = tokenModes.every((tm) => tm === targetMode);
        if (allMatch !== r.isCorrectRow) {
          r.isCorrectRow = allMatch;
          fipiCorrectIndicesAdjusted++;
        }
        r.letter = tokenModes.every((tm) => tm === tokenModes[0])
          ? tokenModes[0]
          : tokenModes.join(' / ');
      }
    });

    // Recompute correctIndices
    const validCorr = [];
    q.rows.forEach((r, idx) => {
      if (r.isCorrectRow) validCorr.push(idx + 1);
    });
    if (validCorr.length >= 1) {
      q.correctIndices = validCorr;
    }
  }

  // Task 15 Explanations healing
  if (q.task === '15') {
    q.rows.forEach((r) => {
      const solved = (r.solvedWords && r.solvedWords[0]) || (r.words && r.words[0]) || '';
      if (/слово «.*» с удвоенной|пишется с удвоенной/i.test(r.explanation || '')) {
        r.explanation = explainTask15Word(solved, q.sentence || q.instruction || '');
      }
    });
  }
}

console.log(`FIPI Task 14 rows healed: ${fipiHealedRows}, correctIndices adjusted: ${fipiCorrectIndicesAdjusted}`);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Heal All Words Database
// ─────────────────────────────────────────────────────────────────────────────
console.log('Auditing and healing allWordsBank...');
let wordsHealed = 0;

for (const w of allWords) {
  if (w.task === '14') {
    const badMatch = w.word.match(/(?:^|[^а-яёА-ЯЁ])(ПО-ТОМУ|ПО-ЭТОМУ|ЗА-ТО|ОТ-ТОГО|ПРИ-ТОМ|ПРИ-ЧЕМ|ТО-ЖЕ|ТАК-ЖЕ|ЧТО-БЫ)(?:$|[^а-яёА-ЯЁ])/);
    if (badMatch) {
      const tokClean = badMatch[1];
      const healed = healTask14Token(tokClean, w.context, w.rule);
      if (healed) {
        w.word = healed.word;
        w.missingLetter = healed.mode;
        w.rule = `${healed.word} — ${healed.rule}`;
        wordsHealed++;
      }
    }
  }

  if (w.task === '15') {
    if (/слово «.*» с удвоенной|пишется с удвоенной/i.test(w.rule || '')) {
      w.rule = explainTask15Word(w.word, w.context || '');
      wordsHealed++;
    }
  }
}

console.log(`allWords items healed: ${wordsHealed}`);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Heal Sprint Questions Database
// ─────────────────────────────────────────────────────────────────────────────
console.log('Auditing and healing sprintBank...');
let sprintHealed = 0;

for (const s of sprintQuestions) {
  if (s.task === '14') {
    const rawWord = `${s.prefix || ''}${s.suffix || ''}`;
    const badMatch = rawWord.match(/(ПО-ТОМУ|ПО-ЭТОМУ|ЗА-ТО|ОТ-ТОГО|ПРИ-ТОМ|ПРИ-ЧЕМ|ТО-ЖЕ|ТАК-ЖЕ|ЧТО-БЫ)/);
    if (badMatch) {
      const tokClean = badMatch[1];
      const healed = healTask14Token(tokClean, s.context, s.explanation || s.rule);
      if (healed) {
        s.answer = healed.mode;
        s.options = ['СЛИТНО', 'ДЕФИСНО', 'РАЗДЕЛЬНО'];
        s.explanation = `${healed.word} — ${healed.rule}`;
        s.rule = healed.rule;
        sprintHealed++;
      }
    }
  }

  if (s.task === '15') {
    if (/слово «.*» с удвоенной|пишется с удвоенной/i.test(s.explanation || s.rule || '')) {
      const fullWord = `${s.prefix || ''}${s.answer || ''}${s.suffix || ''}`;
      const richExpl = explainTask15Word(fullWord, s.context || '');
      s.explanation = richExpl;
      s.rule = richExpl;
      sprintHealed++;
    }
  }
}

console.log(`sprintBank items healed: ${sprintHealed}`);

// ─────────────────────────────────────────────────────────────────────────────
// 6. Heal starterBank.json
// ─────────────────────────────────────────────────────────────────────────────
console.log('Auditing and healing starterBank...');
for (const w of starterBank.words || []) {
  if (w.task === '14') {
    const badMatch = w.word.match(/(?:^|[^а-яёА-ЯЁ])(ПО-ТОМУ|ПО-ЭТОМУ|ЗА-ТО|ОТ-ТОГО|ПРИ-ТОМ|ПРИ-ЧЕМ|ТО-ЖЕ|ТАК-ЖЕ|ЧТО-БЫ)(?:$|[^а-яёА-ЯЁ])/);
    if (badMatch) {
      const tokClean = badMatch[1];
      const healed = healTask14Token(tokClean, w.context, w.rule);
      if (healed) {
        w.word = healed.word;
        w.missingLetter = healed.mode;
        w.rule = `${healed.word} — ${healed.rule}`;
      }
    }
  }
  if (w.task === '15') {
    if (/слово «.*» с удвоенной|пишется с удвоенной/i.test(w.rule || '')) {
      w.rule = explainTask15Word(w.word, w.context || '');
    }
  }
}

for (const q of starterBank.fipi || []) {
  if (q.task === '14') {
    q.rows.forEach((r) => {
      let sent = (r.words && r.words[0]) || '';
      let solved = (r.solvedWords && r.solvedWords[0]) || '';
      let exp = r.explanation || '';
      const badMatches = solved.match(/(?:^|[^а-яёА-ЯЁ])(ПО-ТОМУ|ПО-ЭТОМУ|ЗА-ТО|ОТ-ТОГО|ПРИ-ТОМ|ПРИ-ЧЕМ|ТО-ЖЕ|ТАК-ЖЕ|ЧТО-БЫ)(?:$|[^а-яёА-ЯЁ])/g);
      if (badMatches) {
        for (const m of badMatches) {
          const tokClean = m.replace(/[^а-яёА-ЯЁ-]/g, '').trim();
          const healed = healTask14Token(tokClean, sent, exp);
          if (healed) {
            solved = solved.replace(new RegExp(`(^|[^а-яёА-ЯЁ])${tokClean}([^а-яёА-ЯЁ]|$)`, 'g'), `$1${healed.word}$2`);
            exp = exp
              .replace(/по правилу частицы КОЕ-.*?«[^»]+»/gi, '')
              .replace(/наречие «[^»]+» с приставкой ПО- и суффиксом -ОМУ.*?«[^»]+»/gi, '')
              .trim();
            if (!exp.includes(healed.word)) {
              exp = `${healed.word} — ${healed.rule} ${exp}`.trim();
            }
          }
        }
        r.solvedWords = [solved];
        r.explanation = exp;
      }
    });
  }
  if (q.task === '15') {
    q.rows.forEach((r) => {
      const solved = (r.solvedWords && r.solvedWords[0]) || (r.words && r.words[0]) || '';
      if (/слово «.*» с удвоенной|пишется с удвоенной/i.test(r.explanation || '')) {
        r.explanation = explainTask15Word(solved, q.sentence || q.instruction || '');
      }
    });
  }
}

for (const s of starterBank.sprint || []) {
  if (s.task === '14') {
    const rawWord = `${s.prefix || ''}${s.suffix || ''}`;
    const badMatch = rawWord.match(/(ПО-ТОМУ|ПО-ЭТОМУ|ЗА-ТО|ОТ-ТОГО|ПРИ-ТОМ|ПРИ-ЧЕМ|ТО-ЖЕ|ТАК-ЖЕ|ЧТО-БЫ)/);
    if (badMatch) {
      const tokClean = badMatch[1];
      const healed = healTask14Token(tokClean, s.context, s.explanation || s.rule);
      if (healed) {
        s.answer = healed.mode;
        s.options = ['СЛИТНО', 'ДЕФИСНО', 'РАЗДЕЛЬНО'];
        s.explanation = `${healed.word} — ${healed.rule}`;
        s.rule = healed.rule;
      }
    }
  }
  if (s.task === '15') {
    if (/слово «.*» с удвоенной|пишется с удвоенной/i.test(s.explanation || s.rule || '')) {
      const fullWord = `${s.prefix || ''}${s.answer || ''}${s.suffix || ''}`;
      const richExpl = explainTask15Word(fullWord, s.context || '');
      s.explanation = richExpl;
      s.rule = richExpl;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Write All Updates
// ─────────────────────────────────────────────────────────────────────────────
console.log('Writing healed datasets to src/data/ and public/data/ ...');

fs.writeFileSync(srcFipiPath, JSON.stringify(fipiTasks, null, 2));
fs.writeFileSync(srcAllWordsPath, JSON.stringify({ metadata: allWordsObj.metadata || {}, words: allWords }, null, 2));
fs.writeFileSync(srcSprintPath, JSON.stringify(sprintQuestions, null, 2));
fs.writeFileSync(srcStarterPath, JSON.stringify(starterBank));

fs.writeFileSync(pubFipiPath, JSON.stringify(fipiTasks));
fs.writeFileSync(pubAllWordsPath, JSON.stringify({ metadata: allWordsObj.metadata || {}, words: allWords }));
fs.writeFileSync(pubSprintPath, JSON.stringify(sprintQuestions));

console.log('All datasets successfully audited, healed, and saved!');
