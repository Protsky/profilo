// La pagina d'ingresso: mappa dei moduli, impostazioni, e i tre stati in cui
// si può arrivare qui (mai iniziato / a metà / finito).

import { MODULI, conteggio, STRUMENTI_PER_ID } from "./batteria.js";
import { carica, salva, azzera, esiste } from "./storage.js";

const $ = (s) => document.querySelector(s);
let sessione = carica();

function lingua() {
  return sessione.lingua || "it";
}

function disegnaModuli() {
  const box = $("#mappa-moduli");
  const conteggi = conteggio();
  box.innerHTML = "";

  MODULI.forEach((m) => {
    const n = conteggi.perModulo[m.n] || 0;
    const fatti = contaFatti(m);
    const card = document.createElement("div");
    card.className = "modulo";
    if (fatti >= n && n > 0) card.classList.add("completo");
    else if (fatti > 0) card.classList.add("iniziato");

    const strumenti = m.strumenti
      .map((id) => STRUMENTI_PER_ID[id])
      .filter(Boolean);
    const ricostruiti = strumenti.filter((s) => s.provenienza === "ricostruito");

    card.innerHTML =
      "<h3>" + esc(m.nome[lingua()] || m.nome.it) + "</h3>" +
      "<p class='modulo-sotto'>" + esc(m.sottotitolo[lingua()] || m.sottotitolo.it) + "</p>" +
      "<p class='modulo-conto'>" + n + " domande &middot; circa " + m.minuti + " min" +
      (fatti > 0 && fatti < n ? " &middot; <strong>" + fatti + " fatte</strong>" : "") +
      (fatti >= n && n > 0 ? " &middot; <strong>finito</strong>" : "") +
      "</p>" +
      "<p class='modulo-strumenti'>" +
      strumenti.map((s) => esc(s.nome[lingua()] || s.nome.it)).join(" &middot; ") +
      "</p>" +
      (ricostruiti.length
        ? "<p class='modulo-avviso'>Item ricostruiti, non confrontati con la fonte: " +
          ricostruiti.map((s) => esc(s.id.toUpperCase())).join(", ") +
          "</p>"
        : "");
    box.appendChild(card);
  });

  const minuti = MODULI.reduce((s, m) => s + m.minuti, 0);
  $("#conteggio-item").textContent =
    conteggi.totale +
    " domande in tutto, circa " +
    minuti +
    " minuti. Si può interrompere alla fine di ogni blocco e riprendere dopo: le risposte restano salvate.";
}

function contaFatti(modulo) {
  const idStrumenti = new Set(modulo.strumenti);
  let n = 0;
  for (const id of Object.keys(sessione.risposte)) {
    const prefisso = id.split("_")[0];
    if (idStrumenti.has(prefisso)) n++;
  }
  return n;
}

function disegnaAzioni() {
  const iniziato = esiste() && Object.keys(sessione.risposte).length > 0;
  $("#comincia").hidden = iniziato;
  $("#riprendi").hidden = !iniziato || sessione.conclusa;
  $("#vedi-profilo").hidden = !iniziato;
  $("#azzera").hidden = !iniziato;

  if (sessione.conclusa) {
    $("#vedi-profilo").classList.remove("terziario");
    $("#vedi-profilo").classList.add("primario");
  }
}

function collegaImpostazioni() {
  const sel = $("#lingua");
  sel.value = lingua();
  sel.addEventListener("change", () => {
    sessione.lingua = sel.value;
    salva(sessione);
    disegnaModuli();
  });

  const chk = $("#mostra-originale");
  chk.checked = !!sessione.mostraOriginale;
  chk.addEventListener("change", () => {
    sessione.mostraOriginale = chk.checked;
    salva(sessione);
  });

  $("#azzera").addEventListener("click", () => {
    const conferma = confirm(
      "Cancella tutte le risposte di questo dispositivo. Non si torna indietro. Procedo?"
    );
    if (!conferma) return;
    sessione = azzera();
    disegnaModuli();
    disegnaAzioni();
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// L'uso senza rete si prepara a mano, con un pulsante, invece di registrare un
// service worker di nascosto alla prima apertura: chi mette in cache
// venticinque file sul dispositivo di qualcuno dovrebbe averlo chiesto.
function collegaOffline() {
  const b = document.querySelector("#prepara-offline");
  const esito = document.querySelector("#esito-offline");
  if (!b) return;

  const disponibile =
    "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost");

  if (!disponibile) {
    b.disabled = true;
    esito.textContent =
      "Non disponibile su questo indirizzo: i browser danno l'uso offline solo su https (o su localhost). Con serve.py e il certificato funziona.";
    return;
  }

  b.addEventListener("click", async () => {
    b.disabled = true;
    esito.textContent = "Sto scaricando…";
    try {
      await navigator.serviceWorker.register("sw.js");
      esito.textContent =
        "Pronto. Da adesso il test si apre anche senza rete. Per aggiornarlo, premi di nuovo dopo esserti collegato.";
      b.disabled = false;
      b.textContent = "Aggiorna";
    } catch (e) {
      esito.textContent = "Non ci sono riuscito: " + e.message;
      b.disabled = false;
    }
  });
}

disegnaModuli();
disegnaAzioni();
collegaImpostazioni();
collegaOffline();
