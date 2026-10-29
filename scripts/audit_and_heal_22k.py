# -*- coding: utf-8 -*-
"""
audit_and_heal_22k.py

Dedicated 5-pass validation and healing engine for all ~22,187 words, 
2,322 FIPI tasks, and 22,187 sprint questions in the Russian ЕГЭ database.

Pass 1: Orthography & Answer Correctness vs Russian Orthography & Rules
Pass 2: Part-of-speech & Morphological Category Validation
Pass 3: Step-by-Step Explanation Semantic Consistency & Isolation (Zero Contradictions)
Pass 4: Sprint Question Option Sets & Answers Synchronization
Pass 5: Cross-Task FIPI Row Integrity & correctIndices Alignment
"""

import json
import os
import re
import sys
import html

WORKSPACE_DIR = "/home/sergei/Загрузки/9-13-ios-27-oct-23-2026-11-06-08-pm"
REPO_DIR = "/tmp/gh/repo"

def normalize_text(s: str) -> str:
    if not s:
        return ""
    s = html.unescape(str(s))
    s = s.replace("\xad", "")
    s = re.sub(r"[\u200b\u200c\u200d\u200e\u200f\ufeff]", "", s)
    # Fix digit 3 homoglyphs inside Russian words
    s = re.sub(r"(?<=[А-Яа-яЁё(])3(?=[А-Яа-яЁё)])", "З", s)
    s = re.sub(r"(?<=[А-Яа-яЁё(])3\b", "З", s)
    s = re.sub(r"\b3(?=[А-Яа-яЁё])", "З", s)
    s = re.sub(r"\(В\)3([А-Яа-яЁё]+)", r"(В)З\1", s)
    s = re.sub(r"\(И3\)", "(ИЗ)", s)
    s = re.sub(r"\(3А\)", "(ЗА)", s)
    s = re.sub(r"\b3А\b", "ЗА", s)
    # Strip HTML tags
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("&quot;", '"').replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return s.strip()

def clean_explanation_str(res: str) -> str:
    if not res:
        return ""
    res = normalize_text(res)
    res = re.sub(r"\s+", " ", res)
    res = res.replace("; ;", ";").replace("..", ".").replace("— )", "—")
    res = re.sub(r"^[;,. \t—]+|[;,. \t]+$", "", res)
    return res.strip()

def isolate_word_expl(expl: str, target: str) -> str:
    if not expl:
        return ""
    s = clean_explanation_str(expl)
    # Strip metadata tails
    s = re.sub(r'(?:[\s.]*\d+[a-zA-Z0-9]*:[a-zA-Z0-9]+|\b[0-9a-f]{2}:\[\[\[|(?:\b|\n|\.)\s*(?:Ответ|Источник)\s*:).*$', '', s, flags=re.I)
    
    clean_target = re.sub(r'\(.*?\)', '', target).strip().upper()
    if not clean_target:
        return s

    # Split by semicolon or period followed by uppercase word + dash
    chunks = re.split(r';\s*(?=[А-ЯЁ\s-]{2,}\s*[—–-])|\.\s*(?=[А-ЯЁ\s-]{2,}\s*[—–-])', s)
    if len(chunks) <= 1:
        return s

    target_tokens = [t for t in re.split(r'[^А-ЯЁA-Z]+', clean_target) if t]
    
    best_cand = ""
    best_score = -1

    for cand in chunks:
        head_match = re.match(r'^\s*([А-ЯЁa-яё\s\(\)-]+?)\s*[—–-]', cand)
        head = head_match.group(1).upper() if head_match else ""
        head_tokens = [t for t in re.split(r'[^А-ЯЁA-Z]+', head) if t]
        
        score = 0
        if clean_target in head or head in clean_target:
            score += 100
        common = set(target_tokens) & set(head_tokens)
        score += len(common) * 20
        
        if score > best_score and score > 0:
            best_score = score
            best_cand = cand.strip()

    if best_cand:
        if not best_cand.endswith("."):
            best_cand += "."
        return best_cand
    return s

