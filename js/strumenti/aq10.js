// AQ-10 — Autism Spectrum Quotient, versione breve per adulti
//
// Allison C, Auyeung B, Baron-Cohen S (2012). J Am Acad Child Adolesc
// Psychiatry 51(2), 202-212. Libero uso non commerciale.
//
// PERCHÉ STA IN QUESTA BATTERIA. Ritiro sociale, poca espressività, difficoltà
// a leggere le intenzioni degli altri: le stesse cose che sul versante
// psicotico si chiamano sintomi negativi. Sono descrizioni che si somigliano e
// storie che non si somigliano per niente. Senza questo modulo il profilo
// rischia di attribuire alla cosa sbagliata quello che vede altrove.
//
// PUNTEGGIO. Non è una somma delle risposte: ogni item vale 1 se la risposta
// cade dalla parte indicata (qualunque grado di accordo o di disaccordo), 0
// altrimenti. Metà degli item contano sull'accordo e metà sul disaccordo.

// [ en, it, lato che vale 1: "accordo" | "disaccordo" ]
const RIGHE = [
  ["I often notice small sounds when others do not.",
   "Noto spesso piccoli suoni che gli altri non sentono.", "accordo"],
  ["I usually concentrate more on the whole picture, rather than the small details.",
   "Di solito mi concentro sul quadro d'insieme piuttosto che sui piccoli dettagli.", "disaccordo"],
  ["I find it easy to do more than one thing at once.",
   "Mi riesce facile fare più cose contemporaneamente.", "disaccordo"],
  ["If there is an interruption, I can switch back to what I was doing very quickly.",
   "Se vengo interrotto, torno molto in fretta a quello che stavo facendo.", "disaccordo"],
  ["I find it easy to read between the lines when someone is talking to me.",
   "Mi riesce facile leggere fra le righe quando qualcuno mi parla.", "disaccordo"],
  ["I know how to tell if someone listening to me is getting bored.",
   "So capire se chi mi ascolta si sta annoiando.", "disaccordo"],
  ["When I'm reading a story I find it difficult to work out the characters' intentions.",
   "Quando leggo un racconto faccio fatica a capire le intenzioni dei personaggi.", "accordo"],
  ["I like to collect information about categories of things (e.g. types of car, types of bird, types of train, types of plant etc).",
   "Mi piace raccogliere informazioni su categorie di cose (tipi di auto, di uccelli, di treni, di piante…).", "accordo"],
  ["I find it easy to work out what someone is thinking or feeling just by looking at their face.",
   "Mi riesce facile capire cosa pensa o prova una persona solo guardandola in faccia.", "disaccordo"],
  ["I find it difficult to work out people's intentions.",
   "Faccio fatica a capire le intenzioni delle persone.", "accordo"],
];

export default {
  id: "aq10",
  modulo: 6,
  nome: { it: "AQ-10 — stile percettivo e sociale", en: "AQ-10 — autism spectrum quotient" },
  fonte: "Allison C, Auyeung B, Baron-Cohen S (2012). J Am Acad Child Adolesc Psychiatry 51(2), 202-212.",
  licenza: "Libero uso non commerciale.",
  provenienza: "verbatim-noto",
  traduzioneValidata: false,
  consegna: {
    it: "Quanto sei d'accordo con ognuna di queste frasi?",
    en: "How much do you agree with each of these statements?",
  },
  scala: {
    min: 1,
    max: 4,
    ancore: {
      it: ["Decisamente d'accordo", "Un po' d'accordo", "Un po' in disaccordo", "Decisamente in disaccordo"],
      en: ["Definitely agree", "Slightly agree", "Slightly disagree", "Definitely disagree"],
    },
  },
  item: RIGHE.map(([en, it, lato], i) => ({
    id: "aq10_" + String(i + 1).padStart(2, "0"),
    scala: "stileSociale",
    // Qui "invertito" non serve: il punteggio non è una somma della scala ma
    // un conteggio di lati, gestito da valuta().
    invertito: false,
    lato,
    testo: { it, en },
  })),
  scale: {
    stileSociale: {
      nome: { it: "Stile percettivo e sociale (AQ-10)", en: "Perceptual and social style (AQ-10)" },
      intervallo: [0, 10],
      omega: 0.7,
      soglia: 6,
      notaSoglia: {
        it: "Da 6 in su gli autori suggeriscono di approfondire. Su dieci item soli la misura è grossolana per costruzione: serve a dire «questa direzione vale la pena guardarla», non a dire cosa c'è.",
        en: "From 6 upward the authors suggest follow-up. On ten items the measure is coarse by design.",
      },
    },
  },
  // Punteggio a conteggio di lati, non a somma. Sta qui e non in punteggi.js
  // perché è una regola di questo strumento, non una regola generale.
  // Sommare la scala 1-4 come si fa con le altre darebbe un numero che sembra
  // un punteggio AQ-10 e non lo è: ogni item vale 1 o 0, non da 1 a 4.
  punteggioProprio(risposte) {
    let punti = 0;
    let risposti = 0;
    for (const it of this.item) {
      const v = Number(risposte[it.id]);
      if (!Number.isFinite(v)) continue;
      risposti++;
      const accordo = v <= 2; // 1-2 = accordo, 3-4 = disaccordo
      if ((it.lato === "accordo" && accordo) || (it.lato === "disaccordo" && !accordo)) punti++;
    }
    if (risposti < this.item.length * 0.8) {
      return { incompleta: true, risposti, totale: this.item.length, strumento: this.id, scala: "stileSociale" };
    }
    const def = this.scale.stileSociale;
    return {
      incompleta: false,
      strumento: this.id,
      scala: "stileSociale",
      somma: punti,
      media: punti / this.item.length,
      nItem: this.item.length,
      nRisposti: risposti,
      stimata: false,
      intervallo: def.intervallo,
      posizioneTeorica: punti / def.intervallo[1],
      omega: def.omega,
      soglia: def.soglia,
      sopraSoglia: punti >= def.soglia,
      fascia: null,
      normaMancante: true,
      // Nessuna banda: con item che valgono 0 o 1 la deviazione stimata dalle
      // risposte non vuol dire niente, e una banda finta è peggio di nessuna.
      banda: null,
      percentile: null,
    };
  },
};
