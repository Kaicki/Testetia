
(function () {
  "use strict";

  var $ = function (id) {
    return document.getElementById(id);
  };

  var PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>';

  var state = {
    filmes: [],
    series: [],
    todos: [],
    view: "inicio"
  };

  /* ---------- CATÁLOGO ---------- */

  function lista(d) {
    if (Array.isArray(d)) return d;

    if (d && typeof d === "object") {
      for (var k in d) {
        if (Array.isArray(d[k])) return d[k];
      }
    }

    return [];
  }

  function pick(o, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (o[keys[i]] != null && o[keys[i]] !== "") {
        return o[keys[i]];
      }
    }

    return "";
  }

  function driveId(v) {
    v = String(v || "");
    var m = v.match(/[-\w]{25,}/);
    return m ? m[0] : v;
  }

  function norm(o, tipo, i) {
    var t = {
      tipo: tipo,
      id: tipo + "-" + (o.id != null ? o.id : i),
      titulo: pick(o, ["titulo", "title", "nome", "name"]),
      poster: pick(o, ["poster", "capa", "imagem", "img"]),
      backdrop: pick(o, ["backdrop", "banner", "fundo"]),
      ano: pick(o, ["ano", "year"]),
      sinopse: pick(o, [
        "sinopse",
        "descricao",
        "descrição",
        "overview",
        "resumo"
      ]),
      elenco: pick(o, ["elenco", "cast", "atores"]),
      generos: [].concat(
        pick(o, [
          "generos",
          "gêneros",
          "genero",
          "gênero",
          "genre",
          "genres"
        ]) || []
      )
    };

    if (
      typeof t.generos[0] === "string" &&
      t.generos.length === 1
    ) {
      t.generos = t.generos[0]
        .split(/[,;/]/)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
    }

    t.backdrop = t.backdrop || t.poster;
    t.poster = t.poster || t.backdrop;

    if (tipo === "filme") {
      t.drive = driveId(
        pick(o, [
          "driveId",
          "drive_id",
          "drive",
          "video",
          "link",
          "url"
        ])
      );
    } else {
      var temps = o.temporadas || o.seasons || [];

      if (!Array.isArray(temps)) {
        temps = Object.keys(temps).map(function (k) {
          var x = temps[k];
          return Array.isArray(x) ? { episodios: x } : x;
        });
      }

      t.temporadas = temps.map(function (s, n) {
        var eps = s.episodios || s.episodes || s.eps || [];

        return {
          nome: pick(s, ["nome", "titulo", "name"]) ||
            "Temporada " + (s.numero || s.number || n + 1),

          eps: eps.map(function (e, j) {
            return {
              titulo: pick(e, ["titulo", "title", "nome"]) ||
                "Episódio " + (j + 1),

              drive: driveId(
                pick(e, [
                  "driveId",
                  "drive_id",
                  "drive",
                  "video",
                  "link",
                  "url"
                ])
              )
            };
          })
        };
      });
    }

    return t;
  }

  function carregar() {
    return Promise.all([
      fetch("catalogo.json")
        .then(function (r) {
          if (!r.ok) throw new Error("Erro ao carregar filmes");
          return r.json();
        })
        .catch(function () {
          return [];
        }),

      fetch("catalogoseries.json")
        .then(function (r) {
          if (!r.ok) throw new Error("Erro ao carregar séries");
          return r.json();
        })
        .catch(function () {
          return [];
        })
    ]).then(function (r) {
      state.filmes = lista(r[0]).map(function (o, i) {
        return norm(o, "filme", i);
      });

      state.series = lista(r[1]).map(function (o, i) {
        return norm(o, "serie", i);
      });

      state.todos = state.filmes.concat(state.series);
    });
  }

  /* ---------- MINHA LISTA ---------- */

  function favs() {
    try {
      return JSON.parse(
        localStorage.getItem("tiaflix_lista") || "[]"
      );
    } catch (e) {
      return [];
    }
  }

  function salvaFavs(a) {
    try {
      localStorage.setItem("tiaflix_lista", JSON.stringify(a));
    } catch (e) {}
  }

  function naLista(t) {
    return favs().indexOf(t.id) > -1;
  }

  function alternaLista(t) {
    var a = favs();
    var i = a.indexOf(t.id);

    if (i > -1) {
      a.splice(i, 1);
    } else {
      a.push(t.id);
    }

    salvaFavs(a);
  }

  /* ---------- COMPONENTES ---------- */

  function cartaz(t) {
    var d = document.createElement("button");

    d.type = "button";
    d.className = "cartaz" + (t.poster ? " tem" : "");

    if (t.poster) {
      d.style.backgroundImage =
        "url('" + t.poster.replace(/'/g, "%27") + "')";
    }

    d.innerHTML = "<span>" + esc(t.titulo) + "</span>";
    d.setAttribute("aria-label", t.titulo || "Abrir título");

    d.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      fecharBusca();
      fechaDetalhe();

      abrirDetalhe(t);
    });

    return d;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(
      /[&<>"]/g,
      function (c) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;"
        }[c];
      }
    );
  }

  function fileira(titulo, itens) {
    if (!itens.length) return null;

    var s = document.createElement("section");
    s.className = "fileira";
    s.innerHTML = "<h2>" + esc(titulo) + "</h2>";

    var tr = document.createElement("div");
    tr.className = "trilho";

    itens.forEach(function (t) {
      tr.appendChild(cartaz(t));
    });

    s.appendChild(tr);

    return s;
  }

  function embaralha(a) {
    return a.slice().sort(function () {
      return Math.random() - 0.5;
    });
  }

  /* ---------- TELAS ---------- */

  function render() {
    var c = $("conteudo");
    var h = $("hero");

    c.innerHTML = "";

    var v = state.view;
    h.hidden = v !== "inicio";

    if (v === "inicio") {
      destaque();

      add(
        c,
        fileira(
          "Em alta agora",
          embaralha(state.todos).slice(0, 20)
        )
      );

      add(c, fileira("Filmes", state.filmes));
      add(c, fileira("Séries", state.series));

      var gen = {};

      state.todos.forEach(function (t) {
        t.generos.forEach(function (g) {
          (gen[g] = gen[g] || []).push(t);
        });
      });

      Object.keys(gen).sort().forEach(function (g) {
        if (gen[g].length > 2) {
          add(c, fileira(g, gen[g]));
        }
      });

      if (!state.todos.length) {
        c.innerHTML =
          '<p class="vazio">Nenhum título encontrado. Confira catalogo.json e catalogoseries.json.</p>';
      }
    } else {
      var base =
        v === "filmes"
          ? state.filmes
          : v === "series"
            ? state.series
            : state.todos.filter(naLista);

      var titulos = {
        filmes: "Filmes",
        series: "Séries",
        lista: "Minha lista"
      };

      c.innerHTML =
        '<h1 class="titulo-pagina">' +
        titulos[v] +
        "</h1>";

      if (!base.length) {
        c.innerHTML +=
          '<p class="vazio">' +
          (v === "lista"
            ? "Toque em “Minha lista” em um título para salvá-lo aqui."
            : "Nada por aqui ainda.") +
          "</p>";
      } else {
        var g = document.createElement("div");
        g.className = "grade";

        base.forEach(function (t) {
          g.appendChild(cartaz(t));
        });

        c.appendChild(g);
      }
    }

    window.scrollTo(0, 0);
  }

  function add(p, el) {
    if (el) p.appendChild(el);
  }

  function destaque() {
    var h = $("hero");

    var pool = state.todos.filter(function (t) {
      return t.backdrop;
    });

    var t = pool[Math.floor(Math.random() * pool.length)];

    if (!t) {
      h.innerHTML = "";
      h.style.backgroundImage = "";
      return;
    }

    h.style.backgroundImage =
      "url('" + t.backdrop.replace(/'/g, "%27") + "')";

    h.innerHTML =
      '<div class="hero-in">' +
      "<h1>" + esc(t.titulo) + "</h1>" +
      "<p>" + esc(t.sinopse) + "</p>" +
      '<div class="btns">' +
      '<button class="btn br" id="hPlay">' +
      PLAY + "Assistir</button>" +
      '<button class="btn cz" id="hInfo">Mais info</button>' +
      "</div></div>";

    $("hPlay").onclick = function () {
      tocar(t);
    };

    $("hInfo").onclick = function () {
      fecharBusca();
      abrirDetalhe(t);
    };
  }

  /* ---------- CONTROLE DA BUSCA ---------- */

  function fecharBusca() {
    var buscaEl = $("busca");

    if (buscaEl) {
      buscaEl.hidden = true;
    }

    if ($("q")) {
      $("q").value = "";
    }

    if ($("resultados")) {
      $("resultados").innerHTML = "";
    }
  }

  function abrirBusca() {
    fechaDetalhe();

    var buscaEl = $("busca");

    if (!buscaEl) return;

    // Não usar style.display = "none" aqui:
    // o atributo hidden controla a abertura e o fechamento.
    buscaEl.hidden = false;

    $("q").value = "";
    $("resultados").innerHTML = "";
    $("q").focus();
  }

  /* ---------- PÁGINA DO TÍTULO ---------- */

  function abrirDetalhe(t) {
    var d = $("detalhe");
    var serie = t.tipo === "serie";

    fecharBusca();

    var meta = [
      t.ano ? "<span>" + esc(t.ano) + "</span>" : "",

      serie
        ? "<span>" + t.temporadas.length +
          " temporada" +
          (t.temporadas.length === 1 ? "" : "s") +
          "</span>"
        : "",

      t.generos.length
        ? "<span>" + esc(t.generos.join(", ")) + "</span>"
        : ""
    ].join("");

    d.innerHTML =
      '<div class="det-capa" style="background-image:url(\'' +
      (t.backdrop || "").replace(/'/g, "%27") +
      "')\">" +

      '<button class="fecha" id="dFecha" aria-label="Fechar">' +
      '<svg viewBox="0 0 24 24">' +
      '<path d="M6 6l12 12M18 6 6 18" stroke="#fff" stroke-width="2.4" fill="none"/>' +
      "</svg></button>" +

      '<button class="play-grande" id="dPlayG" aria-label="Assistir">' +
      PLAY + "</button></div>" +

      '<div class="det-corpo">' +

      '<div class="selo">' +
      (serie ? "SÉRIE" : "FILME") +
      "</div>" +

      "<h1>" + esc(t.titulo) + "</h1>" +

      '<div class="meta">' + meta + "</div>" +

      '<button class="btn br full" id="dPlay">' +
      PLAY + "Assistir</button>" +

      '<p class="sinopse">' +
      esc(t.sinopse || "Sem descrição.") +
      "</p>" +

      (t.elenco
        ? '<p class="elenco"><b>Elenco:</b> ' +
          esc([].concat(t.elenco).join(", ")) +
          "</p>"
        : "") +

      '<div class="fileira-acoes">' +
      '<button id="dLista"></button>' +

      '<button id="dShare">' +
      '<svg viewBox="0 0 24 24">' +
      '<path d="M18 16a3 3 0 0 0-2.2 1l-7-3.5a3 3 0 0 0 0-1l7-3.5A3 3 0 1 0 15 7l-7 3.5a3 3 0 1 0 0 3l7 3.5a3 3 0 1 0 3-1z"/>' +
      "</svg>Compartilhe</button>" +
      "</div>" +

      '<div class="abas">' +
      '<button class="on" id="aMain">' +
      (serie ? "Episódios" : "Semelhantes") +
      "</button>" +

      (serie
        ? '<button id="aSim">Semelhantes</button>'
        : "") +

      '</div><div id="dLista2"></div></div>';

    // Mostrar detalhes acima da busca.
    d.hidden = false;
    d.style.zIndex = "1001";
    d.scrollTop = 0;

    document.body.style.overflow = "hidden";

    function pintaLista() {
      var on = naLista(t);

      $("dLista").className = on ? "on" : "";

      $("dLista").innerHTML =
        '<svg viewBox="0 0 24 24"><path d="' +
        (on
          ? "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
          : "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z") +
        '"/></svg>Minha lista';
    }

    function semelhantes() {
      var alvo = $("dLista2");
      alvo.innerHTML = "";

      var rel = state.todos.filter(function (x) {
        return (
          x.id !== t.id &&
          x.generos.some(function (g) {
            return t.generos.indexOf(g) > -1;
          })
        );
      });

      if (!rel.length) {
        rel = embaralha(
          state.todos.filter(function (x) {
            return x.id !== t.id;
          })
        ).slice(0, 12);
      }

      var g = document.createElement("div");
      g.className = "grade";
      g.style.padding = "12px 0";

      rel.slice(0, 15).forEach(function (x) {
        g.appendChild(cartaz(x));
      });

      alvo.appendChild(g);
    }

    function episodios() {
      var alvo = $("dLista2");
      alvo.innerHTML = "";

      var sel = document.createElement("select");
      sel.className = "temp";

      t.temporadas.forEach(function (s, i) {
        sel.innerHTML +=
          '<option value="' + i + '">' +
          esc(s.nome) +
          "</option>";
      });

      alvo.appendChild(sel);

      var box = document.createElement("div");
      alvo.appendChild(box);

      function mostra() {
        box.innerHTML = "";

        (t.temporadas[sel.value] || { eps: [] }).eps.forEach(
          function (e, j) {
            var r = document.createElement("div");
            r.className = "ep";

            r.innerHTML =
              '<span class="n">' + (j + 1) + "</span>" +
              '<span class="t">' + esc(e.titulo) + "</span>" +
              '<span class="p">' + PLAY + "</span>";

            r.onclick = function () {
              tocar(t, e);
            };

            box.appendChild(r);
          }
        );
      }

      sel.onchange = mostra;
      mostra();
    }

    pintaLista();

    if (serie) {
      episodios();
    } else {
      semelhantes();
    }

    $("dFecha").onclick = fechaDetalhe;

    $("dPlay").onclick = $("dPlayG").onclick = function () {
      tocar(t);
    };

    $("dLista").onclick = function () {
      alternaLista(t);
      pintaLista();

      if (state.view === "lista") {
        render();
      }
    };

    $("dShare").onclick = function () {
      if (navigator.share) {
        navigator.share({
          title: t.titulo,
          url: location.href
        }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(location.href)
          .catch(function () {});
      }
    };

    if (serie) {
      $("aMain").onclick = function () {
        $("aMain").className = "on";
        $("aSim").className = "";
        episodios();
      };

      $("aSim").onclick = function () {
        $("aSim").className = "on";
        $("aMain").className = "";
        semelhantes();
      };
    }
  }

  function fechaDetalhe() {
    var detalhe = $("detalhe");

    if (detalhe) {
      detalhe.hidden = true;
    }

    document.body.style.overflow = "";
  }

  /* ---------- PLAYER ---------- */

  function tocar(t, ep) {
    var id = ep
      ? ep.drive
      : t.tipo === "serie"
        ? ((t.temporadas[0] || { eps: [] }).eps[0] || {}).drive
        : t.drive;

    if (!id) {
      alert("Este título ainda não tem vídeo cadastrado.");
      return;
    }

    $("playerTitulo").textContent =
      t.titulo + (ep ? " — " + ep.titulo : "");

    $("videoWrap").innerHTML =
      '<iframe src="https://drive.google.com/file/d/' +
      encodeURIComponent(id) +
      '/preview" allow="autoplay; fullscreen" allowfullscreen></iframe>';

    $("player").hidden = false;
  }

  $("voltar").onclick = function () {
    $("player").hidden = true;
    $("videoWrap").innerHTML = "";
  };

  $("telaCheia").onclick = function () {
    var el = $("videoWrap").firstChild;

    if (el && el.requestFullscreen) {
      el.requestFullscreen().then(function () {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock("landscape").catch(function () {});
        }
      }).catch(function () {});
    }
  };

  /* ---------- BUSCA ---------- */

  function simples(s) {
    return String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function busca(q) {
    var alvo = $("resultados");
    alvo.innerHTML = "";

    q = simples(q);

    if (!q) return;

    var ps = q.split(" ");

    var r = state.todos.filter(function (t) {
      var n = simples(
        t.titulo + " " + t.generos.join(" ")
      );

      return ps.every(function (p) {
        return n.indexOf(p) > -1;
      });
    });

    if (!r.length) {
      alvo.innerHTML =
        '<p class="vazio" style="grid-column:1/-1">' +
        "Nenhum resultado para “" + esc(q) + "”." +
        "</p>";

      return;
    }

    r.forEach(function (t) {
      alvo.appendChild(cartaz(t));
    });
  }

  $("btnBusca").onclick = abrirBusca;

  $("fechaBusca").onclick = function () {
    fecharBusca();
  };

  $("q").oninput = function () {
    busca(this.value);
  };

  /* ---------- NAVEGAÇÃO ---------- */

  Array.prototype.forEach.call(
    document.querySelectorAll("#nav button"),
    function (b) {
      b.onclick = function () {
        Array.prototype.forEach.call(
          document.querySelectorAll("#nav button"),
          function (x) {
            x.classList.remove("ativo");
          }
        );

        b.classList.add("ativo");
        state.view = b.dataset.view;

        fecharBusca();
        fechaDetalhe();

        render();
      };
    }
  );

  $("logo").onclick = function (e) {
    e.preventDefault();
  };

  /* ---------- TECLADO ---------- */

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;

    if (!$("player").hidden) {
      $("voltar").click();
    } else if (!$("busca").hidden) {
      $("fechaBusca").click();
    } else if (!$("detalhe").hidden) {
      fechaDetalhe();
    }
  });

  /* ---------- INICIALIZAÇÃO ---------- */

  carregar()
    .then(render)
    .catch(function (e) {
      console.error("Erro ao carregar o TIAFLIX:", e);
    });

})();
