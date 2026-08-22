// Il motore di somministrazione: una domanda alla volta, con il tempo che passa
// misurato, il salvataggio a ogni blocco e il controllo di sicurezza a ogni
// risposta.

import {
  costruisci, inBlocchi, moduloDi, STRUMENTI_PER_ID, MODULI,
  condizioneSoddisfatta, controllori,
} from "./batteria.js";
import { carica, salva, seNonRiesceASalvare, quanteRisposte, esiste } from "./storage.js";
import { controlla, messaggio, CONTATTI, DA_DOVE_VALGONO } from "./sicurezza.js";
import pq16 from "./strumenti/pq16.js";

const PER_BLOCCO = 10;

let sessione = carica();
let lista = [];
let blocchi = [];
let bloccoCorrente = 0;
let entrataItem = {}; // id -> timestamp di quando la domanda è comparsa

const $ = (sel) => document.querySelector(sel);

function lingua() {
  return sessione.lingua || "it";
}

function t(oggetto) {
  if (!oggetto) return "";
  return oggetto[lingua()] || oggetto.it || "";
}

// --- avvio ---

export function avvia() {
  const giaFatte = quanteRisposte(sessione);

  // Se il salvataggio smette di funzionare, la persona deve saperlo SUBITO:
  // continuare a rispondere per mezz'ora credendo di star salvando e'
  // il modo peggiore di perdere il lavoro.
  seNonRiesceASalvare(mostraFasciaSalvataggio);

  if (!sessione.iniziata) {
    sessione.iniziata = new Date().toISOString();
    sessione.seme = Math.floor(Math.random() * 1e9);
  }
  lista = costruisci(sessione.seme || 20260821);
  blocchi = inBlocchi(lista, PER_BLOCCO);
  sessione.ordine = lista.map((i) => i.id);

  // Riprende dal primo blocco con qualcosa di non risposto.
  bloccoCorrente = blocchi.findIndex((b) =>
    b.item.some(
      (it) =>
        condizioneSoddisfatta(it, sessione.risposte) &&
        sessione.risposte[it.id] === undefined
    )
  );
  if (bloccoCorrente < 0) bloccoCorrente = blocchi.length; // tutto fatto

  salva(sessione);
  if (giaFatte > 0 && !sessione.conclusa) {
    // Stesso totale che mostra la barra di avanzamento: le domande escluse da
    // una condizione non sono da fare, quindi non entrano nel conto.
    const applicabili = lista.filter((i) => condizioneSoddisfatta(i, sessione.risposte));
    mostraFasciaRipresa(giaFatte, applicabili.length);
  }
  disegna();
}

// Quando il telefono chiude la pagina per fare spazio, o si passa a un'altra
// app, questo e' l'ultimo momento utile per scrivere. Le risposte sono gia'
// salvate una per una, ma la posizione nel blocco no: senza, si riparte
// dall'inizio del blocco invece che da dove si era.
function salvaUscendo() {
  // LA GUARDIA CONTA, e l'ha trovata il selftest. Questo scatta anche mentre
  // la pagina se ne va perché qualcuno ha appena cancellato la sessione: senza
  // il controllo si riscriverebbe in memoria la sessione appena buttata via, e
  // «cancella tutto e ricomincia» non cancellerebbe un bel niente. Se la chiave
  // non c'è più, è perché qualcuno l'ha tolta apposta.
  if (!esiste()) return;
  sessione.posizione = bloccoCorrente;
  salva(sessione);
}

window.addEventListener("pagehide", salvaUscendo);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") salvaUscendo();
});

// --- fasce di avviso ---

function fascia(classe, testo, azione) {
  const vecchia = document.querySelector(".fascia." + classe);
  if (vecchia) vecchia.remove();
  const d = document.createElement("div");
  d.className = "fascia " + classe;
  const p = document.createElement("p");
  p.textContent = testo;
  d.appendChild(p);
  if (azione) d.appendChild(azione);
  document.body.insertBefore(d, document.body.firstChild);
  return d;
}

function mostraFasciaRipresa(fatte, totale) {
  const d = fascia(
    "ripresa",
    lingua() === "en"
      ? "Picked up where you left off: " + fatte + " of " + totale + " answered."
      : "Ripreso da dove eri: " + fatte + " domande su " + totale + " già fatte."
  );
  // Resta finche' non riprendi davvero a rispondere. A tempo non andava bene:
  // chi riapre l'app dopo due giorni sta ancora capendo dov'era rimasto,
  // e un messaggio che sparisce da solo dopo quattro secondi se lo perde.
}

function viaLaFasciaRipresa() {
  const d = document.querySelector(".fascia.ripresa");
  if (!d) return;
  d.classList.add("sparisce");
  setTimeout(() => d.remove(), 600);
}

