// Come si monta la batteria.
//
// L'ordine dei moduli è fisso e non è casuale: personalità prima, clinico dopo.
// Il motivo è che partire dalle domande su voci e umore mette addosso una
// cornice ("questo test cerca dei disturbi") che poi colora tutte le risposte
// successive. Partire dai Big Five, che non minacciano nessuno, lascia le scale
// cliniche più pulite.
//
// Dentro ogni strumento, invece, gli item vengono mescolati. Serve a rompere il
// blocco di dieci domande di fila sulla stessa cosa, che invita a rispondere
// "come prima" senza rileggere. Il mescolamento è deterministico, ricavato da un
// seme salvato nella sessione: se interrompi e riprendi, l'ordine è lo stesso.

import bfas from "./strumenti/bfas.js";
import pid5bf from "./strumenti/pid5bf.js";
import phq9 from "./strumenti/phq9.js";
import gad7 from "./strumenti/gad7.js";
import asrm from "./strumenti/asrm.js";
import mdq from "./strumenti/mdq.js";
import pq16 from "./strumenti/pq16.js";
import asrs5 from "./strumenti/asrs5.js";
import aq10 from "./strumenti/aq10.js";
import pcptsd5 from "./strumenti/pcptsd5.js";
import auditc from "./strumenti/auditc.js";
import isi from "./strumenti/isi.js";
import whodas12 from "./strumenti/whodas12.js";
import { CONTROLLI } from "./validita.js";
import { DOMANDA_DIRETTA } from "./sicurezza.js";

export const STRUMENTI = [
  bfas, pid5bf, phq9, gad7, asrm, mdq, pq16,
  asrs5, aq10, pcptsd5, auditc, isi, whodas12,
];

export const STRUMENTI_PER_ID = Object.fromEntries(STRUMENTI.map((s) => [s.id, s]));

// I moduli, nell'ordine in cui si somministrano.
export const MODULI = [
  {
    n: 1,
    chiave: "personalita",
    nome: { it: "Come sei di solito", en: "How you generally are" },
    sottotitolo: {
      it: "Cento frasi sui tratti di personalità. Nessuna riguarda disturbi: è la parte più lunga e la più leggera.",
      en: "One hundred statements about personality traits. None are about disorders.",
    },
    strumenti: ["bfas"],
    minuti: 15,
  },
  {
    n: 2,
    chiave: "tratti",
    nome: { it: "Il ponte fra i due mondi", en: "The bridge between the two" },
    sottotitolo: {
      it: "Venticinque frasi sui cinque tratti di DSM-5 e ICD-11. Stanno esattamente in mezzo fra «come sei» e «cosa ti succede» — compreso il Psicoticismo, che è il modo in cui la psichiatria di oggi tratta il terreno psicotico come continuo invece che come categoria.",
      en: "Twenty-five statements on the five DSM-5 / ICD-11 trait domains, including Psychoticism.",
    },
    strumenti: ["pid5bf"],
    minuti: 5,
  },
  {
    n: 5,
    chiave: "umore",
    nome: { it: "Umore ed energia", en: "Mood and energy" },
    sottotitolo: {
      it: "Come sono andate le ultime due settimane, e se c'è mai stato un periodo diverso dal tuo solito.",
      en: "The past two weeks, and whether there has ever been a period unlike your usual self.",
    },
    strumenti: ["phq9", "asrm", "mdq"],
    minuti: 8,
  },
  {
    n: 4,
    chiave: "esperienze",
    nome: { it: "Esperienze insolite", en: "Unusual experiences" },
    sottotitolo: {
      it: "Cose che capitano a molte più persone di quante si creda, e che quasi mai vogliono dire quello che si teme.",
      en: "Experiences far more common than people assume.",
    },
    strumenti: ["pq16"],
    minuti: 5,
  },
  {
    n: 6,
    chiave: "contesto",
    nome: { it: "Le spiegazioni alternative", en: "The alternative explanations" },
    sottotitolo: {
      it: "Ansia, attenzione, stile sociale, eventi difficili, alcol, sonno. Serve a non attribuire alla cosa sbagliata quello che si vede negli altri moduli: sono tutte cose che imitano mania e psicosi, e che vengono saltate quasi sempre.",
      en: "Anxiety, attention, social style, difficult events, alcohol, sleep. These all imitate mania and psychosis, and are almost always skipped.",
    },
    strumenti: ["gad7", "asrs5", "aq10", "pcptsd5", "auditc", "isi"],
    minuti: 10,
  },
  {
    n: 7,
    chiave: "funzionamento",
    nome: { it: "Come va la giornata", en: "How the day goes" },
    sottotitolo: {
      it: "Un tratto senza compromissione non è un disturbo. È la riga che separa un modo di essere da qualcosa che merita un nome clinico, ed è quella che i test online saltano sempre.",
      en: "A trait without impairment is not a disorder. This is the line online tests always skip.",
    },
    strumenti: ["whodas12"],
    minuti: 4,
  },
];

