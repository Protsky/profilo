// Quanto vale questo protocollo?
//
// Un questionario compilato a caso produce comunque un profilo bello pieno di
// grafici. Questi indici servono a sapere se quel profilo va guardato o
// buttato. La letteratura 2023-2025 è concorde su un punto: un indicatore solo
// non basta, perché ciascuno pesca respondenti diversi. Vanno combinati.
//
// UNA COSA CHE NON C'È, E PERCHÉ. Il piano prevedeva anche la distanza di
// Mahalanobis, che è l'indice più citato per il careless responding. Qui non
// c'è: Mahalanobis misura quanto il pattern di una persona è anomalo rispetto
// alla MATRICE DI COVARIANZA DEL CAMPIONE. Con un solo rispondente non esiste
// nessun campione e nessuna covarianza da stimare. Implementarlo su una persona
// sola vorrebbe dire calcolare una distanza da sé stessi, che è zero per
// costruzione. Al suo posto ci sono gli indici che funzionano su un protocollo
// singolo: coerenza interna, coppie sinonimo/antonimo, controlli di attenzione.

export const SOGLIE = {
  longString: 12,        // risposte identiche di fila
  tempoPerItemMs: 1500,  // media sotto la quale non si è letto
  coerenzaMin: 0.3,      // correlazione pari-dispari minima accettabile
  antonimiMax: 1.5,      // scarto medio massimo sulle coppie opposte
  attenzioneMax: 1,      // quanti controlli si possono sbagliare
};

// --- 1. Long string: la colonna di risposte tutte uguali ---
//
// Conta SOLO gli item a scala larga (Likert a 4 o piu punti). Gli item si/no
// sono esclusi di proposito: su una lista di sintomi come il PQ-16, rispondere
// "No" sedici volte di fila non e disattenzione, e la risposta piu comune e
// piu sana che ci sia. Contarla come long-string vorrebbe dire rifiutare il
// profilo proprio alle persone che stanno bene - che e' l'errore opposto a
// quello per cui l'indice esiste.
export function longString(ordine, risposte, ammessi = null) {
  let max = 0;
  let corrente = 0;
  let precedente = Symbol("nessuna");
  for (const id of ordine) {
    if (ammessi && !ammessi.has(id)) {
      // Un item non ammesso spezza la catena invece di continuarla: due blocchi
      // Likert separati da un questionario si/no non sono una colonna sola.
      corrente = 0;
      precedente = Symbol("nessuna");
      continue;
    }
    const v = risposte[id];
    if (v === undefined || v === null) {
      corrente = 0;
      precedente = Symbol("nessuna");
      continue;
    }
    if (v === precedente) {
      corrente++;
    } else {
      corrente = 1;
      precedente = v;
    }
    if (corrente > max) max = corrente;
  }
  return max;
}

// --- 2. Coerenza pari-dispari: si spacca ogni scala a metà e si guarda se le
// due metà raccontano la stessa cosa. Chi risponde a caso ha due metà scollegate.
export function coerenzaPariDispari(strumenti, risposte) {
  const pari = [];
  const dispari = [];
  for (const s of strumenti) {
    const perScala = {};
    s.item.forEach((it) => {
      (perScala[it.scala] = perScala[it.scala] || []).push(it);
    });
    for (const chiave of Object.keys(perScala)) {
      const item = perScala[chiave];
      if (item.length < 4) continue; // troppo corta per spaccarla
      const a = [];
      const b = [];
      item.forEach((it, i) => {
        const v = valore(it, risposte[it.id], s.scala);
        if (v === null) return;
        (i % 2 === 0 ? a : b).push(v);
      });
      if (a.length < 2 || b.length < 2) continue;
      pari.push(media(a));
      dispari.push(media(b));
    }
  }
  if (pari.length < 3) return null; // niente su cui pronunciarsi
  return correlazione(pari, dispari);
}

