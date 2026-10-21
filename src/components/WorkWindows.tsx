import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TaskId,
  TASK_IDS,
  TASK_META,
  TrainerQuestion,
  TrainerState,
  calculateAccuracyPercent,
  ErrorBankEntry,
  getTrainerBank,
  formatTask14SolvedWord,
} from '../utils/trainerLogic';
import { SwipeableSheet, LiquidGlassSegmented } from './LiquidGlassControls';
import { PARSED_WORDS_DATABASE, PARSED_SPRINT_QUESTIONS } from '../data/tasksBankData.ts';

/* ============================================================================
   1. ОКНО «ШАБЛОНЫ И УМНЫЙ ПОДБОР ЗАНЯТИЯ» (PresetsModal)
   ============================================================================ */
interface PresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: TrainerState;
  onApplyPreset: (qtyEach: number) => void;
  onApplyCustomQuantities: (quantities: Record<TaskId, number>) => void;
  onStartFipiTraps: () => void;
  onStartWeakestTaskWorkout: (taskId: TaskId) => void;
  onStartRealKimWorkout?: () => void;
}

export const PresetsModal: React.FC<PresetsModalProps> = React.memo(({
  isOpen,
  onClose,
  state,
  onApplyPreset,
  onApplyCustomQuantities,
  onStartFipiTraps,
  onStartWeakestTaskWorkout,
  onStartRealKimWorkout,
}) => {
  const weakestTask = useMemo<TaskId>(() => {
    let worstId: TaskId = '12';
    let worstAcc = 101;
    for (const id of TASK_IDS) {
      const st = state.taskStats[id];
      if (st && st.solved > 0) {
        const acc = calculateAccuracyPercent(st.correct, st.solved);
        if (acc < worstAcc) {
          worstAcc = acc;
          worstId = id;
        }
      }
    }
    return worstId;
  }, [state.taskStats]);

  const weakestStat = state.taskStats[weakestTask] || { solved: 0, correct: 0 };
  const weakestAcc = calculateAccuracyPercent(weakestStat.correct, weakestStat.solved);

  return (
    <SwipeableSheet
      id="presets-modal"
      handleId="presets-drag-handle"
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Шаблоны и умный подбор занятия"
      handleAriaLabel="Потяните вниз, чтобы закрыть шаблоны занятия"
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="min-w-0 flex-1 pr-2">
          <h3 className="text-[18px] font-extrabold tracking-tight leading-tight whitespace-nowrap truncate">
            Шаблоны занятия
          </h3>
          <span
            className="block text-[11.5px] truncate whitespace-nowrap mt-0.5"
            style={{ color: 'var(--ios-label-sec)' }}
          >
            Быстрый выбор объёма или старт в 1 касание
          </span>
        </div>
        <button
          id="close-presets-modal"
          type="button"
          onClick={onClose}
          className="liquid-pill-btn px-3.5 py-1.5 rounded-full text-[13.5px] font-bold cursor-pointer shrink-0"
        >
          Готово
        </button>
      </div>

      {/* Smart Focus Cards */}
      <div className="ios-section-header !px-1">Умные тренировки в 1 касание</div>
      <div className="grid grid-cols-1 gap-2 mb-2.5">
        <button
          type="button"
          id="smart-weakest-btn"
          onClick={() => {
            onClose();
            onStartWeakestTaskWorkout(weakestTask);
          }}
          className="ios-inset-group !mb-0 p-3 text-left flex items-center justify-between gap-2.5 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="ios-row-icon !w-9 !h-9 !rounded-xl !text-[14px] !m-0"
              style={{ background: TASK_META[weakestTask].gradient }}
            >
              {weakestTask}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-extrabold leading-tight whitespace-nowrap truncate">
                Слабая тема: № {weakestTask} ({weakestAcc}%)
              </div>
              <div
                className="text-[11.5px] leading-tight mt-0.5 truncate whitespace-nowrap"
                style={{ color: 'var(--ios-label-sec)' }}
              >
                {TASK_META[weakestTask].title} · 20 заданий
              </div>
            </div>
          </div>
          <span
            className="text-[11.5px] font-bold px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap"
            style={{ background: 'var(--ios-blue-soft)', color: 'var(--ios-blue)' }}
          >
            Старт →
          </span>
        </button>

        <button
          type="button"
          id="smart-traps-btn"
          onClick={() => {
            onClose();
            onStartFipiTraps();
          }}
          className="ios-inset-group !mb-0 p-3 text-left flex items-center justify-between gap-2.5 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="ios-row-icon !w-9 !h-9 !rounded-xl !text-[14px] !m-0"
              style={{ background: 'linear-gradient(135deg, #FF9500, #FF3B30)' }}
            >
              !
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-extrabold leading-tight whitespace-nowrap truncate">
                Ловушки ФИПИ (15 слов)
              </div>
              <div
                className="text-[11.5px] leading-tight mt-0.5 truncate whitespace-nowrap"
                style={{ color: 'var(--ios-label-sec)' }}
              >
                Главные слова-исключения заданий 9–15
              </div>
            </div>
          </div>
          <span
            className="text-[11.5px] font-bold px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap"
            style={{ background: 'var(--ios-orange-soft)', color: 'var(--ios-orange)' }}
          >
            Старт →
          </span>
        </button>

        <button
          type="button"
          id="smart-real-kim-btn"
          onClick={() => {
            onClose();
            if (onStartRealKimWorkout) {
              onStartRealKimWorkout();
            } else {
              onApplyCustomQuantities({ '9': 1, '10': 1, '11': 1, '12': 1, '13': 1, '14': 1, '15': 1 });
            }
          }}
          className="ios-inset-group !mb-0 p-3 text-left flex items-center justify-between gap-2.5 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="ios-row-icon !w-9 !h-9 !rounded-xl !text-[12px] font-black !m-0"
              style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}
            >
              КИМ
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-extrabold leading-tight whitespace-nowrap truncate">
                Реальный КИМ ЕГЭ (9–15)
              </div>
              <div
                className="text-[11.5px] leading-tight mt-0.5 truncate whitespace-nowrap"
                style={{ color: 'var(--ios-label-sec)' }}
              >
                7 заданий ФИПИ (по 1 каждого типа: № 9–15)
              </div>
            </div>
          </div>
          <span
            className="text-[11.5px] font-bold px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap"
            style={{ background: 'var(--ios-blue-soft)', color: 'var(--ios-blue)' }}
          >
            Старт →
          </span>
        </button>
      </div>

      {/* Preset Quantities */}
      <div className="ios-section-header !px-1">Готовые наборы для конструктора</div>
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <button
          type="button"
          id="preset-modal-5"
          onClick={() => {
            onApplyPreset(5);
            onClose();
          }}
          className="ios-inset-group !mb-0 p-3 text-left cursor-pointer"
        >
          <div className="text-[15px] font-extrabold" style={{ color: 'var(--ios-blue)' }}>
            По 5 заданий
          </div>
          <div className="text-[11px]" style={{ color: 'var(--ios-label-sec)' }}>
            Всего 35 · Разминка 5 мин
          </div>
        </button>

        <button
          type="button"
          id="preset-modal-15"
          onClick={() => {
            onApplyPreset(15);
            onClose();
          }}
          className="ios-inset-group !mb-0 p-3 text-left cursor-pointer"
        >
          <div className="text-[15px] font-extrabold" style={{ color: 'var(--ios-indigo)' }}>
            По 15 заданий
          </div>
          <div className="text-[11px]" style={{ color: 'var(--ios-label-sec)' }}>
            Всего 105 · Стандарт ФИПИ
          </div>
        </button>

        <button
          type="button"
          id="preset-modal-30"
          onClick={() => {
            onApplyPreset(30);
            onClose();
          }}
          className="ios-inset-group !mb-0 p-3 text-left cursor-pointer"
        >
          <div className="text-[15px] font-extrabold" style={{ color: 'var(--ios-purple)' }}>
            По 30 заданий
          </div>
          <div className="text-[11px]" style={{ color: 'var(--ios-label-sec)' }}>
            Всего 210 · Глубокий разбор
          </div>
        </button>

        <button
          type="button"
          id="preset-modal-100"
          onClick={() => {
            onApplyPreset(100);
            onClose();
          }}
          className="ios-inset-group !mb-0 p-3 text-left cursor-pointer"
        >
          <div className="text-[15px] font-extrabold" style={{ color: 'var(--ios-orange)' }}>
            По 100 заданий
          </div>
          <div className="text-[11px]" style={{ color: 'var(--ios-label-sec)' }}>
            Всего 700 · Полный марафон
          </div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            onApplyCustomQuantities({ '9': 10, '10': 10, '11': 0, '12': 0, '13': 0, '14': 0, '15': 0 });
            onClose();
          }}
          className="ios-btn-tinted !min-h-[38px] !text-[12px] w-full"
        >
          Корни и приставки (9–10)
        </button>
        <button
          type="button"
          id="preset-modal-clear"
          onClick={() => {
            onApplyPreset(0);
            onClose();
          }}
          className="ios-btn-tinted !min-h-[38px] !text-[12px] w-full"
          style={{ background: 'var(--ios-red-soft)', color: 'var(--ios-red)' }}
        >
          Сбросить все в 0
        </button>
      </div>
    </SwipeableSheet>
  );
});

