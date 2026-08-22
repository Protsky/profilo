// Il referto: come si scrive quello che è uscito.
//
// Le regole di scrittura sono cinque, e sono la parte più importante di tutto
// il progetto. Il codice sopra calcola dei numeri; è qui che i numeri diventano
// una cosa che una persona legge di sé stessa, ed è qui che si fanno i danni.
//
// 1. Mai "sei" o "hai". Le frasi descrivono comportamenti e tendenze, non
//    identità. "Tendi ad arrabbiarti in fretta" e "sei una persona collerica"
//    contengono la stessa informazione e fanno due cose diverse a chi legge.
// 2. Mai un esito negativo presentato come rassicurazione. Sotto soglia non
//    vuol dire che non c'è niente: vuol dire che questo strumento, che vede
//    poco, non ha visto. Il silenzio di un rilevatore incompleto vale come
//    veto, mai come affermazione.
// 3. Ogni segnalazione porta con sé il proprio valore predittivo. Il numero
//    grezzo senza il VPP è disinformazione, anche se il numero è giusto.
// 4. Nessun confronto fra due scale le cui bande d'errore si sovrappongono.
//    "Sei più ansioso che depresso" con bande sovrapposte è rumore raccontato
//    come struttura.
// 5. Se gli indici di validità dicono che il protocollo non regge, il profilo
//    non si mostra affatto. Meglio niente che un profilo credibile e falso.

import { MAI_DIRE } from "./sicurezza.js";
import { fraseAccantoAllaBandiera, conteggioLeggibile } from "./predittivo.js";
import { distinguibili } from "./punteggi.js";

// Le mappe fra scala e prevalenza da usare per il conto predittivo.
const PREVALENZA_PER_SCALA = {
  "mdq/sintomi": "bipolare",
  "pq16/esperienze": "psicosi",
  "phq9/depressione": "depressione",
};

// --- guardia sul lessico ---
// Cerca nel testo generato le frasi che questa app non deve mai produrre.
// Il selftest la usa su un referto completo: se qualcuno un giorno aggiunge un
// "nessun problema rilevato", il test cade prima che lo veda un utente.
export function frasiVietateIn(testo) {
  const basso = String(testo).toLowerCase();
  return MAI_DIRE.filter((f) => basso.includes(f.toLowerCase()));
}

// --- descrizione di una dimensione ---

// `conciso` serve quando le avvertenze lunghe (norma mancante, sotto soglia
// non è una rassicurazione) sono già state date una volta in testa al blocco.
// Ripeterle identiche su dieci scale di fila non le rende più vere: le rende
// invisibili, e la seconda è troppo importante per lasciarla scivolare via.
export function descriviDimensione(punteggio, definizione, lingua = "it", { conciso = false } = {}) {
  if (punteggio && punteggio.nonApplicabile) {
    return {
      titolo: nomeDi(definizione, lingua),
      stato: "nonApplicabile",
      descrittivo:
        lingua === "en"
          ? "These questions were not asked: the condition that opens them was not met."
          : "Queste domande non sono state poste, perché la condizione che le apre non c'era.",
      contesto:
        lingua === "en"
          ? "That is an absence of questions, not a low score. Nothing here means anything in either direction."
          : "È l'assenza di una domanda, non un punteggio basso. Qui non c'è niente da leggere, né in un senso né nell'altro.",
      azione: null,
    };
  }

  if (!punteggio || punteggio.incompleta) {
    return {
      titolo: nomeDi(definizione, lingua),
      stato: "incompleta",
      descrittivo:
        lingua === "en"
          ? "Not enough answers to score this scale."
          : "Le risposte non bastano per calcolare questa scala.",
      contesto: null,
      azione: null,
    };
  }

  const titolo = nomeDi(definizione, lingua);
  const parti = { titolo, stato: "ok" };

  // Registro 1: descrittivo. Cosa dicono le risposte, senza aggettivi
  // sull'identità di chi le ha date.
  parti.descrittivo = descrittivo(punteggio, definizione, lingua);

  // Registro 2: contesto. Dove cade il punteggio, e con quanta incertezza.
  parti.contesto = contesto(punteggio, lingua, conciso);

  // Registro 3: azione. Solo quando ha senso, mai come prescrizione.
  parti.azione = azione(punteggio, lingua, conciso);

  return parti;
}

