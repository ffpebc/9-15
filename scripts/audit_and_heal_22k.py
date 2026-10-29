# -*- coding: utf-8 -*-
"""
audit_and_heal_22k.py

Dedicated 5-pass validation and healing engine for all ~22,187 words, 
2,322 FIPI tasks, and 22,187 sprint questions in the Russian ЕГЭ database.

Pass 1: Orthography & Answer Correctness vs Russian Orthography & Rules
Pass 2: Part-of-speech & Morphological Category Validation
Pass 3: Step-by-Step Explanation Semantic Consistency (Zero Contradictions)
Pass 4: Sprint Question Option Sets & Compound Word Presentation
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
    res = re.sub(r"^[;,.\s—]+|[;,.\s]+$", "", res)
    return res.strip()

def main():
    print("=" * 70)
    print("STARTING COMPREHENSIVE 5-PASS DEEP AUDIT & HEALING OF 22K WORDS DATABASE")
    print("=" * 70)

    src_words_path = os.path.join(WORKSPACE_DIR, "src/data/allWordsBank9_15.json")
    src_fipi_path = os.path.join(WORKSPACE_DIR, "src/data/fipiTasksBank9_15.json")
    src_sprint_path = os.path.join(WORKSPACE_DIR, "src/data/sprintBank9_15.json")
    src_starter_path = os.path.join(WORKSPACE_DIR, "src/data/starterBank.json")

    with open(src_words_path, "r", encoding="utf-8") as f:
        words_data = json.load(f)
    words = words_data if isinstance(words_data, list) else words_data.get("words", [])

    with open(src_fipi_path, "r", encoding="utf-8") as f:
        fipi_tasks = json.load(f)

    with open(src_sprint_path, "r", encoding="utf-8") as f:
        sprint_questions = json.load(f)

    with open(src_starter_path, "r", encoding="utf-8") as f:
        starter_bank = json.load(f)

    print(f"Loaded: {len(words)} words, {len(fipi_tasks)} FIPI tasks, {len(sprint_questions)} sprint questions.")

    stats = {
        "pass1_homoglyphs_fixed": 0,
        "pass1_t13_participles_healed": 0,
        "pass1_t13_opposition_healed": 0,
        "pass1_t14_hyphens_purged": 0,
        "pass1_t14_compounds_healed": 0,
        "pass2_categories_corrected": 0,
        "pass3_contradictions_purged": 0,
        "pass3_bulk_dumps_cleaned": 0,
        "pass4_options_fixed": 0,
        "pass4_sprint_sync": 0,
        "pass5_t15_rules_synced": 0,
        "pass5_fipi_indices_realigned": 0,
    }

    # -------------------------------------------------------------------------
    # PASS 1: Orthography & Answer Correctness vs Russian Orthography
    # -------------------------------------------------------------------------
    print("\n--- PASS 1: Orthography & Answer Correctness vs Rules ---")

    # 1.0 Normalize all text fields across datasets
    for w in words:
        for k in ["word", "wordGap", "prefix", "suffix", "rule", "context"]:
            if k in w and isinstance(w[k], str):
                orig = w[k]
                w[k] = normalize_text(w[k])
                if orig != w[k] and "3" in orig:
                    stats["pass1_homoglyphs_fixed"] += 1

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

    # 1.1 Known Participles with Dependent Words in Task 13
    participle_dep_patterns = [
        # Photo 1: (НЕ)РАССЛЫШАННЫЙ преподавателем
        (r"\(НЕ\)РАССЛЫШАННЫЙ\s+преподавателем", "НЕ РАССЛЫШАННЫЙ", "преподавателем"),
        # Photo 2: (НЕ)ДОЖДАВШИЕСЯ ужина
        (r"\(НЕ\)ДОЖДАВШИЕСЯ\s+ужина", "НЕ ДОЖДАВШИЕСЯ", "ужина"),
        # (НЕ)ВЫХОДЯЩИМИ за пределы
        (r"\(НЕ\)ВЫХОДЯЩИМИ\s+за\s+пределы", "НЕ ВЫХОДЯЩИМИ", "за пределы простейших ощущений"),
        # С (НЕ)УСПЕВАЮЩИМИ по предмету
        (r"С\s+\(НЕ\)УСПЕВАЮЩИМИ\s+по\s+предмету", "НЕ УСПЕВАЮЩИМИ", "по предмету"),
        # никогда (НЕ)ОТКРЫВАВШЕМУ дверь
        (r"никогда\s+\(НЕ\)ОТКРЫВАВШЕМУ", "НЕ ОТКРЫВАВШЕМУ", "никогда"),
        # (НЕ)ОБСТАВЛЕННОЙ мебелью
        (r"\(НЕ\)ОБСТАВЛЕННОЙ\s+мебелью", "НЕ ОБСТАВЛЕННОЙ", "мебелью"),
        # (НЕ)ТОПЛЕННОГО всю зиму
        (r"\(НЕ\)ТОПЛЕННОГО\s+всю\s+зиму", "НЕ ТОПЛЕННОГО", "всю зиму"),
        # (НЕ)ИСПРАВЛЕННАЯ вовремя
        (r"\(НЕ\)ИСПРАВЛЕННАЯ\s+вовремя", "НЕ ИСПРАВЛЕННАЯ", "вовремя"),
        # (НЕ)ИМЕВШИЙ в своей галерее
        (r"\(НЕ\)ИМЕВШИЙ\s+в\s+своей\s+галерее", "НЕ ИМЕВШИЙ", "в своей галерее изображения"),
        # (НЕ)СТИХАЮЩИЙ ни на минуту
        (r"\(НЕ\)СТИХАЮЩИЙ\s+ни\s+на\s+минуту", "НЕ СТИХАЮЩИЙ", "ни на минуту"),
        # ещё (НЕ)РАСПУСТИВШИЙСЯ
        (r"ещ[её]\s+\(НЕ\)РАСПУСТИВШИЙСЯ", "НЕ РАСПУСТИВШИЙСЯ", "ещё"),
        # давно (НЕ)ЧИТАННАЯ
        (r"давно\s+\(НЕ\)ЧИТАННАЯ", "НЕ ЧИТАННАЯ", "давно"),
        # никем (НЕ)ЗАМЕЧЕННЫЙ
        (r"никем\s+\(НЕ\)ЗАМЕЧЕННЫЙ", "НЕ ЗАМЕЧЕННЫЙ", "никем"),
        # ничем (НЕ)ОПРАВДАННЫЙ
        (r"ничем\s+\(НЕ\)ОПРАВДАННЫЙ", "НЕ ОПРАВДАННЫЙ", "ничем"),
        # (НЕ)УСПЕВШИЕ дописать
        (r"\(НЕ\)УСПЕВШИЕ\s+дописать", "НЕ УСПЕВШИЕ", "дописать"),
        # никогда (НЕ)ПОНИМАЕМОЕ
        (r"никогда\s+\(НЕ\)ПОНИМАЕМОЕ", "НЕ ПОНИМАЕМОЕ", "никогда"),
    ]

    # 1.2 Opposition with "а" or relative adjectives
    opposition_and_relative_patterns = [
        # Photo 5: Ваза оказалась (НЕ)ХРУСТАЛЬНАЯ ... а из венецианского стекла
        (r"\(НЕ\)ХРУСТАЛЬНАЯ.*?\bа\s+из\b", "НЕ ХРУСТАЛЬНАЯ", "относительное прилагательное с прямым противопоставлением с союзом «А»"),
        (r"\(НЕ\)ДЕРЕВЯНН.*?\bа\b", "НЕ ДЕРЕВЯННЫЙ", "относительное прилагательное с противопоставлением"),
        (r"\(НЕ\)СЕРЕБРЯН.*?\bа\b", "НЕ СЕРЕБРЯНЫЙ", "относительное прилагательное с противопоставлением"),
        (r"\(НЕ\)ЗОЛОТ.*?\bа\b", "НЕ ЗОЛОТОЙ", "относительное прилагательное с противопоставлением"),
        (r"\(НЕ\)СТЕКЛЯНН.*?\bа\b", "НЕ СТЕКЛЯННЫЙ", "относительное прилагательное с противопоставлением"),
        (r"\(НЕ\)ПО-ТОВАРИЩЕСКИ", "НЕ ПО-ТОВАРИЩЕСКИ", "наречие через дефис всегда пишется с НЕ раздельно"),
        (r"во\s+что\s+бы\s+то\s+\(НИ\)СТАЛО", "НИ СТАЛО", "устойчивое фразеологическое сочетание «во что бы то ни стало»"),
        (r"\(НЕ\)ЧТО\s+иное,\s*как", "НЕ ЧТО", "конструкция «не что иное, как» пишется раздельно"),
        (r"\(НЕ\)КТО\s+иной,\s*как", "НЕ КТО", "конструкция «не кто иной, как» пишется раздельно"),
    ]

    for q in fipi_tasks:
        if q.get("task") != "13":
            continue
        for row in q.get("rows", []):
            sent = row.get("words", [""])[0]
            expl = row.get("explanation", "")
            curr_letter = row.get("letter", "")

            # Check participles with dependent words
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

            # Check relative adjectives & explicit opposition
            for pat, solved_token, reason in opposition_and_relative_patterns:
                if re.search(pat, sent, re.I):
                    row["letter"] = "РАЗДЕЛЬНО"
                    clean_solved = re.sub(r"\(НЕ\)([А-ЯЁа-яё\-]+)", r"НЕ \1", sent, flags=re.I)
                    clean_solved = re.sub(r"\(НИ\)([А-ЯЁа-яё\-]+)", r"НИ \1", clean_solved, flags=re.I)
                    row["solvedWords"] = [clean_solved]
                    row["explanation"] = (
                        f"{solved_token} — {reason}; "
                        f"частица пишется раздельно; "
                        f"поэтому пишется РАЗДЕЛЬНО — «{solved_token}»."
                    )
                    stats["pass1_t13_opposition_healed"] += 1
                    break

    # 1.3 Task 14 Hyphenation Sanity & Conjunction Cleanliness
    non_hyphen_t14 = [
        "ПОЭТОМУ", "ПОТОМУ", "ПОЧЕМУ", "ПОСКОЛЬКУ", "ОТТОГО", "ОТЧЕГО",
        "ЗАТО", "ТАКЖЕ", "ТОЖЕ", "ЧТОБЫ", "ВВИДУ", "НАЗАВТРА", "ВСЛЕДСТВИЕ",
        "НАВСТРЕЧУ", "НАПОДОБИЕ", "ПОНЕМНОГУ", "ПОВЕРХ", "ПОСРЕДИ", "ПОЗАДИ",
        "В ТЕЧЕНИЕ", "В ПРОДОЛЖЕНИЕ", "В ЗАКЛЮЧЕНИЕ"
    ]

    for q in fipi_tasks:
        if q.get("task") != "14":
            continue
        for row in q.get("rows", []):
            expl = row.get("explanation", "")
            sent = row.get("words", [""])[0]

            # Photo 3 sentence
            if "погода переменилась" in sent.lower() and "назавтра" in sent.lower():
                row["letter"] = "СЛИТНО"
                row["solvedWords"] = ["НАЗАВТРА погода переменилась, ПОЭТОМУ мы снова отправились в путь."]
                row["explanation"] = (
                    "НАЗАВТРА — обстоятельственное наречие времени; образовано слиянием предлога «на» с основой существительного в единое слово; поэтому пишется СЛИТНО — «НАЗАВТРА». "
                    "ПОЭТОМУ — местоименное наречие со значением следствия (= «оттого, следовательно»); пишется слитно; поэтому пишется СЛИТНО — «ПОЭТОМУ»."
                )
                stats["pass1_t14_hyphens_purged"] += 1
                continue

            # Photo 4 sentence
            if "инженером" in sent.lower() and "технологом" in sent.lower():
                row["letter"] = "РАЗДЕЛЬНО / ДЕФИСНО"
                row["solvedWords"] = ["Я все ТАК ЖЕ работал на заводе ИНЖЕНЕРОМ-ТЕХНОЛОГОМ."]
                row["explanation"] = (
                    "ТАК ЖЕ — сочетание указательного местоимения «ТАК» с частицей «ЖЕ» (частицу ЖЕ можно опустить: «Я все так работал»); поэтому пишется РАЗДЕЛЬНО — «ТАК ЖЕ». "
                    "ИНЖЕНЕРОМ-ТЕХНОЛОГОМ — сложное существительное (приложение), обозначающее сложную профессию/специальность; пишется через дефис; поэтому пишется ЧЕРЕЗ ДЕФИС — «ИНЖЕНЕРОМ-ТЕХНОЛОГОМ»."
                )
                stats["pass1_t14_compounds_healed"] += 1
                continue

            # Eliminate corrupted forms like ПО-ЧЕМУ, ПО-ЭТОМУ, ПО-ТОМУ
            if "ПО-ЧЕМУ" in expl or "ПО-ЧЕМУ" in sent:
                expl = expl.replace("ПО-ЧЕМУ —; такие наречия всегда пишутся через дефис (в отличие от одноимённых прилагательных с предлогом ПО); поэтому пишется ЧЕРЕЗ ДЕФИС — «ПО-ЧЕМУ».", "")
                expl = expl.replace("ПО-ЧЕМУ", "ПОЧЕМУ")
                expl = re.sub(r"ПОЧЕМУ\s*—[^\n.;]*?такие наречия всегда пишутся через дефис[^\n.;]*?поэтому пишется ЧЕРЕЗ ДЕФИС\s*—\s*«ПОЧЕМУ»[.]?", "ПОЧЕМУ — вопросительно-относительное местоименное наречие (= «по какой причине»); пишется слитно; поэтому пишется СЛИТНО — «ПОЧЕМУ».", expl)
                row["explanation"] = clean_explanation_str(expl)
                stats["pass1_t14_hyphens_purged"] += 1

            for nhw in non_hyphen_t14:
                nh_clean = nhw.replace(" ", "")
                if nh_clean in expl and ("через дефис" in expl or "ДЕФИС" in expl):
                    # Replace bogus hyphen rule
                    expl = re.sub(
                        rf"{nh_clean}\s*—[^\n.]*?такие наречия всегда пишутся через дефис[^\n.]*?поэтому пишется ЧЕРЕЗ ДЕФИС\s*—\s*«[^»]+»[.]?",
                        f"{nh_clean} — союз или наречие; пишется слитно; поэтому пишется СЛИТНО — «{nh_clean}».",
                        expl
                    )
                    expl = re.sub(
                        rf"такие наречия всегда пишутся через дефис[^\n.]*?поэтому пишется ЧЕРЕЗ ДЕФИС\s*—\s*«{nh_clean}»[.]?",
                        f"пишется СЛИТНО — «{nh_clean}».",
                        expl
                    )
                    row["explanation"] = clean_explanation_str(expl)
                    stats["pass1_t14_hyphens_purged"] += 1

    print(f"Pass 1: Fixed {stats['pass1_homoglyphs_fixed']} homoglyphs, "
          f"{stats['pass1_t13_participles_healed']} participles, "
          f"{stats['pass1_t13_opposition_healed']} opposition, "
          f"{stats['pass1_t14_hyphens_purged']} Task 14 hyphen purges.")

    # -------------------------------------------------------------------------
    # PASS 2: Part-of-Speech & Morphological Category Validation
    # -------------------------------------------------------------------------
    print("\n--- PASS 2: Part-of-Speech & Morphological Category Validation ---")

    for w in words:
        task = w.get("task")
        word = w.get("word", "")
        rule = w.get("rule", "")
        ctx = w.get("context", "")

        # Never classify feminine adjectives ending in -ая/-яя as деепричастия
        if task == "13":
            category = w.get("category", "")
            topic = w.get("topic", "")
            if "деепричаст" in category.lower() or "деепричаст" in topic.lower():
                if re.search(r"(?:[нлвскгхмтп]ая|[нлвскгхмтп]яя|ная|тая|лая|вая|ое|ее|ый|ий|ой|ые|ие)$", word, re.I):
                    w["category"] = "Правописание НЕ с прилагательными"
                    w["topic"] = "Правописание НЕ с прилагательными"
                    stats["pass2_categories_corrected"] += 1

        if task == "14":
            w_clean = word.replace("-", "").replace(" ", "").upper()
            if w_clean in ("ПОЭТОМУ", "ПОТОМУ", "ОТТОГО", "ЧТОБЫ", "ТАКЖЕ", "ТОЖЕ", "ЗАТО", "ПРИТОМ", "ПРИЧЕМ"):
                w["category"] = "Сочинительные и подчинительные союзы"
                w["topic"] = "Сочинительные и подчинительные союзы"
            elif w_clean in ("ВВИДУ", "ВСЛЕДСТВИЕ", "НАВСТРЕЧУ", "НАПОДОБИЕ", "ВТЕЧЕНИЕ", "ВТРОДОЛЖЕНИЕ"):
                w["category"] = "Производные предлоги"
                w["topic"] = "Производные предлоги"

    for s in sprint_questions:
        task = s.get("task")
        ans = s.get("answer", "")
        topic = s.get("topic", "")
        s_word = f"{s.get('prefix','')}{s.get('suffix','')}".replace("(", "").replace(")", "").strip()

        if task == "13" and "деепричаст" in topic.lower():
            if re.search(r"(?:[нлвскгхмтп]ая|[нлвскгхмтп]яя|ная|тая|лая|вая|ое|ее|ый|ий|ой|ые|ие)$", s_word, re.I):
                s["topic"] = "Правописание НЕ с прилагательными"
                stats["pass2_categories_corrected"] += 1

    print(f"Pass 2: {stats['pass2_categories_corrected']} false category tags corrected.")

    # -------------------------------------------------------------------------
    # PASS 3: Step-by-Step Explanation Semantic Consistency (Zero Contradictions)
    # -------------------------------------------------------------------------
    print("\n--- PASS 3: Step-by-Step Explanation Semantic Consistency ---")

    bulk_patterns = [
        r";\s*Остальные слова пишутся[^.;]*",
        r";\s*В остальных вариантах[^.;]*",
        r";\s*Остальные варианты[^.;]*",
        r";\s*В других вариантах[^.;]*",
        r";\s*Правильный ответ\s*:[^.;]*",
    ]

    def heal_expl(text: str, target: str, task: str, ans_mode: str = "") -> str:
        if not text:
            return ""
        res = clean_explanation_str(text)

        # 1. Clean bulk scraper dumps
        for bp in bulk_patterns:
            if re.search(bp, res, re.I):
                res = re.sub(bp, "", res, flags=re.I)
                stats["pass3_bulk_dumps_cleaned"] += 1

        # 2. Purge Task 14 hyphen contradictions on conjunctions
        for bw in non_hyphen_t14:
            bw_clean = bw.replace(" ", "")
            if bw_clean in target.upper() or bw_clean in res.upper():
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

        # 3. Purge Task 13 contradictions
        if task == "13":
            has_dep = bool(re.search(r"(?:причастие\s+с\s+зависимым|есть\s+зависим|наличии\s+зависимых)", res, re.I))
            has_opp = bool(re.search(r"(?:противопоставлен(?:ие|ием|ия)\s+с\s+союзом\s+«?А»?|прямым\s+противопоставлением)", res, re.I))

            if has_dep:
                res = re.sub(r";?\s*у причастия в данном предложении нет зависимых[^\n.;]*?(?=;|\.|$)", "", res, flags=re.I)
                res = re.sub(r";?\s*в данном контексте нет противопоставления с союзом «А», зависимых или усилительных слов[^\n.;]*?(?=;|\.|$)", "", res, flags=re.I)
                res = re.sub(r"поэтому с приставкой НЕ- пишется СЛИТНО\s*—\s*«[^»]+»", "поэтому пишется РАЗДЕЛЬНО", res, flags=re.I)
                res = re.sub(r"поэтому пишется СЛИТНО\s*—\s*«[^»]+»", "поэтому пишется РАЗДЕЛЬНО", res, flags=re.I)
                stats["pass3_contradictions_purged"] += 1

            if has_opp:
                res = re.sub(r";?\s*в данном контексте нет противопоставления[^\n.;]*?(?=;|\.|$)", "", res, flags=re.I)
                res = re.sub(r";?\s*в предложении нет противопоставления[^\n.;]*?(?=;|\.|$)", "", res, flags=re.I)
                res = re.sub(r"поэтому пишется СЛИТНО\s*—\s*«[^»]+»", "поэтому пишется РАЗДЕЛЬНО", res, flags=re.I)
                stats["pass3_contradictions_purged"] += 1

        # Deduplicate sentences/clauses
        parts = [p.strip() for p in re.split(r"[;.]\s*", res) if p.strip()]
        unique_parts = []
        for p in parts:
            if p not in unique_parts:
                unique_parts.append(p)
        res = "; ".join(unique_parts)
        if res and not res.endswith("."):
            res += "."
        return res

    # Apply to allWords
    for w in words:
        target = w.get("word", "")
        task = w.get("task", "")
        old_rule = w.get("rule", "")
        new_rule = heal_expl(old_rule, target, task)

        # Synchronize photo words specifically
        if "нехрустальная" in target.lower():
            w["word"] = "НЕ ХРУСТАЛЬНАЯ"
            w["missingLetter"] = "РАЗДЕЛЬНО"
            w["topic"] = "Правописание НЕ с прилагательными"
            w["category"] = "Правописание НЕ с прилагательными"
            new_rule = (
                "НЕ ХРУСТАЛЬНАЯ — относительное прилагательное с прямым противопоставлением с союзом «А» "
                "(«а из венецианского стекла»); с относительными прилагательными и при наличии противопоставления "
                "частица НЕ пишется раздельно; поэтому пишется РАЗДЕЛЬНО — «НЕ ХРУСТАЛЬНАЯ»."
            )
        elif "нерасслышанный" in target.lower() and "преподавателем" in w.get("context", ""):
            w["word"] = "НЕ РАССЛЫШАННЫЙ"
            w["missingLetter"] = "РАЗДЕЛЬНО"
            w["topic"] = "Полные причастия с зависимыми словами (раздельно)"
            w["category"] = "Полные причастия с зависимыми словами (раздельно)"
            new_rule = (
                "НЕ РАССЛЫШАННЫЙ — полное причастие с зависимым словом «преподавателем» (нерасслышанный кем?); "
                "при наличии зависимых слов частица НЕ с полным причастием пишется раздельно; "
                "поэтому пишется РАЗДЕЛЬНО — «НЕ РАССЛЫШАННЫЙ»."
            )
        elif "недождавшиеся" in target.lower() and "ужина" in w.get("context", ""):
            w["word"] = "НЕ ДОЖДАВШИЕСЯ"
            w["missingLetter"] = "РАЗДЕЛЬНО"
            w["topic"] = "Полные причастия с зависимыми словами (раздельно)"
            w["category"] = "Полные причастия с зависимыми словами (раздельно)"
            new_rule = (
                "НЕ ДОЖДАВШИЕСЯ — полное причастие с зависимым словом «ужина» (не дождавшиеся чего?); "
                "при наличии зависимых слов частица НЕ с полным причастием пишется раздельно; "
                "поэтому пишется РАЗДЕЛЬНО — «НЕ ДОЖДАВШИЕСЯ»."
            )
        elif "почему" in target.lower() and "по-чему" in target.lower():
            w["word"] = "ПОЧЕМУ"
            w["missingLetter"] = "СЛИТНО"
            w["topic"] = "Сочинительные и подчинительные союзы"
            w["category"] = "Сочинительные и подчинительные союзы"
            new_rule = "ПОЧЕМУ — вопросительно-относительное местоименное наречие (= «по какой причине»); пишется слитно; поэтому пишется СЛИТНО — «ПОЧЕМУ»."

        w["rule"] = new_rule

    # Apply to sprint
    for s in sprint_questions:
        target = f"{s.get('prefix','')}{s.get('suffix','')}".replace("(", "").replace(")", "").strip()
        task = s.get("task", "")
        old_expl = s.get("explanation", "")
        new_expl = heal_expl(old_expl, target, task)

        # Synchronize photo words in sprint
        if "хрустальная" in target.lower():
            s["answer"] = "РАЗДЕЛЬНО"
            s["topic"] = "Правописание НЕ с прилагательными"
            new_expl = (
                "НЕ ХРУСТАЛЬНАЯ — относительное прилагательное с прямым противопоставлением с союзом «А» "
                "(«а из венецианского стекла»); с относительными прилагательными и при наличии противопоставления "
                "частица НЕ пишется раздельно; поэтому пишется РАЗДЕЛЬНО — «НЕ ХРУСТАЛЬНАЯ»."
            )
            s["rule"] = new_expl
        elif "расслышанный" in target.lower() and "преподавателем" in s.get("context", ""):
            s["answer"] = "РАЗДЕЛЬНО"
            s["topic"] = "Полные причастия с зависимыми словами (раздельно)"
            new_expl = (
                "НЕ РАССЛЫШАННЫЙ — полное причастие с зависимым словом «преподавателем» (нерасслышанный кем?); "
                "при наличии зависимых слов частица НЕ с полным причастием пишется раздельно; "
                "поэтому пишется РАЗДЕЛЬНО — «НЕ РАССЛЫШАННЫЙ»."
            )
            s["rule"] = new_expl
        elif "дождавшиеся" in target.lower() and "ужина" in s.get("context", ""):
            s["answer"] = "РАЗДЕЛЬНО"
            s["topic"] = "Полные причастия с зависимыми словами (раздельно)"
            new_expl = (
                "НЕ ДОЖДАВШИЕСЯ — полное причастие с зависимым словом «ужина» (не дождавшиеся чего?); "
                "при наличии зависимых слов частица НЕ с полным причастием пишется раздельно; "
                "поэтому пишется РАЗДЕЛЬНО — «НЕ ДОЖДАВШИЕСЯ»."
            )
            s["rule"] = new_expl
        elif "инженером" in s.get("context", "").lower() and "технологом" in s.get("context", "").lower():
            s["prefix"] = "(ИНЖЕНЕРОМ)"
            s["suffix"] = "ТЕХНОЛОГОМ"
            s["answer"] = "ДЕФИСНО"
            s["topic"] = "Сложные существительные (дефис)"
            new_expl = (
                "ИНЖЕНЕРОМ-ТЕХНОЛОГОМ — сложное существительное, обозначающее специальность; "
                "пишется через дефис; поэтому пишется ЧЕРЕЗ ДЕФИС — «ИНЖЕНЕРОМ-ТЕХНОЛОГОМ»."
            )
            s["rule"] = new_expl

        s["explanation"] = new_expl
        if s.get("rule"):
            s["rule"] = new_expl

    # Apply to FIPI rows
    for q in fipi_tasks:
        task = q.get("task", "")
        for r in q.get("rows", []):
            expl = r.get("explanation", "")
            sent = r.get("words", [""])[0]
            r["explanation"] = heal_expl(expl, sent, task)

    print(f"Pass 3: Resolved {stats['pass3_contradictions_purged']} contradictions, "
          f"cleaned {stats['pass3_bulk_dumps_cleaned']} bulk scraper dumps.")

    # -------------------------------------------------------------------------
    # PASS 4: Sprint Question Option Sets & Formatting
    # -------------------------------------------------------------------------
    print("\n--- PASS 4: Sprint Question Option Sets & Formatting ---")

    words_map = {w["id"]: w for w in words}

    for s in sprint_questions:
        task = s.get("task")
        ans = s.get("answer")
        opts = s.get("options", [])
        sid = s.get("id", "")
        wid = sid.replace("sp-", "w-")

        # Standard option sets
        if task == "13":
            s["options"] = ["СЛИТНО", "РАЗДЕЛЬНО"]
            if ans not in s["options"]:
                s["answer"] = "РАЗДЕЛЬНО" if "РАЗДЕЛЬНО" in s.get("explanation", "") else "СЛИТНО"
                stats["pass4_options_fixed"] += 1
        elif task == "14":
            s["options"] = ["СЛИТНО", "ДЕФИСНО", "РАЗДЕЛЬНО"]
            # Align sprint answer with exact word spelling if word entry exists
            if wid in words_map:
                w = words_map[wid]
                w_ans = w.get("missingLetter")
                if w_ans in s["options"] and w_ans != s["answer"]:
                    # Check whether word explanation aligns
                    if ("пишется " + w_ans) in w.get("rule", ""):
                        s["answer"] = w_ans
                        s["explanation"] = w["rule"]
                        s["rule"] = w["rule"]
                        stats["pass4_sprint_sync"] += 1
            if s["answer"] not in s["options"]:
                s["answer"] = "СЛИТНО"
                stats["pass4_options_fixed"] += 1

            # Photo 4 formatting
            ctx = s.get("context", "")
            if "инженером" in ctx.lower() and "технологом" in ctx.lower():
                s["prefix"] = "(ИНЖЕНЕРОМ)"
                s["suffix"] = "ТЕХНОЛОГОМ"
                s["answer"] = "ДЕФИСНО"
                s["topic"] = "Сложные существительные (дефис)"
                s["explanation"] = (
                    "ИНЖЕНЕРОМ-ТЕХНОЛОГОМ — сложное существительное, обозначающее специальность; "
                    "пишется через дефис; поэтому пишется ЧЕРЕЗ ДЕФИС — «ИНЖЕНЕРОМ-ТЕХНОЛОГОМ»."
                )
                s["rule"] = s["explanation"]
        elif task == "15":
            s["options"] = ["Н", "НН"]
            if ans not in s["options"]:
                s["answer"] = "Н" if "одна" in s.get("explanation", "") else "НН"
                stats["pass4_options_fixed"] += 1
        elif task in ("9", "10", "11", "12"):
            if not opts or ans not in opts:
                if task == "9":
                    distractor = "О" if ans == "А" else "А" if ans == "О" else "Е" if ans == "И" else "И"
                elif task == "10":
                    distractor = "И" if ans == "Ы" else "Ы" if ans == "И" else "З" if ans == "С" else "С"
                elif task == "11":
                    distractor = "Е" if ans == "И" else "И" if ans == "Е" else "О" if ans == "А" else "А"
                else: # 12
                    distractor = "Е" if ans == "И" else "И" if ans == "Е" else "Я" if ans == "У" else "Ю"
                s["options"] = [ans, distractor]
                stats["pass4_options_fixed"] += 1

    print(f"Pass 4: {stats['pass4_options_fixed']} option sets repaired, {stats['pass4_sprint_sync']} sprint answers synced with words.")

    # -------------------------------------------------------------------------
    # PASS 5: Cross-Task FIPI Row Integrity & correctIndices Alignment
    # -------------------------------------------------------------------------
    print("\n--- PASS 5: Cross-Task FIPI Row Integrity & correctIndices Alignment ---")

    for q in fipi_tasks:
        task = q.get("task")
        rule_text = q.get("rule", "")
        rows = q.get("rows", [])

        if task in ("9", "10", "11", "12"):
            derived = [i + 1 for i, r in enumerate(rows) if r.get("isCorrectRow")]
            if derived != q.get("correctIndices"):
                q["correctIndices"] = derived
                stats["pass5_fipi_indices_realigned"] += 1

        elif task == "13":
            target_mode = "РАЗДЕЛЬНО" if "РАЗДЕЛЬНО" in rule_text.upper() else "СЛИТНО"
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
                "ДЕФИСНО" if "ДЕФИС" in rule_text.upper() else
                "РАЗДЕЛЬНО" if "РАЗДЕЛЬНО" in rule_text.upper() else
                "СЛИТНО"
            )
            corr_indices = []
            for r_idx, r in enumerate(rows):
                expl = r.get("explanation", "")
                sent = r.get("words", [""])[0]
                solved = r.get("solvedWords", [""])[0]

                # If explanation clearly marks both words or if row letter matches
                row_letter = r.get("letter", "")
                is_corr = (row_letter == target_mode)
                r["isCorrectRow"] = is_corr
                if is_corr:
                    corr_indices.append(r_idx + 1)
            q["correctIndices"] = corr_indices
            stats["pass5_fipi_indices_realigned"] += 1

        elif task == "15":
            # Fix specific tasks where rows had letter=Н instead of НН
            if q.get("id") in ("fipi-15-neofamily-15-49972", "fipi-15-neofamily-15-29688"):
                for r in rows:
                    r["letter"] = "НН"

            # Check homogeneous answer letter from correctIndices
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

    # -------------------------------------------------------------------------
    # SYNCHRONIZE STARTER BANK
    # -------------------------------------------------------------------------
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

    starter_bank["words"] = starter_words
    starter_bank["fipi"] = starter_fipi
    starter_bank["sprint"] = starter_sprint

    # -------------------------------------------------------------------------
    # WRITE ALL FILES
    # -------------------------------------------------------------------------
    print("\nWriting healed databases to workspace and public directories...")

    # 1. Workspace src/data
    with open(src_words_path, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=2)
    with open(src_fipi_path, "w", encoding="utf-8") as f:
        json.dump(fipi_tasks, f, ensure_ascii=False, indent=2)
    with open(src_sprint_path, "w", encoding="utf-8") as f:
        json.dump(sprint_questions, f, ensure_ascii=False, indent=2)
    with open(src_starter_path, "w", encoding="utf-8") as f:
        json.dump(starter_bank, f, ensure_ascii=False, indent=2)

    # 2. Workspace public/data
    pub_words_path = os.path.join(WORKSPACE_DIR, "public/data/allWordsBank9_15.json")
    pub_fipi_path = os.path.join(WORKSPACE_DIR, "public/data/fipiTasksBank9_15.json")
    pub_sprint_path = os.path.join(WORKSPACE_DIR, "public/data/sprintBank9_15.json")
    os.makedirs(os.path.dirname(pub_words_path), exist_ok=True)

    with open(pub_words_path, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False)
    with open(pub_fipi_path, "w", encoding="utf-8") as f:
        json.dump(fipi_tasks, f, ensure_ascii=False)
    with open(pub_sprint_path, "w", encoding="utf-8") as f:
        json.dump(sprint_questions, f, ensure_ascii=False)

    # 3. Cloned repo at REPO_DIR
    if os.path.exists(REPO_DIR):
        print(f"Writing to cloned repo at {REPO_DIR}...")
        repo_src_starter = os.path.join(REPO_DIR, "src/data/starterBank.json")
        repo_pub_words = os.path.join(REPO_DIR, "public/data/allWordsBank9_15.json")
        repo_pub_fipi = os.path.join(REPO_DIR, "public/data/fipiTasksBank9_15.json")
        repo_pub_sprint = os.path.join(REPO_DIR, "public/data/sprintBank9_15.json")
        repo_src_words = os.path.join(REPO_DIR, "src/data/allWordsBank9_15.json")
        repo_src_fipi = os.path.join(REPO_DIR, "src/data/fipiTasksBank9_15.json")
        repo_src_sprint = os.path.join(REPO_DIR, "src/data/sprintBank9_15.json")

        os.makedirs(os.path.dirname(repo_pub_words), exist_ok=True)
        os.makedirs(os.path.dirname(repo_src_words), exist_ok=True)

        with open(repo_src_starter, "w", encoding="utf-8") as f:
            json.dump(starter_bank, f, ensure_ascii=False, indent=2)
        with open(repo_pub_words, "w", encoding="utf-8") as f:
            json.dump(words, f, ensure_ascii=False)
        with open(repo_pub_fipi, "w", encoding="utf-8") as f:
            json.dump(fipi_tasks, f, ensure_ascii=False)
        with open(repo_pub_sprint, "w", encoding="utf-8") as f:
            json.dump(sprint_questions, f, ensure_ascii=False)
        with open(repo_src_words, "w", encoding="utf-8") as f:
            json.dump(words, f, ensure_ascii=False)
        with open(repo_src_fipi, "w", encoding="utf-8") as f:
            json.dump(fipi_tasks, f, ensure_ascii=False)
        with open(repo_src_sprint, "w", encoding="utf-8") as f:
            json.dump(sprint_questions, f, ensure_ascii=False)

    print("\n" + "=" * 70)
    print("5-PASS AUDIT & HEALING COMPLETED SUCCESSFULLY!")
    print(json.dumps(stats, indent=2))
    print("=" * 70)

if __name__ == "__main__":
    main()
