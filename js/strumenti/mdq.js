// MDQ — Mood Disorder Questionnaire
//
// Hirschfeld RMA et al. (2000). Am J Psychiatry 157(11), 1873-1875.
// Libero uso non commerciale.
//
// IL PUNTO CHE QUASI TUTTI SBAGLIANO. L'MDQ non è "conta i sì e vedi se sono
// almeno sette". Lo screening è positivo solo se valgono TUTTE E TRE le
// condizioni:
//   1. almeno 7 sì sui 13 sintomi
//   2. Q2: più sintomi presenti NELLO STESSO periodo
//   3. Q3: i sintomi hanno causato un problema moderato o serio
// I siti che chiedono solo i 13 sintomi producono valanghe di falsi positivi,
// perché "mi è capitato di dormire poco" e "mi è capitato di essere irritabile"
// in due anni diversi non sono un episodio: sono la vita.
//
// E anche fatto bene resta uno screening con specificità ~70%. Vedi
// js/predittivo.js per il conto del valore predittivo, che il referto mostra
// sempre accanto all'esito.

const SINTOMI = [
  ["you felt so good or so hyper that other people thought you were not your normal self, or you were so hyper that you got into trouble?",
   "ti sei sentito così bene o così su di giri che gli altri hanno pensato che non eri te stesso, oppure eri così su di giri da finire nei guai?"],
  ["you were so irritable that you shouted at people or started fights or arguments?",
   "eri così irritabile da urlare contro le persone o da attaccare litigi?"],
  ["you felt much more self-confident than usual?",
   "ti sei sentito molto più sicuro di te del solito?"],
  ["you got much less sleep than usual and found you didn't really miss it?",
   "hai dormito molto meno del solito senza sentirne davvero la mancanza?"],
  ["you were much more talkative or spoke much faster than usual?",
   "parlavi molto più del solito o molto più in fretta del solito?"],
  ["thoughts raced through your head or you couldn't slow your mind down?",
   "i pensieri ti correvano in testa e non riuscivi a rallentare la mente?"],
  ["you were so easily distracted by things around you that you had trouble concentrating or staying on track?",
   "ti distraevi così facilmente per quello che avevi intorno da fare fatica a concentrarti o a restare sul filo?"],
  ["you had much more energy than usual?",
   "avevi molta più energia del solito?"],
  ["you were much more active or did many more things than usual?",
   "eri molto più attivo o facevi molte più cose del solito?"],
  ["you were much more social or outgoing than usual, for example, you telephoned friends in the middle of the night?",
   "eri molto più socievole o estroverso del solito, per esempio telefonavi agli amici nel cuore della notte?"],
  ["you were much more interested in sex than usual?",
   "eri molto più interessato al sesso del solito?"],
  ["you did things that were unusual for you or that other people might have thought were excessive, foolish, or risky?",
   "hai fatto cose insolite per te, o che gli altri avrebbero potuto giudicare eccessive, sciocche o rischiose?"],
  ["spending money got you or your family into trouble?",
   "spendere soldi ha messo te o la tua famiglia nei guai?"],
];

export default {
  id: "mdq",
  modulo: 5,
  nome: { it: "MDQ — episodi di attivazione nella vita", en: "MDQ — Mood Disorder Questionnaire" },
  fonte: "Hirschfeld RMA et al. (2000). Development and validation of a screening instrument for bipolar spectrum disorder. Am J Psychiatry 157(11), 1873-1875.",
  licenza: "Libero uso non commerciale.",
  provenienza: "verbatim-noto",
  traduzioneValidata: false,
  finestra: { it: "in qualunque momento della tua vita", en: "at any time in your life" },
  consegna: {
    it: "C'è mai stato un periodo della tua vita in cui non eri te stesso e...",
    en: "Has there ever been a period of time when you were not your usual self and...",
  },
  scala: {
    min: 0,
    max: 1,
    ancore: { it: ["No", "Sì"], en: ["No", "Yes"] },
  },
  item: [
    ...SINTOMI.map(([en, it], i) => ({
      id: "mdq_" + String(i + 1).padStart(2, "0"),
      scala: "sintomi",
      invertito: false,
      testo: { it, en },
    })),
    {
      id: "mdq_q2",
      scala: "contemporaneita",
      invertito: false,
      tipo: "sino",
      soloSe: { scala: "sintomi", almeno: 2 }, // ha senso solo con più di un sì
      testo: {
        it: "Se hai risposto Sì a più di una domanda, diverse di queste cose sono mai successe NELLO STESSO periodo?",
        en: "If you checked YES to more than one of the above, have several of these ever happened during the same period of time?",
      },
    },
    {
      id: "mdq_q3",
      scala: "compromissione",
      invertito: false,
      tipo: "scelta",
      opzioni: [
        { valore: 0, testo: { it: "Nessun problema", en: "No problem" } },
        { valore: 1, testo: { it: "Un problema piccolo", en: "Minor problem" } },
        { valore: 2, testo: { it: "Un problema moderato", en: "Moderate problem" } },
        { valore: 3, testo: { it: "Un problema serio", en: "Serious problem" } },
      ],
      testo: {
        it: "Quanto problema ti hanno creato queste cose? Per esempio: non riuscire a lavorare, guai in famiglia, guai di soldi o legali, litigi o risse.",
        en: "How much of a problem did any of these cause you - like being unable to work; having family, money or legal troubles; getting into arguments or fights?",
      },
    },
  ],
  scale: {
    sintomi: {
      nome: { it: "Sintomi di attivazione (MDQ)", en: "Activation symptoms (MDQ)" },
      intervallo: [0, 13],
      omega: 0.9,
      soglia: 7,
    },
  },
  // Regola di screening completa: le tre condizioni insieme.
  // Restituisce {positivo, sintomi, q2, q3, motivo}.
  valuta(risposte) {
    const conta = (pre) =>
      Object.keys(risposte)
        .filter((k) => k.startsWith(pre))
        .reduce((s, k) => s + (Number(risposte[k]) || 0), 0);
    const sintomi = conta("mdq_") - (Number(risposte.mdq_q2) || 0) - (Number(risposte.mdq_q3) || 0);
    const q2 = Number(risposte.mdq_q2) === 1;
    const q3 = Number(risposte.mdq_q3) >= 2;
    const positivo = sintomi >= 7 && q2 && q3;
    let motivo;
    if (positivo) {
      motivo = { it: "Tutte e tre le condizioni sono soddisfatte.", en: "All three conditions met." };
    } else if (sintomi >= 7 && !q2) {
      motivo = {
        it: "Sette o più sintomi, ma non nello stesso periodo. È la condizione che distingue un episodio da una somma di momenti sparsi in anni diversi.",
        en: "Seven or more symptoms, but not within the same period.",
      };
    } else if (sintomi >= 7 && q2 && !q3) {
      motivo = {
        it: "Sintomi presenti e contemporanei, ma senza un problema moderato o serio nella vita di tutti i giorni. Un tratto senza compromissione non è un disturbo.",
        en: "Symptoms co-occurring, but without moderate or serious impairment.",
      };
    } else {
      motivo = { it: "Meno di sette sintomi.", en: "Fewer than seven symptoms." };
    }
    return { positivo, sintomi, q2, q3: Number(risposte.mdq_q3) || 0, motivo };
  },
};
