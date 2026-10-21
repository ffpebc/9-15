# -*- coding: utf-8 -*-
"""
Comprehensive Russian ЕГЭ 9-13 database generator.
Generates 5050+ unique, distinct questions with ZERO duplicates.
"""
import json
import re
import os
import sys

BALANCED_BTN_PATTERN = [0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1]

def order_options(base_opts, answer, seq_idx):
    if base_opts[0] == "СЛИТНО" or base_opts[1] == "СЛИТНО":
        return ["СЛИТНО", "РАЗДЕЛЬНО"]
    other = base_opts[1] if base_opts[0] == answer else base_opts[0]
    target_idx = BALANCED_BTN_PATTERN[seq_idx % len(BALANCED_BTN_PATTERN)]
    return [answer, other] if target_idx == 0 else [other, answer]

def determine_options(task, letter, prefix="", suffix=""):
    letter = letter.upper().strip()
    clean_p = re.sub(r"[́()`']", "", prefix).lower()
    clean_s = re.sub(r"[́()`']", "", suffix).lower()

    if task == "13" or letter in ("СЛИТНО", "РАЗДЕЛЬНО"):
        return ["СЛИТНО", "РАЗДЕЛЬНО"]

    if task == "10":
        if letter in ("Ъ", "Ь"):
            return ["Ъ", "Ь"]
        if letter == "Ы":
            return ["Ы", "И"]
        if letter == "И":
            if clean_p.endswith("пр") or clean_p.endswith("н"):
                return ["Е", "И"]
            return ["Ы", "И"]
        if letter in ("ПРЕ", "ПРИ", "Е"):
            return ["Е", "И"]
        if letter in ("З", "С"):
            return ["З", "С"]
        if letter in ("О", "А"):
            return ["О", "А"]
        if letter in ("Д", "Т"):
            return ["Д", "Т"]
        return ["Е", "И"]

    if task == "12":
        if clean_s.startswith("н"):
            if letter == "А":
                return ["А", "Е"]
            if letter == "Я":
                return ["Я", "Е"]
            if letter in ("Е", "Ё"):
                if clean_p and clean_p[-1] in "жшчщ":
                    return ["Е", "А"]
                if clean_p and clean_p[-1] in "аеёиоуыэюя":
                    return ["Е", "Я"]
                return ["Е", "И"]
        if clean_s.startswith(("вш", "ш", "л")):
            if letter == "А":
                return ["А", "Е"]
            if letter == "Я":
                return ["Я", "Е"]
            if letter in ("Е", "И"):
                return ["Е", "И"]
            if letter == "У":
                return ["У", "А"]
            if letter == "Ю":
                return ["Ю", "Я"]
        if letter in ("У", "А"):
            return ["У", "А"]
        if letter in ("Ю", "Я"):
            return ["Ю", "Я"]
        if letter in ("Е", "И", "Ё"):
            return ["Е", "И"]
        return ["Е", "И"]

    if task == "11":
        if letter in ("С", "—"):
            return ["С", "—"]
        if letter in ("Ч", "Щ"):
            return ["Ч", "Щ"]
        if clean_s.startswith("ва"):
            if letter in ("О", "Ы"):
                return ["О", "Ы"]
            if letter in ("Е", "И"):
                return ["Е", "И"]
            if letter == "Я":
                return ["Я", "Е"]
        if clean_s == "":
            if letter in ("О", "А"):
                return ["А", "О"]
            if letter in ("Е", "И"):
                return ["Е", "И"]
        if clean_p and clean_p[-1] in "жшчщц":
            if clean_s.startswith("в") and letter in ("О", "Е"):
                return ["О", "Е"]
            if letter in ("А", "Е"):
                return ["А", "Е"]
            if letter in ("Ё", "О"):
                return ["Ё", "О"]
        if letter in ("И", "Е"):
            return ["И", "Е"]
        if letter in ("Ы", "О"):
            if clean_s.startswith("ва") or letter == "Ы":
                return ["О", "Ы"]
            return ["А", "О"]
        if letter == "А":
            if clean_s.startswith(("н", "л", "т")):
                return ["А", "Е"]
            return ["А", "О"]
        if letter == "Я":
            return ["Я", "Е"]
        if letter == "Ё":
            return ["Ё", "О"]
        return ["И", "Е"]

    if letter in ("А", "О"):
        return ["А", "О"]
    if letter in ("И", "Е"):
        return ["И", "Е"]
    if letter in ("У", "Ю"):
        return ["У", "Ю"]
    if letter in ("Я", "Е"):
        return ["Я", "Е"]
    if letter in ("Ы", "И"):
        return ["Ы", "И"]
    if letter in ("Ё", "О"):
        return ["Ё", "О"]
    return ["А", "О"]

def normalize_key(task, prefix, suffix):
    p = re.sub(r"[́()`']", "", prefix).strip().lower()
    s = re.sub(r"[́()`']", "", suffix).strip().lower()
    return f"{task}:{p}..{s}"

with open("src/data/tasksBank2026_2027.json", "r", encoding="utf-8") as f:
    bank_data = json.load(f)

existing_sprint = bank_data.get("sprintQuestions", [])
existing_fipi = bank_data.get("fipiQuestions", [])

seen_keys = set()
sprint_by_task = {"9": [], "10": [], "11": [], "12": [], "13": []}

for sq in existing_sprint:
    key = normalize_key(sq["task"], sq["prefix"], sq["suffix"])
    if key not in seen_keys:
        seen_keys.add(key)
        base_opts = determine_options(sq["task"], sq["answer"], sq["prefix"], sq["suffix"])
        sq["options"] = order_options(base_opts, sq["answer"], len(seen_keys))
        sprint_by_task[sq["task"]].append(sq)

print("Starting generation of comprehensive additional words...")
