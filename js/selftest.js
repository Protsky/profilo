// Le verifiche.
//
// Regola di questo file: le prove guidano l'INTERFACCIA VERA dentro un iframe,
// cliccando i bottoni reali sulle pagine reali. Niente stato preparato a mano
// e infilato in localStorage per far partire il codice da metà strada: un
// profilo costruito così passa anche quando l'interfaccia è rotta, ed è
// esattamente il modo in cui i bug arrivano in fondo con la suite verde.
//
// Dove una prova riguarda una funzione pura (l'inversione di un item, la
// regola delle tre condizioni dell'MDQ) la si chiama direttamente: lì non c'è
// interfaccia di mezzo e l'iframe non aggiungerebbe niente.

import bfas from "./strumenti/bfas.js";
import mdq from "./strumenti/mdq.js";
import { valoreItem, punteggioScala } from "./punteggi.js";
import { frasiVietateIn } from "./referto.js";
import { NORME } from "./norme.js";
import { CONTROLLI } from "./validita.js";
import * as esporta from "./esporta.js";

const telaio = document.querySelector("#telaio");
const esiti = document.querySelector("#esiti");
const riassunto = document.querySelector("#riassunto");
const CHIAVE = "profilo.sessione.v1";

let passate = 0;
let fallite = 0;

