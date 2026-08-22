// PHQ-9 — Patient Health Questionnaire, sezione depressione
//
// Kroenke, Spitzer & Williams (2001). Pfizer ha rilasciato PHQ e GAD-7 senza
// vincolo di copyright nel 2010: riproduzione, traduzione e distribuzione sono
// libere e non richiedono permesso.
//
// Qui c'è l'item 9 (pensieri di morte o di farsi del male). È l'unico item di
// tutta la batteria collegato al percorso di sicurezza: qualsiasi risposta
// diversa da zero interrompe il test PRIMA di calcolare qualunque punteggio.
// Vedi js/sicurezza.js.

const RIGHE = [
  ["Little interest or pleasure in doing things",
   "Poco interesse o piacere nel fare le cose"],
  ["Feeling down, depressed, or hopeless",
   "Sentirsi giù di morale, depresso o senza speranza"],
  ["Trouble falling or staying asleep, or sleeping too much",
   "Difficoltà ad addormentarsi o a restare addormentato, oppure dormire troppo"],
  ["Feeling tired or having little energy",
   "Sentirsi stanco o avere poca energia"],
  ["Poor appetite or overeating",
   "Poco appetito oppure mangiare troppo"],
  ["Feeling bad about yourself - or that you are a failure or have let yourself or your family down",
   "Pensare male di sé - sentirsi un fallimento o aver deluso sé stesso o la propria famiglia"],
  ["Trouble concentrating on things, such as reading the newspaper or watching television",
   "Difficoltà a concentrarsi, per esempio nel leggere il giornale o guardare la televisione"],
  ["Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual",
   "Muoversi o parlare così lentamente che altri se ne sono accorti. Oppure il contrario: essere così agitato da muoversi molto più del solito"],
  ["Thoughts that you would be better off dead or of hurting yourself in some way",
   "Pensieri che sarebbe meglio essere morto, o di farsi del male in qualche modo"],
];

export default {
  id: "phq9",
  modulo: 5,
  nome: { it: "PHQ-9 — umore depresso", en: "PHQ-9 — depression" },
  fonte: "Kroenke K, Spitzer RL, Williams JBW (2001). J Gen Intern Med 16(9), 606-613.",
  licenza: "Nessun copyright. Pfizer ha reso PHQ e GAD-7 di libero uso nel 2010.",
  provenienza: "verbatim-noto",
  traduzioneValidata: false,
  finestra: { it: "nelle ultime 2 settimane", en: "over the last 2 weeks" },
  consegna: {
    it: "Nelle ultime due settimane, con quale frequenza ti hanno dato fastidio i seguenti problemi?",
    en: "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
  },
  scala: {
    min: 0,
    max: 3,
    ancore: {
      it: ["Mai", "Alcuni giorni", "Più della metà dei giorni", "Quasi ogni giorno"],
      en: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
    },
  },
  item: RIGHE.map(([en, it], i) => ({
    id: "phq9_" + String(i + 1).padStart(2, "0"),
    scala: "depressione",
    invertito: false,
    testo: { it, en },
    // L'item 9 e marcato: sicurezza.js lo intercetta.
    rischio: i === 8 ? "autolesivita" : undefined,
  })),
  scale: {
    depressione: {
      nome: { it: "Depressione (PHQ-9)", en: "Depression (PHQ-9)" },
      intervallo: [0, 27],
      omega: 0.89,
      // Fasce di gravita classiche del PHQ-9. Sono descrittive, non diagnosi.
      fasce: [
        { fino: 4, it: "minima", en: "minimal" },
        { fino: 9, it: "lieve", en: "mild" },
        { fino: 14, it: "moderata", en: "moderate" },
        { fino: 19, it: "moderatamente grave", en: "moderately severe" },
        { fino: 27, it: "grave", en: "severe" },
      ],
      soglia: 10,
      notaSoglia: {
        it: "A partire da 10 la letteratura considera utile un approfondimento clinico. Non è una diagnosi: è la soglia in cui conviene parlarne con qualcuno.",
        en: "From 10 upward the literature considers clinical follow-up worthwhile. It is not a diagnosis.",
      },
    },
  },
};
