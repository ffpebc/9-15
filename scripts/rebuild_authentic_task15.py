#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rebuild authentic Task 15 (Н / НН) questions from raw FIPI sentences.
Converts each authentic sentence into a structured FIPI Task 15 with:
  - instruction: Full authentic sentence with (1), (2), (3)...
  - rows: Array of gaps 1..N with target word, solved word, letter, isCorrectRow, and rich explanation.
  - correctIndices: Array of 1-based digit numbers matching the question rule.
"""

import json
import re
import subprocess
import os
import sys

def clean_sentence(text):
    s = text.replace('украше(З)ые', 'украше(3)ые')
    s = re.sub(r'[\u200b\u200c\u200d\u200e\u200f\ufeff\xad]', '', s)
    s = s.replace('&laquo;', '«').replace('&raquo;', '»').replace('&mdash;', '—')
    s = s.replace('&#39;', "'").replace('&quot;', '"').replace('&nbsp;', ' ')
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def explain_task15_word(prefix, letter, solved, digit, sentence):
    s_low = solved.lower()
    ctx_low = sentence.lower()

    # 1. Direct Exceptions
    if any(k in s_low for k in ['стеклянн', 'оловянн', 'деревянн']):
        return f'{solved} — исключение из правила отымённых прилагательных (-ЯН- пишется с двумя НН).'
    if 'ветрен' in s_low:
        if any(p in s_low for p in ['безветрен', 'подветрен']):
            return f'{solved} — отымённое прилагательное с приставкой, пишется две буквы НН.'
        return f'{solved} — слово-исключение с суффиксом -ЕН-, пишется с одной Н.'
    if any(k in s_low for k in ['кован', 'жеван', 'жёван', 'клеван', 'клёван']):
        if any(p in s_low for p in ['подкован', 'изжеван', 'изжёван', 'перекован']):
            return f'{solved} — есть приставка, поэтому пишется НН.'
        return f'{solved} — отглагольное прилагательное несов. вида без приставок и зависимых слов (-ов-/-ев- в корне), пишется одна Н.'
    if any(k in s_low for k in ['невиданн', 'неслыханн', 'нежданн', 'негаданн', 'желанн', 'медленн', 'деланн', 'обещанн', 'неожиданн', 'лелеянн', 'долгожданн', 'священн', 'приверженн', 'ухоженн']):
        return f'{solved} — словарное слово-исключение, пишется с двумя буквами НН.'
    if any(k in s_low for k in ['ранен', 'смышлён', 'смышлен', 'назван', 'посажен', 'посажён', 'прощён', 'прощен', 'верчён', 'верчен']):
        if 'в ногу' in ctx_low or 'тяжело' in ctx_low or 'изранен' in s_low or 'названный в честь' in ctx_low:
            return f'{solved} — есть зависимое слово или приставка, поэтому пишется НН.'
        return f'{solved} — одиночное отглагольное прилагательное / устойчивое сочетание, пишется одна Н.'
    if any(k in s_low for k in ['юный', 'единый', 'румяный', 'рьяный', 'пьяный', 'синий', 'багряный', 'зелёный', 'зеленый', 'вороной', 'свиной', 'фазаний', 'вороний', 'бараний', 'тюлений', 'павлиний', 'олений']):
        return f'{solved} — первообразное или притяжательное прилагательное, пишется с одной Н.'
    if any(k in s_low for k in ['поистине', 'приданое', 'труженик', 'масленица', 'пудреница', 'путаница', 'гостиная', 'гостиница']):
        return f'{solved} — пишется одна буква Н (образовано от основы с одной Н).'
    if any(k in s_low for k in ['совершенно', 'необыкновенно', 'немедленно', 'соответственно', 'злоумышленник', 'приверженность', 'настроенность', 'неизменность', 'собственность']):
        return f'{solved} — пишется две буквы НН (образовано от основы с двумя НН).'

    # 2. Short forms
    is_short = bool(re.search(r'[а-яё]+[еоаыи]\b', s_low)) and len(s_low.split()[-1]) <= 11 and any(
        v in s_low for v in ['решен', 'брошен', 'сделан', 'украшен', 'построен', 'увешан', 'измучен', 'затравлен', 'сдержан', 'изыскан', 'ограничен', 'создан', 'написан', 'прочитан', 'увенчан', 'сохранен', 'освещен', 'поражен', 'доставлен', 'предъявлен', 'усыпан', 'покрыт', 'выкрашен']
    )
    if is_short:
        if letter == 'Н':
            return f'{solved} — краткое страдательное причастие прошедшего времени, всегда пишется с одной Н.'
        else:
            return f'{solved} — краткое прилагательное, пишется столько же Н, сколько в полной форме.'

    # 3. Regular rules
    if letter == 'НН':
        if any(s_low.endswith(x) or x in s_low for x in ['ованн', 'еванн', 'ированн']):
            return f'{solved} — суффикс -ОВА-/-ЕВА-/-ИРОВА-, пишется две буквы НН.'
        if any(s_low.endswith(x) for x in ['онный', 'онная', 'онное', 'онные', 'онном', 'онных', 'енный', 'енная', 'енное', 'енные', 'енном', 'енных']):
            return f'{solved} — отымённое прилагательное с суффиксом -ЕНН-/-ОНН- (или причастие от глагола сов. вида), пишется две буквы НН.'
        return f'{solved} — пишется две буквы НН (стык основы на -Н и суффикса -Н-, либо полное причастие сов. вида / с приставкой / с зависимым словом).'
    else:
        if any(x in s_low for x in ['ан', 'ян', 'ин']):
            return f'{solved} — суффикс -АН-/-ЯН-/-ИН- в отымённом прилагательном, пишется одна буква Н.'
        return f'{solved} — отглагольное прилагательное несов. вида (нет приставок и зависимых слов), пишется одна буква Н.'

def build_authentic_task15_questions():
    # Load raw task 15 from commit 432f74b
    cmd = ['git', 'show', '432f74b:src/data/fipiTasksBank9_15.json']
    raw_bytes = subprocess.check_output(cmd)
    raw_data = json.loads(raw_bytes)

    raw_t15 = [q for q in raw_data if str(q.get('task')) == '15']
    print(f'Found {len(raw_t15)} raw Task 15 tasks from 432f74b')

    rebuilt_questions = []

    for idx, q in enumerate(raw_t15):
        orig_sentence = q['rows'][0]['words'][0]
        sentence = clean_sentence(orig_sentence)
        rule = q.get('rule', '').strip()
        if not rule:
            rule = 'Укажите цифру(-ы), на месте которой(-ых) пишется НН.'
        
        wants_nn = 'НН' in rule
        correct_indices = q.get('correctIndices', [])

        matches = list(re.finditer(r'([А-Яа-яЁё]+)\((\d+)\)([А-Яа-яЁё]*)', sentence))
        if not matches:
            continue

        rows = []
        valid_digits = []

        for m in matches:
            prefix, d_str, suffix = m.groups()
            d = int(d_str)
            valid_digits.append(d)
            is_correct = d in correct_indices

            letter = ('НН' if is_correct else 'Н') if wants_nn else ('Н' if is_correct else 'НН')
            target_word = f'{prefix}({d}){suffix}'
            solved_word = f'{prefix}{letter}{suffix}'
            expl = explain_task15_word(prefix, letter, solved_word, d, sentence)

            rows.append({
                'words': [target_word],
                'solvedWords': [solved_word],
                'letter': letter,
                'isCorrectRow': is_correct,
                'explanation': expl
            })

        # Ensure correctIndices only contains digits actually present in sentence
        clean_correct = sorted([d for d in correct_indices if d in valid_digits])
        if not clean_correct:
            # Fallback if inverted or empty
            clean_correct = sorted([i + 1 for i, r in enumerate(rows) if r['isCorrectRow']])

        rebuilt_q = {
            'id': q.get('id', f'fipi-15-{idx+1:03d}'),
            'kind': 'fipi',
            'task': '15',
            'topic': 'Правописание -Н- и -НН- в различных частях речи',
            'rule': rule,
            'instruction': sentence,
            'sentence': sentence,
            'rows': rows,
            'correctIndices': clean_correct
        }
        rebuilt_questions.append(rebuilt_q)

    print(f'Successfully built {len(rebuilt_questions)} authentic Task 15 questions')
    return rebuilt_questions

def main():
    repo_root = '/tmp/gh/repo'
    authentic_t15 = build_authentic_task15_questions()

    # 1. Update starterBank.json on main
    starter_path = os.path.join(repo_root, 'src/data/starterBank.json')
    if os.path.exists(starter_path):
        with open(starter_path, 'r', encoding='utf-8') as f:
            sb = json.load(f)
        
        existing_fipi = [q for q in sb.get('fipi', []) if str(q.get('task')) != '15']
        # Take first 35 authentic Task 15 questions for the 35 KIM variants
        sb['fipi'] = existing_fipi + authentic_t15[:35]

        with open(starter_path, 'w', encoding='utf-8') as f:
            json.dump(sb, f, ensure_ascii=False, indent=2)
        print(f'Updated starterBank.json with 35 authentic Task 15 questions')

        # Also copy to workspace
        ws_starter = '/home/sergei/Загрузки/9-13-ios-27-oct-23-2026-11-06-08-pm/src/data/starterBank.json'
        with open(ws_starter, 'w', encoding='utf-8') as f:
            json.dump(sb, f, ensure_ascii=False, indent=2)

    # 2. Save full bank to /tmp/fipi_full_t15.json for injection into data branch
    fipi_full_path = '/tmp/fipiTasksBank9_15_updated.json'
    # Get existing 9-14 from data branch
    cmd = ['git', 'show', 'data:public/data/fipiTasksBank9_15.json']
    raw_bytes = subprocess.check_output(cmd)
    data_branch_fipi = json.loads(raw_bytes)

    filtered_fipi = [q for q in data_branch_fipi if str(q.get('task')) != '15']
    all_fipi = filtered_fipi + authentic_t15
    print(f'Total FIPI questions combining tasks 9-14 ({len(filtered_fipi)}) + task 15 ({len(authentic_t15)}): {len(all_fipi)}')

    with open(fipi_full_path, 'w', encoding='utf-8') as f:
        json.dump(all_fipi, f, ensure_ascii=False, indent=2)
    print(f'Saved updated full FIPI bank to {fipi_full_path}')

if __name__ == '__main__':
    main()
