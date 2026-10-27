const fs = require("fs");
const path = require("path");

const rawFipi = require("../src/data/fipiTasksBank9_15.json");
const rawAllWordsObj = require("../src/data/allWordsBank9_15.json");
const rawAllWords = Array.isArray(rawAllWordsObj) ? rawAllWordsObj : (rawAllWordsObj.words || []);

function decodeHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&shy;|&#173;/gi, "")
    .replace(/&prime;|&acute;|&#769;|&#x301;/gi, "")
    .replace(/&euml;/gi, "ё").replace(/&Euml;/gi, "Ё")
    .replace(/&aacute;/gi, "а").replace(/&Aacute;/gi, "А")
    .replace(/&oacute;/gi, "о").replace(/&Oacute;/gi, "О")
    .replace(/&eacute;/gi, "е").replace(/&Eacute;/gi, "Е")
    .replace(/&iacute;/gi, "и").replace(/&Iacute;/gi, "И")
    .replace(/&uacute;/gi, "у").replace(/&Uacute;/gi, "У")
    .replace(/&yacute;/gi, "ы").replace(/&Yacute;/gi, "Ы")
    .replace(/&#8210;|&#8211;|&#8212;|&ndash;|&mdash;|&minus;/gi, "—")
    .replace(/&laquo;/gi, "«").replace(/&raquo;/gi, "»")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/[\u0300\u0301]/g, "");
}

function fixHomoglyphs(s) {
  if (!s) return "";
  const map = {
    "a": "а", "e": "е", "o": "о", "p": "р", "c": "с", "x": "х", "y": "у",
    "A": "А", "B": "В", "C": "С", "E": "Е", "H": "Н", "K": "К", "M": "М",
    "O": "О", "P": "Р", "T": "Т", "X": "Х"
  };
  return String(s)
    .replace(/И3\(3А\)/g, "ИЗ(ЗА)")
    .replace(/[aeopcxyABCEHKMOPTX]/g, ch => map[ch] || ch);
}