/* ============================================================================
   2. ОКНО «РАЗБОР ПРАВИЛА И АЛГОРИТМА ФИПИ» (RuleInspectorModal)
      + КОМПОНЕНТ СТРУКТУРИРОВАННОЙ КАРТОЧКИ ОШИБКИ (StructuredErrorCard)
   ============================================================================ */
interface RuleInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: TrainerQuestion | null;
  errorEntry?: ErrorBankEntry | null;
  onOpenFullCheatsheet: (taskId: TaskId) => void;
}

interface StructuredStep {
  title: string;
  detail: string;
}

interface RuleComparisonPair {
  leftBadge: string;
  leftItems: string[];
  rightBadge: string;
  rightItems: string[];
}

const TASK_RULE_COMPARISON: Record<TaskId, RuleComparisonPair> = {
  '9': {
    leftBadge: 'Пишем И / А',
    leftItems: [
      'Суффикс -А- после корня (-бир-, -кас-, -лаг-)',
      'Под ударением в -гар-, -клан-, -твар-',
      'Без ударения в -зар-, -плав-',
    ],
    rightBadge: 'Пишем Е / О',
    rightItems: [
      'Нет суффикса -А- (-бер-, -кос-, -лож-)',
      'Без ударения в -гор-, -клон-, -твор-',
      'Перед С в -рос- и Ч в -скоч-',
    ],
  },
  '10': {
    leftBadge: 'ПРЕ- / Ъ / И',
    leftItems: [
      'ПРЕ- = «очень» или близко к ПЕРЕ-',
      'Ъ — после приставок перед Е, Ё, Ю, Я',
      'И — после МЕЖ-, СВЕРХ- и иноязычных',
    ],
    rightBadge: 'ПРИ- / Ь / Ы',
    rightItems: [
      'ПРИ- = близость, присоединение, неполнота',
      'Ь — внутри корня (подьячий, пьедестал)',
      'Ы — после русских приставок на согл.',
    ],
  },
  '11': {
    leftBadge: 'Суффиксы с И / О / А',
    leftItems: [
      '-ЧИВ- и -ЛИВ- (всегда пишется И)',
      '-ЫВА-/-ИВА- (если в 1 л. «я -ываю»)',
      'Наречия с ИЗ-, ДО-, С- → суффикс -А',
    ],
    rightBadge: 'Суффиксы с Е / О',
    rightItems: [
      'Без ударения в прил. → суффикс -ЕВ-',
      '-ОВА-/-ЕВА- (если в 1 л. «я -ую/-юю»)',
      'Наречия с В-, НА-, ЗА- → суффикс -О',
    ],
  },
  '12': {
    leftBadge: 'I спряжение (Е, У, Ю)',
    leftItems: [
      'Глаголы не на -ИТЬ (колоть, бороться)',
      'Все глаголы на -ЯТЬ (сеять, лелеять, веять)',
      'Исключения: брить, стелить, зиждиться',
    ],
    rightBadge: 'II спряжение (И, А, Я)',
    rightItems: [
      'Все глаголы на -ИТЬ (клеить, строить)',
      '7 глаголов на -ЕТЬ (видеть, ненавидеть)',
      '4 глагола на -АТЬ (дышать, слышать, гнать, держать)',
    ],
  },
  '13': {
    leftBadge: 'Пишем СЛИТНО',
    leftItems: [
      'Без НЕ не употребляется (негодуя, нелепый)',
      'Полные причастия без зависимых слов',
      'С наречиями меры (очень, крайне, абсолютно)',
    ],
    rightBadge: 'Пишем РАЗДЕЛЬНО',
    rightItems: [
      'Глаголы, деепричастия, краткие причастия',
      'Причастия с зависимыми словами',
      'Маркеры: отнюдь не, вовсе не, далеко не',
    ],
  },
  '14': {
    leftBadge: 'Пишем СЛИТНО',
    leftItems: [
      'Союзы ЧТОБЫ, ТАКЖЕ, ТОЖЕ (заменяются на союз И или ДЛЯ ТОГО ЧТОБЫ)',
      'Производные предлоги: ВВИДУ, ВСЛЕДСТВИЕ, НАВСТРЕЧУ (ввиду = из-за)',
      'Слова с ПОЛ- перед согласной (кроме Л): полгорода, полчаса',
    ],
    rightBadge: 'ДЕФИСНО / РАЗДЕЛЬНО',
    rightItems: [
      'Омонимичные сочетания: ЧТО БЫ (бы убирается), ТАК ЖЕ (как), В ВИДУ',
      'Предлоги времени раздельно с Е: В ТЕЧЕНИЕ, В ПРОДОЛЖЕНИЕ',
      'Дефис: частицы -то, -либо, -нибудь, кое-, приставка по- + -ому/-ему/-и, корень пол- (ЮЛЯ)',
    ],
  },
  '15': {
    leftBadge: 'Одна буква Н',
    leftItems: [
      'Суффиксы -АН-, -ЯН-, -ИН- (глиняный, утиный, искл.: стеклянный, оловянный, деревянный)',
      'Отглагольные прил. без приставки и зависимых слов (жареный, варёный, кованый)',
      'Краткие страдательные причастия всегда с одной Н (книга прочитана, задача решена)',
    ],
    rightBadge: 'Две буквы НН',
    rightItems: [
      'Суффиксы -ЕНН-, -ОНН- (соломенный, экскурсионный, искл.: ветреный)',
      'Стык основы на Н + суффикс Н (туманный, старинный, осенний)',
      'Полные причастия: есть приставка (пожаренный), зависимое слово (жаренный с грибами)',
    ],
  },
};

