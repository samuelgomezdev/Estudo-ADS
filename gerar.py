# -*- coding: utf-8 -*-
"""
Gerador do site Estudo ADS — UNIVALI.

O que ele faz:
  1. Varre a pasta Univali procurando pastas de matéria.
  2. Toda pasta nova entra automaticamente em materias.json (é só editar o nome/período depois).
  3. Junta o banco de questões de bancos/<id>.json, quando existir.
  4. Lista os arquivos de estudo (PDF, DOCX, PPTX...) de cada pasta.
  5. Escreve index.html (para abrir no computador) e docs/index.html (versão publicada
     no GitHub Pages, sem os links para os arquivos da sua máquina).

Uso:  python gerar.py        — ou duplo clique em atualizar.bat
"""
import json, os, re, sys, unicodedata, datetime, difflib
from urllib.parse import quote

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from labs import ler_labs                         # noqa: E402

RAIZ = os.path.dirname(AQUI)                      # a pasta Univali
CFG = os.path.join(AQUI, "materias.json")
BANCOS = os.path.join(AQUI, "bancos")
LABS = os.path.join(BANCOS, "labs")
TEMPLATE = os.path.join(AQUI, "template")
TEMPLATE_LAB = os.path.join(TEMPLATE, "lab")

EXTS = (".pdf", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".md", ".txt", ".sql", ".puml", ".drawio")

# pastas que nunca viram matéria
IGNORAR_PADRAO = [
    "Estudo-ADS", "Tutor Claudio", "Prova-Sabado", "FOZ-INOVA-2026",
    "Project-01", "Project-02", "node_modules", "AquaFoz_Imagens",
]
IGNORAR_REGEX = [r"^\.", r"^HOW[- ]", r"^Hands", r"^_"]

CORES = ["#ef4444", "#8b5cf6", "#06b6d4", "#2563eb", "#f59e0b", "#22c55e",
         "#ec4899", "#14b8a6", "#a855f7", "#f97316", "#3b82f6", "#84cc16",
         "#e11d48", "#0ea5e9", "#eab308", "#10b981"]

# período de cada matéria, conforme a matriz curricular do curso
PERIODO = {
    "gestao-de-projetos": 1, "gerenciamento-de-projetos": 1, "hardware-software-interface": 1,
    "arquitetura-de-computadores": 1, "fundamentos-computacionais": 1, "so-sistemas-operacionais": 1,
    "user-experience-design": 1, "ui-e-ux": 1, "empreendedorismo": 1,
    "pensamento-computacional": 2, "inteligencia-interpessoal": 2,
    "inovacao-disruptiva": 2, "engenharia-de-requisitos": 2,
    "responsive-web": 3, "responsive-web-development": 3, "data-persistence": 3,
    "programming-and-data-persistence": 3, "software-design": 3, "database-design": 3,
    "database-design-for-apps": 3,
    "paradigmas": 4, "paradigmas-de-programacao": 4, "engenharia-de-software": 4,
    "programacao-para-dispositivos-moveis": 4, "teste-de-software": 4,
    "computacao-em-nuvem": 5, "devops": 5, "tecnologias-emergentes": 5,
    "seguranca-cibernetica": 5,
}

# pastas com nome diferente do id do banco de questões
APELIDOS = {
    "Software Design": "software-design",
    "Database Design for Apps": "database-design",
    "Programming and Data Persistence": "data-persistence",
    "Paradigmas de Programação": "paradigmas",
    "Responsive Web Development": "responsive-web",
}


def slug(txt):
    t = unicodedata.normalize("NFKD", txt).encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t).strip("-").lower()
    return re.sub(r"-+", "-", t)


def sigla(nome):
    palavras = [p for p in re.split(r"[\s\-]+", nome)
                if p and p.lower() not in ("de", "da", "do", "dos", "das", "e", "para", "a", "o", "and", "for")]
    if len(palavras) == 1:
        return palavras[0][:3].upper()
    return "".join(p[0] for p in palavras[:4]).upper()


