# -*- coding: utf-8 -*-
"""
CORREÇÃO NC-08/NC-09 — reclassifica os temas de Software Design e Responsive Web.

Problema: na importação desses dois bancos as questões vinham sem tema, e o
extract.py atribuiu um rótulo por POSIÇÃO na lista, não por conteúdo. O filtro
por tema e o painel "desempenho por tema" mostravam informação errada — dava
para achar que ia mal em "MER" quando a questão era de tipo de dado SQL. Como
efeito colateral, os 16 temas de cada matéria ficavam com 1 ou 2 questões, e o
critério do tutor (4 acertos em 5) não podia ser aplicado em nenhum deles.

O que este script faz: atribui a cada questão e a cada flashcard o tema que
corresponde ao seu conteúdo, consolidando os 16 rótulos em blocos com no mínimo
5 questões. A classificação é por índice porque foi feita lendo uma a uma — os
índices abaixo valem para os bancos como saíram do extract.py.

Uso:  python reclassifica_temas.py [--conferir]
"""
import json, os, sys, collections

AQUI = os.path.dirname(os.path.abspath(__file__))
BANCOS = os.path.join(os.path.dirname(AQUI), "bancos")
MINIMO = 5

PLANO = {
    "software-design": {
        "Arquitetura, SOA e serviços web": {
            "questoes": [0, 1, 6, 7, 8, 9, 10],
            "flashcards": [0, 1, 2, 3, 8, 10, 11, 12, 13],
        },
        "Processo de projeto, requisitos e protótipos": {
            "questoes": [2, 3, 4, 5, 15, 16, 17],
            "flashcards": [4, 5, 6, 7, 9, 18, 19, 20, 21],
        },
        "Modelagem: análise estruturada e UML": {
            "questoes": [11, 12, 13, 14, 18, 19, 20, 21, 22],
            "flashcards": [14, 15, 16, 17, 22, 23, 24, 25, 26, 27],
        },
        "Banco de dados relacional": {
            "questoes": [23, 24, 25, 26, 27, 28],
            "flashcards": [28, 29, 30, 31, 32, 33],
        },
    },
    "responsive-web": {
        "HTML5 e formulários": {
            "questoes": [0, 1, 2, 3, 4],
            "flashcards": [0, 1, 2, 3, 4, 5, 25],
        },
        "CSS3, layout e design do site": {
            "questoes": [5, 6, 7, 8, 9, 10],
            "flashcards": [6, 7, 8, 9, 10, 11, 12, 13],
        },
        "JavaScript, AJAX e ambiente local": {
            "questoes": [11, 12, 13, 14, 15],
            "flashcards": [14, 15, 16, 17, 18],
        },
        "PHP: sintaxe e formulários": {
            "questoes": [16, 17, 18, 19, 20],
            "flashcards": [19, 20, 21, 22, 23, 24],
        },
        "PHP: banco de dados, MVC e padrões": {
            "questoes": [21, 22, 23, 24, 25, 26],
            "flashcards": [26, 27, 28, 29, 30, 31],
        },
    },
}


def aplica(banco_id, plano, conferir):
    caminho = os.path.join(BANCOS, banco_id + ".json")
    with open(caminho, encoding="utf-8") as f:
        banco = json.load(f)

    for campo in ("questoes", "flashcards"):
        itens = banco.get(campo, [])
        destino = {}
        for tema, mapa in plano.items():
            for i in mapa.get(campo, []):
                if i in destino:
                    raise SystemExit("%s: índice %d de %s está em dois temas" % (banco_id, i, campo))
                destino[i] = tema
        faltando = [i for i in range(len(itens)) if i not in destino]
        sobrando = [i for i in destino if i >= len(itens)]
        if faltando or sobrando:
            raise SystemExit("%s/%s: sem tema %s | índice inexistente %s"
                             % (banco_id, campo, faltando, sobrando))
        if not conferir:
            for i, item in enumerate(itens):
                item["tema"] = destino[i]

    if not conferir:
        with open(caminho, "w", encoding="utf-8") as f:
            json.dump(banco, f, ensure_ascii=False, indent=1)
    return banco