def main():
    print("=" * 70)
    print("STARTING DEEP 5-PASS AUDIT & HEALING ENGINE FOR 22K RUSSIAN ЕГЭ DATABASE")
    print("=" * 70)

    # 1. Load data files
    all_words_path = os.path.join(WORKSPACE_DIR, "src/data/allWordsBank9_15.json")
    fipi_tasks_path = os.path.join(WORKSPACE_DIR, "src/data/fipiTasksBank9_15.json")
    sprint_path = os.path.join(WORKSPACE_DIR, "src/data/sprintBank9_15.json")
    starter_path = os.path.join(WORKSPACE_DIR, "src/data/starterBank.json")

    with open(all_words_path, "r", encoding="utf-8") as f:
        words = json.load(f)
    with open(fipi_tasks_path, "r", encoding="utf-8") as f:
        fipi_tasks = json.load(f)
    with open(sprint_path, "r", encoding="utf-8") as f:
        sprint_questions = json.load(f)
    with open(starter_path, "r", encoding="utf-8") as f:
        starter_bank = json.load(f)

    print(f"Loaded: {len(words)} words, {len(fipi_tasks)} FIPI tasks, {len(sprint_questions)} sprint questions.")

    stats = {
        "pass1_homoglyphs_fixed": 0,
        "pass1_glued_strings_healed": 0,
        "pass1_pochemu_healed": 0,
        "pass1_t13_participles_healed": 0,
        "pass1_t13_opposition_healed": 0,
        "pass1_t14_prepositions_healed": 0,
        "pass1_t14_compounds_healed": 0,
        "pass1_t13_sync_fipi": 0,
        "pass1_t14_sync_fipi": 0,
        "pass2_categories_corrected": 0,
        "pass3_multiword_isolated": 0,
        "pass3_contradictions_purged": 0,
        "pass3_bogus_hyphens_purged": 0,
        "pass4_options_fixed": 0,
        "pass4_sprint_sync": 0,
        "pass5_t15_rules_synced": 0,
        "pass5_fipi_indices_realigned": 0,
    }

    # =========================================================================
    # PASS 1: Orthography & Answer Correctness vs Rules
    # =========================================================================
    print("\n--- PASS 1: Orthography & Answer Correctness vs Rules ---")

    # 1.0 Normalization
    for w in words:
        for k in ["word", "wordGap", "prefix", "suffix", "rule", "context"]:
            if k in w and isinstance(w[k], str):
                w[k] = normalize_text(w[k])

    for q in fipi_tasks:
        if "rule" in q and isinstance(q["rule"], str):
            q["rule"] = normalize_text(q["rule"])
        for r in q.get("rows", []):
            if "explanation" in r and isinstance(r["explanation"], str):
                r["explanation"] = normalize_text(r["explanation"])
            if "words" in r and isinstance(r["words"], list):
                r["words"] = [normalize_text(x) for x in r["words"]]
            if "solvedWords" in r and isinstance(r["solvedWords"], list):
                r["solvedWords"] = [normalize_text(x) for x in r["solvedWords"]]

    for s in sprint_questions:
        for k in ["prefix", "suffix", "rule", "context", "explanation"]:
            if k in s and isinstance(s[k], str):
                s[k] = normalize_text(s[k])

    # 1.1 Heal glued strings in FIPI tasks
    for q in fipi_tasks:
        for r in q.get("rows", []):
            words_list = r.get("words", [])
            solved_list = r.get("solvedWords", [])

            for idx, w_str in enumerate(words_list):
                if "(ЗА)ТО(ПО)ЭТОМУ" in w_str:
                    words_list[idx] = w_str.replace("(ЗА)ТО(ПО)ЭТОМУ", "(ЗА)ТО (ПО)ЭТОМУ")
                    stats["pass1_glued_strings_healed"] += 1
                if "(В)НИЗ(ПО)ЭТОМУ" in w_str:
                    words_list[idx] = w_str.replace("(В)НИЗ(ПО)ЭТОМУ", "(В)НИЗ (ПО)ЭТОМУ")
                    stats["pass1_glued_strings_healed"] += 1
                if "(ПО)ЭТОМУ(В)ТЕЧЕНИЕ" in w_str:
                    words_list[idx] = w_str.replace("(ПО)ЭТОМУ(В)ТЕЧЕНИЕ", "(ПО)ЭТОМУ (В)ТЕЧЕНИЕ")
                    stats["pass1_glued_strings_healed"] += 1
                if "(НА)ВСТРЕЧИ(ВО)ВРЕМЯ" in w_str:
                    words_list[idx] = w_str.replace("(НА)ВСТРЕЧИ(ВО)ВРЕМЯ", "(НА)ВСТРЕЧИ (ВО)ВРЕМЯ")
                    stats["pass1_glued_strings_healed"] += 1

            for idx, s_str in enumerate(solved_list):
                if "ЗА-ТОПО-ЭТОМУ" in s_str:
                    solved_list[idx] = s_str.replace("ЗА-ТОПО-ЭТОМУ", "ЗАТО ПО ЭТОМУ")
                    r["letter"] = "СЛИТНО / РАЗДЕЛЬНО"
                    r["explanation"] = (
                        "ЗАТО — сочинительный союз (= «но»); пишется слитно; поэтому пишется СЛИТНО — «ЗАТО»; "
                        "ПО ЭТОМУ — указательное местоимение «ЭТОМУ» с предлогом «ПО» (по какому признаку?); "
                        "пишется раздельно; поэтому пишется РАЗДЕЛЬНО — «ПО ЭТОМУ»."
                    )
                    stats["pass1_glued_strings_healed"] += 1
                if "ВНИЗПО-ЭТОМУ" in s_str:
                    solved_list[idx] = s_str.replace("ВНИЗПО-ЭТОМУ", "ВНИЗ ПО ЭТОМУ")
                    r["letter"] = "СЛИТНО / РАЗДЕЛЬНО"
                    r["explanation"] = (
                        "ВНИЗ — наречие направления; образовано слиянием предлога с существительным в единое слово; "
                        "поэтому пишется СЛИТНО — «ВНИЗ»; ПО ЭТОМУ — указательное местоимение «ЭТОМУ» с предлогом «ПО» "
                        "(по какому валу?); пишется раздельно; поэтому пишется РАЗДЕЛЬНО — «ПО ЭТОМУ»."
                    )
                    stats["pass1_glued_strings_healed"] += 1
                if "ПО-ЭТОМУВ ТЕЧЕНИЕ" in s_str:
                    solved_list[idx] = s_str.replace("ПО-ЭТОМУВ ТЕЧЕНИЕ", "ПОЭТОМУ В ТЕЧЕНИЕ")
                    r["letter"] = "СЛИТНО / РАЗДЕЛЬНО"
                    r["explanation"] = (
                        "ПОЭТОМУ — местоименное наречие со значением следствия (= «оттого, следовательно»); "
                        "пишется слитно; поэтому пишется СЛИТНО — «ПОЭТОМУ»; В ТЕЧЕНИЕ — производный предлог времени; "
                        "пишется раздельно в два слова; поэтому пишется РАЗДЕЛЬНО — «В ТЕЧЕНИЕ»."
                    )
                    stats["pass1_glued_strings_healed"] += 1
                if "НА ВСТРЕЧИВО ВРЕМЯ" in s_str:
                    solved_list[idx] = s_str.replace("НА ВСТРЕЧИВО ВРЕМЯ", "НА ВСТРЕЧИ ВО ВРЕМЯ")
                    stats["pass1_glued_strings_healed"] += 1

    # 1.2 Heal all occurrences of ПО-ЧЕМУ across words, sprint, fipi
    prep_pochemu_ctx = re.compile(r"по манерам|по вкусам|по взгляду|по очертанию|по забору|по металлическому|скучали", re.I)

    for w in words:
        if w.get("task") == "14":
            clean_w = w.get("word", "").replace(" ", "").replace("-", "").upper()
            if "ПОЧЕМУ" in clean_w:
                ctx = w.get("context", "")
                if "почему(то)" in ctx.lower() or "(то)" in w.get("wordGap", "").lower():
                    w["word"] = "ПОЧЕМУ-ТО"
                    w["wordGap"] = "(ПОЧЕМУ)ТО"
                    w["prefix"] = "(ПОЧЕМУ)"
                    w["suffix"] = "ТО"
                    w["missingLetter"] = "ДЕФИСНО"
                    w["topic"] = "Слитное, дефисное и раздельное написание слов"
                    w["category"] = "Слитное, дефисное и раздельное написание слов"
                    w["rule"] = "ПОЧЕМУ-ТО — неопределённое наречие со словообразовательной частицей «-ТО»; слова с частицами -то, -либо, -нибудь пишутся через дефис; поэтому пишется ЧЕРЕЗ ДЕФИС — «ПОЧЕМУ-ТО»."
                    stats["pass1_pochemu_healed"] += 1
                    continue
                is_prep = bool(prep_pochemu_ctx.search(ctx))
                w["word"] = "ПО ЧЕМУ" if is_prep else "ПОЧЕМУ"
                w["wordGap"] = "(ПО)ЧЕМУ"
                w["prefix"] = "(ПО)"
                w["suffix"] = "ЧЕМУ"
                w["missingLetter"] = "РАЗДЕЛЬНО" if is_prep else "СЛИТНО"
                w["topic"] = "Слитное, дефисное и раздельное написание слов"
                w["category"] = "Слитное, дефисное и раздельное написание слов"
                if is_prep:
                    w["rule"] = "ПО ЧЕМУ — предлог «ПО» с вопросительным/относительным местоимением «ЧЕМУ» (отвечает на падежный вопрос: по чему?); пишется раздельно; поэтому пишется РАЗДЕЛЬНО — «ПО ЧЕМУ»."
                else:
                    w["rule"] = "ПОЧЕМУ — вопросительно-относительное местоименное наречие со значением причины (= «по какой причине»); пишется слитно; поэтому пишется СЛИТНО — «ПОЧЕМУ»."
                stats["pass1_pochemu_healed"] += 1

    for s in sprint_questions:
        if s.get("task") == "14":
            target_clean = f"{s.get('prefix','')}{s.get('suffix','')}".replace("(", "").replace(")", "").replace("-", "").replace(" ", "").upper()
            if target_clean in ("ПОЧЕМУ", "ПОЧЕМУТО"):
                ctx = s.get("context", "")
                if "почему(то)" in ctx.lower():
                    s["answer"] = "ДЕФИСНО"
                    s["prefix"] = "(ПОЧЕМУ)"
                    s["suffix"] = "ТО"
                    s["options"] = ["СЛИТНО", "ДЕФИСНО", "РАЗДЕЛЬНО"]
                    s["explanation"] = "ПОЧЕМУ-ТО — неопределённое наречие со словообразовательной частицей «-ТО»; слова с частицами -то, -либо, -нибудь пишутся через дефис; поэтому пишется ЧЕРЕЗ ДЕФИС — «ПОЧЕМУ-ТО»."
                    s["rule"] = s["explanation"]
                    stats["pass1_pochemu_healed"] += 1
                    continue
                is_prep = bool(prep_pochemu_ctx.search(ctx))
                s["answer"] = "РАЗДЕЛЬНО" if is_prep else "СЛИТНО"
                s["prefix"] = "(ПО)"
                s["suffix"] = "ЧЕМУ"
                s["options"] = ["СЛИТНО", "ДЕФИСНО", "РАЗДЕЛЬНО"]
                if is_prep:
                    s["explanation"] = "ПО ЧЕМУ — предлог «ПО» с вопросительным/относительным местоимением «ЧЕМУ» (отвечает на падежный вопрос: по чему?); пишется раздельно; поэтому пишется РАЗДЕЛЬНО — «ПО ЧЕМУ»."
                else:
                    s["explanation"] = "ПОЧЕМУ — вопросительно-относительное местоименное наречие со значением причины (= «по какой причине»); пишется слитно; поэтому пишется СЛИТНО — «ПОЧЕМУ»."
                s["rule"] = s["explanation"]
                stats["pass1_pochemu_healed"] += 1

    for q in fipi_tasks:
        if q.get("task") == "14":
            for r in q.get("rows", []):
                sent = r.get("words", [""])[0]
                solved_w = r.get("solvedWords", [""])[0]
                if re.search(r"\(ПО\)ЧЕМУ", sent, re.I) or "ПО-ЧЕМУ" in solved_w:
                    is_prep = bool(prep_pochemu_ctx.search(sent))
                    target_token = "ПО ЧЕМУ" if is_prep else "ПОЧЕМУ"
                    r["solvedWords"] = [re.sub(r"ПО-ЧЕМУ", target_token, solved_w)]
                    if is_prep and "ДЕФИСНО" in r.get("letter", ""):
                        r["letter"] = r["letter"].replace("ДЕФИСНО", "РАЗДЕЛЬНО")
                    elif not is_prep and "ДЕФИСНО" in r.get("letter", ""):
                        r["letter"] = r["letter"].replace("ДЕФИСНО", "СЛИТНО")
                    stats["pass1_pochemu_healed"] += 1

    # 1.3 Heal Task 14 Specific Sentence Bugs
    for q in fipi_tasks:
        if q.get("task") != "14":
            continue
        for r in q.get("rows", []):
            sent = r.get("words", [""])[0]
            solved = r.get("solvedWords", [""])[0]

            # fipi-14-shkolkovo-14-94852 row 2
            if "того берега отошла лодка" in sent.lower() and "сильного течения" in sent.lower():
                r["solvedWords"] = ["ОТ ТОГО берега отошла лодка, которая ВСЛЕДСТВИЕ сильного течения не смогла пристать к берегу."]
                r["letter"] = "РАЗДЕЛЬНО / СЛИТНО"
                r["explanation"] = (
                    "ОТ ТОГО — предлог «ОТ» с указательным местоимением «ТОГО» (от какого берега?); "
                    "местоимение сохраняет указательное значение, пишется раздельно; поэтому пишется РАЗДЕЛЬНО — «ОТ ТОГО»; "
                    "ВСЛЕДСТВИЕ — производный предлог причины (= «из-за»); пишется слитно; поэтому пишется СЛИТНО — «ВСЛЕДСТВИЕ»."
                )
                stats["pass1_t14_prepositions_healed"] += 1

            # ВСЛЕДСТВИЕ (= из-за)
            elif "вследствие этого очень отстал" in sent.lower() or "вследствие сильного течения" in sent.lower():
                r["solvedWords"] = [solved.replace("В СЛЕДСТВИЕ", "ВСЛЕДСТВИЕ")]
                if "ДЕФИСНО / РАЗДЕЛЬНО" in r.get("letter", ""):
                    r["letter"] = "ДЕФИСНО / СЛИТНО"
                elif "СЛИТНО / РАЗДЕЛЬНО" in r.get("letter", ""):
                    r["letter"] = "РАЗДЕЛЬНО / СЛИТНО"
                stats["pass1_t14_prepositions_healed"] += 1

            # ВВИДУ (= из-за)
            if re.search(r"\(В\)ВИДУ\s+(?:изменения|отсутствия|болезни|скорого|тяжелой|серьезных|своей)", sent, re.I):
                if "В ВИДУ" in solved:
                    r["solvedWords"] = [solved.replace("В ВИДУ", "ВВИДУ")]
                    if r.get("letter") == "РАЗДЕЛЬНО":
                        r["letter"] = "СЛИТНО"
                    elif "РАЗДЕЛЬНО / СЛИТНО" in r.get("letter", ""):
                        r["letter"] = "СЛИТНО"
                    stats["pass1_t14_prepositions_healed"] += 1

            # СНАЧАЛА (наречие)
            if "были (с)начала оштукатурены" in sent.lower():
                r["solvedWords"] = [solved.replace("С НАЧАЛА", "СНАЧАЛА")]
                r["letter"] = "РАЗДЕЛЬНО / СЛИТНО"
                r["explanation"] = (
                    "ТАК ЖЕ — сочетание указательного местоимения «ТАК» с частицей «ЖЕ» (частицу ЖЕ можно опустить или есть «как и»); "
                    "пишется раздельно; поэтому пишется РАЗДЕЛЬНО — «ТАК ЖЕ»; "
                    "СНАЧАЛА — наречие времени; пишется слитно; поэтому пишется СЛИТНО — «СНАЧАЛА»."
                )
                stats["pass1_t14_prepositions_healed"] += 1

            # ПОЧЕМУ(ТО)
            if "почему(то)" in sent.lower():
                r["solvedWords"] = [solved.replace("ПОЧЕМУ ТО", "ПОЧЕМУ-ТО")]
                if r.get("letter") == "СЛИТНО / ДЕФИСНО":
                    pass
                elif r.get("letter") == "СЛИТНО / СЛИТНО":
                    r["letter"] = "ДЕФИСНО / СЛИТНО"
                stats["pass1_t14_compounds_healed"] += 1

    # 1.4 Participles with Dependent Words in Task 13
    participle_dep_patterns = [
        (r"\(НЕ\)РАССЛЫШАННЫЙ\s+преподавателем", "НЕ РАССЛЫШАННЫЙ", "преподавателем (кем?)"),
        (r"\(НЕ\)ДОЖДАВШИЕСЯ\s+ужина", "НЕ ДОЖДАВШИЕСЯ", "ужина (чего?)"),
        (r"\(НЕ\)ВЫХОДЯЩИМИ\s+за\s+пределы", "НЕ ВЫХОДЯЩИМИ", "за пределы простейших ощущений"),
        (r"С\s+\(НЕ\)УСПЕВАЮЩИМИ\s+по\s+предмету", "НЕ УСПЕВАЮЩИМИ", "по предмету"),
        (r"никогда\s+\(НЕ\)ОТКРЫВАВШЕМУ", "НЕ ОТКРЫВАВШЕМУ", "никогда"),
        (r"\(НЕ\)ОБСТАВЛЕННОЙ\s+мебелью", "НЕ ОБСТАВЛЕННОЙ", "мебелью"),
        (r"\(НЕ\)ТОПЛЕННОГО\s+всю\s+зиму", "НЕ ТОПЛЕННОГО", "всю зиму"),
        (r"\(НЕ\)ИСПРАВЛЕННАЯ\s+вовремя", "НЕ ИСПРАВЛЕННАЯ", "вовремя"),
        (r"\(НЕ\)ИМЕВШИЙ\s+в\s+своей\s+галерее", "НЕ ИМЕВШИЙ", "в своей галерее изображения"),
        (r"\(НЕ\)СТИХАЮЩИЙ\s+ни\s+на\s+минуту", "НЕ СТИХАЮЩИЙ", "ни на минуту"),
        (r"ещ[её]\s+\(НЕ\)РАСПУСТИВШИЙСЯ", "НЕ РАСПУСТИВШИЙСЯ", "ещё"),
        (r"давно\s+\(НЕ\)ЧИТАННАЯ", "НЕ ЧИТАННАЯ", "давно"),
        (r"никем\s+\(НЕ\)ЗАМЕЧЕННЫЙ", "НЕ ЗАМЕЧЕННЫЙ", "никем"),
        (r"ничем\s+\(НЕ\)ОПРАВДАННЫЙ", "НЕ ОПРАВДАННЫЙ", "ничем"),
        (r"\(НЕ\)УСПЕВШИЕ\s+дописать", "НЕ УСПЕВШИЕ", "дописать"),
        (r"никогда\s+\(НЕ\)ПОНИМАЕМОЕ", "НЕ ПОНИМАЕМОЕ", "никогда"),
        (r"\(НЕ\)УДИВЛЕННЫЙ\s+сложившейся", "НЕ УДИВЛЕННЫЙ", "сложившейся ситуацией"),
        (r"\(НЕ\)СТРЕМЯЩИЕСЯ\s+развивать", "НЕ СТРЕМЯЩИЕСЯ", "развивать свои навыки"),
        (r"\(НЕ\)ОСОЗНАЮЩИМИ,\s+к\s+каким", "НЕ ОСОЗНАЮЩИМИ", "к каким серьёзным последствиям"),
        (r"\(НЕ\)ПРЕКРАЩАВШАЯСЯ\s+в\s+течение", "НЕ ПРЕКРАЩАВШАЯСЯ", "в течение трёх суток"),
        (r"\(НЕ\)ПРОВЕРЕННЫЕ\s+ещ[её]", "НЕ ПРОВЕРЕННЫЕ", "ещё"),
        (r"\(НЕ\)РАЗДЕЛЁННАЯ\s+с\s+друзьями", "НЕ РАЗДЕЛЁННАЯ", "с друзьями"),
        (r"\(НЕ\)РАСПРОДАННЫЕ\s+в\s+течение", "НЕ РАСПРОДАННЫЕ", "в течение месяца"),
        (r"\(НЕ\)ОПРЕДЕЛИВШИХСЯ\s+с\s+выбором", "НЕ ОПРЕДЕЛИВШИХСЯ", "с выбором пенсионного фонда"),
        (r"\(НЕ\)ПОКОРИВШИХСЯ\s+судьбе", "НЕ ПОКОРИВШИХСЯ", "судьбе"),
        (r"\(НЕ\)ПОНЯТНОЕ\s+решение", "НЕ ПОНЯТНОЕ", "никому (отрицательное местоимение усиливает отрицание)"),
    ]

    for q in fipi_tasks:
        if q.get("task") != "13":
            continue
        for row in q.get("rows", []):
            sent = row.get("words", [""])[0]
            for pat, solved_token, dep_word in participle_dep_patterns:
                if re.search(pat, sent, re.I):
                    row["letter"] = "РАЗДЕЛЬНО"
                    clean_solved = re.sub(r"\(НЕ\)([А-ЯЁа-яё\-]+)", r"НЕ \1", sent, flags=re.I)
                    clean_solved = re.sub(r"\(НИ\)([А-ЯЁа-яё\-]+)", r"НИ \1", clean_solved, flags=re.I)
                    row["solvedWords"] = [clean_solved]
                    row["explanation"] = (
                        f"{solved_token} — полное причастие с зависимым словом «{dep_word}»; "
                        f"при наличии зависимых слов частица НЕ с полным причастием пишется раздельно; "
                        f"поэтому пишется РАЗДЕЛЬНО — «{solved_token}»."
                    )
                    stats["pass1_t13_participles_healed"] += 1
                    break

    # 1.5 Task 13 Opposition with "а", relative adjectives, and special tokens
    opposition_and_relative_patterns = [
        (r"\(НЕ\)ХРУСТАЛЬНАЯ.*?\bа\s+из\b", "НЕ ХРУСТАЛЬНАЯ", "относительное прилагательное с прямым противопоставлением с союзом «А» («а из венецианского стекла»)"),
        (r"\(НЕ\)ДЕРЕВЯНН.*?\bа\b", "НЕ ДЕРЕВЯННЫЙ", "относительное прилагательное с противопоставлением с союзом «А»"),
        (r"\(НЕ\)СЕРЕБРЯН.*?\bа\b", "НЕ СЕРЕБРЯНЫЙ", "относительное прилагательное с противопоставлением с союзом «А»"),
        (r"\(НЕ\)ЗОЛОТ.*?\bа\b", "НЕ ЗОЛОТОЙ", "относительное прилагательное с противопоставлением с союзом «А»"),
        (r"\(НЕ\)СТЕКЛЯНН.*?\bа\b", "НЕ СТЕКЛЯННЫЙ", "относительное прилагательное с противопоставлением с союзом «А»"),
        (r"\(НЕ\)СТЕКЛЯННАЯ\b", "НЕ СТЕКЛЯННАЯ", "относительное прилагательное (не имеет степеней сравнения и краткой формы, с НЕ пишется раздельно)"),
        (r"\(НЕ\)КРАСНА\s+книга\s+письмом,\s*а\s+красна", "НЕ КРАСНА", "краткое качественное прилагательное с прямым противопоставлением с союзом «А»"),
        (r"\(НЕ\)СЫРАЯ.*?а\s+сухая", "НЕ СЫРАЯ", "качественное прилагательное с прямым противопоставлением с союзом «А»"),
        (r"\(НЕ\)\s*СИЛЬНЫЙ,\s*а\s+слабый", "НЕ СИЛЬНЫЙ", "качественное прилагательное с прямым противопоставлением с союзом «А»"),
        (r"\(НЕ\)ОСТОРОЖНОСТЬЮ,\s*а\s+трусостью", "НЕ ОСТОРОЖНОСТЬЮ", "существительное с прямым противопоставлением с союзом «А»"),
        (r"\(НЕ\)ОДНОЙ,\s*а\s+многих", "НЕ ОДНОЙ", "числительное с прямым противопоставлением с союзом «А»"),
        (r"\(НЕ\)ТЕПЛО.*?а\s+холодно", "НЕ ТЕПЛО", "наречие на -о с прямым противопоставлением с союзом «А»"),
        (r"\(НЕ\)ЛЁГКИЙ,\s*а\s+довольно\s+трудный", "НЕ ЛЁГКИЙ", "прилагательное с прямым противопоставлением с союзом «А»"),
        (r"\(НЕ\)ХОЛОДНЫЙ,\s*а\s+теплый", "НЕ ХОЛОДНЫЙ", "прилагательное с прямым противопоставлением с союзом «А»"),
        (r"\(НЕ\)ИНТЕРЕСНЫМ,\s*а\s+скучным", "НЕ ИНТЕРЕСНЫМ", "прилагательное с прямым противопоставлением с союзом «А»"),
        (r"\(НЕ\)РЕДКО,\s*а\s+почти", "НЕ РЕДКО", "наречие на -о с противопоставлением"),
        (r"\(НЕ\)ПО-ТОВАРИЩЕСКИ", "НЕ ПО-ТОВАРИЩЕСКИ", "наречие через дефис всегда пишется с НЕ раздельно"),
        (r"во\s+что\s+бы\s+то\s+\(НИ\)СТАЛО", "НИ СТАЛО", "устойчивое фразеологическое сочетание «во что бы то ни стало»"),
        (r"\(НЕ\)ЧТО\s+иное,\s*как", "НЕ ЧТО", "конструкция «не что иное, как» пишется раздельно"),
        (r"\(НЕ\)КТО\s+иной,\s*как", "НЕ КТО", "конструкция «не кто иной, как» пишется раздельно"),
        (r"\(НЕ\)СОГЛАСЕН\b", "НЕ СОГЛАСЕН", "краткое прилагательное (предикатив), употребляющееся только в краткой форме; пишется раздельно"),
        (r"\(НЕ\)РАД\b", "НЕ РАД", "краткое прилагательное, с НЕ пишется раздельно"),
        (r"\(НЕ\)ДОЛЖЕН\b", "НЕ ДОЛЖЕН", "краткое прилагательное, с НЕ пишется раздельно"),
        (r"\(НЕ\)ГОТОВ\b", "НЕ ГОТОВ", "краткое прилагательное, с НЕ пишется раздельно"),
        (r"\(НЕ\)ЗРЯ\b", "НЕ ЗРЯ", "наречие не на -о/-е; с НЕ пишется раздельно"),
        (r"\(НЕ\)СРАЗУ\b", "НЕ СРАЗУ", "наречие не на -о/-е; с НЕ пишется раздельно"),
        (r"\(НЕ\)РАЗ\b", "НЕ РАЗ", "устойчивое наречное сочетание в значении «многократно»; пишется раздельно"),
        (r"\(НИ\)РАЗУ\b", "НИ РАЗУ", "отрицательное наречное сочетание со значением «никогда»; пишется раздельно"),
        (r"\(НЕ\)БОГИ\b", "НЕ БОГИ", "существительное с отрицанием в пословице «не боги горшки обжигают»; пишется раздельно"),
        (r"\(НЕ\)ПОНИМАЯ\b", "НЕ ПОНИМАЯ", "деепричастие от глагола понимать; с деепричастиями частица НЕ пишется раздельно"),
        (r"\(НЕ\)ДОЙДЯ\b", "НЕ ДОЙДЯ", "деепричастие от глагола дойти; с деепричастиями частица НЕ пишется раздельно"),
        (r"\(НЕ\)СОГЛАШАЯСЬ\b", "НЕ СОГЛАШАЯСЬ", "деепричастие от глагола соглашаться; с деепричастиями частица НЕ пишется раздельно"),
        (r"\(НЕ\)ТОРОПЯСЬ\b", "НЕ ТОРОПЯСЬ", "деепричастие от глагола торопиться; с деепричастиями частица НЕ пишется раздельно"),
        (r"\(НЕ\)БУДУЧИ\b", "НЕ БУДУЧИ", "деепричастие от глагола быть; с деепричастиями частица НЕ пишется раздельно"),
        (r"\(НЕ\)СПЕША\b", "НЕ СПЕША", "деепричастие (наречное); пишется раздельно"),
        (r"\(НЕ\)ДОЧИТАЛ\b", "НЕ ДОЧИТАЛ", "глагол совершенного вида; частица НЕ с глаголами пишется раздельно"),
        (r"\(НЕ\)ДОСТАВАЛ\b", "НЕ ДОСТАВАЛ", "глагол в значении «не дотягивался»; частица НЕ с глаголами пишется раздельно"),
        (r"\(НИ\)ОДНОГО\b", "НИ ОДНОГО", "отрицательное сочетание с числительным; пишется раздельно"),
    ]

    for q in fipi_tasks:
        if q.get("task") != "13":
            continue
        for row in q.get("rows", []):
            sent = row.get("words", [""])[0]
            # Fix rogue fipi-13-umschool-13-42727 row 1
            if "(НЕ)ГОВОРИЛ" in sent:
                row["letter"] = "РАЗДЕЛЬНО"
                row["solvedWords"] = ["Я никогда НЕ ГОВОРИЛ, что выбор — это просто."]
                row["explanation"] = "НЕ ГОВОРИЛ — личная форма глагола; частица НЕ с глаголами пишется раздельно; поэтому пишется РАЗДЕЛЬНО — «НЕ ГОВОРИЛ»."
                stats["pass1_t13_opposition_healed"] += 1
                continue

            for pat, solved_token, note in opposition_and_relative_patterns:
                if re.search(pat, sent, re.I):
                    row["letter"] = "РАЗДЕЛЬНО"
                    clean_solved = re.sub(r"\(НЕ\)([А-ЯЁа-яё\-]+)", r"НЕ \1", sent, flags=re.I)
                    clean_solved = re.sub(r"\(НИ\)([А-ЯЁа-яё\-]+)", r"НИ \1", clean_solved, flags=re.I)
                    row["solvedWords"] = [clean_solved]
                    row["explanation"] = (
                        f"{solved_token} — {note}; "
                        f"поэтому пишется РАЗДЕЛЬНО — «{solved_token}»."
                    )
                    stats["pass1_t13_opposition_healed"] += 1
                    break

    # 1.6 Synchronize words missingLetter from FIPI rows
    fipi_map = {t["id"]: t for t in fipi_tasks}

    for w in words:
        task = w.get("task")
        wid = w.get("id", "")
        m = re.match(r"^w-(\d+)-(.*?)-r(\d+)-w(\d+)$", wid)
        if not m:
            continue
        _, base_id, row_str, word_idx_str = m.groups()
        fipi_id = f"fipi-{task}-{base_id}"
        row_idx = int(row_str) - 1
        w_idx = int(word_idx_str) - 1

        t = fipi_map.get(fipi_id)
        if not t or row_idx >= len(t.get("rows", [])):
            continue
        row = t["rows"][row_idx]

        if task == "13":
            fipi_letter = row.get("letter", "").strip()
            if fipi_letter in ["СЛИТНО", "РАЗДЕЛЬНО"]:
                if w.get("missingLetter") != fipi_letter:
                    w["missingLetter"] = fipi_letter
                    stats["pass1_t13_sync_fipi"] += 1
                if fipi_letter == "РАЗДЕЛЬНО":
                    clean_w = w.get("word", "").strip()
                    if not clean_w.startswith("НЕ ") and not clean_w.startswith("НИ "):
                        w["word"] = re.sub(r"^(НЕ|НИ)(?=[А-ЯЁа-яё])", r"\1 ", clean_w)
                elif fipi_letter == "СЛИТНО":
                    w["word"] = w.get("word", "").replace(" ", "").strip()

        elif task == "14":
            parts = [p.strip() for p in row.get("letter", "").split("/")]
            if len(parts) > w_idx:
                expected = parts[w_idx]
                if expected in ["СЛИТНО", "ДЕФИСНО", "РАЗДЕЛЬНО"]:
                    if w.get("missingLetter") != expected:
                        w["missingLetter"] = expected
                        stats["pass1_t14_sync_fipi"] += 1
                    clean_w = w.get("word", "").replace("-", "").replace(" ", "").strip()
                    if expected == "СЛИТНО":
                        w["word"] = clean_w
                    elif expected == "ДЕФИСНО":
                        # If compound noun like ИНЖЕНЕР ТЕХНОЛОГ
                        if "ИНЖЕНЕР" in clean_w and "ТЕХНОЛОГ" in clean_w:
                            w["word"] = "ИНЖЕНЕРОМ-ТЕХНОЛОГОМ"
                        elif "почему(то)" in w.get("context", "").lower() or "(то)" in w.get("wordGap", "").lower():
                            w["word"] = "ПОЧЕМУ-ТО"
                        elif clean_w.startswith("ПО") and len(clean_w) > 2:
                            w["word"] = f"ПО-{clean_w[2:]}"
                    elif expected == "РАЗДЕЛЬНО":
                        if clean_w.startswith("ПО") and len(clean_w) > 2:
                            w["word"] = f"ПО {clean_w[2:]}"

    print(f"Pass 1: Fixed {stats['pass1_homoglyphs_fixed']} homoglyphs, {stats['pass1_glued_strings_healed']} glued strings, "
          f"{stats['pass1_pochemu_healed']} ПОЧЕМУ entries, {stats['pass1_t13_participles_healed']} participles, "
          f"{stats['pass1_t13_opposition_healed']} opposition cases, {stats['pass1_t14_prepositions_healed']} prepositions, "
          f"{stats['pass1_t13_sync_fipi']} Task 13 word answers synced, {stats['pass1_t14_sync_fipi']} Task 14 word answers synced.")

    # =========================================================================
    # PASS 2: Part-of-Speech & Morphological Category Validation
    # =========================================================================
    print("\n--- PASS 2: Part-of-Speech & Morphological Category Validation ---")

    adj_endings = re.compile(r"(?:[а-яё]ая|[а-яё]яя|[а-яё]ья|ое|ее|ый|ий|ой|ые|ие|ого|его|ому|ему|ым|им|ом|ем|ую|юю|ей|ых|их|ыми|ими)$", re.I)

    for w in words:
        task = w.get("task")
        word = w.get("word", "")
        cat = w.get("category", "")
        top = w.get("topic", "")

        if task == "13":
            if "деепричаст" in cat.lower() or "деепричаст" in top.lower():
                if adj_endings.search(word):
                    w["category"] = "Правописание НЕ с прилагательными"
                    w["topic"] = "Правописание НЕ с прилагательными"
                    stats["pass2_categories_corrected"] += 1
            if "хрустальн" in word.lower():
                w["category"] = "Правописание НЕ с прилагательными"
                w["topic"] = "Правописание НЕ с прилагательными"
                w["word"] = "НЕ ХРУСТАЛЬНАЯ"
                w["missingLetter"] = "РАЗДЕЛЬНО"
            if w.get("missingLetter") == "РАЗДЕЛЬНО" and ("причаст" in cat.lower() or "причаст" in top.lower()):
                w["category"] = "Полные причастия с зависимыми словами (раздельно)"
                w["topic"] = "Полные причастия с зависимыми словами (раздельно)"

        elif task == "14":
            w_clean = word.replace("-", "").replace(" ", "").upper()
            if "ИНЖЕНЕР" in w_clean and "ТЕХНОЛОГ" in w_clean:
                w["category"] = "Сложные существительные (через дефис)"
                w["topic"] = "Сложные существительные (через дефис)"
                w["missingLetter"] = "ДЕФИСНО"
                w["word"] = "ИНЖЕНЕРОМ-ТЕХНОЛОГОМ"
            elif w_clean in ("ПОЭТОМУ", "ПОТОМУ", "ПОЧЕМУ", "ОТТОГО", "ОТЧЕГО", "ЧТОБЫ", "ТАКЖЕ", "ТОЖЕ", "ЗАТО", "ПРИТОМ", "ПРИЧЕМ", "ПОСКОЛЬКУ"):
                w["category"] = "Сочинительные и подчинительные союзы"
                w["topic"] = "Сочинительные и подчинительные союзы"
            elif w_clean in ("ВВИДУ", "ВСЛЕДСТВИЕ", "НАВСТРЕЧУ", "НАПОДОБИЕ", "ВТЕЧЕНИЕ", "ВТРОДОЛЖЕНИЕ"):
                w["category"] = "Производные предлоги"
                w["topic"] = "Производные предлоги"

    for s in sprint_questions:
        task = s.get("task")
        top = s.get("topic", "")
        s_word = f"{s.get('prefix','')}{s.get('suffix','')}".replace("(", "").replace(")", "").strip()

        if task == "13":
            if "деепричаст" in top.lower() and adj_endings.search(s_word):
                s["topic"] = "Правописание НЕ с прилагательными"
                stats["pass2_categories_corrected"] += 1
            if "хрустальн" in s_word.lower():
                s["topic"] = "Правописание НЕ с прилагательными"
                s["answer"] = "РАЗДЕЛЬНО"
        elif task == "14":
            s_clean = s_word.replace("-", "").replace(" ", "").upper()
            if "ИНЖЕНЕР" in s_clean and "ТЕХНОЛОГ" in s_clean:
                s["topic"] = "Сложные существительные (через дефис)"
                s["answer"] = "ДЕФИСНО"

    print(f"Pass 2: {stats['pass2_categories_corrected']} false category tags corrected.")

    # =========================================================================
    # PASS 3: Step-by-Step Explanation Semantic Consistency & Complete Isolation
    # =========================================================================
    print("\n--- PASS 3: Step-by-Step Explanation Semantic Consistency & Isolation ---")

    non_hyphen_t14 = [
        "ПОЭТОМУ", "ПОТОМУ", "ПОЧЕМУ", "ПОСКОЛЬКУ", "ОТТОГО", "ОТЧЕГО",
        "ЗАТО", "ТАКЖЕ", "ТОЖЕ", "ЧТОБЫ", "ВВИДУ", "НАЗАВТРА", "ВСЛЕДСТВИЕ",
        "НАВСТРЕЧУ", "НАПОДОБИЕ", "ПОНЕМНОГУ", "СНАЧАЛА", "ВНАЧАЛЕ", "ИТАК",
        "В ТЕЧЕНИЕ", "В ПРОДОЛЖЕНИЕ"
    ]

    bulk_patterns = [
        r";\s*Остальные слова пишутся[^.;]*",
        r";\s*В остальных вариантах[^.;]*",
        r";\s*Остальные варианты[^.;]*",
        r";\s*В других вариантах[^.;]*",
        r";\s*Правильный ответ\s*:[^.;]*",
    ]

    def clean_rule_semantics(text: str, target: str, task: str, ans_mode: str = "") -> str:
        if not text:
            return ""
        res = clean_explanation_str(text)

        # 1. Clean bulk scraper dumps
        for bp in bulk_patterns:
            res = re.sub(bp, "", res, flags=re.I)

        clean_target = target.replace("(", "").replace(")", "").strip()

        # 2. Purge Task 14 hyphen contradictions on non-hyphen words
        if task == "14":
            for bw in non_hyphen_t14:
                bw_clean = bw.replace(" ", "")
                if bw_clean in target.upper() or ans_mode != "ДЕФИСНО":
                    if "такие наречия всегда пишутся через дефис" in res and bw_clean in res.upper():
                        res = re.sub(
                            rf"такие наречия всегда пишутся через дефис[^\n.;]*?поэтому пишется ЧЕРЕЗ ДЕФИС\s*—\s*«{bw_clean}»[.]?",
                            f"поэтому пишется СЛИТНО — «{bw_clean}».",
                            res,
                            flags=re.I
                        )
                        res = re.sub(
                            rf"поэтому пишется ЧЕРЕЗ ДЕФИС\s*—\s*«{bw_clean}»[.]?",
                            f"поэтому пишется СЛИТНО — «{bw_clean}».",
                            res,
                            flags=re.I
                        )
                        res = res.replace("такие наречия всегда пишутся через дефис (в отличие от одноимённых прилагательных с предлогом ПО);", "")
                        stats["pass3_bogus_hyphens_purged"] += 1

            # Fix adjective phrases with ПО written separately
            if ans_mode == "РАЗДЕЛЬНО" and "ПО " in target.upper():
                adj_m = re.search(r"ПО\s+(ПРЕЖНЕМУ|РАЗНОМУ|ОСЕННЕМУ|ЗИМНЕМУ|МОЕМУ|ОДНОМУ)", target.upper())
                if adj_m:
                    token = f"ПО {adj_m.group(1)}"
                    res = (
                        f"{token} — предлог «ПО» с зависимым словом «{adj_m.group(1)}»; "
                        f"пишется раздельно; поэтому пишется РАЗДЕЛЬНО — «{token}»."
                    )
                    stats["pass3_bogus_hyphens_purged"] += 1

        # 3. Purge Task 13 contradictions
        if task == "13":
            has_dep = bool(re.search(r"(?:причасти[ея]\s+с\s+зависим|есть\s+зависим|наличии\s+зависимых)", res, re.I)) and not bool(re.search(r"(?:нет|отсутстви[еи])\s+зависимых", res, re.I))
            has_opp = bool(re.search(r"(?:прямым\s+противопоставлением|противопоставлен(?:ие|ием)\s+с\s+союзом\s+«?А»?)", res, re.I)) and not bool(re.search(r"(?:нет|отсутстви[еи])\s+противопоставления", res, re.I))

            if has_dep or ans_mode == "РАЗДЕЛЬНО":
                if "нет зависимых" in res or "пишется СЛИТНО" in res:
                    res = re.sub(r";?\s*у причастия в данном предложении нет зависимых[^\n.;]*?(?=;|\.|$)", "", res, flags=re.I)
                    res = re.sub(r";?\s*в данном контексте нет противопоставления с союзом «А»,\s*зависимых[^\n.;]*?(?=;|\.|$)", "", res, flags=re.I)
                    res = re.sub(r"поэтому с приставкой НЕ- пишется СЛИТНО\s*—\s*«[^»]+»", "поэтому пишется РАЗДЕЛЬНО", res, flags=re.I)
                    res = re.sub(r"поэтому пишется СЛИТНО\s*—\s*«[^»]+»", "поэтому пишется РАЗДЕЛЬНО", res, flags=re.I)
                    stats["pass3_contradictions_purged"] += 1

            if has_opp:
                if "нет противопоставления" in res:
                    res = re.sub(r";?\s*в данном контексте нет противопоставления[^\n.;]*?(?=;|\.|$)", "", res, flags=re.I)
                    res = re.sub(r";?\s*в предложении нет противопоставления[^\n.;]*?(?=;|\.|$)", "", res, flags=re.I)
                    stats["pass3_contradictions_purged"] += 1

        # 4. Resolve Conclusion Contradictions based on true answer
        if ans_mode == "СЛИТНО":
            if re.search(r"поэтому\s+пишется\s+РАЗДЕЛЬНО", res, re.I):
                res = re.sub(r"поэтому\s+пишется\s+РАЗДЕЛЬНО[^\n.]*", f"поэтому пишется СЛИТНО — «{clean_target}»", res, flags=re.I)
                stats["pass3_contradictions_purged"] += 1
            if re.search(r"поэтому\s+пишется\s+ЧЕРЕЗ\s+ДЕФИС", res, re.I):
                res = re.sub(r"поэтому\s+пишется\s+ЧЕРЕЗ\s+ДЕФИС[^\n.]*", f"поэтому пишется СЛИТНО — «{clean_target}»", res, flags=re.I)
                stats["pass3_contradictions_purged"] += 1
        elif ans_mode == "РАЗДЕЛЬНО":
            if re.search(r"поэтому\s+пишется\s+СЛИТНО", res, re.I):
                res = re.sub(r"поэтому\s+пишется\s+СЛИТНО[^\n.]*", f"поэтому пишется РАЗДЕЛЬНО — «{clean_target}»", res, flags=re.I)
                stats["pass3_contradictions_purged"] += 1
            if re.search(r"поэтому\s+пишется\s+ЧЕРЕЗ\s+ДЕФИС", res, re.I):
                res = re.sub(r"поэтому\s+пишется\s+ЧЕРЕЗ\s+ДЕФИС[^\n.]*", f"поэтому пишется РАЗДЕЛЬНО — «{clean_target}»", res, flags=re.I)
                stats["pass3_contradictions_purged"] += 1
        elif ans_mode == "ДЕФИСНО":
            if re.search(r"поэтому\s+пишется\s+СЛИТНО", res, re.I):
                res = re.sub(r"поэтому\s+пишется\s+СЛИТНО[^\n.]*", f"поэтому пишется ЧЕРЕЗ ДЕФИС — «{clean_target}»", res, flags=re.I)
                stats["pass3_contradictions_purged"] += 1
            if re.search(r"поэтому\s+пишется\s+РАЗДЕЛЬНО", res, re.I):
                res = re.sub(r"поэтому\s+пишется\s+РАЗДЕЛЬНО[^\n.]*", f"поэтому пишется ЧЕРЕЗ ДЕФИС — «{clean_target}»", res, flags=re.I)
                stats["pass3_contradictions_purged"] += 1

        # Remove duplicate clauses
        clauses = [c.strip() for c in re.split(r";\s*", res) if c.strip()]
        unique_clauses = []
        for c in clauses:
            if c not in unique_clauses:
                unique_clauses.append(c)
        res = "; ".join(unique_clauses)
        if res and not res.endswith("."):
            res += "."
        return res

    # 3.1 Clean FIPI row explanations first
    for q in fipi_tasks:
        task = q.get("task", "")
        for r in q.get("rows", []):
            orig_expl = r.get("explanation", "")
            sent = r.get("words", [""])[0]
            r["explanation"] = clean_rule_semantics(orig_expl, sent, task, r.get("letter", ""))

    # 3.2 Isolate individual explanations in allWords (recovering from FIPI row when misallocated)
    for w in words:
        orig_rule = w.get("rule", "")
        target = w.get("word", "")
        task = w.get("task", "")
        ans = w.get("missingLetter", "")
        wid = w.get("id", "")

        # Look up source FIPI task row
        m = re.match(r"^w-(\d+)-(.*?)-r(\d+)-w(\d+)$", wid)
        source_row_expl = ""
        if m:
            _, base_id, row_str, _ = m.groups()
            fipi_id = f"fipi-{task}-{base_id}"
            row_idx = int(row_str) - 1
            t = fipi_map.get(fipi_id)
            if t and row_idx < len(t.get("rows", [])):
                source_row_expl = t["rows"][row_idx].get("explanation", "")

        expl_to_isolate = source_row_expl if source_row_expl else orig_rule
        isolated = isolate_word_expl(expl_to_isolate, target)
        if not isolated or isolated == expl_to_isolate:
            isolated = isolate_word_expl(orig_rule, target)

        if isolated != orig_rule:
            stats["pass3_multiword_isolated"] += 1

        cleaned = clean_rule_semantics(isolated, target, task, ans)
        w["rule"] = cleaned

    # 3.3 Isolate sprint explanations and sync
    words_map = {w["id"]: w for w in words}

    for s in sprint_questions:
        sid = s.get("id", "")
        wid = sid.replace("sp-", "w-")
        task = s.get("task", "")
        ans = s.get("answer", "")
        target = f"{s.get('prefix','')}{s.get('suffix','')}"

        if wid in words_map:
            w = words_map[wid]
            s["rule"] = w["rule"]
            s["explanation"] = w["rule"]
        else:
            orig_expl = s.get("explanation", "") or s.get("rule", "")
            isolated = isolate_word_expl(orig_expl, target)
            if isolated != orig_expl:
                stats["pass3_multiword_isolated"] += 1
            cleaned = clean_rule_semantics(isolated, target, task, ans)
            s["explanation"] = cleaned
            s["rule"] = cleaned

    print(f"Pass 3: Isolated {stats['pass3_multiword_isolated']} multi-word leaks, "
          f"purged {stats['pass3_contradictions_purged']} contradictions, "
          f"purged {stats['pass3_bogus_hyphens_purged']} bogus hyphen rules.")

    # =========================================================================
    # PASS 4: Sprint Question Option Sets & Answers Synchronization
    # =========================================================================
    print("\n--- PASS 4: Sprint Question Option Sets & Formatting ---")

    for s in sprint_questions:
        task = s.get("task")
        ans = s.get("answer")
        opts = s.get("options", [])
        sid = s.get("id", "")
        wid = sid.replace("sp-", "w-")

        # Standard option sets
        if task == "13":
            s["options"] = ["СЛИТНО", "РАЗДЕЛЬНО"]
            if wid in words_map:
                w = words_map[wid]
                s["answer"] = w["missingLetter"]
                s["rule"] = w["rule"]
                s["explanation"] = w["rule"]
                s["topic"] = w["topic"]
                stats["pass4_sprint_sync"] += 1
            elif ans not in s["options"]:
                s["answer"] = "РАЗДЕЛЬНО" if "РАЗДЕЛЬНО" in s.get("explanation", "") else "СЛИТНО"
                stats["pass4_options_fixed"] += 1

        elif task == "14":
            s["options"] = ["СЛИТНО", "ДЕФИСНО", "РАЗДЕЛЬНО"]
            if wid in words_map:
                w = words_map[wid]
                s["answer"] = w["missingLetter"]
                s["rule"] = w["rule"]
                s["explanation"] = w["rule"]
                s["topic"] = w["topic"]
                stats["pass4_sprint_sync"] += 1
            elif s["answer"] not in s["options"]:
                s["answer"] = "СЛИТНО"
                stats["pass4_options_fixed"] += 1

            # Photo 4 formatting
            ctx = s.get("context", "")
            if "инженером" in ctx.lower() and "технологом" in ctx.lower():
                s["prefix"] = "(ИНЖЕНЕРОМ)"
                s["suffix"] = "ТЕХНОЛОГОМ"
                s["answer"] = "ДЕФИСНО"
                s["topic"] = "Сложные существительные (через дефис)"
                s["explanation"] = (
                    "ИНЖЕНЕРОМ-ТЕХНОЛОГОМ — сложное существительное (приложение), обозначающее специальность; "
                    "пишется через дефис; поэтому пишется ЧЕРЕЗ ДЕФИС — «ИНЖЕНЕРОМ-ТЕХНОЛОГОМ»."
                )
                s["rule"] = s["explanation"]

        elif task == "15":
            s["options"] = ["Н", "НН"]
            if wid in words_map:
                w = words_map[wid]
                s["answer"] = w["missingLetter"]
                s["rule"] = w["rule"]
                s["explanation"] = w["rule"]
                s["topic"] = w["topic"]
                stats["pass4_sprint_sync"] += 1
            elif ans not in s["options"]:
                s["answer"] = "Н" if "одна" in s.get("explanation", "") else "НН"
                stats["pass4_options_fixed"] += 1

    print(f"Pass 4: {stats['pass4_options_fixed']} options fixed, {stats['pass4_sprint_sync']} sprint answers synced with words.")

    # =========================================================================
    # PASS 5: Cross-Task FIPI Row Integrity & correctIndices Alignment
    # =========================================================================
    print("\n--- PASS 5: Cross-Task FIPI Row Integrity & correctIndices Alignment ---")

    for q in fipi_tasks:
        task = q.get("task")
        rule = q.get("rule", "")
        rows = q.get("rows", [])

        if task in ("9", "10", "11", "12"):
            corr_indices = []
            for r_idx, r in enumerate(rows):
                is_corr = r.get("isCorrectRow", False)
                if is_corr:
                    corr_indices.append(r_idx + 1)
            if corr_indices:
                q["correctIndices"] = corr_indices
                stats["pass5_fipi_indices_realigned"] += 1

        elif task == "13":
            target_mode = "РАЗДЕЛЬНО" if "РАЗДЕЛЬНО" in rule else "СЛИТНО"
            corr_indices = []
            for r_idx, r in enumerate(rows):
                row_letter = r.get("letter", "")
                is_corr = (row_letter == target_mode)
                r["isCorrectRow"] = is_corr
                if is_corr:
                    corr_indices.append(r_idx + 1)
            q["correctIndices"] = corr_indices
            stats["pass5_fipi_indices_realigned"] += 1

        elif task == "14":
            target_mode = (
                "ДЕФИСНО" if "ДЕФИС" in rule
                else "РАЗДЕЛЬНО" if "РАЗДЕЛЬНО" in rule
                else "СЛИТНО"
            )
            corr_indices = []
            for r_idx, r in enumerate(rows):
                row_letter = r.get("letter", "")
                is_corr = (row_letter == target_mode)
                r["isCorrectRow"] = is_corr
                if is_corr:
                    corr_indices.append(r_idx + 1)
            q["correctIndices"] = corr_indices
            stats["pass5_fipi_indices_realigned"] += 1

        elif task == "15":
            existing_corr = q.get("correctIndices", [])
            corr_letters = [rows[i - 1].get("letter") for i in existing_corr if 1 <= i <= len(rows)]
            
            if corr_letters and all(l == "Н" for l in corr_letters):
                target_mode = "Н"
                q["rule"] = "Укажите цифру(-ы), на месте которой(-ых) пишется Н."
                stats["pass5_t15_rules_synced"] += 1
            else:
                target_mode = "НН"
                q["rule"] = "Укажите цифру(-ы), на месте которой(-ых) пишется НН."
                stats["pass5_t15_rules_synced"] += 1

            corr_indices = []
            for r_idx, r in enumerate(rows):
                row_letter = r.get("letter", "")
                is_corr = (row_letter == target_mode)
                r["isCorrectRow"] = is_corr
                if is_corr:
                    corr_indices.append(r_idx + 1)
            if corr_indices:
                q["correctIndices"] = corr_indices
            stats["pass5_fipi_indices_realigned"] += 1

    print(f"Pass 5: {stats['pass5_t15_rules_synced']} Task 15 rules synced, {stats['pass5_fipi_indices_realigned']} FIPI tasks aligned.")

    # =========================================================================
    # SYNCHRONIZE STARTER BANK
    # =========================================================================
    print("\nSynchronizing starterBank.json with healed data...")
    words_map = {w["id"]: w for w in words}
    fipi_map = {q["id"]: q for q in fipi_tasks}
    sprint_map = {s["id"]: s for s in sprint_questions}

    starter_words = starter_bank.get("words", [])
    for idx, sw in enumerate(starter_words):
        if sw.get("id") in words_map:
            starter_words[idx] = words_map[sw["id"]]

    starter_fipi = starter_bank.get("fipi", [])
    for idx, sf in enumerate(starter_fipi):
        if sf.get("id") in fipi_map:
            starter_fipi[idx] = fipi_map[sf["id"]]

    starter_sprint = starter_bank.get("sprint", [])
    for idx, ss in enumerate(starter_sprint):
        if ss.get("id") in sprint_map:
            starter_sprint[idx] = sprint_map[ss["id"]]

    # =========================================================================
    # WRITE HEALED FILES
    # =========================================================================
    print("\nWriting healed databases to workspace and public directories...")
    with open(all_words_path, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=2)
    with open(fipi_tasks_path, "w", encoding="utf-8") as f:
        json.dump(fipi_tasks, f, ensure_ascii=False, indent=2)
    with open(sprint_path, "w", encoding="utf-8") as f:
        json.dump(sprint_questions, f, ensure_ascii=False, indent=2)
    with open(starter_path, "w", encoding="utf-8") as f:
        json.dump(starter_bank, f, ensure_ascii=False, indent=2)

    # Public copy for dev server
    pub_dir = os.path.join(WORKSPACE_DIR, "public/data")
    os.makedirs(pub_dir, exist_ok=True)
    with open(os.path.join(pub_dir, "allWordsBank9_15.json"), "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=2)
    with open(os.path.join(pub_dir, "fipiTasksBank9_15.json"), "w", encoding="utf-8") as f:
        json.dump(fipi_tasks, f, ensure_ascii=False, indent=2)
    with open(os.path.join(pub_dir, "sprintBank9_15.json"), "w", encoding="utf-8") as f:
        json.dump(sprint_questions, f, ensure_ascii=False, indent=2)

    if os.path.exists(REPO_DIR):
        print(f"Writing to cloned repo at {REPO_DIR}...")
        repo_src = os.path.join(REPO_DIR, "src/data")
        repo_pub = os.path.join(REPO_DIR, "public/data")
        os.makedirs(repo_src, exist_ok=True)
        os.makedirs(repo_pub, exist_ok=True)

        with open(os.path.join(repo_src, "starterBank.json"), "w", encoding="utf-8") as f:
            json.dump(starter_bank, f, ensure_ascii=False, indent=2)

        for p in [repo_src, repo_pub]:
            with open(os.path.join(p, "allWordsBank9_15.json"), "w", encoding="utf-8") as f:
                json.dump(words, f, ensure_ascii=False, indent=2)
            with open(os.path.join(p, "fipiTasksBank9_15.json"), "w", encoding="utf-8") as f:
                json.dump(fipi_tasks, f, ensure_ascii=False, indent=2)
            with open(os.path.join(p, "sprintBank9_15.json"), "w", encoding="utf-8") as f:
                json.dump(sprint_questions, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 70)
    print("5-PASS AUDIT & HEALING COMPLETED SUCCESSFULLY!")
    print(json.dumps(stats, indent=2))
    print("=" * 70)

if __name__ == "__main__":
    main()
