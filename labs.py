# -*- coding: utf-8 -*-
"""
Leitor dos arquivos de Laboratório: bancos/labs/<id-da-matéria>.lab

Formato (texto puro, o código fica escrito do jeito normal, sem escapar nada):

    === banco loja                 ← banco SQL reutilizável (o conteúdo é o script)
    CREATE TABLE ...;

    === lab id-unico               ← começa um exercício
    tipo: prever                   ← explorar | prever | desafio | parsons | passo
    tema: Paradigma Imperativo     ← mesmo nome de tema dos resumos/questões
    nivel: 1                       ← 1 a 3
    linguagem: js                  ← js | python | prolog | sql | web | texto | java
    titulo: Soma com estado mutável
    (outros cabeçalhos opcionais: banco, alvo, ordem, verificar, resposta, erro)

    --- enunciado                  ← seções: tudo até a próxima seção vira o texto
    ...
    --- codigo
    ...

Linhas começando com # logo antes de um "===" (entre blocos) são comentários.
Seções reconhecidas: enunciado, codigo, solucao, explicacao, pergunta, opcoes,
experimentos, dicas, testes, regras, linhas, distratores, consultas.
Listas (opcoes, experimentos, consultas) usam "- item"; linhas seguintes sem
"- " continuam o item anterior. Dicas são separadas por linha em branco.

Testes, uma linha cada:
    js / python : EXPRESSAO ==> ESPERADO
    prolog      : consulta(X). ==> X = a | X = b      (ou ==> true / ==> false)
    web         : [@375] descrição :: expressão JS verdadeira no preview
Regras (desafio):
    proibido: REGEX :: mensagem
    exigido: REGEX :: mensagem
"""
import os
import re

TIPOS = ("explorar", "prever", "desafio", "parsons", "passo")
LINGUAGENS = ("js", "python", "prolog", "sql", "web", "texto", "java")
SECOES = ("enunciado", "codigo", "solucao", "explicacao", "pergunta", "opcoes",
          "experimentos", "dicas", "testes", "regras", "linhas", "distratores",
          "consultas")
CABECALHOS = ("tipo", "tema", "nivel", "linguagem", "titulo", "banco", "alvo",
              "ordem", "verificar", "resposta", "erro", "pergunta")
LISTAS = ("opcoes", "experimentos", "consultas")
EXECUTAVEIS = ("js", "python", "prolog", "sql", "web")


def _apara(linhas):
    """Tira linhas em branco das pontas sem mexer na indentação do conteúdo."""
    while linhas and not linhas[0].strip():
        linhas = linhas[1:]
    while linhas and not linhas[-1].strip():
        linhas = linhas[:-1]
    return [l.rstrip() for l in linhas]


def _lista(linhas):
    itens = []
    for l in linhas:
        if l.startswith("- "):
            itens.append(l[2:])
        elif itens:
            itens[-1] += "\n" + l
        elif l.strip():
            itens.append(l)
    return [i.rstrip() for i in itens]


def _paragrafos(linhas):
    blocos, atual = [], []
    for l in linhas:
        if l.strip():
            atual.append(l.strip())
        elif atual:
            blocos.append(" ".join(atual))
            atual = []
    if atual:
        blocos.append(" ".join(atual))
    return blocos


def _testes(linhas, linguagem, avisar):
    saida = []
    for l in linhas:
        if not l.strip():
            continue
        if linguagem == "web":
            largura = None
            m = re.match(r"^@(\d+)\s+(.*)$", l.strip())
            texto = m.group(2) if m else l.strip()
            if m:
                largura = int(m.group(1))
            if "::" not in texto:
                avisar("teste web sem '::' → %s" % l.strip())
                continue
            nome, corpo = texto.split("::", 1)
            saida.append({"nome": nome.strip(), "corpo": corpo.strip(), "largura": largura})
            continue
        if "==>" not in l:
            avisar("teste sem '==>' → %s" % l.strip())
            continue
        expr, esperado = l.rsplit("==>", 1)
        if linguagem == "prolog":
            respostas = [r.strip() for r in esperado.split("|") if r.strip()]
            saida.append({"consulta": expr.strip(), "respostas": respostas})
        else:
            saida.append({"expr": expr.strip(), "esperado": esperado.strip()})
    return saida


def _regras(linhas, avisar):
    saida = []
    for l in linhas:
        if not l.strip():
            continue
        m = re.match(r"^(proibido|exigido):\s*(.+?)\s*::\s*(.+)$", l.strip())
        if not m:
            avisar("regra mal escrita → %s" % l.strip())
            continue
        try:
            re.compile(m.group(2))
        except re.error as e:
            avisar("regex inválida (%s) → %s" % (e, m.group(2)))
            continue
        saida.append({"tipo": m.group(1), "regex": m.group(2), "msg": m.group(3)})
    return saida