function cleanScraperArtifacts(text) {
  if (!text) return "";
  return fixHomoglyphs(decodeHtml(text))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\"/g, '"')
    .replace(/\b[0-9a-f]{1,3}:T[0-9a-zA-Z]+,?\s*/g, "")
    .replace(/\(\s*$/, "")
    .replace(/\n\(\s*$/, "")
    .replace(/(?:\n|\s)*(?:Ответ|Источник)\s*:\s*[^\n]*/gi, "")
    .replace(/^\s*Решение\s*:\s*/i, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const EXPLICIT_WORD_ANSWERS = new Map([
  ["10:дет..ясли", "Ъ"],
  ["9:многозн..чительно", "А"],
  ["10:з..помнить", "А"],
  ["10:радиопр..ёмник", "И"],
  ["10:радиопр..емник", "И"],
  ["12:накро..т", "Е"],
  ["12:проветр..нный", "Е"],
  ["9:бл..городный", "А"],
  ["9:бл..стящий", "Е"],
  ["10:пр..валировать", "Е"],
  ["10:под..нтегральный", "Ы"],
  ["10:пред..ставить", "О"],
  ["10:трех..этажный", "—"],
  ["10:трёх..этажный", "—"],
  ["10:четырех..угольный", "—"],
  ["10:четырёх..угольный", "—"],
  ["10:пан..американский", "—"],
  ["10:транс..атлантический", "—"],
  ["10:сверх..энергичный", "—"],
  ["10:с..экономить", "—"],
  ["10:с..узить", "—"],
  ["10:с..агитировать", "—"],
  ["11:гуттаперч..вый", "Е"],
  ["11:ливн..вый", "Е"],
  ["11:изредк..", "А"],
  ["11:направ..", "О"],
  ["11:засветл..", "О"],
  ["11:замоч..к", "Е"],
  ["11:мешоч..к", "Е"],
  ["11:исповед..ваться", "О"],
  ["11:просов..вать", "Ы"],
  ["11:рассыпч..тое", "А"],
  ["11:прикле..л", "И"],
  ["12:ненавид..шь", "И"],
  ["9:выт..реть", "Е"],
  ["9:поч..тать", "И"],
  ["9:ж..ри", "Ю"],
]);

const globalDict = new Map();

const cleanFipiInput = rawFipi.filter(t => {
  if (/fipi-online|100points/.test(t.id)) return false;
  if (t.rows.some(r => /искусственным интеллектом/i.test(r.explanation || ""))) return false;
  if (Number(t.task) <= 12 && t.rows.some(r => r.words.some(w => !/\.{2,}|…/.test(w)))) return false;
  return true;
});

for (const t of cleanFipiInput) {
  if (Number(t.task) <= 12 && t.rows.length === 4) {
    const newRows = [];
    for (const r of t.rows) {
      const expectedPerRow = Number(t.task) <= 10 ? 3 : 2;
      if (r.words.length === expectedPerRow * 2) {
        newRows.push({
          ...r,
          words: r.words.slice(0, expectedPerRow),
          solvedWords: (r.solvedWords || []).slice(0, expectedPerRow),
        });
        newRows.push({
          ...r,
          words: r.words.slice(expectedPerRow),
          solvedWords: (r.solvedWords || []).slice(expectedPerRow),
        });
      } else {
        newRows.push(r);
      }
    }
    t.rows = newRows;
  }
}

// Vote-based globalDict from cleanFipiInput Tasks 9-12
const voteCounts = new Map();
function recordVote(key, letter) {
  if (!voteCounts.has(key)) voteCounts.set(key, new Map());
  const m = voteCounts.get(key);
  m.set(letter, (m.get(letter) || 0) + 1);
}

for (const t of cleanFipiInput) {
  if (Number(t.task) <= 12) {
    const fullExp = fixHomoglyphs(decodeHtml(t.rows.map(r => r.explanation).join("\n")));
    for (const r of t.rows) {
      const rowExp = fixHomoglyphs(decodeHtml(r.explanation || ""));
      for (const rawW of r.words) {
        const w = fixHomoglyphs(decodeHtml(rawW));
        const noParens = w.replace(/\([^)]*\)/g, " ").trim();
        const tokenMatch = noParens.match(/([а-яё-]*)(?:\.{2,}|…)([а-яё-]*)/i);
        if (!tokenMatch) continue;
        const pref = tokenMatch[1].trim();
        const suff = tokenMatch[2].trim();
        const escPref = pref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[её]/gi, "[её]");
        const escSuff = suff.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[её]/gi, "[её]");
        const re = new RegExp("(?<![а-яё])" + escPref + "([а-яё]{1})" + escSuff + "(?![а-яё])", "i");
        const m = rowExp.match(re) || fullExp.match(re);
        if (m) {
          const pLow = pref.toLowerCase().replace(/ё/g, "е");
          const sLow = suff.toLowerCase().replace(/ё/g, "е");
          const ans = m[1].toUpperCase();
          recordVote(`${t.task}:${pLow}..${sLow}`, ans);
          recordVote(`any:${pLow}..${sLow}`, ans);
        }
      }
    }
  }
}

for (const [key, map] of voteCounts.entries()) {
  let bestLetter = null;
  let bestCount = -1;
  for (const [ltr, cnt] of map.entries()) {
    if (cnt > bestCount) {
      bestCount = cnt;
      bestLetter = ltr;
    }
  }
  if (bestLetter) globalDict.set(key, bestLetter);
}

function buildOptionsForSprint(task, pref, suff, ans) {
  const t = String(task);
  const a = ans.toUpperCase();
  const pLow = pref.toLowerCase().replace(/ё/g, "е");
  if (t === "13") return ["СЛИТНО", "РАЗДЕЛЬНО"];
  if (t === "14") return ["СЛИТНО", "ДЕФИСНО", "РАЗДЕЛЬНО"];
  if (t === "15") return ["Н", "НН"];
  if (a === "К" || a === "СК") return ["К", "СК"];
  if (a === "Ъ" || a === "Ь") return ["Ъ", "Ь"];
  if (a === "З" || a === "С") return ["З", "С"];
  if (a === "Ч" || a === "Щ") return ["Ч", "Щ"];
  if (t === "9") {
    if (a === "А" || a === "О") return ["А", "О"];
    if (a === "Ы" || (pLow.endsWith("ц") && a === "И")) return ["И", "Ы"];
    if (a === "Ё" || (/[жшчщ]$/.test(pLow) && a === "О")) return ["Ё", "О"];
    if (a === "У" || a === "Ю") return ["У", "Ю"];
    if (a === "Я") return ["Я", "Е"];
    return ["Е", "И"];
  }
  if (t === "10") {
    if (a === "Ы" || (a === "И" && !pLow.endsWith("пр"))) return ["И", "Ы"];
    if (a === "А" || a === "О") return ["А", "О"];
    return ["Е", "И"];
  }
  if (t === "11") {
    if (a === "А" || a === "О") return ["А", "О"];
    if (a === "Ё") return ["Ё", "О"];
    if (a === "Ы") return ["Ы", "И"];
    if (a === "Я") return ["Я", "Е"];
    if (a === "У") return ["У", "А"];
    return ["Е", "И"];
  }
  if (t === "12") {
    if (a === "У" || a === "А") return ["У", "А"];
    if (a === "Ю" || a === "Я") return ["Ю", "Я"];
    return ["Е", "И"];
  }
  return [a, a === "Е" ? "И" : "Е"];
}

const GRAMMAR_TERM_ONLY_RE = /^(?:имя\s+)?(?:прилагательн|существительн|глагол|деепричаст|причаст|наречи|местоимен|предлог|союз|частиц|числительн|категори[яи]\s+состояни|отглагольн|действительн|страдательн|кратк|полн|неизменяем|возвратн|переходн|непереходн|совершенн|несовершенн|прошедш|настоящ|будущ|инфинитив)[а-яё\s.,\-()]*$/i;

function isGrammarTermWord(w) {
  return /(?:прилагательн|существительн|глагол|деепричаст|причаст|наречи|местоимен|предлог|союз|частиц|числительн|инфинитив|корень|приставк|суффикс|окончан|спряжен|исключен|словарн|оканчивающ|действительн|страдательн|прошедш|настоящ|будущ|совершенн|несовершенн|кратк|полн)/i.test(w);
}

function isRealRuleReason(reason) {
  if (!reason || reason.length < 4) return false;
  if (/буквы разные|ряд подходит|ряд не подходит|не подходит|подходит/i.test(reason)) return false;
  if (/эти приставки пишутся только так/i.test(reason)) return false;
  if (reason.includes("—") && /[а-яё]+\s*—/i.test(reason)) return false;
  if (GRAMMAR_TERM_ONLY_RE.test(reason.trim())) return false;
  const hasGrammarKeyword = /провер|чередован|корень|корн|приставк|суффикс|окончан|спряжен|\bспр\b|искл|словарн|запомнить|ударен|звонк|глух|шипящ|разделительн|значен|пишется|пишем|так как|потому что|\bт\.к\.|от слова|от глагола|образован|\bпс\b|\bпг\b|\bчг\b|\bнг\b/i.test(reason);
  const hasCheckWord = !isGrammarTermWord(reason) && /[а-яё]*[АЕЁИОУЫЭЮЯ][а-яё]+/.test(reason) && reason.split(/\s+/).length <= 4;
  return hasGrammarKeyword || hasCheckWord;
}

function formatBareCheckWord(reason, task) {
  const trimmed = reason.trim().replace(/^[—\-–:\s]+/, "").replace(/[.]+$/, "").trim();
  if (
    String(task) === "9" &&
    /^[А-Яа-яЁё\s\-«»"']{2,25}$/.test(trimmed) &&
    !isGrammarTermWord(trimmed)
  ) {
    return `проверяемая безударная гласная в корне (проверочное слово — «${trimmed.replace(/[«»"']/g, "")}»)`;
  }
  return trimmed;
}

function buildAlgorithmicSteps(task, cleanP, cleanS, ans, contextStr, cleanedExp) {
  const ansChar = ans === "—" ? "" : ans;
  const fullWordDisplay = `${cleanP}${ansChar.toUpperCase()}${cleanS}`;
  const pLow = cleanP.toLowerCase().replace(/ё/g, "е");
  const sLow = cleanS.toLowerCase().replace(/ё/g, "е");
  const wLow = (cleanP + ansChar + cleanS).toLowerCase().replace(/ё/g, "е");

  if (String(task) === "9") {
    if (/^(?:вы|из|при|за|у|по|воз|до|об|пере|с|на|раз|про|самовоз)?г$/.test(pLow) && /^р/.test(sLow) && !/^(?:гориз|горист|горделив|горчиц|горд|горе|огорч|гардер|гармон|гарант|гарнир|гарниз|гарпун)/.test(wLow)) {
      return `Корень с чередованием -ГАР-/-ГОР- в слове «${fullWordDisplay}»; выбор гласной зависит от ударения: без ударения пишется О, под ударением — А (исключения: выгарки, изгарь, пригарь); поэтому в корне пишется буква «${ansChar}».`;
    }
    if (/^(?:о|оз|про)?з$/.test(pLow) && /^р/.test(sLow) && /(?:зар|зор)/.test(wLow)) {
      return `Корень с чередованием -ЗАР-/-ЗОР- в слове «${fullWordDisplay}»; выбор гласной зависит от ударения: в безударном положении всегда пишется А (исключение: зоревать); поэтому в корне пишется буква «${ansChar}».`;
    }
    if (/^(?:при|сопри|непри)?к$/.test(pLow) && /^с/.test(sLow) && /(?:кас|кос)/.test(wLow) && !/косой|косит|коса/i.test(cleanedExp)) {
      return `Корень с чередованием -КАС-/-КОС- в слове «${fullWordDisplay}»; ${ansChar === "А" ? "за корнем следует суффикс -А-, поэтому выбирается корень -КАС-" : "после корня нет суффикса -А-, поэтому выбирается корень -КОС-"}; в корне пишется буква «${ansChar}».`;
    }
    if (/л$/.test(pLow) && /^(?:г|ж)/.test(sLow) && /(?:лаг|лож|полог)/.test(wLow)) {
      return `Корень с чередованием -ЛАГ-/-ЛОЖ- в слове «${fullWordDisplay}»; перед Г (и суффиксом -А-) пишется буква А, перед Ж — буква О (исключение: полог); поэтому в корне пишется буква «${ansChar}».`;
    }
    if (/р$/.test(pLow) && /^(?:ст|щ|с)/.test(sLow) && /(?:раст|ращ|рос|отрасл)/.test(wLow) && !/^(?:роскош|росси|россып|роспис|розыск|розыгр|раствор|растир|растер)/.test(wLow)) {
      const isExc = /росток|ростовщ|отрасл|подрост/.test(wLow);
      return `Корень с чередованием -РАСТ-/-РАЩ-/-РОС- в слове «${fullWordDisplay}»; перед СТ и Щ пишется А, перед С — О${isExc ? " (данное слово является исключением из правила)" : ""}; поэтому в корне пишется буква «${ansChar}».`;
    }
    if (/^(?:в|вы|за|на|об|от|пере|по|под|при|про|со|у)?ск$/.test(pLow) && /^(?:к|ч)/.test(sLow) && /(?:скак|скоч|скач)/.test(wLow) && !/^(?:раскач|накач|выкач|закач|подкач|перекач|вкач|откач|укач|прокач|скача)/.test(wLow)) {
      return `Корень с чередованием -СКАК-/-СКОЧ- в слове «${fullWordDisplay}»; перед К пишется буква А, перед Ч — буква О (исключения: скачок, скачу, скачи); поэтому в корне пишется буква «${ansChar}».`;
    }
    if (/м$/.test(pLow) && /^к/.test(sLow) && /мак|мок/.test(wLow)) {
      return `Корень с чередованием -МАК-/-МОК- в слове «${fullWordDisplay}»; выбор гласной зависит от лексического значения: ${ansChar === "А" ? "-МАК- пишется в значении «погружать в жидкость»" : "-МОК- пишется в значении «пропускать жидкость, становиться мокрым»"}; поэтому пишется буква «${ansChar}».`;
    }
    if (/р$/.test(pLow) && /^вн/.test(sLow) && /(?:равн|ровн|уровн|ровесн)/.test(wLow)) {
      return `Корень с чередованием -РАВН-/-РОВН- в слове «${fullWordDisplay}»; выбор гласной зависит от значения: ${ansChar === "А" ? "-РАВН- в значении «равный, одинаковый» (или исключение равнина)" : "-РОВН- в значении «ровный, гладкий» (или исключение ровесник, уровень, поровну)"}; поэтому пишется буква «${ansChar}».`;
    }
    if (/тв$/.test(pLow) && /^р/.test(sLow) && /(?:твар|твор)/.test(wLow) && !/отвар|варит/i.test(cleanedExp)) {
      return `Корень с чередованием -ТВАР-/-ТВОР- в слове «${fullWordDisplay}»; в безударном положении пишется буква О, под ударением — то, что слышится (исключение: утварь); поэтому пишется буква «${ansChar}».`;
    }
    if (/кл$/.test(pLow) && /^н/.test(sLow) && /(?:клан|клон)/.test(wLow)) {
      return `Корень с чередованием -КЛАН-/-КЛОН- в слове «${fullWordDisplay}»; в безударном положении пишется буква О, под ударением — то, что слышится; поэтому пишется буква «${ansChar}».`;
    }
    if (/пл$/.test(pLow) && /^в/.test(sLow) && /(?:плав|плов)/.test(wLow)) {
      return `Корень с чередованием -ПЛАВ-/-ПЛОВ- в слове «${fullWordDisplay}»; без ударения пишется буква А, кроме слов-исключений «пловец» и «пловчиха»; поэтому пишется буква «${ansChar}».`;
    }
    if (/(?:бер|бир|дер|дир|пер|пир|тер|тир|блест|блист|жег|жиг|стел|стил|чет|чит|замир|замер|умир|умер|отмир|отмер|обмир|обмер)/.test(wLow) && (ansChar === "Е" || ansChar === "И") && /чередован/i.test(cleanedExp)) {
      return `Корень с чередованием Е/И в слове «${fullWordDisplay}»; ${ansChar === "И" ? "после корня следует суффикс -А-, поэтому в корне пишется И" : "после корня нет суффикса -А- (или это слово-исключение сочетать, сочетание), поэтому в корне пишется Е"}; следовательно, пишем букву «${ansChar}».`;
    }
    if (pLow.endsWith("ц") && (ansChar === "И" || ansChar === "Ы")) {
      return `Правописание гласных И/Ы после Ц в корне слова «${fullWordDisplay}»; ${ansChar === "И" ? "в корнях слов после Ц по общему правилу пишется буква И" : "слово входит в перечень исключений (цыган, на цыпочках, цыплёнок, цыкнуть, цыц)"}; поэтому пишется буква «${ansChar}».`;
    }
    if (/[жшчщ]$/.test(pLow) && (ansChar === "О" || ansChar === "Ё" || ansChar === "Е" || ansChar === "Ю" || ansChar === "У")) {
      if (ansChar === "Ю" || ansChar === "У") {
        return `Правописание гласных после шипящих в корне слова «${fullWordDisplay}»; ${ansChar === "Ю" ? "иноязычное слово-исключение (брошюра, жюри, парашют)" : "после шипящих по общему правилу пишется буква У"}; поэтому пишется буква «${ansChar}».`;
      }
      return `Правописание О/Ё после шипящих в корне слова «${fullWordDisplay}»; ${ansChar === "О" ? "словарное написание без чередования с Е (или существительное ожог/поджог)" : "в ударной позиции можно подобрать однокоренное слово с буквой Е"}; поэтому пишется буква «${ansChar}».`;
    }
    if (/словарн|непровер|запомнить/i.test(cleanedExp)) {
      return `В корне слова «${fullWordDisplay}» находится непроверяемая безударная гласная; подобрать проверочное слово под ударением нельзя (словарное слово ФИПИ); написание с буквой «${ansChar}» необходимо запомнить.`;
    }
    return `В корне слова «${fullWordDisplay}» находится безударная гласная; для проверки нужно изменить форму слова или подобрать однокоренное слово так, чтобы гласная оказалась под ударением; в корне пишется буква «${ansChar}».`;
  }

  if (String(task) === "10") {
    if (ans === "—") {
      return `В слове «${cleanP}${cleanS}» стык приставки и корня перед гласной А, О, У или Э; разделительный Ъ пишется только перед йотированными буквами Е, Ё, Ю, Я; поэтому разделительный знак здесь не ставится.`;
    }
    if (ansChar === "Ъ" || ansChar === "Ь") {
      return `Правописание разделительных Ъ и Ь в слове «${fullWordDisplay}»; ${ansChar === "Ъ" ? `корень начинается с йотированной гласной (Е, Ё, Ю, Я) после приставки «${cleanP.toUpperCase()}-» на согласную` : "орфограмма находится внутри корня (а не после приставки) перед буквами Е, Ё, Ю, Я, И"}; поэтому пишется разделительный «${ansChar}».`;
    }
    if (pLow.endsWith("пр") && (ansChar === "Е" || ansChar === "И")) {
      if (ansChar === "Е" && sLow.startsWith("д")) {
        return `Выделяется приставка ПРЕД- в слове «${fullWordDisplay}»; русская приставка ПРЕД- (ПРЕДО-) является неизменяемой (приставки ПРИД- не существует); поэтому пишется буква «Е».`;
      }
      return `Правописание смысловых приставок ПРЕ-/ПРИ- в слове «${fullWordDisplay}»; ${ansChar === "Е" ? "приставка ПРЕ- передаёт значение высокой степени качества («очень»), значение «пере-» или входит в состав словарного слова" : "приставка ПРИ- передаёт значение приближения, присоединения, близости, неполноты действия или входит в состав словарного слова"}; поэтому пишется буква «${ansChar}».`;
    }
    if (pLow.endsWith("пр") && (ansChar === "А" || ansChar === "О")) {
      return `Правописание приставок ПРА-/ПРО- в слове «${fullWordDisplay}»; ${ansChar === "А" ? "слово имеет значение древности, первоначальности или прямого родства" : "слово не связано со значением древности или прямого родства"}; поэтому пишется приставка с буквой «${ansChar}».`;
    }
    if (ansChar === "Ы" || ansChar === "И") {
      if (/^(меж|сверх)/.test(pLow)) {
        return `Правописание Ы/И после приставок в слове «${fullWordDisplay}»; после русских приставок МЕЖ- и СВЕРХ- переход И в Ы не происходит (исключение из правила); поэтому сохраняется буква «И».`;
      }
      if (wLow.startsWith("взима")) {
        return `Правописание Ы/И после приставок в слове «${fullWordDisplay}»; глагол «взимать» является исключением ФИПИ (произносится со звуком [и]); поэтому после приставки ВЗ- сохраняется буква «И».`;
      }
      if (ansChar === "Ы") {
        return `Правописание Ы/И после приставок в слове «${fullWordDisplay}»; корень исходного слова начинается с И, а перед ним стоит русская приставка «${cleanP.toUpperCase()}-» на согласную; поэтому по правилу И меняется на «Ы».`;
      }
      return `Правописание Ы/И после приставок в слове «${fullWordDisplay}»; перед корнем на И стоит иноязычная приставка (ДЕЗ-, КОНТР-, СУПЕР-, ПОСТ-, ТРАНС-, СУБ-), приставка на гласную или первая часть сложносокращённого слова; поэтому начальная буква «И» сохраняется.`;
    }
    if (ansChar === "З" || ansChar === "С") {
      if ((pLow === "не" || pLow === "пере") && ansChar === "С") {
        return `Анализ морфемного состава слова «${fullWordDisplay}»; в слове выделяются две приставки: «${pLow.toUpperCase()}-» и неизменяемая приставка «С-» (приставки З- в русском языке не существует); поэтому всегда пишется буква «С».`;
      }
      const nextCons = cleanS.charAt(0).toLowerCase();
      return `Правописание приставки на -З/-С в слове «${fullWordDisplay}»; выбор согласной зависит от следующего звука корня: перед ${ansChar === "З" ? `звонким согласным «${nextCons}»` : `глухим согласным «${nextCons}»`}; поэтому на конце приставки пишется буква «${ansChar}».`;
    }
    if (pLow === "р" && /^[зс]/.test(sLow) && (ansChar === "А" || ansChar === "О")) {
      return `Правописание приставок РАЗ-/РАС- и РОЗ-/РОС- в слове «${fullWordDisplay}»; выбор гласной зависит от ударения: ${ansChar === "О" ? "под ударением пишется О" : "в безударной позиции пишется А"}; поэтому пишется буква «${ansChar}».`;
    }
    const prefixName = (cleanP + ansChar).toUpperCase();
    return `Правописание приставки в слове «${fullWordDisplay}»; неизменяемая русская приставка «${prefixName}-» всегда пишется единообразно независимо от произношения; поэтому пишется буква «${ansChar}».`;
  }

  if (String(task) === "11") {
    if (ans === "—" || ansChar === "К" || ansChar === "СК" || ansChar === "С") {
      const isSk = ansChar === "СК" || ansChar === "С";
      return `Определяем суффикс имени прилагательного «${fullWordDisplay}»; ${isSk ? "относительное прилагательное образовано от основы не на К, Ч, Ц, поэтому выбирается суффикс -СК-" : "прилагательное качественное (имеет краткую форму) или образовано от основы на К, Ч, Ц, поэтому выбирается суффикс -К-"}; пишется «${ansChar}».`;
    }
    if (/^(милостив|юродив)/.test(wLow)) {
      return `Определяем суффикс имени прилагательного «${fullWordDisplay}»; слова «милостивый» и «юродивый» являются исключениями: в безударном положении в них пишется суффикс -ИВ-; поэтому пишется буква «И».`;
    }
    if (/^ва(ть|ться|я|ющ|вш|л)/.test(sLow)) {
      if (/^(затмева|продлева|застрева|встрева|намерева|сомнева|увещева|обурева|подозрева|разева|растлева|затева|недоумева)/.test(wLow)) {
        return `Глагольная форма «${fullWordDisplay}» с ударным суффиксом -ВА-; данное слово относится к перечню глаголов-исключений перед ударным суффиксом -ВА- (затмевать, продлевать, застревать, недоумевать, сомневаться); поэтому перед -ВА- пишется буква «Е».`;
      }
      return `Определяем глагольный суффикс в слове «${fullWordDisplay}»; ставим глагол в форму 1-го лица ед. ч. («я что делаю?»): ${ansChar === "О" || ansChar === "Е" ? "суффикс выпадает и оканчивается на -УЮ/-ЮЮ, поэтому пишется суффикс -ОВА-/-ЕВА-" : "суффикс сохраняется (-ЫВАЮ/-ИВАЮ) или перед ударным -ВА- сохраняется гласная инфинитива"}; поэтому пишется буква «${ansChar}».`;
    }
    if (/[чл]$/.test(pLow) && /^в(ый|ая|ое|ые|ость|о)/.test(sLow) && ansChar === "И" && !/^(?:гуттаперчев|ключев|грушев|плюшев|грошев|марлев|тюлев|фланелев|магнолиев|алюминиев|гелиев|калиев|натриев|волев|болев|нулев|рулев|целев|солев|полев|долев|щавелев|фасолев|миндалев|вермишелев)/.test(wLow)) {
      return `Морфемный разбор прилагательного «${fullWordDisplay}»; буква Ч/Л не входит в корень, выделяется неизменяемый суффикс -ЧИВ- или -ЛИВ- (суффиксов -ЧЕВ-/-ЛЕВ- в русском языке нет); поэтому всегда пишется буква «И».`;
    }
    if (/^в(ый|ая|ое|ые|ого|ому|ым|ом|ую|ой|ых|ыми)/.test(sLow) && (ansChar === "Е" || ansChar === "И")) {
      return `Определяем суффикс прилагательного -ИВ-/-ЕВ- в слове «${fullWordDisplay}»; выбор гласной зависит от ударения: ${ansChar === "И" ? "под ударением пишется суффикс -ИВ-" : "в безударном положении пишется суффикс -ЕВ-"}; поэтому пишется буква «${ansChar}».`;
    }
    if (ansChar === "Ч" || ansChar === "Щ") {
      return `Определяем суффикс существительного со значением лица -ЧИК-/-ЩИК- в слове «${fullWordDisplay}»; смотрим на согласную перед суффиксом: ${ansChar === "Ч" ? "после букв Д, Т, З, С, Ж всегда пишется суффикс -ЧИК-" : "перед суффиксом стоит согласная не из ряда Д, Т, З, С, Ж, поэтому пишется -ЩИК-"}; следовательно, пишем букву «${ansChar}».`;
    }
    if (sLow === "" && (ansChar === "А" || ansChar === "О")) {
      return `Определяем суффикс на конце наречия «${fullWordDisplay}»; наречие образовано приставочно-суффиксальным способом: ${ansChar === "А" ? "с приставками ИЗ-, ДО-, С- на конце пишется суффикс -А" : "с приставками В-, НА-, ЗА- на конце пишется суффикс -О"}; поэтому пишется буква «${ansChar}».`;
    }
    if (/^(?:ть|ться|л|ла|ло|ли|лся|лась|лось|лись)$/.test(sLow)) {
      return `Глагольная форма инфинитива или прошедшего времени «${fullWordDisplay}»; перед суффиксом -ТЬ или суффиксом прошедшего времени -Л- сохраняется гласная основы инфинитива; поэтому пишется буква «${ansChar}».`;
    }
    if (/[жшчщ]$/.test(pLow) && (ansChar === "О" || ansChar === "Ё" || ansChar === "Е")) {
      return `Правописание гласных О/Ё/Е после шипящих в суффиксе слова «${fullWordDisplay}»; ${ansChar === "Ё" ? "слово образовано от глагола (или причастия), поэтому под ударением в суффиксе пишется Ё" : ansChar === "О" ? "в суффиксе отыменного существительного/прилагательного или наречия под ударением после шипящей пишется О" : "в безударном положении в суффиксе после шипящей пишется Е"}; поэтому пишется буква «${ansChar}».`;
    }
    return `Морфемный разбор суффикса в слове «${fullWordDisplay}»; написание суффикса определяется частью речи, положением ударения и производящей основой; по правилу словообразования пишется буква «${ansChar}».`;
  }

  if (String(task) === "12") {
    if (sLow.startsWith("вш") || /^(?:ть|ться|л|ла|ло|ли|лся|лась)$/.test(sLow)) {
      return `Действительное причастие или глагол прошедшего времени «${fullWordDisplay}»; выбор гласной перед суффиксом -ВШ- (или -Л-) НЕ зависит от спряжения — сохраняется та же гласная, что стоит перед -ТЬ в инфинитиве; поэтому пишется буква «${ansChar}».`;
    }
    if (/^нн(ый|ая|ое|ые|ого|ому|ым|ом|ую|ой|ых|ыми|о|ы)/.test(sLow)) {
      return `Страдательное причастие прошедшего времени «${fullWordDisplay}»; выбор гласной перед -НН- зависит от инфинитива: ${ansChar === "Е" || ansChar === "Ё" ? "глагол в начальной форме оканчивается на -ИТЬ или -ЕТЬ, поэтому И/Е меняется на суффикс -ЕНН-/-ЁНН-" : `глагол в начальной форме оканчивается на -${ansChar}ТЬ, поэтому гласная основы «${ansChar}» сохраняется перед -НН-`}; пишем букву «${ansChar}».`;
    }
    if (sLow.startsWith("щ")) {
      return `Действительное причастие настоящего времени «${fullWordDisplay}»; определяем спряжение производящего глагола по инфинитиву: глагол относится ко ${ansChar === "У" || ansChar === "Ю" ? "I спряжению, поэтому выбирается суффикс -УЩ-/-ЮЩ-" : "II спряжению, поэтому выбирается суффикс -АЩ-/-ЯЩ-"}; пишем букву «${ansChar}».`;
    }
    if (sLow.startsWith("м")) {
      return `Страдательное причастие настоящего времени «${fullWordDisplay}»; определяем спряжение глагола по инфинитиву: глагол относится ко ${ansChar === "Е" ? "I спряжению, поэтому пишется суффикс -ЕМ-" : "II спряжению (или слово-исключение «движимый»), поэтому пишется суффикс -ИМ-"}; пишем букву «${ansChar}».`;
    }
    return `Личная форма глагола настоящего/будущего времени «${fullWordDisplay}»; определяем спряжение глагола по начальной форме (инфинитиву): глагол относится ко ${ansChar === "И" || ansChar === "А" || ansChar === "Я" ? "II спряжению (окончания -ИШЬ, -ИТ, -ИМ, -ИТЕ, -АТ/-ЯТ)" : "I спряжению (окончания -ЕШЬ, -ЕТ, -ЕМ, -ЕТЕ, -УТ/-ЮТ)"}; поэтому в окончании пишется буква «${ansChar}».`;
  }

  if (String(task) === "15") {
    if (ansChar === "Н") {
      if (/(?:н|на|но|ны)$/.test(wLow) && !/ый|ая|ое|ые|ого|ому|ым|ом|ую|ой|ых|ыми/.test(sLow)) {
        return `Краткая форма страдательного причастия «${fullWordDisplay}»; обозначает действие предметного признака (можно заменить глаголом прошедшего времени); в кратких страдательных причастиях всегда пишется одна буква «Н».`;
      }
      if (/^(?:кожа|глиня|серебря|песча|нефтя|водя|ледя|травя|земля|шерстя|полотня|берестя|овся|ржа|льня|багря|румя|ю|си|зеле|пря|пья|рья|сви|бара|овеч|ути|гуси|лебеди|орли|пчели|мыши|лошади|петуши|соловьи|звери|птич|соколи|голуби|воробьи|комари|змеи|тополи|журавли)/.test(wLow)) {
        return `Отыменное (или первообразное) прилагательное «${fullWordDisplay}»; образовано от существительного при помощи суффикса -АН-/-ЯН-/-ИН- (либо корень сам оканчивается на -Н без суффикса) и не входит в исключения стеклянный, оловянный, деревянный; поэтому пишется одна буква «Н».`;
      }
      if (wLow.startsWith("ветрен")) {
        return `Прилагательное «${fullWordDisplay}» с суффиксом -ЕН-; слово «ветреный» (без приставки) является словарным исключением; поэтому пишется с одной буквой «Н».`;
      }
      return `Отглагольное прилагательное (или производное от него слово) «${fullWordDisplay}»; образовано от бесприставочного глагола несовершенного вида и не имеет зависимых слов; поэтому пишется одна буква «Н».`;
    } else {
      if (/^(?:деревя|оловя|стекля)/.test(wLow)) {
        return `Отыменное прилагательное «${fullWordDisplay}»; входит в тройку классических исключений (стеклянный, оловянный, деревянный) с суффиксом -ЯНН-; поэтому пишется две буквы «НН».`;
      }
      return `Слово «${fullWordDisplay}» с удвоенной согласной НН; образовано от глагола совершенного вида (есть приставка или зависимые слова), либо от существительного с суффиксом -ОНН-/-ЕНН- или на стыке основы на -Н и суффикса -Н-; поэтому пишется две буквы «НН».`;
    }
  }

  return `Слово «${fullWordDisplay}»; правописание определяется правилом задания №${task} ЕГЭ; пишется «${ansChar}».`;
}

function isolateOrGenerateWordExplanation(task, pref, suff, ans, rawExp, contextStr) {
  const cleanP = pref.replace(/\([^)]*\)/g, "").trim();
  const cleanS = suff.replace(/\([^)]*\)/g, "").trim();
  const ansChar = ans === "—" ? "" : ans;
  const fullWordDisplay = `${cleanP}${ansChar.toUpperCase()}${cleanS}`;
  const fullWordLower = (cleanP + ansChar + cleanS).toLowerCase().replace(/ё/g, "е");
  const pLow = cleanP.toLowerCase().replace(/ё/g, "е");
  const sLow = cleanS.toLowerCase().replace(/ё/g, "е");
  const wLow = fullWordLower;
  const labelWithCtx = `${fullWordDisplay}${contextStr ? ` ${contextStr}` : ""}`;

  // 1. Exact homophone pairs in Task 9 & Task 10
  if (String(task) === "9") {
    if (/^зап[еи]ва/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне омонимичного слова; подбираем проверочное слово по контексту — «${ansChar === "И" ? "пИть" : "пЕть"}»; поэтому в корне пишется буква «${ansChar}».`;
    }
    if (/^пол[ао]ск/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово по смыслу — «${ansChar === "О" ? "полОщет (бельё в воде)" : "лАска (проявлять нежность)"}»; поэтому в корне пишется буква «${ansChar}».`;
    }
    if (/^прож[еи]ва/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово по контексту — «${ansChar === "И" ? "жИть" : "жЁваный"}»; поэтому в корне пишется буква «${ansChar}».`;
    }
    if (/^посв[ея]т|^осв[ея]т/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово по контексту — «${ansChar === "Я" ? "свЯтость, свЯт" : "свЕт, свЕтит"}»; поэтому пишется буква «${ansChar}».`;
    }
    if (/^к[ао]мпани/.test(wLow)) {
      return `${labelWithCtx} — словарное слово-омофон; ${ansChar === "А" ? "«кАмпания» пишется с А в значении «совокупность мероприятий, военный поход, выборы»" : "«кОмпания» пишется с О в значении «группа людей, общество друзей»"}; поэтому пишется буква «${ansChar}».`;
    }
    if (/^ч[аи]стот/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово — «${ansChar === "А" ? "чАстый" : "чИстый"}»; поэтому пишется буква «${ansChar}».`;
    }
    if (/^ум[ао]ля/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово — «${ansChar === "О" ? "мОлит (о помощи)" : "мАлый (преуменьшать значение)"}»; поэтому пишется буква «${ansChar}».`;
    }
    if (/^прим[еи]ря/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово — «${ansChar === "Е" ? "мЕрить, примЕрка" : "мИр, мИрный"}»; поэтому пишется буква «${ansChar}».`;
    }
    if (/^разв[еи]ва/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово — «${ansChar === "Е" ? "вЕять (колыхаться на ветру)" : "развИтие (совершенствовать)"}»; поэтому пишется буква «${ansChar}».`;
    }
    if (/^прив[еи]дени/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово — «${ansChar === "Е" ? "привЁл (к знаменателю, в порядок)" : "вИдеть (призрак)"}»; поэтому пишется буква «${ansChar}».`;
    }
    if (/^разр[ея]ди/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово — «${ansChar === "Я" ? "разрЯд, зарЯд" : "рЕдкий (сделать негустым)"}»; поэтому пишется буква «${ansChar}».`;
    }
    if (/^отв[ао]ри/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово — «${ansChar === "А" ? "вАрит (в кипятке)" : "ствОрка, затвОр (открыть)"}»; поэтому пишется буква «${ansChar}».`;
    }
    if (/^сп[еи]ши/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово — «${ansChar === "И" ? "пИшет" : "спЕшка"}»; поэтому пишется буква «${ansChar}».`;
    }
    if (/^ст[ао]рожил/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово — «${ansChar === "О" ? "стОрож (охранял объект)" : "стАрый (давний житель местности)"}»; поэтому пишется буква «${ansChar}».`;
    }
    if (/^зап[еи]вал/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово — «${ansChar === "Е" ? "пЕть (солист в хоре)" : "пИть (водой)"}»; поэтому пишется буква «${ansChar}».`;
    }
    if (/^зал[еи]за/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово — «${ansChar === "Е" ? "лЕзть (наверх)" : "лИжет (языком)"}»; поэтому пишется буква «${ansChar}».`;
    }
    if (/^нав[еи]ва/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово — «${ansChar === "И" ? "вИть (локоны)" : "вЕять (скуку, воспоминания)"}»; поэтому пишется буква «${ansChar}».`;
    }
    if (/^выт[еи]снен/.test(wLow)) {
      return `${labelWithCtx} — проверяемая безударная гласная в корне; проверочное слово — «${ansChar === "Е" ? "тЕсный (вытеснить)" : "тИснуть (выдавить узор)"}»; поэтому пишется буква «${ansChar}».`;
    }
  }

  if (String(task) === "10" && pLow === "пр") {
    if (sLow.startsWith("твор")) {
      return `${labelWithCtx} — смысловая приставка ПРЕ-/ПРИ-; ${ansChar === "Е" ? "«претворить (в жизнь)» имеет значение «воплотить, осуществить» (приставка ПРЕ-)" : "«притворить (дверь, калитку)» имеет значение неполноты действия (приставка ПРИ-)"}; поэтому пишется буква «${ansChar}».`;
    }
    if (sLow.startsWith("быва")) {
      return `${labelWithCtx} — смысловая приставка ПРЕ-/ПРИ-; ${ansChar === "Е" ? "«пребывать» имеет значение «находиться где-либо» (приставка ПРЕ-)" : "«прибывать» имеет значение приближения, приезда (приставка ПРИ-)"}; поэтому пишется буква «${ansChar}».`;
    }
    if (sLow.startsWith("ступ")) {
      return `${labelWithCtx} — смысловая приставка ПРЕ-/ПРИ-; ${ansChar === "Е" ? "«преступить (закон)» близко по значению к приставке ПЕРЕ- («переступить»)" : "«приступить (к делу)» обозначает начало и приближение к действию"}; поэтому пишется буква «${ansChar}».`;
    }
    if (sLow.startsWith("емник")) {
      return `${labelWithCtx} — смысловая приставка ПРЕ-/ПРИ-; ${ansChar === "Е" ? "«преемник» = продолжатель традиций (перенимает дело, приставка ПРЕ-)" : "«приёмник» = устройство, принимающее сигнал (присоединение, приставка ПРИ-)"}; поэтому пишется буква «${ansChar}».`;
    }
    if (sLow.startsWith("ходящ")) {
      return `${labelWithCtx} — смысловая приставка ПРЕ-/ПРИ-; ${ansChar === "Е" ? "«преходящий» = временный, проходящий (близко к ПЕРЕ-)" : "«приходящий» = тот, кто приходит (значение приближения)"}; поэтому пишется буква «${ansChar}».`;
    }
    if (sLow.startsWith("клон")) {
      return `${labelWithCtx} — смысловая приставка ПРЕ-/ПРИ-; ${ansChar === "Е" ? "«преклонить (колени, голову)» выражает высшую степень уважения (приставка ПРЕ-)" : "«приклонить (ветку к земле)» обозначает приближение и неполноту действия"}; поэтому пишется буква «${ansChar}».`;
    }
    if (sLow.startsWith("дат") || sLow === "дать") {
      return `${labelWithCtx} — смысловая приставка ПРЕ-/ПРИ-; ${ansChar === "Е" ? "«предать» = изменить, передать врагу (близко к ПЕРЕ-)" : "«придать (сил, форму)» = добавить, присоединить"}; поэтому пишется буква «${ansChar}».`;
    }
  }

  let cleanedExp = cleanScraperArtifacts(rawExp || "");
  cleanedExp = cleanedExp.replace(/^[1-9]\s*[\)\.\-–:]\s*/, "").trim();

  let isolatedReason = "";
  if (cleanedExp && String(task) !== "13" && String(task) !== "14") {
    const escP = cleanP.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[её]/gi, "[её]");
    const escS = cleanS.slice(0, Math.max(1, cleanS.length - 1)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[её]/gi, "[её]");

    // Match word followed by 1 or 2 parenthetical groups; check the SECOND parenthetical first if present (since the 1st is often context or POS)
    const reParen2 = new RegExp(`(?<![а-яё])${escP}[а-яё]{0,2}${escS}[а-яё]*(?:\\s*\\(([^()]{1,60})\\))?\\s*\\(([^()]{3,220})\\)`, "ig");
    let m;
    while ((m = reParen2.exec(cleanedExp)) !== null) {
      const cand2 = (m[2] || "").trim().replace(/\)+$/, "").trim();
      const cand1 = (m[1] || "").trim().replace(/\)+$/, "").trim();
      if (isRealRuleReason(cand2)) {
        isolatedReason = formatBareCheckWord(cand2, task);
        break;
      } else if (isRealRuleReason(cand1)) {
        isolatedReason = formatBareCheckWord(cand1, task);
        break;
      }
    }

    if (!isolatedReason) {
      // Split by newlines or numbered items, NOT by internal semicolons of the same word
      const lines = cleanedExp
        .split(/\n+|(?=(?:^|\s)[1-5]\s*[\)\.])/)
        .map(s => s.replace(/^[1-9]\s*[\)\.\-–:]\s*/, "").trim())
        .filter(Boolean);
      for (const line of lines) {
        // Also split only if semicolon or period is followed by a NEW word + dash (`; слово2 — ...` or `. слово2 — ...`)
        const subChunks = line.split(/(?:;|\.)\s+(?=[А-Яа-яЁё\-]+(?:\s*\([^)]+\))*\s*[—\-–]\s)/);
        for (const seg of subChunks) {
          const dashMatch = seg.match(/^([^—\-–,.;]{2,45}?)\s*[—\-–]\s*(.+)$/);
          if (dashMatch) {
            const leftNorm = dashMatch[1].toLowerCase().replace(/ё/g, "е");
            const rightReason = dashMatch[2].trim().replace(/[.]+$/, "");
            if (leftNorm.includes(fullWordLower) && isRealRuleReason(rightReason)) {
              isolatedReason = formatBareCheckWord(rightReason, task);
              break;
            }
          }
        }
        if (isolatedReason) break;
      }
    }
  }

  const algoSteps = buildAlgorithmicSteps(task, cleanP, cleanS, ans, contextStr, cleanedExp);

  if (isolatedReason) {
    // Check if isolatedReason already has >=2 steps (contains `;` or `→`) and is sufficiently detailed (>= 55 chars)
    if ((isolatedReason.includes(";") || isolatedReason.includes("→")) && isolatedReason.length >= 55) {
      return `${labelWithCtx} — ${isolatedReason.replace(/[,;.\s]+$/, "")}.`;
    }
    // If Task 9 isolatedReason contains a specific check word, format a clean 3-step explanation around it
    if (String(task) === "9") {
      const cwMatch = isolatedReason.match(/«([А-Яа-яЁё\u0300-\u036f\-]+)»/);
      if (cwMatch && !GRAMMAR_TERM_ONLY_RE.test(cwMatch[1])) {
        return `${labelWithCtx} — проверяемая безударная гласная в корне слова «${fullWordDisplay}»; подбираем однокоренное проверочное слово, где гласная стоит под ударением: «${cwMatch[1]}»; поэтому в корне пишется буква «${ansChar}».`;
      }
    }
  }

  return `${labelWithCtx} — ${algoSteps}`;
}

