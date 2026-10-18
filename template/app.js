/* Estudo ADS — UNIVALI
   Dados injetados pelo gerar.py na constante DADOS.
   Navegação por rotas em hash: #/  |  #/m/<id>  |  #/m/<id>/<aba> */
(function () {
  "use strict";

  var M = DADOS.materias;
  var byId = {};
  M.forEach(function (m) { byId[m.id] = m; });

  var ABAS = [
    ["resumo", "Resumo", function (m) { return m.resumos.length; }],
    ["lab", "Laboratório", function (m) { return (m.labs || []).length; }],
    ["cards", "Flashcards", function (m) { return m.flashcards.length; }],
    ["quiz", "Quiz", function (m) { return m.questoes.length; }],
    ["simulado", "Simulado", function (m) { return m.questoes.length >= 5 ? m.questoes.length : 0; }],
    ["disc", "Discursivas", function (m) { return m.discursivas.length; }],
    ["colas", "Colas", function (m) { return m.colas.length; }],
    ["material", "Material", function (m) { return m.arquivos.length + (m.links || []).length; }],
    // quarto item = não mostrar o número na aba (a contagem só decide se ela aparece)
    ["imprimir", "Imprimir", function (m) {
      return m.resumos.length + m.flashcards.length + m.questoes.length + m.discursivas.length + m.colas.length;
    }, true]
  ];

  // ------------------------------------------------------------ util
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  // CORREÇÃO NC-13: --c continua sendo a cor da matéria para barras e bordas;
  // --ct é a versão clareada, para texto sobre o card; --cf é a escurecida, para
  // fundo de botão com texto branco. As duas saem calculadas do gerador.
  function pintaCores(alvo, m) {
    alvo.style.setProperty("--c", m.cor);
    alvo.style.setProperty("--ct", m.corTexto || m.cor);
    alvo.style.setProperty("--cf", m.corFundo || m.cor);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  // HTML dos resumos: só tags de formatação passam, sem atributos (exceto colspan/
  // rowspan). <template> é inerte — nada executa durante o parse.
  var TAGS_OK = { P: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, UL: 1, OL: 1, LI: 1, CODE: 1, PRE: 1, BR: 1, HR: 1,
                  TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TH: 1, TD: 1, H3: 1, H4: 1, H5: 1, SMALL: 1, SUB: 1,
                  SUP: 1, BLOCKQUOTE: 1, SPAN: 1, DIV: 1, S: 1, MARK: 1, KBD: 1 };
  var TAGS_FORA = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1, META: 1, BASE: 1, FORM: 1,
                    INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1, SVG: 1, MATH: 1, TEMPLATE: 1, NOSCRIPT: 1 };
  function sanitizarHtml(html) {
    var t = document.createElement("template");
    t.innerHTML = String(html == null ? "" : html);
    (function limpar(no) {
      Array.prototype.slice.call(no.childNodes).forEach(function (f) {
        if (f.nodeType === 3) return;                                   // texto
        if (f.nodeType !== 1) { no.removeChild(f); return; }            // comentários etc.
        var tag = f.tagName.toUpperCase();
        if (TAGS_FORA[tag]) { no.removeChild(f); return; }
        limpar(f);
        if (!TAGS_OK[tag]) {                                            // desconhecida: fica só o conteúdo
          while (f.firstChild) no.insertBefore(f.firstChild, f);
          no.removeChild(f);
          return;
        }
        Array.prototype.slice.call(f.attributes).forEach(function (a) {
          if (!((tag === "TD" || tag === "TH") && /^(colspan|rowspan)$/i.test(a.name) && /^\d{1,2}$/.test(a.value))) {
            f.removeAttribute(a.name);
          }
        });
      });
    })(t.content);
    return t.content;
  }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function plural(n, s, p) { return n + " " + (n === 1 ? s : p); }
  function semAcento(s) {
    return String(s).normalize ? s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
                               : String(s).toLowerCase();
  }

  // ------------------------------------------------------------ armazenamento
  // O site roda em file:// e em https://; nos dois o localStorage pode falhar
  // (janela anônima, dados do site bloqueados). Nada aqui pode derrubar a página.
  function lerLS(chave, padrao) {
    try {
      var v = localStorage.getItem(chave);
      return v == null ? padrao : JSON.parse(v);
    } catch (e) { return padrao; }
  }
  function gravarLS(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); return true; }
    catch (e) { return false; }
  }
  function apagarLS(chave) {
    try { localStorage.removeItem(chave); } catch (e) { /* ignora */ }
  }

  // ------------------------------------------------------------ progresso
  var PROG = {};
  PROG = lerLS("estudo-ads", {}) || {};
  function salvar() { gravarLS("estudo-ads", PROG); }
  function prog(mid) {
    if (!PROG[mid]) PROG[mid] = { certas: 0, total: 0, erradas: [], temas: {} };
    if (!PROG[mid].temas) PROG[mid].temas = {};
    if (!PROG[mid].erradas) PROG[mid].erradas = [];
    return PROG[mid];
  }
  function registrar(mid, questao, acertou) {
    var p = prog(mid);
    p.total++; if (acertou) p.certas++;
    p.visto = Date.now();
    var t = p.temas[questao.tema] || (p.temas[questao.tema] = { c: 0, t: 0 });
    t.t++; if (acertou) t.c++;
    var chave = questao.q.slice(0, 90);
    var i = p.erradas.indexOf(chave);
    if (acertou) { if (i >= 0) p.erradas.splice(i, 1); }
    else if (i < 0) { p.erradas.push(chave); }
    salvar();
  }
  function pct(mid) {
    var p = prog(mid);
    return p.total ? Math.round((p.certas / p.total) * 100) : 0;
  }

  // ============================================================ ROTEADOR
  // Toda troca de tela passa por aqui, então o voltar do navegador funciona.
  var rota = { vista: "home", mid: null, aba: null };
  var scrollHome = 0;
  var navegando = false;

  function lerHash() {
    var h = (location.hash || "#/").replace(/^#\/?/, "");
    var p = h.split("/").filter(Boolean).map(function (x) {
      try { return decodeURIComponent(x); } catch (e) { return x; }
    });
    if (p[0] === "m" && p[1] && byId[p[1]]) {
      return { vista: "materia", mid: p[1], aba: p[2] || null, sub: p[3] || null };
    }
    // CORREÇÃO NC-19: antes um endereço com matéria inexistente carregava a home
    // em silêncio e ainda deixava o hash inválido na barra do navegador.
    return { vista: "home", mid: null, aba: null, perdido: p[0] === "m" ? (p[1] || "") : null };
  }

  function irPara(hash, substituir) {
    navegando = true;
    if (substituir) location.replace(location.pathname + location.search + hash);
    else location.hash = hash;
    navegando = false;
    aplicarRota();
  }

  function rotaHome() { irPara("#/"); }
  function rotaMateria(mid, aba) {
    irPara("#/m/" + encodeURIComponent(mid) + (aba ? "/" + aba : ""));
  }
  // o que o laboratório (template/lab/) precisa do app
  var U = { irPara: function (h) { irPara(h); } };

  function aplicarRota() {
    var nova = lerHash();
    var eraHome = rota.vista === "home";
    if (eraHome && nova.vista !== "home") scrollHome = window.pageYOffset;

    // CORREÇÃO NC-10/11/12 — antes, sair da matéria por qualquer caminho jogava
    // o quiz fora em silêncio, e trocar de aba deixava o cronômetro correndo.
    // Agora: trocar de aba dentro da matéria apenas PAUSA; sair da matéria
    // pergunta — inclusive pelo voltar do navegador, que antes não perguntava.
    if (quiz && !quiz.fim) {
      var segueNaMateria = nova.vista === "materia" && nova.mid === quiz.m.id;
      if (segueNaMateria) {
        if (nova.aba === (quiz.simulado ? "simulado" : "quiz")) retomarQuiz();
        else pausarQuiz();
      } else if (temResposta() && !confirm(textoDeSaida())) {
        // cancelou: devolve o endereço para onde o quiz está, sem criar histórico
        rota = { vista: "materia", mid: quiz.m.id, aba: quiz.simulado ? "simulado" : "quiz" };
        irPara("#/m/" + encodeURIComponent(rota.mid) + "/" + rota.aba, true);
        return;
      } else {
        pararQuiz();
      }
    }

    rota = nova;

    if (rota.vista === "materia") {
      renderMateria(byId[rota.mid], rota.aba);
      mostrar("materia");
      window.scrollTo(0, 0);
    } else {
      document.body.classList.remove("modo-imp");
      renderHome();
      mostrar("home");
      if (rota.perdido != null) {
        avisoRotaPerdida(rota.perdido);
        irPara("#/", true);
        rota.perdido = null;
        window.scrollTo(0, 0);
      } else {
        window.scrollTo(0, scrollHome);
      }
    }
    atualizaTopo();
  }

  function avisoRotaPerdida(mid) {
    var alvo = $("#periodos");
    var a = el("div", "aviso");
    a.setAttribute("role", "status");
    a.textContent = mid
      ? "Não encontrei a matéria \u201c" + mid + "\u201d — ela pode ter sido renomeada. Escolha abaixo."
      : "Esse endereço não existe mais. Escolha uma matéria abaixo.";
    alvo.parentNode.insertBefore(a, alvo);
  }

  function mostrar(v) {
    ["home", "materia"].forEach(function (x) {
      $("#view-" + x).classList.toggle("on", x === v);
    });
  }

  window.addEventListener("hashchange", function () { if (!navegando) aplicarRota(); });

  // ------------------------------------------------------------ topo
  function atualizaTopo() {
    var voltar = $("#btn-voltar");
    var crumb = $("#crumb");
    crumb.innerHTML = "";

    if (rota.vista === "home") {
      voltar.hidden = true;
      return;
    }
    voltar.hidden = false;
    var m = byId[rota.mid];

    var a = el("button", "crumb-l", "Matérias");
    a.onclick = rotaHome;
    crumb.appendChild(a);
    crumb.appendChild(el("span", "crumb-s", "›"));

    var lbl = (ABAS.filter(function (x) { return x[0] === rota.aba; })[0] || [])[1];
    var sub = rota.aba === "lab" && rota.sub ? LAB.titulo(m, rota.sub) : null;
    if (lbl) {
      var b = el("button", "crumb-l", m.nome);
      b.onclick = function () { rotaMateria(m.id); };
      crumb.appendChild(b);
      crumb.appendChild(el("span", "crumb-s", "›"));
      if (sub) {
        var bl = el("button", "crumb-l", lbl);
        bl.onclick = function () { rotaMateria(m.id, "lab"); };
        crumb.appendChild(bl);
        crumb.appendChild(el("span", "crumb-s", "›"));
        crumb.appendChild(el("b", null, sub));
      } else crumb.appendChild(el("b", null, lbl));
    } else {
      crumb.appendChild(el("b", null, m.nome));
    }
  }

  // ============================================================ HOME
  var busca = "";

  function renderHome() {
    var tot = { r: 0, f: 0, q: 0, mat: 0, arq: 0 };
    M.forEach(function (m) {
      tot.r += m.resumos.length; tot.f += m.flashcards.length;
      tot.q += m.questoes.length;
      tot.arq += m.arquivos.length + (m.links || []).length;
      if (m.questoes.length || m.flashcards.length) tot.mat++;
    });

    var s = $("#stats"); s.innerHTML = "";
    [[M.length, "matérias"], [tot.mat, "com banco"], [tot.q, "questões"],
     [tot.f, "flashcards"], [tot.r, "resumos"], [tot.arq, "arquivos"]]
      .forEach(function (p) {
        var d = el("div", "stat");
        d.appendChild(el("b", null, String(p[0])));
        d.appendChild(el("span", null, p[1]));
        s.appendChild(d);
      });

    montaContinuar();
    var hostLab = $("#lab-home");
    hostLab.innerHTML = "";
    var resumoLab = LAB.resumoHome(M, U);
    if (resumoLab) hostLab.appendChild(resumoLab);

    var inp = $("#busca");
    if (inp.value !== busca) inp.value = busca;
    pintaGrade();
  }

  function montaContinuar() {
    var host = $("#continuar"); host.innerHTML = "";
    var recentes = M.filter(function (m) { return (PROG[m.id] || {}).visto; })
      .sort(function (a, b) { return PROG[b.id].visto - PROG[a.id].visto; })
      .slice(0, 3);
    if (!recentes.length) { host.hidden = true; return; }
    host.hidden = false;

    var h = el("div", "periodo-h");
    h.appendChild(el("span", null, "Continuar de onde parou"));
    h.appendChild(el("i"));
    host.appendChild(h);

    var row = el("div", "cont-row");
    recentes.forEach(function (m) {
      var p = prog(m.id);
      var b = el("button", "cont");
      pintaCores(b, m);
      b.appendChild(el("span", "cont-sig", m.sigla));
      var mid = el("span", "cont-txt");
      mid.appendChild(el("b", null, m.nome));
      mid.appendChild(el("small", null, pct(m.id) + "% em " + p.total + " respostas" +
        (p.erradas.length ? " · " + p.erradas.length + " a revisar" : "")));
      b.appendChild(mid);
      b.appendChild(el("span", "cont-go", "→"));
      b.onclick = function () { rotaMateria(m.id, m.questoes.length ? "quiz" : null); };
      row.appendChild(b);
    });
    host.appendChild(row);
  }

  function pintaGrade() {
    var host = $("#periodos"); host.innerHTML = "";
    var termo = semAcento(busca.trim());
    var lista = termo
      ? M.filter(function (m) { return semAcento(m.nome).indexOf(termo) >= 0 || semAcento(m.sigla).indexOf(termo) >= 0; })
      : M;

    $("#busca-info").textContent = termo
      ? (lista.length ? plural(lista.length, "matéria encontrada", "matérias encontradas") : "Nenhuma matéria com esse nome")
      : "";

    if (!lista.length) return;

    var periodos = {};
    lista.forEach(function (m) { (periodos[m.periodo] || (periodos[m.periodo] = [])).push(m); });

    Object.keys(periodos).sort(function (a, b) {
      return (Number(a) || 99) - (Number(b) || 99);
    }).forEach(function (p) {
      var sec = el("section", "periodo");
      var h = el("div", "periodo-h");
      h.appendChild(el("span", null, p === "0" ? "Outros materiais" : p + "º período"));
      h.appendChild(el("i"));
      sec.appendChild(h);
      var g = el("div", "grid");
      periodos[p].sort(function (a, b) { return b.questoes.length - a.questoes.length; })
        .forEach(function (m) { g.appendChild(cardMateria(m)); });
      sec.appendChild(g);
      host.appendChild(sec);
    });
  }

  function cardMateria(m) {
    var b = el("button", "mat");
    pintaCores(b, m);
    b.setAttribute("aria-label", "Abrir " + m.nome);
    b.appendChild(el("div", "mat-sig", m.sigla));
    b.appendChild(el("div", "mat-nome", m.nome));

    var tags = el("div", "mat-tags");
    function tag(n, lbl) { if (n) tags.appendChild(el("span", "tag", n + " " + lbl)); }
    tag((m.labs || []).length, "labs");
    tag(m.questoes.length, "questões");
    tag(m.flashcards.length, "cards");
    tag(m.resumos.length, "resumos");
    tag(m.colas.length, "colas");
    if (!m.questoes.length && !m.flashcards.length) {
      var n = m.arquivos.length + (m.links || []).length;
      tags.appendChild(el("span", "tag vazio", n ? n + " arquivos · sem banco" : "sem conteúdo"));
    }
    b.appendChild(tags);

    var p = prog(m.id);
    var bar = el("div", "bar");
    var fill = el("i");
    fill.style.width = (p.total ? pct(m.id) : 0) + "%";
    bar.appendChild(fill);
    b.appendChild(bar);
    b.appendChild(el("div", "mat-pct", p.total
      ? pct(m.id) + "% de acerto · " + p.total + " respondidas"
      : "ainda não estudado"));

    b.onclick = function () { rotaMateria(m.id); };
    return b;
  }

  // ============================================================ MATÉRIA
  function renderMateria(m, aba) {
    pintaCores($("#view-materia"), m);
    $("#m-sig").textContent = m.sigla;
    $("#m-sig").style.color = m.cor;
    $("#m-nome").textContent = m.nome;

    var p = prog(m.id);
    $("#m-sub").textContent = (m.periodo ? m.periodo + "º período · " : "") +
      plural(m.questoes.length, "questão", "questões") + " · " +
      plural(m.flashcards.length, "flashcard", "flashcards") +
      (p.total ? " · " + pct(m.id) + "% de acerto em " + p.total + " respostas" : "");

    var disp = ABAS.filter(function (a) { return a[2](m) > 0; });
    if (!disp.length) disp = [["material", "Material", function () { return 0; }]];
    if (!aba || !disp.some(function (a) { return a[0] === aba; })) {
      aba = disp[0][0];
      irPara("#/m/" + encodeURIComponent(m.id) + "/" + aba, true);
      rota.aba = aba;
    }

    var tb = $("#m-tabs"); tb.innerHTML = "";
    disp.forEach(function (a) {
      var t = el("a", "tab" + (a[0] === aba ? " on" : ""));
      t.href = "#/m/" + encodeURIComponent(m.id) + "/" + a[0];
      t.appendChild(document.createTextNode(a[1]));
      var n = a[2](m);
      if (n && !a[3]) t.appendChild(el("small", null, String(n)));
      tb.appendChild(t);
    });
    // CORREÇÃO NC-21: scrollIntoView herdava o scroll-behavior:smooth da página
    // e a barra "andava" sozinha ~1s depois de abrir a aba por link direto.
    // Posicionar pelo scrollLeft é instantâneo e não mexe na rolagem vertical.
    var atv = $(".tab.on", tb);
    if (atv) {
      var alvo = atv.offsetLeft - (tb.clientWidth - atv.offsetWidth) / 2;
      tb.scrollLeft = Math.max(0, alvo);
    }

    ABAS.forEach(function (a) { $("#pane-" + a[0]).classList.toggle("on", a[0] === aba); });
    // na aba Imprimir a impressora leva só a folha montada, sem cabeçalho nem abas
    document.body.classList.toggle("modo-imp", aba === "imprimir");

    ({ resumo: renderResumo, lab: renderLab, cards: renderCards, quiz: telaQuiz, simulado: telaSimulado,
       disc: renderDisc, colas: renderColas, material: renderMaterial, imprimir: renderImprimir })[aba](m);
  }

  // ---------------------------------------------------------- resumos
  function renderResumo(m) {
    var h = $("#pane-resumo"); h.innerHTML = "";
    if (!m.resumos.length) return vazio(h, "Sem resumo ainda",
      "Acrescente a chave \"resumos\" em bancos/" + m.id + ".json e rode o atualizar.bat.");

    var acoes = el("div", "row acoes");
    var bAbrir = el("button", "btn sm", "Abrir todos");
    acoes.appendChild(bAbrir);
    h.appendChild(acoes);

    var caixas = [];
    m.resumos.forEach(function (r, i) {
      var d = el("div", "res" + (i === 0 ? " open" : ""));
      var bt = el("button", "res-h");
      bt.setAttribute("aria-expanded", i === 0 ? "true" : "false");
      bt.appendChild(el("i", null, "›"));
      bt.appendChild(document.createTextNode(r.tema));
      var body = el("div", "res-b");
      body.appendChild(sanitizarHtml(r.html));
      bt.onclick = function () {
        d.classList.toggle("open");
        bt.setAttribute("aria-expanded", d.classList.contains("open") ? "true" : "false");
      };
      d.appendChild(bt); d.appendChild(body);
      h.appendChild(d);
      caixas.push(d);
    });

    var tudoAberto = false;
    bAbrir.onclick = function () {
      tudoAberto = !tudoAberto;
      caixas.forEach(function (d) { d.classList.toggle("open", tudoAberto); });
      bAbrir.textContent = tudoAberto ? "Fechar todos" : "Abrir todos";
    };
  }

  // ---------------------------------------------------------- laboratório
  // Todo o laboratório mora em template/lab/ (objeto window.LAB).
  function renderLab(m) { LAB.render($("#pane-lab"), m, rota.sub, U); }

  // ---------------------------------------------------------- flashcards
  var fcTema = null;
  function renderCards(m) {
    var h = $("#pane-cards"); h.innerHTML = "";
    if (!m.flashcards.length) return vazio(h, "Sem flashcards", "Nada cadastrado para esta matéria ainda.");

    var temas = temasDe(m.flashcards);
    if (fcTema && temas.indexOf(fcTema) < 0) fcTema = null;
    h.appendChild(barraChips(temas, m.flashcards, fcTema, function (t) { fcTema = t; renderCards(m); }));

    var lista = fcTema ? m.flashcards.filter(function (c) { return c.tema === fcTema; }) : m.flashcards;

    var acoes = el("div", "row acoes");
    var bEmb = el("button", "btn sm", "Embaralhar");
    var bVirar = el("button", "btn sm", "Virar todos");
    acoes.appendChild(bEmb); acoes.appendChild(bVirar);
    acoes.appendChild(el("span", "dica", "Clique no card para virar"));
    h.appendChild(acoes);

    var g = el("div", "fc-grid");
    h.appendChild(g);

    function pinta(cards) {
      g.innerHTML = "";
      cards.forEach(function (c) {
        var w = el("button", "fc");
        w.setAttribute("aria-label", "Flashcard: " + c.p);
        var inn = el("div", "fc-in");
        var f = el("div", "fc-f"), v = el("div", "fc-v");
        f.appendChild(el("div", "fc-t", c.tema));
        f.appendChild(el("div", "fc-q", c.p));
        v.appendChild(el("div", "fc-a", c.r));
        inn.appendChild(f); inn.appendChild(v); w.appendChild(inn);
        w.onclick = function () { w.classList.toggle("flip"); };
        g.appendChild(w);
      });
    }
    pinta(lista);
    bEmb.onclick = function () { pinta(shuffle(lista)); };
    var virados = false;
    bVirar.onclick = function () {
      virados = !virados;
      Array.prototype.forEach.call(g.children, function (c) { c.classList.toggle("flip", virados); });
      bVirar.textContent = virados ? "Desvirar todos" : "Virar todos";
    };
  }

  // ---------------------------------------------------------- helpers UI
  function vazio(host, titulo, texto) {
    var d = el("div", "empty");
    d.appendChild(el("b", null, titulo));
    d.appendChild(el("p", null, texto));
    host.appendChild(d);
  }
  function temasDe(lista) {
    var s = [];
    lista.forEach(function (x) { if (s.indexOf(x.tema) < 0) s.push(x.tema); });
    return s;
  }
  function barraChips(temas, lista, sel, onPick) {
    var c = el("div", "chips");
    function chip(label, valor, n) {
      var b = el("button", "chip" + (valor === sel ? " on" : ""));
      b.appendChild(document.createTextNode(label));
      if (n != null) b.appendChild(el("b", null, String(n)));
      b.onclick = function () { onPick(valor); };
      c.appendChild(b);
    }
    chip("Todos", null, lista.length);
    temas.forEach(function (t) {
      chip(t, t, lista.filter(function (x) { return x.tema === t; }).length);
    });
    return c;
  }

  // ---------------------------------------------------------- QUIZ
  var quiz = null;

  function pararQuiz() {
    if (quiz && quiz.timer) clearInterval(quiz.timer);
    if (quiz && quiz.simulado) apagarLS(CHAVE_SIM + quiz.m.id);
    quiz = null;
  }

  // CORREÇÃO NC-11: o relógio parava de ser desenhado mas continuava descontando
  // quando o aluno trocava de aba. Pausar e retomar resolve os dois lados.
  function pausarQuiz() {
    if (quiz && quiz.timer) { clearInterval(quiz.timer); quiz.timer = null; }
  }
  function retomarQuiz() {
    if (quiz && quiz.simulado && !quiz.timer && !quiz.fim) quiz.timer = setInterval(tick, 1000);
  }
  function temResposta() {
    return !!quiz && quiz.respostas.some(function (r) { return r != null; });
  }
  function textoDeSaida() {
    return quiz.simulado
      ? "Sair do simulado? O tempo e as respostas ficam guardados — você pode retomar de onde parou."
      : "Sair do quiz? O que já foi respondido fica salvo no seu progresso.";
  }

  // CORREÇÃO NC-10: simulado em andamento agora sobrevive a fechar a aba do
  // navegador. Guardado por matéria, com validade de um dia.
  var CHAVE_SIM = "estudo-ads-sim:";
  var VALIDADE_SIM = 24 * 60 * 60 * 1000;

  function guardarSimulado() {
    if (!quiz || !quiz.simulado || quiz.fim) return;
    gravarLS(CHAVE_SIM + quiz.m.id, {
      idx: quiz.idx, i: quiz.i, respostas: quiz.respostas,
      segundos: quiz.segundos, ts: Date.now()
    });
  }

  function simuladoGuardado(m) {
    var d = lerLS(CHAVE_SIM + m.id, null);
    if (!d || !d.idx || !d.idx.length) return null;
    if (Date.now() - (d.ts || 0) > VALIDADE_SIM) { apagarLS(CHAVE_SIM + m.id); return null; }
    if (d.idx.some(function (i) { return !m.questoes[i]; })) {
      apagarLS(CHAVE_SIM + m.id); return null;   // o banco mudou desde então
    }
    return d;
  }

  function telaQuiz(m) {
    if (quiz && !quiz.simulado && quiz.m.id === m.id) { pintaQuestao(); return; }
    if (quiz && quiz.m.id !== m.id) pararQuiz();
    var h = $("#pane-quiz"); h.innerHTML = "";
    var temas = temasDe(m.questoes);
    var p = prog(m.id);
    var cfgTema = null, cfgQtd = 5;

    var box = el("div", "box");
    box.appendChild(el("h2", null, "Montar um quiz"));
    box.appendChild(el("p", "sub", "Regra do tutor: 4 de 5 (80%) para liberar o próximo tema. O que você errar volta na revisão."));

    box.appendChild(el("h3", null, "Tema"));
    var chipsT = el("div", "chips");
    function pintaTemas() {
      chipsT.innerHTML = "";
      var todos = el("button", "chip" + (cfgTema === null ? " on" : ""));
      todos.appendChild(document.createTextNode("Todos"));
      todos.appendChild(el("b", null, String(m.questoes.length)));
      todos.onclick = function () { cfgTema = null; pintaTemas(); pintaQtd(); };
      chipsT.appendChild(todos);
      temas.forEach(function (t) {
        var n = m.questoes.filter(function (q) { return q.tema === t; }).length;
        var b = el("button", "chip" + (cfgTema === t ? " on" : ""));
        b.appendChild(document.createTextNode(t));
        b.appendChild(el("b", null, String(n)));
        // CORREÇÃO NC-09: a régua do tutor é 4 em 5; abaixo disso não dá para
        // aplicar o critério, e o aluno precisa saber disso antes de escolher.
        if (n < 5) {
          b.title = "Só " + plural(n, "questão", "questões") + " neste tema — " +
            "não dá para fechar o quiz de 5 do critério de 80%";
          b.appendChild(el("em", "chip-pc meio", "curto"));
        }
        var st = p.temas[t];
        if (st && st.t) {
          var pc = Math.round((st.c / st.t) * 100);
          b.appendChild(el("em", "chip-pc " + (pc >= 80 ? "ok" : pc >= 50 ? "meio" : "ruim"), pc + "%"));
        }
        b.onclick = function () { cfgTema = t; pintaTemas(); pintaQtd(); };
        chipsT.appendChild(b);
      });
    }
    box.appendChild(chipsT);

    box.appendChild(el("h3", null, "Quantidade"));
    var chipsQ = el("div", "chips");
    box.appendChild(chipsQ);

    function disponiveis() {
      return cfgTema ? m.questoes.filter(function (q) { return q.tema === cfgTema; }) : m.questoes;
    }
    function pintaQtd() {
      var n = disponiveis().length;
      if (cfgQtd > n) cfgQtd = n;
      chipsQ.innerHTML = "";
      [5, 10, 20, n].filter(function (v, i, a) { return v <= n && a.indexOf(v) === i; })
        .forEach(function (v) {
          var b = el("button", "chip" + (v === cfgQtd ? " on" : ""), v === n ? "Todas (" + n + ")" : String(v));
          b.onclick = function () { cfgQtd = v; pintaQtd(); };
          chipsQ.appendChild(b);
        });
    }
    pintaTemas(); pintaQtd();

    var acoes = el("div", "row acoes-fim");
    var bStart = el("button", "btn pri", "Começar quiz");
    bStart.onclick = function () { iniciaQuiz(m, shuffle(disponiveis()).slice(0, cfgQtd), false); };
    acoes.appendChild(bStart);

    var erradas = m.questoes.filter(function (q) { return p.erradas.indexOf(q.q.slice(0, 90)) >= 0; });
    if (erradas.length) {
      var bRev = el("button", "btn", "Revisar meus erros (" + erradas.length + ")");
      bRev.onclick = function () { iniciaQuiz(m, shuffle(erradas), false); };
      acoes.appendChild(bRev);
    }
    box.appendChild(acoes);
    h.appendChild(box);

    if (p.total) {
      var d = el("div", "box");
      d.appendChild(el("h2", null, "Desempenho por tema"));
      var algum = false;
      temas.forEach(function (t) {
        var st = p.temas[t];
        if (!st || !st.t) return;
        algum = true;
        var pc = Math.round((st.c / st.t) * 100);
        var linha = el("div", "desemp");
        var top = el("div", "desemp-t");
        top.appendChild(el("span", null, t));
        top.appendChild(el("span", "desemp-n", pc + "% (" + st.c + "/" + st.t + ")"));
        var bar = el("div", "bar");
        var i2 = el("i");
        i2.style.width = pc + "%";
        i2.style.background = pc >= 80 ? "var(--ok)" : pc >= 50 ? "var(--warn)" : "var(--err)";
        bar.appendChild(i2);
        linha.appendChild(top); linha.appendChild(bar);
        d.appendChild(linha);
      });
      if (algum) {
        var bz = el("button", "btn sm", "Zerar progresso desta matéria");
        bz.style.marginTop = "16px";
        bz.onclick = function () {
          if (confirm("Zerar todo o progresso de " + m.nome + "?")) {
            delete PROG[m.id]; salvar(); renderMateria(m, "quiz"); atualizaTopo();
          }
        };
        d.appendChild(bz);
        h.appendChild(d);
      }
    }
  }

  function iniciaQuiz(m, questoes, simulado, retomando) {
    pararQuiz();
    quiz = {
      m: m, qs: questoes, i: 0, acertos: 0, fim: false,
      respostas: new Array(questoes.length).fill(null),
      // CORREÇÃO NC-05: guarda quais já foram corrigidas, para o "← Anterior"
      // reabrir a questão em leitura em vez de deixar responder de novo
      corrigidas: new Array(questoes.length).fill(false),
      idx: questoes.map(function (q) { return m.questoes.indexOf(q); }),
      simulado: simulado
    };
    if (simulado) {
      quiz.segundos = questoes.length * 90;
      if (retomando) {
        quiz.i = Math.min(retomando.i || 0, questoes.length - 1);
        quiz.respostas = retomando.respostas.slice(0, questoes.length);
        quiz.segundos = retomando.segundos;
      }
      quiz.timer = setInterval(tick, 1000);
      guardarSimulado();
    }
    pintaQuestao();
  }

  function tick() {
    if (!quiz || !quiz.simulado || quiz.fim) return;
    quiz.segundos--;
    var t = $("#sim-timer");
    if (t) {
      var s = Math.max(quiz.segundos, 0);
      var mm = Math.floor(s / 60), ss = s % 60;
      t.textContent = (mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss;
      t.classList.toggle("urgente", quiz.segundos <= 60);
    }
    if (quiz.segundos % 5 === 0) guardarSimulado();
    if (quiz.segundos <= 0) { clearInterval(quiz.timer); finalizar(); }
  }

  function pintaQuestao() {
    var host = $("#pane-" + (quiz.simulado ? "simulado" : "quiz"));
    host.innerHTML = "";
    var q = quiz.qs[quiz.i];

    var top = el("div", "q-top");
    top.appendChild(el("span", "q-tema", q.tema));
    var dir = el("div", "row");
    dir.appendChild(el("span", "q-meta", (quiz.i + 1) + " / " + quiz.qs.length));
    if (quiz.simulado) {
      var t = el("span", "timer"); t.id = "sim-timer"; t.textContent = "--:--";
      dir.appendChild(t);
    }
    top.appendChild(dir);
    host.appendChild(top);

    var pr = el("div", "prog");
    var pi = el("i"); pi.style.width = (quiz.i / quiz.qs.length * 100) + "%";
    pr.appendChild(pi); host.appendChild(pr);

    host.appendChild(el("div", "q-txt", q.q));

    var opts = el("div", "opts");
    // CORREÇÃO NC-18: o leitor de tela precisa saber que são alternativas de uma
    // mesma questão — sem isso ele não anuncia "opção 2 de 4".
    opts.setAttribute("role", "radiogroup");
    opts.setAttribute("aria-label", "Alternativas da questão " + (quiz.i + 1));
    var letras = ["A", "B", "C", "D", "E", "F"];
    var jaCorrigida = !quiz.simulado && quiz.corrigidas[quiz.i];
    q.op.forEach(function (texto, idx) {
      var b = el("button", "opt");
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", quiz.respostas[quiz.i] === idx ? "true" : "false");
      b.appendChild(el("span", "opt-l", letras[idx]));
      b.appendChild(el("span", null, texto));
      if (quiz.simulado) {
        if (quiz.respostas[quiz.i] === idx) b.classList.add("sel");
        b.onclick = function () { marcar(idx, opts); };
      } else if (jaCorrigida) {
        b.classList.add("lock");
        if (idx === q.r) b.classList.add("ok");
        else if (idx === quiz.respostas[quiz.i]) b.classList.add("no");
        b.disabled = true;
      } else {
        b.onclick = function () { responder(idx, opts, q); };
      }
      opts.appendChild(b);
    });
    host.appendChild(opts);
    quiz.opts = opts;

    if (jaCorrigida) {
      opts.parentNode.insertBefore(
        explicacao(q, quiz.respostas[quiz.i] === q.r, true), opts.nextSibling);
    }

    var nav = el("div", "q-nav");
    var bVoltar = el("button", "btn sm", "← Anterior");
    bVoltar.disabled = quiz.i === 0;
    bVoltar.onclick = anterior;
    nav.appendChild(bVoltar);

    var dirNav = el("div", "row");
    var bSair = el("button", "btn sm", "Sair");
    bSair.onclick = sairDoQuiz;
    dirNav.appendChild(bSair);

    if (quiz.simulado) {
      var bFim = el("button", "btn", "Finalizar");
      bFim.onclick = function () {
        if (confirm("Finalizar e corrigir agora?")) { clearInterval(quiz.timer); finalizar(); }
      };
      dirNav.appendChild(bFim);
      var bProx = el("button", "btn pri", quiz.i === quiz.qs.length - 1 ? "Última questão" : "Próxima →");
      bProx.id = "btn-prox";
      bProx.disabled = quiz.i === quiz.qs.length - 1;
      bProx.onclick = proxima;
      dirNav.appendChild(bProx);
    } else {
      var bN = el("button", "btn pri",
        jaCorrigida && quiz.i === quiz.qs.length - 1 ? "Ver resultado" : "Próxima →");
      bN.id = "btn-prox"; bN.disabled = !jaCorrigida;
      bN.onclick = proxima;
      dirNav.appendChild(bN);
    }
    nav.appendChild(dirNav);
    host.appendChild(nav);

    var dica = el("div", "kbd");
    dica.innerHTML = "<kbd>A</kbd><kbd>B</kbd><kbd>C</kbd><kbd>D</kbd> responder · " +
      "<kbd>Enter</kbd> avançar · <kbd>Esc</kbd> sair";
    host.appendChild(dica);

    if (quiz.simulado) { host.appendChild(el("div", "qnav")); pintaNav(); tick(); }
  }

  function pintaNav() {
    var g = $(".qnav");
    if (!g) return;
    g.innerHTML = "";
    quiz.qs.forEach(function (_, i) {
      var b = el("button", (i === quiz.i ? "atual" : quiz.respostas[i] != null ? "feito" : ""), String(i + 1));
      b.setAttribute("aria-label", "Ir para a questão " + (i + 1));
      b.onclick = function () { quiz.i = i; pintaQuestao(); };
      g.appendChild(b);
    });
  }

  function marcar(idx, opts) {
    quiz.respostas[quiz.i] = idx;
    Array.prototype.forEach.call(opts.children, function (o, k) {
      o.classList.toggle("sel", k === idx);
      o.setAttribute("aria-checked", k === idx ? "true" : "false");
    });
    pintaNav();
    guardarSimulado();
  }

  // CORREÇÃO NC-14: sem aria-live o leitor de tela não anunciava nada depois de
  // responder — o aluno cego ficava sem saber se acertou.
  function explicacao(q, ok, silencioso) {
    var e = el("div", "exp");
    if (!silencioso) { e.setAttribute("role", "status"); e.setAttribute("aria-live", "polite"); }
    e.innerHTML = "<b>" + (ok ? "Correto." : "Resposta certa: " +
      ["A", "B", "C", "D", "E", "F"][q.r] + ". " + esc(q.op[q.r])) + "</b> " + esc(q.exp || "");
    return e;
  }

  function responder(idx, opts, q) {
    // CORREÇÃO NC-05: antes o "← Anterior" reabria a questão e responder de novo
    // contava outra vez no progresso — dava para inflar a estatística voltando.
    if (quiz.corrigidas[quiz.i]) return;
    quiz.corrigidas[quiz.i] = true;
    quiz.respostas[quiz.i] = idx;
    var ok = idx === q.r;
    if (ok) quiz.acertos++;
    registrar(quiz.m.id, q, ok);

    Array.prototype.forEach.call(opts.children, function (o, k) {
      o.classList.add("lock");
      o.disabled = true;
      o.setAttribute("aria-checked", k === idx ? "true" : "false");
      if (k === q.r) o.classList.add("ok");
      else if (k === idx) o.classList.add("no");
    });

    opts.parentNode.insertBefore(explicacao(q, ok), opts.nextSibling);

    var bN = $("#btn-prox");
    bN.disabled = false;
    bN.textContent = quiz.i === quiz.qs.length - 1 ? "Ver resultado" : "Próxima →";
    bN.focus();
  }

  function proxima() {
    if (!quiz) return;
    if (quiz.simulado) {
      if (quiz.i < quiz.qs.length - 1) { quiz.i++; pintaQuestao(); guardarSimulado(); }
      return;
    }
    if (!quiz.corrigidas[quiz.i]) return;
    if (quiz.i === quiz.qs.length - 1) finalizar();
    else { quiz.i++; pintaQuestao(); }
  }
  function anterior() {
    if (!quiz || quiz.i === 0) return;
    quiz.i--; pintaQuestao();
  }
  function sairDoQuiz() {
    if (!quiz) return;
    if (temResposta() && !quiz.fim && !confirm(textoDeSaida())) return;
    var m = quiz.m, era = quiz.simulado;
    pararQuiz();
    renderMateria(m, era ? "simulado" : "quiz");
    atualizaTopo();
  }

  function finalizar() {
    quiz.fim = true;
    var host = $("#pane-" + (quiz.simulado ? "simulado" : "quiz"));
    host.innerHTML = "";
    var total = quiz.qs.length;
    var acertos = quiz.simulado
      ? quiz.qs.reduce(function (a, q, i) { return a + (quiz.respostas[i] === q.r ? 1 : 0); }, 0)
      : quiz.acertos;
    if (quiz.simulado) {
      quiz.qs.forEach(function (q, i) { registrar(quiz.m.id, q, quiz.respostas[i] === q.r); });
    }
    var p = Math.round((acertos / total) * 100);
    var m = quiz.m, era = quiz.simulado;

    var box = el("div", "box");
    var sc = el("div", "res-score");
    sc.appendChild(el("div", "res-pct " + (p >= 80 ? "pass" : "fail"), p + "%"));
    sc.appendChild(el("div", "res-msg", acertos + " de " + total + " — " + mensagem(p)));
    box.appendChild(sc);

    var acoes = el("div", "row acoes-centro");
    var bRef = el("button", "btn pri", era ? "Novo simulado" : (p >= 80 ? "Novo quiz" : "Tentar de novo"));
    bRef.onclick = function () { pararQuiz(); renderMateria(m, era ? "simulado" : "quiz"); atualizaTopo(); };
    var bResumo = el("button", "btn", "Ver o resumo do conteúdo");
    bResumo.onclick = function () { pararQuiz(); rotaMateria(m.id, m.resumos.length ? "resumo" : "cards"); };
    var bHome = el("button", "btn", "Voltar às matérias");
    bHome.onclick = function () { pararQuiz(); rotaHome(); };
    acoes.appendChild(bRef);
    if (m.resumos.length || m.flashcards.length) acoes.appendChild(bResumo);
    acoes.appendChild(bHome);
    box.appendChild(acoes);
    host.appendChild(box);

    var rev = el("div", "box");
    rev.appendChild(el("h2", null, "Revisão das " + total + " questões"));
    quiz.qs.forEach(function (q, i) {
      var r = quiz.respostas[i];
      var ok = r === q.r;
      var d = el("div", "rev");
      var linha = el("div", "rev-q");
      linha.appendChild(el("i", "rev-i " + (r == null ? "vazio" : ok ? "ok" : "no"),
        r == null ? "○" : ok ? "✓" : "✕"));
      linha.appendChild(el("span", null, q.q));
      d.appendChild(linha);
      var det = el("div", "rev-d");
      var html = "";
      if (!ok) {
        html += r == null ? "<s>Ficou em branco.</s><br>" : "<s>Você marcou: " + esc(q.op[r]) + "</s><br>";
        html += "<em>Certa: " + esc(q.op[q.r]) + "</em>";
      } else {
        html += "<em>" + esc(q.op[q.r]) + "</em>";
      }
      if (q.exp) html += "<br>" + esc(q.exp);
      det.innerHTML = html;
      d.appendChild(det);
      rev.appendChild(d);
    });
    host.appendChild(rev);
    window.scrollTo(0, 0);
  }

  function mensagem(p) {
    if (p === 100) return "Gabaritou. Pode avançar de tema com tranquilidade.";
    if (p >= 80) return "Aprovado no critério de 80%. Tema liberado.";
    if (p >= 60) return "Perto. Releia o resumo do tema e refaça — a meta é 4 de 5.";
    if (p >= 40) return "Metade do caminho. Vale voltar ao resumo antes de tentar de novo.";
    return "Estude o resumo e os flashcards deste tema antes de repetir o quiz.";
  }

  // ---------------------------------------------------------- SIMULADO
  function telaSimulado(m) {
    if (quiz && quiz.simulado && quiz.m.id === m.id) { pintaQuestao(); return; }
    if (quiz && quiz.m.id !== m.id) pararQuiz();
    var h = $("#pane-simulado"); h.innerHTML = "";
    var box = el("div", "box");
    box.appendChild(el("h2", null, "Simulado de prova"));
    box.appendChild(el("p", "sub",
      "Questões embaralhadas de todos os temas, sem correção na hora e com tempo contado (1min30 por questão). A correção sai no final, com a revisão completa."));

    var n = Math.min(20, m.questoes.length);
    var chips = el("div", "chips");
    [10, 20, 30, m.questoes.length]
      .filter(function (v, i, a) { return v <= m.questoes.length && a.indexOf(v) === i; })
      .forEach(function (v) {
        var b = el("button", "chip" + (v === n ? " on" : ""), v + " questões");
        b.onclick = function () {
          n = v;
          Array.prototype.forEach.call(chips.children, function (c) { c.classList.remove("on"); });
          b.classList.add("on");
        };
        chips.appendChild(b);
      });
    box.appendChild(chips);

    var acoes = el("div", "row acoes-fim");
    var b = el("button", "btn pri", "Iniciar simulado");
    b.onclick = function () { iniciaQuiz(m, shuffle(m.questoes).slice(0, n), true); };
    acoes.appendChild(b);
    box.appendChild(acoes);
    h.appendChild(box);

    // CORREÇÃO NC-10: simulado interrompido não se perde mais
    var guardado = simuladoGuardado(m);
    if (guardado) {
      var feitas = guardado.respostas.filter(function (r) { return r != null; }).length;
      var mm = Math.floor(Math.max(guardado.segundos, 0) / 60);
      var cx = el("div", "box");
      cx.appendChild(el("h2", null, "Você tem um simulado pela metade"));
      cx.appendChild(el("p", "sub", guardado.idx.length + " questões · " + feitas +
        " respondidas · " + mm + " min restantes · começado " + quando(guardado.ts)));
      var linha = el("div", "row acoes-fim");
      var bR = el("button", "btn pri", "Retomar de onde parei");
      bR.onclick = function () {
        iniciaQuiz(m, guardado.idx.map(function (i) { return m.questoes[i]; }), true, guardado);
      };
      var bD = el("button", "btn sm", "Descartar");
      bD.onclick = function () {
        if (confirm("Descartar o simulado em andamento?")) { apagarLS(CHAVE_SIM + m.id); telaSimulado(m); }
      };
      linha.appendChild(bR); linha.appendChild(bD);
      cx.appendChild(linha);
      h.insertBefore(cx, h.firstChild);
    }
  }

  function quando(ts) {
    var min = Math.round((Date.now() - ts) / 60000);
    if (min < 1) return "agora há pouco";
    if (min < 60) return "há " + min + " min";
    var hr = Math.round(min / 60);
    return "há " + plural(hr, "hora", "horas");
  }

  // ---------------------------------------------------------- discursivas
  // CORREÇÃO NC-06: o texto da discursiva sumia ao trocar de aba. Agora fica
  // guardado por matéria e questão, e volta sozinho quando você reabre.
  var CHAVE_DISC = "estudo-ads-disc:";
  var rascunhos = null;

  function carregaRascunhos() {
    if (!rascunhos) rascunhos = lerLS(CHAVE_DISC, {}) || {};
    return rascunhos;
  }
  function salvaRascunho(mid, i, texto) {
    var r = carregaRascunhos();
    var chave = mid + "#" + i;
    if (texto && texto.trim()) r[chave] = { t: texto, ts: Date.now() };
    else delete r[chave];
    return gravarLS(CHAVE_DISC, r);
  }
  function leRascunho(mid, i) {
    var d = carregaRascunhos()[mid + "#" + i];
    return d ? d.t : "";
  }

  function renderDisc(m) {
    var h = $("#pane-disc"); h.innerHTML = "";
    h.appendChild(el("p", "sub", "Escreva sua resposta antes de abrir o gabarito — é assim que a memória fixa. O que você digitar fica salvo neste navegador."));
    m.discursivas.forEach(function (d, i) {
      var c = el("div", "disc");
      c.appendChild(el("div", "fc-t", d.tema));
      c.appendChild(el("div", "disc-q", d.q));
      var ta = el("textarea");
      ta.placeholder = "Sua resposta...";
      ta.value = leRascunho(m.id, i);
      ta.setAttribute("aria-label", "Sua resposta para: " + d.q);
      c.appendChild(ta);

      var estado = el("span", "dica");
      if (ta.value) estado.textContent = "rascunho salvo";
      var espera = null;
      ta.addEventListener("input", function () {
        clearTimeout(espera);
        estado.textContent = "digitando…";
        espera = setTimeout(function () {
          var ok = salvaRascunho(m.id, i, ta.value);
          estado.textContent = !ta.value.trim() ? ""
            : ok ? "rascunho salvo" : "não consegui salvar neste navegador";
        }, 600);
      });

      var linha = el("div", "row");
      linha.style.marginTop = "10px";
      var b = el("button", "btn sm", "Mostrar gabarito");
      b.onclick = function () {
        c.classList.toggle("abre");
        b.textContent = c.classList.contains("abre") ? "Ocultar gabarito" : "Mostrar gabarito";
      };
      linha.appendChild(b);
      var bL = el("button", "btn sm", "Limpar");
      bL.onclick = function () {
        if (!ta.value || confirm("Apagar o que você escreveu nesta questão?")) {
          ta.value = ""; salvaRascunho(m.id, i, ""); estado.textContent = ""; ta.focus();
        }
      };
      linha.appendChild(bL);
      linha.appendChild(estado);
      c.appendChild(linha);
      c.appendChild(el("div", "disc-r", d.r));
      h.appendChild(c);
    });
  }

  // ---------------------------------------------------------- colas
  function renderColas(m) {
    var h = $("#pane-colas"); h.innerHTML = "";
    h.appendChild(el("p", "sub", "Para a última meia hora antes da prova."));
    m.colas.forEach(function (c) {
      var d = el("div", "cola");
      d.appendChild(el("h4", null, c.titulo));
      if (c.mnemonico) d.appendChild(el("div", "cola-m", c.mnemonico));
      var ul = el("ul");
      (c.pontos || []).forEach(function (p) {
        var li = el("li");
        li.innerHTML = esc(p).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
        ul.appendChild(li);
      });
      d.appendChild(ul);
      h.appendChild(d);
    });
  }

  // ---------------------------------------------------------- imprimir
  // Monta uma folha só com o que o aluno escolheu e manda para a impressora
  // (ou "Salvar como PDF"). A prévia na tela é a própria folha: o @media print
  // esconde o resto da página. As escolhas ficam guardadas neste navegador.
  var CHAVE_IMP = "estudo-ads-imp";
  var LETRAS = ["A", "B", "C", "D", "E", "F"];
  var TIPOS_IMP = [
    ["resumos", "Resumos", function (m) { return m.resumos.length; }],
    ["cards", "Flashcards", function (m) { return m.flashcards.length; }],
    ["questoes", "Questões", function (m) { return m.questoes.length; }],
    ["simulado", "Simulado", function (m) { return m.questoes.length >= 5 ? m.questoes.length : 0; }],
    ["disc", "Discursivas", function (m) { return m.discursivas.length; }],
    ["colas", "Colas", function (m) { return m.colas.length; }],
    ["lab", "Laboratório", function (m) { return (m.labs || []).length; }]
  ];
  var impTemas = { mid: null, sel: null };   // sel null = todos os temas
  var sorteios = {};                         // ordem embaralhada fica fixa até "Sortear de novo"
  var respostasLab = {};                     // "mid#lab" → Promise do índice certo no prever

  function cfgImp() {
    var c = lerLS(CHAVE_IMP, null) || {};
    return {
      tipos: Array.isArray(c.tipos) ? c.tipos : ["resumos", "questoes", "colas"],
      gabarito: /^(secao|fim|nao)$/.test(c.gabarito) ? c.gabarito : "secao",
      explicacao: c.explicacao !== false,
      embaralhar: !!c.embaralhar,
      simQtd: Number(c.simQtd) || 20,
      cardsModo: c.cardsModo === "lista" ? "lista" : "recortar",
      linhas: c.linhas != null ? Number(c.linhas) : 8,
      cabecalho: c.cabecalho !== false
    };
  }

  function sorteado(chave, lista, n) {
    var s = sorteios[chave];
    if (!s || s.length !== Math.min(n, lista.length) ||
        s.some(function (q) { return lista.indexOf(q) < 0; })) {
      s = sorteios[chave] = shuffle(lista).slice(0, n);
    }
    return s;
  }

  function renderImprimir(m) {
    var h = $("#pane-imprimir"); h.innerHTML = "";
    var cfg = cfgImp();
    if (impTemas.mid !== m.id) impTemas = { mid: m.id, sel: null };
    var disp = TIPOS_IMP.filter(function (t) { return t[2](m) > 0; });
    var temas = temasDe([].concat(m.resumos, m.flashcards, m.questoes, m.discursivas, m.labs || []));

    var box = el("div", "box imp-cfg");
    box.appendChild(el("h2", null, "Montar material para imprimir"));
    box.appendChild(el("p", "sub", "Escolha o que entra na folha. A prévia abaixo é exatamente o que sai — " +
      "para gerar PDF, escolha “Salvar como PDF” como impressora."));

    // chips de várias escolhas (sel = lista) ou de uma só (sel = valor)
    function grupo(titulo, opcoes, multi, valor, onMuda) {
      box.appendChild(el("h3", null, titulo));
      var c = el("div", "chips");
      function pinta() {
        c.innerHTML = "";
        opcoes.forEach(function (o) {
          var on = multi ? valor.indexOf(o[0]) >= 0 : valor === o[0];
          var b = el("button", "chip" + (on ? " on" : ""));
          b.setAttribute("aria-pressed", on ? "true" : "false");
          b.appendChild(document.createTextNode(o[1]));
          if (o[2] != null) b.appendChild(el("b", null, String(o[2])));
          b.onclick = function () {
            if (multi) {
              var i = valor.indexOf(o[0]);
              if (i >= 0) valor.splice(i, 1); else valor.push(o[0]);
            } else valor = o[0];
            pinta();
            onMuda(valor);
          };
          c.appendChild(b);
        });
      }
      pinta();
      box.appendChild(c);
    }
    function muda() { gravarLS(CHAVE_IMP, cfg); atualiza(); }

    var tiposSel = cfg.tipos.filter(function (t) { return disp.some(function (d) { return d[0] === t; }); });
    grupo("O que imprimir", disp.map(function (t) { return [t[0], t[1], t[2](m)]; }), true, tiposSel,
      function (v) { cfg.tipos = v; muda(); });

    if (temas.length > 1) {
      var temasSel = impTemas.sel ? impTemas.sel.slice() : [];
      box.appendChild(el("h3", null, "Temas"));
      box.appendChild(el("p", "imp-nota", "Nenhum marcado = todos. As colas não têm tema e saem sempre inteiras."));
      var ct = el("div", "chips");
      temas.forEach(function (t) {
        var b = el("button", "chip" + (temasSel.indexOf(t) >= 0 ? " on" : ""), t);
        b.setAttribute("aria-pressed", temasSel.indexOf(t) >= 0 ? "true" : "false");
        b.onclick = function () {
          var i = temasSel.indexOf(t);
          if (i >= 0) temasSel.splice(i, 1); else temasSel.push(t);
          b.classList.toggle("on", i < 0);
          b.setAttribute("aria-pressed", i < 0 ? "true" : "false");
          impTemas.sel = temasSel.length ? temasSel.slice() : null;
          atualiza();
        };
        ct.appendChild(b);
      });
      box.appendChild(ct);
    }

    grupo("Gabarito", [["secao", "Depois de cada parte"], ["fim", "Tudo no final"], ["nao", "Sem gabarito"]],
      false, cfg.gabarito, function (v) { cfg.gabarito = v; muda(); });

    var opQtd = [10, 20, 30, 50].filter(function (v) { return v < m.questoes.length; })
      .map(function (v) { return [v, v + " questões"]; });
    opQtd.push([999, "Todas (" + m.questoes.length + ")"]);
    if (m.questoes.length >= 5) {
      grupo("Questões no simulado", opQtd, false, cfg.simQtd >= m.questoes.length ? 999 : cfg.simQtd,
        function (v) { cfg.simQtd = v; muda(); });
    }
    if (m.flashcards.length) {
      grupo("Flashcards", [["recortar", "Para recortar (frente | verso)"], ["lista", "Lista corrida"]],
        false, cfg.cardsModo, function (v) { cfg.cardsModo = v; muda(); });
    }
    if (m.discursivas.length || (m.labs || []).length) {
      grupo("Linhas para responder (discursivas e desafios do laboratório)", [[0, "Nenhuma"], [5, "5"], [8, "8"], [12, "12"]],
        false, cfg.linhas, function (v) { cfg.linhas = v; muda(); });
    }

    box.appendChild(el("h3", null, "Opções"));
    var ops = el("div", "imp-op");
    [["explicacao", "Explicação das questões no gabarito"],
     ["embaralhar", "Embaralhar as questões"],
     ["cabecalho", "Campos de nome, data e nota"]].forEach(function (o) {
      var lb = el("label", "imp-tg");
      var cb = el("input");
      cb.type = "checkbox"; cb.checked = !!cfg[o[0]];
      cb.onchange = function () { cfg[o[0]] = cb.checked; muda(); };
      lb.appendChild(cb);
      lb.appendChild(document.createTextNode(o[1]));
      ops.appendChild(lb);
    });
    box.appendChild(ops);

    var acoes = el("div", "row acoes-fim");
    var bImp = el("button", "btn pri", "Imprimir / salvar PDF");
    bImp.onclick = function () { window.print(); };
    var bSort = el("button", "btn", "Sortear de novo");
    bSort.title = "Novo sorteio do simulado e nova ordem das questões embaralhadas";
    bSort.onclick = function () { sorteios = {}; atualiza(); };
    var resumoFolha = el("span", "dica");
    acoes.appendChild(bImp); acoes.appendChild(bSort); acoes.appendChild(resumoFolha);
    box.appendChild(acoes);
    h.appendChild(box);

    var host = el("div");
    h.appendChild(host);

    var vez = 0;
    function atualiza() {
      host.innerHTML = "";
      var r = folhaImp(m, cfg, impTemas.sel);
      host.appendChild(r.folha);
      bImp.disabled = !r.itens;
      bSort.hidden = !(cfg.tipos.indexOf("simulado") >= 0 || cfg.tipos.indexOf("lab") >= 0 ||
        (cfg.embaralhar && cfg.tipos.indexOf("questoes") >= 0));
      resumoFolha.textContent = r.itens ? plural(r.itens, "item", "itens") + " na folha" : "";
      // o gabarito do "prever" sai de rodar o código: segura a impressão até chegar
      if (r.pendente) {
        var esta = ++vez;
        bImp.disabled = true;
        resumoFolha.textContent = "rodando os exercícios do laboratório para montar o gabarito…";
        r.pendente.then(function () {
          if (esta !== vez) return;
          bImp.disabled = !r.itens;
          resumoFolha.textContent = plural(r.itens, "item", "itens") + " na folha";
        });
      } else vez++;
    }
    atualiza();
  }

  function folhaImp(m, cfg, temasSel) {
    var folha = el("div", "impressao");
    var itens = 0;
    var gabs = [];
    function filtra(lista) {
      return temasSel ? lista.filter(function (x) { return temasSel.indexOf(x.tema) >= 0; }) : lista;
    }
    function tem(t) { return cfg.tipos.indexOf(t) >= 0; }
    function cabeca(s, titulo, info) {
      var hd = el("header", "imp-h");
      hd.appendChild(el("h2", null, titulo));
      hd.appendChild(el("div", "imp-m", m.sigla + " · " + m.nome + (info ? " · " + info : "")));
      s.appendChild(hd);
    }
    function secao(titulo, info, aluno) {
      var s = el("section", "imp-sec");
      cabeca(s, titulo, info);
      if (aluno && cfg.cabecalho) {
        var d = el("div", "imp-aluno");
        [["Nome", 3], ["Data", 1], ["Nota", 1]].forEach(function (x) {
          var c = el("span"); c.style.flex = x[1];
          c.appendChild(el("b", null, x[0] + ":"));
          c.appendChild(el("i"));
          d.appendChild(c);
        });
        s.appendChild(d);
      }
      folha.appendChild(s);
      return s;
    }
    function gabarito(titulo, montar) {
      if (cfg.gabarito === "nao") return;
      var s = el("section", "imp-sec imp-gab");
      if (cfg.gabarito === "secao") { cabeca(s, "Gabarito — " + titulo); folha.appendChild(s); }
      else { s.className = "imp-gab-parte"; s.appendChild(el("h3", null, titulo)); gabs.push(s); }
      montar(s);
    }
    function questoesEm(s, lista) {
      var ol = el("ol", "imp-q");
      lista.forEach(function (q) {
        var li = el("li");
        li.appendChild(el("div", "imp-qt", q.q));
        var ops = el("ol", "imp-ops");
        q.op.forEach(function (o, i) {
          var op = el("li");
          op.appendChild(el("b", null, LETRAS[i] + ")"));
          op.appendChild(document.createTextNode(" " + o));
          ops.appendChild(op);
        });
        li.appendChild(ops);
        ol.appendChild(li);
      });
      s.appendChild(ol);
    }
    function gabaritoQuestoes(s, lista) {
      var g = el("div", "imp-gab-grade");
      lista.forEach(function (q, i) {
        var c = el("span");
        c.appendChild(el("b", null, (i + 1) + "."));
        c.appendChild(document.createTextNode(" " + LETRAS[q.r]));
        g.appendChild(c);
      });
      s.appendChild(g);
      if (!cfg.explicacao) return;
      var ol = el("ol", "imp-exp");
      lista.forEach(function (q) {
        var li = el("li");
        li.appendChild(el("b", null, LETRAS[q.r] + ") " + q.op[q.r]));
        if (q.exp) li.appendChild(document.createTextNode(" — " + q.exp));
        ol.appendChild(li);
      });
      s.appendChild(ol);
    }

    // ---- resumos
    var resumos = tem("resumos") ? filtra(m.resumos) : [];
    if (resumos.length) {
      var sR = secao("Resumo", plural(resumos.length, "tema", "temas"));
      resumos.forEach(function (r) {
        var d = el("div", "imp-res");
        d.appendChild(el("h3", null, r.tema));
        d.appendChild(sanitizarHtml(r.html));
        sR.appendChild(d);
      });
      itens += resumos.length;
    }

    // ---- flashcards
    var cards = tem("cards") ? filtra(m.flashcards) : [];
    if (cards.length) {
      var sF = secao("Flashcards", plural(cards.length, "card", "cards"));
      if (cfg.cardsModo === "recortar") {
        sF.appendChild(el("p", "imp-nota", "Recorte na linha tracejada e dobre ao meio: pergunta de um lado, resposta do outro."));
        var tb = el("table", "imp-fc");
        cards.forEach(function (c) {
          var tr = el("tr");
          var f = el("td");
          f.appendChild(el("small", null, c.tema));
          f.appendChild(el("div", null, c.p));
          tr.appendChild(f);
          tr.appendChild(el("td", null, c.r));
          tb.appendChild(tr);
        });
        sF.appendChild(tb);
      } else {
        var ol = el("ol", "imp-lista");
        cards.forEach(function (c) {
          var li = el("li");
          li.appendChild(el("b", null, c.p));
          li.appendChild(el("div", null, c.r));
          ol.appendChild(li);
        });
        sF.appendChild(ol);
      }
      itens += cards.length;
    }

    // ---- questões
    var qs = tem("questoes") ? filtra(m.questoes) : [];
    if (qs.length) {
      if (cfg.embaralhar) qs = sorteado("q:" + m.id + ":" + (temasSel || []).join("|"), qs, qs.length);
      var sQ = secao("Questões", plural(qs.length, "questão", "questões"), true);
      questoesEm(sQ, qs);
      gabarito("Questões", function (s) { gabaritoQuestoes(s, qs); });
      itens += qs.length;
    }

    // ---- simulado
    var base = tem("simulado") ? filtra(m.questoes) : [];
    if (base.length) {
      var sim = sorteado("s:" + m.id + ":" + (temasSel || []).join("|"), base, Math.min(cfg.simQtd, base.length));
      var min = Math.ceil(sim.length * 1.5);
      var sS = secao("Simulado de prova", sim.length + " questões · " + min + " min", true);
      sS.appendChild(el("p", "imp-nota", "Tempo sugerido: " + min + " minutos (1min30 por questão). " +
        "Marque uma alternativa por questão e passe para a folha de respostas no final."));
      questoesEm(sS, sim);
      var fr = el("div", "imp-folha");
      fr.appendChild(el("h3", null, "Folha de respostas"));
      var grade = el("div", "imp-folha-g");
      sim.forEach(function (q, i) {
        var lin = el("div");
        lin.appendChild(el("b", null, String(i + 1)));
        q.op.forEach(function (_, k) { lin.appendChild(el("span", null, LETRAS[k])); });
        grade.appendChild(lin);
      });
      fr.appendChild(grade);
      sS.appendChild(fr);
      gabarito("Simulado", function (s) { gabaritoQuestoes(s, sim); });
      itens += sim.length;
    }

    // ---- discursivas
    var disc = tem("disc") ? filtra(m.discursivas) : [];
    if (disc.length) {
      var sD = secao("Questões discursivas", plural(disc.length, "questão", "questões"), true);
      var olD = el("ol", "imp-q");
      disc.forEach(function (d) {
        var li = el("li");
        li.appendChild(el("div", "imp-qt", d.q));
        if (cfg.linhas) {
          var ln = el("div", "imp-linhas");
          for (var k = 0; k < cfg.linhas; k++) ln.appendChild(el("i"));
          li.appendChild(ln);
        }
        olD.appendChild(li);
      });
      sD.appendChild(olD);
      gabarito("Discursivas", function (s) {
        var ol = el("ol", "imp-exp");
        disc.forEach(function (d) { ol.appendChild(el("li", null, d.r)); });
        s.appendChild(ol);
      });
      itens += disc.length;
    }

    // ---- colas (sem tema: saem sempre inteiras)
    if (tem("colas") && m.colas.length) {
      var sC = secao("Colas", "revisão de última hora");
      var g = el("div", "imp-colas");
      m.colas.forEach(function (c) {
        var d = el("div", "imp-cola");
        d.appendChild(el("h4", null, c.titulo));
        if (c.mnemonico) d.appendChild(el("p", "imp-mn", c.mnemonico));
        var ul = el("ul");
        (c.pontos || []).forEach(function (p) {
          var li = el("li");
          li.innerHTML = esc(p).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
          ul.appendChild(li);
        });
        d.appendChild(ul);
        g.appendChild(d);
      });
      sC.appendChild(g);
      itens += m.colas.length;
    }

    // ---- laboratório
    var pendente = null;
    var labs = tem("lab") ? filtra(m.labs || []) : [];
    if (labs.length) {
      var sL = secao("Laboratório", plural(labs.length, "exercício", "exercícios"), true);
      sL.appendChild(el("p", "imp-nota", "No papel, sem rodar: leia o código, responda e depois confira " +
        "no site (aba Laboratório) rodando de verdade."));
      var olL = el("ol", "imp-q imp-lab");
      var montar = {};                       // id → blocos embaralhados do "montar"
      labs.forEach(function (lab) {
        var li = el("li");
        var hd = el("div", "imp-qt", lab.titulo);
        hd.appendChild(el("span", "imp-lab-tag", (LAB.NOMES_TIPO[lab.tipo] || lab.tipo) + " · " +
          (LAB.NOMES_LING[lab.linguagem] || lab.linguagem) + " · nível " + lab.nivel));
        li.appendChild(hd);
        if (lab.enunciado) { var en = el("div", "imp-lab-en"); LAB.mdEm(en, lab.enunciado); li.appendChild(en); }

        if (lab.tipo === "parsons") {
          var blocos = sorteado("p:" + m.id + ":" + lab.id, (lab.linhas || []).concat(lab.distratores || []), 999);
          montar[lab.id] = blocos;
          if (lab.codigo) li.appendChild(el("pre", null, lab.codigo));
          var nd = (lab.distratores || []).length;
          li.appendChild(el("p", "imp-nota", "Numere os blocos na ordem certa" +
            (nd ? "; " + plural(nd, "bloco é armadilha", "blocos são armadilhas") + " e fica" + (nd > 1 ? "m" : "") + " de fora (marque com ✕)." : ".")));
          var ul = el("ul", "imp-blocos");
          if (lab.linguagem !== "texto") ul.className += " imp-mono";
          blocos.forEach(function (b) { ul.appendChild(el("li", null, b)); });
          li.appendChild(ul);
        } else {
          if (lab.codigo) li.appendChild(el("pre", null, lab.codigo));
        }

        if (lab.tipo === "prever" || (lab.tipo === "passo" && lab.pergunta)) {
          li.appendChild(el("div", "imp-lab-p", LAB.perguntaDe(lab)));
          if (lab.opcoes && lab.opcoes.length) {
            var ops = el("ol", "imp-ops");
            lab.opcoes.forEach(function (o, i) {
              var op = el("li");
              op.appendChild(el("b", null, LETRAS[i] + ")"));
              op.appendChild(el("span", "imp-mono", " " + o));
              ops.appendChild(op);
            });
            li.appendChild(ops);
          }
        }
        if (lab.tipo === "explorar" && lab.experimentos && lab.experimentos.length) {
          li.appendChild(el("div", "imp-lab-p", "Experimente (e anote o que acha que muda):"));
          var ex = el("ul");
          lab.experimentos.forEach(function (x) { var e = el("li"); LAB.mdEm(e, x); ex.appendChild(e); });
          li.appendChild(ex);
        }
        if (lab.tipo === "desafio" || (lab.tipo === "prever" && !(lab.opcoes || []).length)) {
          if (cfg.linhas) {
            var ln = el("div", "imp-linhas");
            for (var k = 0; k < cfg.linhas; k++) ln.appendChild(el("i"));
            li.appendChild(ln);
          }
        }
        olL.appendChild(li);
      });
      sL.appendChild(olL);

      var jobs = [];
      gabarito("Laboratório", function (s) {
        var ol = el("ol", "imp-exp imp-lab-gab");
        labs.forEach(function (lab) {
          var li = el("li");
          li.appendChild(el("b", null, lab.titulo + ": "));
          if (lab.tipo === "prever" && (lab.opcoes || []).length) {
            var alvo = el("span", "imp-calc", "calculando…");
            li.appendChild(alvo);
            jobs.push(function () {
              return respostaPrever(m, lab).then(function (i) {
                alvo.className = "";
                alvo.textContent = i >= 0 ? LETRAS[i] + ") " + lab.opcoes[i]
                  : "rode no site para conferir";
              });
            });
          } else if (lab.tipo === "passo" && lab.pergunta) {
            var ip = LAB.indiceResposta(lab);
            li.appendChild(document.createTextNode(ip >= 0 ? LETRAS[ip] + ") " + lab.opcoes[ip] : "rode no site para conferir"));
          } else if (lab.tipo === "parsons") {
            var certa = el("ol", "imp-blocos-ok" + (lab.linguagem !== "texto" ? " imp-mono" : ""));
            (lab.linhas || []).forEach(function (l) { certa.appendChild(el("li", null, l)); });
            li.appendChild(certa);
            var arm = (lab.distratores || []).map(function (d) { return montar[lab.id].indexOf(d) + 1; });
            if (arm.length) li.appendChild(el("div", null, "Armadilhas: bloco" + (arm.length > 1 ? "s " : " ") + arm.join(", ")));
          } else if (lab.tipo === "desafio" && lab.solucao) {
            li.appendChild(el("span", null, "uma solução possível:"));
            li.appendChild(el("pre", null, lab.solucao));
          } else {
            li.appendChild(el("span", null, "exercício aberto — sem resposta única."));
          }
          if (cfg.explicacao && lab.explicacao) {
            var e = el("div", "imp-lab-exp"); LAB.mdEm(e, lab.explicacao); li.appendChild(e);
          }
          ol.appendChild(li);
        });
        s.appendChild(ol);
      });
      // um de cada vez: os motores (Pyodide, Prolog, SQL) são pesados
      if (jobs.length) {
        pendente = jobs.reduce(function (p, j) { return p.then(j); }, Promise.resolve());
      }
      itens += labs.length;
    }

    if (gabs.length) {
      var sG = secao("Gabarito");
      gabs.forEach(function (p) { sG.appendChild(p); });
    }
    if (!itens) {
      folha.className = "impressao imp-vazia";
      folha.appendChild(el("p", null, temasSel
        ? "Nada desses tipos nos temas marcados. Marque outro tipo ou outro tema."
        : "Marque acima o que você quer imprimir."));
    }
    return { folha: folha, itens: itens, pendente: pendente };
  }

  // A resposta certa do "prever" não está escrita no banco: é o que o código
  // imprime de verdade. Roda uma vez no motor real e guarda.
  function respostaPrever(m, lab) {
    var chave = m.id + "#" + lab.id;
    if (!respostasLab[chave]) {
      respostasLab[chave] = LAB.executarLab(m, lab, lab.codigo || "", { comTestes: false })
        .then(function (r) {
          var real = LAB.normalizar(LAB.alvoDe(lab, r));
          return lab.opcoes.map(LAB.normalizar).indexOf(real);
        })
        .catch(function () { delete respostasLab[chave]; return -1; });
    }
    return respostasLab[chave];
  }

  // ---------------------------------------------------------- material
  function renderMaterial(m) {
    var h = $("#pane-material"); h.innerHTML = "";
    var links = m.links || [];

    if (!m.arquivos.length && !links.length) {
      return vazio(h, "Nenhum arquivo encontrado",
        "A pasta desta matéria está vazia ou ainda não foi criada em " + DADOS.raiz + ".");
    }

    if (links.length) {
      h.appendChild(el("h3", null, "Na web"));
      links.forEach(function (l) {
        var a = el("a", "arq");
        a.href = l.url; a.target = "_blank"; a.rel = "noopener";
        a.appendChild(el("span", "arq-x", /github\.io/.test(l.url) ? "web" : "repo"));
        var mid = el("span", "arq-n solto");
        mid.appendChild(el("b", null, l.nome));
        if (l.desc) {
          mid.appendChild(document.createElement("br"));
          mid.appendChild(el("small", null, l.desc));
        }
        a.appendChild(mid);
        a.appendChild(el("span", "arq-s", "↗"));
        h.appendChild(a);
      });
    }

    if (!m.arquivos.length) return;
    if (links.length) h.appendChild(el("h3", null, "Na pasta"));
    if (!DADOS.local) {
      h.appendChild(el("div", "aviso",
        "Esta é a versão publicada — estes arquivos ficam no seu computador, então abaixo é só a listagem. Abra o index.html da pasta Estudo-ADS para clicar e abrir cada PDF."));
    }
    h.appendChild(el("p", "sub", plural(m.arquivos.length, "arquivo", "arquivos") + " em " + m.pasta));
    m.arquivos.forEach(function (a) {
      var node = DADOS.local ? el("a", "arq") : el("div", "arq");
      if (DADOS.local) { node.href = a.href; node.target = "_blank"; }
      node.appendChild(el("span", "arq-x", a.ext));
      node.appendChild(el("span", "arq-n", a.nome));
      node.appendChild(el("span", "arq-s", a.tam));
      h.appendChild(node);
    });
  }

  // ============================================================ teclado
  document.addEventListener("keydown", function (e) {
    var alvo = e.target || {};
    var digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName || "");

    if (rota.vista === "home") {
      if (!digitando && e.key === "/") { e.preventDefault(); $("#busca").focus(); }
      if (digitando && e.key === "Escape") { alvo.blur(); }
      return;
    }
    if (rota.aba === "lab" && !quiz) {
      if (!LAB.tecla(e) && !digitando && e.key === "Escape") { e.preventDefault(); rotaHome(); }
      return;
    }
    if (digitando) return;

    if (!quiz) {
      if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); rotaHome(); }
      return;
    }

    if (e.key === "Escape") { e.preventDefault(); sairDoQuiz(); return; }
    if (quiz.fim) return;

    if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); proxima(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); anterior(); return; }

    var i = -1;
    var k = String(e.key).toUpperCase();
    if (/^[A-F]$/.test(k)) i = k.charCodeAt(0) - 65;
    else if (/^[1-6]$/.test(k)) i = Number(k) - 1;
    if (i >= 0 && quiz.opts && quiz.opts.children[i]) {
      e.preventDefault();
      quiz.opts.children[i].click();
    }
  });

  // ============================================================ boot
  $("#brand").onclick = rotaHome;
  $("#btn-voltar").onclick = function () {
    // a matéria sem aba não é uma tela de verdade (redireciona para a primeira),
    // então o voltar leva direto às matérias. Se houver quiz em andamento, quem
    // pergunta é o roteador — mesma confirmação do voltar do navegador.
    rotaHome();
  };
  $("#busca").addEventListener("input", function (e) {
    busca = e.target.value;
    pintaGrade();
  });
  $("#ano").textContent = DADOS.gerado;

  // chamado pela conta (conta.js) quando chega histórico de outra máquina:
  // relê os dados e redesenha a tela, sem mexer num quiz ou exercício aberto
  window.EstudoApp = {
    recarregar: function () {
      PROG = lerLS("estudo-ads", {}) || {};
      rascunhos = null;
      if (quiz || (rota.aba === "lab" && rota.sub)) return;
      var y = window.pageYOffset;
      if (rota.vista === "home") renderHome();
      else renderMateria(byId[rota.mid], rota.aba);
      atualizaTopo();
      window.scrollTo(0, y);
    }
  };

  aplicarRota();
})();
