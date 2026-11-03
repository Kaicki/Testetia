(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var LISTA_KEY = "tiaflix_lista";

  var estado = {
    view: "inicio", busca: "", genero: "", ano: "",
    itens: [], porKey: {}, atual: null, epAtual: 0, tempAtual: null
  };

  /* ---------- utilidades ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pick(o, chaves) {
    for (var i = 0; i < chaves.length; i++) {
      var v = o[chaves[i]];
      if (v != null && v !== "") return v;
    }
    return "";
  }
  function semAcento(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function trim(s) { return String(s).trim(); }
  function lerLista() {
    try { return JSON.parse(localStorage.getItem(LISTA_KEY) || "[]"); } catch (e) { return []; }
  }
  function salvarLista(l) {
    try { localStorage.setItem(LISTA_KEY, JSON.stringify(l)); } catch (e) {}
  }
  function naLista(it) { return lerLista().indexOf(it.key) > -1; }
  function alternarLista(it) {
    var l = lerLista(), i = l.indexOf(it.key);
    if (i > -1) l.splice(i, 1); else l.push(it.key);
    salvarLista(l);
  }

  /* ---------- catálogo ---------- */
  function extrairArray(dados) {
    if (Array.isArray(dados)) return dados;
    if (dados && typeof dados === "object") {
      for (var k in dados) if (Array.isArray(dados[k])) return dados[k];
    }
    return [];
  }
  function listaGeneros(v) {
    if (Array.isArray(v)) return v.map(trim).filter(Boolean);
    return String(v || "").split(/[,/|]/).map(trim).filter(Boolean);
  }
  function normalizarEp(e, temporada, n) {
    if (typeof e === "string") e = { link: e };
    return {
      titulo: pick(e, ["titulo", "title", "nome"]) || "Episódio " + n,
      link: pick(e, ["link", "url", "drive", "video", "driveId", "id"]),
      temporada: pick(e, ["temporada", "season"]) || temporada || 1,
      numero: pick(e, ["numero", "episodio", "n"]) || n
    };
  }
  function normalizar(raw, tipo, i) {
    var eps = [];
    var temps = pick(raw, ["temporadas", "seasons"]);
    var lista = pick(raw, ["episodios", "episodes"]);
    if (Array.isArray(temps)) {
      temps.forEach(function (t, ti) {
        var arr = Array.isArray(t) ? t : (t.episodios || t.episodes || []);
        arr.forEach(function (e, ei) { eps.push(normalizarEp(e, ti + 1, ei + 1)); });
      });
    } else if (Array.isArray(lista)) {
      lista.forEach(function (e, ei) { eps.push(normalizarEp(e, 1, ei + 1)); });
    }
    var id = pick(raw, ["id"]);
    return {
      key: tipo + ":" + (id !== "" ? id : i),
      tipo: tipo,
      titulo: pick(raw, ["titulo", "title", "nome"]) || "Sem título",
      ano: pick(raw, ["ano", "year"]),
      generos: listaGeneros(pick(raw, ["generos", "genero", "genres", "categoria"])),
      capa: pick(raw, ["capa", "poster", "imagem", "img", "thumb", "thumbnail"]),
      sinopse: pick(raw, ["sinopse", "descricao", "overview", "resumo"]),
      duracao: pick(raw, ["duracao", "duração", "runtime"]),
      nota: pick(raw, ["nota", "rating"]),
      link: pick(raw, ["link", "url", "drive", "video", "driveId"]) || (!eps.length && typeof id === "string" && id.length >= 20 ? id : ""),
      episodios: eps
    };
  }
  function carregar(arquivo, tipo) {
    return fetch(arquivo, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(arquivo); return r.json(); })
      .then(function (d) { return extrairArray(d).map(function (x, i) { return normalizar(x, tipo, i); }); })
      .catch(function () { return []; });
  }

  /* ---------- player de vídeo (Google Drive) ---------- */
  function embedUrl(link) {
    link = String(link || "").trim();
    if (!link) return "";
    var m = link.match(/\/d\/([\w-]+)/) || link.match(/[?&]id=([\w-]+)/);
    if (m) return "https://drive.google.com/file/d/" + m[1] + "/preview";
    if (/^https?:\/\//.test(link)) return link;
    return "https://drive.google.com/file/d/" + link + "/preview";
  }

  /* ---------- cartões ---------- */
  function card(it) {
    var on = naLista(it);
    var capa = it.capa
      ? '<img loading="lazy" src="' + esc(it.capa) + '" alt="">'
      : '<span class="sem-capa">' + esc(it.titulo) + "</span>";
    var meta = [it.ano].concat(it.generos.slice(0, 2)).filter(Boolean).join(" • ");
    return '<div class="card" data-key="' + esc(it.key) + '" tabindex="0" role="button" aria-label="Assistir ' + esc(it.titulo) + '">' +
      capa +
      '<button type="button" class="fav' + (on ? " on" : "") + '" data-fav="' + esc(it.key) + '" aria-pressed="' + on +
      '" aria-label="' + (on ? "Remover da" : "Adicionar à") + ' minha lista">' + (on ? "✓" : "+") + "</button>" +
      '<div class="card-hover"><b>' + esc(it.titulo) + "</b><small>" + esc(meta) + "</small></div></div>";
  }
  function fileira(titulo, itens) {
    if (!itens.length) return "";
    return '<section class="secao"><h2>' + esc(titulo) + '</h2><div class="fileira-wrap">' +
      '<button type="button" class="seta esq" data-seta="-1" aria-label="Voltar">‹</button>' +
      '<div class="fileira">' + itens.map(card).join("") + "</div>" +
      '<button type="button" class="seta dir" data-seta="1" aria-label="Avançar">›</button></div></section>';
  }
  function grade(itens) {
    if (!itens.length) return '<p class="vazio">Nada por aqui ainda.</p>';
    return '<div class="grade">' + itens.map(card).join("") + "</div>";
  }

  /* ---------- listagens ---------- */
  function filtrar(base) {
    var q = semAcento(estado.busca);
    return base.filter(function (it) {
      if (q && semAcento(it.titulo).indexOf(q) === -1) return false;
      if (estado.genero && it.generos.indexOf(estado.genero) === -1) return false;
      if (estado.ano && String(it.ano) !== estado.ano) return false;
      return true;
    });
  }
  function baseDaView() {
    if (estado.busca) return estado.itens;
    if (estado.view === "filmes") return estado.itens.filter(function (i) { return i.tipo === "filme"; });
    if (estado.view === "series") return estado.itens.filter(function (i) { return i.tipo === "serie"; });
    if (estado.view === "lista") {
      var l = lerLista();
      return estado.itens.filter(function (i) { return l.indexOf(i.key) > -1; });
    }
    return estado.itens;
  }
  function preencherFiltros(base) {
    var gs = {}, anos = {};
    base.forEach(function (it) {
      it.generos.forEach(function (g) { gs[g] = 1; });
      if (it.ano) anos[it.ano] = 1;
    });
    var fg = $("fGenero"), fa = $("fAno");
    fg.innerHTML = '<option value="">Todos os gêneros</option>' +
      Object.keys(gs).sort().map(function (g) { return '<option value="' + esc(g) + '">' + esc(g) + "</option>"; }).join("");
    fa.innerHTML = '<option value="">Todos os anos</option>' +
      Object.keys(anos).sort().reverse().map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + "</option>"; }).join("");
    fg.value = estado.genero; fa.value = estado.ano;
  }

  function renderHero() {
    var hero = $("hero");
    var cand = estado.itens.filter(function (i) { return i.capa; });
    if (!cand.length || estado.view !== "inicio" || estado.busca) { hero.innerHTML = ""; hero.style.backgroundImage = ""; return; }
    var it = estado.destaque && estado.itens.indexOf(estado.destaque) > -1 ? estado.destaque : (estado.destaque = cand[Math.floor(Math.random() * cand.length)]);
    hero.style.backgroundImage = "url('" + String(it.capa).replace(/['"\\()]/g, encodeURIComponent) + "')";
    var meta = [it.tipo === "serie" ? "Série" : "Filme", it.ano].concat(it.generos.slice(0, 3)).filter(Boolean).join(" • ");
    hero.innerHTML = '<div class="hero-texto"><p class="hero-meta">' + esc(meta) + "</p><h1>" + esc(it.titulo) + "</h1>" +
      (it.sinopse ? '<p class="hero-sinopse">' + esc(it.sinopse) + "</p>" : "") +
      '<div class="hero-botoes"><button type="button" class="btn" data-play="' + esc(it.key) + '"><span aria-hidden="true">▶</span> Assistir</button>' +
      '<button type="button" class="btn sec" data-fav="' + esc(it.key) + '">' + (naLista(it) ? "✓ Na minha lista" : "+ Minha lista") + "</button></div></div>";
  }

  function render() {
    document.querySelectorAll("#menu button").forEach(function (b) {
      b.classList.toggle("ativo", b.dataset.view === estado.view && !estado.busca);
    });
    renderHero();
    var c = $("conteudo"), main = document.querySelector("main");
    var inicio = estado.view === "inicio" && !estado.busca;
    main.classList.toggle("sem-hero", !(inicio && $("hero").innerHTML));
    $("filtros").hidden = inicio;

    if (inicio) {
      var filmes = estado.itens.filter(function (i) { return i.tipo === "filme"; });
      var series = estado.itens.filter(function (i) { return i.tipo === "serie"; });
      var l = lerLista();
      var minha = estado.itens.filter(function (i) { return l.indexOf(i.key) > -1; });
      var contagem = {};
      estado.itens.forEach(function (i) { i.generos.forEach(function (g) { contagem[g] = (contagem[g] || 0) + 1; }); });
      var topGeneros = Object.keys(contagem).sort(function (a, b) { return contagem[b] - contagem[a]; }).slice(0, 4);
      var html = fileira("Minha lista", minha) +
        fileira("Adicionados recentemente", estado.itens.slice(-20).reverse()) +
        fileira("Filmes", filmes.slice(0, 20)) + fileira("Séries", series.slice(0, 20));
      topGeneros.forEach(function (g) {
        html += fileira(g, estado.itens.filter(function (i) { return i.generos.indexOf(g) > -1; }).slice(0, 20));
      });
      c.innerHTML = html || '<p class="vazio">Nenhum título encontrado. Confira o catalogo.json.</p>';
      return;
    }

    $("tituloPagina").textContent = estado.busca
      ? "Resultados para \u201c" + estado.busca + "\u201d"
      : ({ filmes: "Filmes", series: "Séries", lista: "Minha lista" }[estado.view] || "");
    var base = baseDaView();
    preencherFiltros(base);
    var itens = filtrar(base);
    if (estado.view === "lista" && !estado.busca && !base.length) {
      c.innerHTML = '<p class="vazio">Sua lista está vazia. Toque no + de um título para salvar.</p>';
    } else {
      c.innerHTML = grade(itens);
    }
  }

  /* ---------- sugestões ---------- */
  function sugestoes(it) {
    var anoIt = parseInt(it.ano, 10);
    var pontuados = estado.itens.filter(function (o) { return o.key !== it.key; }).map(function (o) {
      var comuns = o.generos.filter(function (g) { return it.generos.indexOf(g) > -1; }).length;
      var proximidade = 0;
      var anoO = parseInt(o.ano, 10);
      if (anoIt && anoO) proximidade = 1 / (1 + Math.abs(anoIt - anoO));
      return { item: o, pts: comuns * 3 + (o.tipo === it.tipo ? 1 : 0) + proximidade };
    });
    pontuados.sort(function (a, b) { return b.pts - a.pts; });
    var rel = pontuados.filter(function (p) { return p.pts >= 3; });
    var lista = (rel.length >= 6 ? rel : pontuados).slice(0, 12).map(function (p) { return p.item; });
    return lista;
  }

  /* ---------- player ---------- */
  function linkAtual() {
    var it = estado.atual;
    if (it.episodios.length) {
      var ep = it.episodios[estado.epAtual];
      return ep ? ep.link : "";
    }
    return it.link;
  }
  function renderVideo() {
    var url = embedUrl(linkAtual());
    $("videoWrap").innerHTML = url
      ? '<iframe src="' + esc(url) + '" allow="autoplay; fullscreen" allowfullscreen title="' + esc(estado.atual.titulo) + '"></iframe>'
      : '<div class="video-aviso">Este título ainda não tem vídeo cadastrado.</div>';
  }
  function renderInfo() {
    var it = estado.atual;
    var meta = [];
    if (it.ano) meta.push(it.ano);
    if (it.duracao) meta.push(it.duracao);
    if (it.nota) meta.push("★ " + it.nota);
    meta.push(it.tipo === "serie" ? "Série" : "Filme");
    var on = naLista(it);
    $("playerInfo").innerHTML = "<h2>" + esc(it.titulo) + "</h2>" +
      '<div class="meta">' + meta.map(function (m) { return "<span>" + esc(m) + "</span>"; }).join("") + "</div>" +
      (it.sinopse ? '<p class="sinopse">' + esc(it.sinopse) + "</p>" : "") +
      (it.generos.length ? '<p class="generos"><span>Gêneros:</span> ' + esc(it.generos.join(", ")) + "</p>" : "") +
      '<button type="button" class="btn sec" data-fav="' + esc(it.key) + '">' + (on ? "✓ Na minha lista" : "+ Minha lista") + "</button>";
    $("playerTitulo").textContent = it.titulo;
  }
  function renderEpisodios() {
    var box = $("playerEpisodios"), it = estado.atual;
    if (!it.episodios.length) { box.hidden = true; box.innerHTML = ""; return; }
    var temps = [];
    it.episodios.forEach(function (e) { if (temps.indexOf(e.temporada) === -1) temps.push(e.temporada); });
    if (estado.tempAtual == null || temps.indexOf(estado.tempAtual) === -1) {
      estado.tempAtual = it.episodios[estado.epAtual] ? it.episodios[estado.epAtual].temporada : temps[0];
    }
    var html = "<h3>Episódios</h3>";
    if (temps.length > 1) {
      html += '<div class="temporadas">' + temps.map(function (t) {
        return '<button type="button" data-temp="' + esc(t) + '" class="' + (t === estado.tempAtual ? "ativo" : "") + '">Temporada ' + esc(t) + "</button>";
      }).join("") + "</div>";
    }
    html += '<div class="ep-lista">';
    it.episodios.forEach(function (e, i) {
      if (e.temporada !== estado.tempAtual) return;
      html += '<button type="button" class="ep' + (i === estado.epAtual ? " ativo" : "") + '" data-ep="' + i + '"><span class="n">' + esc(e.numero) + "</span><span>" + esc(e.titulo) + "</span></button>";
    });
    html += "</div>";
    box.innerHTML = html;
    box.hidden = false;
  }
  function renderSugestoes() {
    $("playerSugestoes").innerHTML = sugestoes(estado.atual).map(card).join("");
  }
  function abrirPlayer(it, aberto) {
    estado.atual = it; estado.epAtual = 0; estado.tempAtual = null;
    var p = $("player");
    var jaAberto = !p.hidden;
    renderVideo(); renderInfo(); renderEpisodios(); renderSugestoes();
    p.hidden = false;
    p.scrollTop = 0;
    document.body.style.overflow = "hidden";
    if (!jaAberto) history.pushState({ player: 1 }, "");
  }
  function fecharPlayer(viaHistorico) {
    var p = $("player");
    if (p.hidden) return;
    p.hidden = true;
    $("videoWrap").innerHTML = "";
    document.body.style.overflow = "";
    estado.atual = null;
    if (!viaHistorico && history.state && history.state.player) history.back();
    render();
  }

  /* ---------- eventos ---------- */
  function tratarClique(e) {
    var seta = e.target.closest("[data-seta]");
    if (seta) {
      var f = seta.parentNode.querySelector(".fileira");
      f.scrollBy({ left: parseInt(seta.dataset.seta, 10) * f.clientWidth * 0.85, behavior: "smooth" });
      return;
    }
    var fav = e.target.closest("[data-fav]");
    if (fav) {
      e.stopPropagation();
      var it = estado.porKey[fav.dataset.fav];
      if (it) {
        alternarLista(it);
        if (estado.atual) renderInfo();
        if (estado.atual) renderSugestoes();
        render();
      }
      return;
    }
    var play = e.target.closest("[data-play]");
    var cartao = e.target.closest(".card");
    var key = play ? play.dataset.play : cartao ? cartao.dataset.key : null;
    if (key && estado.porKey[key]) abrirPlayer(estado.porKey[key]);
  }
  ["hero", "conteudo", "playerSugestoes"].forEach(function (id) {
    $(id).addEventListener("click", tratarClique);
    $(id).addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")) {
        e.preventDefault();
        tratarClique(e);
      }
    });
  });
  $("playerInfo").addEventListener("click", tratarClique);

  $("playerEpisodios").addEventListener("click", function (e) {
    var t = e.target.closest("[data-temp]");
    if (t) {
      var n = estado.atual.episodios.filter(function (x) { return String(x.temporada) === t.dataset.temp; })[0];
      estado.tempAtual = n ? n.temporada : estado.tempAtual;
      renderEpisodios();
      return;
    }
    var b = e.target.closest("[data-ep]");
    if (b) {
      estado.epAtual = parseInt(b.dataset.ep, 10);
      renderVideo(); renderEpisodios();
      $("player").scrollTop = 0;
    }
  });

  $("voltar").addEventListener("click", function () { fecharPlayer(false); });
  $("telaCheia").addEventListener("click", function () {
    var w = $("videoWrap");
    if (document.fullscreenElement) { document.exitFullscreen(); }
    else if (w.requestFullscreen) { w.requestFullscreen(); }
    else if (w.webkitRequestFullscreen) { w.webkitRequestFullscreen(); }
  });
  window.addEventListener("popstate", function () { fecharPlayer(true); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !$("player").hidden && !document.fullscreenElement && $("authModal").hidden) fecharPlayer(false);
  });

  document.querySelectorAll("#menu button").forEach(function (b) {
    b.addEventListener("click", function () {
      estado.view = b.dataset.view; estado.busca = ""; estado.genero = ""; estado.ano = "";
      $("busca").value = "";
      render();
      window.scrollTo(0, 0);
    });
  });
  $("logo").addEventListener("click", function (e) {
    e.preventDefault();
    estado.view = "inicio"; estado.busca = ""; estado.genero = ""; estado.ano = ""; estado.destaque = null;
    $("busca").value = "";
    render();
    window.scrollTo(0, 0);
  });
  var buscaBox = $("buscaBox");
  $("btnBusca").addEventListener("click", function () {
    buscaBox.classList.add("aberta");
    $("busca").focus();
  });
  $("busca").addEventListener("blur", function () {
    if (!$("busca").value.trim()) buscaBox.classList.remove("aberta");
  });
  function marcarTopo() { $("topo").classList.toggle("rolou", window.scrollY > 10); }
  window.addEventListener("scroll", marcarTopo, { passive: true });
  marcarTopo();
  var timerBusca;
  $("busca").addEventListener("input", function (e) {
    clearTimeout(timerBusca);
    var v = e.target.value.trim();
    timerBusca = setTimeout(function () {
      estado.busca = v; estado.genero = ""; estado.ano = "";
      render();
    }, 200);
  });
  $("fGenero").addEventListener("change", function (e) { estado.genero = e.target.value; render(); });
  $("fAno").addEventListener("change", function (e) { estado.ano = e.target.value; render(); });
  $("limpar").addEventListener("click", function () { estado.genero = ""; estado.ano = ""; render(); });

  /* ---------- início ---------- */
  $("conteudo").innerHTML = '<section class="secao"><h2 class="esq">&nbsp;</h2><div class="fileira-wrap"><div class="fileira">' +
    new Array(9).join('<div class="card esq"></div>') + "</div></div></section>";
  Promise.all([carregar("catalogo.json", "filme"), carregar("catalogoseries.json", "serie")]).then(function (r) {
    estado.itens = r[0].concat(r[1]);
    estado.itens.forEach(function (it) { estado.porKey[it.key] = it; });
    render();
  });
})();