function buildTask13Explanation(nePart, wordPart, rowAns, sent, rowExp) {
  const solvedWord = `${nePart}${rowAns === "СЛИТНО" ? "" : " "}${wordPart.toUpperCase()}`;
  const wLow = wordPart.toLowerCase().replace(/ё/g, "е");
  const beforeNe = sent.slice(0, sent.toUpperCase().indexOf(`(${nePart})`)).toLowerCase();

  let cleaned = (rowExp || "")
    .replace(/^[1-5Зз]\s*[\)\.\-–:]\s*/, "")
    .replace(/["“]([^"”]+)["”]/g, "«$1»")
    .trim();

  // Strip leading copy of the full sentence before ` — `
  const dashIdx = cleaned.indexOf(" — ");
  if (dashIdx > 0) {
    cleaned = cleaned.slice(dashIdx + 3).trim();
  } else {
    const shortDashMatch = cleaned.match(/^(?:[А-Яа-яЁё\s]{2,30}?)\s+[—\-–]\s+(.+)$/);
    if (shortDashMatch) cleaned = shortDashMatch[1].trim();
  }

  // Convert period-separated sentences into `; ` steps so all steps stay together
  cleaned = cleaned
    .replace(/\.\s+(?=[А-ЯЁа-яё])/g, "; ")
    .replace(/[,;.\s]+$/, "")
    .trim();

  // Determine exact algorithmic 3-step explanation for Task 13
  let algo = "";
  if ((wLow.startsWith("смотря") || wLow.startsWith("взирая")) && rowAns === "СЛИТНО") {
    algo = `производный предлог «${solvedWord.toLowerCase()}» (в значении «вопреки чему-либо»); не обозначает добавочного действия взглядом; поэтому всегда пишется СЛИТНО — «${solvedWord}»`;
  } else if ((wLow.startsWith("смотря") || wLow.startsWith("взирая")) && rowAns === "РАЗДЕЛЬНО") {
    algo = `деепричастие от глагола «смотреть / взирать» в прямом значении («не глядя глазами»); частица НЕ с деепричастиями пишется раздельно; поэтому пишется РАЗДЕЛЬНО — «${solvedWord}»`;
  } else if (/^(?:рад|рада|рады|должен|должна|должны|готов|готова|готовы|намерен|намерена|намерены|обязан|обязана|обязаны|способен|способна|способны|согласен|согласна|согласны|прав|права|правы|виноват|виновата|виноваты|жаль|пора|надо|нужно|видно|слышно)$/i.test(wLow) && rowAns === "РАЗДЕЛЬНО") {
    algo = `краткое прилагательное или слово категории состояния «${wordPart.toLowerCase()}» в роли сказуемого; такие слова не имеют полной формы (или употреблены как предикатив) и всегда пишутся с частицей ${nePart} раздельно; поэтому пишется РАЗДЕЛЬНО — «${solvedWord}»`;
  } else if (/(?:далеко|вовсе|отнюдь|ничуть|нисколько|нимало)\s+$/.test(beforeNe) && rowAns === "РАЗДЕЛЬНО") {
    algo = `перед словом «${wordPart.toLowerCase()}» стоит отрицательное усилительное слово («далеко не / вовсе не / отнюдь не / ничуть не»); наличие зависимого усилительного слова требует раздельного написания частицы ${nePart}; поэтому пишется РАЗДЕЛЬНО — «${solvedWord}»`;
  } else if (/,\s*а\s+|\s+а\s+/.test(sent.toLowerCase()) && rowAns === "РАЗДЕЛЬНО") {
    algo = `в предложении есть прямое противопоставление с противительным союзом «А»; при противопоставлении частица ${nePart} пишется со словом раздельно; поэтому пишется РАЗДЕЛЬНО — «${solvedWord}»`;
  } else if (/(?:н|на|но|ны)$/i.test(wLow) && rowAns === "РАЗДЕЛЬНО" && /причаст/i.test(cleaned)) {
    algo = `краткое страдательное причастие «${wordPart.toLowerCase()}» в роли сказуемого; с краткими причастиями частица ${nePart} всегда пишется в два слова независимо от зависимых слов; поэтому пишется РАЗДЕЛЬНО — «${solvedWord}»`;
  } else if (/^(?:году|годова|доумев|взлюб|навид|истов|леп|рях|вежд|веж|брежн|уклюж|избежн|утомим|поколебим|скончаем|иссякаем|сокрушим|отъемлем|приступн|стерпим|удержим|вредим|победим|уязвим|постижим|изгладим|одолим|отразим)/i.test(wLow) && rowAns === "СЛИТНО") {
    algo = `слово «${solvedWord.toLowerCase()}» не употребляется в современном русском языке без частицы/приставки ${nePart}-; слова любой части речи, не существующие без НЕ, пишутся в одно слово; поэтому пишется СЛИТНО — «${solvedWord}»`;
  } else if (/[ое]$/i.test(wLow) && rowAns === "СЛИТНО") {
    algo = `наречие на -О/-Е «${solvedWord.toLowerCase()}» (образовано от качественного прилагательного); в предложении нет противопоставления с союзом «А» и слов «далеко не, вовсе не, отнюдь не», можно подобрать синоним без НЕ; поэтому пишется СЛИТНО — «${solvedWord}»`;
  } else if (/(?:ущ|ющ|ащ|ящ|вш|ш|ем|им|ом|енн|ённ|анн|янн|т)(?:ый|ая|ое|ые|ого|ому|ым|им|ом|ем|ую|юю|ой|ей|ых|их|ыми|ими)(?:ся|сь)?$/i.test(wLow)) {
    algo = rowAns === "СЛИТНО"
      ? `полное причастие «${solvedWord.toLowerCase()}»; у причастия в данном предложении нет зависимых (пояснительных) слов и нет противопоставления с союзом «А»; поэтому с приставкой ${nePart}- пишется СЛИТНО — «${solvedWord}»`
      : `полное причастие «${wordPart.toLowerCase()}» в составе причастного оборота; при наличии зависимых слов (или противопоставления с союзом «А») частица ${nePart} с полным причастием пишется раздельно; поэтому пишется РАЗДЕЛЬНО — «${solvedWord}»`;
  } else if (/(?:ть|ться|ти|чь|л|ла|ло|ли|лся|лась|ет|ит|ут|ют|ат|ят|ешь|ишь|ем|им|ете|ите)$/i.test(wLow) && rowAns === "РАЗДЕЛЬНО") {
    algo = `личная форма глагола (или инфинитив) «${wordPart.toLowerCase()}»; частица ${nePart} с глаголами пишется раздельно (слово употребляется без НЕ и не имеет приставки НЕДО-); поэтому пишется РАЗДЕЛЬНО — «${solvedWord}»`;
  } else if (/[аяыи]я(?:ся|сь)?$|[аяу]чи$/i.test(wLow) && rowAns === "РАЗДЕЛЬНО") {
    algo = `деепричастие «${wordPart.toLowerCase()}»; частица ${nePart} с деепричастиями пишется раздельно (слово свободно употребляется без НЕ); поэтому пишется РАЗДЕЛЬНО — «${solvedWord}»`;
  } else {
    algo = rowAns === "СЛИТНО"
      ? `слово «${solvedWord.toLowerCase()}» с приставкой ${nePart}-; в данном контексте нет противопоставления с союзом «А», зависимых или усилительных слов, слово образует единое понятие (можно заменить синонимом без НЕ); поэтому пишется СЛИТНО — «${solvedWord}»`
      : `слово с частицей ${nePart} в предложении; по грамматическим условиям контекста (часть речи, зависимые/усилительные слова или отрицание признака) частица не сливается со словом; поэтому пишется РАЗДЕЛЬНО — «${solvedWord}»`;
  }

  if (cleaned && cleaned.length >= 50 && !/согласно правилу правописания/i.test(cleaned)) {
    const parts = cleaned.split(/\s*;\s*/).filter(Boolean);
    if (parts.length >= 2) {
      return `${solvedWord} — ${parts.join("; ")}.`;
    }
  }

  return `${solvedWord} — ${algo}.`;
}

