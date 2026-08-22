// La pagina del risultato. Mette insieme punteggi, validità e referto, e
// decide cosa si può mostrare.
//
// L'ordine non è casuale: prima il verdetto sulla validità, poi la cornice,
// poi la personalità, poi le scale cliniche, e i limiti in fondo ma prima
// dell'esportazione. Se la validità dice che il protocollo non regge, la
// pagina si ferma al primo blocco e i punteggi non vengono nemmeno disegnati.

import { STRUMENTI, STRUMENTI_PER_ID, costruisci } from "./batteria.js";
import { carica } from "./storage.js";
import * as storage from "./storage.js";
import { punteggiStrumento, profiloRelativo } from "./punteggi.js";
import { verdetto } from "./validita.js";
import * as grafici from "./grafici.js";
import * as referto from "./referto.js";
import { controlla, CONTATTI, messaggio, DA_DOVE_VALGONO } from "./sicurezza.js";
import { NORME } from "./norme.js";
import * as esporta from "./esporta.js";
import bfas from "./strumenti/bfas.js";
import pid5bf from "./strumenti/pid5bf.js";
import mdq from "./strumenti/mdq.js";

const app = document.querySelector("#app");
const sessione = carica();
const lingua = sessione.lingua || "it";

function t(o) {
  if (!o) return "";
  return o[lingua] || o.it || "";
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function scheda(titolo, classe = "") {
  const s = document.createElement("section");
  s.className = "scheda " + classe;
  if (titolo) {
    const h = document.createElement("h2");
    h.textContent = titolo;
    s.appendChild(h);
  }
  return s;
}

function p(testo, classe = "") {
  const e = document.createElement("p");
  if (classe) e.className = classe;
  e.textContent = testo;
  return e;
}

// --- se non c'è niente ---

if (!Object.keys(sessione.risposte).length) {
  app.innerHTML = "";
  const s = scheda(lingua === "en" ? "Nothing to show yet" : "Non c'è ancora niente");
  s.appendChild(
    p(
      lingua === "en"
        ? "No answers are stored on this device."
        : "Su questo dispositivo non ci sono risposte salvate."
    )
  );
  const a = document.createElement("a");
  a.className = "primario bottone";
  a.href = "index.html";
  a.textContent = lingua === "en" ? "Back to the start" : "Torna all'inizio";
  s.appendChild(a);
  app.innerHTML = "";
  app.appendChild(s);
} else {
  disegna();
}

function disegna() {
  app.innerHTML = "";
  const lista = costruisci(sessione.seme || 20260821);
  const ordine = lista.map((i) => i.id);

  // 1. Sicurezza, sempre per prima se è scattata.
  const rischio = controlla(sessione.risposte);
  if (rischio) {
    app.appendChild(blocoSicurezza(rischio));
  }

  // 2. Validità.
  const v = verdetto({
    strumenti: STRUMENTI,
    strumentiPerId: STRUMENTI_PER_ID,
    risposte: sessione.risposte,
    tempi: sessione.tempi,
    ordine,
  });
  app.appendChild(bloccoValidita(v));

  // 3. Cappello.
  const cappello = scheda(null, "cornice");
  cappello.appendChild(p(referto.cappello(v, lingua)));
  app.appendChild(cappello);

  if (!v.mostraProfilo) {
    app.appendChild(bloccoLimiti());
    app.appendChild(bloccoEsportazione());
    return; // i punteggi non si disegnano nemmeno
  }

  // 4. Punteggi.
  const tutti = [];
  for (const s of STRUMENTI) {
    tutti.push(...punteggiStrumento(s, sessione.risposte, NORME).filter(Boolean));
  }

  app.appendChild(bloccoPersonalita(tutti));
  app.appendChild(bloccoTratti(tutti));
  app.appendChild(bloccoCliniche(tutti));
  app.appendChild(bloccoMdq());

  // 5. Segnalazioni con il loro valore predittivo.
  const seg = referto.segnalazioni(tutti, lingua);
  app.appendChild(bloccoSegnalazioni(seg));

  // 6. Limiti ed esportazione.
  app.appendChild(bloccoLimiti());
  app.appendChild(bloccoEsportazione());
}

// --- blocchi ---

function blocoSicurezza(rischio) {
  const m = messaggio(rischio, lingua);
  const s = document.createElement("section");
  s.className = "scheda-sicurezza";
  s.innerHTML = "<h2>" + esc(m.titolo) + "</h2>";
  s.appendChild(p(m.corpo, "corpo"));
  const ul = document.createElement("ul");
  ul.className = "contatti";
  CONTATTI.forEach((c) => {
    const li = document.createElement("li");
    li.innerHTML =
      "<a class='numero' href='tel:" + c.numero.replace(/\s/g, "") + "'>" + esc(c.numero) + "</a>" +
      "<span class='chi'>" + esc(t(c.nome)) + "</span>" +
      "<span class='quando'>" + esc(t(c.quando)) + "</span>";
    ul.appendChild(li);
  });
  s.appendChild(ul);
  s.appendChild(p(DA_DOVE_VALGONO[lingua] || DA_DOVE_VALGONO.it, "minore"));
  return s;
}

function bloccoValidita(v) {
  const s = document.createElement("section");
  s.className = "verdetto-validita " + v.livello;
  const titoli = {
    it: {
      attendibile: "I controlli di coerenza sono a posto",
      cautela: "Qualche controllo di coerenza è venuto storto",
      "non-interpretabile": "Questo protocollo non regge un profilo",
    },
    en: {
      attendibile: "Consistency checks passed",
      cautela: "Some consistency checks came back odd",
      "non-interpretabile": "This protocol cannot carry a profile",
    },
  };
  const h = document.createElement("h2");
  h.textContent = titoli[lingua] ? titoli[lingua][v.livello] : titoli.it[v.livello];
  s.appendChild(h);

  if (v.segnali.length) {
    const ul = document.createElement("ul");
    v.segnali.forEach((x) => {
      const li = document.createElement("li");
      li.textContent = x[lingua] || x.it;
      ul.appendChild(li);
    });
    s.appendChild(ul);
  } else {
    s.appendChild(
      p(
        lingua === "en"
          ? "Long-string, split-half consistency, attention checks, near-identical item pairs, response time and scale use: none of them flagged anything."
          : "Risposte identiche di fila, coerenza fra metà delle scale, controlli di attenzione, coppie di domande quasi uguali, tempo per domanda e uso della scala: nessuno ha segnalato niente.",
        "minore"
      )
    );
  }

  const det = document.createElement("details");
  det.innerHTML = "<summary>" + (lingua === "en" ? "The numbers behind this" : "I numeri dietro a questo") + "</summary>";
  const m = v.misure;
  const righe = [
    [lingua === "en" ? "Longest identical run" : "Risposte identiche di fila", m.longString],
    [lingua === "en" ? "Split-half consistency" : "Coerenza fra metà scale", m.coerenza === null ? "-" : m.coerenza.toFixed(2)],
    [lingua === "en" ? "Attention checks failed" : "Controlli di attenzione sbagliati", m.attenzione.sbagliati + "/" + m.attenzione.risposti],
    [lingua === "en" ? "Median time per question" : "Tempo mediano per domanda", m.tempoMediano === null ? "-" : (m.tempoMediano / 1000).toFixed(1) + " s"],
    [lingua === "en" ? "Near-identical pairs, mean gap" : "Coppie quasi uguali, scarto medio", m.coppie ? m.coppie.medio.toFixed(2) : "-"],
    [lingua === "en" ? "Different values used" : "Valori diversi usati", m.varieta ? m.varieta.valoriDiversi : "-"],
  ];
  const tab = document.createElement("table");
  tab.className = "conto-predittivo";
  righe.forEach(([a, b]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + esc(a) + "</td><td>" + esc(String(b)) + "</td>";
    tab.appendChild(tr);
  });
  det.appendChild(tab);
  det.appendChild(
    p(
      lingua === "en"
        ? "Mahalanobis distance is deliberately absent: it measures how odd one person's pattern is against a sample covariance matrix, and with a single respondent there is no sample."
        : "La distanza di Mahalanobis non c'è di proposito: misura quanto il pattern di una persona è anomalo rispetto alla covarianza di un campione, e con un rispondente solo non esiste nessun campione.",
      "minore"
    )
  );
  s.appendChild(det);
  return s;
}

function bloccoPersonalita(tutti) {
  const s = scheda(lingua === "en" ? "How you generally are" : "Come sei di solito");
  const aspetti = tutti.filter((x) => x.strumento === "bfas");
  if (!aspetti.length) {
    s.appendChild(p(lingua === "en" ? "Not answered." : "Non compilato.", "minore"));
    return s;
  }

  s.appendChild(
    p(
      lingua === "en"
        ? "There is no published norm loaded for this scale, so this is not a position in the population. It is a comparison inside you: which of your ten aspects sit higher and which lower, relative to your own average."
        : "Per questa scala non è caricata nessuna norma pubblicata, quindi questo non è un posto nella popolazione. È un confronto dentro di te: quali dei tuoi dieci aspetti stanno più in alto e quali più in basso, rispetto alla tua media.",
      "minore"
    )
  );

  const conZ = profiloRelativo(aspetti);
  const svg = grafici.profiloRelativo(conZ, {
    etichetta: (x) => {
      const a = bfas.aspetti[x.scala];
      return a ? a[lingua] || a.it : x.scala;
    },
  });
  if (svg) s.appendChild(svg);

  // Dettaglio numerico per chi lo vuole.
  const det = document.createElement("details");
  det.innerHTML = "<summary>" + (lingua === "en" ? "Aspect by aspect" : "Aspetto per aspetto") + "</summary>";
  conZ
    .slice()
    .sort((a, b) => (b.zRelativo || 0) - (a.zRelativo || 0))
    .forEach((x) => {
      const a = bfas.aspetti[x.scala];
      const d = document.createElement("div");
      d.className = "dimensione";
      const nome = a ? a[lingua] || a.it : x.scala;
      const dominio = a && bfas.domini[a.dominio] ? bfas.domini[a.dominio][lingua] || bfas.domini[a.dominio].it : "";
      d.innerHTML =
        "<div class='dimensione-titolo'><h3>" + esc(nome) + "</h3>" +
        "<span class='dimensione-valore'>" + Math.round(x.somma) + "/" + x.intervallo[1] + "</span></div>" +
        "<p class='minore'>" + esc(dominio) + "</p>";
      const banda = document.createElement("div");
      banda.className = "banda";
      banda.appendChild(
        grafici.bandaOrizzontale({
          valore: x.somma,
          banda: x.banda,
          intervallo: x.intervallo,
        })
      );
      d.appendChild(banda);
      det.appendChild(d);
    });
  s.appendChild(det);
  return s;
}

function bloccoTratti(tutti) {
  const s = scheda(lingua === "en" ? "The bridge between the two" : "Il ponte fra i due mondi");
  const tratti = tutti.filter((x) => x.strumento === "pid5bf" && !x.incompleta);
  if (!tratti.length) {
    s.appendChild(p(lingua === "en" ? "Not answered." : "Non compilato.", "minore"));
    return s;
  }

  s.appendChild(
    p(
      lingua === "en"
        ? "Five trait domains from DSM-5 and ICD-11. These have no cutoff on purpose: they are dimensions, not categories. Putting a threshold where the authors put none would turn one into the other, which is the very thing this model exists to avoid."
        : "I cinque domini di tratto di DSM-5 e ICD-11. Non hanno una soglia, ed è voluto: sono dimensioni, non categorie. Mettere un taglio dove gli autori non lo mettono trasformerebbe le une nelle altre, che è esattamente la cosa che questo modello è nato per non fare."
    )
  );
  s.appendChild(
    p(
      lingua === "en"
        ? "Items reconstructed, not checked against the APA sheet: indicative only."
        : "Item ricostruiti e non confrontati con la scheda APA: valgono come indicazione, non come misura.",
      "avviso-ricostruito"
    )
  );
  s.appendChild(grafici.legenda(lingua));

  tratti.forEach((x) => {
    const nome = pid5bf.domini[x.scala];
    const box = document.createElement("div");
    box.className = "dimensione";
    box.innerHTML =
      "<div class='dimensione-titolo'><h3>" +
      esc(nome ? nome[lingua] || nome.it : x.scala) +
      "</h3><span class='dimensione-valore'>" + Math.round(x.somma) + "/15</span></div>";
    const banda = document.createElement("div");
    banda.className = "banda";
    banda.appendChild(
      grafici.bandaOrizzontale({ valore: x.somma, banda: x.banda, intervallo: x.intervallo })
    );
    box.appendChild(banda);
    if (x.scala === "psicoticismo") {
      box.appendChild(
        p(
          lingua === "en"
            ? "This is the domain that carries the psychotic terrain as a continuum rather than a category - the same idea the HiTOP model takes further. A raised score here is not a psychosis: it is a position on an axis that everyone sits somewhere on."
            : "È il dominio che tiene il terreno psicotico come continuo invece che come categoria — la stessa idea che il modello HiTOP porta più avanti. Un punteggio alto qui non è una psicosi: è una posizione su un asse su cui tutti stanno da qualche parte.",
          "dimensione-nota"
        )
      );
    }
    s.appendChild(box);
  });
  return s;
}

function bloccoCliniche(tutti) {
  const s = scheda(lingua === "en" ? "The clinical scales" : "Le scale cliniche");
  const cliniche = tutti.filter((x) => x.strumento !== "bfas" && x.strumento !== "pid5bf");
  if (!cliniche.length) {
    s.appendChild(p(lingua === "en" ? "Not answered." : "Non compilate.", "minore"));
    return s;
  }
  // Le due avvertenze che valgono per tutte le scale, dette una volta qui
  // invece che dieci volte identiche più sotto.
  s.appendChild(
    p(
      lingua === "en"
        ? "Below cutoff does not mean nothing is there. It means this questionnaire, which sees little, did not see anything. Poor insight, negative symptoms and mixed states escape it almost entirely, so a low score never overrules what you actually feel."
        : "Sotto soglia non vuol dire che non c'è niente. Vuol dire che questo questionario, che vede poco, non ha visto. Scarso insight, sintomi negativi e stati misti gli sfuggono quasi del tutto: un punteggio basso non conta mai più di quello che senti."
    )
  );
  s.appendChild(
    p(
      lingua === "en"
        ? "None of these scales has a published norm loaded, so none of the numbers is a percentile: each is a raw score on its own range, not a position in the population. Every one carries its measurement error band, estimated from your own answers and therefore rough."
        : "Per nessuna di queste scale è caricata una norma pubblicata, quindi nessuno di questi numeri è un percentile: sono punteggi grezzi sul proprio intervallo, non posizioni nella popolazione. Ognuno si porta dietro la sua banda d'errore, stimata dalle tue stesse risposte e quindi grossolana.",
      "minore"
    )
  );
  s.appendChild(grafici.legenda(lingua));

  cliniche.forEach((x) => {
    const strumento = STRUMENTI_PER_ID[x.strumento];
    if (!strumento) return; // scala orfana: meglio saltarla che rompere la pagina
    const def = strumento.scale ? strumento.scale[x.scala] : null;
    const d = referto.descriviDimensione(x, def, lingua, { conciso: true });

    const box = document.createElement("div");
    box.className = "dimensione";
    box.innerHTML =
      "<div class='dimensione-titolo'><h3>" + esc(d.titolo) + "</h3>" +
      (x.incompleta ? "" : "<span class='dimensione-valore'>" + Math.round(x.somma) + "/" + x.intervallo[1] + "</span>") +
      "</div>";

    if (strumento.provenienza === "ricostruito") {
      box.appendChild(
        p(
          lingua === "en"
            ? "Items reconstructed, not checked against the source: indicative only."
            : "Item ricostruiti e non confrontati con la fonte: vale come indicazione, non come misura.",
          "avviso-ricostruito"
        )
      );
    }

    if (!x.incompleta) {
      const banda = document.createElement("div");
      banda.className = "banda";
      banda.appendChild(
        grafici.bandaOrizzontale({
          valore: x.somma,
          banda: x.banda,
          intervallo: x.intervallo,
          soglia: x.soglia,
        })
      );
      box.appendChild(banda);
    }

    box.appendChild(p(d.descrittivo));
    if (d.contesto) box.appendChild(p(d.contesto, "dimensione-nota"));
    if (d.azione) box.appendChild(p(d.azione, "dimensione-azione"));
    // La nota sulla soglia è il punto in cui ogni scala dice quanto vale
    // davvero. Sopra soglia va letta subito; sotto soglia resta a portata di
    // clic invece di allungare la pagina per tutte.
    if (def && def.notaSoglia) {
      if (x.sopraSoglia) {
        box.appendChild(p(t(def.notaSoglia), "minore"));
      } else {
        const det = document.createElement("details");
        det.innerHTML =
          "<summary>" +
          (lingua === "en" ? "About this scale's cutoff" : "Sulla soglia di questa scala") +
          "</summary>";
        det.appendChild(p(t(def.notaSoglia), "minore"));
        box.appendChild(det);
      }
    }

    s.appendChild(box);
  });
  return s;
}

function bloccoMdq() {
  const s = scheda(lingua === "en" ? "MDQ: the three conditions" : "MDQ: le tre condizioni");
  const r = mdq.valuta(sessione.risposte);

  s.appendChild(
    p(
      lingua === "en"
        ? "The MDQ is positive only if all three hold at once. Most online versions ask only the first, which is why they flag almost everyone."
        : "L'MDQ è positivo solo se valgono tutte e tre insieme. Quasi tutte le versioni online chiedono solo la prima, ed è per questo che segnalano quasi chiunque.",
      "minore"
    )
  );

  const righe = [
    [
      lingua === "en" ? "1. Seven or more symptoms" : "1. Sette o più sintomi",
      r.sintomi + "/13",
      r.sintomi >= 7,
    ],
    [
      lingua === "en" ? "2. Several in the same period" : "2. Diversi nello stesso periodo",
      r.q2 ? (lingua === "en" ? "yes" : "sì") : (lingua === "en" ? "no" : "no"),
      r.q2,
    ],
    [
      lingua === "en" ? "3. Moderate or serious problem" : "3. Problema moderato o serio",
      String(r.q3) + "/3",
      r.q3 >= 2,
    ],
  ];

  const tab = document.createElement("table");
  tab.className = "conto-predittivo";
  righe.forEach(([a, b, ok]) => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + esc(a) + "</td><td>" + esc(b) + " " + (ok ? "&check;" : "&mdash;") + "</td>";
    tab.appendChild(tr);
  });
  s.appendChild(tab);
  s.appendChild(p(t(r.motivo)));
  return s;
}

