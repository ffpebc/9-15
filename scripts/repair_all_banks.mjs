import fs from 'node:fs';
import path from 'node:path';
import {
  sanitizeDisplayText,
  extractSingleWordExplanation,
  classifyWordSubtopicAndException,
} from '../src/utils/wordClassifier.ts';
import { getSmartChoiceOptions } from '../src/utils/trainerLogic.ts';

const dataDir = path.resolve(process.cwd(), 'src/data');
const allWordsRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'allWordsBank9_15.json'), 'utf8'));
const allWords = Array.isArray(allWordsRaw) ? allWordsRaw : allWordsRaw.words;
const fipiList = JSON.parse(fs.readFileSync(path.join(dataDir, 'fipiTasksBank9_15.json'), 'utf8'));
const sprintList = JSON.parse(fs.readFileSync(path.join(dataDir, 'sprintBank9_15.json'), 'utf8'));
const starterBank = JSON.parse(fs.readFileSync(path.join(dataDir, 'starterBank.json'), 'utf8'));

const dictLines = fs
  .readFileSync(path.resolve(process.cwd(), '.data/russian_dict_utf8.txt'), 'utf8')
  .split(/\r?\n/);
const dictSet = new Set();
for (const line of dictLines) {
  const w = line.trim().toLowerCase().replace(/ё/g, 'е');
  if (w) dictSet.add(w);
}
const extraDict = [
  'помощник', 'предположительно', 'удивительно', 'замерев', 'сотворить', 'компаньон',
  'ослепив', 'пленительный', 'оценить', 'выливать', 'дремота', 'зернистый', 'помирить',
  'увлечение', 'освещать', 'сверхидея', 'сверхинтуиция', 'сверхидейный', 'сверхискусный',
  'сверхизящный', 'двухъязычный', 'неотправленное', 'архисерьезный', 'архиопасный',
  'антипригарный', 'неприпаянная', 'разносклоняемое', 'предзаказ', 'позаправка',
  'несгораемый', 'несдобровать', 'зоревать', 'пригарь', 'выгарки', 'изгарь', 'полог',
  'утварь', 'росток', 'ростовщик', 'подростковый', 'отрасль', 'скачок', 'пловец', 'пловчиха',
  'равнина', 'ровесник', 'уровень', 'поровну', 'сочетать', 'сочетание', 'взимать', 'сызмала',
  'портовый', 'сжигание', 'архитектурный', 'экспрессивный', 'стилистический', 'стилист',
  'жюри', 'парашют', 'брошюра', 'цемент', 'адъютант', 'безболезненно', 'распознавание',
  'застелить', 'выстелить', 'постелить', 'расстелить', 'перестелить', 'подстелить',
  'присягать', 'приморье', 'горизонт', 'блестяще', 'выложенный', 'жалящий', 'заоблачные',
  'немецкий', 'ненавидишь', 'подынтегральный', 'предоставить',
];
for (const w of extraDict) dictSet.add(w);