function descrittivo(p, def, lingua) {
  if (def && def.fasce && p.fascia) {
    const f = p.fascia[lingua] || p.fascia.it;
    return lingua === "en"
      ? "The answers place this in the " + f + " range (" + arrotonda(p.somma) + " out of " + p.intervallo[1] + ")."
      : "Le risposte collocano questa scala nella fascia " + f + " (" + arrotonda(p.somma) + " su " + p.intervallo[1] + ").";
  }
  const quota = Math.round(p.posizioneTeorica * 100);
  return lingua === "en"
    ? "Score " + arrotonda(p.somma) + " out of a possible " + p.intervallo[1] + " (" + quota + "% of the scale's range)."
    : "Punteggio " + arrotonda(p.somma) + " su un massimo di " + p.intervallo[1] + " (" + quota + "% dell'ampiezza della scala).";
}

function contesto(p, lingua, conciso) {
  const pezzi = [];

  if (p.percentile && p.percentile.percentile !== null) {
    const pc = p.percentile.percentile;
    pezzi.push(
      lingua === "en"
        ? "Roughly " + pc + "% of the reference sample score at or below this."
        : "Circa il " + pc + "% del campione di riferimento sta a questo livello o sotto."
    );
  } else if (p.normaMancante) {
    // Detto esplicitamente, invece di inventare un percentile.
    pezzi.push(
      conciso
        ? lingua === "en"
          ? "No norm loaded."
          : "Norma non disponibile."
        : lingua === "en"
        ? "No published norm is available for this scale here, so there is no percentile: this is a raw score on its own range, not a position in the population."
        : "Per questa scala qui non c'è una norma pubblicata, quindi non c'è nessun percentile: questo è un punteggio grezzo sul proprio intervallo, non una posizione nella popolazione."
    );
  }

  if (p.banda) {
    const larghezza = arrotonda(p.banda.meta * 2);
    pezzi.push(
      conciso
        ? (lingua === "en" ? "Error band about " : "Banda d'errore circa ") +
          larghezza + (lingua === "en" ? " points wide." : " punti.")
        : lingua === "en"
        ? "The measurement error band spans about " + larghezza + " points" +
          (p.banda.dsStimata ? " (estimated from your own answers, so it is rough)" : "") + "."
        : "La banda d'errore è larga circa " + larghezza + " punti" +
          (p.banda.dsStimata ? " (stimata dalle tue stesse risposte, quindi grossolana)" : "") + "."
    );
  }

  if (p.stimata) {
    pezzi.push(
      lingua === "en"
        ? "Some items were left blank; the score was scaled up from those answered."
        : "Alcune domande sono rimaste vuote: il punteggio è stato riportato alla lunghezza piena partendo da quelle date."
    );
  }

  return pezzi.join(" ");
}

function azione(p, lingua, conciso) {
  if (p.sopraSoglia === undefined) return null;

  if (p.sopraSoglia) {
    return lingua === "en"
      ? "This is above the cutoff the literature uses. That is a reason to talk to someone who can look properly - not a conclusion."
      : "Questo sta sopra la soglia che usa la letteratura. È un motivo per parlarne con qualcuno che sappia guardarci davvero, non una conclusione.";
  }

  // Regola 2: sotto soglia non è una rassicurazione, ed è scritto così.
  // In forma breve la frase si accorcia ma non si ammorbidisce: "non ha visto"
  // non diventa mai "non c'è". La versione lunga sta una volta in cima al
  // blocco, dove viene letta invece di essere saltata alla decima ripetizione.
  if (conciso) {
    return lingua === "en"
      ? "Below cutoff: this questionnaire did not pick anything up here."
      : "Sotto soglia: qui questo questionario non ha visto niente.";
  }
  return lingua === "en"
    ? "This is below the cutoff. That means this questionnaire did not pick anything up here - which is not the same as there being nothing. If something is weighing on you, the score does not overrule it."
    : "Questo sta sotto la soglia. Vuol dire che questo questionario qui non ha visto niente, che non è la stessa cosa che non ci sia niente. Se qualcosa ti pesa, il punteggio non conta più di quello che senti.";
}

// --- segnalazioni, ognuna col suo valore predittivo ---

