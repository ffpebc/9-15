#!/usr/bin/env python3
"""
Чистка банков 9–15 (allWords / fipiTasks / sprint):

1. Общая чистка строк: HTML-сущности (в т.ч. с кириллическими «двойниками» букв,
   вроде `&ldquо;`), буквальные `\\u200b`, мусорные `r\\n`, переносы строк,
   двойные пробелы, пробелы перед знаками препинания, «т; к» -> «т. к.».
2. Задание 15 (Н/НН): пересборка.
   - слова: дедупликация, убраны артефакты `(1)` в контексте;
   - пояснения: убран шаблонный «хвост» про причастия, битые обрезанные тексты;
   - ФИПИ-задание: нормальный формат 5 строк × 3 слова (как в 9–14),
     вместо кривых «2 строки по одному слову со (1)/(2)».

Запуск:  python3 scripts/fix_banks_text_and_task15.py [папка_с_json ...]
"""
import html
import json
import random
import re
import sys
from pathlib import Path

FILES = ['allWordsBank9_15.json', 'fipiTasksBank9_15.json', 'sprintBank9_15.json']

LOOK = str.maketrans({'о': 'o', 'а': 'a', 'р': 'p', 'е': 'e', 'с': 'c', 'х': 'x', 'м': 'm', 'т': 't'})
ENT_RE = re.compile(r'&[#\w]{2,10};')
ENT_MAP = {
    'ldquo': '«', 'rdquo': '»', 'laquo': '«', 'raquo': '»', 'bdquo': '„', 'lsquo': '‘', 'rsquo': '’',
    'amp': '&', 'rarr': '→', 'larr': '←', 'mdash': '—', 'ndash': '–', 'nbsp': ' ', 'hellip': '…',
    'quot': '"', 'lt': '<', 'gt': '>',
}


def _entity(m):
    raw = m.group(0)
    norm = raw.translate(LOOK) if not raw.startswith('&#') else raw
    name = norm[1:-1]
    if name in ENT_MAP:
        return ENT_MAP[name]
    return html.unescape(norm)


def clean_text(s: str) -> str:
    if not isinstance(s, str):
        return s
    s = ENT_RE.sub(_entity, s)
    s = re.sub(r'\\u200b|\\u00a0|[\u200b\u200c\u200d\ufeff\u00ad]', '', s)
    s = s.replace('\u00a0', ' ')
    s = re.sub(r'(?<=[.!?:;])r?\nr?\n', ' ', s)
    s = re.sub(r'\\n|\r?\n', ' ', s)
    s = s.replace('\\"', '"')
    s = re.sub(r'\bт; ?к\b\.?', 'т. к.', s)
    s = re.sub(r'[ \t]{2,}', ' ', s)
    s = re.sub(r' +([,.;:!?])(?=\s|$)', r'\1', s)
    return s.strip()


def walk_clean(o):
    if isinstance(o, str):
        return clean_text(o)
    if isinstance(o, list):
        return [walk_clean(i) for i in o]
    if isinstance(o, dict):
        return {k: walk_clean(v) for k, v in o.items()}
    return o


# ───────────────────────── Задание 15 ─────────────────────────
BOILER_RE = re.compile(
    r'[;,]?\s*образовано (?:от глагола совершенного вида \(есть приставка|от бесприставочного глагола несовершенного вида и не имеет).*$',
    re.S,
)
NOUN_TAIL_RE = re.compile(
    r'[;,]?\s*образовано от существительного при помощи суффикса -АН-/-ЯН-/-ИН-.*$', re.S
)
OVERRIDES15 = {
    'юная': 'непроизводное прилагательное «юный»; пишется одна «Н».',
    'ветреный': 'слово-исключение: «ветреный» (без приставки) пишется с одной «Н» (но «безветренный» — с «НН»).',
    'удостоены': 'краткое страдательное причастие; в кратких причастиях пишется одна «Н».',
    'торжественно': 'наречие образовано от прилагательного «торжественный» (суффикс -ЕНН-); пишется «НН».',
}
TOPIC15 = 'Правописание -Н- и -НН- в различных частях речи'
RULE15 = (
    'Укажите варианты ответов, в которых во всех словах одного ряда на месте пропуска пишется НН. '
    'Запишите номера ответов.'
)
GENERIC = {
    'НН': 'пишется «НН»: полное причастие с приставкой или зависимыми словами, причастие от глагола '
          'совершенного вида либо прилагательное с суффиксом -ОНН-/-ЕНН- (или стык основы на -Н и суффикса -Н-).',
    'Н': 'пишется «Н»: отглагольное прилагательное без приставки и зависимых слов, '
         'прилагательное с суффиксом -АН-/-ЯН-/-ИН- или краткая форма.',
}


