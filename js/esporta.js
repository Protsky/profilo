// Portare via i dati in una forma che un programma sappia leggere.
//
// L'idea è che un domani si possa rianalizzare tutto da un'altra parte - uno
// script Python, R, un foglio di calcolo - senza dover avere questa app sotto
// mano. Per questo l'export è AUTODESCRITTIVO: non porta solo "bfas_042 = 4",
// che da solo non vuol dire niente, ma anche cos'è bfas_042, a che scala
// appartiene, se è invertito e come si chiama in italiano e in inglese.
//
// Tre formati, perché servono a tre cose diverse:
//
//   JSON completo   tutto: risposte, item, punteggi, validità, provenienza,
//                   soglie e licenze. È anche l'unico formato che si può
//                   RIMPORTARE nell'app, per riprendere il test su un altro
//                   dispositivo o dopo aver svuotato il browser.
//
//   CSV per item    una riga per domanda. È il formato "lungo" che pandas e R
//                   vogliono: leggilo e hai già tutto per ricalcolare le scale
//                   da zero, o per confrontare due somministrazioni.
//
//   CSV punteggi    una riga per scala, coi punteggi già fatti. Comodo per
//                   metterlo in un grafico senza rifare i conti.
//
// I CSV usano la virgola e le virgolette doppie standard (RFC 4180): Excel in
// italiano potrebbe volere il punto e virgola, ma pandas e R vogliono la
// virgola, e questi file nascono per quelli.

import { STRUMENTI, STRUMENTI_PER_ID, costruisci } from "./batteria.js";
import { punteggiStrumento, valoreItem } from "./punteggi.js";
import { verdetto } from "./validita.js";
import { NORME } from "./norme.js";

export const VERSIONE_BATTERIA = "1.0.0";

const AVVERTENZA =
  "Risposte a questionari di autovalutazione. NON sono una diagnosi e non sono " +
  "utilizzabili per idoneita', selezione del personale o certificazioni mediche. " +
  "Le scale marcate provenienza='ricostruito' hanno item formulati a memoria e " +
  "non confrontati con la fonte primaria: vanno verificati prima di dargli peso. " +
  "Nessuna scala ha una norma di popolazione caricata, quindi i punteggi sono " +
  "grezzi e non sono percentili.";

// --- il pacchetto completo ---

export function pacchetto(sessione) {
  const lista = costruisci(sessione.seme || 20260821);
  const ordine = lista.map((i) => i.id);

  const punteggi = [];
  for (const s of STRUMENTI) {
    punteggiStrumento(s, sessione.risposte, NORME)
      .filter(Boolean)
      .forEach((p) => punteggi.push(p));
  }

  const validita = verdetto({
    strumenti: STRUMENTI,
    strumentiPerId: STRUMENTI_PER_ID,
    risposte: sessione.risposte,
    tempi: sessione.tempi,
    ordine,
  });

  return {
    formato: "profilo/export",
    versioneFormato: 1,
    versioneBatteria: VERSIONE_BATTERIA,
    generato: new Date().toISOString(),
    avvertenza: AVVERTENZA,

    // Cosa è stato somministrato: basta questo per ricostruire tutto.
    strumenti: STRUMENTI.map((s) => ({
      id: s.id,
      nome: s.nome,
      fonte: s.fonte,
      licenza: s.licenza,
      provenienza: s.provenienza || null,
      traduzioneValidata: !!s.traduzioneValidata,
      scalaRisposta: { min: s.scala.min, max: s.scala.max, ancore: s.scala.ancore || null },
      scale: s.scale || null,
    })),

    item: lista
      .filter((i) => STRUMENTI_PER_ID[i.strumento])
      .map((i) => ({
        id: i.id,
        strumento: i.strumento,
        scala: i.scala,
        invertito: !!i.invertito,
        testo: i.testo,
        posizione: ordine.indexOf(i.id),
      })),

    // Quello che ha risposto la persona.
    risposte: sessione.risposte,
    disagio: sessione.disagio,
    tempiMs: sessione.tempi,
    ordineSomministrazione: ordine,

    // Quello che l'app ne ha ricavato, per poter confrontare un ricalcolo.
    punteggi,
    validita: {
      livello: validita.livello,
      peso: validita.peso,
      segnali: validita.segnali.map((x) => x.chiave),
      misure: validita.misure,
      profiloMostrabile: validita.mostraProfilo,
    },

    sessione: {
      iniziata: sessione.iniziata,
      ultimoSalvataggio: sessione.ultimoSalvataggio,
      conclusa: !!sessione.conclusa,
      lingua: sessione.lingua,
      seme: sessione.seme,
      risposteDate: Object.keys(sessione.risposte || {}).length,
      totaleItem: ordine.length,
    },
  };
}

// --- CSV ---

// RFC 4180: si racchiude fra virgolette e si raddoppiano quelle interne.
// Serve davvero: gli item contengono virgole, apostrofi e a volte virgolette.
function campo(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",;\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function riga(valori) {
  return valori.map(campo).join(",");
}

