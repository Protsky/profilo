// ASRM — Altman Self-Rating Mania Scale
//
// Altman EG, Hedeker D, Peterson JL, Davis JM (1997). Biol Psychiatry 42(10),
// 948-955. Libero uso per scopi clinici e di ricerca.
//
// Cinque item, ognuno con cinque frasi graduate invece di una scala di accordo:
// si sceglie la frase che descrive meglio l'ultima settimana. Misura lo STATO
// attuale, non la storia di vita - a differenza di MDQ e HCL-32, che chiedono
// "ti è mai capitato". Le due cose vanno lette insieme: un ASRM alto oggi con
// un MDQ negativo racconta una storia diversa da un ASRM basso con MDQ alto.

// Ogni item è una scaletta: indice = punteggio 0..4
const ITEM = [
  {
    chiave: "umore",
    en: [
      "I do not feel happier or more cheerful than usual.",
      "I occasionally feel happier or more cheerful than usual.",
      "I often feel happier or more cheerful than usual.",
      "I feel happier or more cheerful than usual most of the time.",
      "I feel happier or more cheerful than usual all of the time.",
    ],
    it: [
      "Non mi sento più felice o allegro del solito.",
      "Ogni tanto mi sento più felice o allegro del solito.",
      "Spesso mi sento più felice o allegro del solito.",
      "Mi sento più felice o allegro del solito quasi sempre.",
      "Mi sento più felice o allegro del solito tutto il tempo.",
    ],
  },
  {
    chiave: "sicurezzaDiSe",
    en: [
      "I do not feel more self-confident than usual.",
      "I occasionally feel more self-confident than usual.",
      "I often feel more self-confident than usual.",
      "I feel more self-confident than usual most of the time.",
      "I feel extremely self-confident all of the time.",
    ],
    it: [
      "Non mi sento più sicuro di me del solito.",
      "Ogni tanto mi sento più sicuro di me del solito.",
      "Spesso mi sento più sicuro di me del solito.",
      "Mi sento più sicuro di me del solito quasi sempre.",
      "Mi sento sicurissimo di me tutto il tempo.",
    ],
  },
  {
    chiave: "sonno",
    en: [
      "I do not need less sleep than usual.",
      "I occasionally need less sleep than usual.",
      "I often need less sleep than usual.",
      "I frequently need less sleep than usual.",
      "I can go all day and night without any sleep and still not feel tired.",
    ],
    it: [
      "Non ho bisogno di dormire meno del solito.",
      "Ogni tanto ho bisogno di dormire meno del solito.",
      "Spesso ho bisogno di dormire meno del solito.",
      "Ho spesso bisogno di dormire molto meno del solito.",
      "Posso stare un giorno e una notte senza dormire e non sentirmi comunque stanco.",
    ],
  },
  {
    chiave: "parlare",
    en: [
      "I do not talk more than usual.",
      "I occasionally talk more than usual.",
      "I often talk more than usual.",
      "I frequently talk more than usual.",
      "I talk constantly and cannot be interrupted.",
    ],
    it: [
      "Non parlo più del solito.",
      "Ogni tanto parlo più del solito.",
      "Spesso parlo più del solito.",
      "Parlo molto più del solito.",
      "Parlo continuamente e non mi si riesce a interrompere.",
    ],
  },
  {
    chiave: "attivita",
    en: [
      "I have not been more active (either socially, sexually, at work, home or school) than usual.",
      "I have occasionally been more active than usual.",
      "I have often been more active than usual.",
      "I have frequently been more active than usual.",
      "I am constantly active or on the go all the time.",
    ],
    it: [
      "Non sono stato più attivo del solito (a livello sociale, sessuale, al lavoro, a casa o a scuola).",
      "Ogni tanto sono stato più attivo del solito.",
      "Spesso sono stato più attivo del solito.",
      "Sono stato molto più attivo del solito.",
      "Sono continuamente in attività, sempre in movimento.",
    ],
  },
];

export default {
  id: "asrm",
  modulo: 5,
  nome: { it: "ASRM — attivazione dell'ultima settimana", en: "ASRM — Altman Self-Rating Mania Scale" },
  fonte: "Altman EG et al. (1997). The Altman Self-Rating Mania Scale. Biol Psychiatry 42(10), 948-955.",
  licenza: "Libero uso clinico e di ricerca.",
  provenienza: "verbatim-noto",
  traduzioneValidata: false,
  finestra: { it: "nell'ultima settimana", en: "over the past week" },
  consegna: {
    it: "Per ogni gruppo, scegli la frase che descrive meglio come ti sei sentito nell'ultima settimana.",
    en: "For each group, choose the statement that best describes the way you have been feeling over the past week.",
  },
  scala: { min: 0, max: 4, tipo: "frasi" },
  item: ITEM.map((g, i) => ({
    id: "asrm_" + String(i + 1),
    scala: "attivazione",
    invertito: false,
    tipo: "frasi",
    chiave: g.chiave,
    opzioni: g.en.map((en, k) => ({ valore: k, testo: { it: g.it[k], en } })),
    testo: { it: "", en: "" }, // il testo sta nelle opzioni
  })),
  scale: {
    attivazione: {
      nome: { it: "Attivazione maniacale attuale (ASRM)", en: "Current manic activation (ASRM)" },
      intervallo: [0, 20],
      omega: 0.79,
      soglia: 6,
      notaSoglia: {
        it: "Da 6 in su la scala segnala attivazione sopra la norma nell'ultima settimana. Da sola non dice nulla su un disturbo bipolare: dice che questa settimana è stata sopra il tuo solito.",
        en: "From 6 upward the scale flags above-normal activation in the past week. On its own it says nothing about bipolar disorder.",
      },
    },
  },
};
