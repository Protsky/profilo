// Dove finiscono le risposte: qui, e da nessun'altra parte.
//
// localStorage del browser. Niente rete, niente server, niente account.
// L'hosting consegna i file e basta: non riceve nulla, non ha una rotta per
// riceverlo, e si può staccare la rete a metà test senza che cambi niente.
//
// SUI PROGRESSI, che è la cosa che si dà per scontata finché non si perde.
// Il salvataggio avviene a OGNI SINGOLA RISPOSTA, non a fine blocco: se il
// telefono si chiude, la batteria muore o Safari uccide la scheda, quello che
// hai risposto è già scritto. Alla riapertura il test riparte dalla prima
// domanda senza risposta.
//
// Restano tre modi veri di perdere tutto, e questo file li affronta uno per uno:
//
//   1. localStorage pieno o vietato (navigazione privata, quota esaurita).
//      Prima falliva in silenzio: si continuava a rispondere per mezz'ora
//      credendo di star salvando. Adesso `salva` avvisa chi lo ascolta e
//      l'interfaccia mette una fascia rossa in cima.
//
//   2. Safari su iPhone cancella i dati dei siti non usati per sette giorni.
//      Vale per i siti aperti dal browser, NON per quelli aggiunti alla schermata
//      Home: aggiungerlo alla Home non è una comodità estetica, è il modo di
//      non perdere il test a metà. In più si chiede la persistenza al browser,
//      che dove è supportata rende i dati non sfrattabili.
//
//   3. Un altro dispositivo. Non c'è sincronizzazione e non ci sarà: sarebbe
//      un server che riceve i tuoi dati. Per portarli altrove c'è l'export JSON.

const CHIAVE = "profilo.sessione.v1";

function vuota() {
  return {
    versione: 1,
    iniziata: null,
    lingua: "it",
    risposte: {},        // idItem -> valore
    disagio: {},         // idItem -> valore (per gli strumenti che lo chiedono)
    tempi: {},           // idItem -> millisecondi impiegati
    ordine: [],          // ordine effettivo di somministrazione
    moduliFatti: [],
    posizione: 0,
    sicurezzaMostrata: false,
    conclusa: false,
    ultimoSalvataggio: null,
  };
}

// --- chi vuole sapere se il salvataggio va male ---

const ascoltatori = [];

export function seNonRiesceASalvare(callback) {
  ascoltatori.push(callback);
}

let giaAvvisato = false;

function avvisa(errore) {
  if (giaAvvisato) return; // una fascia sola, non una per risposta
  giaAvvisato = true;
  ascoltatori.forEach((f) => {
    try { f(errore); } catch (e) { /* un ascoltatore rotto non blocca gli altri */ }
  });
}

// --- lettura e scrittura ---

export function carica() {
  try {
    const grezzo = localStorage.getItem(CHIAVE);
    if (!grezzo) return vuota();
    const s = JSON.parse(grezzo);
    if (!s || s.versione !== 1) return vuota();
    // Riempie eventuali campi aggiunti dopo il salvataggio.
    return Object.assign(vuota(), s);
  } catch (e) {
    // Un localStorage illeggibile non deve impedire di rifare il test.
    console.warn("sessione illeggibile, ne comincio una nuova", e);
    return vuota();
  }
}

export function salva(sessione) {
  try {
    sessione.ultimoSalvataggio = new Date().toISOString();
    localStorage.setItem(CHIAVE, JSON.stringify(sessione));
    return true;
  } catch (e) {
    // Quota piena, navigazione privata, storage disattivato. Prima finiva solo
    // in console, dove non guarda nessuno: e chi risponde crede di salvare.
    console.error("non riesco a salvare la sessione", e);
    avvisa(e);
    return false;
  }
}

export function azzera() {
  try { localStorage.removeItem(CHIAVE); } catch (e) { /* niente da togliere */ }
  giaAvvisato = false;
  return vuota();
}

export function esiste() {
  try { return localStorage.getItem(CHIAVE) !== null; } catch (e) { return false; }
}

// Quante domande sono già state date: serve a dire "ripreso da dove eri".
export function quanteRisposte(sessione) {
  return Object.keys((sessione && sessione.risposte) || {}).length;
}

// --- resistenza allo sfratto ---

// Chiede al browser di non buttare via i dati quando ha bisogno di spazio.
// Chrome la concede da solo se il sito è installato o usato spesso; Safari non
// la implementa, ed è lì che serve la schermata Home. Non fallisce mai in modo
// rumoroso: se non si può, si continua lo stesso.
export async function chiediPersistenza() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return { supportata: false };
    const gia = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    if (gia) return { supportata: true, concessa: true };
    const concessa = await navigator.storage.persist();
    return { supportata: true, concessa };
  } catch (e) {
    return { supportata: false, errore: String(e) };
  }
}

export async function statoArchiviazione() {
  const stato = { persistente: null, usatiKB: null, disponibiliMB: null };
  try {
    if (navigator.storage && navigator.storage.persisted) {
      stato.persistente = await navigator.storage.persisted();
    }
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      if (e.usage != null) stato.usatiKB = Math.round(e.usage / 1024);
      if (e.quota != null) stato.disponibiliMB = Math.round(e.quota / 1024 / 1024);
    }
  } catch (e) { /* informazione di contorno: se manca, pazienza */ }
  return stato;
}

// Sta girando come app aggiunta alla Home invece che dentro il browser?
// Cambia cosa ha senso consigliare.
export function installata() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    navigator.standalone === true // Safari su iOS
  );
}

// --- esportazione ---

export function esportaJSON(sessione, extra = {}) {
  return JSON.stringify(
    {
      generato: new Date().toISOString(),
      strumento: "profilo — batteria psicologica dimensionale",
      avvertenza:
        "Questi dati non sono una diagnosi. Sono risposte a questionari di autovalutazione, " +
        "con tutti i limiti che questo comporta. Vanno letti da chi sa leggerli.",
      ...extra,
      sessione,
    },
    null,
    2
  );
}

export function scarica(nomeFile, contenuto, tipo = "application/json") {
  const blob = new Blob([contenuto], { type: tipo + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importaJSON(testo) {
  const dati = JSON.parse(testo);
  const s = dati.sessione || dati;
  if (!s || typeof s.risposte !== "object") {
    throw new Error("Questo file non contiene una sessione del profilo.");
  }
  return Object.assign(vuota(), s);
}