function bloccoSegnalazioni(seg) {
  const s = scheda(lingua === "en" ? "What came back above cutoff" : "Cosa è tornato sopra soglia");

  if (!seg.length) {
    // Regola 2 del referto: non è una rassicurazione, e si scrive così.
    s.appendChild(
      p(
        lingua === "en"
          ? "None of the scales came back above its cutoff. That is worth exactly what these questionnaires can see, which is not much: they miss poor insight, negative symptoms and mixed states almost entirely. If something is weighing on you, this page does not overrule it."
          : "Nessuna delle scale è tornata sopra la propria soglia. Questo vale esattamente quanto questi questionari riescono a vedere, che non è molto: scarso insight, sintomi negativi e stati misti gli sfuggono quasi del tutto. Se c'è qualcosa che ti pesa, questa pagina non conta più di quello."
      )
    );
    return s;
  }

  seg.forEach((x) => {
    const box = document.createElement("div");
    box.className = "dimensione";
    box.innerHTML =
      "<div class='dimensione-titolo'><h3>" + esc(x.strumento.toUpperCase()) + "</h3>" +
      "<span class='dimensione-valore'>" + Math.round(x.punteggio) + " &ge; " + x.soglia + "</span></div>";

    if (x.predittivo) {
      box.appendChild(p(x.predittivo));
      if (x.conto) {
        const det = document.createElement("details");
        det.innerHTML = "<summary>" + (lingua === "en" ? "Where that number comes from" : "Da dove viene quel numero") + "</summary>";
        const tab = document.createElement("table");
        tab.className = "conto-predittivo";
        x.conto.righe.forEach(([a, b]) => {
          const tr = document.createElement("tr");
          tr.innerHTML = "<td>" + esc(a) + "</td><td>" + esc(String(b)) + "</td>";
          tab.appendChild(tr);
        });
        det.appendChild(tab);
        det.appendChild(p(x.conto.fonte, "minore"));
        box.appendChild(det);
      }
    }
    s.appendChild(box);
  });
  return s;
}

