// ASRS-5 — WHO Adult ADHD Self-Report Scale, versione DSM-5
//
// Ustun B et al. (2017). JAMA Psychiatry 74(5), 520-527. Strumento OMS, libero.
//
// PERCHÉ STA IN QUESTA BATTERIA. Non per cercare l'ADHD in sé, ma perché si
// sovrappone in modo sgradevole all'ipomania: irrequietezza, difficoltà a
// stare fermi, parlare sopra agli altri, rimandare tutto. Un MDQ sopra soglia
// in una persona con ADHD racconta spesso l'ADHD, non un episodio ipomaniacale
// - la differenza è che l'ADHD c'è sempre stato, l'episodio ha un inizio.

const RIGHE = [
  ["How often do you have difficulty concentrating on what people are saying to you even when they are speaking to you directly?",
   "Quanto spesso fai fatica a concentrarti su quello che ti dicono, anche quando ti parlano direttamente?"],
  ["How often do you leave your seat in meetings or other situations in which you are expected to remain seated?",
   "Quanto spesso ti alzi dal posto in riunioni o in altre situazioni in cui ci si aspetta che tu resti seduto?"],
  ["How often do you have difficulty unwinding and relaxing when you have time to yourself?",
   "Quanto spesso fai fatica a staccare e a rilassarti quando hai del tempo per te?"],
  ["When you're in a conversation, how often do you find yourself finishing the sentences of the people you are talking to before they can finish them themselves?",
   "In una conversazione, quanto spesso ti ritrovi a finire le frasi degli altri prima che le finiscano loro?"],
  ["How often do you put things off until the last minute?",
   "Quanto spesso rimandi le cose all'ultimo minuto?"],
  ["How often do you depend on others to keep your life in order and attend to details?",
   "Quanto spesso dipendi dagli altri per tenere in ordine la tua vita e per badare ai dettagli?"],
];

export default {
  id: "asrs5",
  modulo: 6,
  nome: { it: "ASRS-5 — attenzione e irrequietezza", en: "ASRS-5 — adult ADHD screener" },
  fonte: "Ustun B et al. (2017). The World Health Organization Adult ADHD Self-Report Scale (ASRS-5). JAMA Psychiatry 74(5), 520-527.",
  licenza: "Strumento OMS, libero uso.",
  provenienza: "verbatim-noto",
  traduzioneValidata: false,
  finestra: { it: "negli ultimi 6 mesi", en: "over the past 6 months" },
  consegna: {
    it: "Negli ultimi sei mesi, quanto spesso ti è capitato quanto segue?",
    en: "Over the past 6 months, how often have the following happened?",
  },
  scala: {
    min: 0,
    max: 4,
    ancore: {
      it: ["Mai", "Raramente", "A volte", "Spesso", "Molto spesso"],
      en: ["Never", "Rarely", "Sometimes", "Often", "Very often"],
    },
  },
  item: RIGHE.map(([en, it], i) => ({
    id: "asrs5_" + String(i + 1).padStart(2, "0"),
    scala: "disattenzione",
    invertito: false,
    testo: { it, en },
  })),
  scale: {
    disattenzione: {
      nome: { it: "Disattenzione e irrequietezza (ASRS-5)", en: "Inattention and restlessness (ASRS-5)" },
      intervallo: [0, 24],
      omega: 0.83,
      soglia: 14,
      notaSoglia: {
        it: "Da 14 in su lo screening è considerato positivo. Vale come tutti gli screening: dice che vale la pena guardarci, non che c'è. E se qui e nell'MDQ sono usciti entrambi sopra soglia, il pezzo che serve a distinguerli non è un punteggio, è la storia: l'ADHD non ha un inizio, un episodio sì.",
        en: "From 14 upward the screen is positive. If this and the MDQ are both above cutoff, what separates them is not a score but the history: ADHD has no onset, an episode does.",
      },
    },
  },
};