const TASK_STRUCTURED_STEPS: Record<TaskId, StructuredStep[]> = {
  '9': [
    {
      title: 'Выделите корень и смысл',
      detail: 'Отбросьте омонимичные корни по подсказке в скобках (мирить ≠ мерить).',
    },
    {
      title: 'Условие чередования',
      detail: 'Проверьте суффикс -А- (-бир-/-бер-, -кас-/-кос-), ударение (-гар-/-гор-) или согласную.',
    },
    {
      title: 'Сверка со списком ФИПИ',
      detail: 'Исключения: выгарки, полог, росток, отрасль, скачок, пловец, сочетать.',
    },
  ],
  '10': [
    {
      title: 'Граница приставки и корня',
      detail: 'В словах несгораемый, несдобровать две приставки: НЕ- + С- (приставки З- нет).',
    },
    {
      title: 'Значение ПРЕ- и ПРИ-',
      detail: 'ПРЕ- = «очень» или «пере-»; ПРИ- = приближение, присоединение, неполнота.',
    },
    {
      title: 'Стык приставки (Ъ/Ь и Ы/И)',
      detail: 'После русских приставок пишем Ы (кроме взимать), после МЕЖ-, СВЕРХ- и иноязычных — И.',
    },
  ],
  '11': [
    {
      title: 'Определите часть речи',
      detail: 'Правило выбора суффикса зависит от того, глагол это, прилагательное или сущ.',
    },
    {
      title: 'Форма 1-го лица у глаголов',
      detail: '«Я что делаю?»: на -УЮ/-ЮЮ → -ОВА-/-ЕВА- (но затмевать, продлевать, застревать — Е).',
    },
    {
      title: 'Ударение в прилагательных',
      detail: 'В -ЧИВ-/-ЛИВ- всегда И; без ударения -ЕВ- (исключения: милостивый, юродивый).',
    },
  ],
  '12': [
    {
      title: 'Определите время формы',
      detail: 'Для настоящего/будущего нужно спряжение; для прошедшего (-ВШ-, -НН-) — буква перед -ТЬ.',
    },
    {
      title: 'Спряжение по инфинитиву',
      detail: 'I спр. (вкл. брить, стелить и на -ЯТЬ) → Е/У/Ю; II спр. (на -ИТЬ + 11 искл.) → И/А/Я.',
    },
    {
      title: 'Страдательные причастия (-НН-)',
      detail: 'На -АТЬ/-ЯТЬ → -АНН-/-ЯНН-; на -ИТЬ/-ЕТЬ → -ЕНН- (выкатить → выкаченный).',
    },
  ],
  '13': [
    {
      title: 'Употребляется ли без НЕ',
      detail: 'Слова вроде негодуя, невзлюбить, нелепый, неряха всегда пишутся слитно.',
    },
    {
      title: 'Часть речи (глагол / причастие)',
      detail: 'Глаголы, деепричастия и краткие причастия — раздельно (но предлог «несмотря на» — слитно).',
    },
    {
      title: 'Зависимые слова и маркеры',
      detail: 'Причастие с зависимым словом или «отнюдь не / вовсе не» — раздельно; «очень / крайне» — слитно.',
    },
  ],
  '14': [
    {
      title: 'Проверка союзов и омонимов',
      detail: 'ЧТОБЫ (= для того чтобы) vs ЧТО БЫ (частицу БЫ можно опустить или переставить без потери смысла).',
    },
    {
      title: 'Производные предлоги',
      detail: 'ВВИДУ (= из-за), ВСЛЕДСТВИЕ (= из-за) — слитно. В ВИДУ (иметь в виду) и В ТЕЧЕНИЕ, В ПРОДОЛЖЕНИЕ — раздельно с буквой Е на конце.',
    },
    {
      title: 'Дефисные правила и корень ПОЛ-',
      detail: 'Дефис: частицы -то, -либо, -нибудь, кое-, приставка по- + -ому/-ему/-и. Корень пол- пишется через дефис по правилу ЮЛИ (перед гласной, буквой Л, заглавной).',
    },
  ],
  '15': [
    {
      title: 'Часть речи и способ образования',
      detail: 'Определите, от чего образовано слово: от существительного (отыменное) или от глагола (отглагольное/причастие).',
    },
    {
      title: 'Отыменные: суффиксы и стык корня',
      detail: 'Суффиксы -АН-/-ЯН-/-ИН- (глиняный, искл.: стеклянный, оловянный, деревянный — НН). Стык корня на Н + суффикс Н (каменный). С суффиксом -ЕНН-/-ОНН- — НН (искл.: ветреный).',
    },
    {
      title: 'Глагольные: 4 признака двух букв НН',
      detail: 'Пишем НН, если: есть приставка (кроме НЕ-), есть зависимое слово, суффиксы -ОВА-/-ЕВА- или сов. вид глагола. Краткие страдательные причастия ВСЕГДА пишутся с одной буквой Н.',
    },
  ],
};

const TASK_KEY_EXCEPTIONS: Record<TaskId, string[]> = {
  '9': ['выгарки', 'полог', 'росток', 'отрасль', 'скачок', 'пловец', 'сочетать'],
  '10': ['взимать', 'несгораемый', 'подьячий', 'сверхизысканный', 'адъютант'],
  '11': ['милостивый', 'юродивый', 'затмевать', 'продлевать', 'застревать'],
  '12': ['стелющийся', 'бреющий', 'зиждущийся', 'клеящий', 'выкаченный'],
  '13': ['несмотря на', 'негодуя', 'вовсе не', 'отнюдь не', 'далеко не'],
  '14': ['чтобы', 'также', 'тоже', 'ввиду', 'в течение', 'по-новому', 'пол-яблока'],
  '15': ['стеклянный', 'оловянный', 'деревянный', 'ветреный', 'кованый', 'раненый', 'жареный'],
};

function splitFormulaSteps(rawExplanation: string): { head: string; tail: string } {
  const arrowMatch = rawExplanation.split(/\s*(?:→|←|—|=)\s*/);
  if (arrowMatch.length >= 2) {
    return {
      head: arrowMatch[0].trim(),
      tail: arrowMatch.slice(1).join(' → ').trim(),
    };
  }
  return { head: 'Алгоритм', tail: rawExplanation };
}

export interface StructuredErrorCardProps {
  task: TaskId;
  topic: string;
  wordTitle: string;
  context?: string;
  userChoice: string;
  correctChoice: string;
  explanation: string;
  rule?: string;
  question?: TrainerQuestion;
  onInspectRule: () => void;
  staggerIndex?: number;
  forceCollapsed?: boolean;
}

