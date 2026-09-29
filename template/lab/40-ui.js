/* Laboratório — telas: trilha, painel de XP, revisão, resumo na home e a
   "bancada" (editor + execução + saída) que os tipos de exercício usam. */
(function (L) {
  "use strict";
  var el = L.el;

  L.IC = {
    check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cadeado: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="currentColor"/><path d="M5.5 7V5.3a2.5 2.5 0 015 0V7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.3v9.4l7.3-4.7z" fill="currentColor"/></svg>',
    fogo: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8.6 1.5c.3 2.2-1.2 3.3-2.3 4.6C5.2 7.4 4.5 8.6 4.5 10a3.5 3.5 0 007 0c0-1.2-.5-2-1-2.7.1 1-.4 1.7-1.1 1.9.6-2.4-.2-5.5-.8-7.7z" fill="currentColor"/></svg>',
    relogio: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.5V8l2.4 1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    ponto: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="currentColor"/></svg>'
  };
  function icone(nome, cls) { var s = el("span", "lab-ic " + (cls || "")); s.innerHTML = L.IC[nome]; return s; }
  L.icone = icone;

  var atual = null;          // tela aberta (para limpar preview, listeners...)
  var filtroLing = null, filtroTipo = null;

  L.ir = function (m, sub) {
    L.U.irPara("#/m/" + encodeURIComponent(m.id) + "/lab" + (sub ? "/" + encodeURIComponent(sub) : ""));
  };
  function achar(m, id) { return (m.labs || []).filter(function (l) { return l.id === id; })[0] || null; }
  L.achar = achar;

  L.titulo = function (m, sub) {
    if (sub === "revisao") return "Revisão";
    if (sub === "autoteste") return "Autoteste";
    var lab = sub && achar(m, sub);
    return lab ? lab.titulo : null;
  };

  L.render = function (host, m, sub, U) {
    L.U = U;
    if (atual && atual.destruir) atual.destruir();
    atual = null;
    host.innerHTML = "";
    if (!m.labs || !m.labs.length) {
      var v = el("div", "empty");
      v.appendChild(el("b", null, "Sem laboratório ainda"));
      v.appendChild(el("p", null, "Crie bancos/labs/" + m.id + ".lab e rode o atualizar.bat."));
      host.appendChild(v);
      return;
    }
    L.carregarEditor();          // já começa a baixar o editor enquanto a pessoa lê
    if (sub === "revisao") { atual = telaRevisao(host, m); return; }
    if (sub === "autoteste") { atual = L.autoteste(host, m); return; }
    if (sub) {
      var lab = achar(m, sub);
      if (lab) { atual = L.abrirLab(host, m, lab, {}); return; }
      host.appendChild(el("div", "aviso", "Não achei o exercício “" + sub + "” — ele pode ter sido renomeado. Escolha abaixo."));
    }
    telaTrilha(host, m);
  };

  L.tecla = function (e) {
    return !!(atual && atual.tecla && atual.tecla(e));
  };

  // ------------------------------------------------------------ painel de XP
  function painelXp(m, compacto) {
    var nv = L.prog.nivel(), seq = L.prog.sequencia();
    var p = el("div", "lab-xp" + (compacto ? " compacto" : ""));
    var esq = el("div", "lab-xp-nv");
    var selo = el("div", "lab-xp-selo", String(nv.n));
    selo.setAttribute("aria-hidden", "true");
    esq.appendChild(selo);
    var tx = el("div", "lab-xp-tx");
    tx.appendChild(el("b", null, "Nível " + nv.n + " · " + nv.titulo));
    var barra = el("div", "lab-xp-barra");
    barra.setAttribute("role", "progressbar");
    barra.setAttribute("aria-valuemin", "0");
    barra.setAttribute("aria-valuemax", String(nv.prox));
    barra.setAttribute("aria-valuenow", String(nv.atual));
    barra.setAttribute("aria-label", "XP para o próximo nível");
    var fill = el("i");
    fill.style.width = Math.round(nv.atual / nv.prox * 100) + "%";
    barra.appendChild(fill);
    tx.appendChild(barra);
    tx.appendChild(el("small", null, nv.atual + " / " + nv.prox + " XP para o nível " + (nv.n + 1) + " · " + L.prog.dados.xp + " XP no total"));
    esq.appendChild(tx);
    p.appendChild(esq);

    var dir = el("div", "lab-xp-stats");
    var s1 = el("div", "lab-xp-stat" + (seq ? " quente" : ""));
    s1.appendChild(icone("fogo"));
    s1.appendChild(el("b", null, String(seq)));
    s1.appendChild(el("span", null, seq === 1 ? "dia seguido" : "dias seguidos"));
    s1.title = L.prog.hojeFeitos() ? "Você já estudou hoje." : "Faça um exercício hoje para manter a sequência.";
    dir.appendChild(s1);
    if (m) {
      var c = L.prog.contagem(m);
      var s2 = el("div", "lab-xp-stat");
      s2.appendChild(icone("check"));
      s2.appendChild(el("b", null, c.feitos + "/" + c.total));
      s2.appendChild(el("span", null, "exercícios"));
      dir.appendChild(s2);
    }
    p.appendChild(dir);
    return p;
  }
  L.painelXp = painelXp;

  // ------------------------------------------------------------ trilha
  function telaTrilha(host, m) {
    host.appendChild(painelXp(m));

    var pend = L.prog.pendentes(m);
    var topo = el("div", "lab-topo");
    var prox = L.prog.proximo(m);
    if (prox) {
      var bC = el("button", "btn pri lab-continuar");
      bC.appendChild(icone("play"));
      bC.appendChild(document.createTextNode(L.prog.contagem(m).feitos ? " Continuar: " + prox.titulo : " Começar: " + prox.titulo));
      bC.onclick = function () { L.ir(m, prox.id); };
      topo.appendChild(bC);
    }
    if (pend.length) {
      var bR = el("button", "btn lab-revisar");
      bR.appendChild(icone("relogio"));
      bR.appendChild(document.createTextNode(" Revisar " + pend.length + (pend.length === 1 ? " exercício" : " exercícios")));
      bR.title = "Revisão espaçada: exercícios que você já fez voltam no momento certo para fixar.";
      bR.onclick = function () { L.ir(m, "revisao"); };
      topo.appendChild(bR);
    } else {
      var px = L.prog.proximaRevisao(m);
      if (px) topo.appendChild(el("span", "dica", "Próxima revisão " + L.quando(px)));
    }
    var livre = el("label", "lab-livre");
    var cb = el("input");
    cb.type = "checkbox";
    cb.checked = L.prog.livre();
    cb.onchange = function () { L.prog.livre(cb.checked); L.render(host, m, null, L.U); };
    livre.appendChild(cb);
    livre.appendChild(document.createTextNode(" Modo livre (abre tudo)"));
    livre.title = "Na trilha, cada exercício abre quando você conclui o anterior do mesmo tema. O modo livre abre todos — bom para revisar perto da prova.";
    topo.appendChild(livre);
    host.appendChild(topo);

    // filtros
    var langs = [], tipos = [];
    m.labs.forEach(function (l) {
      if (langs.indexOf(l.linguagem) < 0) langs.push(l.linguagem);
      if (tipos.indexOf(l.tipo) < 0) tipos.push(l.tipo);
    });
    if (filtroLing && langs.indexOf(filtroLing) < 0) filtroLing = null;
    if (filtroTipo && tipos.indexOf(filtroTipo) < 0) filtroTipo = null;
    var filtros = el("div", "lab-filtros");
    function chips(lista, sel, nomes, onPick, rotulo) {
      if (lista.length < 2) return;
      var c = el("div", "chips");
      c.setAttribute("role", "group");
      c.setAttribute("aria-label", rotulo);
      function chip(label, val) {
        var b = el("button", "chip" + (val === sel ? " on" : ""), label);
        b.setAttribute("aria-pressed", val === sel ? "true" : "false");
        b.onclick = function () { onPick(val); };
        c.appendChild(b);
      }
      chip("Todos", null);
      lista.forEach(function (x) { chip(nomes[x] || x, x); });
      filtros.appendChild(c);
    }
    chips(langs, filtroLing, L.NOMES_LING, function (v) { filtroLing = v; L.render(host, m, null, L.U); }, "Filtrar por linguagem");
    chips(tipos, filtroTipo, L.NOMES_TIPO, function (v) { filtroTipo = v; L.render(host, m, null, L.U); }, "Filtrar por tipo");
    host.appendChild(filtros);

    var algum = false;
    L.prog.temas(m).forEach(function (g) {
      var visiveis = g.labs.filter(function (l) {
        return (!filtroLing || l.linguagem === filtroLing) && (!filtroTipo || l.tipo === filtroTipo);
      });
      if (!visiveis.length) return;
      algum = true;
      var feitos = g.labs.filter(function (l) { return L.prog.feito(m, l); }).length;
      var sec = el("section", "lab-tema" + (feitos === g.labs.length ? " completo" : ""));
      var h = el("div", "lab-tema-h");
      h.appendChild(el("h3", null, g.tema));
      h.appendChild(el("span", "lab-tema-n", feitos + "/" + g.labs.length));
      sec.appendChild(h);
      var bar = el("div", "bar");
      var fi = el("i");
      fi.style.width = Math.round(feitos / g.labs.length * 100) + "%";
      bar.appendChild(fi);
      sec.appendChild(bar);

      var ol = el("ol", "lab-trilha");
      visiveis.forEach(function (lab) {
        var feito = L.prog.feito(m, lab), aberto = L.prog.desbloqueado(m, lab);
        var li = el("li", "lab-no-li");
        var b = el("button", "lab-no " + (feito ? "feito" : aberto ? "aberto" : "bloqueado") + " t-" + lab.tipo);
        b.appendChild(icone(feito ? "check" : aberto ? "play" : "cadeado", "lab-no-ic"));
        var meio = el("span", "lab-no-tx");
        meio.appendChild(el("b", null, lab.titulo));
        var sub = el("small");
        sub.appendChild(el("span", "lab-tag-tipo t-" + lab.tipo, L.NOMES_TIPO[lab.tipo]));
        sub.appendChild(document.createTextNode(" " + L.NOMES_LING[lab.linguagem] + " · " + "nível " + lab.nivel));
        meio.appendChild(sub);
        b.appendChild(meio);
        var r = L.prog.reg(m, lab);
        b.appendChild(el("span", "lab-no-xp", feito ? "+" + (r.xp || 0) + " XP" : "+" + L.prog.xpBase(lab) + " XP"));
        if (!aberto) {
          b.setAttribute("aria-disabled", "true");
          b.title = "Conclua o exercício anterior deste tema (ou ligue o modo livre).";
          b.setAttribute("aria-label", lab.titulo + " — bloqueado: conclua o anterior deste tema");
          b.onclick = function () {
            b.classList.remove("treme");
            void b.offsetWidth;
            b.classList.add("treme");
            L.toast("Conclua o exercício anterior deste tema para abrir este — ou ligue o <b>modo livre</b>.");
          };
        } else {
          b.onclick = function () { L.ir(m, lab.id); };
        }
        li.appendChild(b);
        ol.appendChild(li);
      });
      sec.appendChild(ol);
      host.appendChild(sec);
    });
    if (!algum) host.appendChild(el("p", "dica", "Nenhum exercício com esses filtros."));

    var rod = el("div", "lab-rodape-trilha");
    var bZ = el("button", "btn sm", "Zerar progresso do laboratório desta matéria");
    bZ.onclick = function () {
      if (confirm("Zerar o progresso do laboratório de " + m.nome + "? O XP ganho aqui também sai do total.")) {
        L.prog.zerar(m);
        L.render(host, m, null, L.U);
      }
    };
    rod.appendChild(bZ);
    host.appendChild(rod);
  }

  // ------------------------------------------------------------ revisão
  function telaRevisao(host, m) {
    var fila = L.prog.pendentes(m);
    var feitas = 0, total = fila.length, acertos = 0;
    var tela = { destruir: null, tecla: null };
    function proxima() {
      if (tela.destruir) tela.destruir();
      host.innerHTML = "";
      window.scrollTo(0, 0);
      if (!fila.length) {
        var box = el("div", "box lab-rev-fim");
        box.appendChild(el("h2", null, total ? "Revisão concluída" : "Nada para revisar agora"));
        if (total) box.appendChild(el("p", "sub", acertos + " de " + total + " certos. Os que você errou voltam em 10 minutos; os certos, cada vez mais espaçados."));
        else {
          var px = L.prog.proximaRevisao(m);
          box.appendChild(el("p", "sub", px ? "A próxima revisão vence " + L.quando(px) + "." : "Conclua exercícios de prever, desafio ou montar — eles entram na revisão espaçada."));
        }
        var b = el("button", "btn pri", "Voltar à trilha");
        b.onclick = function () { L.ir(m); };
        box.appendChild(b);
        host.appendChild(box);
        return;
      }
      var lab = fila.shift();
      var t = L.abrirLab(host, m, lab, {
        revisao: { i: feitas + 1, n: total },
        aoRevisar: function (acertou) {
          feitas++;
          if (acertou) acertos++;
          var r = L.prog.revisar(m, lab, acertou);
          L.toast((acertou ? "Certo! " : "Vai voltar daqui a pouco. ") + "<b>+" + r.xp + " XP</b>" +
            (acertou ? " · próxima revisão " + L.quando(r.proxima) : ""), acertou ? "bom" : "");
          if (r.subiu) L.celebrarNivel(r.nivel);
          return { proximo: fila.length ? "Próxima revisão (" + fila.length + ")" : "Terminar revisão", ir: proxima };
        }
      });
      tela.destruir = t.destruir;
      tela.tecla = t.tecla;
    }
    proxima();
    return {
      destruir: function () { if (tela.destruir) tela.destruir(); },
      tecla: function (e) { return tela.tecla ? tela.tecla(e) : false; }
    };
  }

  // ------------------------------------------------------------ celebração
  L.celebrar = function (ganho) {
    if (!ganho || ganho.repetido) return;
    L.toast("<b>+" + ganho.xp + " XP</b>" + (ganho.motivos && ganho.motivos.length ? " · " + L.esc(ganho.motivos.join(" · ")) : ""), "bom");
    if (ganho.subiu) L.celebrarNivel(ganho.nivel);
  };
  L.celebrarNivel = function (nv) {
    setTimeout(function () {
      L.toast("Subiu para o <b>nível " + nv.n + "</b> — " + L.esc(nv.titulo) + "!", "nivel");
    }, 600);
  };

  // ------------------------------------------------------------ resumo na home
  L.resumoHome = function (M, U) {
    L.U = U;
    var com = M.filter(function (m) { return m.labs && m.labs.length; });
    if (!com.length) return null;
    var box = el("section", "lab-home");
    var h = el("div", "periodo-h");
    h.appendChild(el("span", null, "Laboratório — aprender fazendo"));
    h.appendChild(el("i"));
    box.appendChild(h);
    box.appendChild(painelXp(null, true));
    var linha = el("div", "lab-home-mats");
    var totPend = 0;
    com.forEach(function (m) {
      var c = L.prog.contagem(m), pend = L.prog.pendentes(m).length;
      totPend += pend;
      var b = el("button", "lab-home-mat");
      b.style.setProperty("--c", m.cor);
      b.style.setProperty("--ct", m.corTexto || m.cor);
      b.appendChild(el("span", "lab-home-sig", m.sigla));
      var tx = el("span", "lab-home-tx");
      tx.appendChild(el("b", null, m.nome));
      tx.appendChild(el("small", null, c.feitos + " de " + c.total + " exercícios" + (pend ? " · " + pend + " para revisar" : "")));
      b.appendChild(tx);
      if (pend) b.appendChild(el("span", "lab-home-pend", String(pend)));
      b.onclick = function () { U.irPara("#/m/" + encodeURIComponent(m.id) + "/lab" + (pend ? "/revisao" : "")); };
      linha.appendChild(b);
    });
    box.appendChild(linha);
    return box;
  };

  // ============================================================ BANCADA
  // editor + extras da linguagem + execução + saída
  L.bancada = function (host, m, lab, cfg) {
    cfg = cfg || {};
    var ling = lab.linguagem;
    var setup = lab.banco ? (m.labBancos || {})[lab.banco] || "" : "";
    var wrap = el("div", "lab-bancada l-" + ling);
    host.appendChild(wrap);
    var colEd = el("div", "lab-col-ed");
    wrap.appendChild(colEd);

    var rodarAgora = null;
    var editor = L.criarEditor(colEd, {
      valor: cfg.codigo != null ? cfg.codigo : lab.codigo,
      linguagem: ling,
      somenteLeitura: cfg.somenteLeitura,
      rotulo: "Código de " + lab.titulo,
      aoMudar: function (v) {
        if (cfg.aoMudar) cfg.aoMudar(v);
        if (ling === "web" && preview) agendaPreview();
      },
      aoRodar: function () { if (rodarAgora) rodarAgora(); }
    });

    // --- Prolog: lista de consultas
    var consultas = null;
    if (ling === "prolog") {
      consultas = el("div", "lab-consultas");
      colEd.appendChild(consultas);
      var titulo = el("div", "lab-consultas-h");
      titulo.appendChild(el("b", null, "Consultas"));
      titulo.appendChild(el("span", "dica", "o que você pergunta ao Prolog depois de carregar o programa"));
      consultas.appendChild(titulo);
      var lista = el("div", "lab-consultas-l");
      consultas.appendChild(lista);
      var bMais = el("button", "btn sm", "+ consulta");
      bMais.onclick = function () { addConsulta(""); salvaConsultas(); var ins = lista.querySelectorAll("input"); ins[ins.length - 1].focus(); };
      consultas.appendChild(bMais);
      var iniciais = cfg.consultas || lab.consultas || [];
      iniciais.forEach(function (q) { addConsulta(q); });
      if (!iniciais.length) addConsulta("");
    }
    function addConsulta(q) {
      var row = el("div", "lab-consulta");
      row.appendChild(el("span", "lab-consulta-p", "?-"));
      var inp = el("input");
      inp.type = "text";
      inp.value = String(q).replace(/^\?-\s*/, "");
      inp.spellcheck = false;
      inp.setAttribute("aria-label", "Consulta Prolog");
      inp.placeholder = "ex.: avo(joao, X).";
      inp.addEventListener("input", salvaConsultas);
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); if (rodarAgora) rodarAgora(); } });
      row.appendChild(inp);
      var x = el("button", "lab-consulta-x", "×");
      x.setAttribute("aria-label", "Remover consulta");
      x.onclick = function () { row.parentNode.removeChild(row); salvaConsultas(); };
      row.appendChild(x);
      consultas.querySelector(".lab-consultas-l").appendChild(row);
    }
    function lerConsultas() {
      if (!consultas) return [];
      return Array.prototype.map.call(consultas.querySelectorAll("input"), function (i) { return i.value.trim(); })
        .filter(Boolean);
    }
    function salvaConsultas() { if (cfg.aoMudarConsultas) cfg.aoMudarConsultas(lerConsultas()); }

    // --- SQL: painel com as tabelas do banco
    var painelEsq = null;
    if (ling === "sql") {
      painelEsq = el("aside", "lab-esquema");
      painelEsq.appendChild(el("div", "lab-esquema-h", "Tabelas do banco"));
      var corpoEsq = el("div", "lab-esquema-c", "carregando…");
      painelEsq.appendChild(corpoEsq);
      wrap.appendChild(painelEsq);
      L.motores.sql(setup, "", { soEsquema: true }).then(function (r) { pintaEsquema(r.esquema || []); });
    }
    function pintaEsquema(esq) {
      if (!painelEsq) return;
      var c = painelEsq.querySelector(".lab-esquema-c");
      c.innerHTML = "";
      if (!esq.length) { c.appendChild(el("p", "dica", "Banco vazio — crie tabelas com CREATE TABLE.")); return; }
      esq.forEach(function (t) {
        var d = el("details", "lab-tab");
        d.open = esq.length <= 4;
        var s = el("summary");
        s.appendChild(el("b", null, t.nome));
        s.appendChild(el("span", "dica", (t.tipo === "view" ? "view · " : "") + (t.linhas == null ? "" : t.linhas + " linha" + (t.linhas === 1 ? "" : "s"))));
        d.appendChild(s);
        var ul = el("ul");
        t.colunas.forEach(function (col) {
          var li = el("li");
          li.appendChild(el("span", col.pk ? "lab-pk" : null, col.nome));
          li.appendChild(el("small", null, " " + (col.tipo || "") + (col.pk ? " · PK" : "") + (col.notnull && !col.pk ? " · NOT NULL" : "")));
          ul.appendChild(li);
        });
        d.appendChild(ul);
        c.appendChild(d);
      });
    }

    // --- HTML/CSS: preview ao vivo
    var preview = null, consoleWeb = [], tPrev = null;
    if (ling === "web") {
      var colPrev = el("div", "lab-col-prev");
      var barra = el("div", "lab-prev-barra");
      barra.appendChild(el("b", null, "Resultado"));
      var tams = el("div", "lab-prev-tams");
      tams.setAttribute("role", "group");
      tams.setAttribute("aria-label", "Largura da tela");
      [["Celular", 375], ["Tablet", 768], ["Desktop", 1200], ["Caber", 0]].forEach(function (p) {
        var b = el("button", "chip" + (p[1] === 0 ? " on" : ""), p[0] + (p[1] ? " " + p[1] : ""));
        b.setAttribute("aria-pressed", p[1] === 0 ? "true" : "false");
        b.onclick = function () {
          Array.prototype.forEach.call(tams.children, function (x) { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); });
          b.classList.add("on");
          b.setAttribute("aria-pressed", "true");
          preview.largura(p[1]);
        };
        tams.appendChild(b);
      });
      barra.appendChild(tams);
      colPrev.appendChild(barra);
      wrap.appendChild(colPrev);
      preview = L.criarPreview(colPrev, function (d) {
        if (d.tipo === "testes") return;
        consoleWeb.push({ tipo: d.tipo === "info" ? "info" : d.tipo, texto: d.texto });
        pintaConsoleWeb();
      });
      setTimeout(function () { preview.atualizar(editor.get()); }, 0);
    }
    function agendaPreview() {
      clearTimeout(tPrev);
      tPrev = setTimeout(function () { consoleWeb = []; pintaConsoleWeb(); preview.atualizar(editor.get()); }, 450);
    }

    // --- barra de ações (quem usa a bancada põe os botões aqui) e saída
    var barraAcoes = el("div", "row lab-acoes");
    host.appendChild(barraAcoes);
    var saida = el("div", "lab-saida-wrap");
    saida.hidden = true;
    saida.setAttribute("aria-live", "polite");
    host.appendChild(saida);
    function pintaConsoleWeb() {
      if (!consoleWeb.length) { saida.hidden = true; return; }
      saida.hidden = false;
      saida.innerHTML = "";
      var pre = el("div", "lab-saida");
      pre.appendChild(el("div", "lab-saida-h", "Console da página"));
      consoleWeb.forEach(function (l) { pre.appendChild(el("div", "lab-l lab-l-" + l.tipo, l.texto)); });
      saida.appendChild(pre);
    }

    // --- Python: aviso de carregamento
    var desouvir = null;
    if (ling === "python" && !L.python.pronto()) {
      var aviso = el("div", "lab-py-aviso");
      aviso.textContent = L.python.iniciado() ? "Carregando o Python…" : "O Python roda aqui no navegador (Pyodide). Na primeira vez ele baixa uns 10 MB — já estou carregando.";
      host.insertBefore(aviso, barraAcoes);
      L.python.aquecer();
      desouvir = L.python.ouvir(function (st) {
        if (st === "pronto") { aviso.textContent = "Python pronto."; aviso.classList.add("ok"); setTimeout(function () { if (aviso.parentNode) aviso.parentNode.removeChild(aviso); }, 1500); }
        else if (st === "falhou") { aviso.textContent = "Não consegui carregar o Python. Confira a internet e recarregue a página."; aviso.classList.add("erro"); }
      });
    }

    // --- executar
    function executar(comTestes) {
      var codigo = editor.get();
      editor.limparErro();
      if (ling === "web") {
        consoleWeb = [];
        pintaConsoleWeb();
        preview.atualizar(codigo);
      }
      return L.executarLab(m, lab, codigo, { comTestes: comTestes, consultas: lerConsultas() });
    }

    function mostrar(res) {
      if (ling === "sql" && res.bruto.esquema) pintaEsquema(res.bruto.esquema);
      if (ling === "web") return;          // a saída da página é o próprio preview + console ao vivo
      saida.hidden = false;
      saida.innerHTML = "";
      var box = el("div", "lab-saida" + (res.ok ? "" : " com-erro"));
      if (ling === "sql") pintaSql(box, res);
      else if (ling === "prolog") pintaPrologo(box, res);
      else {
        box.appendChild(el("div", "lab-saida-h", "Saída"));
        res.linhas.forEach(function (l) { box.appendChild(el("div", "lab-l lab-l-" + l.tipo, l.texto)); });
        if (!res.linhas.length && res.ok) box.appendChild(el("div", "lab-l lab-l-vazio", "(rodou sem imprimir nada)"));
      }
      if (res.erro) pintaErro(box, res.erro);
      saida.appendChild(box);
      if (res.erro && res.erro.linha && (ling === "js" || ling === "python" || ling === "prolog")) editor.marcarErro(res.erro.linha);
    }

    function pintaErro(box, erro) {
      var e = el("div", "lab-erro");
      var t = el("div", "lab-erro-t");
      t.appendChild(el("b", null, erro.nome));
      t.appendChild(document.createTextNode(": " + erro.msg));
      if (erro.linha) t.appendChild(el("span", "lab-erro-linha", "linha " + erro.linha));
      e.appendChild(t);
      if (erro.dica) e.appendChild(el("div", "lab-erro-dica", erro.dica));
      box.appendChild(e);
    }

    function pintaSql(box, res) {
      var r = res.bruto;
      var rs = r.resultados || [];
      if (res.ok && !rs.length) {
        box.appendChild(el("div", "lab-l lab-l-vazio", "Comando executado" + (r.modificadas ? " — " + r.modificadas + " linha(s) afetada(s) pelo último comando." : ".")));
      }
      rs.forEach(function (t, i) {
        if (rs.length > 1) box.appendChild(el("div", "lab-saida-h", "Resultado " + (i + 1)));
        box.appendChild(L.tabelaSql(t));
      });
    }

    function pintaPrologo(box, res) {
      var r = res.bruto;
      if (r.saidaPrograma) {
        box.appendChild(el("div", "lab-saida-h", "Saída ao carregar o programa"));
        box.appendChild(el("div", "lab-l", r.saidaPrograma));
      }
      if (res.ok && (!r.consultas || !r.consultas.length)) box.appendChild(el("div", "lab-l lab-l-vazio", "Programa carregado. Escreva uma consulta para perguntar algo."));
      (r.consultas || []).forEach(function (c) {
        var q = el("div", "lab-pq");
        q.appendChild(el("div", "lab-pq-q", "?- " + c.consulta));
        if (c.saida) q.appendChild(el("div", "lab-l lab-pq-out", c.saida.replace(/\n$/, "")));
        if (c.erro) {
          q.appendChild(el("div", "lab-l lab-l-error", c.erro));
          if (c.dica) q.appendChild(el("div", "lab-erro-dica", c.dica));
        } else {
          c.respostas.forEach(function (a, i) {
            var cls = a === "false" ? "lab-pq-nao" : "lab-pq-sim";
            q.appendChild(el("div", "lab-l " + cls, (a === "false" ? "false." : a === "true" ? "true." : a + (i < c.respostas.length - 1 || c.mais ? " ;" : "."))));
          });
          if (c.mais) q.appendChild(el("div", "lab-l lab-l-vazio", "(parei nas primeiras respostas)"));
        }
        box.appendChild(q);
      });
    }

    var api = {
      editor: editor,
      barra: barraAcoes,
      saida: saida,
      executar: executar,
      mostrar: mostrar,
      rodar: function (comTestes) { return executar(comTestes).then(function (r) { mostrar(r); return r; }); },
      consultas: lerConsultas,
      definirConsultas: function (qs) {
        if (!consultas) return;
        consultas.querySelector(".lab-consultas-l").innerHTML = "";
        (qs.length ? qs : [""]).forEach(addConsulta);
      },
      somenteLeitura: function (sim) {
        editor.somenteLeitura(sim);
        if (consultas) {
          Array.prototype.forEach.call(consultas.querySelectorAll("input,button"), function (x) { x.disabled = !!sim; });
          consultas.classList.toggle("leitura", !!sim);
        }
      },
      aoRodar: function (fn) { rodarAgora = fn; },
      limparSaida: function () { saida.hidden = true; saida.innerHTML = ""; editor.limparErro(); },
      atualizarPreview: function () { if (preview) preview.atualizar(editor.get()); },
      destruir: function () { if (preview) preview.destruir(); if (desouvir) desouvir(); clearTimeout(tPrev); }
    };
    if (cfg.somenteLeitura) api.somenteLeitura(true);
    return api;
  };

  // ============================================================ EXECUTAR (sem interface)
  // Roda o código de um exercício na linguagem certa e devolve um resultado
  // normalizado: { ok, linhas, erro{nome,msg,linha,dica}, testes[], passou, bruto }
  L.executarLab = function (m, lab, codigo, opcoes) {
    opcoes = opcoes || {};
    var ling = lab.linguagem, comTestes = !!opcoes.comTestes;
    var setup = lab.banco ? (m.labBancos || {})[lab.banco] || "" : "";
    var testes = comTestes ? lab.testes || [] : null;
    var p;
    if (ling === "js") p = L.motores.js(codigo, testes && testes.length ? testes : null);
    else if (ling === "python") p = L.motores.python(codigo, testes && testes.length ? testes : null);
    else if (ling === "prolog") {
      var qs = opcoes.consultas || lab.consultas || [];
      var qt = (testes || []).map(function (t) { return t.consulta; });
      p = L.motores.prolog(codigo, qs.concat(qt)).then(function (r) {
        if (r.consultas) {
          r.testesProlog = r.consultas.slice(qs.length);
          r.consultas = r.consultas.slice(0, qs.length);
        }
        return r;
      });
    } else if (ling === "sql") {
      p = L.motores.sql(setup, codigo, { solucao: comTestes ? lab.solucao : null, verificar: lab.verificar });
    } else if (ling === "web") {
      p = (testes && testes.length ? L.motores.testarWeb(codigo, testes) : Promise.resolve(null)).then(function (t) {
        return { ok: true, linhas: [], testesWeb: t };
      });
    } else p = Promise.resolve({ ok: true, linhas: [] });
    return p.then(function (r) { return normalizar(r); });

    function normalizar(r) {
      var res = { ok: r.ok !== false, linhas: r.linhas || [], erro: r.erro || null, bruto: r, tempoEsgotado: !!r.tempoEsgotado };
      if (res.erro) res.erro.dica = L.explicarErro(res.erro.msg);
      if (ling === "prolog" && r.consultas) {
        r.consultas.forEach(function (c) { if (c.erro) c.dica = L.explicarErro(c.erro); });
      }
      if (!comTestes) return res;
      var t = [];
      if (ling === "js" || ling === "python") {
        (lab.testes || []).forEach(function (def, i) {
          var x = (r.testes || [])[i] || { ok: false, erro: res.erro ? "o código deu erro" : "não rodou" };
          t.push({ nome: def.expr, ok: x.ok, obtido: x.obtido, esperado: x.esperado || def.esperado, erro: x.erro });
        });
      } else if (ling === "prolog") {
        var norm = function (a) { return a.map(function (s) { return String(s).replace(/\s+/g, ""); }).sort().join(" | "); };
        (lab.testes || []).forEach(function (def, i) {
          var x = (r.testesProlog || [])[i];
          var obt = x && !x.erro ? x.respostas : null;
          t.push({ nome: "?- " + def.consulta, ok: !!obt && norm(obt) === norm(def.respostas),
                   obtido: obt ? obt.join(" | ") : null, esperado: def.respostas.join(" | "),
                   erro: x && x.erro ? (x.erro.length > 160 ? x.erro.slice(0, 160) + "…" : x.erro) : (!x ? "não rodou (erro no programa?)" : null) });
        });
      } else if (ling === "sql") {
        var cmp = L.compararSql(r, lab);
        t.push({ nome: lab.verificar ? "O banco termina no estado esperado" : "O resultado é igual ao esperado", ok: cmp.ok, erro: cmp.ok ? null : cmp.motivo });
        res.esperado = lab.verificar ? r.esperadoVerificacao : r.esperado;
      } else if (ling === "web") {
        (r.testesWeb || []).forEach(function (x) { t.push(x); });
      }
      (lab.regras || []).forEach(function (rg) {
        // palavras-chave de SQL não diferenciam maiúsculas
        var achou = new RegExp(rg.regex, ling === "sql" ? "mi" : "m").test(L.semComentarios(codigo, ling));
        t.push({ nome: rg.msg, ok: rg.tipo === "proibido" ? !achou : achou, regra: true });
      });
      res.testes = t;
      res.passou = t.length > 0 && t.every(function (x) { return x.ok; });
      return res;
    }
  };

  L.tabelaSql = function (t) {
    var wrap = el("div", "lab-tabela-wrap");
    var tab = el("table", "lab-tabela");
    var th = el("tr");
    t.colunas.forEach(function (c) { th.appendChild(el("th", null, c)); });
    var thead = el("thead");
    thead.appendChild(th);
    tab.appendChild(thead);
    var tb = el("tbody");
    t.linhas.slice(0, 200).forEach(function (l) {
      var tr = el("tr");
      l.forEach(function (v) {
        var td = el("td", v === null ? "nulo" : typeof v === "number" ? "num" : null, v === null ? "NULL" : String(v));
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    tab.appendChild(tb);
    wrap.appendChild(tab);
    wrap.appendChild(el("div", "lab-tabela-n", t.linhas.length + " linha" + (t.linhas.length === 1 ? "" : "s") +
      (t.linhas.length > 200 ? " (mostrando 200)" : "")));
    return wrap;
  };
})(window.LAB = window.LAB || {});
