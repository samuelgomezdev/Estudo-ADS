# -*- coding: utf-8 -*-
"""
CORREÇÃO NC-01 — redistribui a posição da alternativa correta.

Problema: 64% dos gabaritos estavam na letra B, contra 25% esperados. Chutando B
o aluno acertava dois terços da prova, e o critério de 80% do tutor deixava de
medir aprendizado.

O que este script faz: para cada matéria, sorteia um alvo balanceado (A, B, C, D
em rodízio embaralhado) e move a alternativa correta para essa posição, mantendo
a ordem relativa das demais. Nada do texto é alterado — só a ordem.

O que ele NÃO mexe (e por quê):
  · questões de 2 alternativas (Verdadeiro/Falso) — a ordem é convenção
  · opções todas numéricas em ordem crescente/decrescente — a ordem é informação
  · questões cujo enunciado ou explicação citam uma letra ("a alternativa B")
  · questões com opção do tipo "todas as anteriores" / "ambas A e B"

Uso:  python redistribui_gabarito.py [--conferir]
      --conferir apenas mede a distribuição, sem escrever nada.
"""
import json, glob, os, re, random, sys, collections

AQUI = os.path.dirname(os.path.abspath(__file__))
BANCOS = os.path.join(os.path.dirname(AQUI), "bancos")
SEMENTE = 20260912          # fixo: rodar de novo dá o mesmo resultado
LIMITE = 0.32               # nenhuma letra pode passar disso

REF_POSICAO = re.compile(
    r"\b(todas|nenhuma)\s+(as|das)\s+(alternativas|anteriores|acima)"
    r"|\bambas\b|\bas\s+duas\s+anteriores\b"
    r"|\balternativas?\s+[A-Da-d]\b|\bletras?\s+[A-Da-d]\b|\bop[çc][ãa]o\s+[A-Da-d]\b"
    r"|\b[A-D]\s+e\s+[A-D]\s+est[ãa]o\b"
    r"|\b(o|a)\s+(primeir[oa]|segund[oa]|terceir[oa]|quart[oa]|[úu]ltim[oa])\s+"
    r"(formato|item|op[çc][ãa]o|alternativa)\b", re.I)


def so_numeros(ops):
    vals = []
    for o in ops:
        m = re.fullmatch(r"\s*(\d+(?:[.,]\d+)?)\s*\w{0,6}\s*", o)
        if not m:
            return None
        vals.append(float(m.group(1).replace(",", ".")))
    return vals


def elegivel(q):
    ops = q.get("op", [])
    if len(ops) != 4:
        return False, "não tem 4 alternativas"
    texto = " ".join(ops) + " " + q.get("q", "") + " " + (q.get("exp") or "")
    if REF_POSICAO.search(texto):
        return False, "cita posição/letra"
    v = so_numeros(ops)
    if v and (v == sorted(v) or v == sorted(v, reverse=True)):
        return False, "opções numéricas ordenadas"
    return True, ""


def distribuicao(qs):
    d = collections.Counter(q["r"] for q in qs if len(q["op"]) == 4)
    n = sum(d.values()) or 1
    return [d.get(i, 0) for i in range(4)], n


def main():
    conferir = "--conferir" in sys.argv
    rnd = random.Random(SEMENTE)
    geral_antes, geral_depois = collections.Counter(), collections.Counter()
    pulos = collections.Counter()
    linhas = []

    for caminho in sorted(glob.glob(os.path.join(BANCOS, "*.json"))):
        banco = json.load(open(caminho, encoding="utf-8"))
        qs = banco.get("questoes", [])
        if not qs:
            continue
        antes, n_antes = distribuicao(qs)
        geral_antes.update({i: antes[i] for i in range(4)})

        if not conferir:
            elegiveis, fixas = [], collections.Counter()
            for q in qs:
                ok, motivo = elegivel(q)
                if ok:
                    elegiveis.append(q)
                else:
                    pulos[motivo] += 1
                    if len(q["op"]) == 4:
                        fixas[q["r"]] += 1   # gabarito que não pode ser movido

            # Distribui compensando o que as questões intocáveis já ocupam:
            # a cada rodada escolhe a letra mais atrasada em relação ao ideal.
            total = len(elegiveis) + sum(fixas.values())
            conta = collections.Counter(fixas)
            alvos = []
            for _ in elegiveis:
                ideal = (sum(conta.values()) + 1) / 4.0
                letra = min(range(4), key=lambda i: (conta[i] - ideal, rnd.random()))
                alvos.append(letra)
                conta[letra] += 1
            rnd.shuffle(alvos)
            for q, alvo in zip(elegiveis, alvos):
                certa = q["op"][q["r"]]
                resto = [o for i, o in enumerate(q["op"]) if i != q["r"]]
                q["op"] = resto[:alvo] + [certa] + resto[alvo:]
                q["r"] = alvo
                assert q["op"][q["r"]] == certa

            json.dump(banco, open(caminho, "w", encoding="utf-8"),
                      ensure_ascii=False, indent=1)

        depois, n_depois = distribuicao(qs)
        geral_depois.update({i: depois[i] for i in range(4)})
        pior = max(depois) / n_depois
        linhas.append((os.path.basename(caminho)[:-5], antes, n_antes, depois, n_depois, pior))

    print("%-28s %-22s %-22s %s" % ("BANCO", "ANTES  A/B/C/D", "DEPOIS A/B/C/D", "pior letra"))
    print("-" * 86)
    falhou = []
    for nome, a, na, d, nd, pior in linhas:
        marca = "  FALHA" if pior > LIMITE else ""
        if pior > LIMITE:
            falhou.append(nome)
        print("%-28s %-22s %-22s %5.0f%%%s" % (
            nome[:28], "%d/%d/%d/%d" % tuple(a), "%d/%d/%d/%d" % tuple(d), pior * 100, marca))

    t = sum(geral_depois.values()) or 1
    ta = sum(geral_antes.values()) or 1
    print("-" * 86)
    print("GERAL antes : " + "  ".join("%s=%d (%.0f%%)" % ("ABCD"[i], geral_antes[i], geral_antes[i] / ta * 100) for i in range(4)))
    print("GERAL depois: " + "  ".join("%s=%d (%.0f%%)" % ("ABCD"[i], geral_depois[i], geral_depois[i] / t * 100) for i in range(4)))

    if pulos:
        print("\nQuestões preservadas de propósito:")
        for motivo, n in pulos.most_common():
            print("   %-34s %d" % (motivo, n))

    print()
    if falhou:
        print("CRITÉRIO NÃO ATENDIDO — acima de %.0f%% em: %s" % (LIMITE * 100, ", ".join(falhou)))
        return 1
    print("CRITÉRIO ATENDIDO: nenhuma letra passa de %.0f%% em nenhuma matéria." % (LIMITE * 100))
    return 0


if __name__ == "__main__":
    sys.exit(main())