function buildTask14WordExplanation(firstPart, secondPart, tokAns, solvedTok, sent, rowExp) {
  const fLow = firstPart.toLowerCase().replace(/ё/g, "е").trim();
  const sLow = secondPart.toLowerCase().replace(/ё/g, "е").trim();
  const fullLow = `${fLow}${sLow}`;
  const modeLabel = tokAns === "ДЕФИСНО" ? "ЧЕРЕЗ ДЕФИС" : tokAns;

  // 1. Try to extract the specific inline parenthetical or line explanation for THIS word (`solvedTok`) from `rowExp`
  let isolated = "";
  if (rowExp) {
    const cleanRow = rowExp.replace(/["“]([^"”]+)["”]/g, "«$1»");
    const escF = firstPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[её]/gi, "[её]");
    const escS = secondPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[её]/gi, "[её]");
    // Check inline parenthetical right after `FIRST(SECOND)` or `(FIRST)SECOND`
    const inlineRe = new RegExp(`(?:\\(${escF}\\)${escS}|${escF}\\(${escS}\\))\\s*\\(([^()]{8,260})\\)`, "i");
    const mInline = cleanRow.match(inlineRe);
    if (mInline) {
      isolated = mInline[1].replace(new RegExp(`^${escF}[\\s\\-]*${escS}\\s*[—\\-–]\\s*`, "i"), "").trim();
    } else {
      // Check lines / clauses separated by newline or semicolon before a capital word
      const clauses = cleanRow
        .split(/\n+|;\s*(?=(?:[1-5]\s*[\)\.]\s*)?(?:имел\s+)?[А-ЯЁ]{2,})/)
        .map(c => c.replace(/^[1-5Зз]\s*[\)\.\-–:]\s*/, "").trim())
        .filter(Boolean);
      for (const cl of clauses) {
        const dashMatch = cl.match(/^(?:имел\s+)?([А-ЯЁа-яё\-\s]{2,28}?)\s*[—\-–]\s*(.+)$/);
        if (dashMatch) {
          const headNorm = dashMatch[1].toLowerCase().replace(/ё/g, "е").replace(/[^а-я]/g, "");
          const targetNorm = fullLow.replace(/[^а-я]/g, "");
          if (headNorm === targetNorm || headNorm.endsWith(targetNorm)) {
            isolated = dashMatch[2].replace(/\.\s+(?=[А-ЯЁ])/g, "; ").trim();
            break;
          }
        }
      }
    }
  }

  // 2. Build deterministic 3-step algorithmic explanation for this exact Task 14 word
  let algo = "";
  if (/^(?:то|либо|нибудь)$/.test(sLow) || /^(?:кое|кой)$/.test(fLow)) {
    algo = `неопределённое местоимение или наречие со словообразовательной частицей «${sLow === "то" || sLow === "либо" || sLow === "нибудь" ? `-${secondPart}` : `${firstPart}-`}»; по правилу частицы КОЕ-, -ТО, -ЛИБО, -НИБУДЬ всегда присоединяются дефисом; поэтому пишется ЧЕРЕЗ ДЕФИС — «${solvedTok}»`;
  } else if (sLow === "таки") {
    algo = `слово с частицей «-ТАКИ»; после наречий, глаголов и частиц (всё-таки, так-таки, неужели-таки, пришёл-таки) частица -ТАКИ пишется через дефис; поэтому пишется «${solvedTok}»`;
  } else if (fLow === "из" && (sLow === "за" || sLow === "под")) {
    algo = `сложный предлог «${solvedTok}»; предлоги ИЗ-ЗА и ИЗ-ПОД всегда пишутся через дефис; поэтому пишется ЧЕРЕЗ ДЕФИС — «${solvedTok}»`;
  } else if (fLow === "по" && /(?:ому|ему|ски|цки|ьи)$/.test(sLow)) {
    algo = `наречие «${solvedTok}» с приставкой ПО- и суффиксом -ОМУ/-ЕМУ/-СКИ/-ЦКИ/-ЬИ (отвечает на вопрос «как?»); такие наречия всегда пишутся через дефис (в отличие от одноимённых прилагательных с предлогом ПО); поэтому пишется ЧЕРЕЗ ДЕФИС — «${solvedTok}»`;
  } else if ((fLow === "в" || fLow === "во") && /(?:ых|их)$/.test(sLow)) {
    algo = `вводное наречие «${solvedTok}», образованное от порядкового числительного с приставкой В-/ВО- и суффиксом -ЫХ/-ИХ; всегда пишется через дефис; поэтому пишется ЧЕРЕЗ ДЕФИС — «${solvedTok}»`;
  } else if (fLow === "пол") {
    algo = tokAns === "ДЕФИСНО"
      ? `сложное слово с корнем ПОЛ- перед гласной, буквой Л или прописной буквой (правило «ЮЛИ»); в этих трёх позициях ПОЛ- пишется через дефис; поэтому пишется ЧЕРЕЗ ДЕФИС — «${solvedTok}»`
      : `сложное слово с корнем ПОЛ- перед строчной согласной буквой (кроме Л); при отсутствии разделяющего прилагательного корень ПОЛ- пишется слитно; поэтому пишется СЛИТНО — «${solvedTok}»`;
  } else if ((fLow === "так" && sLow === "же") || (fLow === "то" && sLow === "же")) {
    algo = tokAns === "СЛИТНО"
      ? `сочинительный союз «${solvedTok}» в значении присоединения («и»); частицу ЖЕ нельзя опустить без потери смысла, а слово можно заменить союзом «И»; поэтому пишется СЛИТНО — «${solvedTok}»`
      : `сочетание указательного местоимения/наречия «${firstPart}» с частицей «ЖЕ»; частицу ЖЕ можно опустить или в предложении есть продолжение «как и / что и / самое»; поэтому пишется РАЗДЕЛЬНО — «${solvedTok}»`;
  } else if (fLow === "что" && sLow === "бы") {
    algo = tokAns === "СЛИТНО"
      ? `подчинительный целевой/изъяснительный союз «ЧТОБЫ» (в значении «для того чтобы»); частицу БЫ нельзя опустить или переставить в другое место предложения; поэтому пишется СЛИТНО — «${solvedTok}»`
      : `местоимение «ЧТО» с частицей «БЫ»; частицу БЫ можно опустить или переставить к глаголу без потери структуры предложения; поэтому пишется РАЗДЕЛЬНО — «${solvedTok}»`;
  } else if ((fLow === "за" && sLow === "то") || (fLow === "при" && (sLow === "том" || sLow === "чем")) || (fLow === "от" && sLow === "того") || (fLow === "по" && (sLow === "тому" || sLow === "этому"))) {
    algo = tokAns === "СЛИТНО"
      ? `союз (или наречие причины/цели) «${solvedTok}»; не имеет прямого предметного значения и заменяется синонимичным союзом (но, к тому же, так как); поэтому пишется СЛИТНО — «${solvedTok}»`
      : `предлог «${firstPart}» с указательным местоимением «${secondPart}»; местоимение сохраняет указательное значение и к нему можно задать падежный вопрос; поэтому пишется РАЗДЕЛЬНО — «${solvedTok}»`;
  } else if (fLow === "в" && /^(?:течение|продолжение|заключение|отличие|связи)$/.test(sLow)) {
    algo = `производный отыменный предлог «${solvedTok}»; образованные от существительных предлоги «в течение, в продолжение, в заключение, в отличие от, в связи с» всегда пишутся в два слова; поэтому пишется РАЗДЕЛЬНО — «${solvedTok}»`;
  } else if (fLow === "в" && sLow === "виду") {
    algo = tokAns === "СЛИТНО"
      ? `производный предлог причины «ВВИДУ» (можно заменить предлогом «из-за»); не входит в устойчивый оборот «иметь в виду»; поэтому пишется СЛИТНО — «${solvedTok}»`
      : `устойчивое сочетание «иметь В ВИДУ» (или существительное с предлогом в пространственном значении); всегда пишется в три слова; поэтому пишется РАЗДЕЛЬНО — «${solvedTok}»`;
  } else if ((fLow === "в" && sLow === "следствие") || (fLow === "на" && (sLow === "счет" || sLow === "встречу" || sLow === "подобие"))) {
    algo = tokAns === "СЛИТНО"
      ? `производный предлог «${solvedTok}» (можно заменить синонимичным предлогом «из-за / о / к / вроде»); между предлогом и бывшим существительным нельзя вставить определение; поэтому пишется СЛИТНО — «${solvedTok}»`
      : `существительное «${secondPart}» в прямом предметном значении с непроизводным предлогом «${firstPart}»; между предлогом и существительным можно вставить определение; поэтому пишется РАЗДЕЛЬНО — «${solvedTok}»`;
  } else {
    algo = tokAns === "СЛИТНО"
      ? `слово «${solvedTok}» (наречие, производный предлог или союз); части слова слились в единую лексему, между ними нельзя вставить другое слово или задать падежный вопрос; поэтому пишется СЛИТНО — «${solvedTok}»`
      : tokAns === "ДЕФИСНО"
        ? `сложное слово или наречие/местоимение с дефисной морфемой «${solvedTok}»; по орфографическому правилу задания №14 части соединяются дефисом; поэтому пишется ЧЕРЕЗ ДЕФИС — «${solvedTok}»`
        : `раздельное сочетание «${solvedTok}» в данном предложении; первое слово не является приставкой (сохраняется раздельное предложно-падежное или частичное написание); поэтому пишется РАЗДЕЛЬНО — «${solvedTok}»`;
  }

  if (isolated && isolated.length >= 55) {
    const cleanIso = isolated.replace(/[,;.\s]+$/, "");
    const parts = cleanIso.split(/\s*;\s*/).filter(Boolean);
    if (parts.length >= 2) {
      return `${solvedTok} — ${parts.join("; ")}.`;
    }
  }

  return `${solvedTok} — ${algo}.`;
}