# Em Database Design e Data Persistence os temas estavam corretos, mas picados
# demais: 12 e 19 rótulos com 2 ou 3 questões cada. Aqui eles são agrupados nos
# mesmos blocos dos resumos, então "estudar o tema" e "treinar o tema" passam a
# falar da mesma coisa — e quase todo bloco alcança as 5 questões do critério.
POR_NOME = {
    "database-design": {
        "Arquitetura de SGBD e Modelos de Dados": "Arquitetura de SGBD e modelos de dados",
        "Modelagem ER": "Modelagem ER e normalização",
        "Normalização e Engenharia Reversa": "Modelagem ER e normalização",
        "DDL": "SQL: DDL, DML e DQL",
        "DML e DQL": "SQL: DDL, DML e DQL",
        "DCL - Segurança e Controle de Acesso": "DCL, segurança e controle de acesso",
        "Transações e ACID": "Transações, ACID e concorrência",
        "Controle de Concorrência": "Transações, ACID e concorrência",
        "Otimização de Banco de Dados": "Otimização, NoSQL, rotinas e administração de dados",
        "NoSQL vs Relacional": "Otimização, NoSQL, rotinas e administração de dados",
        "Rotinas de Programação (ETL, Procedures, Triggers)": "Otimização, NoSQL, rotinas e administração de dados",
        "Administração de Dados (DA vs DBA)": "Otimização, NoSQL, rotinas e administração de dados",
    },
    "data-persistence": {
        "BD, SGBD e Modelo Relacional": "Banco de dados relacional e modelagem",
        "Modelagem ER e Projeto de BD": "Banco de dados relacional e modelagem",
        "SQL Básico (DDL/DML/DCL/DTL/DQL)": "SQL: consulta, filtros e junções",
        "SELECT, WHERE, Operadores e LIKE": "SQL: consulta, filtros e junções",
        "JOINs": "SQL: consulta, filtros e junções",
        "UNION, UNION ALL e INTERSECT": "SQL: consulta, filtros e junções",
        "Agregação, GROUP BY e HAVING": "SQL: agregação, subconsultas e triggers",
        "Subconsultas (Subqueries)": "SQL: agregação, subconsultas e triggers",
        "Triggers e Banco de Dados Ativo": "SQL: agregação, subconsultas e triggers",
        "JDBC e Acesso a BD em Java": "Java e banco de dados: JDBC, JPA e Hibernate",
        "Hibernate, JPA e ORM": "Java e banco de dados: JDBC, JPA e Hibernate",
        "Servlets e Tomcat": "Web: HTTP, servlets e Tomcat",
        "HTTP e WWW": "Web: HTTP, servlets e Tomcat",
        "Formulários HTML": "Front-end: formulários, DOM, AJAX e APIs",
        "DOM (Document Object Model)": "Front-end: formulários, DOM, AJAX e APIs",
        "AJAX e XMLHttpRequest": "Front-end: formulários, DOM, AJAX e APIs",
        "APIs (REST e SOAP)": "Front-end: formulários, DOM, AJAX e APIs",
        "Manipulação de Arquivos": "Arquivos e NoSQL (MongoDB vs MySQL)",
        "MongoDB vs MySQL": "Arquivos e NoSQL (MongoDB vs MySQL)",
    },
}


def aplica_por_nome(banco_id, mapa, conferir):
    caminho = os.path.join(BANCOS, banco_id + ".json")
    with open(caminho, encoding="utf-8") as f:
        banco = json.load(f)
    for campo in ("questoes", "flashcards", "discursivas"):
        for item in banco.get(campo, []):
            t = item.get("tema")
            if t in mapa:
                if not conferir:
                    item["tema"] = mapa[t]
            elif t not in mapa.values():
                print("   [aviso] %s/%s: tema fora do mapa — %r" % (banco_id, campo, t))
    if not conferir:
        with open(caminho, "w", encoding="utf-8") as f:
            json.dump(banco, f, ensure_ascii=False, indent=1)
    return banco


def main():
    conferir = "--conferir" in sys.argv
    problemas = []
    for banco_id, mapa in POR_NOME.items():
        banco = aplica_por_nome(banco_id, mapa, conferir)
        print("\n%s" % banco_id)
        contagem = collections.Counter(q["tema"] for q in banco["questoes"])
        cards = collections.Counter(c["tema"] for c in banco.get("flashcards", []))
        for tema in sorted(set(mapa.values())):
            n = contagem.get(tema, 0)
            if n < MINIMO:
                problemas.append("%s · %s (%d)" % (banco_id, tema, n))
            print("   %-52s %2d questões  %2d cards%s" % (
                tema[:52], n, cards.get(tema, 0), "  ABAIXO DE %d" % MINIMO if n < MINIMO else ""))
        print("   %-52s %2d" % ("TOTAL", sum(contagem.values())))
    for banco_id, plano in PLANO.items():
        banco = aplica(banco_id, plano, conferir)
        print("\n%s" % banco_id)
        contagem = collections.Counter(q["tema"] for q in banco["questoes"])
        cards = collections.Counter(c["tema"] for c in banco["flashcards"])
        for tema in plano:
            n = contagem.get(tema, 0)
            marca = "  ABAIXO DE %d" % MINIMO if n < MINIMO else ""
            if n < MINIMO:
                problemas.append("%s · %s (%d)" % (banco_id, tema, n))
            print("   %-46s %2d questões  %2d cards%s" % (tema[:46], n, cards.get(tema, 0), marca))
        print("   %-46s %2d           %2d" % ("TOTAL", sum(contagem.values()), sum(cards.values())))

    print()
    if problemas:
        print("CRITÉRIO NÃO ATENDIDO — temas com menos de %d questões: %s" % (MINIMO, "; ".join(problemas)))
        return 1
    print("CRITÉRIO ATENDIDO: todo tema reclassificado tem pelo menos %d questões." % MINIMO)
    return 0


if __name__ == "__main__":
    sys.exit(main())
