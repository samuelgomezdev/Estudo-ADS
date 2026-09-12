# -*- coding: utf-8 -*-
"""Normaliza os bancos de questoes existentes para um formato unico."""
import json, re, os, subprocess

BASE = os.environ.get("BASE_DIR") or os.path.expanduser("~/mnt/Univali")
OUT = os.environ.get("OUT_DIR") or os.path.join(BASE, "Estudo-ADS", "bancos")
os.makedirs(OUT, exist_ok=True)


def read(p):
    with open(p, encoding="utf-8", errors="replace") as f:
        return f.read()


def js_array_after(text, marker):
    i = text.index(marker) + len(marker)
    i = text.index("[", i)
    depth, in_str, esc, j = 0, None, False, i
    while j < len(text):
        ch = text[j]
        if in_str:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == in_str: in_str = None
        else:
            if ch in "\"'": in_str = ch
            elif ch == "[": depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    return text[i:j + 1]
        j += 1
    raise ValueError("array nao fechado: " + marker)


# CORREÇÃO NC-02 -------------------------------------------------------------
# A versão antiga apagava TODO <...>. Nos dois bancos de origem, porém, os campos
# de questão e de flashcard usam < > como CONTEÚDO — <article>, <main>, <div>,
# <Context> são as próprias alternativas. Só o mapa mental do Prova-Sabado usa
# marcação de verdade (<strong>). Daí a separação abaixo.
#   texto(...)    → nada é removido; apenas entidades são decodificadas
#   formatado(...) → remove a marcação, usado só nos "pontos" do mapa mental
ENTIDADES = (("&lt;", "<"), ("&gt;", ">"), ("&amp;", "&"), ("&quot;", '"'),
             ("&nbsp;", " "), ("&#39;", "'"))


def texto(s):
    s = s or ""
    for a, b in ENTIDADES:
        s = s.replace(a, b)
    return re.sub(r"[ \t]+", " ", s).strip()


def formatado(s):
    s = re.sub(r"<br\s*/?>", " ", s or "", flags=re.I)
    s = re.sub(r"</?(br|b|strong|i|em|u|small|span|p|code|ul|ol|li|sup|sub|mark)"
               r"(\s[^<>]*)?/?>", "", s, flags=re.I)
    return texto(s)


strip_html = texto   # compatibilidade com o restante do script


def node_eval(script, *args):
    return json.loads(subprocess.check_output(["node", "-e", script, *args]).decode("utf-8"))


materias = {}


def add(mid, nome, periodo, cor, sigla):
    materias[mid] = {"id": mid, "nome": nome, "periodo": periodo, "cor": cor, "sigla": sigla,
                     "flashcards": [], "questoes": [], "discursivas": [], "colas": []}


add("software-design", "Software Design", 3, "#8b5cf6", "SD")
add("responsive-web", "Responsive Web Development", 3, "#06b6d4", "RWD")
add("database-design", "Database Design for Apps", 3, "#2563eb", "DDA")
add("data-persistence", "Programming and Data Persistence", 3, "#f59e0b", "PDP")

# ------------------------------------------------------- fonte 1: estudar.html
SRC1 = os.environ.get("SRC1") or os.path.join(BASE, "Tutor Claudio",
                    "Tutor Adaptativo — Análise e Desenvolvimento de Sistemas (UNIVALI)", "estudar.html")
t1 = read(SRC1)
fc1 = json.loads(js_array_after(t1, "const flashcards"))
q1 = json.loads(js_array_after(t1, "const allQuestions"))
MAP1 = {"Software Design": "software-design", "Responsive Web": "responsive-web"}

for c in fc1:
    materias[MAP1[c["d"]]]["flashcards"].append(
        {"tema": re.sub(r"^UA\d+\s*·\s*", "", c["tag"]), "p": strip_html(c["q"]), "r": strip_html(c["a"])})

for q in q1:
    materias[MAP1[q["d"]]]["questoes"].append(
        {"tema": "Geral", "q": strip_html(q["text"]), "op": [strip_html(o) for o in q["opts"]],
         "r": q["c"], "exp": strip_html(q.get("exp", ""))})