export function csvItem(sessione) {
  const lista = costruisci(sessione.seme || 20260821);
  const righe = [
    riga([
      "id_item", "strumento", "scala", "invertito", "posizione",
      "testo_it", "testo_en",
      "risposta_grezza", "valore_corretto", "disagio", "tempo_ms",
      "provenienza",
    ]),
  ];

  lista.forEach((it, pos) => {
    const s = STRUMENTI_PER_ID[it.strumento];
    if (!s) return; // controlli di attenzione e domanda di rischio: fuori
    const grezza = sessione.risposte[it.id];
    const corretto =
      grezza === undefined ? null : valoreItem(it, grezza, s.scala);
    righe.push(
      riga([
        it.id,
        it.strumento,
        it.scala,
        it.invertito ? 1 : 0,
        pos,
        (it.testo && it.testo.it) || "",
        (it.testo && it.testo.en) || "",
        grezza === undefined ? "" : grezza,
        corretto === null ? "" : corretto,
        sessione.disagio[it.id] === undefined ? "" : sessione.disagio[it.id],
        sessione.tempi[it.id] === undefined ? "" : sessione.tempi[it.id],
        s.provenienza || "",
      ])
    );
  });

  return righe.join("\r\n") + "\r\n";
}

export function csvPunteggi(sessione) {
  const righe = [
    riga([
      "strumento", "scala", "nome_scala",
      "somma", "media_item", "n_item", "n_risposti",
      "min_teorico", "max_teorico",
      "omega", "soglia", "sopra_soglia",
      "banda_da", "banda_a", "banda_stimata",
      "norma_mancante", "non_applicabile", "provenienza",
    ]),
  ];

  for (const s of STRUMENTI) {
    for (const p of punteggiStrumento(s, sessione.risposte, NORME)) {
      if (!p) continue;
      const def = (s.scale && s.scale[p.scala]) || {};
      // Il BFAS tiene i nomi leggibili in `aspetti`, non in `scale`: senza
      // questo ripiego la colonna nome_scala ripeteva la chiave.
      const aspetto = (s.aspetti && s.aspetti[p.scala]) || null;
      const nome =
        (def.nome && (def.nome.it || def.nome.en)) ||
        (aspetto && (aspetto.it || aspetto.en)) ||
        p.scala ||
        "";
      righe.push(
        riga([
          p.strumento || s.id,
          p.scala || "",
          nome,
          p.incompleta ? "" : p.somma,
          p.incompleta ? "" : (p.media !== undefined ? p.media.toFixed(4) : ""),
          p.nItem === undefined ? "" : p.nItem,
          p.nRisposti === undefined ? "" : p.nRisposti,
          p.intervallo ? p.intervallo[0] : "",
          p.intervallo ? p.intervallo[1] : "",
          p.omega === undefined ? "" : p.omega,
          p.soglia === undefined ? "" : p.soglia,
          p.sopraSoglia === undefined ? "" : (p.sopraSoglia ? 1 : 0),
          p.banda ? p.banda.da.toFixed(2) : "",
          p.banda ? p.banda.a.toFixed(2) : "",
          p.banda ? (p.banda.dsStimata ? 1 : 0) : "",
          p.normaMancante ? 1 : 0,
          p.nonApplicabile ? 1 : 0,
          s.provenienza || "",
        ])
      );
    }
  }

  return righe.join("\r\n") + "\r\n";
}

// --- nomi dei file ---

export function nomeFile(pezzo, estensione) {
  const oggi = new Date().toISOString().slice(0, 10);
  return "profilo-" + pezzo + "-" + oggi + "." + estensione;
}

// --- rilettura ---

// Accetta sia il pacchetto completo sia il vecchio export "sessione e basta":
// un file esportato sei mesi fa deve continuare a rientrare.
export function leggiPacchetto(testo) {
  const dati = JSON.parse(testo);

  if (dati && dati.formato === "profilo/export") {
    if (!dati.risposte || typeof dati.risposte !== "object") {
      throw new Error("Il file dice di essere un export del profilo ma non contiene risposte.");
    }
    return {
      risposte: dati.risposte,
      disagio: dati.disagio || {},
      tempi: dati.tempiMs || {},
      lingua: (dati.sessione && dati.sessione.lingua) || "it",
      seme: dati.sessione && dati.sessione.seme,
      iniziata: (dati.sessione && dati.sessione.iniziata) || null,
      conclusa: !!(dati.sessione && dati.sessione.conclusa),
      versioneBatteria: dati.versioneBatteria || null,
    };
  }

  const s = dati.sessione || dati;
  if (!s || typeof s.risposte !== "object") {
    throw new Error("Questo file non contiene una sessione del profilo.");
  }
  return {
    risposte: s.risposte,
    disagio: s.disagio || {},
    tempi: s.tempi || {},
    lingua: s.lingua || "it",
    seme: s.seme,
    iniziata: s.iniziata || null,
    conclusa: !!s.conclusa,
    versioneBatteria: null,
  };
}
