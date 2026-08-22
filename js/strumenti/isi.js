// ISI — Insomnia Severity Index
//
// Morin CM (1993, 2011). Libero per uso personale e di ricerca; l'uso
// commerciale richiede licenza.
//
// PERCHÉ STA IN QUESTA BATTERIA, E NON COME CONTORNO. Il sonno è il motore
// dello spettro bipolare: la riduzione del bisogno di dormire è uno dei
// segnali più specifici dell'ipomania, e la privazione di sonno da sola
// produce irritabilità, pensieri accelerati e - se spinta abbastanza -
// esperienze percettive che assomigliano a sintomi psicotici. Un profilo che
// vede attivazione o esperienze insolite senza sapere come dorme la persona
// sta leggendo un pezzo di frase.

const RIGHE = [
  ["Difficulty falling asleep", "Difficoltà ad addormentarti"],
  ["Difficulty staying asleep", "Difficoltà a restare addormentato"],
  ["Problem waking up too early", "Problema di svegliarti troppo presto"],
];

const VALUTAZIONI = [
  {
    id: "isi_04",
    en: "How satisfied/dissatisfied are you with your current sleep pattern?",
    it: "Quanto sei soddisfatto o insoddisfatto di come dormi in questo periodo?",
    ancoreIt: ["Molto soddisfatto", "Soddisfatto", "Nè l'uno nè l'altro", "Insoddisfatto", "Molto insoddisfatto"],
    ancoreEn: ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very dissatisfied"],
  },
  {
    id: "isi_05",
    en: "How noticeable to others do you think your sleeping problem is in terms of impairing the quality of your life?",
    it: "Quanto pensi che gli altri si accorgano che il tuo problema di sonno peggiora la qualità della tua vita?",
    ancoreIt: ["Per niente", "Un po'", "Abbastanza", "Molto", "Moltissimo"],
    ancoreEn: ["Not at all", "A little", "Somewhat", "Much", "Very much"],
  },
  {
    id: "isi_06",
    en: "How worried/distressed are you about your current sleep problem?",
    it: "Quanto sei preoccupato o in difficoltà per il tuo problema di sonno?",
    ancoreIt: ["Per niente", "Un po'", "Abbastanza", "Molto", "Moltissimo"],
    ancoreEn: ["Not at all", "A little", "Somewhat", "Much", "Very much"],
  },
  {
    id: "isi_07",
    en: "To what extent do you consider your sleep problem to interfere with your daily functioning currently?",
    it: "Quanto il problema di sonno ti disturba nelle cose di tutti i giorni?",
    ancoreIt: ["Per niente", "Un po'", "Abbastanza", "Molto", "Moltissimo"],
    ancoreEn: ["Not at all", "A little", "Somewhat", "Much", "Very much"],
  },
];

export default {
  id: "isi",
  modulo: 6,
  nome: { it: "ISI — come dormi", en: "ISI — Insomnia Severity Index" },
  fonte: "Morin CM et al. (2011). The Insomnia Severity Index. Sleep 34(5), 601-608.",
  licenza: "Libero per uso personale e di ricerca. Uso commerciale su licenza.",
  provenienza: "verbatim-noto",
  traduzioneValidata: false,
  finestra: { it: "nelle ultime 2 settimane", en: "in the last 2 weeks" },
  consegna: {
    it: "Pensando alle ultime due settimane, quanto sono stati gravi questi problemi di sonno?",
    en: "Thinking of the last two weeks, how severe have these sleep problems been?",
  },
  scala: {
    min: 0,
    max: 4,
    ancore: {
      it: ["Nessuno", "Lieve", "Moderato", "Grave", "Gravissimo"],
      en: ["None", "Mild", "Moderate", "Severe", "Very severe"],
    },
  },
  item: [
    ...RIGHE.map(([en, it], i) => ({
      id: "isi_" + String(i + 1).padStart(2, "0"),
      scala: "insonnia",
      invertito: false,
      testo: { it, en },
    })),
    // Gli ultimi quattro item hanno ancore proprie: si portano dietro le loro.
    ...VALUTAZIONI.map((v) => ({
      id: v.id,
      scala: "insonnia",
      invertito: false,
      tipo: "scelta",
      testo: { it: v.it, en: v.en },
      opzioni: v.ancoreEn.map((en, k) => ({
        valore: k,
        testo: { it: v.ancoreIt[k], en },
      })),
    })),
  ],
  scale: {
    insonnia: {
      nome: { it: "Gravità dell'insonnia (ISI)", en: "Insomnia severity (ISI)" },
      intervallo: [0, 28],
      omega: 0.9,
      fasce: [
        { fino: 7, it: "nessuna insonnia clinica", en: "no clinically significant insomnia" },
        { fino: 14, it: "sottosoglia", en: "subthreshold" },
        { fino: 21, it: "moderata", en: "moderate" },
        { fino: 28, it: "grave", en: "severe" },
      ],
      soglia: 15,
      notaSoglia: {
        it: "Da 15 in su l'insonnia è nella fascia in cui di solito si interviene. Vale la pena leggerlo insieme all'ASRM: dormire poco perché non ci si riesce e dormire poco senza sentirne il bisogno sono due cose diverse, e la seconda è quella che conta per lo spettro bipolare.",
        en: "From 15 upward insomnia is in the range usually treated. Read alongside the ASRM: sleeping little because you cannot, and sleeping little without missing it, are different things.",
      },
    },
  },
};