# as questoes seguem a mesma ordem das UAs dos flashcards: distribui os temas
for mid in ("software-design", "responsive-web"):
    temas = []
    for c in fc1:
        if MAP1[c["d"]] == mid:
            t = re.sub(r"^UA\d+\s*·\s*", "", c["tag"])
            if t not in temas:
                temas.append(t)
    qs = materias[mid]["questoes"]
    n = max(len(qs), 1)
    for i, q in enumerate(qs):
        q["tema"] = temas[min(i * len(temas) // n, len(temas) - 1)]

# ------------------------------------------------------- fonte 2: Prova-Sabado
SRC2 = os.path.join(BASE, "Prova-Sabado", "data.js")
NODE2 = ("const fs=require('fs');global.window={};"
         "eval(fs.readFileSync(process.argv[1],'utf8'));"
         "process.stdout.write(JSON.stringify({bank:window.QUESTION_BANK,mapa:window.MAPA_MENTAL}));")
d2 = node_eval(NODE2, SRC2)
MAP2 = {"dda": "database-design", "pdp": "data-persistence"}

for k, v in (d2.get("bank") or {}).items():
    mid = MAP2[k]
    for p in v.get("perguntas", []):
        tema = p.get("topico", "Geral")
        if p.get("tipo") == "disc" or not p.get("op"):
            if p.get("a"):
                materias[mid]["discursivas"].append(
                    {"tema": tema, "q": strip_html(p["q"]), "r": strip_html(p["a"])})
            continue
        materias[mid]["questoes"].append(
            {"tema": tema, "q": strip_html(p["q"]), "op": [strip_html(o) for o in p["op"]],
             "r": p.get("r", 0), "exp": strip_html(p.get("exp", ""))})

for k, v in (d2.get("mapa") or {}).items():
    mid = MAP2[k]
    for c in v:
        materias[mid]["colas"].append(
            {"titulo": formatado(c.get("titulo", "")),
             "mnemonico": formatado(c.get("mnemonico", "")),
             "pontos": [formatado(x) for x in c.get("pontos", [])]})

# ------------------------------------------------- fonte 3: RWD estudo-prova
SRC3 = os.path.join(BASE, "Responsive Web Development", "estudo-prova.html")
fc3, q3 = [], []
if os.path.exists(SRC3):
    t3 = read(SRC3)
    ev = "process.stdout.write(JSON.stringify(eval(process.argv[1])))"
    fc3 = node_eval(ev, js_array_after(t3, "const flashcards"))
    q3 = node_eval(ev, js_array_after(t3, "const questions"))
else:
    print("[aviso] estudo-prova.html do RWD nao encontrado — seguindo sem ele")

vf = {c["p"].lower() for c in materias["responsive-web"]["flashcards"]}
vq = {q["q"].lower() for q in materias["responsive-web"]["questoes"]}
for c in fc3:
    p = strip_html(c["q"])
    if p.lower() in vf:
        continue
    vf.add(p.lower())
    materias["responsive-web"]["flashcards"].append({"tema": c.get("tag", "Geral"), "p": p, "r": strip_html(c["a"])})
for q in q3:
    p = strip_html(q["q"])
    if p.lower() in vq:
        continue
    vq.add(p.lower())
    materias["responsive-web"]["questoes"].append(
        {"tema": q.get("tag", "Geral"), "q": p, "op": [strip_html(o) for o in q["opts"]],
         "r": q["ans"], "exp": strip_html(q.get("exp", ""))})

# ------------------------------------------------------------------- saida
for mid, m in materias.items():
    with open(os.path.join(OUT, mid + ".json"), "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=1)
    temas = sorted({q["tema"] for q in m["questoes"]})
    print("%-18s fc=%3d  mc=%3d  disc=%3d  colas=%2d  temas=%2d"
          % (mid, len(m["flashcards"]), len(m["questoes"]), len(m["discursivas"]), len(m["colas"]), len(temas)))
    print("       ", " | ".join(temas))
