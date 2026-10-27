import React from 'react';
import { cleanQuestionRule } from '../utils/trainerLogic';

export interface FormattedInstructionProps {
  rule: string | undefined;
  task: string;
  className?: string;
}

// Regex matching main goals/targets across Russian Exam Tasks 9–15:
// - Н, НН, НН (или Н)
// - СЛИТНО, РАЗДЕЛЬНО, ЧЕРЕЗ ДЕФИС, ДЕФИСНО
// - одна и та же буква
// - проверяемая/непроверяемая/чередующаяся безударная гласная
const TARGET_REGEX = /(НН\s*\(или\s*Н\)|(?<=пишется\s+)(?:две\s+буквы\s+)?НН(?=[.,\s]|$)|(?<=пишется\s+)(?:одна\s+буква\s+)?Н(?=[.,\s]|$)|(?<![а-яёА-ЯЁ])(?:СЛИТНО|РАЗДЕЛЬНО|ЧЕРЕЗ ДЕФИС|ДЕФИСНО)(?![а-яёА-ЯЁ])|одна и та же буква|(?:проверяемая|непроверяемая|чередующаяся)\s+(?:безударная\s+)?гласная(?:\s+корня)?)/iu;

export const FormattedInstruction: React.FC<FormattedInstructionProps> = React.memo(({
  rule,
  task,
  className = '',
}) => {
  const cleanedRule = cleanQuestionRule(rule, task);
  const match = cleanedRule.match(TARGET_REGEX);

  if (!match || match.index === undefined) {
    return <span className={className}>{cleanedRule}</span>;
  }

  const matchIndex = match.index;
  const targetText = match[0];
  const beforeText = cleanedRule.slice(0, matchIndex);
  const afterText = cleanedRule.slice(matchIndex + targetText.length);

  return (
    <span className={className}>
      {beforeText}
      <span
        className="inline-flex items-center justify-center font-black px-2.5 py-0.5 mx-1 rounded-xl align-baseline select-none transition-all shadow-xs"
        style={{
          border: '2px solid var(--ios-blue)',
          color: 'var(--ios-blue)',
          backgroundColor: 'var(--ios-blue-soft)',
        }}
      >
        {targetText}
      </span>
      {afterText}
    </span>
  );
});

FormattedInstruction.displayName = 'FormattedInstruction';
