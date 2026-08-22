// Dove finiscono le risposte: qui, e da nessun'altra parte.
//
// localStorage del browser. Niente rete, niente server, niente account. Il
// server serve.py consegna i file e basta: non riceve nulla indietro, non ha
// una rotta per riceverlo, e si può staccare la rete a metà test senza che
// cambi niente.
//
// Conseguenza da sapere: se svuoti i dati del browser, o apri il test da un
// altro dispositivo, le risposte non ci sono più. È il prezzo del non mandarle
// da nessuna parte. Per portarle altrove c'è l'esportazione in JSON.

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
  };
}

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
    localStorage.setItem(CHIAVE, JSON.stringify(sessione));
    return true;
  } catch (e) {
    // Quota piena o modalità privata: meglio dirlo che perdere le risposte in
    // silenzio.
    console.error("non riesco a salvare la sessione", e);
    return false;
  }
}

export function azzera() {
  localStorage.removeItem(CHIAVE);
  return vuota();
}

export function esiste() {
  return localStorage.getItem(CHIAVE) !== null;
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
