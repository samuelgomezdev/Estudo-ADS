/* Laboratório — base: utilitários, carregador de bibliotecas, formatação e
   tradução de erros. Todos os arquivos de template/lab/ compartilham o objeto
   window.LAB; o gerar.py junta tudo antes do app.js. */
(function (L) {
  "use strict";

  L.CDN = {
    cm: "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.18/",
    acorn: "https://cdn.jsdelivr.net/npm/acorn@8.14.0/dist/acorn.js",
    tau: "https://cdn.jsdelivr.net/npm/tau-prolog@0.3.4/modules/",
    sqljs: "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/",
    pyodide: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
  };

  L.NOMES_LING = { js: "JavaScript", python: "Python", prolog: "Prolog", sql: "SQL",
                   web: "HTML/CSS", texto: "Texto", java: "Java" };
  L.NOMES_TIPO = { explorar: "Explorar", prever: "Prever", desafio: "Desafio",
                   parsons: "Montar", passo: "Passo a passo" };
  L.DESC_TIPO = {
    explorar: "rode, altere e observe",
    prever: "preveja a saída antes de rodar",
    desafio: "escreva código que passe nos testes",
    parsons: "monte o código na ordem certa",
    passo: "veja a execução linha por linha"
  };

  // ------------------------------------------------------------ DOM
  L.el = function (tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  L.esc = function (s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  // markdown mínimo e seguro: escapa tudo e só então aplica **negrito**, `código`
  // e parágrafos por linha em branco
  L.md = function (txt) {
    return String(txt || "").split(/\n\s*\n/).map(function (p) {
      var h = L.esc(p.trim())
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
        .replace(/\n/g, "<br>");
      return "<p>" + h + "</p>";
    }).join("");
  };
  L.mdEm = function (alvo, txt) { alvo.innerHTML = L.md(txt); return alvo; };

  L.lerLS = function (chave, padrao) {
    try {
      var v = localStorage.getItem(chave);
      return v == null ? padrao : JSON.parse(v);
    } catch (e) { return padrao; }
  };
  L.gravarLS = function (chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); return true; }
    catch (e) { return false; }
  };

  L.embaralhar = function (a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  L.hoje = function (d) {
    d = d || new Date();
    var m = d.getMonth() + 1, dia = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (dia < 10 ? "0" : "") + dia;
  };

  // ------------------------------------------------------------ carregador
  var carregados = {};
  L.carregarScript = function (url) {
    if (!carregados[url]) {
      carregados[url] = new Promise(function (ok, falha) {
        var s = document.createElement("script");
        s.src = url;
        s.onload = function () { ok(); };
        s.onerror = function () { delete carregados[url]; falha(new Error("não carregou " + url)); };
        document.head.appendChild(s);
      });
    }
    return carregados[url];
  };
  L.carregarCss = function (url) {
    if (!carregados[url]) {
      carregados[url] = new Promise(function (ok) {
        var l = document.createElement("link");
        l.rel = "stylesheet";
        l.href = url;
        l.onload = l.onerror = function () { ok(); };
        document.head.appendChild(l);
      });
    }
    return carregados[url];
  };

  L.criarWorker = function (fonte) {
    var url = URL.createObjectURL(new Blob([fonte], { type: "application/javascript" }));
    var w = new Worker(url);
    w._url = url;
    return w;
  };
  L.matarWorker = function (w) {
    if (!w) return;
    try { w.terminate(); } catch (e) { /* já morreu */ }
    if (w._url) URL.revokeObjectURL(w._url);
  };

  // ------------------------------------------------------------ formatação
  // Mesma função roda na página e dentro dos Workers (vai por toString), então
  // precisa ser autocontida. O formato segue o console do navegador, compacto:
  // strings cruas no topo e com aspas dentro de estruturas.
  L.mostrarValor = function mostrarValor(v, topo, prof, vistos) {
    prof = prof || 0;
    vistos = vistos || [];
    if (v === null) return "null";
    var t = typeof v;
    if (t === "undefined") return "undefined";
    if (t === "string") return topo ? v : JSON.stringify(v);
    if (t === "number") return Object.is(v, -0) ? "-0" : String(v);
    if (t === "boolean") return String(v);
    if (t === "bigint") return String(v) + "n";
    if (t === "symbol") return v.toString();
    if (t === "function") {
      var fonte = "";
      try { fonte = Function.prototype.toString.call(v); } catch (e) { /* nativa */ }
      if (/^class[\s{]/.test(fonte)) return "[class " + (v.name || "anônima") + "]";
      return "[Function: " + (v.name || "anônima") + "]";
    }
    if (vistos.indexOf(v) >= 0) return "[Circular]";
    if (prof > 3) return Array.isArray(v) ? "[Array]" : "[Object]";
    vistos = vistos.concat([v]);
    function dentro(x) { return mostrarValor(x, false, prof + 1, vistos); }
    if (Array.isArray(v)) return "[" + v.map(dentro).join(", ") + "]";
    if (typeof Map !== "undefined" && v instanceof Map) {
      var pares = [];
      v.forEach(function (val, k) { pares.push(dentro(k) + " => " + dentro(val)); });
      return "Map(" + v.size + ") {" + (pares.length ? " " + pares.join(", ") + " " : "") + "}";
    }
    if (typeof Set !== "undefined" && v instanceof Set) {
      var itens = [];
      v.forEach(function (val) { itens.push(dentro(val)); });
      return "Set(" + v.size + ") {" + (itens.length ? " " + itens.join(", ") + " " : "") + "}";
    }
    if (v instanceof Error) return v.name + ": " + v.message;
    if (v instanceof Date) return isNaN(v) ? "Invalid Date" : v.toISOString();
    if (typeof Promise !== "undefined" && v instanceof Promise) return "Promise { … }";
    var nome = "";
    try {
      var proto = Object.getPrototypeOf(v);
      if (proto === null) nome = "[Object: null prototype] ";
      else if (proto.constructor && proto.constructor !== Object && proto.constructor.name) nome = proto.constructor.name + " ";
    } catch (e) { /* proxy exótico */ }
    var chaves = Object.keys(v);
    if (!chaves.length) return nome + "{}";
    return nome + "{ " + chaves.map(function (k) {
      return (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ": " + dentro(v[k]);
    }).join(", ") + " }";
  };

  // igualdade profunda dos testes (também vai para o Worker por toString)
  L.igual = function igual(a, b) {
    if (typeof a === "number" && typeof b === "number") {
      if (isNaN(a) && isNaN(b)) return true;
      return a === b || Math.abs(a - b) < 1e-9;
    }
    if (a === b) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!igual(a[i], b[i])) return false;
      return true;
    }
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      var ok = true;
      a.forEach(function (v, k) { if (!b.has(k) || !igual(v, b.get(k))) ok = false; });
      return ok;
    }
    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) return false;
      var todos = true;
      a.forEach(function (v) { if (!b.has(v)) todos = false; });
      return todos;
    }
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var j = 0; j < ka.length; j++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[j]) || !igual(a[ka[j]], b[ka[j]])) return false;
    }
    return true;
  };

  L.normalizar = function (s) {
    return String(s == null ? "" : s).split("\n").map(function (l) {
      return l.trim().replace(/\s+/g, " ");
    }).filter(function (l, i, a) { return l || i < a.length - 1; }).join("\n").trim().toLowerCase();
  };

  // tira comentários antes de aplicar as regras de desafio ("proibido usar for"
  // não pode reprovar quem escreveu "for" num comentário)
  L.semComentarios = function (codigo, ling) {
    if (ling === "python") return codigo.replace(/#.*$/gm, "");
    if (ling === "sql") return codigo.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    if (ling === "prolog") return codigo.replace(/%.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
  };

  // ------------------------------------------------------------ erros em português
  var TRADUCOES = [
    [/^(\S+) is not defined$/, function (m) { return "“" + m[1] + "” não existe neste ponto do código. Foi declarada? O nome está escrito igual (maiúsculas contam)?"; }],
    [/^Cannot access '(.+)' before initialization$/, function (m) { return "“" + m[1] + "” foi usada antes da linha que a declara. let, const e class não são “içadas” como var."; }],
    [/^(.+) is not a function$/, function (m) { return "“" + m[1] + "” não é uma função. Confira o nome do método e se o objeto é mesmo do tipo que você acha."; }],
    [/^(.+) is not a constructor$/, function (m) { return "“" + m[1] + "” não pode ser usado com new."; }],
    [/^Cannot read propert(?:y|ies) of (undefined|null)(?: \(reading '(.+)'\))?/, function (m) { return "Tentou ler " + (m[2] ? "“" + m[2] + "” " : "uma propriedade ") + "de algo que vale " + m[1] + ". A variável antes do ponto não tem o objeto que você esperava."; }],
    [/^Cannot set propert(?:y|ies) of (undefined|null)/, function (m) { return "Tentou escrever numa propriedade de algo que vale " + m[1] + "."; }],
    [/^Assignment to constant variable/, function () { return "Tentou reatribuir uma const. Use let se o valor precisa mudar."; }],
    [/Private field '#(\w+)' must be declared in an enclosing class/, function (m) { return "O campo #" + m[1] + " é privado: só o código de dentro da própria classe enxerga. É o encapsulamento funcionando."; }],
    [/Cannot read private member #(\w+)/, function (m) { return "#" + m[1] + " é privado da classe, não dá para ler de fora."; }],
    [/Class constructor (\w+) cannot be invoked without 'new'/, function (m) { return "Classe " + m[1] + " precisa ser criada com new " + m[1] + "(...)."; }],
    [/Must call super constructor|before accessing 'this'/, function () { return "Numa subclasse, chame super(...) no construtor antes de usar this."; }],
    [/Maximum call stack size exceeded/, function () { return "Estouro de pilha: uma função chamou a si mesma sem parar. Falta o caso base da recursão?"; }],
    [/Unexpected end of input/, function () { return "O código terminou antes da hora: falta fechar algum { ( ou [."; }],
    [/Unexpected token|Unexpected identifier|Unexpected character|missing \) after|Invalid or unexpected token/, function () { return "Erro de sintaxe: sobra ou falta algum símbolo ( ) { } ; , perto dessa linha."; }],
    [/Identifier '(.+)' has already been declared/, function (m) { return "“" + m[1] + "” foi declarada duas vezes no mesmo escopo."; }],
    [/Invalid array length/, function () { return "Tamanho de array inválido (negativo ou grande demais)."; }],
    // Python
    [/^name '(.+)' is not defined/, function (m) { return "“" + m[1] + "” não existe. Foi definida antes desta linha? O nome está igual?"; }],
    [/^unsupported operand type\(s\) for (.+): '(.+)' and '(.+)'/, function (m) { return "Não dá para usar " + m[1] + " entre " + m[2] + " e " + m[3] + ". Converta um dos lados (int(), str()...)."; }],
    [/can only concatenate str \(not "(.+)"\) to str/, function (m) { return "Juntou texto com " + m[1] + ". Use str(valor) ou uma f-string: f\"...{valor}\"."; }],
    [/^division by zero|integer division or modulo by zero/, function () { return "Divisão por zero."; }],
    [/list index out of range|string index out of range|tuple index out of range/, function () { return "Índice fora da lista: o último índice é len(lista) - 1."; }],
    [/'(\w+)' object has no attribute '(\w+)'/, function (m) { return "Objeto do tipo " + m[1] + " não tem o atributo “" + m[2] + "”."; }],
    [/Can't instantiate abstract class (\w+)/, function (m) { return "Não dá para criar objeto da classe abstrata " + m[1] + " — só de uma subclasse que implemente todos os métodos abstratos."; }],
    [/expected an indented block|unexpected indent|unindent does not match/, function () { return "Erro de indentação: em Python o recuo (espaços) é parte da sintaxe."; }],
    [/invalid syntax/, function () { return "Erro de sintaxe. Confira dois-pontos no fim de if/for/def/class e parênteses."; }],
    [/object is not callable/, function () { return "Tentou chamar com () algo que não é função."; }],
    [/missing \d+ required positional argument/, function () { return "Faltou argumento na chamada da função."; }],
    [/object is not subscriptable/, function () { return "Usou [ ] em algo que não é lista/dicionário/string."; }],
    [/^KeyError/, function () { return "Essa chave não existe no dicionário. Use .get(chave) para ter um padrão."; }],
    // SQL (SQLite)
    [/no such column: (\S+)/, function (m) { return "A coluna “" + m[1] + "” não existe. Confira o nome no painel de tabelas (e o apelido da tabela, se usou)."; }],
    [/no such table: (\S+)/, function (m) { return "A tabela “" + m[1] + "” não existe. Confira o nome no painel de tabelas."; }],
    [/ambiguous column name: (\S+)/, function (m) { return "“" + m[1] + "” existe em mais de uma tabela do JOIN. Prefixe com a tabela: tabela." + m[1] + "."; }],
    [/UNIQUE constraint failed: (\S+)/, function (m) { return "Violou a restrição UNIQUE/PRIMARY KEY em " + m[1] + ": já existe uma linha com esse valor."; }],
    [/NOT NULL constraint failed: (\S+)/, function (m) { return "A coluna " + m[1] + " é NOT NULL e ficou sem valor."; }],
    [/FOREIGN KEY constraint failed/, function () { return "Violou a chave estrangeira: o valor referenciado não existe na tabela pai (ou ainda há filhos apontando para a linha)."; }],
    [/CHECK constraint failed/, function () { return "Violou uma restrição CHECK da tabela: o valor não passa na regra definida."; }],
    [/near "(.+)": syntax error/, function (m) { return "Erro de sintaxe SQL perto de “" + m[1] + "”. Confira vírgulas, aspas simples para texto e a ordem das cláusulas."; }],
    [/incomplete input/, function () { return "Comando SQL incompleto (faltou fechar parêntese ou aspas?)."; }],
    [/misuse of aggregate/, function () { return "Função de agregação (COUNT, SUM...) usada no lugar errado — no WHERE use HAVING."; }],
    // Prolog (Tau)
    [/existence_error\(procedure, ?([^/]+)\/(\d+)\)/, function (m) { return "O predicado " + m[1] + "/" + m[2] + " não existe: não há fato nem regra com esse nome e " + m[2] + " argumento(s)."; }],
    [/syntax_error/, function () { return "Erro de sintaxe Prolog. Toda cláusula termina com ponto final; variáveis começam com maiúscula; átomos com minúscula."; }],
    [/instantiation_error/, function () { return "Uma variável ainda sem valor foi usada onde precisava de um valor (ex.: is com lado direito não calculado)."; }],
    [/type_error\(evaluable, ?([^)]+)\)/, function (m) { return "“" + m[1] + "” não é algo que o is consiga calcular."; }]
  ];
  L.explicarErro = function (msg) {
    msg = String(msg || "");
    for (var i = 0; i < TRADUCOES.length; i++) {
      var m = msg.match(TRADUCOES[i][0]);
      if (m) return TRADUCOES[i][1](m);
    }
    return "";
  };

  // ------------------------------------------------------------ avisos flutuantes
  L.toast = function (html, tipo) {
    var host = document.getElementById("lab-toasts");
    if (!host) {
      host = L.el("div", "lab-toasts");
      host.id = "lab-toasts";
      host.setAttribute("role", "status");
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    var t = L.el("div", "lab-toast " + (tipo || ""));
    t.innerHTML = html;
    host.appendChild(t);
    setTimeout(function () { t.classList.add("sai"); }, 3200);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3700);
  };
})(window.LAB = window.LAB || {});