function mostraFasciaSalvataggio() {
  fascia(
    "guasto",
    lingua() === "en"
      ? "Cannot save on this device: answers from here on will be lost if you close the page. Private browsing or a full storage usually explains it."
      : "Non riesco a salvare su questo dispositivo: da qui in avanti, se chiudi la pagina le risposte si perdono. Di solito è la navigazione privata, o lo spazio esaurito."
  );
}

// --- disegno ---

function disegna({ mantieniScorrimento = false } = {}) {
  const scorrimento = window.scrollY;
  // Se la sicurezza è già scattata e non è stata mostrata, ha la precedenza
  // su qualunque cosa, sempre.
  const rischio = controlla(sessione.risposte);
  if (rischio && !sessione.sicurezzaMostrata) {
    disegnaSicurezza(rischio);
    return;
  }

  if (bloccoCorrente >= blocchi.length) {
    disegnaFine();
    return;
  }

  const blocco = blocchi[bloccoCorrente];
  const modulo = moduloDi(blocco.modulo);
  const app = $("#app");

  app.innerHTML = "";
  app.appendChild(intestazione(modulo, blocco));

  const form = document.createElement("div");
  form.className = "blocco";
  blocco.item
    .filter((item) => condizioneSoddisfatta(item, sessione.risposte))
    .forEach((item) => form.appendChild(disegnaItem(item)));
  app.appendChild(form);

  app.appendChild(piede(blocco));
  aggiornaAvanzamento();
  segnaEntrate(blocco);
  // Un blocco nuovo comincia dall'alto; un ridisegno per una domanda
  // condizionale no, altrimenti chi sta rispondendo a metà lista si ritrova
  // sbalzato in cima senza capire perché.
  window.scrollTo({ top: mantieniScorrimento ? scorrimento : 0, behavior: "instant" });
}

function intestazione(modulo, blocco) {
  const div = document.createElement("header");
  div.className = "intestazione-blocco";
  if (modulo) {
    div.innerHTML =
      '<p class="modulo-nome">' + escapeHtml(t(modulo.nome)) + "</p>";
  }
  // La consegna dello strumento a cui appartiene il blocco.
  const primo = blocco.item.find((i) => STRUMENTI_PER_ID[i.strumento]);
  if (primo) {
    const s = STRUMENTI_PER_ID[primo.strumento];
    const p = document.createElement("p");
    p.className = "consegna";
    p.textContent = t(s.consegna);
    div.appendChild(p);
    if (s.provenienza === "ricostruito") {
      const avviso = document.createElement("p");
      avviso.className = "avviso-ricostruito";
      avviso.textContent =
        lingua() === "en"
          ? "Note: the wording of these items was reconstructed and not checked against the original source. Treat the result as indicative."
          : "Nota: il testo di queste domande è stato ricostruito e non confrontato con la fonte originale. Il risultato vale come indicazione, non come misura.";
      div.appendChild(avviso);
    }
  }
  return div;
}

function disegnaItem(item) {
  const riga = document.createElement("div");
  riga.className = "item";
  riga.dataset.id = item.id;
  if (item.controllo) riga.dataset.controllo = "1";

  const testo = document.createElement("p");
  testo.className = "item-testo";
  testo.textContent = t(item.testo);
  riga.appendChild(testo);

  // In bilingue: l'originale inglese sotto, in piccolo, sempre consultabile.
  const s = STRUMENTI_PER_ID[item.strumento];
  if (sessione.mostraOriginale && item.testo && item.testo.en && lingua() === "it") {
    const orig = document.createElement("p");
    orig.className = "item-originale";
    orig.textContent = item.testo.en;
    riga.appendChild(orig);
  }

  riga.appendChild(opzioni(item, s));
  return riga;
}

function opzioni(item, strumento) {
  const gruppo = document.createElement("div");
  gruppo.className = "opzioni";

  let scelte;
  if (item.opzioni) {
    scelte = item.opzioni.map((o) => ({ valore: o.valore, etichetta: t(o.testo) }));
    gruppo.classList.add("opzioni-lunghe");
  } else {
    const scala = item.scalaRisposta || (strumento && strumento.scala);
    if (!scala) return gruppo;
    const ancore = scala.ancore ? scala.ancore[lingua()] || scala.ancore.it : null;
    scelte = [];
    for (let v = scala.min; v <= scala.max; v++) {
      scelte.push({
        valore: v,
        etichetta: ancore ? ancore[v - scala.min] : String(v),
      });
    }
    if (scelte.length > 5) gruppo.classList.add("opzioni-lunghe");
  }

  scelte.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "opzione";
    b.dataset.valore = String(s.valore);
    b.textContent = s.etichetta;
    if (Number(sessione.risposte[item.id]) === Number(s.valore)) {
      b.classList.add("scelta");
    }
    b.addEventListener("click", () => rispondi(item, s.valore, gruppo));
    gruppo.appendChild(b);
  });

  return gruppo;
}