function segna(nome, ok, dettaglio = "") {
  const d = document.createElement("div");
  d.className = "prova " + (ok ? "ok" : "no");
  d.innerHTML =
    "<span class='nome'>" + (ok ? "ok" : "NO") + " — " + esc(nome) + "</span>" +
    (dettaglio ? "<span class='dettaglio'>" + esc(dettaglio) + "</span>" : "");
  esiti.appendChild(d);
  ok ? passate++ : fallite++;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

const attesa = (ms) => new Promise((r) => setTimeout(r, ms));

// --- guida dell'interfaccia vera ---

function magazzino() {
  return telaio.contentWindow.localStorage;
}

function sessione() {
  try {
    return JSON.parse(magazzino().getItem(CHIAVE) || "{}");
  } catch (e) {
    return {};
  }
}

async function apri(pagina, { azzera = true } = {}) {
  if (azzera && telaio.contentWindow) {
    try { magazzino().removeItem(CHIAVE); } catch (e) { /* prima volta */ }
  }
  await new Promise((risolvi) => {
    telaio.onload = risolvi;
    telaio.src = pagina + "?t=" + Date.now();
  });
  if (azzera) {
    // Alla primissima apertura il magazzino non era raggiungibile: azzero ora
    // e ricarico, così la pagina parte davvero da zero.
    const s = sessione();
    if (Object.keys(s.risposte || {}).length) {
      magazzino().removeItem(CHIAVE);
      await new Promise((risolvi) => {
        telaio.onload = risolvi;
        telaio.src = pagina + "?t=" + Date.now();
      });
    }
  }
  await attesa(120); // il modulo si avvia
  return telaio.contentDocument;
}

function righe() {
  return [...telaio.contentDocument.querySelectorAll(".item")];
}

function sicurezzaVisibile() {
  return !!telaio.contentDocument.querySelector(".scheda-sicurezza");
}

// Compila la batteria cliccando davvero. scegli(id, bottoni) -> elemento.
// Si ri-interroga il DOM dopo OGNI click, invece di scorrere una lista presa
// una volta sola. Serve perché una risposta può aprire o chiudere domande
// condizionali e far ridisegnare il blocco: da quel momento i nodi presi prima
// sono staccati dal documento, e continuare a cliccarli vuol dire compilare un
// modulo che non è più a schermo.
async function compila(scegli, { fermatiDopo = Infinity, pausaMs = 0 } = {}) {
  let fatti = 0;
  for (let passo = 0; passo < 3000; passo++) {
    if (sicurezzaVisibile()) return { fatti, sicurezza: true };

    const riga = righe().find((r) => !r.querySelector(".opzione.scelta"));
    if (riga) {
      const bottoni = [...riga.querySelectorAll(".opzione")];
      if (!bottoni.length) return { fatti, senzaOpzioni: riga.dataset.id };
      const b = scegli(riga.dataset.id, bottoni);
      if (!b) return { fatti, senzaScelta: riga.dataset.id };
      if (pausaMs) await attesa(pausaMs);
      b.click();
      fatti++;
      if (fatti >= fermatiDopo) return { fatti, interrotto: true };
      continue;
    }

    const avanti = telaio.contentDocument.querySelector("#avanti");
    if (!avanti) return { fatti, finito: true };
    if (avanti.disabled) return { fatti, bloccato: true };
    avanti.click();
    await attesa(20);
  }
  return { fatti, passiEsauriti: true };
}

const primo = (id, b) => b[0];
const ultimo = (id, b) => b[b.length - 1];

// ---------------------------------------------------------------- prove ----

async function provaInversione() {
  // Ogni item invertito, uno per uno, contro la chiave del file.
  let sbagliati = 0;
  for (const item of bfas.item) {
    for (let v = 1; v <= 5; v++) {
      const atteso = item.invertito ? 6 - v : v;
      if (valoreItem(item, v, bfas.scala) !== atteso) sbagliati++;
    }
  }
  const invertiti = bfas.item.filter((i) => i.invertito).length;
  segna(
    "Inversione di ogni item, uno per uno",
    sbagliati === 0 && bfas.item.length === 100 && invertiti === 46,
    bfas.item.length + " item, " + invertiti + " invertiti (attesi 100 e 46), " + sbagliati + " calcoli sbagliati"
  );
}

async function provaTreCondizioniMdq() {
  // La regola che quasi tutti i test online sbagliano.
  const casi = [
    { nome: "9 sintomi, ma non insieme", r: sintomiMdq(9, { q2: 0, q3: 3 }), atteso: false },
    { nome: "9 sintomi insieme, nessun problema", r: sintomiMdq(9, { q2: 1, q3: 0 }), atteso: false },
    { nome: "9 sintomi insieme, problema piccolo", r: sintomiMdq(9, { q2: 1, q3: 1 }), atteso: false },
    { nome: "9 sintomi insieme, problema moderato", r: sintomiMdq(9, { q2: 1, q3: 2 }), atteso: true },
    { nome: "6 sintomi, tutto il resto sì", r: sintomiMdq(6, { q2: 1, q3: 3 }), atteso: false },
  ];
  const sbagliati = casi.filter((c) => mdq.valuta(c.r).positivo !== c.atteso);
  segna(
    "MDQ: positivo solo con tutte e tre le condizioni",
    sbagliati.length === 0,
    sbagliati.length ? "sbagliati: " + sbagliati.map((c) => c.nome).join("; ") : casi.length + " casi giusti"
  );
}

function sintomiMdq(quanti, { q2, q3 }) {
  const r = {};
  for (let i = 1; i <= 13; i++) r["mdq_" + String(i).padStart(2, "0")] = i <= quanti ? 1 : 0;
  r.mdq_q2 = q2;
  r.mdq_q3 = q3;
  return r;
}

async function provaTuttoMinimo() {
  await apri("test.html");
  const esito = await compila(primo);
  const s = sessione();
  const risposte = Object.keys(s.risposte || {}).length;
  // Tutto al minimo: la stringa di risposte uguali deve far cadere il profilo.
  await apri("profilo.html", { azzera: false });
  const testo = telaio.contentDocument.body.innerText;
  const rifiutato = /non regge un profilo|cannot carry a profile/i.test(testo);
  segna(
    "Tutto al minimo: il profilo viene rifiutato",
    risposte > 100 && rifiutato && !esito.sicurezza,
    risposte + " risposte, profilo " + (rifiutato ? "rifiutato" : "MOSTRATO")
  );
}

async function provaTuttoMassimo() {
  await apri("test.html");
  // Tutto al massimo farebbe scattare la domanda di rischio: la prima domanda
  // la rispondo No, il resto al massimo. È il caso peggiore per il long-string.
  const esito = await compila((id, b) => {
    // Le due domande di rischio restano a zero: qui si prova il long-string,
    // non la sicurezza, che ha le sue prove dedicate.
    if (id === "rischio_diretto" || id === "phq9_09") return b[0];
    return b[b.length - 1];
  });
  const risposte = Object.keys(sessione().risposte || {}).length;
  await apri("profilo.html", { azzera: false });
  const testo = telaio.contentDocument.body.innerText;
  const rifiutato = /non regge un profilo|cannot carry a profile/i.test(testo);
  segna(
    "Tutto al massimo: il profilo viene rifiutato",
    risposte > 100 && rifiutato,
    risposte + " risposte, profilo " + (rifiutato ? "rifiutato" : "MOSTRATO")
  );
}

// Il pattern deterministico usato dalle prove sui punteggi.
function valoreProva(id) {
  const controllo = CONTROLLI.find((c) => c.id === id);
  if (controllo) return controllo.atteso;
  if (id === "rischio_diretto") return 0;
  // L'item 9 del PHQ-9 va tenuto a zero nelle prove sui punteggi: sopra zero
  // fa scattare il percorso di sicurezza, che e' giusto e che ha la sua prova
  // dedicata (provaPhq9Item9). Qui servirebbe solo a impedire di arrivare in
  // fondo alla batteria.
  if (id === "phq9_09") return 0;
  if (id === "mdq_q2") return 1;
  if (id === "mdq_q3") return 2;
  if (id.startsWith("mdq_")) return Number(id.slice(4)) <= 9 ? 1 : 0;
  if (id.startsWith("bfas_")) {
    const n = Number(id.slice(5));
    const item = bfas.item.find((i) => i.id === id);
    // livello latente per aspetto, con l'inversione rispettata: un rispondente
    // coerente non risponde uguale a "mi irrito" e "mi irrito raramente"
    const base = 1 + ((Math.floor((n - 1) / 10) * 3) % 5); // 1,4,2,5,3,...
    return item && item.invertito ? 6 - base : base;
  }
  // Risposte variate: un rispondente vero non mette lo stesso numero ovunque,
  // e un fixture che lo facesse metterebbe alla prova gli indici di validità
  // invece dei punteggi.
  if (id.startsWith("pq16_")) return Number(id.slice(5)) % 3 === 0 ? 1 : 0; // 5 sì, sotto la soglia di 6
  if (id.startsWith("phq9_")) return Number(id.slice(5)) % 3;
  if (id.startsWith("gad7_")) return Number(id.slice(5)) % 2;
  if (id.startsWith("asrm_")) return Number(id.slice(5)) % 3;
  if (id.startsWith("pid5_")) return Number(id.slice(5)) % 4;
  if (id.startsWith("asrs5_")) return Number(id.slice(6)) % 3;
  if (id.startsWith("aq10_")) return (Number(id.slice(5)) % 4) + 1;
  if (id === "pcptsd5_00") return 1; // sì: apre le cinque condizionali
  if (id.startsWith("pcptsd5_")) return Number(id.slice(8)) % 2;
  if (id.startsWith("auditc_")) return Number(id.slice(7)) % 2;
  if (id.startsWith("isi_")) return Number(id.slice(4)) % 3;
  if (id.startsWith("whodas_")) return Number(id.slice(7)) % 3;
  return 1;
}

function sceglValoreProva(id, bottoni) {
  const v = valoreProva(id);
  return bottoni.find((b) => Number(b.dataset.valore) === Number(v)) || bottoni[0];
}

async function provaPunteggiAMano() {
  await apri("test.html");
  await compila(sceglValoreProva);
  const s = sessione();

  // Seconda implementazione, scritta qui apposta: se punteggi.js sbaglia,
  // i due conti divergono.
  let sbagliate = [];
  for (const chiave of Object.keys(bfas.aspetti)) {
    const item = bfas.item.filter((i) => i.scala === chiave);
    let atteso = 0;
    for (const it of item) {
      const dato = Number(s.risposte[it.id]);
      atteso += it.invertito ? 6 - dato : dato;
    }
    const calcolato = punteggioScala(bfas, chiave, s.risposte);
    if (!calcolato || calcolato.incompleta || Math.abs(calcolato.somma - atteso) > 1e-9) {
      sbagliate.push(chiave + ": atteso " + atteso + ", calcolato " + (calcolato && calcolato.somma));
    }
  }
  segna(
    "Punteggi BFAS uguali al conto fatto a parte",
    sbagliate.length === 0,
    sbagliate.length ? sbagliate.join(" | ") : "10 aspetti su 10 coincidono"
  );
  return s;
}

async function provaRischioDiretto() {
  await apri("test.html");
  // Risposta di rischio alla prima domanda.
  const rr = righe();
  const riga = rr.find((r) => r.dataset.id === "rischio_diretto");
  if (!riga) { segna("La domanda di rischio è la prima", false, "non trovata nel primo blocco"); return; }
  const bottoni = [...riga.querySelectorAll(".opzione")];
  bottoni.find((b) => b.dataset.valore === "2").click();
  await attesa(80);

  const doc = telaio.contentDocument;
  const scheda = doc.querySelector(".scheda-sicurezza");
  const testo = doc.body.innerText;
  const haNumeri = !!doc.querySelector(".dimensione, .conto-predittivo, .banda");
  const haContatti = /143/.test(testo) && /144/.test(testo);
  segna(
    "Risposta di rischio: si ferma prima di qualunque punteggio",
    !!scheda && haContatti && !haNumeri,
    (scheda ? "schermata mostrata" : "SCHERMATA ASSENTE") +
      ", contatti " + (haContatti ? "presenti" : "ASSENTI") +
      ", punteggi " + (haNumeri ? "MOSTRATI" : "non mostrati")
  );
}

async function provaPhq9Item9() {
  await apri("test.html");
  let trovato = false;
  const esito = await compila((id, bottoni) => {
    if (id === "phq9_09") { trovato = true; return bottoni[1]; } // "Alcuni giorni" > 0
    if (id === "rischio_diretto") return bottoni[0];
    return sceglValoreProva(id, bottoni);
  });
  segna(
    "PHQ-9 item 9 sopra zero: scatta la sicurezza",
    trovato && esito.sicurezza === true,
    trovato ? (esito.sicurezza ? "fermato al momento giusto" : "NON si è fermato") : "item non incontrato"
  );
}

async function provaInterrottoRipreso() {
  // Primo giro intero.
  await apri("test.html");
  await compila(sceglValoreProva);
  const intero = sessione().risposte;

  // Secondo giro: si interrompe a metà, si ricarica la pagina, si finisce.
  await apri("test.html");
  await compila(sceglValoreProva, { fermatiDopo: 60 });
  const aMeta = Object.keys(sessione().risposte).length;
  await apri("test.html", { azzera: false }); // ricarica vera, riprende da localStorage
  await compila(sceglValoreProva);
  const ripreso = sessione().risposte;

  const chiavi = new Set([...Object.keys(intero), ...Object.keys(ripreso)]);
  const diverse = [...chiavi].filter((k) => Number(intero[k]) !== Number(ripreso[k]));
  segna(
    "Interrotto a metà e ripreso: stesse risposte",
    diverse.length === 0 && Object.keys(ripreso).length === Object.keys(intero).length,
    "interrotto a " + aMeta + ", " + Object.keys(ripreso).length + " risposte alla fine, " +
      diverse.length + " differenze"
  );

  // E gli stessi punteggi.
  const a = punteggioScala(bfas, "volatilita", intero);
  const b = punteggioScala(bfas, "volatilita", ripreso);
  segna(
    "Interrotto e ripreso: stessi punteggi",
    a && b && a.somma === b.somma,
    a && b ? "volatilità " + a.somma + " contro " + b.somma : "punteggio non calcolabile"
  );
}

async function provaCondizionali() {
  // Chi non ha avuto un evento difficile non deve vedersi chiedere com'è
  // andata dopo: quelle domande metterebbero in bocca un contenuto che la
  // persona non ha portato. E nel referto devono risultare "non poste", non
  // "punteggio basso".
  await apri("test.html");
  await compila((id, bottoni) => {
    if (id === "pcptsd5_00") return bottoni[0]; // No, nessun evento
    return sceglValoreProva(id, bottoni);
  });
  const s = sessione();
  const seguito = Object.keys(s.risposte).filter((k) => /^pcptsd5_0[1-5]$/.test(k));

  await apri("profilo.html", { azzera: false });
  const testo = telaio.contentDocument.body.innerText;
  const loDice = /non sono state poste|were not asked/i.test(testo);
  const nonDicePunteggioBasso = !/Conseguenze di un evento[^]{0,80}0 su 5/i.test(testo);

  segna(
    "Domande condizionali: non poste, e il referto lo distingue da un punteggio basso",
    seguito.length === 0 && loDice && nonDicePunteggioBasso,
    seguito.length + " domande di seguito registrate (attese 0), referto " +
      (loDice ? "lo dichiara" : "NON lo dichiara")
  );
}

async function provaEsportazione() {
  // I file esportati devono reggere una rianalisi fatta altrove, mesi dopo,
  // da uno script che non ha questa app sotto mano. Quindi non basta che
  // "si scarichino": il CSV deve contenere il valore gia' raddrizzato per
  // l'inversione, e il JSON deve poter rientrare identico.
  await apri("test.html");
  await compila(sceglValoreProva);
  const s = sessione();

  const pkg = esporta.pacchetto(s);
  const cItem = esporta.csvItem(s);
  const cPunt = esporta.csvPunteggi(s);

  // 1. il JSON rientra identico
  const riletto = esporta.leggiPacchetto(JSON.stringify(pkg));
  const chiavi = new Set([...Object.keys(s.risposte), ...Object.keys(riletto.risposte)]);
  const diverse = [...chiavi].filter((k) => Number(s.risposte[k]) !== Number(riletto.risposte[k]));

  // 2. il CSV ha una riga per item di strumento, piu' l'intestazione
  const righe = cItem.trim().split("\r\n");
  const itemDiStrumento = pkg.item.length;

  // 3. il valore_corretto nel CSV coincide col conto fatto a mano su un item
  //    invertito: e' la colonna su cui si baserebbe qualunque rianalisi
  const intestazione = righe[0].split(",");
  const iId = intestazione.indexOf("id_item");
  const iInv = intestazione.indexOf("invertito");
  const iGrezza = intestazione.indexOf("risposta_grezza");
  const iCorretto = intestazione.indexOf("valore_corretto");
  let sbagliati = 0;
  let invertitiControllati = 0;
  for (const r of righe.slice(1)) {
    // le righe con virgolette contengono virgole nel testo: salto quelle,
    // qui interessa solo la coerenza numerica
    if (r.indexOf('"') >= 0) continue;
    const c = r.split(",");
    if (!c[iId] || !c[iId].startsWith("bfas_")) continue;
    if (c[iGrezza] === "") continue;
    const invertito = c[iInv] === "1";
    const atteso = invertito ? 6 - Number(c[iGrezza]) : Number(c[iGrezza]);
    if (invertito) invertitiControllati++;
    if (Number(c[iCorretto]) !== atteso) sbagliati++;
  }

  const ok =
    diverse.length === 0 &&
    righe.length === itemDiStrumento + 1 &&
    cPunt.trim().split("\r\n").length > 20 &&
    sbagliati === 0 &&
    invertitiControllati > 10;

  segna(
    "Esportazione: il JSON rientra identico e il CSV ha i valori raddrizzati",
    ok,
    diverse.length + " risposte diverse dopo il giro, " +
      (righe.length - 1) + " righe CSV su " + itemDiStrumento + " item, " +
      invertitiControllati + " item invertiti controllati, " + sbagliati + " sbagliati"
  );
}

async function provaLessicoReferto() {
  // Questa è la compilazione "attenta": risposte coerenti, controlli di
  // attenzione rispettati e TEMPO VERO fra una risposta e l'altra. È l'unica
  // prova che deve produrre un profilo pienamente valido, quindi è anche
  // l'unica che si prende il suo minuto invece di cliccare a raffica.
  await apri("test.html");
  await compila(sceglValoreProva, { pausaMs: 340 });
  await apri("profilo.html", { azzera: false });
  const doc = telaio.contentDocument;
  const testo = doc.body.innerText;

  const verdettoClasse = doc.querySelector(".verdetto-validita")?.className || "";
  const attendibile = /attendibile/.test(verdettoClasse);
  const segnaliRimasti = [...doc.querySelectorAll(".verdetto-validita li")].map((x) => x.textContent);
  segna(
    "Compilazione attenta: il protocollo risulta attendibile",
    attendibile,
    attendibile ? "nessun indice ha segnalato niente" : "segnalati: " + (segnaliRimasti.join(" | ") || verdettoClasse)
  );

  const vietate = frasiVietateIn(testo);
  segna(
    "Il referto non contiene nessuna frase vietata",
    vietate.length === 0,
    vietate.length ? "trovate: " + vietate.join(", ") : "nessuna fra: «tutto a posto», «nessun rischio», «sei sano», «risulti negativo»…"
  );
  return testo;
}

async function provaNormeNonInventate(testoReferto) {
  const nessunaNorma = Object.keys(NORME).length === 0;
  const loDice = /norma pubblicata|no published norm|non c'è nessun percentile|there is no percentile/i.test(
    testoReferto || ""
  );
  segna(
    "Senza norma non si inventa un percentile: lo scrive",
    nessunaNorma && loDice,
    (nessunaNorma ? "norme vuote" : "NORME PIENE") + ", il referto " + (loDice ? "lo dichiara" : "NON lo dichiara")
  );
}

async function provaValorePredittivo(testoReferto) {
  // Con l'MDQ sopra soglia il referto deve mostrare il conto, non solo l'esito.
  const mostraConto = /Su 100 persone|Out of 100 people/i.test(testoReferto || "");
  segna(
    "Ogni segnalazione arriva col suo valore predittivo",
    mostraConto,
    mostraConto ? "il conto è accanto alla bandiera" : "bandiera senza il conto"
  );
}

// ----------------------------------------------------------------- via -----

(async function () {
  await provaInversione();
  await provaTreCondizioniMdq();
  await provaRischioDiretto();
  await provaPhq9Item9();
  await provaTuttoMinimo();
  await provaTuttoMassimo();
  await provaPunteggiAMano();
  await provaInterrottoRipreso();
  await provaCondizionali();
  await provaEsportazione();
  const testo = await provaLessicoReferto();
  await provaNormeNonInventate(testo);
  await provaValorePredittivo(testo);

  riassunto.className = "riassunto " + (fallite === 0 ? "ok" : "no");
  riassunto.textContent =
    fallite === 0
      ? passate + " prove su " + passate + ": tutte passate."
      : fallite + " prove fallite su " + (passate + fallite) + ".";
})();
