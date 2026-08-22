// PC-PTSD-5 — Primary Care PTSD Screen for DSM-5
//
// Prins A et al. (2016). J Gen Intern Med 31(10), 1206-1211. Sviluppato dal
// National Center for PTSD del VA: dominio pubblico.
//
// PERCHÉ STA IN QUESTA BATTERIA. Perché il trauma produce quasi tutto quello
// che le altre scale misurano - ipervigilanza che somiglia alla paranoia,
// flashback e dissociazione che somigliano a esperienze psicotiche, distacco
// che somiglia ai sintomi negativi, insonnia e irritabilità che somigliano
// all'attivazione. È la spiegazione alternativa più frequente e la più spesso
// saltata.
//
// La prima domanda non fa punteggio: è un filtro. Se non c'è stato un evento,
// le cinque domande dopo non hanno oggetto e non vengono poste.

const RIGHE = [
  ["had nightmares about the event(s) or thought about the event(s) when you did not want to?",
   "hai avuto incubi sull'evento, o ci hai pensato quando non volevi?"],
  ["tried hard not to think about the event(s) or went out of your way to avoid situations that reminded you of the event(s)?",
   "hai fatto di tutto per non pensarci, o hai evitato le situazioni che te lo ricordavano?"],
  ["been constantly on guard, watchful, or easily startled?",
   "sei stato costantemente all'erta, guardingo, o ti sei spaventato facilmente?"],
  ["felt numb or detached from people, activities, or your surroundings?",
   "ti sei sentito intorpidito o distaccato dalle persone, dalle attività o da quello che ti circonda?"],
  ["felt guilty or unable to stop blaming yourself or others for the event(s) or any problems the event(s) may have caused?",
   "ti sei sentito in colpa, o non sei riuscito a smettere di dare la colpa a te stesso o ad altri per l'evento o per i problemi che ha causato?"],
];

export default {
  id: "pcptsd5",
  modulo: 6,
  nome: { it: "PC-PTSD-5 — dopo un evento difficile", en: "PC-PTSD-5 — trauma screen" },
  fonte: "Prins A et al. (2016). The Primary Care PTSD Screen for DSM-5. J Gen Intern Med 31(10), 1206-1211.",
  licenza: "Dominio pubblico (National Center for PTSD, US Dept. of Veterans Affairs).",
  provenienza: "verbatim-noto",
  traduzioneValidata: false,
  finestra: { it: "nell'ultimo mese", en: "in the past month" },
  consegna: {
    it: "A volte capitano cose che spaventano, sconvolgono o feriscono profondamente: un incidente grave, un incendio, un'aggressione, la guerra, il vedere qualcuno morire o restare ferito.",
    en: "Sometimes things happen that are extremely frightening, horrible or upsetting.",
  },
  scala: { min: 0, max: 1, ancore: { it: ["No", "Sì"], en: ["No", "Yes"] } },
  item: [
    {
      id: "pcptsd5_00",
      scala: "filtro",
      invertito: false,
      tipo: "sino",
      testo: {
        it: "Ti è mai capitata una cosa così?",
        en: "Have you ever experienced this kind of event?",
      },
    },
    ...RIGHE.map(([en, it], i) => ({
      id: "pcptsd5_" + String(i + 1).padStart(2, "0"),
      scala: "trauma",
      invertito: false,
      soloSe: { item: "pcptsd5_00", vale: 1 },
      testo: {
        it: "Nell'ultimo mese " + it,
        en: "In the past month, have you " + en,
      },
    })),
  ],
  scale: {
    trauma: {
      nome: { it: "Conseguenze di un evento (PC-PTSD-5)", en: "Trauma consequences (PC-PTSD-5)" },
      intervallo: [0, 5],
      omega: 0.8,
      soglia: 3,
      notaSoglia: {
        it: "Da 3 in su vale la pena approfondire. E se sono usciti sopra soglia anche altri moduli, questo va letto per primo: il trauma imita l'ipervigilanza paranoide, il distacco dei sintomi negativi e l'attivazione, e viene saltato più spesso di quanto si creda.",
        en: "From 3 upward follow-up is worthwhile. If other modules are also above cutoff, read this one first: trauma imitates paranoid hypervigilance, negative-symptom detachment, and activation.",
      },
    },
  },
};