function rispondi(item, valore, gruppo) {
  const ora = Date.now();
  const entrata = entrataItem[item.id];
  if (entrata && sessione.tempi[item.id] === undefined) {
    sessione.tempi[item.id] = ora - entrata;
  }

  sessione.risposte[item.id] = valore;
  viaLaFasciaRipresa(); // ha ripreso davvero: il messaggio ha finito il suo lavoro
  gruppo.querySelectorAll(".opzione").forEach((b) => {
    b.classList.toggle("scelta", Number(b.dataset.valore) === Number(valore));
  });

  // Il PQ-16 chiede quanto ha dato fastidio, ma solo se la risposta è sì.
  if (item.apreDisagio) {
    aggiornaDisagio(item, valore, gruppo.parentElement);
  }

  // Sicurezza: si controlla a ogni risposta, non alla fine.
  const rischio = controlla(sessione.risposte);
  if (rischio && !sessione.sicurezzaMostrata) {
    salva(sessione);
    disegnaSicurezza(rischio);
    return;
  }

  salva(sessione);

  // Se questa risposta decide quali altre domande hanno senso, il blocco va
  // ridisegnato: le condizionali compaiono o spariscono.
  const blocco = blocchi[bloccoCorrente];
  if (blocco && controllori(blocco.item).has(item.id)) {
    disegna({ mantieniScorrimento: true });
    return;
  }

  aggiornaAvanzamento();
  aggiornaPulsanteAvanti();
}

function aggiornaDisagio(item, valore, riga) {
  const esistente = riga.querySelector(".disagio");
  if (Number(valore) !== 1) {
    if (esistente) esistente.remove();
    delete sessione.disagio[item.id];
    return;
  }
  if (esistente) return;

  const box = document.createElement("div");
  box.className = "disagio";
  const dom = document.createElement("p");
  dom.className = "disagio-domanda";
  dom.textContent = t(pq16.disagio.domanda);
  box.appendChild(dom);

  const gruppo = document.createElement("div");
  gruppo.className = "opzioni";
  const ancore = pq16.disagio.ancore[lingua()] || pq16.disagio.ancore.it;
  ancore.forEach((etichetta, v) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "opzione";
    b.dataset.valore = String(v);
    b.textContent = etichetta;
    if (Number(sessione.disagio[item.id]) === v) b.classList.add("scelta");
    b.addEventListener("click", () => {
      sessione.disagio[item.id] = v;
      gruppo.querySelectorAll(".opzione").forEach((x) => {
        x.classList.toggle("scelta", Number(x.dataset.valore) === v);
      });
      salva(sessione);
    });
    gruppo.appendChild(b);
  });
  box.appendChild(gruppo);
  riga.appendChild(box);
}

function piede(blocco) {
  const div = document.createElement("div");
  div.className = "piede";

  const indietro = document.createElement("button");
  indietro.type = "button";
  indietro.className = "secondario";
  indietro.textContent = lingua() === "en" ? "Back" : "Indietro";
  indietro.disabled = bloccoCorrente === 0;
  indietro.addEventListener("click", () => {
    bloccoCorrente = Math.max(0, bloccoCorrente - 1);
    salva(sessione);
    disegna();
  });

  const avanti = document.createElement("button");
  avanti.type = "button";
  avanti.className = "primario";
  avanti.id = "avanti";
  avanti.textContent = lingua() === "en" ? "Continue" : "Avanti";
  avanti.addEventListener("click", () => {
    bloccoCorrente++;
    sessione.posizione = bloccoCorrente;
    salva(sessione);
    disegna();
  });

  const pausa = document.createElement("button");
  pausa.type = "button";
  pausa.className = "terziario";
  pausa.textContent = lingua() === "en" ? "Stop for now" : "Fermati qui";
  pausa.addEventListener("click", () => {
    salva(sessione);
    location.href = "index.html";
  });

  div.append(indietro, avanti, pausa);
  setTimeout(aggiornaPulsanteAvanti, 0);
  return div;
}

function aggiornaPulsanteAvanti() {
  const avanti = $("#avanti");
  if (!avanti) return;
  const blocco = blocchi[bloccoCorrente];
  if (!blocco) return;
  const mancano = blocco.item.filter((it) => {
    // Le condizionali contano solo se sono davvero a schermo.
    if (!condizioneSoddisfatta(it, sessione.risposte)) return false;
    return sessione.risposte[it.id] === undefined;
  }).length;
  avanti.disabled = mancano > 0;
  avanti.textContent =
    mancano > 0
      ? lingua() === "en"
        ? mancano + " left in this block"
        : "mancano " + mancano
      : lingua() === "en"
      ? "Continue"
      : "Avanti";
}