def clean_rule15(word: str, letter: str, rule: str) -> str:
    rule = clean_text(rule)
    if word.lower() in OVERRIDES15:
        return f'{word} — {OVERRIDES15[word.lower()]}'
    if letter == 'НН' and re.search(r'(?i)енно$|анно$|онно$|ённо$', word) and 'страдательное причастие совершенного вида /' in rule:
        return f'{word} — наречие, образованное от прилагательного с -НН- (в наречии столько Н, сколько в производящем слове); пишется «НН».'
    head, sep, body = rule.partition(' — ')
    if not sep:
        body, head = rule, word
    body = BOILER_RE.sub('', body).strip(' ;,')
    body = NOUN_TAIL_RE.sub('', body).strip(' ;,')
    body = re.sub(r',? см$', '', body).strip(' ;,')
    # обрезанные/битые пояснения («от глагола «», «...» без текста)
    broken = (
        len(body) < 12
        or body.count('«') != body.count('»')
        or re.search(r'(от глагола|в слове|слово)\s*[«»]?$', body)
        or re.search(r'от глагола «\s*$', body)
    )
    if broken:
        body = GENERIC[letter]
    body = re.sub(r'\s*поэтому пишется[^.]*$', '', body).strip(' ;,.')
    if letter == 'НН' and 'НН' not in body and 'две' not in body:
        body += '; пишется «НН»'
    if letter == 'Н' and not re.search(r'\bН\b|одна', body):
        body += '; пишется «Н»'
    return f'{word} — {body}.'


def rebuild_task15(words, sprint, fipi):
    # --- words ---
    seen, new_words = set(), []
    for w in words:
        if w['task'] != '15':
            continue
        key = w['word'].lower()
        if key in seen:
            continue
        seen.add(key)
        if w['word'] == 'удостоеННы':
            w.update(word='удостоеНы', wordGap='удостое..ы', prefix='удостое', suffix='ы', missingLetter='Н')
        letter = w['missingLetter']
        w['context'] = ''
        w['rule'] = clean_rule15(w['word'], letter, w['rule'])
        w['topic'] = w['category'] = TOPIC15
        new_words.append(w)
    words = [w for w in words if w['task'] != '15'] + new_words

    # --- sprint ---
    seen, new_sprint = set(), []
    for q in sprint:
        if q['task'] != '15':
            continue
        if q['prefix'] == 'удостое' and q['answer'] == 'НН':
            q['answer'] = 'Н'
        key = (q['prefix'] + q['answer'] + q['suffix']).lower()
        if key in seen:
            continue
        seen.add(key)
        word = q['prefix'] + q['answer'] + q['suffix']
        q['context'] = ''
        q['rule'] = q['explanation'] = clean_rule15(word, q['answer'], q['rule'])
        q['topic'] = TOPIC15
        q['options'] = ['НН', 'Н']
        new_sprint.append(q)
    sprint = [q for q in sprint if q['task'] != '15'] + new_sprint

    # --- fipi: 5 строк × 3 слова ---
    nn = [w for w in new_words if w['missingLetter'] == 'НН']
    n1 = [w for w in new_words if w['missingLetter'] == 'Н']
    rng = random.Random(15)
    patterns = [
        [1, 0, 1, 0, 0], [0, 1, 0, 1, 1], [1, 1, 0, 1, 0],
        [0, 1, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 1, 0, 1],
    ]

    def cyc(pool):
        order = []
        while True:
            if not order:
                order = pool[:]
                rng.shuffle(order)
            yield order.pop()

    g_nn, g_n = cyc(nn), cyc(n1)
    tasks, sigs = [], set()
    n_sets = 120
    for i in range(n_sets):
        pat = patterns[i % len(patterns)]
        rows, correct = [], []
        used = set()

        def take(gen):
            for _ in range(50):
                w = next(gen)
                if w['word'].lower() not in used:
                    used.add(w['word'].lower())
                    return w
            return w

        for r in range(5):
            if pat[r]:
                ws = [take(g_nn) for _ in range(3)]
                correct.append(r + 1)
            else:
                k = rng.choice([1, 2])  # сколько слов с одной Н (остальные с НН)
                ws = [take(g_n) for _ in range(k)] + [take(g_nn) for _ in range(3 - k)]
                rng.shuffle(ws)
            rows.append({
                'words': [w['wordGap'][:1].lower() + w['wordGap'][1:] for w in ws],
                'solvedWords': [w['word'][:1].lower() + w['word'][1:] for w in ws],
                'letter': 'НН' if pat[r] else '—',
                'isCorrectRow': bool(pat[r]),
                'explanation': ' '.join(w['rule'] for w in ws),
            })
        sig = '||'.join('|'.join(r['words']) for r in rows)
        if sig in sigs:
            continue
        sigs.add(sig)
        tasks.append({
            'id': f'fipi-15-nn-{i + 1:03d}',
            'kind': 'fipi',
            'task': '15',
            'topic': TOPIC15,
            'rule': RULE15,
            'rows': rows,
            'correctIndices': correct,
        })
    fipi = [q for q in fipi if q['task'] != '15'] + tasks
    return words, sprint, fipi


def process(folder: Path):
    data = {f: json.loads((folder / f).read_text(encoding='utf-8')) for f in FILES if (folder / f).exists()}
    if len(data) != 3:
        print(f'{folder}: пропуск (нет всех трёх файлов)')
        return
    data = {k: walk_clean(v) for k, v in data.items()}
    aw = data[FILES[0]]
    words, sprint, fipi = rebuild_task15(aw['words'], data[FILES[2]], data[FILES[1]])
    aw['words'] = words
    aw['metadata']['totalWords'] = len(words)
    data[FILES[2]], data[FILES[1]] = sprint, fipi
    for f, v in data.items():
        (folder / f).write_text(json.dumps(v, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(folder, {f: (len(v) if isinstance(v, list) else len(v['words'])) for f, v in data.items()})


if __name__ == '__main__':
    root = Path(__file__).resolve().parent.parent
    folders = [Path(a) for a in sys.argv[1:]] or [root / 'public/data', root / 'src/data']
    for fo in folders:
        process(fo)
