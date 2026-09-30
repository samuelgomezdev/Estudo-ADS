/* Conta do admin: login (Supabase) e histórico sincronizado entre máquinas.
   Visitantes não são afetados: sem login, tudo continua só no localStorage.
   O limite de 5 máquinas e o acesso aos dados são garantidos no banco
   (supabase/schema.sql); aqui só fica a interface e a mesclagem. */
(function () {
  "use strict";

  var CFG = typeof DADOS !== "undefined" && DADOS.conta ? DADOS.conta : null;
  var LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js";
  // o que viaja para a nuvem: progresso do quiz, laboratório e rascunhos das discursivas
  var CHAVES = ["estudo-ads", "estudo-ads-labprog", "estudo-ads-disc:"];
  var CHAVE_DISP = "estudo-ads-dispositivo";
  var LIMITE = 5;

  // ============================================================ mesclagem
  // Funções puras. Regra geral: nunca perder progresso — de cada lado fica o
  // registro "mais avançado". Idempotentes: mesclar de novo não muda nada.
  function obj(x) { return x && typeof x === "object" && !Array.isArray(x) ? x : null; }

  function mesclarQuiz(a, b) {
    a = obj(a); b = obj(b);
    if (!a || !b) return a || b || undefined;
    var out = {};
    Object.keys(b).concat(Object.keys(a)).forEach(function (mid) {
      var p = a[mid], q = b[mid];
      if (!p || !q) { out[mid] = p || q; return; }
      var tp = p.total || 0, tq = q.total || 0;
      out[mid] = tq > tp || (tq === tp && (q.visto || 0) > (p.visto || 0)) ? q : p;
    });
    return out;
  }

  function pontoLab(r) {
    return (r && r.feito ? 1e9 : 0) + (r && r.revisoes || 0) * 1e3 + (r && r.tent || 0);
  }
  function mesclarLab(a, b) {
    a = obj(a); b = obj(b);
    if (!a || !b) return a || b || undefined;
    var labs = {}, dias = {};
    var la = a.labs || {}, lb = b.labs || {};
    Object.keys(lb).concat(Object.keys(la)).forEach(function (k) {
      var p = la[k], q = lb[k];
      if (!p || !q) { labs[k] = p || q; return; }
      var sp = pontoLab(p), sq = pontoLab(q);
      labs[k] = sq > sp || (sq === sp && (q.prox || 0) > (p.prox || 0)) ? q : p;
    });
    var da = a.dias || {}, db = b.dias || {};
    Object.keys(db).concat(Object.keys(da)).forEach(function (d) {
      dias[d] = Math.max(da[d] || 0, db[d] || 0);
    });
    var estado = {}, ea = a.estado || {}, eb = b.estado || {};
    Object.keys(eb).forEach(function (k) { estado[k] = eb[k]; });
    Object.keys(ea).forEach(function (k) { estado[k] = ea[k]; });   // o que está aberto aqui vence
    return { xp: Math.max(a.xp || 0, b.xp || 0), dias: dias, labs: labs, estado: estado, livre: !!a.livre };
  }

  function mesclarDisc(a, b) {
    a = obj(a); b = obj(b);
    if (!a || !b) return a || b || undefined;
    var out = {};
    Object.keys(b).concat(Object.keys(a)).forEach(function (k) {
      var p = a[k], q = b[k];
      out[k] = !p ? q : !q ? p : (q.ts || 0) > (p.ts || 0) ? q : p;
    });
    return out;
  }

  function mesclar(local, remoto) {
    local = local || {}; remoto = remoto || {};
    var m = {
      "estudo-ads": mesclarQuiz(local["estudo-ads"], remoto["estudo-ads"]),
      "estudo-ads-labprog": mesclarLab(local["estudo-ads-labprog"], remoto["estudo-ads-labprog"]),
      "estudo-ads-disc:": mesclarDisc(local["estudo-ads-disc:"], remoto["estudo-ads-disc:"])
    };
    Object.keys(m).forEach(function (k) { if (m[k] === undefined) delete m[k]; });
    return m;
  }

  // JSON com chaves ordenadas, para comparar sem falso "mudou"
  function canonico(v) {
    if (Array.isArray(v)) return "[" + v.map(canonico).join(",") + "]";
    if (v && typeof v === "object") {
      return "{" + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; })
        .map(function (k) { return JSON.stringify(k) + ":" + canonico(v[k]); }).join(",") + "}";
    }
    return JSON.stringify(v === undefined ? null : v);
  }

  window.CONTA = { mesclar: mesclar, canonico: canonico };
  if (!CFG || !CFG.url || !CFG.chave) return;           // login desligado neste build

  // ============================================================ utilidades
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  function aviso(html, tipo) { if (window.LAB && LAB.toast) LAB.toast(html, tipo); }

  function idDispositivo() {
    var s = ls(), id = s && s.getItem(CHAVE_DISP);
    if (id && id.length >= 16) return id;
    if (window.crypto && crypto.randomUUID) id = crypto.randomUUID();
    else {
      var b = new Uint8Array(16);
      crypto.getRandomValues(b);
      id = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join("");
    }
    if (s) s.setItem(CHAVE_DISP, id);
    return id;
  }
  function nomeDispositivo() {
    var ua = navigator.userAgent;
    var so = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Windows/.test(ua) ? "Windows"
           : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Outro sistema";
    var nav = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
            : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "navegador";
    return so + " · " + nav;
  }
  function haQuanto(ts) {
    var min = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
    if (min < 1) return "agora";
    if (min < 60) return "há " + min + " min";
    var h = Math.round(min / 60);
    if (h < 48) return "há " + h + " h";
    return "há " + Math.round(h / 24) + " dias";
  }

  function lerLocal() {
    var s = ls(), out = {};
    if (!s) return out;
    CHAVES.forEach(function (k) {
      try { var v = s.getItem(k); if (v != null) out[k] = JSON.parse(v); } catch (e) { /* ignora valor corrompido */ }
    });
    return out;
  }
  var escrevendo = false;
  function escreverLocal(m) {
    var s = ls();
    if (!s) return;
    escrevendo = true;
    try { Object.keys(m).forEach(function (k) { s.setItem(k, JSON.stringify(m[k])); }); }
    finally { escrevendo = false; }
  }
  function recarregarApp() {
    if (window.LAB && LAB.prog && LAB.prog.recarregar) LAB.prog.recarregar();
    if (window.EstudoApp && EstudoApp.recarregar) EstudoApp.recarregar();
  }

  // qualquer gravação de progresso agenda uma sincronização
  try {
    var setOrig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      setOrig.call(this, k, v);
      if (!escrevendo && CHAVES.indexOf(k) >= 0 && this === ls()) agendar();
    };
  } catch (e) { /* sem localStorage: nada a sincronizar */ }

  // ============================================================ estado
  var cliente = null, sessao = null;
  var estado = "carregando";   // carregando | visitante | conectando | ok | sincronizando | limite | offline
  var ultimaSync = null, timer = null, emSync = false, denovo = false, registrado = false;
  var botao = null, painelAberto = null;

  function erroDe(r) { return r && r.error ? String(r.error.message || r.error) : ""; }

  function conectar() {
    estado = "conectando";
    pintaBotao();
    return cliente.rpc("registrar_dispositivo", { p_device: idDispositivo(), p_nome: nomeDispositivo() }).then(function (r) {
      if (r.error) throw r.error;
      if (r.data === "limite") {
        estado = "limite";
        pintaBotao();
        abrirPainel();
        return;
      }
      if (r.data === "novo") aviso("Esta máquina foi conectada à sua conta.", "bom");
      registrado = true;
      estado = "ok";
      return sincronizar();
    }).catch(function (e) {
      estado = "offline";
      pintaBotao();
      console.warn("conta:", e);
    });
  }

  function sincronizar() {
    if (!cliente || !sessao || (estado !== "ok" && estado !== "offline" && estado !== "sincronizando")) return Promise.resolve();
    if (!registrado) return conectar();
    if (emSync) { denovo = true; return Promise.resolve(); }
    emSync = true;
    clearTimeout(timer);
    timer = null;
    estado = "sincronizando";
    pintaBotao();
    var dev = idDispositivo();
    return cliente.rpc("carregar_progresso", { p_device: dev }).then(function (r) {
      if (r.error) throw r.error;
      var remoto = obj(r.data) || {};
      var local = lerLocal();
      var m = mesclar(local, remoto);
      if (canonico(m) !== canonico(local)) { escreverLocal(m); recarregarApp(); }
      if (canonico(m) !== canonico(remoto)) {
        return cliente.rpc("salvar_progresso", { p_device: dev, p_dados: m }).then(function (s) { if (s.error) throw s.error; });
      }
    }).then(function () {
      ultimaSync = Date.now();
      estado = "ok";
    }).catch(function (e) {
      var msg = String(e && e.message || e);
      if (/dispositivo não autorizado/.test(msg)) {
        aviso("Esta máquina foi desconectada da sua conta (em outro dispositivo). Seu progresso continua salvo aqui.");
        return sair(false);
      }
      estado = "offline";
      console.warn("conta:", e);
    }).then(function () {
      emSync = false;
      pintaBotao();
      if (painelAberto) painelAberto.atualizar();
      if (denovo) { denovo = false; agendar(300); }
    });
  }

  function agendar(ms) {
    if (!sessao || estado === "limite" || estado === "visitante" || estado === "carregando" || estado === "conectando") return;
    clearTimeout(timer);
    // máquina ainda não cadastrada (a primeira tentativa caiu sem rede): cadastra antes
    timer = setTimeout(registrado ? sincronizar : conectar, ms == null ? 1500 : ms);
  }

  function sair(liberarMaquina) {
    var passo = liberarMaquina && cliente
      ? cliente.rpc("listar_dispositivos").then(function (r) {
          var eu = (r.data || []).filter(function (d) { return d.device_id === idDispositivo(); })[0];
          return eu ? cliente.rpc("remover_dispositivo", { p_id: eu.id }) : null;
        })
      : Promise.resolve();
    return passo.then(function () {
      if (liberarMaquina) {
        var s = ls();
        if (s) {
          escrevendo = true;
          CHAVES.forEach(function (k) { s.removeItem(k); });
          Object.keys(s).forEach(function (k) { if (k.indexOf("estudo-ads-sim:") === 0) s.removeItem(k); });
          escrevendo = false;
        }
        recarregarApp();
      }
      return cliente.auth.signOut({ scope: "local" });
    }).catch(function () { /* sai mesmo sem rede */ }).then(function () {
      sessao = null;
      registrado = false;
      estado = "visitante";
      fecharPainel();
      pintaBotao();
    });
  }

  // ============================================================ botão do topo
  function pintaBotao() {
    if (!botao) return;
    botao.hidden = estado === "carregando";
    botao.className = "conta-btn st-" + estado;
    var rotulo = {
      visitante: "Entrar",
      conectando: "Conectando…",
      sincronizando: "Sincronizando…",
      ok: "Admin",
      limite: "Limite de máquinas",
      offline: "Admin · offline"
    }[estado] || "Entrar";
    botao.innerHTML = "";
    botao.appendChild(el("span", "conta-ponto"));
    botao.appendChild(el("span", "conta-rotulo", rotulo));
    botao.title = estado === "visitante"
      ? "Entrar como administrador (visitantes não precisam: o progresso fica salvo neste navegador)"
      : estado === "ok" ? "Histórico sincronizado" + (ultimaSync ? " " + haQuanto(ultimaSync) : "") : rotulo;
    botao.setAttribute("aria-label", estado === "visitante" ? "Entrar" : "Conta: " + rotulo);
  }

  // ============================================================ modal genérico
  function modal(titulo, montar) {
    var fundo = el("div", "conta-fundo");
    var caixa = el("div", "conta-modal");
    caixa.setAttribute("role", "dialog");
    caixa.setAttribute("aria-modal", "true");
    caixa.setAttribute("aria-label", titulo);
    var topo = el("div", "conta-modal-topo");
    topo.appendChild(el("h2", null, titulo));
    var x = el("button", "conta-x", "×");
    x.setAttribute("aria-label", "Fechar");
    topo.appendChild(x);
    caixa.appendChild(topo);
    var corpo = el("div", "conta-corpo");
    caixa.appendChild(corpo);
    fundo.appendChild(caixa);
    document.body.appendChild(fundo);
    var antes = document.activeElement;
    function fechar() {
      if (fundo.parentNode) fundo.parentNode.removeChild(fundo);
      if (antes && antes.focus) antes.focus();
      if (api.aoFechar) api.aoFechar();
    }
    x.onclick = fechar;
    fundo.addEventListener("mousedown", function (e) { if (e.target === fundo) fechar(); });
    caixa.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); fechar(); }
    });
    var api = { corpo: corpo, fechar: fechar, aoFechar: null };
    montar(api);
    setTimeout(function () {
      var f = caixa.querySelector("input, button:not(.conta-x)");
      if (f) f.focus();
    }, 30);
    return api;
  }

  // ============================================================ login
  function traduzErroLogin(msg) {
    if (/Invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
    if (/Email not confirmed/i.test(msg)) return "Este e-mail ainda não foi confirmado no Supabase (marque \"Auto Confirm\" ao criar o usuário).";
    if (/rate limit|too many/i.test(msg)) return "Muitas tentativas seguidas. Espere um pouco e tente de novo.";
    if (/fetch|network/i.test(msg)) return "Sem conexão com o servidor. Confira a internet.";
    return msg;
  }
  function abrirLogin() {
    modal("Entrar", function (m) {
      m.corpo.appendChild(el("p", "conta-sub",
        "Área do administrador: entrando, seu histórico acompanha você em até " + LIMITE + " máquinas. " +
        "Visitantes não precisam de conta — o progresso fica salvo no próprio navegador."));
      var form = el("form", "conta-form");
      var lE = el("label", null, "E-mail");
      var iE = el("input");
      iE.type = "email"; iE.autocomplete = "username"; iE.required = true;
      lE.appendChild(iE);
      var lS = el("label", null, "Senha");
      var iS = el("input");
      iS.type = "password"; iS.autocomplete = "current-password"; iS.required = true;
      lS.appendChild(iS);
      var erro = el("p", "conta-erro");
      erro.setAttribute("role", "alert");
      var linha = el("div", "row");
      var bOk = el("button", "btn pri", "Entrar");
      bOk.type = "submit";
      var bCancel = el("button", "btn", "Continuar como visitante");
      bCancel.type = "button";
      bCancel.onclick = m.fechar;
      linha.appendChild(bOk);
      linha.appendChild(bCancel);
      [lE, lS, erro, linha].forEach(function (x) { form.appendChild(x); });
      form.onsubmit = function (e) {
        e.preventDefault();
        erro.textContent = "";
        bOk.disabled = true;
        bOk.textContent = "Entrando…";
        cliente.auth.signInWithPassword({ email: iE.value.trim(), password: iS.value }).then(function (r) {
          if (r.error) throw r.error;
          sessao = r.data.session;
          iS.value = "";
          m.fechar();
          return conectar();
        }).catch(function (err) {
          erro.textContent = traduzErroLogin(String(err && err.message || err));
          bOk.disabled = false;
          bOk.textContent = "Entrar";
        });
      };
      m.corpo.appendChild(form);
    });
  }

  // ============================================================ painel da conta
  function fecharPainel() { if (painelAberto) painelAberto.fechar(); }
  function abrirPainel() {
    if (painelAberto) { painelAberto.atualizar(); return; }
    painelAberto = modal("Sua conta", function (m) {
      var topo = el("div", "conta-quem");
      var status = el("div", "conta-status");
      var titDisp = el("h3", "conta-h3");
      var lista = el("ul", "conta-disp");
      var alerta = el("div", "conta-alerta");
      var acoes = el("div", "conta-acoes");
      [topo, alerta, status, titDisp, lista, acoes].forEach(function (x) { m.corpo.appendChild(x); });

      var bSync = el("button", "btn sm", "Sincronizar agora");
      bSync.onclick = function () { sincronizar(); };
      var bSair = el("button", "btn sm", "Sair");
      bSair.title = "Sai da conta; o progresso continua salvo neste navegador e a vaga da máquina fica reservada.";
      bSair.onclick = function () { sair(false); };
      var bLiberar = el("button", "btn sm perigo", "Sair e desconectar esta máquina");
      bLiberar.title = "Use em computador que não é seu: apaga o histórico deste navegador e libera a vaga.";
      bLiberar.onclick = function () {
        if (confirm("Sair, apagar o histórico deste navegador e liberar a vaga desta máquina? O histórico continua salvo na nuvem.")) sair(true);
      };
      [bSync, bSair, bLiberar].forEach(function (b) { acoes.appendChild(b); });

      m.atualizar = function () {
        topo.innerHTML = "";
        topo.appendChild(el("b", null, sessao && sessao.user ? sessao.user.email : ""));
        topo.appendChild(el("span", "conta-tag", "admin"));
        alerta.hidden = estado !== "limite";
        alerta.textContent = "Esta conta já está conectada em " + LIMITE + " máquinas. Para usar esta, desconecte uma das máquinas abaixo.";
        status.textContent = estado === "ok" ? "✓ Histórico sincronizado " + (ultimaSync ? haQuanto(ultimaSync) : "")
          : estado === "sincronizando" ? "Sincronizando…"
          : estado === "offline" ? "Sem conexão agora — o progresso fica guardado aqui e sobe quando a conexão voltar."
          : estado === "limite" ? "Esta máquina ainda não está conectada." : "";
        bSync.hidden = estado === "limite";
        bLiberar.hidden = estado === "limite";
        cliente.rpc("listar_dispositivos").then(function (r) {
          var ds = r.data || [];
          titDisp.textContent = "Máquinas conectadas (" + ds.length + " de " + LIMITE + ")";
          lista.innerHTML = "";
          ds.forEach(function (d) {
            var li = el("li");
            var tx = el("div", "conta-disp-tx");
            tx.appendChild(el("b", null, d.nome));
            if (d.device_id === idDispositivo()) tx.appendChild(el("span", "conta-tag eu", "esta máquina"));
            tx.appendChild(el("small", null, "usada " + haQuanto(d.visto_em) + " · conectada em " + new Date(d.criado_em).toLocaleDateString("pt-BR")));
            li.appendChild(tx);
            if (d.device_id !== idDispositivo()) {
              var b = el("button", "btn sm", "Desconectar");
              b.onclick = function () {
                if (!confirm("Desconectar \"" + d.nome + "\"? Ela deixa de sincronizar até você entrar de novo nela.")) return;
                b.disabled = true;
                cliente.rpc("remover_dispositivo", { p_id: d.id }).then(function () {
                  if (estado === "limite") conectar().then(function () { m.atualizar(); });
                  else m.atualizar();
                });
              };
              li.appendChild(b);
            }
            lista.appendChild(li);
          });
        });
      };
      m.aoFechar = function () { painelAberto = null; };
      m.atualizar();
    });
  }

  // ============================================================ início
  function iniciar() {
    var topo = document.querySelector(".topbar-in");
    if (!topo) return;
    botao = el("button", "conta-btn");
    botao.id = "btn-conta";
    botao.onclick = function () { if (!sessao) abrirLogin(); else abrirPainel(); };
    topo.appendChild(botao);
    pintaBotao();

    var carregar = window.LAB && LAB.carregarScript ? LAB.carregarScript(LIB) : Promise.reject(new Error("sem carregador"));
    carregar.then(function () {
      cliente = window.supabase.createClient(CFG.url, CFG.chave, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: "estudo-ads-auth" }
      });
      cliente.auth.onAuthStateChange(function (ev, s) {
        sessao = s;
        if (ev === "SIGNED_OUT") { estado = "visitante"; pintaBotao(); }
      });
      return cliente.auth.getSession();
    }).then(function (r) {
      sessao = r.data.session;
      if (sessao) return conectar();
      estado = "visitante";
      pintaBotao();
    }).catch(function (e) {
      // sem internet ou CDN fora: o site segue em modo visitante
      estado = "visitante";
      pintaBotao();
      console.warn("conta indisponível:", e);
    });

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && sessao && estado !== "limite") agendar(200);
    });
    window.addEventListener("online", function () { if (sessao) agendar(200); });
    window.addEventListener("pagehide", function () { if (timer) sincronizar(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
