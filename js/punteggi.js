// Dai numeri crudi al profilo.
//
// Tre scelte da sapere, perché cambiano come si legge il risultato.
//
// 1. SOMME, NON IRT. I parametri IRT di BFAS e delle altre scale usate qui non
//    sono pubblicati. Inventarli darebbe punteggi dall'aria più precisa e dal
//    contenuto peggiore. Quindi: somma degli item, con inversione dove serve.
//
// 2. PERCENTILI SOLO DOVE C'È UNA NORMA VERA. Se non abbiamo medie e deviazioni
//    standard pubblicate per una scala, la scala si mostra come punteggio
//    grezzo sull'intervallo teorico, con scritto che la norma manca. Un
//    percentile inventato è peggio di un percentile assente: sembra una
//    posizione nella popolazione e non lo è.
//
// 3. BANDE, NON PUNTI. Ogni punteggio arriva con il suo errore di misura
//    addosso: SEM = DS * radice(1 - omega), banda = +/- 1.96 * SEM. Se due
//    scale hanno bande che si sovrappongono, la differenza fra loro non si
//    commenta. È la regola che rende innocuo il "sono più X che Y" quando la
//    differenza sta dentro il rumore.

// Valore di un item, tenendo conto dell'inversione.
export function valoreItem(item, risposta, scala) {
  const v = Number(risposta);
  if (!Number.isFinite(v)) return null;
  if (!item.invertito) return v;
  return scala.min + scala.max - v;
}

// Punteggio di una scala. Restituisce null se mancano troppe risposte.
export function punteggioScala(strumento, chiaveScala, risposte, { minRisposte = 0.8 } = {}) {
  const tutti = strumento.item.filter((i) => i.scala === chiaveScala);
  if (!tutti.length) return null;

  // Le domande che una condizione ha tenuto fuori non sono "mancanti": non
  // sono state poste. Se una scala intera non è stata posta, il risultato non
  // è un punteggio basso, è l'assenza di una domanda - e va detta così.
  const item = tutti.filter((i) => applicabile(i, risposte));
  if (!item.length) {
    return { nonApplicabile: true, incompleta: true, scala: chiaveScala, strumento: strumento.id };
  }

  const valori = [];
  let mancanti = 0;
  for (const it of item) {
    const r = risposte[it.id];
    if (r === undefined || r === null || r === "") {
      mancanti++;
      continue;
    }
    const v = valoreItem(it, r, strumento.scala);
    if (v === null) {
      mancanti++;
      continue;
    }
    valori.push(v);
  }

  const quota = valori.length / item.length;
  if (quota < minRisposte) {
    // strumento e scala vanno restituiti anche qui: chi disegna il referto
    // deve poter risalire allo strumento anche per una scala incompleta.
    return {
      incompleta: true,
      strumento: strumento.id,
      scala: chiaveScala,
      risposti: valori.length,
      totale: item.length,
    };
  }

  const somma = valori.reduce((a, b) => a + b, 0);
  const media = somma / valori.length;
  // Se qualche item manca, la somma viene riportata alla lunghezza piena
  // usando la media degli item risposti: è la prassi, e va detta.
  const sommaStimata = mancanti ? media * item.length : somma;

  const def = (strumento.scale && strumento.scale[chiaveScala]) || {};
  const intervallo = def.intervallo || [
    item.length * strumento.scala.min,
    item.length * strumento.scala.max,
  ];

  return {
    incompleta: false,
    scala: chiaveScala,
    strumento: strumento.id,
    somma: sommaStimata,
    sommaGrezza: somma,
    media,
    nItem: item.length,
    nRisposti: valori.length,
    stimata: mancanti > 0,
    intervallo,
    // posizione nell'intervallo teorico, 0..1. NON è un percentile.
    posizioneTeorica: (sommaStimata - intervallo[0]) / (intervallo[1] - intervallo[0]),
    omega: def.omega,
    soglia: def.soglia,
    sopraSoglia: def.soglia !== undefined ? sommaStimata >= def.soglia : undefined,
    fascia: fasciaDi(def, sommaStimata),
  };
}

// Una domanda è applicabile se nessuna condizione la esclude. La regola sta
// qui in forma minima per non far dipendere il calcolo dei punteggi dal
// modulo della batteria: se un giorno si calcolano punteggi fuori dall'app
// (per esempio su un JSON esportato), questo file basta a sé.
function applicabile(item, risposte) {
  const c = item.soloSe;
  if (!c) return true;
  if (c.item !== undefined) return Number(risposte[c.item]) === Number(c.vale);
  return true; // le condizioni per conteggio non escludono dal punteggio
}