function cleanWordOnly(s) {
  if (!s) return '';
  let res = sanitizeDisplayText(s);
  res = res.replace(/\([^)]*\)/g, '');
  res = res.replace(/[\u0301́`'"]/g, '');
  return res.replace(/\s+/g, ' ').trim();
}

function normDict(s) {
  return cleanWordOnly(s).toLowerCase().replace(/ё/g, 'е');
}

// Explicit gap fixes for stems not in the base dictionary or homophones
const EXPLICIT_GAP_FIXES = {
  // Task 9
  '9:разг..ariвать': 'О',
  '9:р..стовщик': 'О',
  '9:р..стовщический': 'О',
  '9:р..сточек': 'О',
  '9:водор..сли': 'О',
  '9:подр..стковый': 'О',
  '9:выр..щенный': 'А',
  '9:зар..сли': 'О',
  '9:зар..стать': 'А',
  '9:выг..рки': 'А',
  '9:изг..рь': 'А',
  '9:приг..рь': 'А',
  '9:з..ревать': 'О',
  '9:з..рянка': 'А',
  '9:пл..вучий': 'А',
  '9:пл..вец': 'О',
  '9:пл..вчиха': 'О',
  '9:пл..вун': 'Ы',
  '9:попл..вок': 'А',
  '9:выск..чка': 'О',
  '9:ск..чок': 'А',
  '9:выск..чить': 'О',
  '9:проск..чить': 'О',
  '9:подск..чить': 'О',
  '9:вск..чить': 'О',
  '9:соч..тать': 'Е',
  '9:соч..тание': 'Е',
  '9:словосоч..тание': 'Е',
  '9:бракосоч..тание': 'Е',
  '9:пор..вну': 'О',
  '9:р..весник': 'О',
  '9:ур..вень': 'О',
  '9:р..внина': 'А',
  '9:р..внение': 'А',
  '9:ср..внить': 'А',
  '9:выр..внять': 'О',
  '9:разр..внять': 'О',
  '9:ур..внение': 'А',
  '9:ур..вновешенный': 'А',
  '9:неур..вновешенный': 'А',
  '9:р..вноправие': 'А',
  '9:р..внодушный': 'А',
  '9:р..внозначный': 'А',
  '9:р..вноценный': 'А',
  '9:утв..рь': 'А',
  '9:тв..рец': 'О',
  '9:сотв..рить': 'О',
  '9:одухотв..ренный': 'О',
  '9:одухотв..рять': 'О',
  '9:благотв..рительность': 'О',
  '9:благотв..рительный': 'О',
  '9:пол..г': 'О',
  '9:предпол..гать': 'А',
  '9:предпол..жение': 'О',
  '9:предпол..жительно': 'О',
  '9:прил..гательное': 'А',
  '9:слаг..емое': 'А',
  '9:безотл..гательный': 'А',
  '9:распол..житься': 'О',
  '9:распол..гаться': 'А',
  '9:изл..жение': 'О',
  '9:изл..гать': 'А',
  '9:прик..сновение': 'О',
  '9:неприк..сновенный': 'О',
  '9:прик..снуться': 'О',
  '9:соприк..сновение': 'О',
  '9:к..сательная': 'А',
  '9:к..саться': 'А',
  '9:непромок..емый': 'А',
  '9:промок..шка': 'А',
  '9:обм..кнуть': 'А',
  '9:пром..кнуть': 'О',
  '9:вым..кнуть': 'О',
  '9:п..ртовый': 'О',
  '9:сж..гание': 'И',
  '9:выж..гание': 'И',
  '9:заж..гательный': 'И',
  '9:архит..ктурный': 'Е',
  '9:архит..ктура': 'Е',
  '9:экспр..ссивный': 'Е',
  '9:ст..лист': 'И',
  '9:ст..листический': 'И',
  '9:ст..листика': 'И',
  '9:пал..садник': 'И',
  '9:интелл..гентный': 'И',
  '9:интелл..генция': 'И',
  '9:прив..легия': 'И',
  '9:прив..легированный': 'И',
  '9:ун..верситет': 'И',
  '9:сув..ренитет': 'Е',
  '9:дез..нфекция': 'И',
  '9:пан..рама': 'О',
  '9:аб..немент': 'О',
  '9:аккомп..немент': 'А',
  '9:апл..дисменты': 'О',
  '9:балл..тироваться': 'О',
  '9:в..негрет': 'И',
  '9:гастрон..мический': 'О',
  '9:гип..тетический': 'О',
  '9:декл..рация': 'А',
  '9:делик..тес': 'А',
  '9:диал..ктический': 'Е',
  '9:дириж..р': 'Ё',
  '9:тренаж..р': 'Ё',
  '9:ухаж..р': 'Ё',
  '9:стаж..р': 'Ё',
  '9:маж..рный': 'О',
  '9:ж..нглер': 'О',
  '9:ж..кей': 'О',
  '9:ш..колад': 'О',
  '9:ш..фер': 'О',
  '9:ш..ссе': 'О',
  '9:ш..рох': 'О',
  '9:ш..рты': 'О',
  '9:крыж..вник': 'О',
  '9:капюш..н': 'О',
  '9:трущ..ба': 'О',
  '9:ч..порный': 'О',
  '9:ч..кнутый': 'О',
  '9:ч..каться': 'О',
  '9:обж..ра': 'О',
  '9:прож..рливый': 'О',
  '9:ж..ри': 'Ю',
  '9:параш..т': 'Ю',
  '9:параш..тист': 'Ю',
  '9:брош..ра': 'Ю',
  '9:ц..ган': 'Ы',
  '9:ц..ганский': 'Ы',
  '9:ц..пленок': 'Ы',
  '9:ц..почки': 'Ы',
  '9:ц..кнуть': 'Ы',
  '9:ц..тата': 'И',
  '9:ц..линдр': 'И',
  '9:ц..рк': 'И',
  '9:ц..фра': 'И',
  '9:ц..вилизация': 'И',
  '9:ц..ничный': 'И',
  '9:ц..клон': 'И',
  '9:ц..стерна': 'И',
  '9:ц..трусовый': 'И',
  '9:дисц..плина': 'И',
  '9:ц..мент': 'Е',
  '9:ц..ментировать': 'Е',
  '9:экз..мпляр': 'Е',
  '9:эл..мент': 'Е',
  '9:ксер..копия': 'О',
  '9:м..роприятие': 'Е',
  '9:св..детельство': 'И',
  '9:ст..пендия': 'И',
  '9:прец..дент': 'Е',
  '9:инц..дент': 'И',
  '9:комп..тентный': 'Е',
  '9:комп..нсация': 'Е',
  '9:к..мбинат': 'О',
  '9:к..мбинация': 'О',
  '9:г..ризонт': 'О',
  '9:гор..зонт': 'И',
  '9:г..ризонтальный': 'О',
  '9:п..мощник': 'О',
  '9:уд..вительно': 'И',
  '9:зам..рев': 'Е',
  '9:зам..реть': 'Е',
  '9:зам..рать': 'И',
  '9:ум..реть': 'Е',
  '9:ум..рать': 'И',
  '9:отп..реть': 'Е',
  '9:отп..рать': 'И',
  '9:зап..реть': 'Е',
  '9:зап..рать': 'И',
  '9:выт..реть': 'Е',
  '9:выт..рать': 'И',
  '9:прот..реть': 'Е',
  '9:прот..рать': 'И',
  '9:расст..латься': 'И',
  '9:расст..лить': 'Е',
  '9:заст..лить': 'Е',
  '9:выст..лить': 'Е',
  '9:пост..лить': 'Е',
  '9:бл..стеть': 'Е',
  '9:бл..стящий': 'Е',
  '9:бл..стяще': 'Е',
  '9:бл..стать': 'И',
  '9:бл..стательный': 'И',
  '9:выч..тать': 'И',
  '9:выч..сть': 'Е',
  '9:прис..гать': 'Я',
  '9:пр..морье': 'И',
  '9:вз..мать': 'И',
  '9:выл..женный': 'О',
  '9:жал..щий': 'Я',
  '9:з..облачные': 'А',
  '9:пом..рить': 'И',
  '9:пред..ставить': 'О',

  // Task 10
  '10:ад..ютант': 'Ъ',
  '10:кон..юнктура': 'Ъ',
  '10:кон..юнктивит': 'Ъ',
  '10:ин..екция': 'Ъ',
  '10:суб..ект': 'Ъ',
  '10:суб..ективный': 'Ъ',
  '10:об..ект': 'Ъ',
  '10:об..ективный': 'Ъ',
  '10:фельд..егерь': 'Ъ',
  '10:пан..европейский': 'Ъ',
  '10:транс..европейский': 'Ъ',
  '10:сверх..естественный': 'Ъ',
  '10:сверх..емкий': 'Ъ',
  '10:двух..ярусный': 'Ъ',
  '10:трех..ярусный': 'Ъ',
  '10:четырех..ярусный': 'Ъ',
  '10:меж..ярусный': 'Ъ',
  '10:из..ян': 'Ъ',
  '10:об..явление': 'Ъ',
  '10:раз..яснить': 'Ъ',
  '10:под..езд': 'Ъ',
  '10:с..едобный': 'Ъ',
  '10:в..юга': 'Ь',
  '10:бур..ян': 'Ь',
  '10:п..едестал': 'Ь',
  '10:интер..ер': 'Ь',
  '10:экстер..ер': 'Ь',
  '10:прем..ера': 'Ь',
  '10:кар..ера': 'Ь',
  '10:бар..ер': 'Ь',
  '10:кур..ер': 'Ь',
  '10:ф..ючерсный': 'Ь',
  '10:комп..ютер': 'Ь',
  '10:шампин..он': 'Ь',
  '10:павил..он': 'Ь',
  '10:медал..он': 'Ь',
  '10:батал..он': 'Ь',
  '10:бул..он': 'Ь',
  '10:почтал..он': 'Ь',
  '10:компаН..он': 'Ь',
  '10:компан..он': 'Ь',
  '10:милл..он': 'И',
  '10:под..ячий': 'Ь',
  '10:обез..яна': 'Ь',
  '10:вороб..иный': 'Ь',
  '10:солов..иный': 'Ь',
  '10:мурав..иный': 'Ь',
  '10:руж..е': 'Ь',
  '10:вз..мать': 'И',
  '10:сверх..зысканный': 'И',
  '10:сверх..нтересный': 'И',
  '10:сверх..дея': 'И',
  '10:сверх..нтуиция': 'И',
  '10:меж..нститутский': 'И',
  '10:меж..здательский': 'И',
  '10:дез..нформация': 'И',
  '10:дез..нфекция': 'И',
  '10:контр..гра': 'И',
  '10:пост..мпрессионизм': 'И',
  '10:суб..нспектор': 'И',
  '10:транс..орданский': 'И',
  '10:пан..сламизм': 'И',
  '10:спорт..нвентарь': 'И',
  '10:пед..нститут': 'И',
  '10:мед..нститут': 'И',
  '10:фин..нспектор': 'И',
  '10:пред..дущий': 'Ы',
  '10:пред..стория': 'Ы',
  '10:пред..юльский': 'Ы',
  '10:бе..дарный': 'З',
  '10:бе..болезненно': 'З',
  '10:бе..болезненный': 'З',
  '10:бе..граничный': 'З',
  '10:бе..заботный': 'З',
  '10:бе..шумный': 'С',
  '10:бе..численный': 'С',
  '10:бе..ценный': 'С',
  '10:бе..конечный': 'С',
  '10:бе..полезный': 'С',
  '10:бе..сердечный': 'С',
  '10:бе..вкусный': 'З',
  '10:не..гораемый': 'С',
  '10:не..добровать': 'С',
  '10:не..говорчивый': 'С',
  '10:не..гибаемый': 'С',
  '10:пере..дать': 'С',
  '10:пере..дача': 'С',
  '10:и..подтишка': 'С',
  '10:чере..чур': 'С',
  '10:миро..здание': '—',
  '10:под..нтегральный': 'Ы',
  '10:пред..ставить': 'О',
  '10:пр..морье': 'И',

  // Task 11
  '11:немец..кий': '—',
  '11:милост..вый': 'И',
  '11:юрод..вый': 'И',
  '11:гуттаперч..вый': 'Е',
  '11:фланел..вый': 'Е',
  '11:щавел..вый': 'Е',
  '11:марл..вый': 'Е',
  '11:тюл..вый': 'Е',
  '11:эмал..вый': 'Е',
  '11:никел..вый': 'Е',
  '11:фасол..вый': 'Е',
  '11:миндал..вый': 'Е',
  '11:вермишел..вый': 'Е',
  '11:каракул..вый': 'Е',
  '11:горноста..вый': 'Е',
  '11:гели..вый': 'Е',
  '11:алюмини..вый': 'Е',
  '11:кали..вый': 'Е',
  '11:натри..вый': 'Е',
  '11:магноли..вый': 'Е',
  '11:сирен..вый': 'Е',
  '11:ливн..вый': 'Е',
  '11:ключ..вой': 'Е',
  '11:сторож..вой': 'Е',
  '11:дожд..вой': 'Е',
  '11:грош..вый': 'О',
  '11:еж..вый': 'О',
  '11:парч..вый': 'О',
  '11:холщ..вый': 'О',
  '11:камыш..вый': 'О',
  '11:свинц..вый': 'О',
  '11:глянц..вый': 'Е',
  '11:ситц..вый': 'Е',
  '11:плюш..вый': 'Е',
  '11:груш..вый': 'Е',
  '11:беж..вый': 'Е',
  '11:рыж..ватый': 'Е',
  '11:затм..вать': 'Е',
  '11:продл..вать': 'Е',
  '11:застр..вать': 'Е',
  '11:намер..ваться': 'Е',
  '11:сомн..ваться': 'Е',
  '11:недоум..вать': 'Е',
  '11:увещ..вать': 'Е',
  '11:обур..вать': 'Е',
  '11:подозр..вать': 'Е',
  '11:потч..вать': 'Е',
  '11:проповед..вать': 'О',
  '11:завед..вать': 'О',
  '11:исповед..вать': 'О',
  '11:команд..вать': 'О',
  '11:бесед..вать': 'О',
  '11:совет..вать': 'О',
  '11:чувств..вать': 'О',
  '11:участв..вать': 'О',
  '11:честв..вать': 'О',
  '11:шеств..вать': 'О',
  '11:рассчит..вать': 'Ы',
  '11:опазд..вать': 'Ы',
  '11:огляд..ваться': 'Ы',
  '11:склад..вать': 'Ы',
  '11:доклад..вать': 'Ы',
  '11:развед..вать': 'Ы',
  '11:наслед..вать': 'О',
  '11:исслед..вать': 'О',
  '11:обслед..вать': 'О',
  '11:расслед..вать': 'О',
  '11:преслед..вать': 'О',
  '11:ветр..ный': 'Е',
  '11:безветр..нный': 'Е',

  // Task 12
  '12:ненавид..шь': 'И',
  '12:жал..щий': 'Я',
  '12:ст..лющийся': 'Е',
  '12:бре..щий': 'Ю',
  '12:зижд..щийся': 'У',
  '12:брезж..щий': 'У',
  '12:кле..щий': 'Я',
  '12:стро..щийся': 'Я',
  '12:дыш..щий': 'А',
  '12:слыш..щий': 'А',
  '12:держ..щий': 'А',
  '12:вид..щий': 'Я',
  '12:ненавид..щий': 'Я',
  '12:завис..щий': 'Я',
  '12:терп..щий': 'Я',
  '12:верт..щий': 'Я',
  '12:гон..щий': 'Я',
  '12:смотр..щий': 'Я',
  '12:се..щий': 'Ю',
  '12:ве..щий': 'Ю',
  '12:леле..щий': 'Ю',
  '12:та..щий': 'Ю',
  '12:ка..щийся': 'Ю',
  '12:ла..щий': 'Ю',
  '12:чу..щий': 'Ю',
  '12:ча..щий': 'Ю',
  '12:наде..щийся': 'Ю',
  '12:ма..щийся': 'Ю',
  '12:ре..щий': 'Ю',
  '12:бле..щий': 'Ю',
  '12:зате..вший': 'Я',
  '12:посе..вший': 'Я',
  '12:раста..вший': 'Я',
  '12:обид..вший': 'Е',
  '12:увид..вший': 'Е',
  '12:услыш..вший': 'А',
  '12:движ..мый': 'И',
  '12:недвиж..мый': 'И',
  '12:немысл..мый': 'И',
  '12:незыбл..мый': 'Е',
  '12:неотъемл..мый': 'Е',
};

const HOMOPHONE_CONTEXT_RULES = [
  ['пос', 'дели', ['стар', 'горя', 'волос', 'сед'], 'Е'],
  ['пос', 'дели', ['лав', 'скам', 'кафе', 'друг', 'вмест', 'сид', 'парк', 'диван', 'тишин'], 'И'],
  ['прим', 'рять', ['плат', 'костюм', 'одежд', 'туфл', 'пальто', 'мерк', 'мер', 'обновк', 'шляп'], 'Е'],
  ['прим', 'рять', ['друг', 'враг', 'сосед', 'поссор', 'мир', 'спор', 'соперн', 'ссор'], 'И'],
  ['прим', 'рение', ['друг', 'враг', 'сосед', 'поссор', 'мир', 'сторон'], 'И'],
  ['разв', 'ваться', ['флаг', 'ветер', 'ветр', 'веет', 'косы', 'знамя', 'лент', 'волос', 'стяг', 'парус'], 'Е'],
  ['разв', 'ваться', ['спорт', 'наук', 'культур', 'ребенок', 'эконом', 'развит', 'бизнес', 'талант', 'быстр'], 'И'],
  ['разв', 'вающийся', ['флаг', 'ветер', 'ветр', 'веет', 'косы', 'знамя', 'лент', 'волос', 'стяг', 'парус'], 'Е'],
  ['разв', 'вающийся', ['спорт', 'наук', 'культур', 'ребенок', 'эконом', 'развит', 'бизнес', 'талант', 'рынок', 'город'], 'И'],
  ['разв', 'вающаяся', ['флаг', 'ветер', 'ветр', 'веет', 'косы', 'знамя', 'лент', 'шаль'], 'Е'],
  ['разв', 'вающаяся', ['наук', 'культур', 'эконом', 'компани', 'стран', 'отрасл'], 'И'],
  ['зап', 'вать', ['песн', 'куплет', 'петь', 'запев', 'хор', 'гимн', 'мелод'], 'Е'],
  ['зап', 'вать', ['вод', 'лекарств', 'таблетк', 'пить', 'чай', 'сок', 'молок'], 'И'],
  ['пол', 'скать', ['кот', 'собак', 'ребенк', 'ласк', 'котят', 'щенк', 'малыш', 'доч', 'сын'], 'А'],
  ['пол', 'скать', ['бель', 'таз', 'вод', 'полощ', 'рот', 'горл', 'речк'], 'О'],
  ['посв', 'тить', ['стих', 'поэм', 'книг', 'матер', 'памят', 'свято', 'жизн', 'рыцар', 'тайну', 'другу', 'делу'], 'Я'],
  ['посв', 'тить', ['фонар', 'ламп', 'свеч', 'свет', 'темнот', 'луч', 'дорог', 'лестниц'], 'Е'],
  ['посв', 'щать', ['стих', 'поэм', 'книг', 'матер', 'памят', 'свято', 'жизн', 'другу', 'музык'], 'Я'],
  ['посв', 'щать', ['фонар', 'ламп', 'свеч', 'свет', 'темнот'], 'Е'],
  ['просв', 'щение', ['народ', 'эпох', 'образ', 'наук', 'культ'], 'Е'],
  ['прож', 'вать', ['хлеб', 'мяс', 'пищ', 'жевать', 'тщательн', 'еду', 'кусок'], 'Е'],
  ['прож', 'вать', ['город', 'дом', 'квартир', 'жить', 'деревн', 'столиц', 'адрес', 'вместе'], 'И'],
  ['ум', 'лять', ['заслуг', 'значен', 'мал', 'достоинств', 'роль', 'важност'], 'А'],
  ['ум', 'лять', ['пощад', 'помощ', 'мол', 'прощен', 'слез', 'бог'], 'О'],
  ['скр', 'пить', ['сердц', 'зуб', 'скрип'], 'И'],
  ['скр', 'пить', ['печать', 'договор', 'креп', 'скрепк', 'бумаг', 'лист', 'уз', 'подпис'], 'Е'],
  ['нав', 'вать', ['сон', 'грусть', 'веять', 'тоск', 'воспоминан', 'скук', 'мечт'], 'Е'],
  ['нав', 'вать', ['проволок', 'нить', 'вить', 'локон', 'кудр', 'пружин', 'веревк'], 'И'],
  ['отв', 'рить', ['дверь', 'окно', 'створк', 'отвор', 'ворот', 'калитк', 'ставн'], 'О'],
  ['отв', 'рить', ['картофел', 'суп', 'мясо', 'варит', 'отвар', 'овощ', 'гриб', 'макарон', 'рис'], 'А'],
  ['сп', 'шите', ['урок', 'тетрад', 'пишет', 'спис', 'доск', 'текст', 'слов', 'упражнен'], 'И'],
  ['сп', 'шите', ['поезд', 'работ', 'спех', 'спешит', 'вокзал', 'встреч', 'театр', 'делать', 'дом'], 'Е'],
  ['обл', 'зать', ['варень', 'пальц', 'лижет', 'ложк', 'губ', 'морожен'], 'И'],
  ['обл', 'зать', ['дерев', 'забор', 'лезет', 'крыш', 'скал', 'гор'], 'Е'],
  ['ув', 'дать', ['цвет', 'роз', 'трав', 'лист', 'вян', 'букет', 'сад', 'красот'], 'Я'],
  ['ув', 'дать', ['друг', 'знаком', 'вид', 'мир', 'свет', 'издалек'], 'И'],
  ['прив', 'дение', ['замок', 'призрак', 'ночн', 'страшн', 'бел'], 'И'],
  ['прив', 'дение', ['порядок', 'пример', 'доказательств', 'присяг', 'знаменател', 'действи'], 'Е'],
  ['вык', 'чанный', ['нефть', 'вод', 'воздух', 'насос', 'колодц', 'скважин', 'мед'], 'А'],
  ['вык', 'ченный', ['бочк', 'подвал', 'погреб', 'коляск', 'тележк', 'колес', 'гараж', 'тачк'], 'Е'],
  ['вык', 'чанная', ['нефть', 'вод', 'жидкост', 'скважин'], 'А'],
  ['вык', 'ченная', ['бочк', 'подвал', 'погреб', 'коляск', 'тележк', 'тачк'], 'Е'],
  ['зам', 'шанный', ['преступлен', 'дел', 'скандал', 'истори', 'интриг', 'заговор'], 'А'],
  ['зам', 'шенный', ['тест', 'глин', 'раствор', 'цемент', 'бетон', 'краск', 'мук'], 'Е'],
  ['зам', 'шанное', ['преступлен', 'дел', 'скандал'], 'А'],
  ['зам', 'шенное', ['тест', 'мук'], 'Е'],
  ['разв', 'шанный', ['бель', 'картин', 'одежд', 'флаг', 'плакат', 'ковер', 'гирлянд'], 'А'],
  ['разв', 'шенный', ['мук', 'круп', 'товар', 'сахар', 'чай', 'конфет', 'пакет', 'порци', 'грамм'], 'Е'],
  ['обв', 'шанный', ['лент', 'орден', 'медал', 'гирлянд', 'игрушк', 'оружи', 'сумк'], 'А'],
  ['обв', 'шенный', ['покупател', 'продавец', 'рынк', 'магазин', 'вес'], 'Е'],
  ['пристр', 'ленный', ['оружи', 'ружь', 'винтовк', 'мишен', 'пистолет'], 'Е'],
  ['пристр', 'лянный', ['оружи', 'ружь', 'винтовк', 'мишен', 'пистолет'], 'Я'],
];

// Step 0: Sanitize all strings in all 4 banks first
for (const w of allWords) {
  w.prefix = sanitizeDisplayText(w.prefix || '');
  w.suffix = sanitizeDisplayText(w.suffix || '');
  w.context = sanitizeDisplayText(w.context || '');
  w.rule = sanitizeDisplayText(w.rule || '');
  w.wordGap = sanitizeDisplayText(w.wordGap || '');
  w.word = sanitizeDisplayText(w.word || '');
}

for (const fq of fipiList) {
  fq.rule = sanitizeDisplayText(fq.rule || '');
  if (fq.instruction) fq.instruction = sanitizeDisplayText(fq.instruction);
  for (const r of fq.rows || []) {
    r.words = (r.words || []).map((x) => sanitizeDisplayText(x));
    r.solvedWords = (r.solvedWords || []).map((x) => sanitizeDisplayText(x));
    r.explanation = sanitizeDisplayText(r.explanation || '');
  }
}

for (const sq of sprintList) {
  sq.prefix = sanitizeDisplayText(sq.prefix || '');
  sq.suffix = sanitizeDisplayText(sq.suffix || '');
  sq.context = sanitizeDisplayText(sq.context || '');
  sq.explanation = sanitizeDisplayText(sq.explanation || '');
  sq.rule = sanitizeDisplayText(sq.rule || '');
}

// Step 1: Identify and repair the 98 Task 15 single-Н questions in fipiTasksBank9_15.json
// And collect reliable solved letters from fipiTasksBank9_15.json and allWordsBank9_15.json
const singleNFipiTaskIds = new Set();
const invertedTask15GapKeys = new Map(); // stemKey -> corrected 'Н' or 'НН'

for (const fq of fipiList) {
  if (fq.task === '15') {
    const instr = `${fq.rule || ''} ${fq.instruction || ''}`;
    // Check if the question asks for single Н ("пишется Н." or "пишется одна буква Н")
    const asksSingleN =
      /на месте которой\(-ых\) пишется Н\b(?!Н)/i.test(instr) ||
      /пишется одна буква Н/i.test(instr);
    if (asksSingleN) {
      singleNFipiTaskIds.add(fq.id);
      for (const r of fq.rows || []) {
        const expectedLetter = r.isCorrectRow ? 'Н' : 'НН';
        r.letter = expectedLetter;
        r.solvedWords = (r.words || []).map((wGap) => {
          const parts = wGap.split(/\.\.+|_{1,}/);
          if (parts.length >= 2) {
            const p = parts[0];
            const s = parts.slice(1).join('');
            const stemKey = `15:${cleanWordOnly(p).toLowerCase()}..${cleanWordOnly(s).toLowerCase()}`;
            invertedTask15GapKeys.set(stemKey, expectedLetter);
            return `${p}${expectedLetter.toLowerCase()}${s}`;
          }
          return wGap;
        });
      }
    }
  }
}

console.log(`Task 15 single-N FIPI tasks fixed: ${singleNFipiTaskIds.size} (unique stems: ${invertedTask15GapKeys.size})`);

// Build a trusted lookup of non-fallback letters from allWords and fipiList
const trustedStemMap = new Map();

for (const [k, v] of Object.entries(EXPLICIT_GAP_FIXES)) {
  trustedStemMap.set(k.toLowerCase().replace(/ё/g, 'е'), v);
}
for (const [k, v] of invertedTask15GapKeys.entries()) {
  trustedStemMap.set(k.toLowerCase().replace(/ё/g, 'е'), v);
}

for (const w of allWords) {
  const isFallbackRule =
    (w.missingLetter === 'А' &&
      (!w.rule ||
        w.rule.includes('..') ||
        w.rule.startsWith('Правописание гласной') ||
        w.rule.startsWith('Правописание буквы'))) ||
    w.word.includes('&#');

  // Check if w.missingLetter is one of the 13 capital-letter parser glitches
  const cleanP = cleanWordOnly(w.prefix).toLowerCase().replace(/ё/g, 'е');
  const cleanS = cleanWordOnly(w.suffix).toLowerCase().replace(/ё/g, 'е');
  const stemKey = `${w.task}:${cleanP}..${cleanS}`;

  if (trustedStemMap.has(stemKey)) continue;

  const candidateWord = cleanP + (w.missingLetter === '—' ? '' : w.missingLetter.toLowerCase().replace(/ё/g, 'е')) + cleanS;
  if (!isFallbackRule && dictSet.has(candidateWord)) {
    trustedStemMap.set(stemKey, w.missingLetter);
  }
}

// Also harvest non-corrupted solvedWords from fipiList (Tasks 9-12)
for (const fq of fipiList) {
  if (!['9', '10', '11', '12'].includes(fq.task)) continue;
  for (const r of fq.rows || []) {
    for (let i = 0; i < (r.words || []).length; i++) {
      const wGap = r.words[i];
      const wSolved = r.solvedWords?.[i] || '';
      const parts = wGap.split(/\.\.+|_{1,}/);
      if (parts.length < 2) continue;
      const pRaw = parts[0];
      const sRaw = parts.slice(1).join('');
      const cleanP = cleanWordOnly(pRaw).toLowerCase().replace(/ё/g, 'е');
      const cleanS = cleanWordOnly(sRaw).toLowerCase().replace(/ё/g, 'е');
      const stemKey = `${fq.task}:${cleanP}..${cleanS}`;
      if (trustedStemMap.has(stemKey)) continue;

      // Extract the inserted character from wSolved if it wasn't overwritten by parenthetical 'А' bug
      if (wSolved.startsWith(pRaw) && wSolved.endsWith(sRaw) && wSolved.length >= pRaw.length + sRaw.length) {
        const mid = wSolved.slice(pRaw.length, wSolved.length - sRaw.length).toUpperCase();
        if (mid && mid.length <= 2) {
          const cand = cleanP + mid.toLowerCase().replace(/ё/g, 'е') + cleanS;
          if (dictSet.has(cand) && !(mid === 'А' && wGap.includes('('))) {
            trustedStemMap.set(stemKey, mid);
          }
        }
      }
    }
  }
}

function resolveWordLetter(task, prefix, suffix, context = '', rawExpl = '', currentAns = '') {
  const cleanP = cleanWordOnly(prefix).toLowerCase().replace(/ё/g, 'е');
  const cleanS = cleanWordOnly(suffix).toLowerCase().replace(/ё/g, 'е');
  const ctxLower = sanitizeDisplayText(context).toLowerCase().replace(/ё/g, 'е');
  const explClean = sanitizeDisplayText(rawExpl);
  const stemKey = `${task}:${cleanP}..${cleanS}`;

  // 0. Check explicit fixes first
  if (EXPLICIT_GAP_FIXES[stemKey]) {
    return EXPLICIT_GAP_FIXES[stemKey];
  }

  // 1. Check homophone context rules
  for (const [hp, hs, kwList, letter] of HOMOPHONE_CONTEXT_RULES) {
    if (cleanP === hp && cleanS.startsWith(hs)) {
      if (kwList.some((kw) => ctxLower.includes(kw))) {
        return letter;
      }
    }
  }

  // 2. Check Task 15 inverted single-N stems or linguistic N/NN rules
  if (task === '15') {
    if (invertedTask15GapKeys.has(stemKey)) {
      return invertedTask15GapKeys.get(stemKey);
    }
    // Check explicit Russian orthography rules for Task 15 well-known stems
    const fullStem = `${cleanP}..${cleanS}`;
    if (/^(?:стекля|оловя|деревя)\.\.(?:ый|ая|ое|ые|ого|ому|ым|ом|ую|ой|ых|ыми)$/.test(fullStem)) return 'НН';
    if (/^ветре\.\.(?:ый|ая|ое|ые|ого|ому|ым|ом|ую|ой|ых|ыми)$/.test(fullStem)) return 'Н';
    if (/^(?:кожа|глиня|песча|серебря|ледя|нефтя|торфя|шерстя|полотня|земля|травя|водя|берестя|жестя|дровя|овся|ржа|конопля|платя|слюдя|масля|ветря|соля)\.\.(?:ый|ая|ое|ые|ого|ому|ым|ом|ую|ой|ых|ыми)$/.test(fullStem)) return 'Н';
    if (/^(?:гуси|ути|лебеди|орли|соколи|петуши|кури|мыши|лошади|звери|змеи|пчели|муравьи|воробьи|соловьи|голуби|соболи|осли|льви|тигри|ястреби|комари)\.\.(?:ый|ая|ое|ые|ого|ому|ым|ом|ую|ой|ых|ыми)$/.test(fullStem)) return 'Н';
    if (/^(?:кова|жева|ране)\.\.(?:ый|ая|ое|ые|ого|ому|ым|ом|ую|ой|ых|ыми)$/.test(fullStem) && !ctxLower.includes('зависим')) return 'Н';
    return currentAns || 'Н';
  }

  if (task === '13' || task === '14') {
    return currentAns;
  }

  // 3. Check if explanation explicitly highlights the solved word with a capital letter at the gap
  if (explClean && !explClean.includes('..') && cleanP.length >= 1) {
    const escapedP = cleanP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedS = cleanS.slice(0, 4).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match exact capital letter in the middle of the word inside explanation
    const capRegex = new RegExp(`(?:^|[^а-яёА-ЯЁ])${escapedP}([А-ЯЁ])${escapedS}`, 'g');
    let m;
    while ((m = capRegex.exec(explClean)) !== null) {
      const capL = m[1].toUpperCase();
      // Make sure the whole word wasn't ALL CAPS
      const matchStr = m[0];
      const lettersOnly = matchStr.replace(/[^а-яёА-ЯЁ]/g, '');
      const isAllCaps = lettersOnly === lettersOnly.toUpperCase();
      if (!isAllCaps) {
        return capL;
      }
    }
  }

  // 4. Check trustedStemMap
  if (trustedStemMap.has(stemKey)) {
    return trustedStemMap.get(stemKey);
  }

  // 5. Morphological alternating & prefix rules
  if (task === '9') {
    if (/^(?:за|по|до|об|пере|с|вы|про|на|от|под|при|у|раз|воз)?г$/.test(cleanP) && /^р(?:ать|еть|ел|ан|ающ|ар|елый)/.test(cleanS)) return 'О';
    if (/^(?:о|оз|про)?з$/.test(cleanP) && /^(?:рниц|рени|рен|рев|рянк|ри)/.test(cleanS) && !cleanS.startsWith('рева')) return 'А';
    if (/^(?:при|сопри|непри)?к$/.test(cleanP) && /^с(?:ать|ат|ательн|аем|ающ)/.test(cleanS)) return 'А';
    if (/^(?:при|сопри|непри)?к$/.test(cleanP) && /^с(?:ну|нов|нут)/.test(cleanS)) return 'О';
    if (/^(?:предпо|распо|пред|по|при|из|воз|с|от|на|пере|у|до|об|про|низ|безот|неот)?л$/.test(cleanP)) {
      if (/^г(?:ать|ает|ающ|аем|аться|ательн|аем)/.test(cleanS) || cleanS.startsWith('гательн')) return 'А';
      if (/^ж(?:ить|ил|ени|енн|ивш|ат|ительн|им)/.test(cleanS) || cleanS.startsWith('жительн')) return 'О';
    }
    if (/^(?:вы|под|воз|вз|раз|про|за|по|от|на|пере|с|у|водо|дико|ново|произ)?р$/.test(cleanP)) {
      if (/^(?:ст|щ)/.test(cleanS) && !/^ст(?:ок|оч|овщ)/.test(cleanS) && cleanP !== 'подр') return 'А';
      if (/^с(?:л|ш|ти|ту)/.test(cleanS) && cleanP !== 'отр') return 'О';
    }
    if (/^(?:со|у|вы|за|от|под|раз|рас|пере|при|на|об|вз|из|про|до|по|с|не)?(?:б|д|м|п|т|ж|ст|бл|ч)$/.test(cleanP)) {
      if (/^(?:р|л|г|ст|т)а(?:ть|ющ|вш|я|ни|тель|т|ем|ются|ется|л|ла|ли)/.test(cleanS) && !(cleanP.endsWith('ч') && cleanS.startsWith('та'))) {
        return 'И';
      }
      if (/^(?:р|л|г|ст|т)(?:еть|ел|ереть|ереться|ев|евш|вши|ший|шая|шее|шие|ло|ли|ла|у|ешь|ет|ем|ете|ут)/.test(cleanS)) {
        return 'Е';
      }
    }
  }

  if (task === '10') {
    if (/^(?:раз|без|вз|из|воз|низ|чрез|черес)$/.test(cleanP)) {
      if (/^[кпстфхцчшщ]/.test(cleanS)) return 'С';
      if (/^[бвгджзлмнр]/.test(cleanS)) return 'З';
    }
    if (/^(?:под|об|от|над|пред|с|в|раз|из|трех|двух|четырех|меж|сверх|пан|транс|контр|суб|ад|ин|фельд)$/.test(cleanP) && /^[еёюя]/.test(cleanS)) {
      return 'Ъ';
    }
  }

  // 6. Dictionary lookup across candidate letters
  const candidates =
    task === '9'
      ? ['о', 'е', 'и', 'а', 'я', 'ы', 'у', 'ю', 'э']
      : task === '10'
      ? ['е', 'и', 'с', 'з', 'ъ', 'ь', 'о', 'а', 'ы', '—']
      : task === '11'
      ? ['е', 'и', 'о', 'ы', 'а', 'я', 'ч', 'щ', 'с', 'к', '—']
      : ['е', 'и', 'я', 'а', 'у', 'ю'];

  const validMatches = [];
  for (const candL of candidates) {
    const testWord = cleanP + (candL === '—' ? '' : candL) + cleanS;
    if (dictSet.has(testWord)) {
      validMatches.push(candL.toUpperCase());
    }
  }

  if (validMatches.length === 1) {
    return validMatches[0];
  }

  if (validMatches.length > 1) {
    // Disambiguate Task 12 singular vs plural context (e.g. трепещ..щий флаг vs трепещ..щие флаги)
    if (task === '12') {
      const isPluralCtx = /\b(?:они|многие|все|эти|те|люди|дети|родители|ученики|рабочие|друзья|солдаты|птицы|облака|волны|листья|звуки|голоса|лучи|звезды)\b|(?:ые|ие|ых|их|ым|им|ыми|ими)\b/.test(ctxLower);
      const isSingularCtx = /\b(?:он|она|оно|этот|эта|это|тот|та|то|человек|ребенок|мастер|ученик|рабочий|друг|солдат|птица|облако|волна|лист|звук|голос|луч|звезда|ветер|море|небо|солнце|трава|цветок|котел|флаг|куст|огонь)\b/.test(ctxLower);
      if (isSingularCtx && !isPluralCtx) {
        for (const l of ['Е', 'И']) {
          if (validMatches.includes(l)) return l;
        }
      }
      if (isPluralCtx && !isSingularCtx) {
        for (const l of ['У', 'Ю', 'А', 'Я']) {
          if (validMatches.includes(l)) return l;
        }
      }
    }
    // Disambiguate using verification word in explanation if present
    for (const mLetter of validMatches) {
      const testWord = cleanP + (mLetter === '—' ? '' : mLetter.toLowerCase()) + cleanS;
      if (explClean.toLowerCase().replace(/ё/g, 'е').includes(testWord)) {
        return mLetter;
      }
    }
    // Prefer non-'А' if currentAns was a fallback 'А'
    const curUp = (currentAns || '').toUpperCase();
    if (curUp && curUp !== 'А' && validMatches.includes(curUp)) {
      return curUp;
    }
    return validMatches[0];
  }

  // Try stripping common inflectional endings to match base form in dictionary
  const endingReplacements = [
    [/(?:ый|ий|ой|ая|яя|ое|ее|ые|ие|ого|его|ому|ему|ым|им|ом|ем|ую|юю|ой|ей|ых|их|ыми|ими)$/, ['ый', 'ий', 'ой', 'ая']],
    [/(?:ами|ями|ах|ях|ов|ев|ей|ам|ям|ом|ем|ой|ей|у|ю|е|и|ы|а|я)$/, ['', 'а', 'я', 'о', 'е', 'и', 'ы', 'ь']],
    [/(?:ешь|ет|ем|ете|ут|ют|ишь|ит|им|ите|ат|ят|ться|тся|лся|лась|лось|лись|л|ла|ло|ли|вш|вши|в|я|а)$/, ['ть', 'ться', 'ти']],
    [/(?:ющий|ющая|ющее|ющие|ущий|ущая|ущее|ущие|ящий|ящая|ящее|ящие|ащий|ащая|ащее|ащие|вший|вшая|вшее|вшие|емый|емая|емое|емые|имый|имая|имое|имые|нный|нная|нное|нные)$/, ['ть', 'ться', 'нный', 'ть']],
  ];

  for (const [regex, baseEndings] of endingReplacements) {
    if (regex.test(cleanS)) {
      for (const baseEnd of baseEndings) {
        const stemS = cleanS.replace(regex, baseEnd);
        const matchesBase = [];
        for (const candL of candidates) {
          const testBase = cleanP + (candL === '—' ? '' : candL) + stemS;
          if (dictSet.has(testBase)) {
            matchesBase.push(candL.toUpperCase());
          }
        }
        if (matchesBase.length === 1) {
          return matchesBase[0];
        }
      }
    }
  }

  return (currentAns || '').toUpperCase();
}

// Step 2: Repair allWordsBank9_15.json (18,125 words)
const wordOverrides = {};
let repairedWordsCount = 0;

for (const w of allWords) {
  const cleanP = cleanWordOnly(w.prefix).toLowerCase().replace(/ё/g, 'е');
  const cleanS = cleanWordOnly(w.suffix).toLowerCase().replace(/ё/g, 'е');
  const stemKey = `${w.task}:${cleanP}..${cleanS}`;

  const oldLetter = w.missingLetter;
  const newLetter = resolveWordLetter(w.task, w.prefix, w.suffix, w.context, w.rule, oldLetter);

  if (newLetter && newLetter !== oldLetter) {
    w.missingLetter = newLetter;
    repairedWordsCount++;
    wordOverrides[w.id] = newLetter;
  } else if (EXPLICIT_GAP_FIXES[stemKey] && EXPLICIT_GAP_FIXES[stemKey] !== oldLetter) {
    w.missingLetter = EXPLICIT_GAP_FIXES[stemKey];
    repairedWordsCount++;
    wordOverrides[w.id] = w.missingLetter;
  }

  // Update wordGap and word cleanly
  if (w.task === '13' || w.task === '14') {
    w.wordGap = sanitizeDisplayText(w.wordGap || `${w.prefix} ${w.suffix}`);
    w.word = sanitizeDisplayText(w.word);
  } else {
    w.wordGap = `${w.prefix}..${w.suffix}`;
    const ins = w.missingLetter === '—' ? '' : w.missingLetter.toUpperCase();
    w.word = `${w.prefix}${ins}${w.suffix}`;
  }

  // Clean and isolate single-word explanation
  const singleExpl = extractSingleWordExplanation(w.rule, w.prefix, w.missingLetter, w.suffix, w.task);
  const classified = classifyWordSubtopicAndException(
    w.task,
    w.prefix,
    w.suffix,
    w.missingLetter,
    singleExpl || w.rule,
    w.context,
    w.isTrap
  );

  w.topic = classified.topic;
  w.category = classified.topic;
  w.isTrap = Boolean(w.isTrap || classified.isTrap);

  const solvedClean =
    w.task === '13' || w.task === '14'
      ? w.word
      : `${w.prefix}${w.missingLetter === '—' ? '' : w.missingLetter.toUpperCase()}${w.suffix}`;

  // If singleExpl was empty, had a fake 'А' template, or had wrong letter, build a clean concise explanation
  const hadCorruptedText =
    !singleExpl ||
    oldLetter !== w.missingLetter ||
    /Правописание (?:гласной|буквы) «?А»?/i.test(singleExpl) ||
    singleExpl.includes('..');

  if (hadCorruptedText) {
    w.rule = `${solvedClean} — ${classified.topic.toLowerCase()}. ${classified.rule}`;
  } else {
    w.rule = singleExpl;
  }

  // Register in trustedStemMap for sprint & fipi
  trustedStemMap.set(stemKey, w.missingLetter);
}

console.log(`allWordsBank9_15.json repaired letters: ${repairedWordsCount} / ${allWords.length}`);

// Step 3: Repair sprintBank9_15.json (13,604 questions)
const sprintOverrides = {};
let repairedSprintCount = 0;

for (const sq of sprintList) {
  const cleanP = cleanWordOnly(sq.prefix).toLowerCase().replace(/ё/g, 'е');
  const cleanS = cleanWordOnly(sq.suffix).toLowerCase().replace(/ё/g, 'е');
  const stemKey = `${sq.task}:${cleanP}..${cleanS}`;

  const oldAns = sq.answer;
  const newAns = resolveWordLetter(
    sq.task,
    sq.prefix,
    sq.suffix,
    sq.context,
    sq.explanation || sq.rule,
    oldAns
  );

  if (newAns && newAns !== oldAns) {
    sq.answer = newAns;
    repairedSprintCount++;
    sprintOverrides[sq.id] = newAns;
  }

  const singleExpl = extractSingleWordExplanation(
    sq.explanation,
    sq.prefix,
    sq.answer,
    sq.suffix,
    sq.task
  );
  const classified = classifyWordSubtopicAndException(
    sq.task,
    sq.prefix,
    sq.suffix,
    sq.answer,
    singleExpl || sq.rule,
    sq.context,
    sq.isTrap
  );

  sq.topic = classified.topic;
  sq.rule = classified.rule;
  sq.isTrap = Boolean(sq.isTrap || classified.isTrap);
  sq.options = getSmartChoiceOptions(sq.task, sq.answer, sq.prefix, sq.suffix);

  const solvedCap =
    sq.task === '13' || sq.task === '14'
      ? `${sq.prefix} ${sq.suffix}`
      : `${sq.prefix}${sq.answer === '—' ? '' : sq.answer.toUpperCase()}${sq.suffix}`;

  const hadBadExpl =
    !singleExpl ||
    oldAns !== sq.answer ||
    /В слове «[^»]*» пишется буква «А»/i.test(singleExpl) ||
    singleExpl.includes('..');

  if (hadBadExpl) {
    sq.explanation = `${solvedCap} — ${classified.topic.toLowerCase()}. ${classified.rule}`;
  } else {
    sq.explanation = singleExpl;
  }
}

console.log(`sprintBank9_15.json repaired answers: ${repairedSprintCount} / ${sprintList.length}`);

// Step 4: Repair fipiTasksBank9_15.json (2,704 tasks)
let repairedFipiWordsCount = 0;

for (const fq of fipiList) {
  const task = fq.task;
  for (const r of fq.rows || []) {
    // Clean row explanation
    r.explanation = sanitizeDisplayText(r.explanation || '');
    if (!['9', '10', '11', '12', '15'].includes(task)) continue;

    const rowLetters = [];
    const newSolvedWords = [];

    for (let i = 0; i < (r.words || []).length; i++) {
      const wGap = r.words[i];
      const oldSolved = r.solvedWords?.[i] || wGap;
      const parts = wGap.split(/\.\.+|_{1,}/);
      if (parts.length < 2) {
        newSolvedWords.push(sanitizeDisplayText(oldSolved));
        continue;
      }
      const pRaw = parts[0];
      const sRaw = parts.slice(1).join('');

      // Separate any parenthetical context from prefix/suffix
      let ctxFromGap = '';
      const parenMatches = wGap.match(/\([^)]*\)/g);
      if (parenMatches) {
        ctxFromGap = parenMatches.join(' ');
      }

      // Extract current letter in oldSolved
      let curL = '';
      if (oldSolved.startsWith(pRaw) && oldSolved.endsWith(sRaw) && oldSolved.length >= pRaw.length + sRaw.length) {
        curL = oldSolved.slice(pRaw.length, oldSolved.length - sRaw.length).toUpperCase();
      }

      const trueLetter = resolveWordLetter(task, pRaw, sRaw, ctxFromGap, r.explanation, curL || r.letter);
      const finalLetter = trueLetter || curL || r.letter || 'О';
      rowLetters.push(finalLetter);

      const insChar =
        task === '15'
          ? finalLetter.toLowerCase()
          : finalLetter === '—'
          ? ''
          : finalLetter.toUpperCase();
      const rebuiltSolved = `${pRaw}${insChar}${sRaw}`;
      if (rebuiltSolved !== oldSolved) {
        repairedFipiWordsCount++;
      }
      newSolvedWords.push(rebuiltSolved);
    }

    r.solvedWords = newSolvedWords;
    if (r.isCorrectRow && rowLetters.length > 0) {
      // Find majority letter in rowLetters
      const counts = {};
      for (const l of rowLetters) counts[l] = (counts[l] || 0) + 1;
      const bestL = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (bestL) r.letter = bestL;
    }
  }
}

console.log(`fipiTasksBank9_15.json repaired solvedWords: ${repairedFipiWordsCount}`);

// Step 5: Also repair starterBank.json (350 words + starter fipi & sprint)
if (Array.isArray(starterBank.words)) {
  const byIdWords = new Map(allWords.map((w) => [w.id, w]));
  starterBank.words = starterBank.words.map((sw) => byIdWords.get(sw.id) || sw);
}
if (Array.isArray(starterBank.fipi)) {
  const byIdFipi = new Map(fipiList.map((f) => [f.id, f]));
  starterBank.fipi = starterBank.fipi.map((sf) => byIdFipi.get(sf.id) || sf);
}
if (Array.isArray(starterBank.sprint)) {
  const byIdSprint = new Map(sprintList.map((s) => [s.id, s]));
  starterBank.sprint = starterBank.sprint.map((ss) => byIdSprint.get(ss.id) || ss);
}

// Write all 4 repaired banks back to disk
fs.writeFileSync(
  path.join(dataDir, 'allWordsBank9_15.json'),
  JSON.stringify(Array.isArray(allWordsRaw) ? allWords : { ...allWordsRaw, words: allWords }, null, 2),
  'utf8'
);
fs.writeFileSync(path.join(dataDir, 'fipiTasksBank9_15.json'), JSON.stringify(fipiList, null, 2), 'utf8');
fs.writeFileSync(path.join(dataDir, 'sprintBank9_15.json'), JSON.stringify(sprintList, null, 2), 'utf8');
fs.writeFileSync(path.join(dataDir, 'starterBank.json'), JSON.stringify(starterBank, null, 2), 'utf8');

// Step 6: Generate compact runtimeBankPatches.ts so CDN-fetched data is also repaired in <5ms in the browser
const runtimePatchContent = `// Auto-generated runtime orthography & explanation patches for CDN-loaded banks
export const WORD_LETTER_OVERRIDES: Record<string, string> = ${JSON.stringify(wordOverrides)};

export const SPRINT_LETTER_OVERRIDES: Record<string, string> = ${JSON.stringify(sprintOverrides)};

export const SINGLE_N_FIPI_IDS = new Set<string>(${JSON.stringify(Array.from(singleNFipiTaskIds))});
`;

fs.writeFileSync(path.join(dataDir, 'runtimeBankPatches.ts'), runtimePatchContent, 'utf8');
console.log('Successfully wrote all 4 JSON banks and src/data/runtimeBankPatches.ts!');
