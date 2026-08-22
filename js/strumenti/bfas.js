// BFAS — Big Five Aspect Scales (DeYoung, Quilty & Peterson, 2007)
//
// Fonte degli item inglesi: JPSP 93(5), 880-896, Table 4 "The Big Five Aspect
// Scales", trascritti verbatim dal paper. Dominio pubblico: gli item vengono
// dall'International Personality Item Pool e gli autori stessi scrivono che
// "use of the IPIP allowed us to create a public domain instrument".
//
// ATTENZIONE alla chiave di inversione. Il PDF che gira in rete
// (goodmedicine.org.uk/media/files/assessment,%20big%205%20aspects.pdf) alterna
// le italiche in modo meccanico e marca come invertiti tre item che nel paper
// NON lo sono:
//   volatilita  10  "Can be stirred up easily"         loading +.70
//   cortesia     5  "Avoid imposing my will on others"  loading +.42
//   cortesia     6  "Rarely put people under pressure"  loading +.48
// Quei tre nel paper hanno il footnote (a): erano invertiti nel campione ESCS
// ma sono stati ri-orientati nella versione finale. Chi copia da quel PDF
// calcola male Volatilità e Cortesia. Qui vale la Table 4.
//
// Traduzione italiana: nostra, NON validata. Una validazione italiana esiste
// (Haehner et al. 2025, N=4492 adulti svizzeri) ma il testo degli item di
// quello studio non è pubblico, quindi non è quella la traduzione usata qui.