function fasciaDi(def, punteggio) {
  if (!def.fasce) return null;
  for (const f of def.fasce) {
    if (punteggio <= f.fino) return f;
  }
  return def.fasce[def.fasce.length - 1];
}

// Errore standard di misura e banda di confidenza al 95%.
// Serve la deviazione standard: se non c'è una norma, si usa la DS osservata
// negli item, che è una stima grossolana - e viene marcata come tale.
export function bandaErrore(punteggio, { omega, ds, dsStimata = false }) {
  if (!omega || !ds) return null;
  const sem = ds * Math.sqrt(Math.max(0, 1 - omega));
  const meta = 1.96 * sem;
  return {
    sem,
    meta,
    da: punteggio - meta,
    a: punteggio + meta,
    dsStimata,
  };
}

// Percentile: SOLO con una norma vera (media e DS di un campione pubblicato).
export function percentile(punteggio, norma) {
  if (!norma || norma.media === undefined || norma.ds === undefined) return null;
  const z = (punteggio - norma.media) / norma.ds;
  return { z, percentile: Math.round(100 * normale(z)), norma };
}

// Funzione di ripartizione normale standard (approssimazione di Zelen & Severo,
// errore < 7.5e-8). Basta e avanza per un percentile.
function normale(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  let p =
    d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  p = 1 - p;
  return z >= 0 ? p : 1 - p;
}

// Profilo relativo alla propria media: l'unica lettura possibile quando manca
// una norma esterna. Dice "fra i tuoi dieci aspetti, questo è il più alto",
// che è vero e utile, senza dire "sei sopra la media della popolazione", che
// senza norma sarebbe inventato.
export function profiloRelativo(punteggi) {
  const medie = punteggi.filter((p) => p && !p.incompleta).map((p) => p.media);
  if (medie.length < 2) return punteggi;
  const m = medie.reduce((a, b) => a + b, 0) / medie.length;
  const varianza = medie.reduce((a, b) => a + (b - m) * (b - m), 0) / medie.length;
  const ds = Math.sqrt(varianza);
  return punteggi.map((p) => {
    if (!p || p.incompleta) return p;
    return { ...p, zRelativo: ds > 0 ? (p.media - m) / ds : 0, mediaPersonale: m, dsPersonale: ds };
  });
}

// Due punteggi sono distinguibili solo se le loro bande non si toccano.
// Il referto usa questa funzione prima di scrivere qualunque confronto.
export function distinguibili(a, b) {
  if (!a || !b || !a.banda || !b.banda) return false;
  return a.banda.a < b.banda.da || b.banda.a < a.banda.da;
}

// Calcola tutte le scale di uno strumento in un colpo.
export function punteggiStrumento(strumento, risposte, norme = {}) {
  // Alcuni strumenti non si punteggiano a somma (l'AQ-10 conta da che parte
  // cade la risposta, non quanto): si portano dietro la propria regola.
  if (typeof strumento.punteggioProprio === "function") {
    return [strumento.punteggioProprio(risposte)].filter(Boolean);
  }
  const chiavi = strumento.scale
    ? Object.keys(strumento.scale)
    : [...new Set(strumento.item.map((i) => i.scala))];
  return chiavi.map((k) => {
    const p = punteggioScala(strumento, k, risposte);
    if (!p || p.incompleta) return p;
    const norma = (norme[strumento.id] && norme[strumento.id][k]) || null;
    const ds = norma ? norma.ds : dsInterna(strumento, k, risposte);
    p.banda = bandaErrore(p.somma, { omega: p.omega, ds, dsStimata: !norma });
    p.percentile = norma ? percentile(p.somma, norma) : null;
    p.normaMancante = !norma;
    return p;
  });
}

// Deviazione standard ricavata dagli item della persona stessa, scalata alla
// lunghezza della scala. È una stima povera: serve solo a disegnare una banda
// che ricordi che il punteggio non è un punto. Marcata sempre come stimata.
function dsInterna(strumento, chiaveScala, risposte) {
  const item = strumento.item.filter((i) => i.scala === chiaveScala);
  const valori = item
    .map((it) => valoreItem(it, risposte[it.id], strumento.scala))
    .filter((v) => v !== null);
  if (valori.length < 2) return null;
  const m = valori.reduce((a, b) => a + b, 0) / valori.length;
  const varianza = valori.reduce((a, b) => a + (b - m) * (b - m), 0) / (valori.length - 1);
  return Math.sqrt(varianza) * Math.sqrt(item.length);
}
