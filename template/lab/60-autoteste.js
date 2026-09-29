/* Laboratório — autoteste de conteúdo. Abra #/m/<matéria>/lab/autoteste:
   roda cada exercício nos motores reais e confere se a autoria está coerente
   (previsão com exatamente uma opção certa, solução passando nos testes,
   código inicial do desafio NÃO passando, blocos do montar funcionando...). */
(function (L) {
  "use strict";
  var el = L.el;

  function conferir(m, lab) {
    var exec = function (codigo, comTestes) { return L.executarLab(m, lab, codigo, { comTestes: comTestes }); };
    var ling = lab.linguagem;
    var executavel = ["js", "python", "prolog", "sql", "web"].indexOf(ling) >= 0;
    var problemas = [], notas = [];
    function resumoErro(r) { return r.erro ? r.erro.nome + ": " + r.erro.msg : ""; }
    function errosProlog(r) {
      return (r.bruto.consultas || []).filter(function (c) { return c.erro; }).map(function (c) { return c.consulta + " → " + c.erro; });
    }

    if (lab.tipo === "explorar" || lab.tipo === "prever") {
      return exec(lab.codigo, false).then(function (r) {
        if (!r.ok && !lab.erro) problemas.push("o código deu erro: " + resumoErro(r));
        if (ling === "prolog") errosProlog(r).forEach(function (e) { if (!lab.erro) problemas.push("consulta com erro: " + e); });
        if (lab.tipo === "prever") {
          var real = L.alvoDe(lab, r);
          notas.push("real: " + JSON.stringify(real));
          if (lab.opcoes && lab.opcoes.length) {
            var n = lab.opcoes.filter(function (o) { return L.normalizar(o) === L.normalizar(real); }).length;
            if (n !== 1) problemas.push(n + " opções batem com a saída real (tem que ser exatamente 1)");
            var vistos = {};
            lab.opcoes.forEach(function (o) { var k = L.normalizar(o); if (vistos[k]) problemas.push("opção repetida: " + o); vistos[k] = 1; });
          }
        }
        return { problemas: problemas, notas: notas };
      });
    }
    if (lab.tipo === "passo") {
      return L.motores.passo(lab.codigo).then(function (r) {
        if (!r.passos || !r.passos.length) problemas.push("não gerou passos: " + (r.erro ? r.erro.msg : "?"));
        else if (r.erro && !lab.erro) problemas.push("terminou com erro: " + r.erro.nome + ": " + r.erro.msg);
        if (r.limite) problemas.push("passou do limite de passos");
        notas.push((r.passos || []).length + " passos");
        if (lab.pergunta && L.indiceResposta(lab) < 0) problemas.push("resposta da pergunta não aponta para uma opção");
        return { problemas: problemas, notas: notas };
      });
    }
    if (lab.tipo === "desafio") {
      return exec(lab.solucao || "", true).then(function (r) {
        if (!r.passou) {
          (r.testes || []).filter(function (t) { return !t.ok; }).forEach(function (t) {
            problemas.push("SOLUÇÃO falha: " + t.nome + (t.erro ? " — " + t.erro : t.obtido != null ? " — veio " + t.obtido + ", esperado " + t.esperado : ""));
          });
          if (!r.testes || !r.testes.length) problemas.push("sem testes");
        }
        return exec(lab.codigo || "", true);
      }).then(function (r) {
        if (r.passou) problemas.push("o código inicial JÁ passa em todos os testes — o desafio não desafia");
        notas.push("inicial passa " + (r.testes || []).filter(function (t) { return t.ok; }).length + "/" + (r.testes || []).length);
        return { problemas: problemas, notas: notas };
      });
    }
    if (lab.tipo === "parsons") {
      (lab.distratores || []).forEach(function (d) {
        if (lab.linhas.indexOf(d) >= 0) problemas.push("distrator idêntico a uma linha certa: " + d);
      });
      if (!executavel) return Promise.resolve({ problemas: problemas, notas: ["só texto"] });
      var codigo = (lab.codigo ? lab.codigo + "\n" : "") + lab.linhas.join("\n");
      var comTestes = !!(lab.testes && lab.testes.length);
      return exec(codigo, comTestes).then(function (r) {
        if (!r.ok && !lab.erro) problemas.push("o código montado deu erro: " + resumoErro(r));
        if (comTestes && !r.passou) problemas.push("o código montado não passa nos testes");
        return { problemas: problemas, notas: notas };
      });
    }
    return Promise.resolve({ problemas: ["tipo desconhecido"], notas: [] });
  }

  L.autoteste = function (host, m) {
    var box = el("div", "box");
    box.appendChild(el("h2", null, "Autoteste do laboratório — " + m.nome));
    var st = el("p", "sub", "Rodando " + m.labs.length + " exercícios nos motores reais…");
    box.appendChild(st);
    var tab = el("table", "lab-tabela lab-auto");
    var hr = el("tr");
    ["", "exercício", "tipo", "ling.", "resultado"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
    var th = el("thead");
    th.appendChild(hr);
    tab.appendChild(th);
    var tb = el("tbody");
    tab.appendChild(tb);
    box.appendChild(tab);
    host.appendChild(box);
    var falhas = 0, i = 0, cancelado = false, inicio = Date.now();
    var resumo = [];
    (function prox() {
      if (cancelado) return;
      if (i >= m.labs.length) {
        st.textContent = (falhas ? falhas + " exercício(s) com problema" : "Tudo certo") + " — " + m.labs.length + " exercícios em " + Math.round((Date.now() - inicio) / 1000) + "s.";
        st.className = "sub " + (falhas ? "lab-auto-falha" : "lab-auto-ok");
        window.__labAutoteste = { materia: m.id, falhas: falhas, total: m.labs.length, detalhes: resumo };
        return;
      }
      var lab = m.labs[i++];
      st.textContent = "Rodando " + i + " de " + m.labs.length + ": " + lab.titulo;
      conferir(m, lab).then(function (r) {
        var tr = el("tr", r.problemas.length ? "falha" : "ok");
        tr.appendChild(el("td", null, r.problemas.length ? "✕" : "✓"));
        var a = el("a", null, lab.id);
        a.href = "#/m/" + encodeURIComponent(m.id) + "/lab/" + encodeURIComponent(lab.id);
        var td = el("td");
        td.appendChild(a);
        tr.appendChild(td);
        tr.appendChild(el("td", null, lab.tipo));
        tr.appendChild(el("td", null, lab.linguagem));
        tr.appendChild(el("td", null, r.problemas.concat(r.notas.map(function (n) { return "· " + n; })).join("\n")));
        tb.appendChild(tr);
        if (r.problemas.length) falhas++;
        resumo.push({ id: lab.id, problemas: r.problemas, notas: r.notas });
        prox();
      }, function (e) {
        falhas++;
        resumo.push({ id: lab.id, problemas: ["exceção: " + e] });
        prox();
      });
    })();
    return { destruir: function () { cancelado = true; } };
  };
})(window.LAB = window.LAB || {});
