import React, { useState, useEffect, useRef } from 'react';
import {
  TrainerQuestion,
  cleanQuestionRule,
  resolveTask15Sentence,
  cleanWord,
  cleanExplanation,
} from '../utils/trainerLogic';
import { classifyWordSubtopicAndException } from '../utils/wordClassifier';
import { Task15SentenceView } from './Task15SentenceView';

const SHORT_MORPHEME_BY_TASK: Record<TrainerQuestion['task'], string> = {
  '9': 'Корень слова',
  '10': 'Приставка',
  '11': 'Суффикс',
  '12': 'Глагол / причастие',
  '13': 'Слитно / раздельно',
  '14': 'Слитно / дефис / разд.',
  '15': 'Правописание Н / НН',
};

interface QuestionCardViewProps {
  question: TrainerQuestion;
  onAnswer: (isCorrect: boolean, userChoiceLabel: string) => void;
  onOpenRuleForTask?: (task: TrainerQuestion['task']) => void;
}

export const QuestionCardView: React.FC<QuestionCardViewProps> = React.memo(({
  question,
  onAnswer,
}) => {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [fipiSelectedRows, setFipiSelectedRows] = useState<number[]>([]);
  const [fipiSubmitted, setFipiSubmitted] = useState(false);
  const [fipiResultOk, setFipiResultOk] = useState<boolean | null>(null);

  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const answerTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
    exitTimerRef.current = null;
    answerTimerRef.current = null;
  };

  useEffect(() => {
    clearTimers();
    setSelectedChoice(null);
    setIsExiting(false);
    setFipiSelectedRows([]);
    setFipiSubmitted(false);
    setFipiResultOk(null);

    return () => clearTimers();
  }, [question.instanceId || question.id]);

  if (question.kind === 'sprint') {
    const isAnswered = selectedChoice !== null;
    const isCorrect = selectedChoice === question.answer;
    const isWordMode = question.task === '13' || question.task === '14';

    const liveMeta = classifyWordSubtopicAndException(
      question.task,
      question.prefix,
      question.suffix,
      question.answer,
      question.explanation || question.rule,
      question.context,
      question.isTrap
    );

    const isExceptionWord =
      liveMeta.topic.toLowerCase().includes('исключен') ||
      /\bискл\./i.test(question.context || '') ||
      /\bискл\./i.test(question.explanation || '');

    const displayTopic =
      isExceptionWord && !liveMeta.topic.toLowerCase().includes('исключен')
        ? `Исключение: ${liveMeta.topic}`
        : liveMeta.topic;

    const shortExplanation = (question.explanation || liveMeta.rule || '').trim();

    const commitAnswer = (ok: boolean, opt: string) => {
      clearTimers();
      setIsExiting(true);
      setTimeout(() => {
        onAnswer(ok, opt);
      }, 160);
    };

    const handlePickOption = (opt: string) => {
      if (isAnswered) return;
      setSelectedChoice(opt);
      const ok = opt === question.answer;

      // On correct: comfortable 460ms feedback then advance
      // On incorrect: give 980ms so user can see rule explanation, but allow instant tap on "Дальше"
      const exitTime = ok ? 360 : 840;
      const advanceTime = ok ? 480 : 980;

      exitTimerRef.current = setTimeout(() => {
        setIsExiting(true);
      }, exitTime);

      answerTimerRef.current = setTimeout(() => {
        onAnswer(ok, opt);
      }, advanceTime);
    };

    const renderWordWithSlot = () => {
      const slotStateClass = !isAnswered ? '' : isCorrect ? 'ok' : 'bad';

      // Task 13: (НЕ) with word
      if (question.task === '13') {
        if (!isAnswered) {
          return (
            <div className="text-[25px] sm:text-[29px] font-extrabold tracking-tight leading-tight text-center my-2 flex items-center justify-center gap-1.5 flex-wrap">
              <span className="slot-gap !min-w-[46px] !px-2 font-black">(НЕ)</span>
              <span>{question.suffix}</span>
            </div>
          );
        }

        const isSlitno = question.answer === 'СЛИТНО';
        return (
          <div className="text-[25px] sm:text-[29px] font-extrabold tracking-tight leading-tight text-center my-2 flex items-center justify-center flex-wrap">
            <span className={`slot-gap !min-w-0 !px-2 ${isSlitno ? '!mr-0' : '!mr-2'} ${slotStateClass}`}>
              НЕ
            </span>
            <span>{question.suffix}</span>
          </div>
        );
      }

      // Task 14: (ЧАСТЬ В СКОБКАХ) + ОСТАЛЬНАЯ ЧАСТЬ СЛОВА
      if (question.task === '14') {
        const parenMatch = question.prefix.match(/^(.*)\(([^)]+)\)\s*$/);
        const leadText = parenMatch ? parenMatch[1].trim() : '';
        const parenWord = parenMatch
          ? parenMatch[2].trim()
          : question.prefix.replace(/[()]/g, '').trim();

        const suffixTokens = question.suffix.trim().split(/\s+/);
        const targetWordRest = suffixTokens[0] || '';
        const remainingSentence = suffixTokens.slice(1).join(' ');

        if (!isAnswered) {
          return (
            <div className="text-[23px] sm:text-[27px] font-extrabold tracking-tight leading-snug text-center my-2">
              {leadText && (
                <span className="opacity-80 font-medium mr-1.5 align-middle">
                  {leadText}
                </span>
              )}
              <span className="whitespace-nowrap inline-flex items-center align-middle">
                <span className="slot-gap !min-w-[42px] !px-2 font-black">
                  ({parenWord})
                </span>
                <span>{targetWordRest}</span>
              </span>
              {remainingSentence && (
                <span className="opacity-85 font-medium text-[19px] sm:text-[22px] ml-1.5 align-middle">
                  {remainingSentence}
                </span>
              )}
            </div>
          );
        }

        const isSlitno = question.answer === 'СЛИТНО';
        const isDefisno = question.answer === 'ДЕФИСНО';
        return (
          <div className="text-[23px] sm:text-[27px] font-extrabold tracking-tight leading-snug text-center my-2">
            {leadText && (
              <span className="opacity-80 font-medium mr-1.5 align-middle">
                {leadText}
              </span>
            )}
            <span className="whitespace-nowrap inline-flex items-center align-middle">
              {isSlitno && (
                <span className={`slot-gap !min-w-0 !px-2.5 font-black ${slotStateClass}`}>
                  {parenWord}{targetWordRest}
                </span>
              )}
              {isDefisno && (
                <span className={`slot-gap !min-w-0 !px-2.5 font-black ${slotStateClass}`}>
                  {parenWord}-{targetWordRest}
                </span>
              )}
              {!isSlitno && !isDefisno && (
                <>
                  <span className={`slot-gap !min-w-0 !px-2 font-black ${slotStateClass}`}>
                    {parenWord}
                  </span>
                  <span className="ml-1.5 font-black align-middle">
                    {targetWordRest}
                  </span>
                </>
              )}
            </span>
            {remainingSentence && (
              <span className="opacity-85 font-medium text-[19px] sm:text-[22px] ml-1.5 align-middle">
                {remainingSentence}
              </span>
            )}
          </div>
        );
      }

      // General Tasks (9, 10, 11, 12, 15): Atomic target word + context
      const slotChar = !isAnswered ? '..' : question.answer.toUpperCase();

      const prefixTokens = question.prefix.trim().split(/\s+/);
      const targetWordStem = prefixTokens[prefixTokens.length - 1] || '';
      const leadSentence = prefixTokens.slice(0, -1).join(' ');

      const suffixTokens = question.suffix.trim().split(/\s+/);
      const targetWordEnding = suffixTokens[0] || '';
      const tailSentence = suffixTokens.slice(1).join(' ');

      return (
        <div className="text-[24px] sm:text-[28px] font-extrabold tracking-tight leading-snug text-center my-2">
          {leadSentence && (
            <span className="font-semibold text-[19px] sm:text-[22px] opacity-80 mr-2 align-middle">
              {leadSentence}
            </span>
          )}
          <span className="whitespace-nowrap inline-flex items-center align-middle">
            <span>{targetWordStem}</span>
            <span className={`slot-gap ${slotStateClass}`}>{slotChar}</span>
            <span>{targetWordEnding}</span>
          </span>
          {tailSentence && (
            <span className="font-semibold text-[19px] sm:text-[22px] opacity-85 ml-2 align-middle">
              {tailSentence}
            </span>
          )}
        </div>
      );
    };

    return (
      <div
        key={question.instanceId || question.id}
        className={`flex-1 flex flex-col justify-between gap-3 ${
          isExiting ? 'word-stage-exit' : ''
        }`}
      >
        {/* Top Meta Bar */}
        <div
          className="flex items-center justify-between gap-2 text-[11.5px] font-bold whitespace-nowrap"
          style={{ color: 'var(--ios-label-sec)' }}
        >
          <span
            className="truncate"
            style={{ color: isExceptionWord ? 'var(--ios-orange)' : 'var(--ios-blue)' }}
          >
            № {question.task} · {displayTopic}
          </span>
          <span
            className="shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-extrabold"
            style={{
              background: isExceptionWord
                ? 'var(--ios-orange-soft)'
                : liveMeta.isTrap
                  ? 'var(--ios-purple-soft)'
                  : 'var(--ios-bg-secondary)',
              color: isExceptionWord
                ? 'var(--ios-orange)'
                : liveMeta.isTrap
                  ? 'var(--ios-purple)'
                  : 'var(--ios-label-sec)',
            }}
          >
            {isExceptionWord
              ? 'Исключение'
              : liveMeta.isTrap
                ? 'Ловушка ЕГЭ'
                : SHORT_MORPHEME_BY_TASK[question.task]}
          </span>
        </div>

        {/* Word Stage Card */}
        <div
          className="my-auto py-4 px-3 rounded-2xl text-center word-stage-animate"
          style={{ background: 'var(--ios-bg-secondary)' }}
        >
          <div
            className="text-[11px] font-bold uppercase tracking-wide mb-1 whitespace-nowrap truncate"
            style={{ color: isExceptionWord ? 'var(--ios-orange)' : 'var(--ios-label-sec)' }}
          >
            {isExceptionWord
              ? 'Внимание: слово-исключение'
              : question.task === '13'
                ? 'Слитное или раздельное написание'
                : question.task === '14'
                  ? 'Слитное, дефисное или раздельное'
                  : question.task === '15'
                    ? 'Правописание Н или НН'
                    : 'Вставьте пропущенную букву'}
          </div>

          {renderWordWithSlot()}

          <div
            className="text-[13.5px] font-medium mt-1 leading-snug px-1 text-center"
            style={{ color: 'var(--ios-label-sec)' }}
          >
            {question.context}
          </div>

          {/* Structured Feedback Area */}
          <div className="min-h-[42px] flex items-center justify-center mt-2">
            {isAnswered ? (
              <div
                className="w-full px-3.5 py-2 rounded-xl ios-feedback-pop text-[12.5px] font-medium leading-tight flex items-center justify-between gap-2"
                style={{
                  background: isCorrect ? 'var(--ios-green-soft)' : 'var(--ios-red-soft)',
                  color: isCorrect ? 'var(--ios-green)' : 'var(--ios-red)',
                }}
              >
                <div className="flex-1 flex flex-col items-start min-w-0 text-left">
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="font-extrabold text-[13px] shrink-0">
                      {isCorrect ? '✓ Верно!' : '✕ Ошибка'}
                    </span>
                    <span className="opacity-90 font-bold text-[12px] truncate">
                      {isCorrect ? `Ответ: ${question.answer}` : `Правильно: ${question.answer}`}
                    </span>
                  </div>
                  {shortExplanation && (
                    <span className="text-[11px] opacity-85 truncate w-full mt-0.5">
                      {shortExplanation}
                    </span>
                  )}
                </div>

                {!isCorrect && (
                  <button
                    type="button"
                    onClick={() => commitAnswer(false, selectedChoice || '')}
                    className="shrink-0 px-2.5 py-1 rounded-full text-[11.5px] font-bold cursor-pointer active:scale-95 transition-transform"
                    style={{
                      background: 'var(--ios-red)',
                      color: '#FFFFFF',
                    }}
                  >
                    Дальше →
                  </button>
                )}
              </div>
            ) : (
              <span
                className="text-[11px] font-semibold"
                style={{ color: 'var(--ios-label-ter)' }}
              >
                Нажмите вариант для ответа
              </span>
            )}
          </div>
        </div>

        {/* Answer Options */}
        <div
          className={`grid gap-2 sm:gap-3 mt-auto ${
            question.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          {question.options.map((opt, idx) => {
            let stateCls = '';
            if (isAnswered) {
              if (opt === question.answer) stateCls = 'ok';
              else if (opt === selectedChoice) stateCls = 'bad';
            }
            const isDash = opt === '—';
            return (
              <button
                key={`sprint-option-${idx}-${opt}`}
                id={`sprint-option-${idx}`}
                type="button"
                disabled={isAnswered}
                onClick={() => handlePickOption(opt)}
                className={`choice-card-btn ${isWordMode || isDash ? 'word-mode' : ''} ${stateCls} ${
                  opt.length > 7 ? '!text-[12.5px] sm:!text-[14px] !px-1.5' : ''
                }`}
              >
                {isDash ? '— (нет буквы)' : opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 5-Row FIPI Format (EГЭ Realistic Mode)
  // ==========================================================================
  const toggleRow = (rowIdx1Based: number) => {
    if (fipiSubmitted) return;
    setFipiSelectedRows((prev) =>
      prev.includes(rowIdx1Based)
        ? prev.filter((r) => r !== rowIdx1Based)
        : [...prev, rowIdx1Based].sort((a, b) => a - b)
    );
  };

  const handleCheckFipi = () => {
    if (fipiSubmitted || fipiSelectedRows.length === 0) return;
    setFipiSubmitted(true);
    const userStr = fipiSelectedRows.slice().sort((a, b) => a - b).join('');
    const correctStr = question.correctIndices.slice().sort((a, b) => a - b).join('');
    const ok = userStr === correctStr;
    setFipiResultOk(ok);
  };

  const handleProceedFipi = () => {
    const userStr = fipiSelectedRows.slice().sort((a, b) => a - b).join('');
    const correctStr = question.correctIndices.slice().sort((a, b) => a - b).join('');
    const ok = userStr === correctStr;
    setIsExiting(true);
    setTimeout(() => {
      onAnswer(ok, userStr || '—');
    }, 180);
  };

  const correctStr = question.correctIndices.slice().sort((a, b) => a - b).join('');
  const userStr = fipiSelectedRows.slice().sort((a, b) => a - b).join('');
  const fipiHasExceptions = question.rows.some((r) =>
    /исключен|искл\./i.test(r.explanation || '')
  );

  return (
    <div
      key={question.instanceId || question.id}
      className={`flex-1 flex flex-col justify-between gap-2.5 word-stage-animate ${
        isExiting ? 'word-stage-exit' : ''
      }`}
    >
      {/* Top Meta Bar */}
      <div
        className="flex items-center justify-between gap-2 text-[11.5px] font-bold"
        style={{ color: 'var(--ios-label-sec)' }}
      >
        <span
          className="truncate"
          style={{ color: fipiHasExceptions ? 'var(--ios-orange)' : 'var(--ios-blue)' }}
        >
          № {question.task} · {question.topic}
          {fipiHasExceptions ? ' (есть исключения)' : ''}
        </span>
        <span className="shrink-0 text-right" style={{ color: 'var(--ios-label-sec)' }}>
          {fipiSubmitted
            ? `Ответ: ${correctStr}`
            : question.task === '15'
            ? 'Укажите цифры'
            : 'Укажите 2–4 цифры'}
        </span>
      </div>

      {/* Official Instruction Box (especially for Task 13 and Task 15) */}
      <div
        className="text-[12px] font-medium px-3 py-2 rounded-xl text-left leading-snug border border-[var(--ios-separator)] shadow-xs"
        style={{ background: 'var(--ios-bg-secondary)', color: 'var(--ios-label)' }}
      >
        <div className="text-[12px] font-semibold leading-snug">
          {cleanQuestionRule(question.rule, question.task)}
        </div>
      </div>

      {/* Task 15 Authentic Sentence + Word Grid OR Tasks 9-14 5-Row List */}
      {question.task === '15' ? (
        <div className="flex flex-col gap-2 my-auto">
          {/* Authentic Full Sentence Stage */}
          <div
            className="p-3.5 sm:p-4 rounded-2xl text-left border border-[var(--ios-separator)] shadow-xs"
            style={{
              background: 'var(--ios-bg-secondary)',
              color: 'var(--ios-label)',
            }}
          >
            <div
              className="text-[10px] font-extrabold uppercase tracking-wider mb-1.5 opacity-70"
              style={{ color: 'var(--ios-blue)' }}
            >
              Предложение задания:
            </div>
            <Task15SentenceView
              sentence={resolveTask15Sentence(question)}
              rows={question.rows}
              selectedDigits={fipiSelectedRows}
              isSubmitted={fipiSubmitted}
              onToggleDigit={toggleRow}
            />
          </div>

          {/* Task 15 Pure Digits (Round Circular Buttons 1, 2, 3, 4, 5 without words) */}
          <div className="flex flex-col gap-2 my-1">
            <div
              className="text-[11px] font-bold text-center uppercase tracking-wider opacity-65"
              style={{ color: 'var(--ios-label-sec)' }}
            >
              {fipiSubmitted ? 'Результат по номерам пропусков:' : 'Выберите цифры ответа:'}
            </div>

            <div className="flex items-center justify-center gap-3 sm:gap-4 my-1 w-full max-w-sm mx-auto">
              {question.rows.map((row, idx) => {
                const digit = idx + 1;
                const isSelected = fipiSelectedRows.includes(digit);
                let circleClass = 'w-12 h-12 sm:w-14 sm:h-14 rounded-full text-[19px] sm:text-[21px] font-black flex items-center justify-center transition-all select-none shadow-xs active:scale-95 cursor-pointer';
                let circleStyle: React.CSSProperties = {
                  background: 'var(--ios-bg-secondary)',
                  color: 'var(--ios-label)',
                  border: '1.5px solid var(--ios-separator)',
                };

                if (fipiSubmitted) {
                  if (row.isCorrectRow && isSelected) {
                    circleStyle = {
                      background: 'var(--ios-green-soft)',
                      color: 'var(--ios-green)',
                      border: '2px solid var(--ios-green)',
                    };
                  } else if (row.isCorrectRow && !isSelected) {
                    circleStyle = {
                      background: 'var(--ios-orange-soft)',
                      color: 'var(--ios-orange)',
                      border: '1.5px solid var(--ios-orange)',
                    };
                  } else if (!row.isCorrectRow && isSelected) {
                    circleStyle = {
                      background: 'var(--ios-red-soft)',
                      color: 'var(--ios-red)',
                      border: '2px solid var(--ios-red)',
                    };
                  } else {
                    circleStyle = {
                      background: 'var(--ios-bg-secondary)',
                      color: 'var(--ios-label-sec)',
                      border: '1px solid var(--ios-separator)',
                      opacity: 0.45,
                    };
                  }
                } else if (isSelected) {
                  circleStyle = {
                    background: 'var(--ios-blue)',
                    color: '#FFFFFF',
                    border: '2px solid var(--ios-blue)',
                    boxShadow: '0 4px 14px rgba(0, 122, 255, 0.35)',
                  };
                  circleClass += ' scale-105';
                }

                return (
                  <button
                    key={digit}
                    id={`fipi-row-${digit}`}
                    type="button"
                    disabled={fipiSubmitted}
                    onClick={() => toggleRow(digit)}
                    className={circleClass}
                    style={circleStyle}
                    aria-label={`Цифра ${digit}${isSelected ? ' (выбрана)' : ''}`}
                  >
                    <span>{digit}</span>
                  </button>
                );
              })}
            </div>

            {/* Explanations shown only AFTER answer submission */}
            {fipiSubmitted && (
              <div className="flex flex-col gap-1.5 mt-2 text-left">
                {question.rows.map((row, idx) => {
                  const digit = idx + 1;
                  const solvedWord = cleanWord(row.solvedWords[0] || row.words[0]);
                  return (
                    <div
                      key={digit}
                      className="p-2.5 rounded-2xl border border-[var(--ios-separator)] text-[12px]"
                      style={{ background: 'var(--ios-bg-secondary)' }}
                    >
                      <div className="flex items-center gap-2 font-bold mb-0.5">
                        <span
                          className="w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0"
                          style={{
                            background: row.isCorrectRow ? 'var(--ios-green)' : 'var(--ios-bg-tertiary)',
                            color: row.isCorrectRow ? '#fff' : 'var(--ios-label-sec)',
                          }}
                        >
                          {digit}
                        </span>
                        <span className="font-extrabold" style={{ color: 'var(--ios-label)' }}>
                          {solvedWord}
                        </span>
                        <span
                          className="text-[11px] ml-auto font-semibold"
                          style={{ color: row.isCorrectRow ? 'var(--ios-green)' : 'var(--ios-label-sec)' }}
                        >
                          {`пишется «${row.letter}»`}
                        </span>
                      </div>
                      {row.explanation && (
                        <div className="text-[11px] opacity-85 leading-snug pl-7" style={{ color: 'var(--ios-label-sec)' }}>
                          {cleanExplanation(row.explanation)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Standard 5 Rows for Tasks 9, 10, 11, 12, 13, 14 */
        <div className="flex flex-col gap-1.5 my-auto">
          {question.rows.map((row, idx) => {
            const rowNum = idx + 1;
            const isSelected = fipiSelectedRows.includes(rowNum);
            let rowState = isSelected ? 'selected' : '';
            if (fipiSubmitted) {
              if (row.isCorrectRow && isSelected) rowState = 'ok';
              else if (row.isCorrectRow && !isSelected) rowState = 'missed';
              else if (!row.isCorrectRow && isSelected) rowState = 'bad';
            }
            return (
              <button
                key={rowNum}
                id={`fipi-row-${rowNum}`}
                type="button"
                disabled={fipiSubmitted}
                onClick={() => toggleRow(rowNum)}
                className={`fipi-row-cell ${rowState}`}
              >
                <span
                  className="w-6 h-6 rounded-full text-[12px] font-extrabold flex items-center justify-center shrink-0"
                  style={{
                    background: isSelected ? 'var(--ios-blue)' : 'var(--ios-bg-tertiary)',
                    color: isSelected ? '#FFFFFF' : 'var(--ios-label)',
                  }}
                >
                  {rowNum}
                </span>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[13px] font-bold leading-snug">
                    {(fipiSubmitted ? row.solvedWords : row.words).map(cleanWord).join(', ')}
                  </div>
                  {fipiSubmitted && (
                    <div
                      className="text-[11px] mt-0.5 truncate font-semibold"
                      style={{
                        color: row.isCorrectRow
                          ? 'var(--ios-green)'
                          : 'var(--ios-label-sec)',
                      }}
                    >
                      {question.task === '13' || question.task === '14'
                        ? (row.isCorrectRow
                            ? `✓ Подходит: ${row.letter}`
                            : `Не подходит: ${row.letter}`)
                        : (row.isCorrectRow
                            ? `✓ Подходит: одна и та же буква «${row.letter}»`
                            : 'Разные буквы в ряду')}
                    </div>
                  )}
                  {fipiSubmitted && row.explanation && (
                    <div
                      className="text-[10.5px] mt-0.5 line-clamp-2 opacity-85 leading-tight"
                      style={{ color: 'var(--ios-label-sec)' }}
                    >
                      {cleanExplanation(row.explanation)}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Submission & Next Action Banner */}
      <div className="mt-auto pt-1 flex flex-col gap-2">
        {fipiSubmitted ? (
          <div className="flex flex-col gap-2 ios-feedback-pop">
            <div
              className="px-3.5 py-2 rounded-xl text-[12px] font-bold text-center"
              style={{
                background: fipiResultOk ? 'var(--ios-green-soft)' : 'var(--ios-red-soft)',
                color: fipiResultOk ? 'var(--ios-green)' : 'var(--ios-red)',
              }}
            >
              {fipiResultOk ? (
                <span>✓ Верно! Правильный ответ: <strong>{correctStr}</strong></span>
              ) : (
                <span>
                  ✕ Ошибка. Правильный ответ: <strong>{correctStr}</strong> (ваш выбор: <strong>{userStr || '—'}</strong>)
                </span>
              )}
            </div>

            <button
              id="next-fipi-btn"
              type="button"
              onClick={handleProceedFipi}
              className="ios-btn-primary"
            >
              <span>Следующее задание →</span>
            </button>
          </div>
        ) : (
          <button
            id="submit-fipi-btn"
            type="button"
            disabled={fipiSelectedRows.length === 0}
            onClick={handleCheckFipi}
            className="ios-btn-primary"
          >
            <span>
              {fipiSelectedRows.length > 0
                ? `Проверить ответ (${fipiSelectedRows.join(', ')})`
                : question.task === '15'
                ? `Выберите цифры в предложении (1–${question.rows.length})`
                : 'Выберите номера строк (2–4)'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
});

QuestionCardView.displayName = 'QuestionCardView';
