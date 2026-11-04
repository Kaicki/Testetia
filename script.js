
function cartaz(t) {
  var d = document.createElement("button");
  d.className = "cartaz" + (t.poster ? " tem" : "");

  if (t.poster) {
    d.style.backgroundImage = "url('" + t.poster.replace(/'/g, "%27") + "')";
  }

  d.innerHTML = "<span>" + esc(t.titulo) + "</span>";
  d.setAttribute("aria-label", t.titulo);

  d.onclick = function () {
    // Fecha a busca
    $("busca").hidden = true;
    $("q").value = "";
    $("resultados").innerHTML = "";

    // Abre os detalhes do filme ou da série
    abrirDetalhe(t);
  };

  return d;
}
