(function () {
  "use strict";
  var sb = window.supabase.createClient(
    "https://celexcohsnbjhjbletzv.supabase.co",
    "sb_publishable_WfAtwu9zliLD6jWnavtpcw_6VWvf69J"
  );
  window.tiaflixAuth = sb;
  var $ = function (id) { return document.getElementById(id); };
  var modal = $("authModal"), msg = $("authMsg"), modo = "entrar";

  function mostrar(t, tipo) { msg.textContent = t || ""; msg.className = tipo || ""; }
  function definirModo(m) {
    modo = m; mostrar("");
    var e = m === "entrar";
    $("authTitulo").textContent = e ? "Entrar" : "Criar conta";
    $("authSub").textContent = e ? "Use seu e-mail e senha para acessar." : "Cadastre-se com e-mail e senha de pelo menos 6 caracteres.";
    $("authEnviar").textContent = e ? "Entrar" : "Criar conta";
    $("authTrocar").innerHTML = e ? "Ainda não tem conta? <b>Criar conta</b>" : "Já tem conta? <b>Entrar</b>";
    $("authSenha").setAttribute("autocomplete", e ? "current-password" : "new-password");
  }
  function erro(e) {
    var t = ((e && e.message) || "").toLowerCase();
    if (t.indexOf("invalid login") > -1) return "E-mail ou senha incorretos.";
    if (t.indexOf("already registered") > -1) return "Este e-mail já tem conta. Toque em Entrar.";
    if (t.indexOf("password should be") > -1) return "A senha precisa ter pelo menos 6 caracteres.";
    if (t.indexOf("email not confirmed") > -1) return "Confirme seu e-mail pelo link enviado.";
    return "Não foi possível concluir. " + ((e && e.message) || "");
  }
  async function enviar() {
    var email = $("authEmail").value.trim(), senha = $("authSenha").value;
    if (!email || !senha) return mostrar("Preencha e-mail e senha.", "erro");
    $("authEnviar").disabled = true; mostrar("Aguarde...");
    try {
      if (modo === "criar") {
        var r = await sb.auth.signUp({ email: email, password: senha });
        if (r.error) throw r.error;
        mostrar(r.data.session ? "Conta criada! Você já está logado." : "Conta criada! Confirme pelo link enviado ao e-mail.", "ok");
        if (r.data.session) setTimeout(fechar, 900);
      } else {
        var l = await sb.auth.signInWithPassword({ email: email, password: senha });
        if (l.error) throw l.error;
        fechar();
      }
    } catch (e) { mostrar(erro(e), "erro"); }
    finally { $("authEnviar").disabled = false; }
  }
  function fechar() { modal.hidden = true; }
  function topo(s) {
    var on = !!(s && s.user);
    $("btnEntrar").hidden = on; $("btnSair").hidden = !on;
    window.tiaflixUser = on ? s.user : null;
  }
  $("btnEntrar").onclick = function () { definirModo("entrar"); modal.hidden = false; $("authEmail").focus(); };
  $("btnSair").onclick = function () { sb.auth.signOut(); };
  $("authFechar").onclick = fechar;
  $("authTrocar").onclick = function () { definirModo(modo === "entrar" ? "criar" : "entrar"); };
  $("authEnviar").onclick = enviar;
  $("authSenha").addEventListener("keydown", function (e) { if (e.key === "Enter") enviar(); });
  modal.addEventListener("click", function (e) { if (e.target === modal) fechar(); });
  sb.auth.getSession().then(function (r) { topo(r.data.session); });
  sb.auth.onAuthStateChange(function (_e, s) { topo(s); });
})();
