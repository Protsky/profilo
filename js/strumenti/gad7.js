// GAD-7 — Generalized Anxiety Disorder scale
//
// Spitzer, Kroenke, Williams & Lowe (2006). Come il PHQ-9, libero da copyright
// dal 2010: nessun permesso richiesto per riprodurre, tradurre, distribuire.

const RIGHE = [
  ["Feeling nervous, anxious, or on edge",
   "Sentirsi nervoso, ansioso o teso"],
  ["Not being able to stop or control worrying",
   "Non riuscire a smettere di preoccuparsi o a controllare le preoccupazioni"],
  ["Worrying too much about different things",
   "Preoccuparsi troppo di cose diverse"],
  ["Trouble relaxing",
   "Difficoltà a rilassarsi"],
  ["Being so restless that it is hard to sit still",
   "Essere così irrequieto da fare fatica a stare fermo"],
  ["Becoming easily annoyed or irritable",
   "Infastidirsi o irritarsi facilmente"],
  ["Feeling afraid as if something awful might happen",
   "Avere paura che possa succedere qualcosa di terribile"],
];

export default {
  id: "gad7",
  modulo: 6,
  nome: { it: "GAD-7 — ansia", en: "GAD-7 — anxiety" },
  fonte: "Spitzer RL, Kroenke K, Williams JBW, Lowe B (2006). Arch Intern Med 166(10), 1092-1097.",
  licenza: "Nessun copyright. Libero uso dal 2010.",
  provenienza: "verbatim-noto",
  traduzioneValidata: false,
  finestra: { it: "nelle ultime 2 settimane", en: "over the last 2 weeks" },
  consegna: {
    it: "Nelle ultime due settimane, con quale frequenza ti hanno dato fastidio i seguenti problemi?",
    en: "Over the last 2 weeks, how often have you been bothered by the following problems?",
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
    id: "gad7_" + String(i + 1).padStart(2, "0"),
    scala: "ansia",
    invertito: false,
    testo: { it, en },
  })),
  scale: {
    ansia: {
      nome: { it: "Ansia generalizzata (GAD-7)", en: "Generalised anxiety (GAD-7)" },
      intervallo: [0, 21],
      omega: 0.89,
      fasce: [
        { fino: 4, it: "minima", en: "minimal" },
        { fino: 9, it: "lieve", en: "mild" },
        { fino: 14, it: "moderata", en: "moderate" },
        { fino: 21, it: "grave", en: "severe" },
      ],
      soglia: 10,
      notaSoglia: {
        it: "Da 10 in su vale la pena approfondire. Non è una diagnosi.",
        en: "From 10 upward follow-up is worthwhile. Not a diagnosis.",
      },
    },
  },
};