export const StructuredErrorCard: React.FC<StructuredErrorCardProps> = React.memo(({
  task,
  topic,
  wordTitle,
  context,
  userChoice,
  correctChoice,
  explanation,
  rule,
  question,
  onInspectRule,
  staggerIndex = 0,
  forceCollapsed,
}) => {
  const isFipi5Row = question?.kind === 'fipi' || explanation.includes('Строка ') || explanation.includes(';');
  const formula = splitFormulaSteps(explanation);
  const shortRule = rule ? rule.split('.')[0] + '.' : TASK_META[task].subtitle;
  
  // Synchronous override state - guarantees zero frame lag when forceCollapsed changes
  const [userOverride, setUserOverride] = useState<boolean | null>(null);
  const prevForceRef = useRef(forceCollapsed);
  if (prevForceRef.current !== forceCollapsed) {
    prevForceRef.current = forceCollapsed;
    if (userOverride !== null) {
      setUserOverride(null);
    }
  }
  const isCollapsed = userOverride !== null ? userOverride : (forceCollapsed ?? false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onInspectRule}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onInspectRule();
        }
      }}
      className="ios-inset-group ios-scroll-item p-3.5 !mb-0 ios-stagger-card cursor-pointer active:scale-[0.985] hover:border-[var(--ios-blue)]/50 hover:shadow-sm select-none transition-[border-color,box-shadow,background-color] duration-200"
      style={{ animationDelay: `${Math.min(staggerIndex * 35, 180)}ms` }}
    >
      {/* Top Row: Task Badge + Topic + Collapse Toggle + Structured "Правило ?" Trigger */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-5 h-5 rounded-md text-[11px] font-extrabold flex items-center justify-center text-white shrink-0"
            style={{ background: TASK_META[task].gradient }}
          >
            {task}
          </span>
          <span
            className="text-[11.5px] font-extrabold truncate"
            style={{ color: 'var(--ios-blue)' }}
          >
            {topic}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setUserOverride((prev) => (prev !== null ? !prev : !isCollapsed));
            }}
            aria-label={isCollapsed ? 'Развернуть карточку' : 'Свернуть карточку'}
            className="liquid-pill-btn text-[11px] font-bold px-2.5 py-0.5 rounded-full cursor-pointer flex items-center gap-1 transition-colors"
            style={{
              background: isCollapsed ? 'var(--ios-blue-soft)' : undefined,
              color: isCollapsed ? 'var(--ios-blue)' : undefined,
            }}
          >
            <span>{isCollapsed ? 'Развернуть' : 'Свернуть'}</span>
            <svg
              className={`w-3.5 h-3.5 ios-accordion-arrow ${isCollapsed ? 'rotated' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspectRule();
            }}
            className="liquid-pill-btn text-[11.5px] font-bold px-2.5 py-1 rounded-full cursor-pointer flex items-center gap-1"
          >
            <span>Правило ?</span>
          </button>
        </div>
      </div>

      {/* Middle Row: Word / Task Title + User vs Correct Answer Pills */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-extrabold leading-tight truncate">
            {isFipi5Row ? `Задание № ${task} (5 строк)` : wordTitle}
          </div>
          {context && !isFipi5Row && (
            <div
              className="text-[11.5px] font-medium truncate mt-0.5"
              style={{ color: 'var(--ios-label-sec)' }}
            >
              {context}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="px-2 py-0.5 rounded-lg text-[11px] font-extrabold whitespace-nowrap"
            style={{
              background: 'var(--ios-red-soft)',
              color: 'var(--ios-red)',
            }}
          >
            Вы: {userChoice}
          </span>
          <span
            className="px-2 py-0.5 rounded-lg text-[11px] font-extrabold whitespace-nowrap"
            style={{
              background: 'var(--ios-green-soft)',
              color: 'var(--ios-green)',
            }}
          >
            Верно: {correctChoice}
          </span>
        </div>
      </div>

      {/* Collapsible Section with 120 FPS CSS Grid Spring Fold Animation */}
      <div className={`ios-accordion-grid ${!isCollapsed ? 'open' : ''}`}>
        <div className="ios-accordion-content">
          <div className="pt-1.5 flex flex-col gap-1.5">
              {/* Bottom Structured Breakdown (Zero Wall-of-Text!) */}
              {question && question.kind === 'fipi' ? (
                <div className="flex flex-col gap-1">
                  {question.rows.map((r, rIdx) => {
                    const rowNum = rIdx + 1;
                    const userPicked = userChoice.includes(String(rowNum));
                    return (
                      <div
                        key={rowNum}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px]"
                        style={{
                          background: r.isCorrectRow
                            ? 'var(--ios-green-soft)'
                            : userPicked
                            ? 'var(--ios-red-soft)'
                            : 'var(--ios-bg-secondary)',
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className="w-4 h-4 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0"
                            style={{
                              background: r.isCorrectRow
                                ? 'var(--ios-green)'
                                : userPicked
                                ? 'var(--ios-red)'
                                : 'var(--ios-bg-tertiary)',
                              color: r.isCorrectRow || userPicked ? '#FFFFFF' : 'var(--ios-label-sec)',
                            }}
                          >
                            {rowNum}
                          </span>
                          <span className="font-bold truncate">
                            {r.solvedWords.join(', ')}
                          </span>
                        </div>
                        <span
                          className="text-[10.5px] font-extrabold shrink-0 whitespace-nowrap"
                          style={{
                            color: r.isCorrectRow
                              ? 'var(--ios-green)'
                              : userPicked
                              ? 'var(--ios-red)'
                              : 'var(--ios-label-sec)',
                          }}
                        >
                          {r.isCorrectRow ? `Буква ${r.letter}` : 'Разные'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : isFipi5Row ? (
                <div className="flex flex-col gap-1">
                  {explanation
                    .split(/\s*(?:\||;)\s*/)
                    .filter(Boolean)
                    .map((part, pIdx) => (
                      <div
                        key={pIdx}
                        className="px-2.5 py-1.5 rounded-xl text-[11.5px] font-bold flex items-center gap-2"
                        style={{ background: 'var(--ios-bg-secondary)' }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: 'var(--ios-green)' }}
                        />
                        <span className="truncate">{part}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {/* Structured 2-part Word Formula Bar */}
                  <div
                    className="p-2 rounded-xl flex items-center justify-between gap-2"
                    style={{ background: 'var(--ios-bg-secondary)' }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 text-[11.5px] font-bold">
                      <span
                        className="px-2 py-0.5 rounded-md text-[10.5px] font-extrabold shrink-0"
                        style={{
                          background: 'var(--ios-blue-soft)',
                          color: 'var(--ios-blue)',
                        }}
                      >
                        Формула
                      </span>
                      <span className="truncate font-extrabold">{formula.head}</span>
                      <span style={{ color: 'var(--ios-blue)' }} className="shrink-0 font-extrabold">
                        →
                      </span>
                      <span
                        className="truncate font-bold"
                        style={{ color: 'var(--ios-label)' }}
                      >
                        {formula.tail}
                      </span>
                    </div>
                  </div>

                  {/* Concise 1-Line Core Rule Pill */}
                  <div
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5"
                    style={{
                      background: 'var(--ios-bg-secondary)',
                      color: 'var(--ios-label-sec)',
                    }}
                  >
                    <span
                      className="font-extrabold shrink-0"
                      style={{ color: 'var(--ios-purple)' }}
                    >
                      Правило:
                    </span>
                    <span className="truncate">{shortRule}</span>
                  </div>
                </div>
              )}

              {/* Tap hint footer */}
              <div
                className="flex items-center justify-between text-[11px] font-bold mt-1 pt-1.5 border-t border-[var(--ios-separator)]/60 opacity-80"
                style={{ color: 'var(--ios-blue)' }}
              >
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 shrink-0"><use href="#sf-sparkles" /></svg>
                  <span>Нажмите на карточку для полного объяснения</span>
                </span>
                <span className="text-[14px] leading-none font-extrabold">›</span>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
});

export const RuleInspectorModal: React.FC<RuleInspectorModalProps> = React.memo(({
  isOpen,
  onClose,
  question,
  errorEntry,
  onOpenFullCheatsheet,
}) => {
  // Cache the last active question and errorEntry so that during the 440ms exit slide-down animation,
  // the content remains fully rendered while sliding down smoothly!
  const cachedDataRef = useRef<{
    question: TrainerQuestion | null;
    errorEntry: ErrorBankEntry | null;
  }>({ question: null, errorEntry: null });

  if (question || errorEntry) {
    cachedDataRef.current = { question, errorEntry: errorEntry ?? null };
  }

  const activeQuestion = question || cachedDataRef.current.question;
  const activeError = errorEntry || cachedDataRef.current.errorEntry;

  if (!activeQuestion && !activeError) return null;
  const task = (activeError?.task || activeQuestion?.task || '9') as TaskId;
  const meta = TASK_META[task];
  const topic = activeError?.topic || activeQuestion?.topic || 'Орфография';
  const steps = TASK_STRUCTURED_STEPS[task] || [];
  const comparison = TASK_RULE_COMPARISON[task];
  const exceptionChips = TASK_KEY_EXCEPTIONS[task] || [];

  const rawExplanation =
    activeError?.explanation ||
    (activeQuestion?.kind === 'sprint' ? activeQuestion.explanation : '') ||
    '';
  const ruleText = activeError?.rule || activeQuestion?.rule || '';
  const userChoice = activeError?.userChoice;
  const correctChoice =
    activeError?.correctChoice ||
    (activeQuestion?.kind === 'sprint'
      ? activeQuestion.answer
      : activeQuestion?.correctIndices?.join(''));

  const solvedWordPreview =
    activeError?.correctWord ||
    (activeQuestion?.kind === 'sprint'
      ? activeQuestion.task === '13'
        ? `${activeQuestion.prefix.replace(/[()]/g, '')}${
            activeQuestion.answer === 'СЛИТНО' ? '' : ' '
          }${activeQuestion.suffix}`
        : activeQuestion.task === '14'
        ? formatTask14SolvedWord(
            activeQuestion.prefix,
            activeQuestion.suffix,
            activeQuestion.answer
          )
        : `${activeQuestion.prefix}${activeQuestion.answer.toLowerCase()}${activeQuestion.suffix}`
      : null);

  const contextText =
    activeError?.context ||
    (activeQuestion?.kind === 'sprint' ? activeQuestion.context : undefined);

  return (
    <SwipeableSheet
      id="rule-inspector-modal"
      handleId="rule-inspector-drag-handle"
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Разбор правила задания"
      handleAriaLabel="Потяните вниз, чтобы закрыть разбор правила"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
          <div
            className="ios-row-icon !w-9 !h-9 !rounded-xl !m-0 shrink-0"
            style={{ background: meta.gradient }}
          >
            {task}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-extrabold tracking-tight leading-tight whitespace-nowrap truncate">
              Задание {task} · Полный разбор
            </h3>
            <span
              className="block text-[11.5px] truncate whitespace-nowrap mt-0.5 font-bold"
              style={{ color: 'var(--ios-blue)' }}
            >
              {topic}
            </span>
          </div>
        </div>
        <button
          id="close-rule-inspector"
          type="button"
          onClick={onClose}
          className="liquid-pill-btn px-3.5 py-1.5 rounded-full text-[13px] font-bold cursor-pointer shrink-0"
        >
          Понятно
        </button>
      </div>

      <div className="cheat-reader flex-1 mb-2">
        {/* 1. Main Word Breakdown Card */}
        <div className="ios-inset-group p-3.5 !mb-2.5 ios-stagger-card">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span
              className="text-[10px] font-extrabold uppercase tracking-wider"
              style={{ color: 'var(--ios-blue)' }}
            >
              Слово из задания
            </span>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              {userChoice && (
                <span
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold whitespace-nowrap"
                  style={{
                    background: 'var(--ios-red-soft)',
                    color: 'var(--ios-red)',
                  }}
                >
                  Вы ответили: {userChoice}
                </span>
              )}
              {correctChoice && (
                <span
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold whitespace-nowrap"
                  style={{
                    background: 'var(--ios-green-soft)',
                    color: 'var(--ios-green)',
                  }}
                >
                  Верно: {correctChoice}
                </span>
              )}
            </div>
          </div>

          <div
            className="text-[20px] sm:text-[23px] font-black leading-tight tracking-tight mb-1"
            style={{ color: 'var(--ios-label)' }}
          >
            {solvedWordPreview || `Задание № ${task}`}
          </div>

          {contextText && (
            <div
              className="text-[12.5px] font-semibold mb-2"
              style={{ color: 'var(--ios-label-sec)' }}
            >
              {contextText}
            </div>
          )}

          {/* Full Explanation Box */}
          {rawExplanation && (
            <div
              className="p-3 rounded-2xl flex flex-col gap-1.5 mt-2 border border-[var(--ios-separator)]/60"
              style={{ background: 'var(--ios-bg-secondary)' }}
            >
              <div
                className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide"
                style={{ color: 'var(--ios-blue)' }}
              >
                <svg className="w-3.5 h-3.5 shrink-0">
                  <use href="#sf-sparkles" />
                </svg>
                <span>Полное объяснение:</span>
              </div>
              <div
                className="text-[13px] sm:text-[13.5px] font-medium leading-relaxed break-words whitespace-pre-line"
                style={{ color: 'var(--ios-label)' }}
              >
                {rawExplanation}
              </div>
            </div>
          )}

          {/* Full Rule Box */}
          {ruleText && (
            <div
              className="p-3 rounded-2xl flex flex-col gap-1.5 mt-2 border border-[var(--ios-separator)]/60"
              style={{ background: 'var(--ios-bg-secondary)' }}
            >
              <div
                className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide"
                style={{ color: 'var(--ios-purple)' }}
              >
                <svg className="w-3.5 h-3.5 shrink-0">
                  <use href="#sf-book-fill" />
                </svg>
                <span>Правило орфографии ФИПИ:</span>
              </div>
              <div
                className="text-[13px] sm:text-[13.5px] font-semibold leading-relaxed break-words"
                style={{ color: 'var(--ios-label)' }}
              >
                {ruleText}
              </div>
            </div>
          )}
        </div>

        {/* 2. FIPI 5-row breakdown if applicable */}
        {activeQuestion && activeQuestion.kind === 'fipi' && (
          <div className="ios-inset-group p-3 !mb-2.5 ios-stagger-card">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span
                className="text-[10px] font-extrabold uppercase tracking-wider"
                style={{ color: 'var(--ios-blue)' }}
              >
                Построчный разбор задания
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-[11.5px] font-extrabold shrink-0"
                style={{
                  background: 'var(--ios-green-soft)',
                  color: 'var(--ios-green)',
                }}
              >
                Ответ: {activeQuestion.correctIndices.join('')}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {activeQuestion.rows.map((r, rIdx) => (
                <div
                  key={rIdx}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px]"
                  style={{
                    background: r.isCorrectRow
                      ? 'var(--ios-green-soft)'
                      : 'var(--ios-bg-secondary)',
                  }}
                >
                  <span className="font-bold truncate">
                    <strong>{rIdx + 1})</strong> {r.solvedWords.join(', ')}
                  </span>
                  <span
                    className="text-[10.5px] font-extrabold shrink-0 whitespace-nowrap"
                    style={{
                      color: r.isCorrectRow
                        ? 'var(--ios-green)'
                        : 'var(--ios-label-sec)',
                    }}
                  >
                    {r.isCorrectRow ? `Буква ${r.letter}` : 'Разные'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Structured 2-Column Visual Rule Schema */}
        <div
          className="ios-inset-group p-3 !mb-2 ios-stagger-card"
          style={{ animationDelay: '35ms' }}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              className="text-[10px] font-extrabold uppercase tracking-wider"
              style={{ color: 'var(--ios-blue)' }}
            >
              Структурная схема правила ФИПИ
            </span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--ios-blue-soft)',
                color: 'var(--ios-blue)',
              }}
            >
              {meta.cheatPages}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div
              className="p-2.5 rounded-xl"
              style={{ background: 'var(--ios-bg-secondary)' }}
            >
              <div
                className="text-[11px] font-extrabold mb-1 px-2 py-0.5 rounded-md inline-block"
                style={{
                  background: 'var(--ios-blue-soft)',
                  color: 'var(--ios-blue)',
                }}
              >
                {comparison.leftBadge}
              </div>
              <ul className="m-0 pl-3.5 text-[11px] leading-snug space-y-1 font-semibold">
                {comparison.leftItems.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </div>

            <div
              className="p-2.5 rounded-xl"
              style={{ background: 'var(--ios-bg-secondary)' }}
            >
              <div
                className="text-[11px] font-extrabold mb-1 px-2 py-0.5 rounded-md inline-block"
                style={{
                  background: 'var(--ios-purple-soft)',
                  color: 'var(--ios-purple)',
                }}
              >
                {comparison.rightBadge}
              </div>
              <ul className="m-0 pl-3.5 text-[11px] leading-snug space-y-1 font-semibold">
                {comparison.rightItems.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Visual Exception Chips */}
          <div
            className="p-2 rounded-xl"
            style={{ background: 'var(--ios-orange-soft)' }}
          >
            <div
              className="text-[10px] font-extrabold uppercase tracking-wider mb-1"
              style={{ color: 'var(--ios-orange)' }}
            >
              Главные слова-ловушки задания № {task}:
            </div>
            <div className="flex flex-wrap gap-1">
              {exceptionChips.map((chip) => (
                <span
                  key={chip}
                  className="px-2 py-0.5 rounded-full text-[11px] font-extrabold"
                  style={{
                    background: 'var(--ios-bg-cell-hover)',
                    color: 'var(--ios-orange)',
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Structured 3-Step Algorithm Cards */}
        <div
          className="ios-inset-group p-3 !mb-1 ios-stagger-card"
          style={{ animationDelay: '70ms' }}
        >
          <div
            className="text-[10px] font-extrabold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--ios-purple)' }}
          >
            Алгоритм проверки в 3 шага
          </div>
          <div className="flex flex-col gap-1.5">
            {steps.map((step, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-2 rounded-xl"
                style={{ background: 'var(--ios-bg-secondary)' }}
              >
                <span
                  className="w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: 'var(--ios-purple-soft)',
                    color: 'var(--ios-purple)',
                  }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-extrabold leading-tight">
                    {step.title}
                  </div>
                  <div
                    className="text-[11px] leading-snug mt-0.5"
                    style={{ color: 'var(--ios-label-sec)' }}
                  >
                    {step.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenFullCheatsheet(task);
        }}
        className="ios-btn-primary !min-h-[46px] !text-[14.5px]"
      >
        <span>Открыть полный конспект № {task} ({meta.cheatPages})</span>
      </button>
    </SwipeableSheet>
  );
});

/* ============================================================================
   3. ОКНО «СЛОВАРЬ ИСКЛЮЧЕНИЙ И ЛОВУШЕК ФИПИ 9–13» (DictionaryModal)
   ============================================================================ */
interface DictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTrapsWorkout: () => void;
}

interface DictEntry {
  task: TaskId;
  word: string;
  highlight: string;
  category: string;
  note: string;
  source?: string;
}

const FIPI_DICTIONARY: DictEntry[] = [
  { task: '9', word: 'выгарки, изгарь, пригарь', highlight: 'А', category: 'Исключения -ГАР-/-ГОР-', note: 'Без ударения пишется А (вопреки правилу -ГОР-)', source: 'ФИПИ Ловушка' },
  { task: '9', word: 'зоревать', highlight: 'О', category: 'Исключение -ЗАР-/-ЗОР-', note: 'Без ударения пишется О («не спать на заре»)', source: 'ФИПИ Ловушка' },
  { task: '9', word: 'полог', highlight: 'О', category: 'Исключение -ЛАГ-/-ЛОЖ-', note: 'Перед Г без суффикса -А- пишется О', source: 'ФИПИ Ловушка' },
  { task: '9', word: 'отрасль', highlight: 'А', category: 'Исключение -РАСТ-/-РОС-', note: 'Перед С пишется А', source: 'ФИПИ Ловушка' },
  { task: '9', word: 'росток, ростовщик, подростковый, заросли', highlight: 'О', category: 'Исключения -РАСТ-/-РОС-', note: 'Перед СТ пишется О', source: 'ФИПИ Ловушка' },
  { task: '9', word: 'скачок, скачу, скачи', highlight: 'А', category: 'Исключения -СКАК-/-СКОЧ-', note: 'Перед Ч пишется А', source: 'ФИПИ Ловушка' },
  { task: '9', word: 'пловец, пловчиха', highlight: 'О', category: 'Исключения -ПЛАВ-/-ПЛОВ-', note: 'В корне пишется О (плывун — Ы)', source: 'ФИПИ Ловушка' },
  { task: '9', word: 'утварь', highlight: 'А', category: 'Исключение -ТВАР-/-ТВОР-', note: 'Под ударением и без ударения А', source: 'ФИПИ Ловушка' },
  { task: '9', word: 'уровень, ровесник, поровну', highlight: 'О', category: 'Исключения -РАВН-/-РОВН-', note: 'Пишется с буквой О', source: 'ФИПИ Ловушка' },
  { task: '9', word: 'равнина, равняйсь, равнение', highlight: 'А', category: 'Исключения -РАВН-/-РОВН-', note: 'Пишется с буквой А', source: 'ФИПИ Ловушка' },
  { task: '9', word: 'сочетать, сочетание, словосочетание', highlight: 'Е', category: 'Исключения -ЧЕТ-/-ЧИТ-', note: 'Даже перед суффиксом -А- пишется Е', source: 'ФИПИ Ловушка' },
  { task: '10', word: 'несгораемый, несдобровать, несговорчивый', highlight: 'С', category: 'Две приставки НЕ- + С-', note: 'Приставки З- не существует', source: 'ФИПИ Ловушка' },
  { task: '10', word: 'взимать', highlight: 'И', category: 'Исключение Ы/И после приставок', note: 'После русской приставки ВЗ- сохраняется И', source: 'ФИПИ Ловушка' },
  { task: '10', word: 'сверхизысканный, межинститутский', highlight: 'И', category: 'Приставки СВЕРХ- и МЕЖ-', note: 'После МЕЖ- и СВЕРХ- всегда сохраняется И', source: 'ФИПИ Ловушка' },
  { task: '10', word: 'адъютант, конъюнктура, инъекция, фельдъегерь', highlight: 'Ъ', category: 'Разделительный Ъ', note: 'После иноязычных приставок перед Е, Ё, Ю, Я', source: 'ФИПИ Ловушка' },
  { task: '10', word: 'подьячий, пьедестал, бурьян', highlight: 'Ь', category: 'Разделительный Ь в корне', note: 'Подьячий образовано от «дьяк» (Ь внутри корня)', source: 'ФИПИ Ловушка' },
  { task: '10', word: 'преемник (традиций) / приёмник (радио)', highlight: 'Е / И', category: 'Омофоны ПРЕ-/ПРИ-', note: 'Преемник = перенимает; приёмник = принимает', source: 'ФИПИ Ловушка' },
  { task: '10', word: 'преходящий (временный) / приходящий (гость)', highlight: 'Е / И', category: 'Омофоны ПРЕ-/ПРИ-', note: 'Преходящий = проходящий; приходящий = приходит', source: 'ФИПИ Ловушка' },
  { task: '10', word: 'претворить (мечту) / притворить (дверь)', highlight: 'Е / И', category: 'Омофоны ПРЕ-/ПРИ-', note: 'Претворить = воплотить; притворить = прикрыть', source: 'ФИПИ Ловушка' },
  { task: '11', word: 'милостивый, юродивый', highlight: 'И', category: 'Исключения суффиксов прил.', note: 'В безударном положении пишется суффикс -ИВ-', source: 'ФИПИ Ловушка' },
  { task: '11', word: 'гуттаперчевый, фланелевый, щавелевый', highlight: 'Е', category: 'Безударный суффиксы -ЕВ-', note: 'Без ударения пишется -ЕВ-', source: 'ФИПИ Ловушка' },
  { task: '11', word: 'затмевать, продлевать, застревать, намереваться', highlight: 'Е', category: 'Глаголы перед ударным -ВА-', note: 'Исключения: перед ударным -ВА- пишется Е', source: 'ФИПИ Ловушка' },
  { task: '11', word: 'потчевать, проповедовать, заведовать', highlight: 'Е / О', category: 'Суффиксы -ОВА-/-ЕВА-', note: 'В 1-м лице: я потчую, проповедую (-УЮ/-ЮЮ)', source: 'ФИПИ Ловушка' },
  { task: '12', word: 'стелющийся, бреющий, зиждущийся', highlight: 'Ю / У', category: 'Исключения I спряжения', note: 'Брить, стелить, зиждиться — I спр. → -УЩ-/-ЮЩ-', source: 'ФИПИ Ловушка' },
  { task: '12', word: 'лелеющий, сеющий, веющий, тающий, кающийся', highlight: 'Ю', category: 'Глаголы на -ЯТЬ (I спр.)', note: 'Все глаголы на -ЯТЬ относятся к I спряжению', source: 'ФИПИ Ловушка' },
  { task: '12', word: 'клеящий, строящийся, дышащий, зависящий', highlight: 'Я / А', category: 'Глаголы II спряжения', note: 'Клеить (на -ИТЬ) и исключения II спр. → -АЩ-/-ЯЩ-', source: 'ФИПИ Ловушка' },
  { task: '12', word: 'выкачанная (нефть) / выкаченная (бочка)', highlight: 'А / Е', category: 'Причастия на -АНН-/-ЕНН-', note: 'Выкачать нефть (-АТЬ → А); выкатить бочку (-ИТЬ → Е)', source: 'ФИПИ Ловушка' },
  { task: '12', word: 'замешанный (в деле) / замешенное (тесто)', highlight: 'А / Е', category: 'Причастия на -АНН-/-ЕНН-', note: 'Замешать (-АТЬ → А); замесить тесто (-ИТЬ → Е)', source: 'ФИПИ Ловушка' },
  { task: '13', word: 'несмотря на (шторм) / не смотря (по сторонам)', highlight: 'СЛИТНО / РАЗД.', category: 'Предлог vs деепричастие', note: 'Вопреки = слитно; не глядя глазами = раздельно', source: 'ФИПИ Ловушка' },
  { task: '13', word: 'абсолютно нерискованный / вовсе не интересный', highlight: 'СЛИТНО / РАЗД.', category: 'Наречия меры vs отрицание', note: 'Абсолютно/очень = слитно; отнюдь не/вовсе не/далеко не = раздельно', source: 'ФИПИ Ловушка' },
  { task: '14', word: 'чтобы (успеть) / что бы (ни говорили)', highlight: 'СЛИТНО / РАЗД.', category: 'Союз vs местоимение с частицей', note: 'Чтобы = для того чтобы (слитно); что бы = бы можно опустить (раздельно)', source: 'ФИПИ Ловушка' },
  { task: '14', word: 'также, тоже / так же, то же', highlight: 'СЛИТНО / РАЗД.', category: 'Союзы vs местоимения/наречия', note: 'Также/тоже = и (слитно); так же, как / то же самое — раздельно', source: 'ФИПИ Ловушка' },
  { task: '14', word: 'ввиду (непогоды) / иметь в виду', highlight: 'СЛИТНО / РАЗД.', category: 'Предлог vs устойчивое сочетание', note: 'Ввиду = из-за (слитно); иметь в виду — раздельно в 3 слова', source: 'ФИПИ Ловушка' },
  { task: '14', word: 'в течение, в продолжение, в заключение', highlight: 'РАЗДЕЛЬНО (-Е)', category: 'Производные предлоги времени', note: 'Всегда пишутся раздельно с буквой Е на конце', source: 'ФИПИ Ловушка' },
  { task: '14', word: 'пол-лимона, пол-яблока, пол-Москвы / полгорода', highlight: 'ДЕФИС / СЛИТНО', category: 'Корень ПОЛ- (Правило ЮЛИ)', note: 'Перед Л, гласной и прописной — через дефис; перед согласной — слитно', source: 'ФИПИ Ловушка' },
  { task: '15', word: 'стеклянный, оловянный, деревянный', highlight: 'НН', category: 'Исключения суффиксов -АН-/-ЯН-', note: 'Три классических исключения с суффиксом -ЯНН- (пишутся с двумя НН)', source: 'ФИПИ Ловушка' },
  { task: '15', word: 'ветреный (день) / безветренный', highlight: 'Н / НН', category: 'Исключение суффикса -ЕН-', note: 'Ветреный — с одной Н; с приставкой безветренный — с двумя НН', source: 'ФИПИ Ловушка' },
  { task: '15', word: 'жареный (карась) / пожаренный, жаренный с луком', highlight: 'Н / НН', category: 'Отглагольное прил. vs причастие', note: 'Без приставки и зависимых слов — одна Н; с приставкой или завис. словом — НН', source: 'ФИПИ Ловушка' },
  { task: '15', word: 'кованый, жеваный', highlight: 'Н', category: 'Отглагольные прил. на -ОВАННЫЙ', note: '-ОВ- и -ЕВ- входят в состав корня, без приставок пишется одна Н', source: 'ФИПИ Ловушка' },
  { task: '15', word: 'задача решена / девушка умна и воспитанна', highlight: 'Н / НН', category: 'Краткие причастия vs краткие прил.', note: 'В кратких причастиях ВСЕГДА одна Н; в кратких прил. — столько Н, сколько в полной форме', source: 'ФИПИ Ловушка' },
];

const buildFullDatabaseEntries = (): DictEntry[] => {
  const map = new Map<string, DictEntry>();

  // 1. Curated top FIPI traps (priority)
  FIPI_DICTIONARY.forEach((item) => {
    map.set(item.word.toLowerCase().trim(), item);
  });

  // 2. Real parsed words database from exam variants (all 18,070 authentic words)
  const wordsList: any[] = Array.isArray(PARSED_WORDS)
    ? PARSED_WORDS
    : Array.isArray(PARSED_WORDS_DATABASE)
      ? (PARSED_WORDS_DATABASE as any)
      : typeof PARSED_WORDS_DATABASE === 'object' && PARSED_WORDS_DATABASE !== null
        ? Object.values(PARSED_WORDS_DATABASE).flat()
        : [];

  wordsList.forEach((item) => {
    const displayWord = item.word || '—';
    const cleanContext = item.context
      ? (item.context.startsWith('(') ? item.context : `(${item.context})`)
      : '';
    const fullLabel = cleanContext ? `${displayWord} ${cleanContext}` : displayWord;
    const key = item.id || (displayWord + '_' + item.task + '_' + cleanContext).toLowerCase().trim();
    if (!map.has(key)) {
      map.set(key, {
        task: item.task,
        word: fullLabel,
        highlight: item.missingLetter || (item as any).letter || '—',
        category: item.category || (item as any).topic || TASK_META[item.task]?.title || `Задание № ${item.task}`,
        note: item.rule || (item as any).explanation || '',
        source: item.source || 'ФИПИ 2026–2027',
      });
    }
  });

  // 3. Fallback: only if main words bank is empty, populate from sprint questions
  if (wordsList.length === 0 && Array.isArray(PARSED_SPRINT_QUESTIONS)) {
    PARSED_SPRINT_QUESTIONS.forEach((sq) => {
      const fullWord = (sq.prefix || '') + (sq.answer || '') + (sq.suffix || '');
      const cleanContext = sq.context
        ? (sq.context.startsWith('(') ? sq.context : `(${sq.context})`)
        : '';
      const fullLabel = cleanContext ? `${fullWord} ${cleanContext}` : fullWord;
      const key = (fullWord + '_' + sq.task + '_' + cleanContext).toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          task: sq.task,
          word: fullLabel,
          highlight: sq.answer || '—',
          category: sq.topic || TASK_META[sq.task]?.title || `Задание № ${sq.task}`,
          note: sq.rule || sq.explanation || '',
          source: sq.source || 'Банк ФИПИ / Школково',
        });
      }
    });
  }

  // 4. Ensure bank fills to 5000+ words across all tasks
  try {
    const bank = getTrainerBank();
    if (bank && Array.isArray(bank.sprintQuestions)) {
      bank.sprintQuestions.forEach((sq, idx) => {
        const fullWord = (sq.prefix || '') + (sq.answer || '') + (sq.suffix || '');
        const cleanContext = sq.context
          ? (sq.context.startsWith('(') ? sq.context : `(${sq.context})`)
          : '';
        const fullLabel = cleanContext ? `${fullWord} ${cleanContext}` : fullWord;
        const key = (fullWord + '_' + sq.task + '_' + cleanContext + '_' + idx).toLowerCase().trim();
        if (map.size < 5000 && !map.has(key)) {
          map.set(key, {
            task: sq.task,
            word: fullLabel,
            highlight: sq.answer || '—',
            category: sq.topic || TASK_META[sq.task]?.title || `Задание № ${sq.task}`,
            note: sq.rule || sq.explanation || '',
            source: sq.source || 'Банк заданий ФИПИ 2026–2027',
          });
        }
      });
    }
  } catch {}

  return Array.from(map.values());
};

let cachedFullDatabaseEntries: DictEntry[] | null = null;
const getFullDatabaseEntries = (): DictEntry[] => {
  if (cachedFullDatabaseEntries) return cachedFullDatabaseEntries;
  cachedFullDatabaseEntries = buildFullDatabaseEntries();
  return cachedFullDatabaseEntries;
};

if (typeof window !== 'undefined') {
  window.addEventListener('ege-bank-loaded', () => {
    cachedFullDatabaseEntries = null;
  });
}

export const DictionaryModal: React.FC<DictionaryModalProps> = React.memo(({
  isOpen,
  onClose,
  onStartTrapsWorkout,
}) => {
  const [filterTask, setFilterTask] = useState<'all' | TaskId>('all');
  const [sourceMode, setSourceMode] = useState<'all' | 'traps'>('all');
  const [query, setQuery] = useState('');
  const [bankRev, setBankRev] = useState(0);
  const hasOpenedRef = useRef(isOpen);
  if (isOpen) hasOpenedRef.current = true;

  useEffect(() => {
    const onLoaded = () => {
      cachedFullDatabaseEntries = null;
      setBankRev((r) => r + 1);
    };
    window.addEventListener('ege-bank-loaded', onLoaded);
    return () => window.removeEventListener('ege-bank-loaded', onLoaded);
  }, []);

  useEffect(() => {
    if (isOpen) {
      cachedFullDatabaseEntries = null;
      setBankRev((r) => r + 1);
    }
  }, [isOpen]);

  const hasOpened = hasOpenedRef.current;
  const fullEntries = useMemo(
    () => (hasOpened ? getFullDatabaseEntries() : FIPI_DICTIONARY),
    [hasOpened, bankRev]
  );

  const activePool = sourceMode === 'traps' ? FIPI_DICTIONARY : fullEntries;

  const filtered = useMemo(() => {
    if (!hasOpenedRef.current) return [];
    const q = query.trim().toLowerCase();
    return activePool.filter((item) => {
      if (filterTask !== 'all' && item.task !== filterTask) return false;
      if (!q) return true;
      return (
        Boolean(item.word?.toLowerCase().includes(q)) ||
        Boolean(item.category?.toLowerCase().includes(q)) ||
        Boolean(item.note?.toLowerCase().includes(q)) ||
        Boolean(item.source?.toLowerCase().includes(q))
      );
    });
  }, [activePool, filterTask, query]);

  // Cap visible items to first 60 for 60fps scrolling performance
  const visibleItems = useMemo(() => filtered.slice(0, 60), [filtered]);

  return (
    <SwipeableSheet
      id="dictionary-modal"
      handleId="dictionary-drag-handle"
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Словарь исключений и база слов ФИПИ"
      handleAriaLabel="Потяните вниз, чтобы закрыть словарь"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1 pr-2">
          <h3 className="text-[18px] font-extrabold tracking-tight leading-tight whitespace-nowrap truncate">
            Словарь орфографии 9–15
          </h3>
          <span
            className="block text-[11.5px] truncate whitespace-nowrap mt-0.5"
            style={{ color: 'var(--ios-label-sec)' }}
          >
            Официальная база 2026–2027 и ловушки ФИПИ
          </span>
        </div>
        <button
          id="close-dictionary-modal"
          type="button"
          onClick={onClose}
          className="liquid-pill-btn px-3.5 py-1.5 rounded-full text-[13.5px] font-bold cursor-pointer shrink-0"
        >
          Закрыть
        </button>
      </div>

      <div className="mb-2">
        <LiquidGlassSegmented
          id="dict-source-glass-mode"
          ariaLabel="Выбор режима базы слов"
          value={sourceMode}
          onChange={setSourceMode}
          compact
          options={[
            { key: 'all', label: `База 2026–2027 (${fullEntries.length})` },
            { key: 'traps', label: `Топ-ловушки (${FIPI_DICTIONARY.length})` },
          ]}
        />
      </div>

      <input
        id="dictionary-search-input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск слова, правила или источника (полог, стелить, Дощинский)..."
        aria-label="Поиск по словарю"
        className="w-full px-3.5 py-2 rounded-2xl text-[16px] outline-none mb-2"
        style={{
          background: 'var(--ios-bg-secondary)',
          border: '0.5px solid var(--ios-separator)',
          color: 'var(--ios-label)',
        }}
      />

      <div className="mb-2">
        <LiquidGlassSegmented
          id="dict-task-glass-filter"
          ariaLabel="Фильтр словаря по заданиям"
          value={filterTask}
          onChange={setFilterTask}
          compact
          options={[
            { key: 'all', label: 'Все' },
            { key: '9', label: '№ 9' },
            { key: '10', label: '№ 10' },
            { key: '11', label: '№ 11' },
            { key: '12', label: '№ 12' },
            { key: '13', label: '№ 13' },
            { key: '14', label: '№ 14' },
            { key: '15', label: '№ 15' },
          ]}
        />
      </div>

      <div className="flex items-center justify-between text-[11.5px] px-1 mb-1.5" style={{ color: 'var(--ios-label-sec)' }}>
        <span>
          Найдено: <b>{filtered.length}</b> {sourceMode === 'traps' ? 'ловушек' : 'слов'}
        </span>
        {filtered.length > 60 && (
          <span className="text-[10.5px] opacity-75">показаны первые 60 для скорости</span>
        )}
      </div>

      <div className="cheat-reader flex-1 mb-2.5">
        <div className="flex flex-col gap-2 pb-1">
          {visibleItems.map((item, idx) => (
            <div key={idx} className="ios-inset-group ios-scroll-item p-3.5 !mb-0 shrink-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span
                    className="text-[11px] font-bold truncate"
                    style={{ color: 'var(--ios-blue)' }}
                  >
                    Задание {item.task} · {item.category}
                  </span>
                  {item.source && (
                    <span
                      className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded shrink-0 truncate max-w-[150px]"
                      style={{ background: 'var(--ios-bg-secondary)', color: 'var(--ios-label-sec)' }}
                    >
                      {item.source}
                    </span>
                  )}
                </div>
                <span
                  className="text-[11px] font-extrabold px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    background: 'var(--ios-green-soft)',
                    color: 'var(--ios-green)',
                  }}
                >
                  {item.highlight}
                </span>
              </div>
              <div className="text-[15px] font-extrabold leading-snug">{item.word}</div>
              <div
                className="text-[12px] mt-0.5 leading-snug"
                style={{ color: 'var(--ios-label-sec)' }}
              >
                {item.note}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          onClose();
          onStartTrapsWorkout();
        }}
        className="ios-btn-primary !text-[15px]"
      >
        <span>Тренировать ловушки ФИПИ (15 слов)</span>
      </button>
    </SwipeableSheet>
  );
});

/* ============================================================================
   4. ОКНО «НАСТРОЙКИ LIQUID GLASS И ЭКРАНА» (AppearanceModal)
   ============================================================================ */
export type LiquidGlassStyle = 'clear' | 'frosted';

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  onToggleDarkMode: (dark: boolean) => void;
  glassStyle: LiquidGlassStyle;
  onChangeGlassStyle: (style: LiquidGlassStyle) => void;
  specularEnabled: boolean;
  onToggleSpecular: (enabled: boolean) => void;
  onOpenSyncModal: () => void;
}

export const AppearanceModal: React.FC<AppearanceModalProps> = React.memo(({
  isOpen,
  onClose,
  darkMode,
  onToggleDarkMode,
  glassStyle,
  onChangeGlassStyle,
  specularEnabled,
  onToggleSpecular,
  onOpenSyncModal,
}) => {
  return (
    <SwipeableSheet
      id="appearance-modal"
      handleId="appearance-drag-handle"
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Настройки Liquid Glass и экрана"
      handleAriaLabel="Потяните вниз, чтобы закрыть настройки дизайна"
      sheetClassName="max-w-[460px]"
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="min-w-0 flex-1 pr-2">
          <h3 className="text-[18px] font-extrabold tracking-tight leading-tight whitespace-nowrap truncate">
            Дизайн Liquid Glass
          </h3>
          <span
            className="block text-[11.5px] truncate whitespace-nowrap mt-0.5"
            style={{ color: 'var(--ios-label-sec)' }}
          >
            Оптическая физика стекла iOS 26 / iOS 27
          </span>
        </div>
        <button
          id="close-appearance-modal"
          type="button"
          onClick={onClose}
          className="liquid-pill-btn px-3.5 py-1.5 rounded-full text-[13.5px] font-bold cursor-pointer shrink-0"
        >
          Готово
        </button>
      </div>

      {/* Theme Mode */}
      <div className="ios-section-header !px-1">Цветовая среда</div>
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <button
          type="button"
          id="theme-light-btn"
          onClick={() => onToggleDarkMode(false)}
          className="ios-inset-group !mb-0 p-3 text-left cursor-pointer"
          style={{
            borderColor: !darkMode ? 'var(--ios-blue)' : undefined,
            boxShadow: !darkMode ? '0 0 0 2px var(--ios-blue-soft)' : undefined,
          }}
        >
          <div className="text-[13.5px] font-extrabold mb-0.5 whitespace-nowrap">
            Светлая (Spatial)
          </div>
          <div className="text-[11px] truncate" style={{ color: 'var(--ios-label-sec)' }}>
            Оптическая линза
          </div>
        </button>

        <button
          type="button"
          id="theme-dark-btn"
          onClick={() => onToggleDarkMode(true)}
          className="ios-inset-group !mb-0 p-3 text-left cursor-pointer"
          style={{
            borderColor: darkMode ? 'var(--ios-blue)' : undefined,
            boxShadow: darkMode ? '0 0 0 2px var(--ios-blue-soft)' : undefined,
          }}
        >
          <div className="text-[13.5px] font-extrabold mb-0.5 whitespace-nowrap">
            Тёмная (OLED #000)
          </div>
          <div className="text-[11px] truncate" style={{ color: 'var(--ios-label-sec)' }}>
            Чистый чёрный фон
          </div>
        </button>
      </div>

      {/* Apple WWDC 2026 Liquid Glass Material Selector */}
      <div className="ios-section-header !px-1">Преломление и прозрачность стекла</div>
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <button
          type="button"
          onClick={() => onChangeGlassStyle('clear')}
          className="ios-inset-group !mb-0 p-3.5 text-left cursor-pointer"
          style={{
            borderColor: glassStyle === 'clear' ? 'var(--ios-blue)' : undefined,
            boxShadow:
              glassStyle === 'clear' ? '0 0 0 2px var(--ios-blue-soft)' : undefined,
          }}
        >
          <div className="text-[14px] font-extrabold mb-0.5">Жидкая линза</div>
          <div className="text-[11px]" style={{ color: 'var(--ios-label-sec)' }}>
            Глубокая рефракция и объёмный край
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChangeGlassStyle('frosted')}
          className="ios-inset-group !mb-0 p-3.5 text-left cursor-pointer"
          style={{
            borderColor: glassStyle === 'frosted' ? 'var(--ios-blue)' : undefined,
            boxShadow:
              glassStyle === 'frosted' ? '0 0 0 2px var(--ios-blue-soft)' : undefined,
          }}
        >
          <div className="text-[14px] font-extrabold mb-0.5">Матовый криолит</div>
          <div className="text-[11px]" style={{ color: 'var(--ios-label-sec)' }}>
            Повышенная плотность для чтения
          </div>
        </button>
      </div>

      {/* Specular Rim Lensing Toggle */}
      <div className="ios-inset-group p-3.5 !mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[14px] font-extrabold">Динамические блики граней</div>
          <div className="text-[11.5px]" style={{ color: 'var(--ios-label-sec)' }}>
            Реакция светового контура (Specular Rim) на касание и курсор
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggleSpecular(!specularEnabled)}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-extrabold cursor-pointer shrink-0"
          style={{
            background: specularEnabled
              ? 'var(--ios-green-soft)'
              : 'var(--ios-bg-tertiary)',
            color: specularEnabled ? 'var(--ios-green)' : 'var(--ios-label-sec)',
          }}
        >
          {specularEnabled ? 'Активно' : 'Выкл.'}
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenSyncModal();
        }}
        className="ios-btn-tinted w-full"
      >
        <span>Открыть окно «Память и синхронизация»</span>
      </button>
    </SwipeableSheet>
  );
});