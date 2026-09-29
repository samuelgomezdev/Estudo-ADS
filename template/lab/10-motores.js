/* Laboratório — motores de execução.
   Cada linguagem roda fora da thread da página (Web Worker, ou iframe isolado
   no caso de HTML/CSS). Assim um laço infinito é interrompido pelo tempo-limite
   sem travar o site. Todos devolvem Promise de um objeto { ok, erro, ... }. */
(function (L) {
  "use strict";

  function comWorker(fonte, msg, ms) {
    return new Promise(function (ok) {
      var w;
      try { w = L.criarWorker(fonte); } catch (e) {
        return ok({ ok: false, erro: { nome: "Erro", msg: "O navegador bloqueou a execução em segundo plano (Web Worker): " + e.message } });
      }
      var feito = false;
      function fim(r) {
        if (feito) return;
        feito = true;
        clearTimeout(tempo);
        L.matarWorker(w);
        ok(r);
      }
      var tempo = setTimeout(function () {
        fim({ ok: false, tempoEsgotado: true, erro: { nome: "Tempo esgotado",
          msg: "Passou de " + Math.round(ms / 1000) + "s rodando — provavelmente um laço ou uma recursão que nunca termina." } });
      }, ms);
      w.onmessage = function (ev) { fim(ev.data); };
      w.onerror = function (ev) {
        ev.preventDefault();
        fim({ ok: false, erro: { nome: "Erro", msg: ev.message || "falha ao executar" } });
      };
      w.postMessage(msg);
    });
  }

  // ============================================================ JavaScript
  function trabalhadorJs() {
    self.onmessage = function (ev) {
      var d = ev.data, linhas = [], testes = null, terminou = false, erroFinal = null;
      var st = self.setTimeout.bind(self), ct = self.clearTimeout.bind(self);
      var si = self.setInterval.bind(self), ci = self.clearInterval.bind(self);
      var timers = {}, intervalos = {}, npend = 0, houveAsync = false;

      function empilha(tipo, args) {
        linhas.push({ tipo: tipo, texto: Array.prototype.map.call(args, function (a) { return mostrarValor(a, true); }).join(" ") });
      }
      var cons = {
        log: function () { empilha("log", arguments); },
        info: function () { empilha("log", arguments); },
        debug: function () { empilha("log", arguments); },
        warn: function () { empilha("warn", arguments); },
        error: function () { empilha("error", arguments); },
        table: function (x) { empilha("log", [x]); }
      };
      function erroDe(e) {
        var linha = null;
        var m = String(e && e.stack || "").match(/(?:^|[\s(,])<anonymous>:(\d+):\d+/);
        if (m) linha = Number(m[1]) - 2;
        return { nome: e && e.name ? e.name : "Erro", msg: e && e.message != null ? String(e.message) : String(e),
                 linha: linha > 0 ? linha : null };
      }
      function erroAsync(e) {
        var x = erroDe(e);
        linhas.push({ tipo: "error", texto: "Erro dentro de callback: " + x.nome + ": " + x.msg });
      }
      function terminar() {
        if (terminou) return;
        terminou = true;
        postMessage({ ok: !erroFinal, linhas: linhas, erro: erroFinal, testes: testes, assincrono: houveAsync });
      }
      function checar() {
        if (terminou) return;
        // duas voltas do event loop: promessas resolvidas podem agendar mais timers
        st(function () { st(function () { if (npend === 0) terminar(); }, 0); }, 0);
      }
      function meuSetTimeout(fn, ms) {
        var args = Array.prototype.slice.call(arguments, 2);
        houveAsync = true;
        var id = st(function () {
          delete timers[id]; npend--;
          try { fn.apply(null, args); } catch (e) { erroAsync(e); }
          checar();
        }, ms || 0);
        timers[id] = 1; npend++;
        return id;
      }
      function meuClearTimeout(id) {
        if (timers[id]) { delete timers[id]; npend--; ct(id); checar(); }
      }
      function meuSetInterval(fn, ms) {
        houveAsync = true;
        var id = si(function () {
          try { fn(); } catch (e) { erroAsync(e); ci(id); delete intervalos[id]; npend--; checar(); }
        }, Math.max(ms || 0, 10));
        intervalos[id] = 1; npend++;
        return id;
      }
      function meuClearInterval(id) {
        if (intervalos[id]) { delete intervalos[id]; npend--; ci(id); checar(); }
      }
      self.addEventListener("unhandledrejection", function (e) { houveAsync = true; erroAsync(e.reason); });

      function testar(avaliar) {
        if (!d.testes) return;
        testes = d.testes.map(function (t) {
          try {
            var obtido = avaliar("(" + t.expr + "\n)");
            var esperado = avaliar("(" + t.esperado + "\n)");
            return { ok: igual(obtido, esperado), obtido: mostrarValor(obtido), esperado: mostrarValor(esperado) };
          } catch (e) {
            var x = erroDe(e);
            return { ok: false, erro: x.nome + ": " + x.msg };
          }
        });
      }

      var f;
      try {
        f = new Function("console", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "__testar",
          d.codigo + "\n;__testar(function (__x) { return eval(__x); });");
      } catch (e) {
        erroFinal = erroDe(e);
        if (e instanceof SyntaxError) {
          try {
            importScripts(ACORN);
            acorn.parse(d.codigo, { ecmaVersion: "latest" });
          } catch (pe) {
            if (pe && pe.loc) erroFinal.linha = pe.loc.line;
          }
        }
        if (d.testes) testes = d.testes.map(function () { return { ok: false, erro: "o código tem erro de sintaxe" }; });
        return terminar();
      }
      try {
        f(cons, meuSetTimeout, meuClearTimeout, meuSetInterval, meuClearInterval, testar);
      } catch (e) {
        erroFinal = erroDe(e);
        if (d.testes && !testes) {
          testes = d.testes.map(function () { return { ok: false, erro: "o código parou com erro antes de chegar aos testes" }; });
        }
      }
      checar();
    };
  }

  var FONTE_JS = null;
  function fonteJs() {
    if (!FONTE_JS) {
      FONTE_JS = "var mostrarValor = " + L.mostrarValor.toString() + ";\n" +
        "var igual = " + L.igual.toString() + ";\n" +
        "var ACORN = " + JSON.stringify(L.CDN.acorn) + ";\n" +
        "(" + trabalhadorJs.toString() + ")();";
    }
    return FONTE_JS;
  }

  // ============================================================ Python (Pyodide)
  var PY_AJUDANTE = [
    "import sys, io, json, traceback",
    "def __lab_input(*a, **k):",
    "    raise RuntimeError('input() não funciona no laboratório — coloque o valor direto numa variável.')",
    "def __lab_rodar(codigo, testes_json):",
    "    testes = json.loads(testes_json)",
    "    ns = {'__name__': '__main__', 'input': __lab_input}",
    "    buf = io.StringIO()",
    "    velho = (sys.stdout, sys.stderr)",
    "    sys.stdout = buf",
    "    sys.stderr = buf",
    "    res = {'ok': True}",
    "    try:",
    "        exec(compile(codigo, '<codigo>', 'exec'), ns)",
    "    except SyntaxError as e:",
    "        res = {'ok': False, 'erro': {'nome': type(e).__name__, 'msg': str(e.msg), 'linha': e.lineno}}",
    "    except BaseException as e:",
    "        linha = None",
    "        for q in traceback.extract_tb(e.__traceback__):",
    "            if q.filename == '<codigo>':",
    "                linha = q.lineno",
    "        res = {'ok': False, 'erro': {'nome': type(e).__name__, 'msg': str(e), 'linha': linha}}",
    "    finally:",
    "        sys.stdout, sys.stderr = velho",
    "    res['saida'] = buf.getvalue()",
    "    saida = []",
    "    for t in testes:",
    "        try:",
    "            a = eval(t['expr'], ns)",
    "            b = eval(t['esperado'], ns)",
    "            saida.append({'ok': bool(a == b), 'obtido': repr(a), 'esperado': repr(b)})",
    "        except BaseException as e:",
    "            saida.append({'ok': False, 'erro': type(e).__name__ + ': ' + str(e)})",
    "    res['testes'] = saida if testes else None",
    "    return json.dumps(res)"
  ].join("\n");

  var py = { worker: null, pronto: false, fila: {}, seq: 0, ouvintes: [] };
  function avisaPython(estado) { py.ouvintes.forEach(function (f) { try { f(estado); } catch (e) { /* ignora */ } }); }
  function iniciaPython() {
    if (py.worker) return;
    var base = L.CDN.pyodide;
    py.pronto = false;
    py.worker = L.criarWorker(
      "importScripts(" + JSON.stringify(base + "pyodide.js") + ");\n" +
      "var PY = loadPyodide({ indexURL: " + JSON.stringify(base) + " }).then(function (p) {\n" +
      "  p.runPython(" + JSON.stringify(PY_AJUDANTE) + ");\n" +
      "  var rodar = p.globals.get('__lab_rodar');\n" +
      "  postMessage({ tipo: 'pronto' });\n" +
      "  return { p: p, rodar: rodar };\n" +
      "});\n" +
      "PY.catch(function (e) { postMessage({ tipo: 'falhou', msg: String(e) }); });\n" +
      "self.onmessage = function (ev) {\n" +
      "  PY.then(function (py) {\n" +
      // pacotes fora da biblioteca padrão do Pyodide (sqlite3...) vêm sob demanda
      "    return py.p.loadPackagesFromImports(ev.data.codigo).catch(function () {}).then(function () {\n" +
      "      var r = py.rodar(ev.data.codigo, JSON.stringify(ev.data.testes || []));\n" +
      "      postMessage({ tipo: 'resultado', id: ev.data.id, dados: JSON.parse(r) });\n" +
      "    });\n" +
      "  }, function (e) {\n" +
      "    postMessage({ tipo: 'resultado', id: ev.data.id, dados: { ok: false, erro: { nome: 'Erro', msg: 'O Python não carregou: ' + e } } });\n" +
      "  });\n" +
      "};");
    avisaPython("carregando");
    py.worker.onmessage = function (ev) {
      var d = ev.data;
      if (d.tipo === "pronto") { py.pronto = true; avisaPython("pronto"); }
      else if (d.tipo === "falhou") avisaPython("falhou");
      else if (d.tipo === "resultado" && py.fila[d.id]) {
        var cb = py.fila[d.id];
        delete py.fila[d.id];
        cb(d.dados);
      }
    };
    py.worker.onerror = function (ev) {
      ev.preventDefault();
      reiniciaPython({ ok: false, erro: { nome: "Erro", msg: "O Python falhou ao iniciar: " + (ev.message || "") } });
      avisaPython("falhou");
    };
  }
  function reiniciaPython(respostaPendentes) {
    L.matarWorker(py.worker);
    py.worker = null;
    py.pronto = false;
    var fila = py.fila;
    py.fila = {};
    Object.keys(fila).forEach(function (k) { fila[k](respostaPendentes); });
  }
  function rodarPython(codigo, testes) {
    iniciaPython();
    return new Promise(function (ok) {
      var id = ++py.seq;
      var ms = py.pronto ? 10000 : 120000;
      var tempo = setTimeout(function () {
        if (!py.fila[id]) return;
        reiniciaPython({ ok: false, tempoEsgotado: true, erro: { nome: "Tempo esgotado",
          msg: py.pronto ? "Passou de 10s rodando — provavelmente um laço infinito. O Python foi reiniciado."
                         : "O Python demorou demais para carregar. Confira a internet e tente de novo." } });
      }, ms);
      py.fila[id] = function (r) {
        clearTimeout(tempo);
        var linhas = String(r.saida || "").replace(/\n$/, "").split("\n")
          .filter(function (l, i, a) { return a.length > 1 || l !== ""; })
          .map(function (l) { return { tipo: "log", texto: l }; });
        ok({ ok: r.ok, linhas: r.saida ? linhas : [], erro: r.erro || null, testes: r.testes || null,
             tempoEsgotado: r.tempoEsgotado });
      };
      py.worker.postMessage({ id: id, codigo: codigo, testes: testes || null });
    });
  }

  // ============================================================ Prolog (Tau Prolog)
  function trabalhadorPrologo() {
    var saida = "";
    console.log = function (t) { saida += t; };
    console.error = function (t) { saida += t; };
    var O = { script: false, url: false, file: false, html: false };
    function junta(a, b) { var r = {}, k; for (k in a) r[k] = a[k]; for (k in b) r[k] = b[k]; return r; }
    self.onmessage = function (ev) {
      var d = ev.data;
      // O Tau pausa a cada 500 inferências (callback "limit"); seguimos enquanto
      // houver tempo. Um limite fixo de passos não serve: na recursão à esquerda
      // cada passo fica mais lento que o anterior.
      var ORCAMENTO = d.orcamento || 2500;
      var s = pl.create(500);
      s.consult(":- use_module(library(lists)).\n" + d.programa, junta(O, {
        success: function () { var sp = saida; saida = ""; rodar(sp); },
        error: function (err) {
          var msg = s.format_answer(err);
          var m = /line\((\d+)\)/.exec(msg);
          postMessage({ ok: false, erro: { nome: "Erro no programa", msg: msg, linha: m ? Number(m[1]) - 1 : null } });
        }
      }));
      function rodar(saidaPrograma) {
        var res = [], i = 0;
        (function prox() {
          if (i >= d.consultas.length) return postMessage({ ok: true, saidaPrograma: saidaPrograma, consultas: res });
          var q = String(d.consultas[i++]).trim().replace(/^\?-\s*/, "");
          if (!/\.\s*$/.test(q)) q += ".";
          var item = { consulta: q, respostas: [] };
          res.push(item);
          saida = "";
          var inicio = Date.now();
          s.query(q, {
            success: function () {
              (function resp(n) {
                if (n >= (d.max || 25)) { item.mais = true; item.saida = saida; return prox(); }
                s.answer({
                  success: function (a) { item.respostas.push(s.format_answer(a)); resp(n + 1); },
                  fail: function () { if (!item.respostas.length) item.respostas.push("false"); item.saida = saida; prox(); },
                  error: function (e) { item.erro = s.format_answer(e); item.saida = saida; prox(); },
                  limit: function () {
                    if (Date.now() - inicio < ORCAMENTO) return resp(n);
                    item.erro = "limite";
                    item.saida = saida;
                    prox();
                  }
                });
              })(0);
            },
            error: function (e) { item.erro = s.format_answer(e); item.saida = saida; prox(); }
          });
        })();
      }
    };
  }
  function rodarPrologo(programa, consultas) {
    var fonte = "self.window = self;\nimportScripts(" + JSON.stringify(L.CDN.tau + "core.js") + ", " +
      JSON.stringify(L.CDN.tau + "lists.js") + ");\n(" + trabalhadorPrologo.toString() + ")();";
    var n = (consultas || []).length;
    return comWorker(fonte, { programa: programa, consultas: consultas || [] }, 6000 + 2600 * n).then(function (r) {
      if (r.consultas) {
        r.consultas.forEach(function (c) {
          if (c.erro === "limite") c.erro = "Limite de inferências atingido — provavelmente recursão infinita (a regra chama a si mesma sem caso base, ou o caso base vem depois).";
        });
      }
      return r;
    });
  }

  // ============================================================ SQL (sql.js / SQLite)
  function trabalhadorSql() {
    var SQLp = initSqlJs({ locateFile: function (f) { return BASE + f; } });
    function resultados(r) { return r.map(function (x) { return { colunas: x.columns, linhas: x.values }; }); }
    function aspas(n) { return "\"" + String(n).replace(/"/g, "\"\"") + "\""; }
    function esquema(db) {
      var t = db.exec("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name");
      if (!t.length) return [];
      return t[0].values.map(function (v) {
        var cols = db.exec("PRAGMA table_info(" + aspas(v[0]) + ")");
        var n = 0;
        try { n = db.exec("SELECT count(*) FROM " + aspas(v[0]))[0].values[0][0]; } catch (e) { n = null; }
        return { nome: v[0], tipo: v[1], linhas: n,
          colunas: cols.length ? cols[0].values.map(function (c) { return { nome: c[1], tipo: c[2], notnull: !!c[3], pk: !!c[5] }; }) : [] };
      });
    }
    self.onmessage = function (ev) {
      var d = ev.data;
      SQLp.then(function (SQL) {
        function novo() {
          var db = new SQL.Database();
          db.exec("PRAGMA foreign_keys = ON;");
          if (d.setup) db.exec(d.setup);
          return db;
        }
        var out = { id: d.id };
        var db;
        try { db = novo(); } catch (e) {
          out.ok = false;
          out.erro = { nome: "Erro no banco de exemplo", msg: e.message };
          return postMessage(out);
        }
        if (d.soEsquema) {
          out.ok = true;
          out.esquema = esquema(db);
          db.close();
          return postMessage(out);
        }
        try {
          out.resultados = resultados(db.exec(d.codigo));
          out.modificadas = db.getRowsModified();
          out.ok = true;
        } catch (e) {
          out.ok = false;
          out.erro = { nome: "Erro SQL", msg: e.message };
        }
        if (d.verificar) {
          try { out.verificacao = resultados(db.exec(d.verificar)); } catch (e) { out.verificacao = null; }
        }
        try { out.esquema = esquema(db); } catch (e) { out.esquema = []; }
        db.close();
        if (d.solucao != null) {
          var db2 = null;
          try {
            db2 = novo();
            out.esperado = resultados(db2.exec(d.solucao));
            if (d.verificar) out.esperadoVerificacao = resultados(db2.exec(d.verificar));
          } catch (e) { out.erroSolucao = e.message; }
          if (db2) db2.close();
        }
        postMessage(out);
      }, function (e) {
        postMessage({ id: d.id, ok: false, erro: { nome: "Erro", msg: "O SQLite não carregou: " + e } });
      });
    };
  }
  var sq = { worker: null, fila: {}, seq: 0, usado: false };
  function iniciaSql() {
    if (sq.worker) return;
    sq.worker = L.criarWorker("var BASE = " + JSON.stringify(L.CDN.sqljs) + ";\nimportScripts(BASE + 'sql-wasm.js');\n(" +
      trabalhadorSql.toString() + ")();");
    sq.worker.onmessage = function (ev) {
      var cb = sq.fila[ev.data.id];
      if (cb) { delete sq.fila[ev.data.id]; sq.usado = true; cb(ev.data); }
    };
    sq.worker.onerror = function (ev) {
      ev.preventDefault();
      reiniciaSql({ ok: false, erro: { nome: "Erro", msg: "O SQLite falhou ao iniciar: " + (ev.message || "") } });
    };
  }
  function reiniciaSql(resp) {
    L.matarWorker(sq.worker);
    sq.worker = null;
    var fila = sq.fila;
    sq.fila = {};
    Object.keys(fila).forEach(function (k) { fila[k](resp); });
  }
  function rodarSql(setup, codigo, opcoes) {
    opcoes = opcoes || {};
    iniciaSql();
    return new Promise(function (ok) {
      var id = ++sq.seq;
      var ms = sq.usado ? 6000 : 30000;
      var tempo = setTimeout(function () {
        if (!sq.fila[id]) return;
        reiniciaSql({ ok: false, tempoEsgotado: true, erro: { nome: "Tempo esgotado",
          msg: "A consulta passou do tempo — um WITH RECURSIVE sem condição de parada?" } });
      }, ms);
      sq.fila[id] = function (r) { clearTimeout(tempo); ok(r); };
      sq.worker.postMessage({ id: id, setup: setup || "", codigo: codigo || "", solucao: opcoes.solucao,
        verificar: opcoes.verificar, soEsquema: !!opcoes.soEsquema });
    });
  }

  L.compararSql = function (r, lab) {
    function ultimo(lista) { return lista && lista.length ? lista[lista.length - 1] : null; }
    function linhaTxt(l) {
      return JSON.stringify(l.map(function (v) { return typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v; }));
    }
    if (r.erroSolucao) return { ok: false, motivo: "A solução de referência falhou (" + r.erroSolucao + ") — avise quem escreveu o exercício." };
    var meu = lab.verificar ? ultimo(r.verificacao) : ultimo(r.resultados);
    var esp = lab.verificar ? ultimo(r.esperadoVerificacao) : ultimo(r.esperado);
    if (!r.ok) return { ok: false, motivo: "O SQL deu erro, então não deu para comparar." };
    if (!esp) return { ok: !meu, motivo: meu ? "Não era para retornar tabela." : "" };
    if (!meu) return { ok: false, motivo: lab.verificar ? "A verificação não retornou nada — o estado do banco ficou diferente do esperado."
                                                        : "Seu SQL não retornou nenhuma tabela (faltou um SELECT?)." };
    if (meu.colunas.length !== esp.colunas.length) {
      return { ok: false, motivo: "Esperava " + esp.colunas.length + " coluna(s) (" + esp.colunas.join(", ") + "), veio " + meu.colunas.length + "." };
    }
    if (meu.linhas.length !== esp.linhas.length) {
      return { ok: false, motivo: "Esperava " + esp.linhas.length + " linha(s), veio " + meu.linhas.length + "." };
    }
    var a = meu.linhas.map(linhaTxt), b = esp.linhas.map(linhaTxt);
    if (!lab.ordem) { a.sort(); b.sort(); }
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return { ok: false, motivo: lab.ordem && a.slice().sort().join() === b.slice().sort().join()
          ? "As linhas certas vieram, mas na ordem errada (confira o ORDER BY)."
          : "Mesma quantidade de linhas, mas os valores não batem com o esperado." };
      }
    }
    return { ok: true, motivo: "" };
  };

  // ============================================================ Passo a passo (rastreador JS)
  // Reescreve o código inserindo chamadas de registro antes de cada comando, na
  // entrada/saída de cada função e em cada return. Nenhuma inserção contém
  // quebra de linha, então os números de linha continuam os do aluno.
  function instrumentar(codigo, acorn) {
    var ast = acorn.parse(codigo, { ecmaVersion: "latest", locations: true, preserveParens: true, sourceType: "script" });
    var ins = [];
    function add(pos, txt, abre, prof) { ins.push({ pos: pos, txt: txt, abre: abre, prof: prof, ord: ins.length }); }
    function ehFuncao(n) {
      return !!n && (n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression");
    }
    function filhos(n, fn) {
      for (var k in n) {
        if (k === "loc" || k === "start" || k === "end" || k === "type") continue;
        var v = n[k];
        if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) if (v[i] && typeof v[i].type === "string") fn(v[i]); }
        else if (v && typeof v.type === "string") fn(v);
      }
    }
    function nomesPadrao(p, out) {
      if (!p) return;
      if (p.type === "Identifier") out.push(p.name);
      else if (p.type === "ObjectPattern") p.properties.forEach(function (q) { nomesPadrao(q.type === "RestElement" ? q.argument : q.value, out); });
      else if (p.type === "ArrayPattern") p.elements.forEach(function (q) { nomesPadrao(q, out); });
      else if (p.type === "RestElement") nomesPadrao(p.argument, out);
      else if (p.type === "AssignmentPattern") nomesPadrao(p.left, out);
    }
    function declaracoes(raiz) {
      var out = [];
      (function andar(n, eRaiz) {
        if (!eRaiz && ehFuncao(n)) { if (n.type === "FunctionDeclaration" && n.id) out.push(n.id.name); return; }
        if (n.type === "VariableDeclaration") n.declarations.forEach(function (d) { nomesPadrao(d.id, out); });
        if (n.type === "ClassDeclaration") { if (n.id) out.push(n.id.name); return; }
        if (n.type === "ClassExpression") return;
        if (n.type === "CatchClause" && n.param) nomesPadrao(n.param, out);
        filhos(n, function (c) { andar(c, false); });
      })(raiz, true);
      var vis = {};
      return out.filter(function (x) { if (vis[x] || /^__/.test(x)) return false; vis[x] = 1; return true; });
    }
    function getterTxt(nomes, comThis) {
      var p = nomes.map(function (n) { return JSON.stringify(n) + ": __v(() => " + n + ")"; });
      if (comThis) p.push("\"this\": __v(() => this)");
      return "() => ({" + p.join(", ") + "})";
    }
    function nomeChave(k) {
      if (!k) return "anônima";
      if (k.type === "Identifier") return k.name;
      if (k.type === "PrivateIdentifier") return "#" + k.name;
      return String(k.value);
    }
    var escopos = [];
    function traco(linha) {
      var e = escopos.length ? escopos[escopos.length - 1] : null;
      return "__t(" + linha + ", " + (e ? e.getter : "null") + ", " + (e ? e.fecho : "null") + ")";
    }
    function visitarFuncao(fn, prof, nome, comThis, tipo) {
      var params = [];
      fn.params.forEach(function (p) { nomesPadrao(p, params); });
      var locais = params.concat(fn.body.type === "BlockStatement" ? declaracoes(fn) : []);
      locais = locais.filter(function (x, i, a) { return a.indexOf(x) === i && !/^__/.test(x); });
      var usados = {};
      (function u(n) { if (n.type === "Identifier") usados[n.name] = 1; filhos(n, u); })(fn.body);
      var fecho = [];
      for (var i = escopos.length - 1; i >= 0; i--) {
        escopos[i].nomes.forEach(function (n) {
          if (usados[n] && locais.indexOf(n) < 0 && fecho.indexOf(n) < 0) fecho.push(n);
        });
      }
      var usaThis = !!comThis && fn.type !== "ArrowFunctionExpression";
      var escopo = { nomes: locais, getter: getterTxt(locais.concat(fecho), usaThis), fecho: JSON.stringify(fecho) };
      var gParams = getterTxt(params, usaThis && tipo !== "constructor");
      var nomeF = nome || (fn.id && fn.id.name) || "anônima";
      var entrada = "__en(" + JSON.stringify(nomeF) + ", " + fn.loc.start.line + ", " + gParams + ");";
      escopos.push(escopo);
      if (fn.body.type === "BlockStatement") {
        add(fn.body.start + 1, " " + entrada + " try {", true, prof + 1);
        add(fn.body.end - 1, " } finally { __sa(); } ", false, prof + 1);
        visitar(fn.body, prof + 1);
      } else {
        var lb = fn.body.loc.start.line;
        add(fn.body.start, "{ " + entrada + " try { " + traco(lb) + "; return __r((", true, prof + 1);
        add(fn.body.end, "), " + lb + "); } finally { __sa(); } }", false, prof + 1);
        visitar(fn.body, prof + 2);
      }
      escopos.pop();
      fn.params.forEach(function (p) { if (p.type !== "Identifier") visitar(p, prof); });
    }
    var classes = [];
    function stmt(s, prof, sozinho, linhaPai) {
      if (s.type === "FunctionDeclaration" || s.type === "EmptyStatement" || s.type === "BlockStatement") return visitar(s, prof);
      // "if (x) return 1;" numa linha só: o passo do if já mostra essa linha
      if (sozinho && s.loc.start.line === linhaPai) return visitar(s, prof);
      var t = traco(s.loc.start.line) + ";";
      if (sozinho) { add(s.start, "{ " + t + " ", true, prof); add(s.end, " }", false, prof); }
      else add(s.start, t + " ", true, prof);
      visitar(s, prof);
    }
    function visitar(n, prof) {
      if (!n || typeof n.type !== "string") return;
      switch (n.type) {
        case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunctionExpression":
          return visitarFuncao(n, prof, null, false);
        case "ClassDeclaration": case "ClassExpression":
          classes.push(n.id ? n.id.name : "");
          filhos(n, function (c) { visitar(c, prof); });
          classes.pop();
          return;
        case "MethodDefinition":
          var cl = classes[classes.length - 1];
          var nm = n.kind === "constructor" ? "new " + (cl || "objeto")
                 : (cl ? cl + "." : "") + nomeChave(n.key);
          return visitarFuncao(n.value, prof, nm, true, n.kind);
        case "PropertyDefinition":
          if (n.value && ehFuncao(n.value)) return visitarFuncao(n.value, prof, nomeChave(n.key), true);
          return visitar(n.value, prof);
        case "VariableDeclarator":
          if (n.id.type !== "Identifier") visitar(n.id, prof);
          if (n.init && ehFuncao(n.init) && n.id.type === "Identifier") return visitarFuncao(n.init, prof, n.id.name, false);
          return visitar(n.init, prof);
        case "Property":
          if (ehFuncao(n.value) && !n.computed) return visitarFuncao(n.value, prof, nomeChave(n.key), n.method || n.value.type === "FunctionExpression");
          break;
        case "AssignmentExpression":
          if (ehFuncao(n.right) && n.left.type === "MemberExpression" && !n.left.computed) {
            visitar(n.left, prof);
            return visitarFuncao(n.right, prof, nomeChave(n.left.property), n.right.type === "FunctionExpression");
          }
          break;
        case "Program": case "BlockStatement": case "StaticBlock":
          n.body.forEach(function (s) { stmt(s, prof + 1, false); });
          return;
        case "SwitchCase":
          visitar(n.test, prof);
          n.consequent.forEach(function (s) { stmt(s, prof + 1, false); });
          return;
        case "IfStatement":
          visitar(n.test, prof);
          stmt(n.consequent, prof + 1, true, n.loc.start.line);
          if (n.alternate) stmt(n.alternate, prof + 1, true, n.alternate.type === "IfStatement" ? -1 : n.loc.start.line);
          return;
        case "ForStatement": case "WhileStatement": case "DoWhileStatement":
          if (n.init) visitar(n.init, prof);
          if (n.test) {
            add(n.test.start, "(" + traco(n.loc.start.line) + " && (", true, prof + 1);
            add(n.test.end, "))", false, prof + 1);
            visitar(n.test, prof + 2);
          }
          if (n.update) visitar(n.update, prof);
          stmt(n.body, prof + 1, true, n.test ? n.loc.start.line : -1);
          return;
        case "ForInStatement": case "ForOfStatement":
          visitar(n.left, prof);
          visitar(n.right, prof);
          stmt(n.body, prof + 1, true, -1);
          return;
        case "LabeledStatement":
          return visitar(n.body, prof);
        case "ReturnStatement":
          if (n.argument) {
            add(n.argument.start, "__r((", true, prof + 1);
            add(n.argument.end, "), " + n.loc.start.line + ")", false, prof + 1);
            visitar(n.argument, prof + 2);
          } else {
            add(n.start + 6, " __r(undefined, " + n.loc.start.line + ")", true, prof + 1);
          }
          return;
      }
      filhos(n, function (c) { visitar(c, prof); });
    }
    visitar(ast, 0);
    var globais = declaracoes(ast);
    ins.sort(function (a, b) {
      if (a.pos !== b.pos) return a.pos - b.pos;
      if (a.abre !== b.abre) return a.abre ? 1 : -1;
      if (!a.abre) return (b.prof - a.prof) || (a.ord - b.ord);
      return (a.prof - b.prof) || (a.ord - b.ord);
    });
    var out = "", ult = 0;
    ins.forEach(function (x) { out += codigo.slice(ult, x.pos) + x.txt; ult = x.pos; });
    out += codigo.slice(ult);
    return "__rg(" + getterTxt(globais, false) + "); " + out;
  }

  function trabalhadorPasso() {
    function LimiteErro() {}
    self.onmessage = function (ev) {
      var d = ev.data, LIM = d.limite || 1500, enviado = false;
      var passos = [], saida = [], pilha = [{ nome: "Global", id: 0, vars: [] }], seq = 1, getG = null;
      function coleta(g, fecho) {
        var o;
        try { o = g(); } catch (e) { if (e instanceof LimiteErro) throw e; return []; }
        var r = [];
        for (var k in o) {
          var c = o[k];
          if (c.fora) continue;
          r.push([k, c.tdz ? "‹ainda não inicializada›" : mostrarValor(c.v, false),
                  k === "this" ? "this" : (fecho && fecho.indexOf(k) >= 0 ? "closure" : "")]);
        }
        return r;
      }
      function enviar(extra) {
        if (enviado) return;
        enviado = true;
        var r = { ok: true, passos: passos, saida: saida };
        for (var k in extra) r[k] = extra[k];
        postMessage(r);
      }
      function registra(linha, evento, extra) {
        if (passos.length >= LIM) { enviar({ limite: true }); throw new LimiteErro(); }
        if (getG) pilha[0].vars = coleta(getG);
        passos.push({ l: linha, e: evento, x: extra == null ? null : extra, s: saida.length,
          p: pilha.map(function (f) { return { n: f.nome, id: f.id, v: f.vars }; }) });
      }
      function __v(f) {
        try { return { v: f() }; } catch (e) {
          if (e instanceof LimiteErro) throw e;
          if (e instanceof ReferenceError && /before initialization/.test(e.message)) return { tdz: true };
          return { fora: true };
        }
      }
      function __rg(g) { getG = g; }
      function __t(linha, g, fecho) {
        if (g && pilha.length > 1) pilha[pilha.length - 1].vars = coleta(g, fecho);
        registra(linha, "linha");
        return true;
      }
      function __en(nome, linha, g) {
        var f = { nome: nome, id: seq++, vars: [] };
        pilha.push(f);
        if (g) f.vars = coleta(g);
        registra(linha, "chamada", nome + "(" + f.vars.filter(function (v) { return v[2] !== "this"; })
          .map(function (v) { return v[1]; }).join(", ") + ")");
      }
      function __sa() { if (pilha.length > 1) pilha.pop(); }
      function __r(v, linha) { registra(linha, "retorno", mostrarValor(v, false)); return v; }
      function empilha(tipo, args) {
        saida.push({ tipo: tipo, texto: Array.prototype.map.call(args, function (a) { return mostrarValor(a, true); }).join(" ") });
      }
      var cons = {
        log: function () { empilha("log", arguments); },
        info: function () { empilha("log", arguments); },
        warn: function () { empilha("warn", arguments); },
        error: function () { empilha("error", arguments); }
      };
      var f;
      try {
        f = new Function("__t", "__v", "__en", "__sa", "__r", "__rg", "console", instrumentar(d.codigo, acorn));
      } catch (e) {
        return postMessage({ ok: false, passos: [], saida: [],
          erro: { nome: e.name || "SyntaxError", msg: String(e.message).replace(/\s*\(\d+:\d+\)$/, ""), linha: e.loc ? e.loc.line : null } });
      }
      var res = {};
      try { f(__t, __v, __en, __sa, __r, __rg, cons); }
      catch (e) {
        if (e instanceof LimiteErro) return;
        res.ok = false;
        res.erro = { nome: e.name || "Erro", msg: String(e.message), linha: passos.length ? passos[passos.length - 1].l : null };
      }
      if (enviado) return;
      pilha = [pilha[0]];
      try { registra(null, res.erro ? "erro" : "fim", res.erro ? res.erro.nome + ": " + res.erro.msg : null); } catch (e2) { /* limite */ }
      enviar(res);
    };
  }
  var FONTE_PASSO = null;
  function fontePasso() {
    if (!FONTE_PASSO) {
      FONTE_PASSO = "importScripts(" + JSON.stringify(L.CDN.acorn) + ");\n" +
        "var mostrarValor = " + L.mostrarValor.toString() + ";\n" +
        "var instrumentar = " + instrumentar.toString() + ";\n" +
        "(" + trabalhadorPasso.toString() + ")();";
    }
    return FONTE_PASSO;
  }
  function rodarPasso(codigo) {
    return comWorker(fontePasso(), { codigo: codigo }, 8000);
  }

  // ============================================================ HTML/CSS (iframe isolado)
  var tokens = {};
  window.addEventListener("message", function (ev) {
    var d = ev.data;
    if (!d || typeof d !== "object" || !d.__lab || !tokens[d.__lab]) return;
    tokens[d.__lab](d);
  });
  function novoToken(fn) {
    var t = "t" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    tokens[t] = fn;
    return t;
  }
  function soltarToken(t) { delete tokens[t]; }

  function scriptCaptura(token) {
    return "<script>(function(){var T=" + JSON.stringify(token) + ";" +
      "function env(t,a){try{parent.postMessage({__lab:T,tipo:t,texto:[].map.call(a,function(x){" +
      "if(typeof x==='string')return x;try{return JSON.stringify(x)}catch(e){return String(x)}}).join(' ')},'*')}catch(e){}}" +
      "['log','info','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){" +
      "env(k==='info'?'log':k,arguments);if(o)o.apply(console,arguments)}});" +
      "window.addEventListener('error',function(e){env('error',[e.message+(e.lineno?' (linha '+e.lineno+')':'')])});" +
      "document.addEventListener('submit',function(e){e.preventDefault();" +
      "env('info',['[formulário enviado — no laboratório o envio é simulado, a página não muda]'])},true);" +
      "document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');" +
      "if(a&&a.getAttribute('href').charAt(0)!=='#'){e.preventDefault();env('info',['[link para '+a.getAttribute('href')+' — navegação desativada no laboratório]'])}},true);" +
      "})();<\/script>";
  }
  function montaDocumento(codigo, cabeca, fim) {
    var doc = String(codigo || "");
    var mH = /<head[^>]*>/i.exec(doc);
    if (mH) doc = doc.slice(0, mH.index + mH[0].length) + cabeca + doc.slice(mH.index + mH[0].length);
    else doc = cabeca + doc;
    if (fim) {
      var mB = /<\/body>/i.exec(doc);
      if (mB) doc = doc.slice(0, mB.index) + fim + doc.slice(mB.index);
      else doc += fim;
    }
    return doc;
  }

  L.criarPreview = function (host, aoConsole) {
    var moldura = L.el("div", "lab-prev-moldura");
    var iframe = document.createElement("iframe");
    iframe.className = "lab-prev";
    iframe.setAttribute("sandbox", "allow-scripts allow-forms allow-modals");
    iframe.setAttribute("title", "Pré-visualização da página");
    moldura.appendChild(iframe);
    host.appendChild(moldura);
    var token = null, largura = 0, ALTURA = 440;
    function ajusta() {
      var disp = moldura.clientWidth || host.clientWidth || 600;
      var w = largura || disp;
      var escala = Math.min(1, disp / w);
      iframe.style.width = w + "px";
      iframe.style.height = ALTURA + "px";
      iframe.style.transform = escala < 1 ? "scale(" + escala + ")" : "";
      moldura.style.height = Math.round(ALTURA * escala) + "px";
    }
    window.addEventListener("resize", ajusta);
    return {
      atualizar: function (codigo) {
        if (token) soltarToken(token);
        token = novoToken(function (d) { if (aoConsole) aoConsole(d); });
        iframe.srcdoc = montaDocumento(codigo, scriptCaptura(token), "");
        ajusta();
      },
      largura: function (px) { largura = px || 0; ajusta(); },
      ajustar: ajusta,
      destruir: function () { if (token) soltarToken(token); window.removeEventListener("resize", ajusta); }
    };
  };

  function scriptTestes(token, corpos) {
    var json = JSON.stringify(corpos).replace(/<\//g, "<\\/");
    return "<script>(function(){var T=" + JSON.stringify(token) + ",TS=" + json + ";" +
      "function $(s){return typeof s==='string'?document.querySelector(s):s}" +
      "function todos(s){return Array.prototype.slice.call(document.querySelectorAll(s))}" +
      "function css(s,p){var e=$(s);return e?getComputedStyle(e).getPropertyValue(p).trim():''}" +
      "function caixa(s){var e=$(s);return e?e.getBoundingClientRect():null}" +
      "function largura(s){var c=caixa(s);return c?c.width:0}" +
      "function altura(s){var c=caixa(s);return c?c.height:0}" +
      "function ladoALado(a,b){var x=caixa(a),y=caixa(b);return !!(x&&y)&&Math.abs(x.top-y.top)<8&&Math.abs(x.left-y.left)>1}" +
      "function empilhados(a,b){var x=caixa(a),y=caixa(b);return !!(x&&y)&&y.top>=x.bottom-2}" +
      "function texto(s){var e=$(s);return e?e.textContent.trim():''}" +
      "function clicar(s){var e=$(s);if(e)e.click();return !!e}" +
      "function visiveis(s){return todos(s).filter(function(e){var c=getComputedStyle(e);return !e.hidden&&c.display!=='none'&&c.visibility!=='hidden'})}" +
      "var NOMES=['$','todos','css','caixa','largura','altura','ladoALado','empilhados','texto','clicar','visiveis'];" +
      "var FNS=[$,todos,css,caixa,largura,altura,ladoALado,empilhados,texto,clicar,visiveis];" +
      // primeiro tenta como expressão; se não compilar, é um corpo com return
      "function compila(t){try{return Function.apply(null,NOMES.concat('return ('+t+'\\n)'))}catch(e){return Function.apply(null,NOMES.concat(t))}}" +
      "function roda(){var R=TS.map(function(t){try{" +
      "return {ok:!!compila(t).apply(null,FNS)}}catch(e){return {ok:false,erro:e.message}}});" +
      "parent.postMessage({__lab:T,tipo:'testes',r:R},'*')}" +
      "if(document.readyState==='complete')setTimeout(roda,60);else window.addEventListener('load',function(){setTimeout(roda,60)})" +
      "})();<\/script>";
  }
  function testarWeb(codigo, testes) {
    var grupos = {};
    testes.forEach(function (t, i) {
      var w = t.largura || 1024;
      (grupos[w] || (grupos[w] = [])).push(i);
    });
    var resultados = new Array(testes.length);
    return Promise.all(Object.keys(grupos).map(function (w) {
      return new Promise(function (ok) {
        var idx = grupos[w];
        var iframe = document.createElement("iframe");
        iframe.setAttribute("sandbox", "allow-scripts");
        iframe.setAttribute("aria-hidden", "true");
        iframe.tabIndex = -1;
        iframe.style.cssText = "position:fixed;left:-99999px;top:0;width:" + w + "px;height:800px;border:0;opacity:0;pointer-events:none";
        var feito = false;
        function fim(r) {
          if (feito) return;
          feito = true;
          soltarToken(token);
          clearTimeout(tempo);
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
          idx.forEach(function (i, k) { resultados[i] = r ? r[k] : { ok: false, erro: "a página não respondeu (erro de script?)" }; });
          ok();
        }
        var token = novoToken(function (d) { if (d.tipo === "testes") fim(d.r); });
        var tempo = setTimeout(function () { fim(null); }, 6000);
        iframe.srcdoc = montaDocumento(codigo, scriptCaptura(token), scriptTestes(token, idx.map(function (i) { return testes[i].corpo; })));
        document.body.appendChild(iframe);
      });
    })).then(function () {
      return testes.map(function (t, i) {
        var r = resultados[i] || { ok: false };
        return { nome: (t.largura ? "[tela de " + t.largura + "px] " : "") + t.nome, ok: r.ok, erro: r.erro };
      });
    });
  }

  L.motores = {
    js: function (codigo, testes) { return comWorker(fonteJs(), { codigo: codigo, testes: testes || null }, 5000); },
    python: rodarPython,
    prolog: rodarPrologo,
    sql: rodarSql,
    passo: rodarPasso,
    testarWeb: testarWeb
  };
  L.python = {
    pronto: function () { return py.pronto; },
    iniciado: function () { return !!py.worker; },
    ouvir: function (fn) { py.ouvintes.push(fn); return function () { py.ouvintes = py.ouvintes.filter(function (x) { return x !== fn; }); }; },
    aquecer: iniciaPython
  };
  L._fontes = { js: fonteJs, passo: fontePasso };
})(window.LAB = window.LAB || {});