// Generatore deterministico: stesso seme, stesso ordine.
function rng(seme) {
  let a = seme >>> 0;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mescola(array, casuale) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(casuale() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Gli item di attenzione, vestiti come item della scala su cui cadono, così
// non si riconoscono a colpo d'occhio.
function itemAttenzione(c) {
  return {
    id: c.id,
    scala: "attenzione",
    strumento: "validita",
    invertito: false,
    controllo: true,
    testo: c.testo,
    scalaRisposta: bfas.scala,
  };
}

// Costruisce la lista completa delle domande, in ordine di somministrazione.
// La domanda diretta sul rischio va per prima, sempre, prima di qualunque
// altra cosa: se qualcosa non va, è inutile far compilare quattrocento item
// per accorgersene alla fine.
export function costruisci(seme = 20260821) {
  const casuale = rng(seme);
  const lista = [];

  lista.push({
    ...DOMANDA_DIRETTA,
    strumento: "sicurezza",
    modulo: 0,
    scalaRisposta: null,
  });

  const posizioniControlli = [];
  for (const modulo of MODULI) {
    for (const idStrumento of modulo.strumenti) {
      const s = STRUMENTI_PER_ID[idStrumento];
      if (!s) continue;
      // MDQ ha un ordine che conta (i 13 sintomi, poi Q2, poi Q3): non si mescola.
      const item = s.id === "mdq" ? s.item : mescola(s.item, casuale);
      for (const it of item) {
        lista.push({
          ...it,
          strumento: s.id,
          modulo: modulo.n,
          moduloChiave: modulo.chiave,
          scalaRisposta: it.tipo === "frasi" || it.tipo === "scelta" ? null : s.scala,
        });
      }
    }
  }

  // Quattro controlli di attenzione, distribuiti nella metà lunga della
  // batteria (dentro il BFAS, dove la monotonia morde davvero).
  const indiciBfas = lista
    .map((x, i) => (x.strumento === "bfas" ? i : -1))
    .filter((i) => i >= 0);
  if (indiciBfas.length >= CONTROLLI.length) {
    const passo = Math.floor(indiciBfas.length / (CONTROLLI.length + 1));
    CONTROLLI.forEach((c, k) => {
      posizioniControlli.push(indiciBfas[passo * (k + 1)] + k);
    });
    posizioniControlli.forEach((pos, k) => {
      lista.splice(pos, 0, {
        ...itemAttenzione(CONTROLLI[k]),
        modulo: 1,
        moduloChiave: "personalita",
      });
    });
  }

  return lista;
}

// Blocchi da mostrare uno alla volta: si risponde, si tira il fiato, si salva.
export function inBlocchi(lista, perBlocco = 10) {
  const blocchi = [];
  let corrente = [];
  let moduloCorrente = null;
  for (const item of lista) {
    // Non si mischiano moduli nello stesso blocco: la consegna cambia.
    if (moduloCorrente !== null && item.modulo !== moduloCorrente) {
      if (corrente.length) blocchi.push({ modulo: moduloCorrente, item: corrente });
      corrente = [];
    }
    moduloCorrente = item.modulo;
    corrente.push(item);
    if (corrente.length >= perBlocco) {
      blocchi.push({ modulo: moduloCorrente, item: corrente });
      corrente = [];
    }
  }
  if (corrente.length) blocchi.push({ modulo: moduloCorrente, item: corrente });
  return blocchi;
}

// Domande che compaiono solo se ne ha senso: la Q2 dell'MDQ senza almeno due
// sintomi non vuol dire niente, e le cinque domande sul dopo-evento non hanno
// oggetto se un evento non c'è stato. Chiederle lo stesso non è neutro: mette
// in bocca un contenuto che la persona non ha portato.
export function condizioneSoddisfatta(item, risposte) {
  const c = item.soloSe;
  if (!c) return true;
  if (c.item !== undefined) {
    return Number(risposte[c.item]) === Number(c.vale);
  }
  if (c.scala !== undefined) {
    const s = STRUMENTI_PER_ID[item.strumento];
    if (!s) return true;
    const quanti = s.item
      .filter((i) => i.scala === c.scala)
      .reduce((acc, i) => acc + (Number(risposte[i.id]) > 0 ? 1 : 0), 0);
    return quanti >= c.almeno;
  }
  return true;
}

// Gli id che, cambiando, cambiano quali domande si vedono.
export function controllori(item) {
  const ids = new Set();
  for (const it of item) {
    if (it.soloSe && it.soloSe.item) ids.add(it.soloSe.item);
    if (it.soloSe && it.soloSe.scala) {
      const s = STRUMENTI_PER_ID[it.strumento];
      if (s) s.item.filter((x) => x.scala === it.soloSe.scala).forEach((x) => ids.add(x.id));
    }
  }
  return ids;
}

export function moduloDi(n) {
  return MODULI.find((m) => m.n === n) || null;
}

// Quanti item in tutto, per dirlo prima di cominciare invece che dopo.
export function conteggio() {
  const lista = costruisci();
  const perModulo = {};
  for (const it of lista) {
    perModulo[it.modulo] = (perModulo[it.modulo] || 0) + 1;
  }
  return { totale: lista.length, perModulo };
}