// --- 3. Coppie sinonimo/antonimo: item che dicono quasi la stessa cosa (o
// l'opposto) sparsi lontani nella batteria. Se le risposte non si accordano,
// qualcosa non torna.
// Sono coppie fra item reali della batteria: non aggiungono domande.
export const COPPIE = [
  // [id A, id B, atteso: "uguale" | "opposto"]
  ["bfas_001", "bfas_009", "uguale"],   // mi arrabbio facilmente / mi agito facilmente
  ["bfas_002", "bfas_008", "uguale"],   // mi irrito raramente / non mi infastidisco facilmente
  ["bfas_042", "bfas_045", "opposto"],  // perdo tempo / finisco quello che comincio
  ["bfas_052", "bfas_053", "uguale"],   // mi piace l'ordine / tengo le cose in ordine
  ["bfas_061", "bfas_062", "opposto"],  // faccio amicizia facilmente / sono difficile da conoscere
  ["bfas_071", "bfas_080", "opposto"],  // prendo in mano la situazione / non ho una personalità assertiva
];

export function scartoCoppie(strumentiPerId, risposte) {
  const scarti = [];
  for (const [a, b, atteso] of COPPIE) {
    const ia = trovaItem(strumentiPerId, a);
    const ib = trovaItem(strumentiPerId, b);
    if (!ia || !ib) continue;
    const va = valore(ia.item, risposte[a], ia.scala);
    const vb = valore(ib.item, risposte[b], ib.scala);
    if (va === null || vb === null) continue;
    // valore() ha già raddrizzato le inversioni: qui contano solo i contenuti.
    const atteso_vb = atteso === "uguale" ? va : ia.scala.min + ia.scala.max - va;
    scarti.push(Math.abs(vb - atteso_vb));
  }
  if (!scarti.length) return null;
  return { n: scarti.length, medio: media(scarti) };
}

// --- 4. Controlli di attenzione: item che dicono cosa rispondere ---
export const CONTROLLI = [
  {
    id: "attenzione_1",
    atteso: 5,
    testo: {
      it: "Per questa riga scegli «Molto d'accordo»: serve a controllare che le domande vengano lette.",
      en: "For this row choose 'Strongly agree': this checks that the questions are being read.",
    },
  },
  {
    id: "attenzione_2",
    atteso: 1,
    testo: {
      it: "Per questa riga scegli «Molto in disaccordo».",
      en: "For this row choose 'Strongly disagree'.",
    },
  },
  {
    id: "attenzione_3",
    atteso: 3,
    testo: {
      it: "Per questa riga scegli la risposta in mezzo.",
      en: "For this row choose the middle answer.",
    },
  },
  {
    id: "attenzione_4",
    atteso: 5,
    testo: {
      it: "Anche qui scegli «Molto d'accordo».",
      en: "Here too, choose 'Strongly agree'.",
    },
  },
];

export function controlliSbagliati(risposte) {
  let sbagliati = 0;
  let risposti = 0;
  for (const c of CONTROLLI) {
    const v = risposte[c.id];
    if (v === undefined || v === null) continue;
    risposti++;
    if (Number(v) !== c.atteso) sbagliati++;
  }
  return { sbagliati, risposti };
}

// --- 5. Tempo per item ---
export function tempoMedio(tempi, ordine) {
  const valori = ordine.map((id) => tempi[id]).filter((t) => Number.isFinite(t) && t > 0);
  if (valori.length < 10) return null;
  // Mediana, non media: una pausa per il caffè non deve mascherare la fretta.
  const ordinati = [...valori].sort((a, b) => a - b);
  return ordinati[Math.floor(ordinati.length / 2)];
}

// --- 6. Uso della scala: chi usa un solo valore su cinque non sta scegliendo ---
// Anche qui solo scale larghe: su un si/no usare un valore solo e normale.
export function varietaRisposte(ordine, risposte, ammessi = null) {
  const usati = new Map();
  let n = 0;
  for (const id of ordine) {
    if (ammessi && !ammessi.has(id)) continue;
    const v = risposte[id];
    if (v === undefined || v === null) continue;
    n++;
    usati.set(v, (usati.get(v) || 0) + 1);
  }
  if (!n) return null;
  const massimo = Math.max(...usati.values());
  return { valoriDiversi: usati.size, quotaValorePiuUsato: massimo / n };
}