def ler_labs(caminho, avisos):
    """Devolve (labs, bancos). Problemas de autoria vão para a lista avisos."""
    if not os.path.exists(caminho):
        return [], {}
    with open(caminho, encoding="utf-8") as f:
        texto = f.read().replace("\r\n", "\n")
    arquivo = os.path.basename(caminho)

    blocos = []
    atual = None
    secao = None
    buf = []

    def fecha(fim_de_bloco=False):
        if atual is not None and secao is not None:
            linhas = list(buf)
            if fim_de_bloco:
                # comentários "# ..." entre um bloco e o próximo não pertencem
                # à última seção do bloco anterior
                while linhas and (not linhas[-1].strip() or linhas[-1].startswith("#")):
                    linhas.pop()
            atual["_sec"][secao] = linhas

    for n, linha in enumerate(texto.split("\n"), 1):
        m = re.match(r"^=== (lab|banco)\s+(\S+)\s*$", linha)
        if m:
            fecha(True)
            atual = {"_tipo": m.group(1), "id": m.group(2), "_linha": n, "_sec": {}, "_hdr": {}}
            blocos.append(atual)
            secao = "sql" if m.group(1) == "banco" else None
            buf = []
            continue
        m = re.match(r"^--- (\w+)\s*$", linha)
        if m and atual is not None and atual["_tipo"] == "lab":
            fecha()
            secao = m.group(1)
            buf = []
            if secao not in SECOES:
                avisos.append("%s:%d seção desconhecida '%s'" % (arquivo, n, secao))
            continue
        if atual is None:
            continue
        if secao is None:
            if not linha.strip():
                continue
            m = re.match(r"^(\w+):\s*(.*)$", linha)
            if not m or m.group(1) not in CABECALHOS:
                avisos.append("%s:%d cabeçalho inválido: %s" % (arquivo, n, linha.strip()))
                continue
            atual["_hdr"][m.group(1)] = m.group(2).strip()
            continue
        buf.append(linha)
    fecha(True)

    bancos = {}
    labs = []
    vistos = set()
    for b in blocos:
        if b["_tipo"] == "banco":
            bancos[b["id"]] = "\n".join(_apara(b["_sec"].get("sql", [])))
            continue

        def avisar(msg, b=b):
            avisos.append("%s:%d lab '%s': %s" % (arquivo, b["_linha"], b["id"], msg))

        if b["id"] in vistos:
            avisar("id repetido")
            continue
        vistos.add(b["id"])

        h, s = b["_hdr"], b["_sec"]
        lab = {"id": b["id"]}
        lab["tipo"] = h.get("tipo", "explorar")
        lab["tema"] = h.get("tema", "Geral")
        lab["linguagem"] = h.get("linguagem", "js")
        lab["titulo"] = h.get("titulo", b["id"])
        try:
            lab["nivel"] = max(1, min(3, int(h.get("nivel", "1"))))
        except ValueError:
            lab["nivel"] = 1
            avisar("nivel precisa ser 1, 2 ou 3")
        for k in ("banco", "alvo", "verificar", "resposta", "pergunta"):
            if h.get(k):
                lab[k] = h[k]
        lab["ordem"] = h.get("ordem", "").lower() in ("sim", "s", "true", "1")
        lab["erro"] = h.get("erro", "").lower() in ("sim", "s", "true", "1")

        for k in ("enunciado", "explicacao", "pergunta"):
            if k in s:
                lab[k] = "\n".join(_apara(s[k]))
        for k in ("codigo", "solucao"):
            if k in s:
                lab[k] = "\n".join(_apara(s[k]))
        for k in LISTAS:
            if k in s:
                lab[k] = _lista(_apara(s[k]))
        if "dicas" in s:
            lab["dicas"] = _paragrafos(s["dicas"])
        if "testes" in s:
            lab["testes"] = _testes(_apara(s["testes"]), lab["linguagem"], avisar)
        if "regras" in s:
            lab["regras"] = _regras(_apara(s["regras"]), avisar)
        if "linhas" in s:
            lab["linhas"] = _apara(s["linhas"])
        if "distratores" in s:
            lab["distratores"] = [l for l in _apara(s["distratores"]) if l.strip()]

        # ---- conferência de autoria: pega o erro aqui, não na frente do aluno
        if lab["tipo"] not in TIPOS:
            avisar("tipo '%s' não existe (use %s)" % (lab["tipo"], ", ".join(TIPOS)))
            continue
        if lab["linguagem"] not in LINGUAGENS:
            avisar("linguagem '%s' não existe (use %s)" % (lab["linguagem"], ", ".join(LINGUAGENS)))
            continue
        if not lab.get("enunciado"):
            avisar("falta a seção enunciado")
        if lab["tipo"] == "parsons":
            if not lab.get("linhas"):
                avisar("parsons precisa da seção linhas")
                continue
        elif not lab.get("codigo") and lab["tipo"] != "desafio":
            avisar("falta a seção codigo")
            continue
        if lab["tipo"] != "parsons" and lab["linguagem"] not in EXECUTAVEIS:
            avisar("tipo %s precisa de linguagem executável" % lab["tipo"])
            continue
        if lab["tipo"] == "desafio":
            if not lab.get("solucao"):
                avisar("desafio precisa da seção solucao")
            if lab["linguagem"] != "sql" and not lab.get("testes"):
                avisar("desafio precisa de testes")
            lab.setdefault("codigo", "")
        if lab["tipo"] == "passo" and lab["linguagem"] != "js":
            avisar("passo a passo só funciona com linguagem js")
            continue
        if lab["linguagem"] == "sql" and lab.get("banco") and lab["banco"] not in [x["id"] for x in blocos if x["_tipo"] == "banco"]:
            avisar("banco '%s' não foi definido com '=== banco'" % lab["banco"])
        if lab["linguagem"] == "prolog" and lab["tipo"] != "parsons" and not lab.get("consultas") and not lab.get("testes"):
            avisar("lab Prolog sem consultas")
        if lab.get("pergunta") and lab["tipo"] == "passo" and not lab.get("resposta"):
            avisar("pergunta de passo a passo precisa do cabeçalho resposta")
        labs.append(lab)
    return labs, bancos