// aspetto | invertito | originale inglese | traduzione italiana
const RIGHE = [
  // --- Volatilita (Nevroticismo) ---
  ["volatilita", 0, "Get angry easily.", "Mi arrabbio facilmente."],
  ["volatilita", 1, "Rarely get irritated.", "Mi irrito raramente."],
  ["volatilita", 0, "Get upset easily.", "Mi turbo facilmente."],
  ["volatilita", 1, "Keep my emotions under control.", "Tengo le emozioni sotto controllo."],
  ["volatilita", 0, "Change my mood a lot.", "Cambio umore spesso."],
  ["volatilita", 1, "Rarely lose my composure.", "Perdo raramente la calma."],
  ["volatilita", 0, "Am a person whose moods go up and down easily.", "Sono una persona il cui umore sale e scende facilmente."],
  ["volatilita", 1, "Am not easily annoyed.", "Non mi infastidisco facilmente."],
  ["volatilita", 0, "Get easily agitated.", "Mi agito facilmente."],
  ["volatilita", 0, "Can be stirred up easily.", "Basta poco per farmi accendere."],

  // --- Ritiro (Nevroticismo) ---
  ["ritiro", 1, "Seldom feel blue.", "Mi sento raramente giù di morale."],
  ["ritiro", 0, "Am filled with doubts about things.", "Sono pieno di dubbi sulle cose."],
  ["ritiro", 1, "Feel comfortable with myself.", "Mi sento a mio agio con me stesso."],
  ["ritiro", 0, "Feel threatened easily.", "Mi sento minacciato facilmente."],
  ["ritiro", 1, "Rarely feel depressed.", "Mi sento raramente depresso."],
  ["ritiro", 0, "Worry about things.", "Mi preoccupo delle cose."],
  ["ritiro", 0, "Am easily discouraged.", "Mi scoraggio facilmente."],
  ["ritiro", 1, "Am not embarrassed easily.", "Non mi imbarazzo facilmente."],
  ["ritiro", 0, "Become overwhelmed by events.", "Mi lascio sopraffare dagli eventi."],
  ["ritiro", 0, "Am afraid of many things.", "Ho paura di molte cose."],

  // --- Compassione (Amicalita) ---
  ["compassione", 1, "Am not interested in other people's problems.", "Non mi interessano i problemi degli altri."],
  ["compassione", 0, "Feel others' emotions.", "Sento le emozioni degli altri."],
  ["compassione", 0, "Inquire about others' well-being.", "Mi informo su come stanno gli altri."],
  ["compassione", 1, "Can't be bothered with other's needs.", "Non ho voglia di occuparmi dei bisogni degli altri."],
  ["compassione", 0, "Sympathize with others' feelings.", "Partecipo ai sentimenti degli altri."],
  ["compassione", 1, "Am indifferent to the feelings of others.", "Sono indifferente ai sentimenti degli altri."],
  ["compassione", 1, "Take no time for others.", "Non dedico tempo agli altri."],
  ["compassione", 0, "Take an interest in other people's lives.", "Mi interesso alla vita degli altri."],
  ["compassione", 1, "Don't have a soft side.", "Non ho un lato tenero."],
  ["compassione", 0, "Like to do things for others.", "Mi piace fare cose per gli altri."],

  // --- Cortesia (Amicalita) ---
  ["cortesia", 0, "Respect authority.", "Rispetto l'autorità."],
  ["cortesia", 1, "Insult people.", "Insulto le persone."],
  ["cortesia", 0, "Hate to seem pushy.", "Detesto sembrare invadente."],
  ["cortesia", 1, "Believe that I am better than others.", "Credo di essere migliore degli altri."],
  ["cortesia", 0, "Avoid imposing my will on others.", "Evito di imporre la mia volontà agli altri."],
  ["cortesia", 0, "Rarely put people under pressure.", "Metto raramente le persone sotto pressione."],
  ["cortesia", 1, "Take advantage of others.", "Approfitto degli altri."],
  ["cortesia", 1, "Seek conflict.", "Cerco il conflitto."],
  ["cortesia", 1, "Love a good fight.", "Amo un bel litigio."],
  ["cortesia", 1, "Am out for my own personal gain.", "Punto al mio tornaconto personale."],

  // --- Operosita (Coscienziosita) ---
  ["operosita", 0, "Carry out my plans.", "Porto a termine i miei progetti."],
  ["operosita", 1, "Waste my time.", "Perdo tempo."],
  ["operosita", 1, "Find it difficult to get down to work.", "Faccio fatica a mettermi al lavoro."],
  ["operosita", 1, "Mess things up.", "Combino pasticci."],
  ["operosita", 0, "Finish what I start.", "Finisco quello che comincio."],
  ["operosita", 1, "Don't put my mind on the task at hand.", "Non metto la testa su quello che sto facendo."],
  ["operosita", 0, "Get things done quickly.", "Sbrigo le cose in fretta."],
  ["operosita", 0, "Always know what I am doing.", "So sempre quello che sto facendo."],
  ["operosita", 1, "Postpone decisions.", "Rimando le decisioni."],
  ["operosita", 1, "Am easily distracted.", "Mi distraggo facilmente."],

  // --- Ordine (Coscienziosita) ---
  ["ordine", 1, "Leave my belongings around.", "Lascio le mie cose in giro."],
  ["ordine", 0, "Like order.", "Mi piace l'ordine."],
  ["ordine", 0, "Keep things tidy.", "Tengo le cose in ordine."],
  ["ordine", 0, "Follow a schedule.", "Seguo un programma."],
  ["ordine", 1, "Am not bothered by messy people.", "Le persone disordinate non mi danno fastidio."],
  ["ordine", 0, "Want everything to be just right.", "Voglio che tutto sia a posto come si deve."],
  ["ordine", 1, "Am not bothered by disorder.", "Il disordine non mi dà fastidio."],
  ["ordine", 1, "Dislike routine.", "Non mi piace la routine."],
  ["ordine", 0, "See that rules are observed.", "Bado che le regole vengano rispettate."],
  ["ordine", 0, "Want every detail taken care of.", "Voglio che ogni dettaglio sia curato."],

  // --- Entusiasmo (Estroversione) ---
  ["entusiasmo", 0, "Make friends easily.", "Faccio amicizia facilmente."],
  ["entusiasmo", 1, "Am hard to get to know.", "Sono difficile da conoscere."],
  ["entusiasmo", 1, "Keep others at a distance.", "Tengo gli altri a distanza."],
  ["entusiasmo", 1, "Reveal little about myself.", "Rivelo poco di me."],
  ["entusiasmo", 0, "Warm up quickly to others.", "Mi apro in fretta con gli altri."],
  ["entusiasmo", 1, "Rarely get caught up in the excitement.", "Mi lascio raramente prendere dall'entusiasmo."],
  ["entusiasmo", 1, "Am not a very enthusiastic person.", "Non sono una persona molto entusiasta."],
  ["entusiasmo", 0, "Show my feelings when I'm happy.", "Mostro quello che provo quando sono felice."],
  ["entusiasmo", 0, "Have a lot of fun.", "Mi diverto molto."],
  ["entusiasmo", 0, "Laugh a lot.", "Rido molto."],

  // --- Assertivita (Estroversione) ---
  ["assertivita", 0, "Take charge.", "Prendo in mano la situazione."],
  ["assertivita", 0, "Have a strong personality.", "Ho una personalità forte."],
  ["assertivita", 1, "Lack the talent for influencing people.", "Non ho il talento per influenzare le persone."],
  ["assertivita", 0, "Know how to captivate people.", "So come conquistare le persone."],
  ["assertivita", 1, "Wait for others to lead the way.", "Aspetto che siano gli altri a fare strada."],
  ["assertivita", 0, "See myself as a good leader.", "Mi vedo come un buon leader."],
  ["assertivita", 0, "Can talk others into doing things.", "So convincere gli altri a fare le cose."],
  ["assertivita", 1, "Hold back my opinions.", "Trattengo le mie opinioni."],
  ["assertivita", 0, "Am the first to act.", "Sono il primo ad agire."],
  ["assertivita", 1, "Do not have an assertive personality.", "Non ho una personalità assertiva."],

  // --- Intelletto (Apertura) ---
  ["intelletto", 0, "Am quick to understand things.", "Capisco le cose in fretta."],
  ["intelletto", 1, "Have difficulty understanding abstract ideas.", "Ho difficoltà a capire le idee astratte."],
  ["intelletto", 0, "Can handle a lot of information.", "Riesco a gestire molte informazioni."],
  ["intelletto", 0, "Like to solve complex problems.", "Mi piace risolvere problemi complessi."],
  ["intelletto", 1, "Avoid philosophical discussions.", "Evito le discussioni filosofiche."],
  ["intelletto", 1, "Avoid difficult reading material.", "Evito le letture difficili."],
  ["intelletto", 0, "Have a rich vocabulary.", "Ho un vocabolario ricco."],
  ["intelletto", 0, "Think quickly.", "Penso in fretta."],
  ["intelletto", 1, "Learn things slowly.", "Imparo le cose lentamente."],
  ["intelletto", 0, "Formulate ideas clearly.", "Formulo le idee con chiarezza."],

  // --- Apertura (Apertura) ---
  ["apertura", 0, "Enjoy the beauty of nature.", "Godo della bellezza della natura."],
  ["apertura", 0, "Believe in the importance of art.", "Credo nell'importanza dell'arte."],
  ["apertura", 0, "Love to reflect on things.", "Amo riflettere sulle cose."],
  ["apertura", 0, "Get deeply immersed in music.", "Mi immergo profondamente nella musica."],
  ["apertura", 1, "Do not like poetry.", "Non mi piace la poesia."],
  ["apertura", 0, "See beauty in things that others might not notice.", "Vedo bellezza in cose che altri potrebbero non notare."],
  ["apertura", 0, "Need a creative outlet.", "Ho bisogno di uno sfogo creativo."],
  ["apertura", 1, "Seldom get lost in thought.", "Mi perdo raramente nei miei pensieri."],
  ["apertura", 1, "Seldom daydream.", "Sogno raramente a occhi aperti."],
  ["apertura", 1, "Seldom notice the emotional aspects of paintings and pictures.", "Noto raramente il lato emotivo dei quadri e delle immagini."],
];