def tamanho(b):
    for u in ("B", "KB", "MB", "GB"):
        if b < 1024 or u == "GB":
            return ("%.0f %s" if u in ("B", "KB") else "%.1f %s") % (b, u)
        b /= 1024.0


# --------------------------------------------------------------- cor e contraste
# CORREÇÃO NC-13: a cor da matéria era usada para as duas coisas — texto colorido
# sobre o card escuro e fundo de botão com texto branco. Nenhuma cor serve bem
# para os dois papéis, então o gerador deriva uma variação para cada um e mede.
BRANCO = (255, 255, 255)
CARD = (22, 32, 58)          # --card do tema escuro


def _rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _hex(t):
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(round(c)))) for c in t)


def _lum(rgb):
    def canal(c):
        c /= 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (canal(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a, b):
    l1, l2 = sorted((_lum(a), _lum(b)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def cor_de_fundo(cor, alvo=4.5):
    """Escurece até o texto BRANCO por cima passar no mínimo da WCAG AA."""
    rgb = _rgb(cor)
    for _ in range(60):
        if contraste(rgb, BRANCO) >= alvo:
            return _hex(rgb)
        rgb = tuple(c * 0.93 for c in rgb)
    return "#000000"


def cor_de_texto(cor, alvo=4.5):
    """Clareia até o texto nessa cor passar no mínimo sobre o card escuro."""
    rgb = _rgb(cor)
    for _ in range(60):
        if contraste(rgb, CARD) >= alvo:
            return _hex(rgb)
        rgb = tuple(c + (255 - c) * 0.07 for c in rgb)
    return "#ffffff"


def ignorar(nome):
    if nome in IGNORAR_PADRAO:
        return True
    return any(re.search(rx, nome) for rx in IGNORAR_REGEX)


# --------------------------------------------------------------- config
def tem_banco(mid):
    return os.path.exists(os.path.join(BANCOS, mid + ".json"))


def banco_do_nome(nome):
    """Procura um banco de questões cujo campo 'nome' seja igual ao informado.
    Serve para religar o banco quando a pasta foi renomeada mais de uma vez."""
    if not nome or not os.path.isdir(BANCOS):
        return None
    for arq in sorted(os.listdir(BANCOS)):
        if not arq.endswith(".json") or arq.startswith("_"):
            continue
        try:
            with open(os.path.join(BANCOS, arq), encoding="utf-8") as f:
                if json.load(f).get("nome") == nome:
                    return arq[:-5]
        except Exception:
            continue
    return None


def carrega_cfg():
    if os.path.exists(CFG):
        with open(CFG, encoding="utf-8") as f:
            return json.load(f)
    return {"ignorar": [], "materias": {}}


def salva_cfg(cfg):
    with open(CFG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


# --------------------------------------------------------------- varredura
def varrer():
    cfg = carrega_cfg()
    mats = cfg.setdefault("materias", {})
    ignorados = set(cfg.setdefault("ignorar", []))
    novas, renomeadas, removidas, sem_pasta = [], [], [], []

    try:
        pastas = []
        for d in sorted(os.listdir(RAIZ)):
            try:
                if os.path.isdir(os.path.join(RAIZ, d)):
                    pastas.append(d)
            except OSError:
                pastas.append(d)     # provavelmente pasta do OneDrive ainda não baixada
    except OSError as e:
        print("Não consegui ler a pasta %s: %s" % (RAIZ, e))
        return cfg, {"novas": [], "renomeadas": [], "removidas": [], "sem_pasta": []}

    for pasta in pastas:
        if ignorar(pasta) or pasta in ignorados or pasta in mats:
            continue
        mid = APELIDOS.get(pasta, slug(pasta))
        mats[pasta] = {
            "id": mid,
            "nome": pasta,
            "periodo": PERIODO.get(mid, 0),
            "sigla": sigla(pasta),
            "cor": CORES[len(mats) % len(CORES)],
        }
        novas.append(pasta)

    # --- CORREÇÃO NC-03: reconciliar pastas renomeadas ou removidas -----------
    # Antes o gerador só acrescentava: renomear uma pasta deixava a entrada antiga
    # viva, ainda alimentada pelo cache, e o site mostrava a matéria duplicada.
    cache = carrega_cache()
    no_disco = set(pastas)
    orfas = [p for p in list(mats) if p not in no_disco]
    usadas = set()

    def semelhanca(a, b):
        return difflib.SequenceMatcher(None, slug(a), slug(b)).ratio()

    def mesma_pasta(velha, nova):
        """Quão provável é que 'nova' seja 'velha' renomeada."""
        if mats.get(nova, {}).get("id") == mats[velha]["id"]:
            return 1.0
        antes = {a["nome"] for a in cache.get(velha, [])}
        agora = {a["nome"] for a in arquivos_de(nova, cache)}
        if antes and agora:
            comum = len(antes & agora) / max(len(antes), len(agora))
            if comum >= 0.6:                 # o conteúdo é a evidência mais forte
                return 0.9 + comum / 10
        return semelhanca(velha, nova)

    for velha in orfas:
        meta = mats[velha]
        candidatas = [(mesma_pasta(velha, p), p) for p in novas
                      if p in mats and p != velha and p not in usadas]
        candidatas.sort(reverse=True)
        escolhida = candidatas[0][1] if candidatas and candidatas[0][0] >= 0.75 else None

        if escolhida:
            usadas.add(escolhida)
            # preserva período e cor ajustados à mão; se já existe banco gravado no
            # id antigo, mantém esse id para o banco de questões não ficar órfão
            for k in ("periodo", "cor"):
                mats[escolhida][k] = meta.get(k, mats[escolhida][k])
            # adota o id que já tem banco gravado — pelo id antigo ou, se a pasta
            # já foi renomeada antes, pelo nome registrado dentro do próprio banco
            herdado = (meta["id"] if tem_banco(meta["id"])
                       else banco_do_nome(velha) or banco_do_nome(meta.get("nome", "")))
            if herdado:
                mats[escolhida]["id"] = herdado
            del mats[velha]
            novas.remove(escolhida)
            renomeadas.append((velha, escolhida))
        elif tem_banco(meta["id"]):
            # sem pasta, mas com banco de questões: fica no site, sem material
            mats[velha]["sem_pasta"] = True
            sem_pasta.append(velha)
        else:
            del mats[velha]
            removidas.append(velha)

    # matérias com banco mas sem pasta (ex.: pasta renomeada ou ainda não criada)
    if os.path.isdir(BANCOS):
        ids = {m["id"] for m in mats.values()}
        for arq in sorted(os.listdir(BANCOS)):
            if not arq.endswith(".json") or arq.startswith("_"):
                continue
            bid = arq[:-5]
            if bid in ids:
                continue
            with open(os.path.join(BANCOS, arq), encoding="utf-8") as f:
                b = json.load(f)
            nome = b.get("nome", bid)
            mats[nome] = {
                "id": bid, "nome": nome,
                "periodo": b.get("periodo", PERIODO.get(bid, 0)),
                "sigla": b.get("sigla", sigla(nome)),
                "cor": b.get("cor", CORES[len(mats) % len(CORES)]),
            }
            novas.append(nome + " (só banco, sem pasta)")

    # limpa do cache as pastas que não existem mais
    cache = carrega_cache()
    sujeira = [p for p in cache if p not in mats]
    if sujeira:
        for p in sujeira:
            del cache[p]
        try:
            with open(CACHE, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False, indent=1)
        except OSError:
            pass

    salva_cfg(cfg)
    return cfg, {"novas": novas, "renomeadas": renomeadas,
                 "removidas": removidas, "sem_pasta": sem_pasta}


AVISOS = []
CACHE = os.path.join(AQUI, "cache_arquivos.json")


def carrega_cache():
    if os.path.exists(CACHE):
        try:
            with open(CACHE, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def href_de(pasta, arquivo):
    """Caminho do arquivo a partir de Estudo-ADS/.

    CORREÇÃO NC-07: "#" começa a âncora de uma URL e cortava o caminho ao meio —
    seis arquivos não abriam, quatro deles de Paradigmas. "+" e "?" dão problema
    parecido. quote() resolve todos de uma vez."""
    return "../" + quote(pasta.replace("\\", "/")) + "/" + quote(arquivo)


def arquivos_de(pasta, cache):
    caminho = os.path.join(RAIZ, pasta)
    if not os.path.isdir(caminho):
        return cache.get(pasta, [])
    try:
        nomes = sorted(os.listdir(caminho))
    except OSError as e:
        # pasta do OneDrive ainda não baixada ("arquivos sob demanda"):
        # usa a última listagem boa que guardamos
        antes = cache.get(pasta)
        AVISOS.append("não consegui ler '%s' (%s) — %s"
                      % (pasta, e.strerror or e,
                         "usei a listagem salva no cache" if antes else "matéria entra sem lista de arquivos"))
        return antes or []
    saida = []
    for nome in nomes:
        p = os.path.join(caminho, nome)
        try:
            if not os.path.isfile(p):
                continue
        except OSError:
            continue
        ext = os.path.splitext(nome)[1].lower()
        if ext not in EXTS:
            continue
        try:
            tam = os.path.getsize(p)
        except OSError:
            continue
        saida.append({
            "nome": os.path.splitext(nome)[0],
            "ext": ext.lstrip("."),
            "tam": tamanho(tam),
            "href": href_de(pasta, nome),
        })
    return saida


def banco_de(mid):
    p = os.path.join(BANCOS, mid + ".json")
    if not os.path.exists(p):
        return {}
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def montar(cfg):
    cache = carrega_cache()
    materias = []
    for pasta, meta in cfg["materias"].items():
        b = banco_de(meta["id"])
        arqs = [] if meta.get("sem_pasta") else arquivos_de(pasta, cache)
        for a in arqs:   # o cache pode ter href de uma versão anterior do gerador
            a["href"] = href_de(pasta, a["nome"] + "." + a["ext"])
        if arqs:
            cache[pasta] = arqs          # guarda para quando o OneDrive estiver offline
        labs, lab_bancos = ler_labs(os.path.join(LABS, meta["id"] + ".lab"), AVISOS)
        materias.append({
            "id": meta["id"],
            # o cadastro manda no título: é ele que acompanha a pasta quando você
            # renomeia, e é nele que você edita o nome. O banco é só reserva.
            "nome": meta.get("nome") or b.get("nome") or pasta,
            "sigla": meta.get("sigla") or sigla(meta["nome"]),
            "cor": meta.get("cor", "#5b8cff"),
            "corTexto": cor_de_texto(meta.get("cor", "#5b8cff")),
            "corFundo": cor_de_fundo(meta.get("cor", "#5b8cff")),
            "periodo": meta.get("periodo", 0),
            "pasta": pasta,
            "arquivos": arqs,
            "links": b.get("links", []),
            "resumos": b.get("resumos", []),
            "flashcards": b.get("flashcards", []),
            "questoes": b.get("questoes", []),
            "discursivas": b.get("discursivas", []),
            "colas": b.get("colas", []),
            "labs": labs,
            "labBancos": lab_bancos,
        })
    try:
        with open(CACHE, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=1)
    except OSError:
        pass
    conferir_temas(materias)
    materias.sort(key=lambda m: (m["periodo"] or 99, -len(m["questoes"]), m["nome"]))
    return materias


# CORREÇÃO NC-09: o critério do tutor é 4 acertos em 5, então tema com menos de
# 5 questões não dá para avaliar. O gerador passa a avisar em vez de deixar
# passar calado — quem escreve o banco vê na hora o que precisa completar.
MIN_POR_TEMA = 5


def conferir_temas(materias):
    magros = []
    for m in materias:
        contagem = {}
        for q in m["questoes"]:
            t = q.get("tema") or "Geral"
            contagem[t] = contagem.get(t, 0) + 1
        curtos = sorted((n, t) for t, n in contagem.items() if n < MIN_POR_TEMA)
        if curtos:
            magros.append((m["nome"], len(contagem), curtos))
    for nome, total, curtos in magros:
        AVISOS.append("%s: %d de %d temas com menos de %d questões (%s)"
                      % (nome, len(curtos), total, MIN_POR_TEMA,
                         ", ".join("%s=%d" % (t, n) for n, t in curtos[:4])
                         + ("…" if len(curtos) > 4 else "")))


CONTA = os.path.join(AQUI, "conta.json")


def carrega_conta():
    """Configuração do login do admin (Supabase). Sem conta.json, o site fica só
    em modo visitante. Só vão para o HTML a URL do projeto e a chave PÚBLICA
    (anon/publishable) — ela é feita para ficar no navegador; quem protege os
    dados são as regras do banco (supabase/schema.sql)."""
    if not os.path.exists(CONTA):
        return None
    try:
        with open(CONTA, encoding="utf-8") as f:
            c = json.load(f)
    except (OSError, ValueError) as e:
        AVISOS.append("conta.json ilegível (%s) — login desligado" % e)
        return None
    url, chave = (c.get("url") or "").strip(), (c.get("chave") or "").strip()
    if not url or not chave:
        return None
    # a chave service_role (ou sb_secret_...) dá acesso total ao banco: nunca publicar
    papel = ""
    try:
        import base64
        meio = chave.split(".")[1]
        papel = json.loads(base64.urlsafe_b64decode(meio + "=" * (-len(meio) % 4))).get("role", "")
    except Exception:
        pass
    if papel == "service_role" or chave.startswith("sb_secret_"):
        AVISOS.append("conta.json tem a chave SECRETA (service_role) — use a chave pública anon. Login desligado.")
        return None
    return {"url": url.rstrip("/"), "chave": chave}


CDNS = "https://cdn.jsdelivr.net https://cdnjs.cloudflare.com"


def politica_csp(conta):
    """CSP como <meta> (o GitHub Pages não deixa configurar cabeçalhos).
    Limites conhecidos: o site é um único HTML com scripts embutidos e os
    exercícios de HTML rodam scripts do aluno (iframes srcdoc herdam esta
    política), então script-src precisa de 'unsafe-inline'; os motores de
    JS/Python/SQL precisam de eval e WebAssembly. O ganho real está em limitar
    de onde scripts vêm e PARA ONDE dados podem ser enviados: fetch/XHR só para
    o próprio site, o Supabase do projeto e os CDNs; imagens só locais."""
    supa = ""
    if conta:
        supa = " " + conta["url"] + " " + conta["url"].replace("https://", "wss://")
    diretivas = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: " + CDNS,
        "worker-src 'self' blob:",
        "connect-src 'self' blob: data:" + supa + " " + CDNS,
        "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "frame-src 'self' blob: data:",
        "media-src 'self' data: blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
    ]
    return "; ".join(diretivas)


def escrever(materias, destino, local):
    with open(os.path.join(TEMPLATE, "base.html"), encoding="utf-8") as f:
        html = f.read()
    with open(os.path.join(TEMPLATE, "app.css"), encoding="utf-8") as f:
        css = f.read()
    # ordem dos scripts: laboratório (template/lab/, alfabética) → conta.js (usa o
    # carregador do laboratório) → app.js (chama os dois). CSS na mesma ordem, com o app.css primeiro.
    partes_js, partes_css = [], [css]
    if os.path.isdir(TEMPLATE_LAB):
        for arq in sorted(os.listdir(TEMPLATE_LAB)):
            with open(os.path.join(TEMPLATE_LAB, arq), encoding="utf-8") as f:
                if arq.endswith(".js"):
                    partes_js.append(f.read())
                elif arq.endswith(".css"):
                    partes_css.append(f.read())
    for arq, lista in (("conta.js", partes_js), ("app.js", partes_js), ("conta.css", partes_css)):
        with open(os.path.join(TEMPLATE, arq), encoding="utf-8") as f:
            lista.append(f.read())
    js = "\n".join(partes_js)
    css = "\n".join(partes_css)

    dados = {
        "materias": materias,
        "local": local,
        "raiz": os.path.basename(RAIZ),
        "gerado": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
    }
    conta = carrega_conta()
    if conta:
        dados["conta"] = conta
    blob = json.dumps(dados, ensure_ascii=False, separators=(",", ":"))
    blob = blob.replace("</", "<\\/")   # não fecha a tag <script> por engano

    html = html.replace("__CSS__", css).replace("__JS__", js).replace("__DADOS__", blob)
    cabeca = ("<!DOCTYPE html>\n<html lang=\"pt-BR\">\n<head>\n<meta charset=\"utf-8\">\n"
              "<meta http-equiv=\"Content-Security-Policy\" content=\"" + politica_csp(conta) + "\">\n"
              "<meta name=\"referrer\" content=\"no-referrer\">\n"
              "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
              "</head>\n")
    html = cabeca + ("<body>\n" if not local else "<body style=\"margin:0\">\n") + html + "\n</body>\n</html>"
    with open(destino, "w", encoding="utf-8") as f:
        f.write(html)
    return len(html)


def main():
    if "--sem-varredura" in sys.argv:
        print("Modo --sem-varredura: usando materias.json e o cache como estão.\n")
        cfg = carrega_cfg()
    else:
        print("Lendo pastas em: %s\n" % RAIZ)
        cfg, rel = varrer()
        if rel["novas"]:
            print("Matérias novas detectadas e adicionadas:")
            for n in rel["novas"]:
                print("   + " + n)
            print("   (ajuste nome, período e cor em materias.json se quiser)")
        if rel["renomeadas"]:
            print("Pastas renomeadas — cadastro migrado:")
            for a, b in rel["renomeadas"]:
                print("   ~ %s  ->  %s" % (a, b))
        if rel["removidas"]:
            print("Pastas que sumiram e não tinham banco — removidas do site:")
            for n in rel["removidas"]:
                print("   - " + n)
        if rel["sem_pasta"]:
            print("Sem pasta no disco, mas com banco de questões — mantidas sem material:")
            for n in rel["sem_pasta"]:
                print("   ! " + n)
        if any(rel.values()):
            print()

    materias = montar(cfg)

    print("%-38s %6s %6s %6s %6s %6s %6s" % ("MATÉRIA", "quest", "cards", "resum", "colas", "labs", "arqs"))
    print("-" * 83)
    tot = [0, 0, 0, 0, 0, 0]
    for m in materias:
        v = [len(m["questoes"]), len(m["flashcards"]), len(m["resumos"]), len(m["colas"]),
             len(m["labs"]), len(m["arquivos"]) + len(m["links"])]
        tot = [a + b for a, b in zip(tot, v)]
        print("%-38s %6d %6d %6d %6d %6d %6d" % (m["nome"][:38], *v))
    print("-" * 83)
    print("%-38s %6d %6d %6d %6d %6d %6d" % ("TOTAL (%d matérias)" % len(materias), *tot))

    if AVISOS:
        print("\nAvisos:")
        for a in AVISOS:
            print("   ! " + a)

    n1 = escrever(materias, os.path.join(AQUI, "index.html"), local=True)
    pub = os.path.join(AQUI, "docs")
    os.makedirs(pub, exist_ok=True)
    n2 = escrever(materias, os.path.join(pub, "index.html"), local=False)
    print("\nindex.html gerado    (%.0f KB) — abra este no navegador" % (n1 / 1024.0))
    print("docs/index.html gerado (%.0f KB) — é este que o GitHub Pages publica" % (n2 / 1024.0))
    print("                     depois de gerar: git add -A && git commit -m \"atualiza site\" && git push")


if __name__ == "__main__":
    main()