function aggiornaAvanzamento() {
  const barra = $("#avanzamento");
  if (!barra) return;
  // Le domande nascoste da una condizione non entrano nel conto: altrimenti la
  // barra non arriverebbe mai in fondo per chi non ha avuto un evento difficile.
  const applicabili = lista.filter((i) => condizioneSoddisfatta(i, sessione.risposte));
  const totale = applicabili.length;
  const fatti = applicabili.filter((i) => sessione.risposte[i.id] !== undefined).length;
  const quota = totale ? fatti / totale : 0;
  barra.style.setProperty("--quota", (quota * 100).toFixed(1) + "%");
  const testo = $("#avanzamento-testo");
  if (testo) {
    testo.textContent =
      lingua() === "en"
        ? fatti + " of " + totale + " answered"
        : fatti + " domande su " + totale;
  }
}

function segnaEntrate(blocco) {
  const ora = Date.now();
  blocco.item.forEach((it) => {
    if (entrataItem[it.id] === undefined) entrataItem[it.id] = ora;
  });
}

// --- schermata di sicurezza ---

function disegnaSicurezza(rischio) {
  sessione.sicurezzaMostrata = true;
  salva(sessione);

  const m = messaggio(rischio, lingua());
  const app = $("#app");
  app.innerHTML = "";
  app.className = "sicurezza";

  const box = document.createElement("section");
  box.className = "scheda-sicurezza";
  box.innerHTML =
    "<h1>" + escapeHtml(m.titolo) + "</h1>" +
    "<p class='corpo'>" + escapeHtml(m.corpo) + "</p>";

  const ul = document.createElement("ul");
  ul.className = "contatti";
  CONTATTI.forEach((c) => {
    const li = document.createElement("li");
    li.innerHTML =
      "<a class='numero' href='tel:" + c.numero.replace(/\s/g, "") + "'>" +
      escapeHtml(c.numero) + "</a>" +
      "<span class='chi'>" + escapeHtml(t(c.nome)) + "</span>" +
      "<span class='quando'>" + escapeHtml(t(c.quando)) + "</span>" +
      "<span class='nota'>" + escapeHtml(t(c.nota)) + "</span>";
    ul.appendChild(li);
  });
  box.appendChild(ul);

  const dove = document.createElement("p");
  dove.className = "minore";
  dove.textContent = DA_DOVE_VALGONO[lingua()] || DA_DOVE_VALGONO.it;
  box.appendChild(dove);

  const chiusura = document.createElement("p");
  chiusura.className = "chiusura";
  chiusura.textContent = m.chiusura;
  box.appendChild(chiusura);

  const azioni = document.createElement("div");
  azioni.className = "piede";

  const riprendi = document.createElement("button");
  riprendi.type = "button";
  riprendi.className = "secondario";
  riprendi.textContent = lingua() === "en" ? "Continue the test" : "Riprendi il test";
  riprendi.addEventListener("click", () => {
    app.className = "";
    disegna();
  });

  const esci = document.createElement("button");
  esci.type = "button";
  esci.className = "terziario";
  esci.textContent = lingua() === "en" ? "Close" : "Chiudi";
  esci.addEventListener("click", () => (location.href = "index.html"));

  azioni.append(riprendi, esci);
  box.appendChild(azioni);
  app.appendChild(box);
  window.scrollTo({ top: 0, behavior: "instant" });
}

// --- fine ---

function disegnaFine() {
  sessione.conclusa = true;
  salva(sessione);
  const app = $("#app");
  app.innerHTML = "";
  const box = document.createElement("section");
  box.className = "scheda";
  box.innerHTML =
    lingua() === "en"
      ? "<h1>Done</h1><p>All blocks answered. The profile is built entirely on this device.</p>"
      : "<h1>Finito</h1><p>Hai risposto a tutti i blocchi. Il profilo viene costruito qui sul dispositivo, senza mandare niente da nessuna parte.</p>";
  const vai = document.createElement("a");
  vai.className = "primario bottone";
  vai.href = "profilo.html";
  vai.textContent = lingua() === "en" ? "See the profile" : "Vedi il profilo";
  box.appendChild(vai);
  app.appendChild(box);
}

// --- tastiera: 1..5 per rispondere alla prima domanda senza risposta ---

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const n = Number(e.key);
  if (!Number.isInteger(n) || n < 1 || n > 9) return;
  const riga = [...document.querySelectorAll(".item")].find(
    (r) => !r.querySelector(".opzione.scelta")
  );
  if (!riga) return;
  const bottoni = riga.querySelectorAll(".opzione");
  if (n <= bottoni.length) {
    bottoni[n - 1].click();
    riga.scrollIntoView({ block: "center", behavior: "smooth" });
  }
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export { sessione, MODULI };
