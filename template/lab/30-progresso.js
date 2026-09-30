/* Laboratório — progresso: XP, nível, sequência de dias, trilha e revisão
   espaçada. Tudo fica no localStorage deste navegador. */
(function (L) {
  "use strict";

  var CHAVE = "estudo-ads-labprog";
  var MIN = 60 * 1000, DIA = 24 * 60 * MIN;
  // intervalos da revisão espaçada: cada acerto sobe uma "caixa" (Leitner)
  var INTERVALOS = [1 * DIA, 3 * DIA, 7 * DIA, 16 * DIA, 35 * DIA, 90 * DIA];
  var REVISAO_ERRO = 10 * MIN;
  var BASE_XP = { explorar: 10, prever: 15, parsons: 15, passo: 15, desafio: 25 };
  var MULT = [1, 1, 1.5, 2];
  var REVISAVEIS = { prever: 1, desafio: 1, parsons: 1 };
  var TITULOS = ["Curioso", "Aprendiz", "Experimentador", "Investigador", "Estagiário",
                 "Júnior", "Pleno", "Sênior", "Especialista", "Arquiteto", "Cientista da Computação"];

  var D = L.lerLS(CHAVE, null) || {};
  D.xp = D.xp || 0;
  D.dias = D.dias || {};
  D.labs = D.labs || {};
  D.estado = D.estado || {};
  D.livre = !!D.livre;

  function salvar() { L.gravarLS(CHAVE, D); }
  function chave(m, lab) { return m.id + "/" + lab.id; }
  function reg(m, lab) { return D.labs[chave(m, lab)] || null; }
  function marcaDia() { var h = L.hoje(); D.dias[h] = (D.dias[h] || 0) + 1; }

  function nivelDe(xp) {
    var n = 1, custo = 100, acum = 0;
    while (xp >= acum + custo) { acum += custo; n++; custo += 50; }
    return { n: n, titulo: TITULOS[Math.min(n - 1, TITULOS.length - 1)], atual: xp - acum, prox: custo };
  }

  function xpBase(lab) { return Math.round(BASE_XP[lab.tipo] * MULT[lab.nivel || 1]); }

  L.prog = {
    dados: D,
    salvar: salvar,
    // relê do localStorage (histórico vindo de outra máquina). Muda D no lugar e
    // reaproveita os objetos de estado já abertos, para um exercício na tela
    // continuar gravando no mesmo objeto.
    recarregar: function () {
      var n = L.lerLS(CHAVE, null) || {};
      D.xp = n.xp || 0;
      D.dias = n.dias || {};
      D.labs = n.labs || {};
      D.livre = !!n.livre;
      var est = n.estado || {};
      Object.keys(est).forEach(function (k) {
        if (D.estado[k]) Object.assign(D.estado[k], est[k]);
        else D.estado[k] = est[k];
      });
    },
    xpBase: xpBase,
    revisavel: function (lab) { return !!REVISAVEIS[lab.tipo]; },
    reg: reg,
    feito: function (m, lab) { var r = reg(m, lab); return !!(r && r.feito); },
    nivel: function () { return nivelDe(D.xp); },
    sequencia: function () {
      var d = new Date(), n = 0;
      if (!D.dias[L.hoje(d)]) d.setDate(d.getDate() - 1);
      while (D.dias[L.hoje(d)]) { n++; d.setDate(d.getDate() - 1); }
      return n;
    },
    hojeFeitos: function () { return D.dias[L.hoje()] || 0; },
    livre: function (v) { if (v != null) { D.livre = !!v; salvar(); } return D.livre; },

    // estado da interface de cada exercício (código digitado, previsão, blocos...)
    estado: function (m, lab) {
      var k = chave(m, lab);
      return D.estado[k] || (D.estado[k] = {});
    },
    limparEstado: function (m, lab) { delete D.estado[chave(m, lab)]; salvar(); },

    // q = { acertou, dicas, solucao, tentativas }
    concluir: function (m, lab, q) {
      q = q || {};
      var k = chave(m, lab);
      var r = D.labs[k] || (D.labs[k] = { tent: 0 });
      r.tent = (r.tent || 0) + 1;
      if (r.feito) { salvar(); return { xp: 0, repetido: true }; }
      var antes = nivelDe(D.xp).n;
      var base = xpBase(lab), bonus = 0, motivos = [];
      if (lab.tipo === "prever" && q.acertou) { bonus += 10; motivos.push("previsão certa"); }
      if (lab.tipo === "desafio" && !q.dicas && !q.solucao) { bonus += 10; motivos.push("sem dicas"); }
      if (lab.tipo === "parsons" && q.tentativas === 1) { bonus += 10; motivos.push("de primeira"); }
      if (lab.tipo === "passo" && q.acertou) { bonus += 5; motivos.push("resposta certa"); }
      var total = base + bonus;
      if (q.solucao) { total = Math.round(total / 2); motivos.push("viu a solução: metade do XP"); }
      r.feito = Date.now();
      r.xp = total;
      r.caixa = 0;
      if (REVISAVEIS[lab.tipo]) {
        // errou a previsão: volta daqui a pouco; acertou: amanhã
        r.prox = Date.now() + (lab.tipo === "prever" && !q.acertou ? REVISAO_ERRO : INTERVALOS[0]);
      }
      D.xp += total;
      marcaDia();
      salvar();
      var depois = nivelDe(D.xp);
      return { xp: total, motivos: motivos, subiu: depois.n > antes, nivel: depois };
    },

    revisar: function (m, lab, acertou) {
      var r = reg(m, lab);
      if (!r) return { xp: 0 };
      var antes = nivelDe(D.xp).n;
      r.revisoes = (r.revisoes || 0) + 1;
      if (acertou) {
        r.caixa = Math.min((r.caixa || 0) + 1, INTERVALOS.length - 1);
        r.prox = Date.now() + INTERVALOS[r.caixa];
      } else {
        r.caixa = 0;
        r.prox = Date.now() + REVISAO_ERRO;
      }
      var ganho = acertou ? 5 * (lab.nivel || 1) : 1;
      D.xp += ganho;
      marcaDia();
      salvar();
      var depois = nivelDe(D.xp);
      return { xp: ganho, subiu: depois.n > antes, nivel: depois, proxima: r.prox };
    },

    pendentes: function (m) {
      var agora = Date.now();
      return (m.labs || []).filter(function (lab) {
        var r = reg(m, lab);
        return r && r.feito && REVISAVEIS[lab.tipo] && r.prox && r.prox <= agora;
      }).sort(function (a, b) { return reg(m, a).prox - reg(m, b).prox; });
    },
    proximaRevisao: function (m) {
      var menor = null;
      (m.labs || []).forEach(function (lab) {
        var r = reg(m, lab);
        if (r && r.prox && REVISAVEIS[lab.tipo] && (menor == null || r.prox < menor)) menor = r.prox;
      });
      return menor;
    },

    // trilha: dentro de cada tema, o exercício seguinte só abre quando o
    // anterior foi feito (a menos que o modo livre esteja ligado)
    temas: function (m) {
      var ordem = [], por = {};
      (m.labs || []).forEach(function (lab) {
        if (!por[lab.tema]) { por[lab.tema] = []; ordem.push(lab.tema); }
        por[lab.tema].push(lab);
      });
      var refs = [];
      (m.resumos || []).concat(m.questoes || []).forEach(function (x) { if (x.tema && refs.indexOf(x.tema) < 0) refs.push(x.tema); });
      ordem.sort(function (a, b) {
        var ia = refs.indexOf(a), ib = refs.indexOf(b);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      });
      return ordem.map(function (t) {
        var labs = por[t].map(function (l, i) { return [l, i]; })
          .sort(function (a, b) { return (a[0].nivel - b[0].nivel) || (a[1] - b[1]); })
          .map(function (x) { return x[0]; });
        return { tema: t, labs: labs };
      });
    },
    ordenados: function (m) {
      var r = [];
      L.prog.temas(m).forEach(function (g) { r = r.concat(g.labs); });
      return r;
    },
    desbloqueado: function (m, lab) {
      if (D.livre) return true;
      var g = L.prog.temas(m).filter(function (x) { return x.tema === lab.tema; })[0];
      if (!g) return true;
      var i = g.labs.indexOf(lab);
      return i <= 0 || L.prog.feito(m, g.labs[i - 1]);
    },
    proximo: function (m, depoisDe) {
      var lista = L.prog.ordenados(m);
      var ini = depoisDe ? lista.indexOf(depoisDe) + 1 : 0;
      for (var i = 0; i < lista.length; i++) {
        var lab = lista[(ini + i) % lista.length];
        if (!L.prog.feito(m, lab) && L.prog.desbloqueado(m, lab)) return lab;
      }
      return null;
    },
    contagem: function (m) {
      var labs = m.labs || [], feitos = 0;
      labs.forEach(function (l) { if (L.prog.feito(m, l)) feitos++; });
      return { total: labs.length, feitos: feitos };
    },
    zerar: function (m) {
      Object.keys(D.labs).forEach(function (k) { if (k.indexOf(m.id + "/") === 0) { D.xp -= D.labs[k].xp || 0; delete D.labs[k]; } });
      Object.keys(D.estado).forEach(function (k) { if (k.indexOf(m.id + "/") === 0) delete D.estado[k]; });
      if (D.xp < 0) D.xp = 0;
      salvar();
    }
  };

  L.quando = function (ts) {
    var d = ts - Date.now();
    if (d <= 0) return "agora";
    var min = Math.round(d / MIN);
    if (min < 60) return "em " + min + " min";
    var h = Math.round(min / 60);
    if (h < 36) return "em " + h + " h";
    return "em " + Math.round(h / 24) + " dias";
  };
})(window.LAB = window.LAB || {});
