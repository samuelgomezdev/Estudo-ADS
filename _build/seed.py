# -*- coding: utf-8 -*-
"""Ajustes pontuais: links do repositório no banco do RWD e cache da pasta UI e UX."""
import json, io, os

AQUI = os.path.dirname(os.path.abspath(__file__))

# ---- 1. links do repositório GitHub no banco de Responsive Web Development
banco = os.path.join(AQUI, "bancos", "responsive-web.json")
with io.open(banco, encoding="utf-8") as f:
    b = json.load(f)
b["links"] = [
    {"nome": "Menu principal",
     "url": "https://samuelgomezdev.github.io/responsive_web_development/",
     "desc": "Índice de todos os exercícios publicados"},
    {"nome": "Aula 01 — Lobo",
     "url": "https://samuelgomezdev.github.io/responsive_web_development/aula01-lobo/",
     "desc": "HTML básico: estrutura, imagem, parágrafo e link externo"},
    {"nome": "Aula 02 — Posicionamento Float",
     "url": "https://samuelgomezdev.github.io/responsive_web_development/aula02-float/",
     "desc": "Layout com float: right, clear: both e box-sizing: border-box"},
    {"nome": "Aula 03 — Seletores CSS",
     "url": "https://samuelgomezdev.github.io/responsive_web_development/aula03-seletores-css/",
     "desc": "Seletores de tag, classe e ID; hover e especificidade"},
    {"nome": "Fórum Temático — Carta do Leitor",
     "url": "https://samuelgomezdev.github.io/responsive_web_development/forum-tematico/",
     "desc": "Layout editorial responsivo com gradientes e listas semânticas"},
    {"nome": "Unidade de Aprendizagem — Estados e Cidades",
     "url": "https://github.com/samuelgomezdev/responsive_web_development/tree/main/unidade-aprendizagem",
     "desc": "Select dinâmico com AJAX (XMLHttpRequest) e backend PHP devolvendo JSON"},
    {"nome": "Calculadora Espacial",
     "url": "https://samuelgomezdev.github.io/responsive_web_development/calculadora/",
     "desc": "JS, CSS e HTML: estrelas animadas, sons e efeitos neon"},
    {"nome": "Repositório no GitHub",
     "url": "https://github.com/samuelgomezdev/responsive_web_development",
     "desc": "Código-fonte completo dos exercícios"},
]
with io.open(banco, "w", encoding="utf-8") as f:
    json.dump(b, f, ensure_ascii=False, indent=1)
print("links do RWD:", len(b["links"]))

# ---- 2. semeia o cache da pasta UI e UX (o OneDrive às vezes não deixa listar)
UIUX = [
    ("A importância dos protótipos no desenvolvimento de sistemas _ ThiagoNasc.com", 1065674),
    ("afetividademundos3d", 642176),
    ("ANÁLISE E PROPOSTA DE MELHORIAS na empresa", 477120),
    ("Artigo_ControleRegrasEfeitos", 409996),
    ("Avaliação e testes de usabilidade", 12219688),
    ("Avaliação em IHC", 12236505),
    ("Cognição e frameworks", 13146553),
    ("Como a tecnologia muda o comportamento do consumidor - Época Negócios _ Marketing", 672198),
    ("Definindo o comportamento do consumidor", 12954300),
    ("Fórum Temático - UX Design[1]", 795438),
    ("frameworkinterfaceeducativa", 3234152),
    ("graficoatividade", 1181480),
    ("Home _ Web Accessibility Initiative (WAI) _ W3C", 574104),
    ("IHC em Automóveis", 312282),
    ("Interação social e emocional", 1597025),
    ("Interfaces, tipos e funções", 7095298),
    ("O PERFIL DO CONSUMIDOR NO VAREJO SUPERMERCADISTA", 160221),
    ("O significado do comportamento", 11754328),
    ("Origami Studio — Origami Studio 3", 12479048),
    ("Pesquisadores criam interface que faz cérebro 'sentir' a presença de próteses - Olhar Digital", 11757826),
    ("PMKB _ Tipos de interfaces conhecidas e gerenciadas em projetos - PMKB Project Management _ Gestão de Projetos", 1122811),
    ("Processos de design de IHC I", 12074505),
    ("Processos de design de IHC II", 11935514),
    ("Projeto de interface com o usuario", 2033989),
    ("Prototipação de soluções", 1383151),
    ("Psicologia das cores", 13628551),
    ("Quais são as melhores ferramentas de prototipagem de interface_ UI UX _ by Felipe Melo Guimarães _ Aela _ Medium", 7268114),
    ("Quanto Ganha um Desenvolvedor Web_ Médias Salariais em 2025", 1191250),
    ("Samsung desenvolve alternativa à barra de navegação do Android - Olhar Digital", 11199221),
    ("SciELO Brasil - Metodologia para avaliação do nível de usabilidade de bibliotecas digitais_ um estudo na Biblioteca Virtual de Saúde", 745951),
    ("SciELO Brasil - Planejamento da assistência de enfermagem_ proposta de um software-protótipo", 2309869),
    ("SciELO Brasil - Recomendações de usabilidade e acessibilidade para interface de telefone celular visando o público idoso", 5350961),
    ("Seleção do Comportamento", 445240),
    ("UI Design - O que é User Interface Design (UI DESIGN)_", 635886),
    ("UMA PROPOSTA DIFERENCIADA DE UM JOGO DIGITAL PARA EDUCAÇÃO AMBIENTAL DE CRIANÇAS", 1202044),
    ("Webflow_ Create a custom website _ Visual website builder", 4346217),
]


def tamanho(b):
    for u in ("B", "KB", "MB", "GB"):
        if b < 1024 or u == "GB":
            return ("%.0f %s" if u in ("B", "KB") else "%.1f %s") % (b, u)
        b /= 1024.0


cachef = os.path.join(AQUI, "cache_arquivos.json")
cache = {}
if os.path.exists(cachef):
    with io.open(cachef, encoding="utf-8") as f:
        cache = json.load(f)
cache["UI e UX"] = [{
    "nome": n, "ext": "pdf", "tam": tamanho(s),
    "href": "../UI e UX/" + n + ".pdf",
} for n, s in UIUX]
with io.open(cachef, "w", encoding="utf-8") as f:
    json.dump(cache, f, ensure_ascii=False, indent=1)
print("cache UI e UX:", len(cache["UI e UX"]), "arquivos")
