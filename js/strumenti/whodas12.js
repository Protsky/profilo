// WHODAS 2.0 — versione a 12 item
//
// Üstün TB et al. (2010), Organizzazione mondiale della sanità. Libero uso con
// attribuzione.
//
// PERCHÉ QUESTO MODULO ESISTE, ED È IL PIÙ IMPORTANTE DEI CONTORNI.
// Un tratto senza compromissione non è un disturbo. È la riga che separa
// "sono una persona che si agita facilmente" da qualcosa che merita un nome
// clinico, ed è la riga che tutti i test online saltano: misurano sintomi e
// non chiedono mai se quei sintomi stanno rovinando qualcosa.
//
// Qui il funzionamento non fa da sfondo: entra nel referto accanto a ogni
// bandiera. Punteggi alti sulle scale cliniche con funzionamento intatto
// vogliono dire una cosa; gli stessi punteggi con il funzionamento a pezzi ne
// vogliono dire un'altra, e non è una sfumatura.

const RIGHE = [
  ["Standing for long periods, such as 30 minutes?",
   "Stare in piedi a lungo, per esempio mezz'ora?"],
  ["Taking care of your household responsibilities?",
   "Occuparti delle cose di casa?"],
  ["Learning a new task, for example, learning how to get to a new place?",
   "Imparare qualcosa di nuovo, per esempio come arrivare in un posto dove non sei mai stato?"],
  ["How much of a problem did you have joining in community activities in the same way as anyone else can?",
   "Partecipare alle attività della comunità come può fare chiunque altro?"],
  ["How much have you been emotionally affected by your health problems?",
   "Quanto ti hanno toccato emotivamente i tuoi problemi di salute?"],
  ["Concentrating on doing something for ten minutes?",
   "Concentrarti su qualcosa per dieci minuti?"],
  ["Walking a long distance, such as a kilometre?",
   "Camminare a lungo, per esempio un chilometro?"],
  ["Washing your whole body?",
   "Lavarti tutto il corpo?"],
  ["Getting dressed?",
   "Vestirti?"],
  ["Dealing with people you do not know?",
   "Avere a che fare con persone che non conosci?"],
  ["Maintaining a friendship?",
   "Mantenere un'amicizia?"],
  ["Your day-to-day work or school?",
   "Il tuo lavoro o la scuola di tutti i giorni?"],
];

export default {
  id: "whodas12",
  modulo: 7,
  nome: { it: "WHODAS 2.0 — come funziona la giornata", en: "WHODAS 2.0 — functioning" },
  fonte: "Üstün TB, Kostanjsek N, Chatterji S, Rehm J (2010). Measuring Health and Disability: Manual for WHO Disability Assessment Schedule (WHODAS 2.0). OMS.",
  licenza: "Libero uso con attribuzione all'Organizzazione mondiale della sanità.",
  provenienza: "verbatim-noto",
  traduzioneValidata: false,
  finestra: { it: "negli ultimi 30 giorni", en: "in the past 30 days" },
  consegna: {
    it: "Negli ultimi trenta giorni, quanta difficoltà hai avuto in queste cose?",
    en: "In the past 30 days, how much difficulty did you have in the following?",
  },
  scala: {
    min: 0,
    max: 4,
    ancore: {
      it: ["Nessuna", "Lieve", "Moderata", "Grave", "Estrema o impossibile"],
      en: ["None", "Mild", "Moderate", "Severe", "Extreme or cannot do"],
    },
  },
  item: RIGHE.map(([en, it], i) => ({
    id: "whodas_" + String(i + 1).padStart(2, "0"),
    scala: "funzionamento",
    invertito: false,
    testo: { it, en },
  })),
  scale: {
    funzionamento: {
      nome: { it: "Difficoltà nel funzionamento (WHODAS 2.0)", en: "Functioning difficulty (WHODAS 2.0)" },
      intervallo: [0, 48],
      omega: 0.87,
      // Nessuna soglia: il WHODAS non è uno screening e non ha un cutoff
      // clinico. Serve a leggere le altre scale, non a segnalare per conto suo.
      notaSoglia: {
        it: "Questa scala non ha una soglia, e non è una dimenticanza: il WHODAS non è uno screening. Serve a dare peso al resto. Un tratto senza compromissione non è un disturbo, ed è la distinzione che i test online saltano sempre.",
        en: "This scale has no cutoff, by design: WHODAS is not a screener. It exists to give weight to the rest. A trait without impairment is not a disorder.",
      },
    },
  },
};
