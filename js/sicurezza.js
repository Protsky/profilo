// Il percorso di sicurezza.
//
// Regola unica, non negoziabile: se una risposta indica pensieri di morte o di
// farsi del male, il test si ferma e mostra i contatti PRIMA di calcolare
// qualunque punteggio. Nessun numero, nessuna percentuale, nessun grafico
// finché quella schermata non è stata vista.
//
// Regola gemella, altrettanto ferma: nessuna schermata di questa app può
// concludere che non c'è rischio. Un questionario non lo sa. Il silenzio di un
// rilevatore incompleto vale come veto, mai come affermazione: può dire
// "fermiamoci", non può dire "va tutto bene".

// Ticino. Verificati su www4.ti.ch (DSS) e OSC, agosto 2026.
//
// La pagina sta su un indirizzo pubblico: può aprirla chiunque, da qualunque
// paese. Quattro di questi cinque numeri rispondono solo in Svizzera, e un
// numero che non risponde nel momento sbagliato è peggio di nessun numero.
// Per questo la schermata dice sempre da dove valgono - vedi DA_DOVE_VALGONO.
export const CONTATTI = [
  {
    numero: "143",
    nome: { it: "Telefono Amico", en: "Telefono Amico helpline" },
    quando: { it: "24 ore su 24, tutti i giorni", en: "24/7" },
    nota: {
      it: "Ascolto anonimo e gratuito. Non serve avere un'emergenza per chiamare.",
      en: "Anonymous, free listening. You do not need an emergency to call.",
    },
  },
  {
    numero: "144",
    nome: { it: "Urgenza sanitaria", en: "Medical emergency" },
    quando: { it: "24 ore su 24", en: "24/7" },
    nota: {
      it: "Smista anche al servizio psichiatrico di picchetto.",
      en: "Also routes to the psychiatric on-call service.",
    },
  },
  {
    numero: "091 611 48 28",
    nome: { it: "Picchetto psichiatrico cantonale", en: "Cantonal psychiatric on-call" },
    quando: {
      it: "18:00-08:00 nei feriali, 24 ore su 24 nei festivi",
      en: "18:00-08:00 weekdays, 24/7 on holidays",
    },
    nota: {
      it: "Intervento telefonico e, se serve, di persona.",
      en: "Telephone intervention and, if needed, in person.",
    },
  },
  {
    numero: "0848 062 062",
    nome: { it: "Contact center OSC", en: "OSC contact centre" },
    quando: { it: "Orari d'ufficio", en: "Office hours" },
    nota: {
      it: "Organizzazione sociopsichiatrica cantonale: per prendere un appuntamento, non per l'urgenza.",
      en: "Cantonal sociopsychiatric organisation: for appointments, not emergencies.",
    },
  },
  {
    numero: "112",
    nome: { it: "Emergenza", en: "Emergency" },
    quando: { it: "24 ore su 24", en: "24/7" },
    nota: { it: "Numero unico europeo.", en: "Single European emergency number." },
  },
];

// Detto sotto ogni elenco di contatti, perché la pagina è pubblica.
export const DA_DOVE_VALGONO = {
  it:
    "Questi numeri rispondono in Svizzera (il 143 e il 144 in tutto il paese, gli altri due in Ticino). " +
    "Il 112 funziona in tutta Europa. Se sei altrove, ogni paese ha un suo servizio di ascolto: " +
    "vale la pena cercarlo adesso, non quando serve.",
  en:
    "These numbers answer in Switzerland (143 and 144 nationwide, the other two in Ticino). " +
    "112 works across Europe. If you are elsewhere, every country has its own helpline: " +
    "worth looking it up now, not when you need it.",
};

// Gli item che fanno scattare il percorso. Ogni voce dice quale risposta conta.
// Tenerli in un posto solo evita che aggiungendo uno strumento ci si dimentichi
// di collegarne il rischio.
export const INNESCHI = [
  { item: "phq9_09", scattaSe: (v) => Number(v) > 0, tipo: "autolesivita" },
  { item: "rischio_diretto", scattaSe: (v) => Number(v) > 0, tipo: "autolesivita" },
];

// La domanda diretta, posta all'inizio della batteria. Chiedere non induce:
// la letteratura sulla prevenzione è concorde da anni. Non chiedere, invece,
// lascia scoperta l'unica cosa che questo test deve saper vedere.
export const DOMANDA_DIRETTA = {
  id: "rischio_diretto",
  scala: "rischio",
  tipo: "scelta",
  testo: {
    it: "Prima di cominciare, una domanda diretta. Nelle ultime due settimane hai avuto pensieri di farti del male o che sarebbe meglio non esserci?",
    en: "Before we start, a direct question. In the past two weeks, have you had thoughts of hurting yourself or that you would be better off not being here?",
  },
  opzioni: [
    { valore: 0, testo: { it: "No", en: "No" } },
    { valore: 1, testo: { it: "Sì, qualche pensiero passeggero", en: "Yes, some passing thoughts" } },
    { valore: 2, testo: { it: "Sì, e ci ho pensato spesso", en: "Yes, and often" } },
    { valore: 3, testo: { it: "Sì, e sto pensando a come farlo", en: "Yes, and I am thinking about how" } },
  ],
};

// Controlla un insieme di risposte. Restituisce null se niente è scattato.
export function controlla(risposte) {
  for (const innesco of INNESCHI) {
    const v = risposte[innesco.item];
    if (v !== undefined && v !== null && innesco.scattaSe(v)) {
      return { item: innesco.item, tipo: innesco.tipo, valore: Number(v) };
    }
  }
  return null;
}

// Il testo della schermata. Diretto, senza giri di parole e senza allarme.
export function messaggio(esito, lingua = "it") {
  const urgente = esito && esito.valore >= 3;
  if (lingua === "en") {
    return {
      titolo: "Let us stop here for a moment",
      corpo: urgente
        ? "You said you are thinking about how. Please do not stay alone with this right now - call one of the numbers below. They are for exactly this."
        : "Something you answered is worth more than a score. Whatever brought you here, this is not something to work through alone with a questionnaire.",
      chiusura: "The test is paused. You can come back to it later, or not at all - it matters much less than the call.",
    };
  }
  return {
    titolo: "Fermiamoci un momento",
    corpo: urgente
      ? "Hai detto che stai pensando a come farlo. Per favore non restare solo con questa cosa adesso: chiama uno dei numeri qui sotto. Servono esattamente a questo."
      : "Una delle risposte che hai dato vale più di un punteggio. Qualunque cosa ti abbia portato fin qui, non è una cosa da attraversare da solo con un questionario davanti.",
    chiusura:
      "Il test è in pausa. Puoi riprenderlo più tardi, oppure mai: conta molto meno della telefonata.",
  };
}

// Frase vietata ovunque nell'app. Il selftest la cerca nel testo generato.
// Se un giorno qualcuno aggiunge un "nessun rischio rilevato", il test cade.
export const MAI_DIRE = [
  "nessun rischio",
  "non c'è rischio",
  "non ci sono rischi",
  "tutto a posto",
  "nessun problema rilevato",
  "risulti negativo",
  "sei sano",
  "no risk",
  "you are fine",
];
