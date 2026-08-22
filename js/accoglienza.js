// La pagina d'ingresso: mappa dei moduli, impostazioni, e i tre stati in cui
// si può arrivare qui (mai iniziato / a metà / finito).

import { MODULI, conteggio, STRUMENTI_PER_ID } from "./batteria.js";
import * as storage from "./storage.js";
import { carica, salva, azzera, esiste } from "./storage.js";
import { leggiPacchetto } from "./esporta.js";

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

// Un'app installabile deve avere un service worker registrato: finché stava
// dietro a un pulsante, il browser non offriva nemmeno di installarla. Adesso
// si registra all'apertura. Resta "prima la rete, poi la copia", quindi non
// nasconde gli aggiornamenti.
function registraServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;
  navigator.serviceWorker.register("sw.js").catch((e) => {
    console.warn("service worker non registrato", e);
  });
}

// Chrome avvisa quando l'app si puo' installare: si mostra il pulsante solo
// allora, così non si promette un bottone che non fa niente.
let promptInstallazione = null;

function collegaInstallazione() {
  const bottone = document.querySelector("#installa");
  const istruzioniIos = document.querySelector("#istruzioni-ios");
  const stato = document.querySelector("#stato-installazione");
  if (!bottone) return;

  if (storage.installata()) {
    bottone.hidden = true;
    stato.innerHTML =
      "Sta già girando come app installata: le tue risposte sono al riparo " +
      "dalla pulizia automatica che il browser fa sui siti poco usati.";
    return;
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    promptInstallazione = e;
    bottone.hidden = false;
  });

  bottone.addEventListener("click", async () => {
    if (!promptInstallazione) return;
    promptInstallazione.prompt();
    const esito = await promptInstallazione.userChoice;
    promptInstallazione = null;
    bottone.hidden = true;
    if (esito.outcome === "accepted") {
      stato.textContent = "Installata. Aprila dall'icona: da lì le risposte non vengono più cancellate da sole.";
    }
  });

  // Su iOS l'evento non esiste e non esisterà: si spiega a mano.
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (iOS) istruzioniIos.hidden = false;
}

async function mostraStatoArchiviazione() {
  const el = document.querySelector("#stato-archiviazione");
  if (!el) return;
  const persistenza = await storage.chiediPersistenza();
  const stato = await storage.statoArchiviazione();
  const pezzi = [];
  if (persistenza.supportata) {
    pezzi.push(
      persistenza.concessa || stato.persistente
        ? "Il browser ha promesso di non cancellare questi dati per fare spazio."
        : "Il browser non ha promesso di conservare i dati: aggiungere l'app alla Home è la difesa vera."
    );
  }
  if (stato.usatiKB !== null) {
    pezzi.push("Occupato finora: " + stato.usatiKB + " KB.");
  }
  el.textContent = pezzi.join(" ");
}

function collegaImportazione() {
  const bottone = document.querySelector("#importa");
  const input = document.querySelector("#file-importa");
  const esito = document.querySelector("#esito-importa");
  if (!bottone || !input) return;

  bottone.addEventListener("click", () => input.click());

  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const testo = await file.text();
      const letto = leggiPacchetto(testo);
      const quante = Object.keys(letto.risposte).length;

      const conferma = confirm(
        "Il file contiene " + quante + " risposte" +
        (letto.iniziata ? " (sessione del " + letto.iniziata.slice(0, 10) + ")" : "") +
        ". Rimpiazza quello che c'è adesso su questo dispositivo. Procedo?"
      );
      if (!conferma) { input.value = ""; return; }

      sessione = Object.assign(azzera(), {
        risposte: letto.risposte,
        disagio: letto.disagio,
        tempi: letto.tempi,
        lingua: letto.lingua,
        seme: letto.seme,
        iniziata: letto.iniziata || new Date().toISOString(),
        conclusa: letto.conclusa,
      });
      const ok = salva(sessione);
      esito.textContent = ok
        ? "Rilette " + quante + " risposte. Da qui puoi riprendere o vedere il profilo."
        : "Lette, ma non sono riuscito a salvarle su questo dispositivo.";
      disegnaModuli();
      disegnaAzioni();
    } catch (e) {
      esito.textContent = "Non sono riuscito a leggerlo: " + e.message;
    }
    input.value = "";
  });
}

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

registraServiceWorker();
disegnaModuli();
disegnaAzioni();
collegaImpostazioni();
collegaOffline();
collegaInstallazione();
collegaImportazione();
mostraStatoArchiviazione();
