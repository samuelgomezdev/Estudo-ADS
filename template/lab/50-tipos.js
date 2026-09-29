/* Laboratório — os cinco tipos de exercício.
   explorar: rodar → alterar → observar
   prever:   hipótese antes de rodar, depois comparar com a realidade
   desafio:  escrever/consertar código até passar nos testes
   parsons:  montar o código com blocos embaralhados
   passo:    execução linha por linha, com variáveis e pilha de chamadas */
(function (L) {
  "use strict";
  var el = L.el;

  function btn(txt, cls, fn) {
    var b = el("button", "btn " + (cls || ""), txt);
    if (fn) b.onclick = fn;
    return b;
  }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // embaralhamento estável: a mesma pessoa vê a mesma ordem ao recarregar
  function embaralharFixo(lista, semente) {
    var a = lista.slice(), s = semente || 1;
    for (var i = a.length - 1; i > 0; i--) {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      var j = s % (i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function caixaExplicacao(host, lab, aberta) {
    if (!lab.explicacao) return null;
    var d = el("div", "lab-exp" + (aberta ? "" : " fechada"));
    var h = el("div", "lab-exp-h", "Por que isso acontece");
    d.appendChild(h);
    var c = el("div", "lab-exp-c");
    L.mdEm(c, lab.explicacao);
    d.appendChild(c);
    host.appendChild(d);
    return d;
  }
  function listaExperimentos(host, lab, st, salvar) {
    if (!lab.experimentos || !lab.experimentos.length) return;
    var box = el("div", "lab-experimentos");
    box.appendChild(el("div", "lab-exp-h", "Agora experimente"));
    st.exps = st.exps || [];
    var ul = el("ul");
    lab.experimentos.forEach(function (txt, i) {
      var li = el("li");
      var lbl = el("label");
      var cb = el("input");
      cb.type = "checkbox";
      cb.checked = !!st.exps[i];
      cb.onchange = function () { st.exps[i] = cb.checked; salvar(); li.classList.toggle("feito", cb.checked); };
      li.classList.toggle("feito", cb.checked);
      lbl.appendChild(cb);
      var span = el("span");
      L.mdEm(span, txt);
      lbl.appendChild(span);
      li.appendChild(lbl);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    host.appendChild(box);
  }

  // ------------------------------------------------------------ esqueleto comum
  L.abrirLab = function (host, m, lab, op) {
    op = op || {};
    var ws = el("div", "lab-ws");
    host.appendChild(ws);

    var top = el("div", "lab-ws-top");
    var voltar = btn(op.revisao ? "← Sair da revisão" : "← Trilha", "sm", function () { L.ir(m); });
    top.appendChild(voltar);
    var tags = el("div", "lab-ws-tags");
    tags.appendChild(el("span", "lab-tag-tipo t-" + lab.tipo, L.NOMES_TIPO[lab.tipo]));
    tags.appendChild(el("span", "lab-tag", L.NOMES_LING[lab.linguagem]));
    tags.appendChild(el("span", "lab-tag", "nível " + lab.nivel));
    if (op.revisao) tags.appendChild(el("span", "lab-tag rev", "Revisão " + op.revisao.i + " de " + op.revisao.n));
    else if (L.prog.feito(m, lab)) {
      var f = el("span", "lab-tag ok");
      f.appendChild(L.icone("check"));
      f.appendChild(document.createTextNode(" feito"));
      tags.appendChild(f);
    } else tags.appendChild(el("span", "lab-tag xp", "+" + L.prog.xpBase(lab) + " XP"));
    top.appendChild(tags);
    ws.appendChild(top);

    ws.appendChild(el("div", "lab-ws-tema", lab.tema));
    ws.appendChild(el("h2", "lab-ws-titulo", lab.titulo));
    ws.appendChild(el("p", "lab-ws-desc", L.DESC_TIPO[lab.tipo].charAt(0).toUpperCase() + L.DESC_TIPO[lab.tipo].slice(1) + "."));
    var enun = el("div", "lab-enun");
    L.mdEm(enun, lab.enunciado);
    ws.appendChild(enun);
    var corpo = el("div", "lab-corpo");
    ws.appendChild(corpo);
    var rodape = el("div", "lab-ws-rodape");
    ws.appendChild(rodape);

    var estado = op.revisao ? {} : L.prog.estado(m, lab);
    var ctx = {
      m: m, lab: lab, op: op, ws: ws, corpo: corpo, estado: estado,
      destruidores: [], tecla: null,
      salvar: function () { if (!op.revisao) L.prog.salvar(); },
      finalizar: function (q) {
        q = q || {};
        rodape.innerHTML = "";
        if (op.revisao) {
          var acertou = q.acertou != null ? q.acertou : !q.solucao;
          var r = op.aoRevisar(acertou);
          var b = btn(r.proximo + " →", "pri", r.ir);
          rodape.appendChild(b);
          setTimeout(function () { b.focus(); }, 50);
          return;
        }
        var ganho = L.prog.concluir(m, lab, q);
        L.celebrar(ganho);
        mostrarProximo();
      }
    };
    function mostrarProximo() {
      rodape.innerHTML = "";
      var prox = L.prog.proximo(m, lab);
      if (prox) {
        var b = btn("Próximo: " + prox.titulo + " →", "pri", function () { L.ir(m, prox.id); });
        rodape.appendChild(b);
      } else {
        rodape.appendChild(el("span", "dica", "Você concluiu todos os exercícios abertos desta matéria."));
      }
      rodape.appendChild(btn("Voltar à trilha", "", function () { L.ir(m); }));
    }
    if (!op.revisao && L.prog.feito(m, lab)) mostrarProximo();

    TIPOS[lab.tipo](ctx);

    return {
      destruir: function () { ctx.destruidores.forEach(function (f) { try { f(); } catch (e) { /* ignora */ } }); },
      tecla: function (e) {
        if (ctx.tecla && ctx.tecla(e)) return true;
        var alvo = e.target || {};
        var digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName || "") || alvo.isContentEditable;
        if (!digitando && e.key === "Escape") { e.preventDefault(); L.ir(m); return true; }
        return digitando || e.key === "Backspace";
      }
    };
  };

  function bancadaPadrao(ctx, extra) {
    var st = ctx.estado, lab = ctx.lab;
    var banc = L.bancada(ctx.corpo, ctx.m, lab, {
      codigo: extra && extra.codigo != null ? extra.codigo : (st.codigo != null ? st.codigo : lab.codigo),
      consultas: st.consultas,
      somenteLeitura: extra && extra.somenteLeitura,
      aoMudar: function (v) { st.codigo = v; ctx.salvar(); if (extra && extra.aoMudar) extra.aoMudar(v); },
      aoMudarConsultas: function (qs) { st.consultas = qs; ctx.salvar(); }
    });
    ctx.destruidores.push(banc.destruir);
    return banc;
  }
  function botaoRestaurar(ctx, banc, original, depois) {
    return btn("Restaurar original", "sm", function () {
      var st = ctx.estado;
      var mexeu = banc.editor.get() !== original ||
        (ctx.lab.consultas && JSON.stringify(banc.consultas()) !== JSON.stringify(ctx.lab.consultas));
      if (mexeu && !confirm("Descartar suas alterações e voltar ao código original?")) return;
      banc.editor.set(original);
      if (ctx.lab.consultas) banc.definirConsultas(ctx.lab.consultas);
      delete st.codigo;
      delete st.consultas;
      ctx.salvar();
      banc.limparSaida();
      banc.atualizarPreview();
      if (depois) depois();
    });
  }
  function botaoRodar(banc, aoTerminar) {
    var b = el("button", "btn pri sm lab-rodar");
    b.innerHTML = L.IC.play + " Rodar";
    b.title = "Rodar (Ctrl+Enter)";
    function rodar() {
      if (b.disabled) return;
      b.disabled = true;
      b.classList.add("rodando");
      banc.rodar(false).then(function (r) {
        b.disabled = false;
        b.classList.remove("rodando");
        if (aoTerminar) aoTerminar(r);
      });
    }
    b.onclick = rodar;
    banc.aoRodar(rodar);
    return b;
  }

  var TIPOS = {};

  // ============================================================ EXPLORAR
  TIPOS.explorar = function (ctx) {
    var lab = ctx.lab, st = ctx.estado;
    var banc = bancadaPadrao(ctx);
    var jaFeito = !ctx.op.revisao && L.prog.feito(ctx.m, lab);
    var rodou = jaFeito;
    var bExp, bConc;
    banc.barra.appendChild(botaoRodar(banc, function () {
      rodou = true;
      if (bExp) { bExp.disabled = false; bExp.title = ""; }
      if (bConc) bConc.disabled = false;
    }));
    banc.barra.appendChild(botaoRestaurar(ctx, banc, lab.codigo));
    banc.barra.appendChild(el("span", "dica lab-atalho", "Ctrl+Enter roda"));

    var depois = el("div", "lab-depois");
    ctx.corpo.appendChild(depois);
    listaExperimentos(depois, lab, st, ctx.salvar);

    var exp = null;
    if (lab.explicacao) {
      bExp = btn("Ver explicação", "sm", function () {
        exp.classList.toggle("fechada");
        bExp.textContent = exp.classList.contains("fechada") ? "Ver explicação" : "Ocultar explicação";
      });
      if (!rodou) { bExp.disabled = true; bExp.title = "Rode o código pelo menos uma vez antes — observar vem primeiro."; }
      depois.appendChild(bExp);
      exp = caixaExplicacao(depois, lab, false);
    }
    if (!jaFeito) {
      bConc = btn("Concluir experimento", "pri", function () {
        bConc.parentNode.removeChild(bConc);
        if (exp) { exp.classList.remove("fechada"); if (bExp) bExp.textContent = "Ocultar explicação"; }
        ctx.finalizar({});
      });
      bConc.disabled = !rodou;
      depois.appendChild(bConc);
    }
  };

  // ============================================================ PREVER
  var PERGUNTAS = {
    tudo: "O que este programa vai imprimir?",
    ultima: "Qual será a última linha impressa?",
    primeira: "Qual será a primeira linha impressa?",
    erro: "O que acontece quando esse código roda?",
    contagem: "Quantas linhas essa consulta devolve?",
    celula: "Qual valor aparece no resultado?",
    respostas: "Quais respostas o Prolog vai dar?",
    nrespostas: "Quantas respostas o Prolog encontra?"
  };
  L.alvoDe = function (lab, res) {
    var alvo = (lab.alvo || "tudo").trim();
    var r = res.bruto || {};
    if (lab.linguagem === "sql") {
      var rs = r.resultados || [];
      var t = rs.length ? rs[rs.length - 1] : null;
      if (alvo === "erro") return res.erro ? "erro" : "sem erro";
      if (!t) return res.erro ? "erro" : "nenhuma linha";
      if (alvo === "contagem") return String(t.linhas.length);
      if (alvo === "celula") return t.linhas.length ? String(t.linhas[0][0]) : "nenhuma linha";
      return t.linhas.map(function (l) { return l.join(" | "); }).join("\n");
    }
    if (lab.linguagem === "prolog") {
      var c = (r.consultas || [])[0];
      if (!c) return res.erro ? "erro" : "";
      if (alvo === "nrespostas") return String(c.respostas.filter(function (a) { return a !== "false"; }).length);
      if (alvo === "tudo") return ((c.saida || "").replace(/\n$/, ""));
      if (c.erro) return /Limite de inferências/.test(c.erro) ? "recursão infinita" : "erro";
      return c.respostas.join(" ; ");
    }
    if (alvo === "erro") return res.erro ? res.erro.nome : "sem erro";
    var linhas = res.linhas.map(function (l) { return l.texto; });
    if (alvo === "ultima") return linhas.length ? linhas[linhas.length - 1] : "";
    if (alvo === "primeira") return linhas.length ? linhas[0] : "";
    var mL = /^linha\s+(\d+)$/.exec(alvo);
    if (mL) return linhas[Number(mL[1]) - 1] || "";
    return linhas.join("\n");
  };
  // "resposta:" casa primeiro com o texto de uma opção; só se nenhuma casar é
  // lida como número da opção (1 = primeira)
  L.indiceResposta = function (lab) {
    var resp = String(lab.resposta || "").trim(), ops = lab.opcoes || [];
    var i = ops.map(L.normalizar).indexOf(L.normalizar(resp));
    if (i < 0 && /^\d+$/.test(resp)) i = Number(resp) - 1;
    return i >= 0 && i < ops.length ? i : -1;
  };
  L.perguntaDe = function (lab) {
    if (lab.pergunta) return lab.pergunta;
    var alvo = (lab.alvo || "tudo").trim();
    var mL = /^linha\s+(\d+)$/.exec(alvo);
    if (mL) return "O que aparece na linha " + mL[1] + " da saída?";
    return PERGUNTAS[alvo] || PERGUNTAS.tudo;
  };

  TIPOS.prever = function (ctx) {
    var lab = ctx.lab, st = ctx.estado;
    st.prev = st.prev || {};
    var revelado = !!st.prev.revelado;
    var banc = bancadaPadrao(ctx, { codigo: revelado ? undefined : lab.codigo, somenteLeitura: !revelado });

    var bRodar = botaoRodar(banc);
    var bRest = botaoRestaurar(ctx, banc, lab.codigo);
    var dicaRodar = el("span", "dica", "Agora é com você: mexa no código e rode de novo.");
    [bRodar, bRest, dicaRodar].forEach(function (b) { b.hidden = !revelado; banc.barra.appendChild(b); });
    if (!revelado) banc.aoRodar(function () {});

    var box = el("div", "lab-previsao");
    box.appendChild(el("div", "lab-previsao-h", "Sua hipótese"));
    box.appendChild(el("div", "lab-previsao-q", L.perguntaDe(lab)));
    // a pergunta fica ANTES da execução: insere a caixa entre o código e a saída
    ctx.corpo.insertBefore(box, banc.barra);

    var escolha = st.prev.escolha != null ? st.prev.escolha : null;
    var opcoes = (lab.opcoes || []).map(function (t, i) { return { t: t, i: i }; });
    opcoes = ctx.op.revisao ? L.embaralhar(opcoes) : embaralharFixo(opcoes, hash(lab.id));
    var livre = null, botoes = [];
    if (opcoes.length) {
      var grupo = el("div", "lab-opcoes");
      grupo.setAttribute("role", "radiogroup");
      grupo.setAttribute("aria-label", "Opções de previsão");
      opcoes.forEach(function (o, k) {
        var b = el("button", "lab-opcao");
        b.setAttribute("role", "radio");
        b.appendChild(el("span", "lab-opcao-l", "ABCDEFGH".charAt(k)));
        b.appendChild(el("span", "lab-opcao-t", o.t));
        b.onclick = function () {
          if (revelado) return;
          escolha = o.i;
          botoes.forEach(function (x) { x.b.classList.toggle("sel", x.o.i === escolha); x.b.setAttribute("aria-checked", x.o.i === escolha ? "true" : "false"); });
          bConf.disabled = false;
        };
        b.setAttribute("aria-checked", o.i === escolha ? "true" : "false");
        if (o.i === escolha) b.classList.add("sel");
        botoes.push({ b: b, o: o });
        grupo.appendChild(b);
      });
      box.appendChild(grupo);
    } else {
      livre = el("textarea", "lab-previsao-livre");
      livre.placeholder = "Escreva exatamente o que você acha que vai aparecer…";
      livre.value = st.prev.texto || "";
      livre.setAttribute("aria-label", "Sua previsão");
      livre.addEventListener("input", function () { bConf.disabled = !livre.value.trim(); });
      box.appendChild(livre);
    }
    var linhaConf = el("div", "row lab-previsao-acoes");
    var bConf = btn("Confirmar previsão e rodar", "pri", confirmar);
    bConf.disabled = opcoes.length ? escolha == null : !(livre && livre.value.trim());
    linhaConf.appendChild(bConf);
    linhaConf.appendChild(el("span", "dica", "Pense antes: qual é a sua hipótese e por quê?"));
    box.appendChild(linhaConf);

    var resultado = el("div", "lab-previsao-res");
    box.appendChild(resultado);
    var depois = el("div", "lab-depois");
    ctx.corpo.appendChild(depois);

    function confirmar() {
      if (livre) st.prev.texto = livre.value;
      bConf.disabled = true;
      bConf.textContent = "Rodando…";
      banc.rodar(false).then(function (res) { revelar(res, true); });
    }
    function revelar(res, agora) {
      revelado = true;
      linhaConf.hidden = true;
      if (livre) livre.readOnly = true;
      var real = L.alvoDe(lab, res);
      var certa = -1;
      opcoes.forEach(function (o) { if (certa < 0 && L.normalizar(o.t) === L.normalizar(real)) certa = o.i; });
      var acertou;
      if (opcoes.length) acertou = certa >= 0 && escolha === certa;
      else acertou = L.normalizar(livre.value) === L.normalizar(real);
      botoes.forEach(function (x) {
        x.b.disabled = true;
        x.b.classList.add("lock");
        if (x.o.i === certa) x.b.classList.add("ok");
        else if (x.o.i === escolha) x.b.classList.add("no");
      });
      resultado.innerHTML = "";
      var r = el("div", "lab-veredito " + (acertou ? "ok" : "no"));
      r.appendChild(el("b", null, acertou ? "Sua hipótese se confirmou." : "A realidade foi diferente da hipótese."));
      if (!acertou) {
        r.appendChild(el("div", "lab-veredito-sub", opcoes.length && certa < 0
          ? "Não consegui casar a saída com nenhuma opção — compare você mesmo com a saída abaixo."
          : "Esse é o momento mais valioso: descubra ONDE seu modelo mental errou."));
      }
      var real2 = el("div", "lab-veredito-real");
      real2.appendChild(el("span", null, "Resultado real: "));
      real2.appendChild(el("code", null, real === "" ? "(nada)" : real));
      r.appendChild(real2);
      resultado.appendChild(r);

      [bRodar, bRest, dicaRodar].forEach(function (b) { b.hidden = false; });
      banc.somenteLeitura(false);
      banc.aoRodar(function () { bRodar.click(); });
      depois.innerHTML = "";
      caixaExplicacao(depois, lab, true);
      listaExperimentos(depois, lab, st, ctx.salvar);
      if (agora) {
        st.prev = { revelado: !ctx.op.revisao, escolha: escolha, acertou: acertou, texto: st.prev.texto };
        ctx.salvar();
        ctx.finalizar({ acertou: acertou });
      }
    }
    if (revelado) {
      banc.executar(false).then(function (res) { banc.mostrar(res); revelar(res, false); });
    }
  };

  // ============================================================ DESAFIO
  TIPOS.desafio = function (ctx) {
    var lab = ctx.lab, st = ctx.estado;
    st.dicas = st.dicas || 0;
    var banc = bancadaPadrao(ctx);
    var resolvido = !ctx.op.revisao && L.prog.feito(ctx.m, lab);

    var bTestar = el("button", "btn pri sm");
    bTestar.innerHTML = L.IC.check + " Testar";
    bTestar.title = "Roda o código e confere nos testes";
    var bRodar = botaoRodar(banc);
    bRodar.classList.remove("pri");
    banc.aoRodar(function () { bTestar.click(); });
    banc.barra.appendChild(bTestar);
    if (lab.linguagem !== "web") banc.barra.appendChild(bRodar);
    banc.barra.appendChild(botaoRestaurar(ctx, banc, lab.codigo || ""));
    var nDicas = (lab.dicas || []).length;
    var bDica = null;
    if (nDicas) {
      bDica = btn("", "sm", function () {
        if (st.dicas >= nDicas) return;
        st.dicas++;
        ctx.salvar();
        pintaDicas();
      });
      banc.barra.appendChild(bDica);
    }
    var bSol = btn("Ver solução", "sm", function () {
      if (!st.solucao && !confirm("Ver a solução agora? Tentar mais um pouco fixa muito mais — e ver a solução dá só metade do XP.")) return;
      st.solucao = true;
      ctx.salvar();
      pintaSolucao();
    });
    bSol.disabled = !st.tentativas && !resolvido;
    bSol.title = bSol.disabled ? "Teste pelo menos uma vez antes." : "";
    banc.barra.appendChild(bSol);

    var painelTestes = el("div", "lab-testes");
    ctx.corpo.appendChild(painelTestes);
    var dicasBox = el("div", "lab-dicas");
    ctx.corpo.appendChild(dicasBox);
    var solBox = el("div", "lab-solucao");
    ctx.corpo.appendChild(solBox);
    var depois = el("div", "lab-depois");
    ctx.corpo.appendChild(depois);

    // mostra a lista de testes antes de rodar: o aluno sabe o que precisa cumprir
    function pintaTestesVazios() {
      painelTestes.innerHTML = "";
      var h = el("div", "lab-testes-h");
      h.appendChild(el("b", null, "O que vai ser conferido"));
      painelTestes.appendChild(h);
      var ul = el("ul");
      var itens = [];
      if (lab.linguagem === "sql") itens.push(lab.verificar ? "O banco termina no estado esperado" : "O resultado da sua consulta é igual ao esperado");
      (lab.testes || []).forEach(function (t) { itens.push(t.nome || (t.consulta ? "?- " + t.consulta : t.expr + "  ⟶  " + t.esperado)); });
      (lab.regras || []).forEach(function (r) { itens.push(r.msg); });
      itens.forEach(function (t) { var li = el("li", "pend"); li.appendChild(L.icone("ponto")); li.appendChild(el("code", null, t)); ul.appendChild(li); });
      painelTestes.appendChild(ul);
    }
    function pintaTestes(res) {
      painelTestes.innerHTML = "";
      var n = res.testes.filter(function (t) { return t.ok; }).length;
      var h = el("div", "lab-testes-h " + (res.passou ? "ok" : "no"));
      h.appendChild(el("b", null, res.passou ? "Todos os testes passaram" : n + " de " + res.testes.length + " passaram"));
      painelTestes.appendChild(h);
      var ul = el("ul");
      res.testes.forEach(function (t) {
        var li = el("li", t.ok ? "ok" : "no");
        li.appendChild(L.icone(t.ok ? "check" : "ponto"));
        var tx = el("div", "lab-teste-tx");
        tx.appendChild(el("code", null, t.nome));
        if (!t.ok) {
          if (t.erro) tx.appendChild(el("div", "lab-teste-det", t.erro));
          else if (t.obtido != null) tx.appendChild(el("div", "lab-teste-det", "esperado: " + t.esperado + "   ·   veio: " + t.obtido));
        }
        li.appendChild(tx);
        ul.appendChild(li);
      });
      painelTestes.appendChild(ul);
      if (!res.passou && lab.linguagem === "sql" && res.esperado && res.esperado.length) {
        var d = el("details", "lab-esperado");
        d.appendChild(el("summary", null, "Ver o resultado esperado"));
        d.appendChild(L.tabelaSql(res.esperado[res.esperado.length - 1]));
        painelTestes.appendChild(d);
      }
    }
    function pintaDicas() {
      dicasBox.innerHTML = "";
      if (bDica) {
        bDica.textContent = st.dicas >= nDicas ? "Sem mais dicas" : "Pedir dica (" + (st.dicas + 1) + "/" + nDicas + ")";
        bDica.disabled = st.dicas >= nDicas;
      }
      for (var i = 0; i < st.dicas; i++) {
        var d = el("div", "lab-dica");
        d.appendChild(el("b", null, "Dica " + (i + 1) + ": "));
        var s = el("span");
        s.innerHTML = L.md(lab.dicas[i]).replace(/^<p>|<\/p>$/g, "");
        d.appendChild(s);
        dicasBox.appendChild(d);
      }
    }
    function pintaSolucao() {
      solBox.innerHTML = "";
      if (!st.solucao) return;
      solBox.appendChild(el("div", "lab-exp-h", "Solução de referência"));
      L.blocoCodigo(solBox, lab.solucao, lab.linguagem);
      solBox.appendChild(btn("Copiar para o editor", "sm", function () {
        banc.editor.set(lab.solucao);
        st.codigo = lab.solucao;
        ctx.salvar();
      }));
    }
    function sucesso() {
      depois.innerHTML = "";
      caixaExplicacao(depois, lab, true);
      if (!resolvido) {
        resolvido = true;
        ctx.finalizar({ dicas: st.dicas, solucao: !!st.solucao, acertou: !st.solucao });
      }
    }
    bTestar.onclick = function () {
      if (bTestar.disabled) return;
      bTestar.disabled = true;
      bTestar.classList.add("rodando");
      banc.rodar(true).then(function (res) {
        bTestar.disabled = false;
        bTestar.classList.remove("rodando");
        st.tentativas = (st.tentativas || 0) + 1;
        ctx.salvar();
        bSol.disabled = false;
        bSol.title = "";
        pintaTestes(res);
        if (res.passou) sucesso();
      });
    };
    pintaTestesVazios();
    pintaDicas();
    pintaSolucao();
    if (resolvido && caixaExplicacao(depois, lab, false)) addToggle();
    function addToggle() {
      var exp = depois.querySelector(".lab-exp");
      var b = btn("Ver explicação", "sm", function () {
        exp.classList.toggle("fechada");
        b.textContent = exp.classList.contains("fechada") ? "Ver explicação" : "Ocultar explicação";
      });
      depois.insertBefore(b, exp);
    }
  };

  // ============================================================ MONTAR (Parsons)
  TIPOS.parsons = function (ctx) {
    var lab = ctx.lab, st = ctx.estado;
    var blocos = lab.linhas.map(function (t, i) { return { id: i, t: t, certo: true }; })
      .concat((lab.distratores || []).map(function (t, i) { return { id: lab.linhas.length + i, t: t, certo: false }; }));
    var porId = {};
    blocos.forEach(function (b) { porId[b.id] = b; });
    var valido = st.sol && st.pool && st.sol.concat(st.pool).length === blocos.length;
    if (!valido) {
      st.pool = L.embaralhar(blocos.map(function (b) { return b.id; }));
      st.sol = [];
      st.tent = 0;
    }
    var resolvido = !ctx.op.revisao && L.prog.feito(ctx.m, lab);
    var travado = false;
    // "codigo" num montar é contexto pronto (fatos, classes auxiliares...) que
    // vai antes dos blocos quando o código é executado
    var prefixo = lab.codigo ? lab.codigo + "\n" : "";
    if (lab.codigo) {
      var ctxBox = el("div", "lab-pz-ctx");
      ctxBox.appendChild(el("div", "lab-pz-h", "Já vem pronto (fica antes dos seus blocos)"));
      L.blocoCodigo(ctxBox, lab.codigo, lab.linguagem);
      ctx.corpo.appendChild(ctxBox);
    }

    var area = el("div", "lab-parsons l-" + lab.linguagem);
    var colPool = el("div", "lab-pz");
    colPool.appendChild(el("div", "lab-pz-h", "Blocos disponíveis"));
    var ulPool = el("ul", "lab-pz-l pool");
    ulPool.setAttribute("aria-label", "Blocos disponíveis — clique para colocar na solução");
    colPool.appendChild(ulPool);
    var colSol = el("div", "lab-pz");
    colSol.appendChild(el("div", "lab-pz-h", "Sua solução"));
    var ulSol = el("ol", "lab-pz-l sol");
    ulSol.setAttribute("aria-label", "Sua solução, em ordem");
    colSol.appendChild(ulSol);
    area.appendChild(colPool);
    area.appendChild(colSol);
    ctx.corpo.appendChild(area);
    var dicaUso = el("p", "dica", (lab.distratores && lab.distratores.length
      ? "Atenção: " + lab.distratores.length + " bloco(s) são armadilhas e não entram na solução. " : "") +
      "Clique num bloco para movê-lo; use ↑ ↓ para reordenar (ou arraste).");
    ctx.corpo.insertBefore(dicaUso, area);

    var acoes = el("div", "row lab-acoes");
    var bVer = btn("Verificar", "pri", verificar);
    var bRe = btn("Recomeçar", "sm", function () {
      if (travado) return;
      st.pool = L.embaralhar(blocos.map(function (b) { return b.id; }));
      st.sol = [];
      ctx.salvar();
      feedback.innerHTML = "";
      pinta();
    });
    acoes.appendChild(bVer);
    acoes.appendChild(bRe);
    ctx.corpo.appendChild(acoes);
    var feedback = el("div", "lab-pz-feedback");
    feedback.setAttribute("aria-live", "polite");
    ctx.corpo.appendChild(feedback);
    var depois = el("div", "lab-depois");
    ctx.corpo.appendChild(depois);

    var arrastando = null;
    function item(id, naSol, pos) {
      var b = porId[id];
      var li = el("li", "lab-pz-b");
      li.dataset.id = id;
      var txt = el("button", "lab-pz-t");
      txt.appendChild(el("code", null, b.t.replace(/\t/g, "    ")));
      txt.setAttribute("aria-label", (naSol ? "Tirar da solução: " : "Colocar na solução: ") + b.t.trim());
      txt.onclick = function () {
        if (travado) return;
        if (naSol) { st.sol.splice(st.sol.indexOf(id), 1); st.pool.push(id); }
        else { st.pool.splice(st.pool.indexOf(id), 1); st.sol.push(id); }
        ctx.salvar();
        limpaMarcas();
        pinta();
      };
      li.appendChild(txt);
      if (naSol) {
        var up = el("button", "lab-pz-mv", "↑");
        up.setAttribute("aria-label", "Subir");
        up.disabled = pos === 0;
        up.onclick = function () { mover(pos, pos - 1); };
        var dn = el("button", "lab-pz-mv", "↓");
        dn.setAttribute("aria-label", "Descer");
        dn.disabled = pos === st.sol.length - 1;
        dn.onclick = function () { mover(pos, pos + 1); };
        li.appendChild(up);
        li.appendChild(dn);
      }
      li.draggable = !travado;
      li.addEventListener("dragstart", function (e) {
        arrastando = { id: id, naSol: naSol };
        li.classList.add("arrastando");
        try { e.dataTransfer.setData("text/plain", String(id)); e.dataTransfer.effectAllowed = "move"; } catch (x) { /* ok */ }
      });
      li.addEventListener("dragend", function () { li.classList.remove("arrastando"); arrastando = null; });
      return li;
    }
    function mover(de, para) {
      if (travado || para < 0 || para >= st.sol.length) return;
      var x = st.sol.splice(de, 1)[0];
      st.sol.splice(para, 0, x);
      ctx.salvar();
      limpaMarcas();
      pinta();
      var alvo = ulSol.children[para];
      if (alvo) { var bt = alvo.querySelectorAll(".lab-pz-mv")[para < de ? 0 : 1]; if (bt && !bt.disabled) bt.focus(); }
    }
    ulSol.addEventListener("dragover", function (e) { if (arrastando) { e.preventDefault(); ulSol.classList.add("sobre"); } });
    ulSol.addEventListener("dragleave", function () { ulSol.classList.remove("sobre"); });
    ulSol.addEventListener("drop", function (e) {
      e.preventDefault();
      ulSol.classList.remove("sobre");
      if (!arrastando || travado) return;
      var lis = Array.prototype.slice.call(ulSol.children);
      var destino = lis.length;
      for (var i = 0; i < lis.length; i++) {
        var r = lis[i].getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { destino = i; break; }
      }
      var id = arrastando.id;
      if (arrastando.naSol) {
        var de = st.sol.indexOf(id);
        st.sol.splice(de, 1);
        if (de < destino) destino--;
      } else st.pool.splice(st.pool.indexOf(id), 1);
      st.sol.splice(destino, 0, id);
      ctx.salvar();
      limpaMarcas();
      pinta();
    });
    ulPool.addEventListener("dragover", function (e) { if (arrastando && arrastando.naSol) e.preventDefault(); });
    ulPool.addEventListener("drop", function (e) {
      e.preventDefault();
      if (!arrastando || !arrastando.naSol || travado) return;
      st.sol.splice(st.sol.indexOf(arrastando.id), 1);
      st.pool.push(arrastando.id);
      ctx.salvar();
      pinta();
    });

    var marcas = null;
    function limpaMarcas() { marcas = null; }
    function pinta() {
      ulPool.innerHTML = "";
      ulSol.innerHTML = "";
      st.pool.forEach(function (id) { ulPool.appendChild(item(id, false)); });
      st.sol.forEach(function (id, i) {
        var li = item(id, true, i);
        if (marcas && marcas[i]) li.classList.add(marcas[i]);
        ulSol.appendChild(li);
      });
      if (!st.pool.length) ulPool.appendChild(el("li", "lab-pz-vazio", "(todos os blocos foram usados)"));
      if (!st.sol.length) ulSol.appendChild(el("li", "lab-pz-vazio", "Clique nos blocos ao lado, na ordem em que o código deve ficar."));
      bVer.disabled = travado || !st.sol.length;
      bRe.disabled = travado;
    }

    function textos(ids) { return ids.map(function (id) { return porId[id].t; }); }
    function verificar() {
      if (travado) return;
      st.tent = (st.tent || 0) + 1;
      ctx.salvar();
      feedback.innerHTML = "";
      var armadilhas = st.sol.filter(function (id) { return !porId[id].certo; });
      var faltam = lab.linhas.length - (st.sol.length - armadilhas.length);
      var sol = textos(st.sol), certo = lab.linhas;
      marcas = st.sol.map(function (id, i) {
        if (!porId[id].certo) return "armadilha";
        return sol[i] === certo[i] ? "certo" : null;
      });
      var executavel = lab.testes && lab.testes.length && (lab.linguagem === "js" || lab.linguagem === "python");
      if (armadilhas.length) {
        pinta();
        return falha(armadilhas.length === 1 ? "Tem um bloco na solução que é armadilha (marcado em vermelho)." : "Tem " + armadilhas.length + " blocos que são armadilhas (marcados em vermelho).");
      }
      if (faltam > 0) {
        pinta();
        return falha("Faltam " + faltam + " bloco(s) na solução.");
      }
      var igual = sol.join("\n") === certo.join("\n");
      if (igual) return pronto();
      if (executavel) {
        // outra ordem também pode estar certa: quem decide são os testes
        var codigo = prefixo + sol.join("\n");
        var p = lab.linguagem === "js" ? L.motores.js(codigo, lab.testes) : L.motores.python(codigo, lab.testes);
        bVer.disabled = true;
        p.then(function (r) {
          bVer.disabled = false;
          if (r.ok && r.testes && r.testes.every(function (t) { return t.ok; })) pronto();
          else { pinta(); falha(textoPosicao()); }
        });
        return;
      }
      pinta();
      falha(textoPosicao());
    }
    function textoPosicao() {
      var ok = 0;
      while (ok < marcas.length && marcas[ok] === "certo") ok++;
      return ok ? "As primeiras " + ok + " linha(s) estão no lugar certo (em verde). Confira a partir da linha " + (ok + 1) + "."
                : "A primeira linha ainda não é a certa. Pense: o que precisa existir antes de tudo?";
    }
    function falha(msg) {
      var d = el("div", "lab-veredito no");
      d.appendChild(el("b", null, "Ainda não. "));
      d.appendChild(document.createTextNode(msg));
      d.appendChild(el("div", "lab-veredito-sub", "Tentativa " + st.tent + "."));
      feedback.appendChild(d);
    }
    function pronto() {
      travado = true;
      marcas = st.sol.map(function () { return "certo"; });
      pinta();
      feedback.innerHTML = "";
      var d = el("div", "lab-veredito ok");
      d.appendChild(el("b", null, st.tent === 1 ? "Perfeito, de primeira!" : "Montado! Levou " + st.tent + " tentativas."));
      feedback.appendChild(d);
      mostraMontado();
      if (!resolvido) {
        resolvido = true;
        ctx.finalizar({ tentativas: st.tent, acertou: st.tent === 1 });
      }
    }
    function mostraMontado() {
      depois.innerHTML = "";
      var executavel = lab.linguagem === "js" || lab.linguagem === "python" || lab.linguagem === "sql" || lab.linguagem === "prolog";
      if (executavel) {
        depois.appendChild(el("div", "lab-exp-h", "Seu código montado — rode para ver funcionando"));
        var banc = L.bancada(depois, ctx.m, lab, { codigo: prefixo + lab.linhas.join("\n"), consultas: lab.consultas });
        ctx.destruidores.push(banc.destruir);
        banc.barra.appendChild(botaoRodar(banc));
      }
      caixaExplicacao(depois, lab, true);
    }
    pinta();
    if (resolvido && st.sol.length && textos(st.sol).join("\n") === lab.linhas.join("\n")) {
      travado = true;
      marcas = st.sol.map(function () { return "certo"; });
      pinta();
      mostraMontado();
    }
  };

  // ============================================================ PASSO A PASSO
  TIPOS.passo = function (ctx) {
    var lab = ctx.lab, st = ctx.estado;
    var passos = [], saida = [], idx = 0, chegouFim = !!(st.fim && !ctx.op.revisao), velho = false;
    var ed = L.criarEditor(ctx.corpo, {
      valor: st.codigo != null ? st.codigo : lab.codigo, linguagem: "js", rotulo: "Código de " + lab.titulo,
      aoMudar: function (v) { st.codigo = v; ctx.salvar(); marcarVelho(); },
      aoRodar: function () { gerar(); }
    });

    var ctrl = el("div", "lab-passo-ctrl");
    var bIni = btn("⏮", "sm", function () { ir(0); });
    bIni.setAttribute("aria-label", "Primeiro passo");
    var bAnt = btn("◀ Voltar", "sm", function () { ir(idx - 1); });
    var bProx = btn("Avançar ▶", "pri sm", function () { ir(idx + 1); });
    var bFim = btn("⏭", "sm", function () { ir(passos.length - 1); });
    bFim.setAttribute("aria-label", "Último passo");
    var faixa = el("input", "lab-passo-faixa");
    faixa.type = "range";
    faixa.min = 0;
    faixa.setAttribute("aria-label", "Linha do tempo da execução");
    faixa.oninput = function () { ir(Number(faixa.value)); };
    var cont = el("span", "lab-passo-n");
    [bIni, bAnt, bProx, bFim].forEach(function (b) { ctrl.appendChild(b); });
    ctrl.appendChild(faixa);
    ctrl.appendChild(cont);
    ctx.corpo.appendChild(ctrl);
    var aviso = el("div", "lab-passo-velho");
    aviso.hidden = true;
    aviso.appendChild(document.createTextNode("O código mudou. "));
    aviso.appendChild(btn("Gerar a execução de novo", "sm", gerar));
    ctx.corpo.appendChild(aviso);

    var evento = el("div", "lab-passo-ev");
    evento.setAttribute("aria-live", "polite");
    ctx.corpo.appendChild(evento);
    var paineis = el("div", "lab-passo-paineis");
    var pQuadros = el("div", "lab-passo-quadros");
    var pSaida = el("div", "lab-passo-saida");
    paineis.appendChild(pQuadros);
    paineis.appendChild(pSaida);
    ctx.corpo.appendChild(paineis);
    ctx.corpo.appendChild(el("p", "dica lab-atalho", "Teclas ← e → avançam e voltam. Linha em verde: a próxima a executar; em cinza: a anterior."));
    var fimBox = el("div", "lab-depois");
    ctx.corpo.appendChild(fimBox);

    function marcarVelho() { velho = true; aviso.hidden = false; }
    function gerar() {
      aviso.hidden = true;
      velho = false;
      evento.textContent = "Gerando a execução…";
      L.motores.passo(ed.get()).then(function (r) {
        if (!r.passos || !r.passos.length) {
          passos = [];
          pQuadros.innerHTML = "";
          pSaida.innerHTML = "";
          var e = el("div", "lab-erro");
          e.appendChild(el("div", "lab-erro-t", (r.erro ? r.erro.nome + ": " + r.erro.msg : "Não consegui executar.") + (r.erro && r.erro.linha ? " (linha " + r.erro.linha + ")" : "")));
          var dica = r.erro && L.explicarErro(r.erro.msg);
          if (dica) e.appendChild(el("div", "lab-erro-dica", dica));
          evento.innerHTML = "";
          evento.appendChild(e);
          if (r.erro && r.erro.linha) ed.marcarErro(r.erro.linha);
          habilita();
          return;
        }
        passos = r.passos;
        saida = r.saida || [];
        if (r.limite) L.toast("Parei em " + passos.length + " passos — a execução é longa demais (ou infinita) para mostrar inteira.");
        faixa.max = passos.length - 1;
        ir(0);
      });
    }
    function habilita() {
      var n = passos.length;
      bIni.disabled = bAnt.disabled = !n || idx === 0;
      bProx.disabled = bFim.disabled = !n || idx >= n - 1;
      faixa.disabled = !n;
      cont.textContent = n ? "passo " + (idx + 1) + " de " + n : "";
    }
    function ir(i) {
      if (!passos.length) return;
      idx = Math.max(0, Math.min(passos.length - 1, i));
      faixa.value = idx;
      var p = passos[idx], ant = idx > 0 ? passos[idx - 1] : null;
      ed.destacar(p.l, ant && ant.l);
      evento.innerHTML = "";
      var ev = el("div", "lab-ev lab-ev-" + p.e);
      if (p.e === "linha") ev.innerHTML = "Próxima linha a executar: <b>" + p.l + "</b>";
      else if (p.e === "chamada") ev.innerHTML = "Chamou <code>" + L.esc(p.x) + "</code> — um novo quadro entra na pilha";
      else if (p.e === "retorno") ev.innerHTML = "<code>" + L.esc(topo(p)) + "</code> vai retornar <code>" + L.esc(p.x) + "</code> — o quadro sai da pilha";
      else if (p.e === "fim") ev.innerHTML = "<b>Fim da execução.</b>";
      else if (p.e === "erro") ev.innerHTML = "<b>Parou com erro:</b> " + L.esc(p.x);
      evento.appendChild(ev);
      pintaQuadros(p, ant);
      pintaSaida(p);
      habilita();
      if (idx === passos.length - 1 && !velho) chegouAoFim();
    }
    function topo(p) { return p.p[p.p.length - 1].n; }
    function pintaQuadros(p, ant) {
      pQuadros.innerHTML = "";
      pQuadros.appendChild(el("div", "lab-passo-h", "Pilha de chamadas e variáveis"));
      p.p.forEach(function (f, k) {
        var q = el("div", "lab-quadro" + (k === p.p.length - 1 ? " atual" : ""));
        q.appendChild(el("div", "lab-quadro-n", f.n === "Global" ? "Global" : f.n));
        var antF = ant && ant.p.filter(function (x) { return x.id === f.id; })[0];
        var vars = f.v.filter(function (v) { return !(f.n === "Global" && /^\[(Function|class)/.test(v[1])); });
        if (!vars.length) q.appendChild(el("div", "lab-quadro-vazio", "(sem variáveis ainda)"));
        vars.forEach(function (v) {
          var linha = el("div", "lab-var");
          var antV = antF && antF.v.filter(function (x) { return x[0] === v[0]; })[0];
          if (ant && (!antV || antV[1] !== v[1])) linha.classList.add("mudou");
          var nome = el("span", "lab-var-n", v[0]);
          linha.appendChild(nome);
          if (v[2]) linha.appendChild(el("span", "lab-var-tag " + v[2], v[2] === "closure" ? "closure" : "this"));
          linha.appendChild(el("span", "lab-var-v" + (/^‹/.test(v[1]) ? " tdz" : ""), v[1]));
          q.appendChild(linha);
        });
        var fns = f.n === "Global" ? f.v.filter(function (v) { return /^\[(Function|class)/.test(v[1]); }) : [];
        if (fns.length) q.appendChild(el("div", "lab-quadro-fns", fns.map(function (v) { return v[0]; }).join(", ") + (fns.length === 1 ? " (função/classe)" : " (funções/classes)")));
        pQuadros.appendChild(q);
      });
    }
    function pintaSaida(p) {
      pSaida.innerHTML = "";
      pSaida.appendChild(el("div", "lab-passo-h", "Saída até aqui"));
      var linhas = saida.slice(0, p.s);
      if (!linhas.length) pSaida.appendChild(el("div", "lab-l lab-l-vazio", "(nada impresso ainda)"));
      linhas.forEach(function (l, i) {
        var d = el("div", "lab-l lab-l-" + l.tipo + (i === linhas.length - 1 && idx > 0 && passos[idx - 1].s < p.s ? " novo" : ""), l.texto);
        pSaida.appendChild(d);
      });
    }
    var perguntou = false;
    function chegouAoFim() {
      if (perguntou) return;
      perguntou = true;
      fimBox.innerHTML = "";
      if (lab.pergunta) {
        var box = el("div", "lab-previsao");
        box.appendChild(el("div", "lab-previsao-h", "Confira o que você viu"));
        box.appendChild(el("div", "lab-previsao-q", lab.pergunta));
        var ops = el("div", "lab-opcoes");
        var certa = L.indiceResposta(lab);
        (lab.opcoes || []).forEach(function (t, i) {
          var b = el("button", "lab-opcao");
          b.appendChild(el("span", "lab-opcao-l", "ABCDEFGH".charAt(i)));
          b.appendChild(el("span", "lab-opcao-t", t));
          b.onclick = function () {
            Array.prototype.forEach.call(ops.children, function (x, k) {
              x.disabled = true;
              x.classList.add("lock");
              if (k === certa) x.classList.add("ok");
              else if (k === i) x.classList.add("no");
            });
            var ok = i === certa;
            var v = el("div", "lab-veredito " + (ok ? "ok" : "no"), ok ? "Isso mesmo." : "Não — volte alguns passos e observe de novo.");
            box.appendChild(v);
            caixaExplicacao(fimBox, lab, true);
            if (!chegouFim) { chegouFim = true; st.fim = true; ctx.salvar(); ctx.finalizar({ acertou: ok }); }
          };
          ops.appendChild(b);
        });
        box.appendChild(ops);
        fimBox.appendChild(box);
      } else {
        caixaExplicacao(fimBox, lab, true);
        if (!chegouFim) { chegouFim = true; st.fim = true; ctx.salvar(); ctx.finalizar({}); }
      }
    }

    ctx.tecla = function (e) {
      var alvo = e.target || {};
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName || "") && alvo.type !== "range") return false;
      if (e.key === "ArrowRight") { e.preventDefault(); ir(idx + 1); return true; }
      if (e.key === "ArrowLeft") { e.preventDefault(); ir(idx - 1); return true; }
      return false;
    };
    habilita();
    gerar();
  };
})(window.LAB = window.LAB || {});