export function segnalazioni(punteggi, lingua = "it") {
  const fuori = [];
  for (const p of punteggi) {
    if (!p || p.incompleta || !p.sopraSoglia) continue;
    const chiave = p.strumento + "/" + p.scala;
    const prev = PREVALENZA_PER_SCALA[chiave];
    fuori.push({
      strumento: p.strumento,
      scala: p.scala,
      punteggio: p.somma,
      soglia: p.soglia,
      predittivo: prev ? fraseAccantoAllaBandiera(p.strumento, prev, lingua) : null,
      conto: prev ? conteggioLeggibile(p.strumento, prev, lingua) : null,
    });
  }
  return fuori;
}

// --- confronti fra scale: solo se le bande non si toccano ---

export function confrontabili(a, b) {
  return distinguibili(a, b);
}

export function confronta(a, b, nomeA, nomeB, lingua = "it") {
  if (!distinguibili(a, b)) {
    return lingua === "en"
      ? "The bands for " + nomeA + " and " + nomeB + " overlap: the difference between them is inside the measurement noise and should not be read as a difference."
      : "Le bande di " + nomeA + " e " + nomeB + " si sovrappongono: la differenza fra le due sta dentro il rumore di misura e non va letta come una differenza.";
  }
  const alto = a.somma > b.somma ? nomeA : nomeB;
  const basso = a.somma > b.somma ? nomeB : nomeA;
  return lingua === "en"
    ? alto + " stands clearly above " + basso + ": the bands do not overlap."
    : alto + " sta chiaramente sopra " + basso + ": le bande non si sovrappongono.";
}

// --- quello che questo test non può vedere ---

export function limiti(lingua = "it") {
  if (lingua === "en") {
    return [
      "Psychosis with poor insight. Someone in the middle of it often does not experience it as unusual, so the questions do not catch it.",
      "Negative symptoms - blunting, withdrawal, loss of drive. Precisely the things people under-report about themselves.",
      "Mixed states, where activation and depression run together, which self-report separates badly.",
      "The effect of substances, medication and sleep loss, which imitate both mania and psychosis.",
      "Anything that has changed since you answered. These are answers from one afternoon, not a property of you.",
    ];
  }
  return [
    "La psicosi con scarso insight. Chi la sta attraversando spesso non la vive come strana, quindi le domande non la agganciano.",
    "I sintomi negativi: appiattimento, ritiro, perdita di spinta. Sono esattamente le cose che chi le ha tende a non riferire di sé.",
    "Gli stati misti, in cui attivazione e depressione vanno insieme, che l'autovalutazione separa male.",
    "L'effetto di sostanze, farmaci e mancanza di sonno, che imitano sia la mania sia la psicosi.",
    "Tutto quello che è cambiato da quando hai risposto. Queste sono le risposte di un pomeriggio, non una tua proprietà.",
  ];
}

// --- intestazione del referto, che dice subito cos'è ---

export function cappello(validita, lingua = "it") {
  if (validita.livello === "non-interpretabile") {
    return lingua === "en"
      ? "The profile is not shown. The consistency checks say these answers cannot carry it - see below for which ones and why. Redoing the questionnaire unhurried is worth more than reading a profile built on this."
      : "Il profilo non viene mostrato. I controlli di coerenza dicono che queste risposte non lo reggono: qui sotto c'è quali e perché. Rifare il questionario con calma vale più che leggere un profilo costruito su questo.";
  }
  if (validita.livello === "cautela") {
    return lingua === "en"
      ? "Read this with a hand on the brake: some consistency checks came back odd. The profile is shown, but it is worth less than a careful one."
      : "Da leggere con una mano sul freno: alcuni controlli di coerenza sono venuti storti. Il profilo si vede, ma vale meno di uno compilato con calma.";
  }
  return lingua === "en"
    ? "These are answers to questionnaires, read as continuous dimensions. Not a diagnosis, and not a description of who you are - a description of how you answered, on one day."
    : "Queste sono risposte a dei questionari, lette come dimensioni continue. Non sono una diagnosi, e non sono una descrizione di chi sei: sono una descrizione di come hai risposto, in un giorno.";
}

// --- utilità ---

function nomeDi(def, lingua) {
  if (!def || !def.nome) return "";
  return def.nome[lingua] || def.nome.it || "";
}

function arrotonda(x) {
  return Math.round(x * 10) / 10;
}
