/* Laboratório — editor de código.
   Começa como <textarea> (funciona offline e aparece na hora) e vira CodeMirror
   assim que a biblioteca carrega do CDN. Quem usa só fala com a interface
   devolvida por L.criarEditor, sem saber qual dos dois está por baixo. */
(function (L) {
  "use strict";

  var MODOS = { js: "javascript", python: "python", sql: "text/x-sqlite", prolog: "prolog",
                web: "htmlmixed", java: "text/x-java", texto: null };

  var promessaCM = null;
  L.carregarEditor = function () {
    if (promessaCM) return promessaCM;
    var b = L.CDN.cm;
    promessaCM = Promise.all([
      L.carregarCss(b + "codemirror.min.css"),
      L.carregarCss(b + "theme/material-darker.min.css"),
      L.carregarScript(b + "codemirror.min.js")
    ]).then(function () {
      return Promise.all([
        "mode/javascript/javascript.min.js", "mode/python/python.min.js", "mode/sql/sql.min.js",
        "mode/xml/xml.min.js", "mode/css/css.min.js", "mode/clike/clike.min.js",
        "addon/mode/simple.min.js", "addon/edit/closebrackets.min.js",
        "addon/edit/matchbrackets.min.js", "addon/selection/active-line.min.js"
      ].map(function (p) { return L.carregarScript(b + p); }));
    }).then(function () {
      return L.carregarScript(b + "mode/htmlmixed/htmlmixed.min.js");
    }).then(function () {
      definirPrologo(window.CodeMirror);
      return window.CodeMirror;
    });
    promessaCM.catch(function () { promessaCM = null; });
    return promessaCM;
  };

  function definirPrologo(CM) {
    if (!CM || !CM.defineSimpleMode || CM.modes.prolog) return;
    CM.defineSimpleMode("prolog", {
      start: [
        { regex: /%.*/, token: "comment" },
        { regex: /\/\*/, token: "comment", next: "comentario" },
        { regex: /"(?:[^\\"]|\\.)*"?/, token: "string" },
        { regex: /'(?:[^\\']|\\.)*'?/, token: "string" },
        { regex: /:-|\?-|-->|\\\+|=\.\.|\\==|==|=:=|=\\=|>=|=<|->|\bis\b/, token: "keyword" },
        { regex: /[A-Z_][A-Za-z0-9_]*/, token: "variable-2" },
        { regex: /[a-z][A-Za-z0-9_]*(?=\()/, token: "def" },
        { regex: /[a-z][A-Za-z0-9_]*/, token: "atom" },
        { regex: /\d+(?:\.\d+)?/, token: "number" }
      ],
      comentario: [
        { regex: /.*?\*\//, token: "comment", next: "start" },
        { regex: /.*/, token: "comment" }
      ],
      meta: { lineComment: "%" }
    });
  }

  // opcoes: { valor, linguagem, somenteLeitura, aoMudar(valor), aoRodar(), rotulo }
  L.criarEditor = function (host, opcoes) {
    opcoes = opcoes || {};
    var caixa = L.el("div", "lab-editor");
    var ta = L.el("textarea", "lab-code");
    ta.spellcheck = false;
    ta.value = opcoes.valor || "";
    ta.setAttribute("autocapitalize", "off");
    ta.setAttribute("autocomplete", "off");
    ta.setAttribute("aria-label", opcoes.rotulo || "Editor de código");
    if (opcoes.somenteLeitura) ta.readOnly = true;
    caixa.appendChild(ta);
    host.appendChild(caixa);

    var cm = null, leitura = !!opcoes.somenteLeitura, marcas = [], destaques = [];
    var aoMudar = opcoes.aoMudar || function () {};

    function ajustaAltura() {
      ta.style.height = "auto";
      ta.style.height = Math.min(Math.max(ta.scrollHeight + 4, 120), 640) + "px";
    }
    ta.addEventListener("input", function () { ajustaAltura(); aoMudar(ta.value); });
    ta.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); if (opcoes.aoRodar) opcoes.aoRodar(); return; }
      if (e.key === "Tab" && !e.shiftKey && !ta.readOnly) {
        e.preventDefault();
        var i = ta.selectionStart, f = ta.selectionEnd;
        ta.value = ta.value.slice(0, i) + "  " + ta.value.slice(f);
        ta.selectionStart = ta.selectionEnd = i + 2;
        aoMudar(ta.value);
      }
    });
    setTimeout(ajustaAltura, 0);

    var api = {
      get: function () { return cm ? cm.getValue() : ta.value; },
      set: function (v) {
        v = v == null ? "" : String(v);
        if (cm) { cm.setValue(v); cm.clearHistory(); } else { ta.value = v; ajustaAltura(); }
      },
      somenteLeitura: function (sim) {
        leitura = !!sim;
        if (cm) cm.setOption("readOnly", leitura ? "nocursor" : false);
        ta.readOnly = leitura;
        caixa.classList.toggle("leitura", leitura);
      },
      marcarErro: function (linha) {
        api.limparErro();
        if (!linha || !cm) return;
        var h = cm.addLineClass(linha - 1, "background", "lab-cm-erro");
        marcas.push(h);
      },
      limparErro: function () {
        if (cm) marcas.forEach(function (h) { cm.removeLineClass(h, "background", "lab-cm-erro"); });
        marcas = [];
      },
      destacar: function (linhaAtual, linhaAnterior) {
        if (!cm) return;
        destaques.forEach(function (d) { cm.removeLineClass(d[0], "background", d[1]); });
        destaques = [];
        if (linhaAnterior && linhaAnterior !== linhaAtual) {
          destaques.push([cm.addLineClass(linhaAnterior - 1, "background", "lab-cm-anterior"), "lab-cm-anterior"]);
        }
        if (linhaAtual) {
          destaques.push([cm.addLineClass(linhaAtual - 1, "background", "lab-cm-atual"), "lab-cm-atual"]);
          cm.scrollIntoView({ line: linhaAtual - 1, ch: 0 }, 60);
        }
      },
      foco: function () { if (cm) cm.focus(); else ta.focus(); },
      atualizar: function () { if (cm) cm.refresh(); },
      el: caixa
    };
    api.somenteLeitura(leitura);

    var modo = MODOS[opcoes.linguagem];
    L.carregarEditor().then(function (CM) {
      if (!caixa.isConnected && !document.body.contains(caixa)) return;
      var valor = ta.value;
      cm = CM.fromTextArea(ta, {
        mode: modo,
        theme: "material-darker",
        lineNumbers: true,
        indentUnit: opcoes.linguagem === "python" ? 4 : 2,
        tabSize: 4,
        indentWithTabs: false,
        lineWrapping: false,
        matchBrackets: true,
        autoCloseBrackets: true,
        styleActiveLine: !leitura,
        readOnly: leitura ? "nocursor" : false,
        viewportMargin: Infinity,
        screenReaderLabel: opcoes.rotulo || "Editor de código",
        extraKeys: {
          "Ctrl-Enter": function () { if (opcoes.aoRodar) opcoes.aoRodar(); },
          "Cmd-Enter": function () { if (opcoes.aoRodar) opcoes.aoRodar(); },
          "Tab": function (c) {
            if (c.somethingSelected()) c.indentSelection("add");
            else c.replaceSelection(Array(c.getOption("indentUnit") + 1).join(" "), "end");
          },
          "Shift-Tab": function (c) { c.indentSelection("subtract"); },
          "Esc": function (c) { c.getInputField().blur(); }
        }
      });
      cm.setValue(valor);
      cm.clearHistory();
      cm.on("change", function () { aoMudar(cm.getValue()); api.limparErro(); });
      caixa.classList.add("com-cm");
    }, function () {
      caixa.classList.add("sem-cm");
    });
    return api;
  };

  // bloco de código só para leitura (soluções, trechos de outras linguagens)
  L.blocoCodigo = function (host, codigo, linguagem) {
    var pre = L.el("pre", "lab-bloco");
    var code = L.el("code", null, codigo);
    pre.appendChild(code);
    host.appendChild(pre);
    var modo = MODOS[linguagem];
    if (!modo) return pre;
    L.carregarEditor().then(function (CM) {
      if (!CM.runMode) return L.carregarScript(L.CDN.cm + "addon/runmode/runmode.min.js").then(function () { return CM; });
      return CM;
    }).then(function (CM) {
      code.innerHTML = "";
      pre.classList.add("cm-s-material-darker");
      CM.runMode(codigo, modo, code);
    }, function () { /* fica sem cor */ });
    return pre;
  };
})(window.LAB = window.LAB || {});
