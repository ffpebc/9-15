# -*- coding: utf-8 -*-
import json
import re
import os
import sys

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

print("Loaded determine_options helper")