// Gli aspetti, e a quale dominio dei Big Five appartengono.
export const ASPETTI = {
  volatilita:  { it: "Volatilità",  en: "Volatility",      dominio: "nevroticismo" },
  ritiro:      { it: "Ritiro",      en: "Withdrawal",      dominio: "nevroticismo" },
  compassione: { it: "Compassione", en: "Compassion",      dominio: "amicalita" },
  cortesia:    { it: "Cortesia",    en: "Politeness",      dominio: "amicalita" },
  operosita:   { it: "Operosità",   en: "Industriousness", dominio: "coscienziosita" },
  ordine:      { it: "Ordine",      en: "Orderliness",     dominio: "coscienziosita" },
  entusiasmo:  { it: "Entusiasmo",  en: "Enthusiasm",      dominio: "estroversione" },
  assertivita: { it: "Assertività", en: "Assertiveness",   dominio: "estroversione" },
  intelletto:  { it: "Intelletto",  en: "Intellect",       dominio: "aperturaMentale" },
  apertura:    { it: "Apertura",    en: "Openness",        dominio: "aperturaMentale" },
};

export const DOMINI = {
  nevroticismo:    { it: "Nevroticismo",     en: "Neuroticism" },
  amicalita:       { it: "Amicalità",        en: "Agreeableness" },
  coscienziosita:  { it: "Coscienziosità",   en: "Conscientiousness" },
  estroversione:   { it: "Estroversione",    en: "Extraversion" },
  aperturaMentale: { it: "Apertura mentale", en: "Openness/Intellect" },
};

export default {
  id: "bfas",
  modulo: 1,
  nome: { it: "BFAS — i dieci aspetti dei Big Five", en: "BFAS — Big Five Aspect Scales" },
  fonte:
    "DeYoung, Quilty & Peterson (2007). Between facets and domains: 10 aspects " +
    "of the Big Five. J Pers Soc Psychol 93(5), 880-896, Table 4.",
  licenza: "Dominio pubblico (item derivati dall'International Personality Item Pool).",
  originaleVerbatim: true, // item EN trascritti dal paper
  traduzioneValidata: false, // item IT nostri
  consegna: {
    it: "Quanto ogni frase descrive come sei di solito? Non c'è una risposta giusta: vale quello che ti somiglia di più.",
    en: "How accurately does each statement describe how you generally are? There is no right answer.",
  },
  scala: {
    min: 1,
    max: 5,
    ancore: {
      it: ["Molto in disaccordo", "In disaccordo", "Né l'uno né l'altro", "D'accordo", "Molto d'accordo"],
      en: ["Strongly disagree", "Disagree", "Neither", "Agree", "Strongly agree"],
    },
  },
  aspetti: ASPETTI,
  domini: DOMINI,
  item: RIGHE.map(([scala, invertito, en, it], i) => ({
    id: "bfas_" + String(i + 1).padStart(3, "0"),
    scala,
    invertito: invertito === 1,
    testo: { it, en },
  })),
};