const finalFipi = [];
const extractedWordsList = [];

for (const t of cleanFipiInput) {
  const taskStr = String(t.task);

  if (Number(taskStr) <= 12) {
    const fullExp = fixHomoglyphs(decodeHtml(t.rows.map(r => r.explanation).join("\n")));
    const computedIndices = [];
    const newRows = [];

    t.rows.forEach((r, idx) => {
      const rowNum = idx + 1;
      const rowExp = fixHomoglyphs(decodeHtml(r.explanation || ""));
      const expandedWords = [];
      for (const rawW of r.words) {
        const w = fixHomoglyphs(decodeHtml(rawW)).trim();
        if (w.split(/\.{2,}|…/).length > 2) {
          expandedWords.push(...w.split(/\s+(?:и\s+)?(?=[а-яё(-]*\.{2,})/i).map(s => s.trim()));
        } else {
          expandedWords.push(w);
        }
      }

      const rowLetters = [];
      const rowSolvedWords = [];
      const rowWordExplanations = [];

      expandedWords.forEach((w, wIdx) => {
        const noParens = w.replace(/\([^)]*\)/g, " ").trim();
        const tokenMatch = noParens.match(/([а-яё-]*)(?:\.{2,}|…)([а-яё-]*)/i);
        if (!tokenMatch) return;
        const pref = tokenMatch[1].trim();
        const suff = tokenMatch[2].trim();
        const pLow = pref.toLowerCase().replace(/ё/g, "е");
        const sLow = suff.toLowerCase().replace(/ё/g, "е");

        const parenMatches = w.match(/\([^)]+\)/g) || [];
        let extraContext = parenMatches.join(" ").trim();

        const escPref = pref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[её]/gi, "[её]");
        const escSuff = suff.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[её]/gi, "[её]");
        const re = new RegExp("(?<![а-яё])" + escPref + "([а-яё]{1})" + escSuff + "(?![а-яё])", "i");

        let ans = EXPLICIT_WORD_ANSWERS.get(`${taskStr}:${pLow}..${sLow}`) || null;

        if (!ans && pLow === "подж" && sLow === "г") {
          ans = /совершил|существительн/i.test(w + " " + rowExp) ? "О" : "Ё";
        }
        if (!ans) {
          const m = rowExp.match(re) || fullExp.match(re);
          if (m) ans = m[1].toUpperCase();
        }
        if (!ans) {
          const reZero = new RegExp("(?<![а-яё])" + escPref + escSuff + "(?![а-яё])", "i");
          if (rowExp.match(reZero) || fullExp.match(reZero) || /не ставится разделительный|не требуется/i.test(rowExp)) {
            ans = "—";
          }
        }
        if (!ans && suff.length >= 1) {
          const shortSuff = suff.slice(0, 1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[её]/gi, "[её]");
          const reShort = new RegExp("(?<![а-яё])" + escPref + "([а-яё]{1})" + shortSuff + "[а-яё]*", "i");
          const m2 = rowExp.match(reShort);
          if (m2) ans = m2[1].toUpperCase();
        }
        if (!ans) {
          ans = globalDict.get(`${taskStr}:${pLow}..${sLow}`) ||
                globalDict.get(`any:${pLow}..${sLow}`) ||
                "Е";
        }

        // Disambiguate context for 3rd-person verbs in Task 12 or homophones in Task 10
        if (taskStr === "12" && /^т(?:ся)?$/i.test(sLow) && !extraContext) {
          extraContext = (ans === "Е" || ans === "И") ? "(он)" : "(они)";
        }
        if (taskStr === "10" && pLow === "пр" && sLow === "емник" && !extraContext) {
          extraContext = ans === "Е" ? "(традиций)" : "(радио)";
        }
        if (taskStr === "10" && pLow === "пр" && sLow === "смотреть" && !extraContext) {
          extraContext = ans === "О" ? "(ошибку)" : "(за ребёнком)";
        }
        if (taskStr === "10" && pLow === "пр" && sLow === "лететь" && !extraContext) {
          extraContext = ans === "О" ? "(мимо)" : "(вовремя)";
        }

        const normLetter = ans === "—" ? "—" : ans.toUpperCase().replace("Ё", "Е");
        rowLetters.push(normLetter);

        const solvedToken = ans === "—" ? `${pref}${suff}` : `${pref}${ans.toUpperCase()}${suff}`;
        const solvedFull = w.replace(/([а-яё-]*)(?:\.{2,}|…)([а-яё-]*)/i, solvedToken);
        rowSolvedWords.push(solvedFull);

        const wordExp = isolateOrGenerateWordExplanation(taskStr, pref, suff, ans, rowExp || fullExp, extraContext);
        rowWordExplanations.push(wordExp);

        let wordPref = pref;
        let wordSuff = suff;
        let wordAns = ans;
        if (taskStr === "11" && /^к(ий|ая|ое|ие|ого|ому|им|ом|ую|ой|их|ими)$/i.test(suff) && (ans === "—" || ans === "С")) {
          wordSuff = suff.slice(1);
          wordAns = ans === "С" ? "СК" : "К";
        }
        if (wordAns !== "—") {
          extractedWordsList.push({
            id: `w-${t.id.replace(/^fipi-/, "")}-r${rowNum}-w${wIdx + 1}`,
            word: `${wordPref}${wordAns}${wordSuff}`,
            wordGap: `${wordPref}..${wordSuff}`,
            prefix: wordPref,
            missingLetter: wordAns,
            suffix: wordSuff,
            task: taskStr,
            topic: t.topic,
            category: t.topic,
            rule: wordExp,
            context: extraContext,
            source: t.source || "Банк ФИПИ",
          });
        }
      });

      const isSame = rowLetters.length >= 2 && !rowLetters.includes("—") && new Set(rowLetters).size === 1;
      if (isSame) computedIndices.push(rowNum);

      newRows.push({
        words: expandedWords.map(w => w.replace(/\.{3,}|…/g, "..")),
        solvedWords: rowSolvedWords,
        letter: isSame ? rowLetters[0] : "—",
        isCorrectRow: isSame,
        explanation: rowWordExplanations.join(" "),
      });
    });

    if (newRows.length === 5 && computedIndices.length >= 1) {
      finalFipi.push({
        ...t,
        rule: "Укажите варианты ответов, в которых во всех словах одного ряда пропущена одна и та же буква. Запишите номера ответов.",
        rows: newRows,
        correctIndices: computedIndices,
      });
    }
  } else if (taskStr === "13") {
    const asksSlitno = /пишется\s+СЛИТНО|пишутся\s+СЛИТНО/i.test(t.rule || "") && !/РАЗДЕЛЬНО/i.test(t.rule || "");
    const targetMode = asksSlitno ? "СЛИТНО" : "РАЗДЕЛЬНО";
    const computedIndices = [];
    const newRows = [];

    t.rows.forEach((r, idx) => {
      const rowNum = idx + 1;
      const sent = fixHomoglyphs(decodeHtml(r.words[0] || "")).trim();
      const rowExp = cleanScraperArtifacts(r.explanation || "");
      const m = sent.match(/\((Н[ЕИ])\)\s*([А-Яа-яЁё-]+)/i);
      if (!m) return;
      const nePart = m[1].toUpperCase();
      const wordPart = m[2];
      const wLow = wordPart.toLowerCase().replace(/ё/g, "е");

      let rowAns = r.letter === "РАЗДЕЛЬНО" ? "РАЗДЕЛЬНО" : "СЛИТНО";
      const expHasRazd = /пишется раздельно|пишем раздельно|пишутся раздельно|раздельно, так как|раздельно, потому что|не с глагол|не с деепричаст|не с кратким причаст/i.test(rowExp);
      const expHasSlit = /пишется слитно|пишем слитно|пишутся слитно|слитно, так как|слитно, потому что|без не не употр/i.test(rowExp);
      if (expHasRazd && !expHasSlit) rowAns = "РАЗДЕЛЬНО";
      else if (expHasSlit && !expHasRazd) rowAns = "СЛИТНО";
      else {
        const beforeNe = sent.slice(0, m.index).toLowerCase();
        if (/(?:далеко|вовсе|отнюдь|ничуть|нисколько|совсем|ещё|еще)\s+$/.test(beforeNe)) {
          rowAns = "РАЗДЕЛЬНО";
        } else if (/^(?:рад|рада|рады|должен|должна|должны|готов|готова|готовы|намерен|обязан|надо|нужно|жаль|пора)$/i.test(wLow)) {
          rowAns = "РАЗДЕЛЬНО";
        }
      }

      const solvedSent = rowAns === "СЛИТНО"
        ? sent.replace(/\((Н[ЕИ])\)\s*([А-Яа-яЁё-]+)/i, "$1$2")
        : sent.replace(/\((Н[ЕИ])\)\s*([А-Яа-яЁё-]+)/i, "$1 $2");

      const isCorr = rowAns === targetMode;
      if (isCorr) computedIndices.push(rowNum);

      const cleanRowExp = buildTask13Explanation(nePart, wordPart, rowAns, sent, rowExp);

      newRows.push({
        words: [sent],
        solvedWords: [solvedSent],
        letter: rowAns,
        isCorrectRow: isCorr,
        explanation: cleanRowExp,
      });

      extractedWordsList.push({
        id: `w-${t.id.replace(/^fipi-/, "")}-r${rowNum}-w1`,
        word: `${nePart}${rowAns === "СЛИТНО" ? "" : " "}${wordPart.toUpperCase()}`,
        wordGap: `(${nePart})${wordPart.toUpperCase()}`,
        prefix: `(${nePart})`,
        missingLetter: rowAns,
        suffix: wordPart.toUpperCase(),
        task: "13",
        topic: t.topic,
        category: t.topic,
        rule: cleanRowExp,
        context: sent,
        source: t.source || "Банк ФИПИ",
      });
    });

    if (newRows.length === 5 && computedIndices.length >= 1) {
      finalFipi.push({
        ...t,
        rule: `Укажите варианты ответов, в которых НЕ (НИ) с выделенным словом пишется ${targetMode}. Запишите номера ответов.`,
        rows: newRows,
        correctIndices: computedIndices,
      });
    }
  } else if (taskStr === "14") {
    const ruleText = fixHomoglyphs(decodeHtml(t.rule || ""));
    const targetMode = /ДЕФИС/i.test(ruleText) ? "ДЕФИСНО" : /РАЗДЕЛЬНО/i.test(ruleText) ? "РАЗДЕЛЬНО" : "СЛИТНО";
    const origCorrSet = new Set(t.correctIndices || []);
    const newRows = [];

    const tokenRe = /(?:В\s+КОНЦЕ\s*\(КОНЦОВ\)|\(ТОЧЬ\)\(В\)\(ТОЧЬ\)|\(БОК\)\(О\)\(БОК\)|\(ТАК\)\(ЖЕ\)|[А-ЯЁ]{1,}\([А-ЯЁ-]+\)[А-ЯЁ]{1,}|[А-ЯЁ]{1,}\([А-ЯЁ-]+\)|\([А-ЯЁ-]+\)[А-ЯЁ]{2,})/g;

    t.rows.forEach((r, idx) => {
      const rowNum = idx + 1;
      let sent = fixHomoglyphs(decodeHtml(r.words[0] || "")).trim();
      sent = sent
        .replace(/([А-ЯЁ]{2,})\s+\(([А-ЯЁ-]+)\)/g, "$1($2)")
        .replace(/\(([А-ЯЁ-]+)\)\s+([А-ЯЁ]{2,})/g, "($1)$2");

      const rowExp = cleanScraperArtifacts(r.explanation || "");
      const isCorr = origCorrSet.has(rowNum);
      const tokens = sent.match(tokenRe) || [];

      let solvedSent = sent;
      const tokenAnswers = [];
      const rowTokenExplanations = [];

      tokens.forEach((tok, tokIdx) => {
        let firstPart = "";
        let secondPart = "";
        if (/^В\s+КОНЦЕ\s*\(КОНЦОВ\)$/i.test(tok)) {
          firstPart = "В КОНЦЕ";
          secondPart = "КОНЦОВ";
        } else if (/^\(?ТОЧЬ\)?\(В\)\(?ТОЧЬ\)?$/i.test(tok)) {
          firstPart = "ТОЧЬ-В";
          secondPart = "ТОЧЬ";
        } else if (/^\(?БОК\)?\(О\)\(?БОК\)?$/i.test(tok)) {
          firstPart = "БОК О";
          secondPart = "БОК";
        } else if (/^\(ТАК\)\(ЖЕ\)$/i.test(tok)) {
          firstPart = "ТАК";
          secondPart = "ЖЕ";
        } else {
          const m1 = tok.match(/^([А-ЯЁ]+)\(([А-ЯЁ-]+)\)$/);
          const m2 = tok.match(/^\(([А-ЯЁ-]+)\)([А-ЯЁ]+)$/);
          if (m1) {
            firstPart = m1[1];
            secondPart = m1[2];
          } else if (m2) {
            firstPart = m2[1];
            secondPart = m2[2];
          }
        }
        if (!firstPart || !secondPart) return;

        let tokAns = isCorr ? targetMode : null;
        if (!tokAns) {
          const fLow = firstPart.toLowerCase().replace(/ё/g, "е");
          const sLow = secondPart.toLowerCase().replace(/ё/g, "е");
          const expLow = rowExp.toLowerCase().replace(/ё/g, "е");
          if (expLow.includes(`${fLow}-${sLow}`) || /^(?:то|либо|нибудь)$/.test(sLow) || /^(?:кое|кой|из-за|из-под)$/.test(fLow) || (fLow === "по" && /(?:ому|ему|ски|цки|ьи)$/.test(sLow)) || sLow === "таки") {
            tokAns = "ДЕФИСНО";
          } else if (expLow.includes(`${fLow} ${sLow}`) || /^(?:будто|словно)$/.test(sLow) || (fLow === "в" && /^(?:течение|продолжение|заключение|отличие|следствие|связи|виду)$/.test(sLow) && !expLow.includes(`${fLow}${sLow}`))) {
            tokAns = "РАЗДЕЛЬНО";
          } else if (expLow.includes(`${fLow}${sLow}`)) {
            tokAns = "СЛИТНО";
          } else {
            tokAns = r.letter === "ДЕФИС" ? "ДЕФИСНО" : (r.letter === "РАЗДЕЛЬНО" ? "РАЗДЕЛЬНО" : "СЛИТНО");
          }
        }
        tokenAnswers.push(tokAns);

        const solvedTok = tokAns === "СЛИТНО"
          ? `${firstPart}${secondPart}`
          : tokAns === "ДЕФИСНО"
            ? `${firstPart}-${secondPart}`
            : `${firstPart} ${secondPart}`;

        solvedSent = solvedSent.replace(tok, solvedTok);

        const singleExp = buildTask14WordExplanation(firstPart, secondPart, tokAns, solvedTok, sent, rowExp);
        rowTokenExplanations.push(singleExp);

        extractedWordsList.push({
          id: `w-${t.id.replace(/^fipi-/, "")}-r${rowNum}-w${tokIdx + 1}`,
          word: solvedTok,
          wordGap: `(${firstPart})${secondPart}`,
          prefix: `(${firstPart})`,
          missingLetter: tokAns,
          suffix: secondPart,
          task: "14",
          topic: t.topic,
          category: t.topic,
          rule: singleExp,
          context: sent,
          source: t.source || "Банк ФИПИ",
        });
      });

      newRows.push({
        words: [sent],
        solvedWords: [solvedSent],
        letter: isCorr ? targetMode : (tokenAnswers.join(" / ") || "РАЗНЫЕ"),
        isCorrectRow: isCorr,
        explanation: rowTokenExplanations.join(" ") || rowExp || `В данном предложении слова пишутся: ${solvedSent}`,
      });
    });

    if (newRows.length === 5 && origCorrSet.size >= 1 && Array.from(origCorrSet).every(c => c >= 1 && c <= 5)) {
      finalFipi.push({
        ...t,
        rule: `Укажите варианты ответов, в которых все выделенные слова пишутся ${targetMode === "ДЕФИСНО" ? "ЧЕРЕЗ ДЕФИС" : targetMode}. Запишите номера ответов.`,
        rows: newRows,
        correctIndices: Array.from(origCorrSet).sort((a, b) => a - b),
      });
    }
  } else if (taskStr === "15") {
    let rawSent = fixHomoglyphs(decodeHtml(t.rows[0]?.words[0] || "")).trim();
    let rulePrompt = fixHomoglyphs(decodeHtml(t.rule || "")).trim();

    const embeddedSentMatch = rulePrompt.match(/^(.*?)\s*Предложение:\s*«(.+)»$/s);
    if (embeddedSentMatch) {
      rulePrompt = embeddedSentMatch[1].trim();
      rawSent = embeddedSentMatch[2].trim();
    } else {
      const leadRuleMatch = rawSent.match(/^(Укажите\s+(?:все\s+)?цифр[^\.]*\.)\s*(.+)$/is);
      if (leadRuleMatch) {
        rulePrompt = leadRuleMatch[1].trim();
        rawSent = leadRuleMatch[2].trim();
      }
    }

    const rawExp = cleanScraperArtifacts(t.rows.map(r => r.explanation || "").join("\n"));
    const corrSet = new Set(Array.from(new Set(t.correctIndices || [])));

    const wordRe = /([А-Яа-яЁё-]+)\((\d+)\)([А-Яа-яЁё-]*)/g;
    const items = [];
    let m;
    while ((m = wordRe.exec(rawSent)) !== null) {
      const pref = m[1];
      const num = Number(m[2]);
      const suff = m[3];
      const escP = pref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[её]/gi, "[её]");
      const escS = suff.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[её]/gi, "[её]");
      const expMatchRe = new RegExp("(?<![а-яё])" + escP + "(н{1,2})" + escS + "(?![а-яё])", "i");
      const wm = rawExp.match(expMatchRe);
      items.push({
        pref,
        num,
        suff,
        matchIndex: m.index,
        fullMatch: m[0],
        expAns: wm ? wm[1].toUpperCase() : null,
      });
    }

    if (items.length === 0) continue;

    let asksSingleN = /пишется\s+(?:одна\s+буква\s+)?Н(?!Н)/i.test(rulePrompt);
    if (!/пишется\s+(?:одна\s+буква\s+)?Н/i.test(rulePrompt)) {
      let votesSingle = 0, votesDouble = 0;
      for (const it of items) {
        if (it.expAns) {
          const inCorr = corrSet.has(it.num);
          if ((inCorr && it.expAns === "Н") || (!inCorr && it.expAns === "НН")) votesSingle++;
          if ((inCorr && it.expAns === "НН") || (!inCorr && it.expAns === "Н")) votesDouble++;
        }
      }
      if (votesSingle > votesDouble) asksSingleN = true;
      else if (votesDouble > votesSingle) asksSingleN = false;
    }

    const targetN = asksSingleN ? "Н" : "НН";
    const newRows = [];
    const validCorrIndices = [];

    items.forEach((it, idx) => {
      const rowNum = idx + 1;
      const inCorr = corrSet.has(it.num);
      const ans = asksSingleN ? (inCorr ? "Н" : "НН") : (inCorr ? "НН" : "Н");
      if (inCorr) validCorrIndices.push(rowNum);

      const start = Math.max(0, it.matchIndex - 22);
      const end = Math.min(rawSent.length, it.matchIndex + it.fullMatch.length + 22);
      let snippet = rawSent.slice(start, end).replace(/^\S*\s+/, "").replace(/\s+\S*$/, "").trim();
      if (!snippet.includes(it.fullMatch)) snippet = it.fullMatch;
      const displayGapWord = `${it.pref}(${rowNum})${it.suff}`;
      const displaySolvedWord = `${it.pref}${ans}${it.suff}`;

      const wordExp = isolateOrGenerateWordExplanation("15", it.pref, it.suff, ans, rawExp, "");

      newRows.push({
        words: [displayGapWord],
        solvedWords: [displaySolvedWord],
        letter: ans,
        isCorrectRow: inCorr,
        explanation: wordExp,
      });

      extractedWordsList.push({
        id: `w-${t.id.replace(/^fipi-/, "")}-r1-w${rowNum}`,
        word: displaySolvedWord,
        wordGap: `${it.pref}..${it.suff}`,
        prefix: it.pref,
        missingLetter: ans,
        suffix: it.suff,
        task: "15",
        topic: t.topic,
        category: t.topic,
        rule: wordExp,
        context: rawSent,
        source: t.source || "Банк ФИПИ",
      });
    });

    if (newRows.length >= 2 && validCorrIndices.length >= 1) {
      finalFipi.push({
        ...t,
        rule: `Укажите цифру(-ы), на месте которой(-ых) пишется ${targetN}.`,
        instruction: rawSent,
        sentence: rawSent,
        rows: newRows,
        correctIndices: validCorrIndices,
      });
    }
  }
}