// --- Verdetto complessivo ---
// Tre livelli. Il terzo non mostra il profilo: lo dice e basta.
export function verdetto({ strumenti, strumentiPerId, risposte, tempi, ordine }) {
  const segnali = [];
  const ammessi = itemAScalaLarga(strumenti);

  const ls = longString(ordine, risposte, ammessi);
  if (ls >= SOGLIE.longString) {
    segnali.push({
      peso: 2,
      chiave: "longString",
      it: ls + " risposte identiche di fila.",
      en: ls + " identical answers in a row.",
    });
  }

  const coer = coerenzaPariDispari(strumenti, risposte);
  if (coer !== null && coer < SOGLIE.coerenzaMin) {
    segnali.push({
      peso: 2,
      chiave: "coerenza",
      it: "Le due metà delle scale non si accordano (r = " + coer.toFixed(2) + ").",
      en: "The two halves of the scales disagree (r = " + coer.toFixed(2) + ").",
    });
  }

  const coppie = scartoCoppie(strumentiPerId, risposte);
  if (coppie && coppie.medio > SOGLIE.antonimiMax) {
    segnali.push({
      peso: 1,
      chiave: "coppie",
      it: "Domande quasi identiche hanno avuto risposte lontane (scarto medio " + coppie.medio.toFixed(1) + ").",
      en: "Near-identical questions got distant answers (mean gap " + coppie.medio.toFixed(1) + ").",
    });
  }

  const att = controlliSbagliati(risposte);
  if (att.sbagliati > SOGLIE.attenzioneMax) {
    segnali.push({
      peso: 2,
      chiave: "attenzione",
      it: att.sbagliati + " controlli di attenzione su " + att.risposti + " sbagliati.",
      en: att.sbagliati + " of " + att.risposti + " attention checks failed.",
    });
  } else if (att.sbagliati === 1) {
    segnali.push({
      peso: 1,
      chiave: "attenzione",
      it: "Un controllo di attenzione sbagliato.",
      en: "One attention check failed.",
    });
  }

  const tm = tempoMedio(tempi, ordine);
  if (tm !== null && tm < SOGLIE.tempoPerItemMs) {
    segnali.push({
      peso: 2,
      chiave: "tempo",
      it: "Mediana di " + (tm / 1000).toFixed(1) + " secondi per domanda: sotto il tempo di lettura.",
      en: "Median of " + (tm / 1000).toFixed(1) + " s per question: below reading time.",
    });
  }

  const varieta = varietaRisposte(ordine, risposte, ammessi);
  if (varieta && varieta.quotaValorePiuUsato > 0.8) {
    segnali.push({
      peso: 1,
      chiave: "varieta",
      it: Math.round(varieta.quotaValorePiuUsato * 100) + "% delle risposte sullo stesso valore.",
      en: Math.round(varieta.quotaValorePiuUsato * 100) + "% of answers on the same value.",
    });
  }

  const peso = segnali.reduce((s, x) => s + x.peso, 0);
  const livello = peso >= 4 ? "non-interpretabile" : peso >= 2 ? "cautela" : "attendibile";

  return {
    livello,
    peso,
    segnali,
    misure: { longString: ls, coerenza: coer, coppie, attenzione: att, tempoMediano: tm, varieta },
    mostraProfilo: livello !== "non-interpretabile",
  };
}

// --- utilità ---

// Gli id degli item con almeno 4 opzioni di risposta: sono gli unici su cui
// long-string e varietà dicono qualcosa. I controlli di attenzione entrano
// (sono su scala Likert), i sì/no e le scale a frasi restano fuori.
function itemAScalaLarga(strumenti) {
  const ammessi = new Set();
  for (const s of strumenti) {
    const larga = s.scala && s.scala.max - s.scala.min >= 3;
    for (const it of s.item) {
      if (it.opzioni) continue; // scale a frasi o a scelta: fuori
      if (larga) ammessi.add(it.id);
    }
  }
  for (const c of CONTROLLI) ammessi.add(c.id);
  return ammessi;
}

function valore(item, risposta, scala) {
  const v = Number(risposta);
  if (!Number.isFinite(v)) return null;
  return item.invertito ? scala.min + scala.max - v : v;
}

function trovaItem(strumentiPerId, idItem) {
  for (const s of Object.values(strumentiPerId)) {
    const item = s.item.find((i) => i.id === idItem);
    if (item) return { item, scala: s.scala };
  }
  return null;
}

function media(a) {
  return a.reduce((x, y) => x + y, 0) / a.length;
}

function correlazione(a, b) {
  const ma = media(a);
  const mb = media(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  if (da === 0 || db === 0) return 0;
  return num / Math.sqrt(da * db);
}