function bloccoLimiti() {
  const s = scheda(
    lingua === "en" ? "What this test cannot see" : "Cosa questo test non può vedere",
    "limiti"
  );
  const ul = document.createElement("ul");
  referto.limiti(lingua).forEach((x) => {
    const li = document.createElement("li");
    li.textContent = x;
    ul.appendChild(li);
  });
  s.appendChild(ul);
  return s;
}

function bloccoEsportazione() {
  const s = scheda(lingua === "en" ? "Take it with you" : "Portarlo via");
  s.appendChild(
    p(
      lingua === "en"
        ? "Everything is on this device only. These files are the way out: to keep them, to move to another device, or to re-analyse the answers elsewhere."
        : "È tutto solo su questo dispositivo. Questi file sono la via d'uscita: per conservarli, per passare a un altro dispositivo, o per rianalizzare le risposte altrove.",
      "minore"
    )
  );

  const formati = [
    {
      etichetta: { it: "JSON completo", en: "Full JSON" },
      spiega: {
        it: "Tutto: risposte, testo delle domande, punteggi, indici di validità, soglie e fonti. Si descrive da sé, quindi si rianalizza senza bisogno di questa app. È anche l'unico file che si può rimettere dentro, dalla pagina iniziale.",
        en: "Everything, self-describing. Also the only file that can be imported back.",
      },
      classe: "primario",
      fai: () => storage.scarica(esporta.nomeFile("completo", "json"),
                                 JSON.stringify(esporta.pacchetto(sessione), null, 2)),
    },
    {
      etichetta: { it: "CSV, una riga per domanda", en: "CSV, one row per item" },
      spiega: {
        it: "Il formato lungo che vogliono pandas e R: id, scala, se è invertito, testo, risposta grezza, valore già raddrizzato, tempo impiegato. Da qui si ricalcola tutto da zero.",
        en: "The long format pandas and R want.",
      },
      classe: "secondario",
      fai: () => storage.scarica(esporta.nomeFile("item", "csv"),
                                 esporta.csvItem(sessione), "text/csv"),
    },
    {
      etichetta: { it: "CSV, una riga per scala", en: "CSV, one row per scale" },
      spiega: {
        it: "I punteggi già fatti, con banda d'errore e soglia: comodo per un grafico senza rifare i conti.",
        en: "Scores already computed, with error band and cutoff.",
      },
      classe: "secondario",
      fai: () => storage.scarica(esporta.nomeFile("punteggi", "csv"),
                                 esporta.csvPunteggi(sessione), "text/csv"),
    },
  ];

  formati.forEach((f) => {
    const b = document.createElement("button");
    b.className = f.classe;
    b.textContent = f.etichetta[lingua] || f.etichetta.it;
    b.addEventListener("click", f.fai);
    s.appendChild(b);
    s.appendChild(p(f.spiega[lingua] || f.spiega.it, "minore"));
  });

  const stampa = document.createElement("button");
  stampa.className = "terziario";
  stampa.textContent = lingua === "en" ? "Print / save as PDF" : "Stampa o salva in PDF";
  stampa.addEventListener("click", () => window.print());
  s.appendChild(stampa);

  const casa = document.createElement("a");
  casa.className = "terziario bottone";
  casa.href = "index.html";
  casa.textContent = lingua === "en" ? "Back to the start" : "Torna all'inizio";
  s.appendChild(casa);
  return s;
}