// Build sprintBank from extractedWordsList
const finalSprint = extractedWordsList.map(w => ({
  id: w.id.replace(/^w-/, "sp-"),
  kind: "sprint",
  task: w.task,
  topic: w.topic,
  rule: w.rule,
  prefix: w.prefix,
  suffix: w.suffix,
  answer: w.missingLetter,
  options: buildOptionsForSprint(w.task, w.prefix, w.suffix, w.missingLetter),
  context: w.context || `(задание №${w.task} ЕГЭ)`,
  explanation: w.rule,
  source: w.source,
  isTrap: Boolean(w.isTrap),
}));

console.log("Final counts:", {
  fipi: finalFipi.length,
  words: extractedWordsList.length,
  sprint: finalSprint.length,
});

const starterWords = [];
const starterFipi = [];
const starterSprint = [];
for (const t of ["9", "10", "11", "12", "13", "14", "15"]) {
  starterWords.push(...extractedWordsList.filter(w => w.task === t).slice(0, 60));
  starterFipi.push(...finalFipi.filter(f => f.task === t).slice(0, 15));
  starterSprint.push(...finalSprint.filter(s => s.task === t).slice(0, 60));
}

const outAllWords = {
  metadata: {
    version: "10.0",
    totalWords: extractedWordsList.length,
    updatedAt: new Date().toISOString(),
  },
  words: extractedWordsList,
};

fs.mkdirSync(path.resolve(__dirname, "../public/data"), { recursive: true });

fs.writeFileSync(path.resolve(__dirname, "../src/data/fipiTasksBank9_15.json"), JSON.stringify(finalFipi, null, 2));
fs.writeFileSync(path.resolve(__dirname, "../src/data/allWordsBank9_15.json"), JSON.stringify(outAllWords, null, 2));
fs.writeFileSync(path.resolve(__dirname, "../src/data/sprintBank9_15.json"), JSON.stringify(finalSprint, null, 2));
fs.writeFileSync(path.resolve(__dirname, "../src/data/starterBank.json"), JSON.stringify({
  words: starterWords,
  fipi: starterFipi,
  sprint: starterSprint,
}, null, 2));

fs.writeFileSync(path.resolve(__dirname, "../public/data/fipiTasksBank9_15.json"), JSON.stringify(finalFipi));
fs.writeFileSync(path.resolve(__dirname, "../public/data/allWordsBank9_15.json"), JSON.stringify(outAllWords));
fs.writeFileSync(path.resolve(__dirname, "../public/data/sprintBank9_15.json"), JSON.stringify(finalSprint));

console.log("All banks written to src/data/ and public/data/ successfully!");
