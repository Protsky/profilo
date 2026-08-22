// AUDIT-C — le prime tre domande dell'Alcohol Use Disorders Identification Test
//
// Bush K et al. (1998). Arch Intern Med 158(16), 1789-1795, a partire dall'AUDIT
// dell'OMS (Saunders et al., 1993). Libero uso.
//
// PERCHÉ STA IN QUESTA BATTERIA. Perché l'alcol è la spiegazione alternativa
// più banale e più frequente di quasi tutto il resto: umore che crolla, sonno
// rotto, irritabilità, e - in astinenza - vere esperienze percettive. Un
// profilo che non lo chiede attribuisce all'umore quello che appartiene al
// bicchiere, e viceversa.
//
// SULLA SOGLIA. Le soglie pubblicate sono diverse per uomini (4) e donne (3),
// perché a parità di consumo l'alcolemia non è la stessa. Qui la soglia si
// sceglie all'inizio; se non viene indicato nulla si usa la più prudente.

const DOMANDE = [
  {
    id: "auditc_1",
    en: "How often do you have a drink containing alcohol?",
    it: "Quanto spesso bevi qualcosa che contiene alcol?",
    opzEn: ["Never", "Monthly or less", "2-4 times a month", "2-3 times a week", "4 or more times a week"],
    opzIt: ["Mai", "Una volta al mese o meno", "2-4 volte al mese", "2-3 volte a settimana", "4 o più volte a settimana"],
  },
  {
    id: "auditc_2",
    en: "How many standard drinks containing alcohol do you have on a typical day when you are drinking?",
    it: "In una giornata tipo in cui bevi, quanti bicchieri standard bevi?",
    opzEn: ["1 or 2", "3 or 4", "5 or 6", "7 to 9", "10 or more"],
    opzIt: ["1 o 2", "3 o 4", "5 o 6", "da 7 a 9", "10 o più"],
  },
  {
    id: "auditc_3",
    en: "How often do you have six or more drinks on one occasion?",
    it: "Quanto spesso ti capita di bere sei o più bicchieri in una sola occasione?",
    opzEn: ["Never", "Less than monthly", "Monthly", "Weekly", "Daily or almost daily"],
    opzIt: ["Mai", "Meno di una volta al mese", "Una volta al mese", "Una volta a settimana", "Ogni giorno o quasi"],
  },
];

export default {
  id: "auditc",
  modulo: 6,
  nome: { it: "AUDIT-C — alcol", en: "AUDIT-C — alcohol use" },
  fonte: "Bush K et al. (1998). The AUDIT alcohol consumption questions (AUDIT-C). Arch Intern Med 158(16), 1789-1795.",
  licenza: "Libero uso (OMS).",
  provenienza: "verbatim-noto",
  traduzioneValidata: false,
  consegna: {
    it: "Un bicchiere standard è circa un calice di vino, una birra piccola o un bicchierino di superalcolico.",
    en: "A standard drink is roughly a glass of wine, a small beer, or a shot of spirits.",
  },
  scala: { min: 0, max: 4 },
  item: DOMANDE.map((d) => ({
    id: d.id,
    scala: "alcol",
    invertito: false,
    tipo: "scelta",
    testo: { it: d.it, en: d.en },
    opzioni: d.opzEn.map((en, k) => ({ valore: k, testo: { it: d.opzIt[k], en } })),
  })),
  scale: {
    alcol: {
      nome: { it: "Consumo di alcol (AUDIT-C)", en: "Alcohol use (AUDIT-C)" },
      intervallo: [0, 12],
      omega: 0.78,
      soglia: 3, // la più prudente delle due soglie pubblicate
      notaSoglia: {
        it: "Le soglie pubblicate sono 4 per gli uomini e 3 per le donne: qui è usata la più prudente. Sopra soglia non vuol dire dipendenza, vuol dire un consumo che in letteratura si associa a danni - e che basta a spiegare da solo sonno rotto, umore in altalena e irritabilità.",
        en: "Published cutoffs are 4 for men and 3 for women; the more cautious one is used here. Above cutoff does not mean dependence.",
      },
    },
  },
};
