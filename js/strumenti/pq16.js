// PQ-16 — Prodromal Questionnaire, versione a 16 item
//
// Ising HK et al. (2012). The validity of the 16-item version of the Prodromal
// Questionnaire (PQ-16) to screen for ultra high risk of developing psychosis
// in the general help-seeking population. Schizophr Bull 38(6), 1288-1296.
//
// PROVENIENZA: ricostruito. Il testo degli item qui sotto è formulato a memoria
// e NON è stato confrontato con la fonte primaria in questa sessione. Prima di
// dare peso a un risultato, confronta gli item con il materiale supplementare
// di Ising et al. 2012. L'app mostra un avviso su ogni scala così marcata.
//
// SULLA SOGLIA. Il cutoff ≥6 ha sensibilità 87% e specificità 87%, ma quei
// numeri vengono da una popolazione che CERCA AIUTO in servizi di salute
// mentale, dove il rischio di base è alto. In popolazione generale la stessa
// soglia si comporta molto peggio: il valore predittivo positivo crolla. Chi
// compila questo test a casa non è nella popolazione in cui è stato validato.
// Il referto lo dice sempre, accanto al punteggio.

const RIGHE = [
  ["I feel uninterested in the things I used to enjoy.",
   "Mi sento senza interesse per le cose che prima mi piacevano."],
  ["I often seem to live through events exactly as they happened before (deja vu).",
   "Mi sembra spesso di rivivere situazioni esattamente come erano già successe (déjà vu)."],
  ["I sometimes smell or taste things that other people can't smell or taste.",
   "A volte sento odori o sapori che gli altri non sentono."],
  ["I often hear unusual sounds like banging, clicking, hissing, clapping or ringing in my ears.",
   "Sento spesso suoni insoliti nelle orecchie: colpi, scatti, sibili, battiti o fischi."],
  ["I have been confused at times whether something I experienced was real or imaginary.",
   "A volte mi sono confuso sul fatto che una cosa che ho vissuto fosse reale o immaginata."],
  ["When I look at a person, or look at myself in a mirror, I have seen the face change right before my eyes.",
   "Guardando una persona, o me stesso allo specchio, ho visto il viso cambiare davanti ai miei occhi."],
  ["I get extremely anxious when meeting people for the first time.",
   "Divento estremamente ansioso quando incontro persone per la prima volta."],
  ["I have seen things that other people apparently can't see.",
   "Ho visto cose che a quanto pare gli altri non riescono a vedere."],
  ["My thoughts are sometimes so strong that I can almost hear them.",
   "A volte i miei pensieri sono così forti che quasi riesco a sentirli."],
  ["I have thought that it might be possible that other people can read my mind, or that I can read others' minds.",
   "Ho pensato che forse gli altri possono leggermi nel pensiero, o che io posso leggere il pensiero degli altri."],
  ["I sometimes have felt that I'm not in control of my own ideas or thoughts.",
   "A volte ho sentito di non avere il controllo delle mie idee o dei miei pensieri."],
  ["I sometimes feel suddenly distracted by distant sounds that I am not normally aware of.",
   "A volte mi sento distratto all'improvviso da suoni lontani di cui di solito non mi accorgo."],
  ["I have heard things other people can't hear like voices of people whispering or talking.",
   "Ho sentito cose che gli altri non sentono, come voci di persone che sussurrano o parlano."],
  ["I often feel that others have it in for me.",
   "Ho spesso la sensazione che gli altri ce l'abbiano con me."],
  ["I have had the sense that some person or force is around me, even though I could not see anyone.",
   "Ho avuto la sensazione che ci fosse una persona o una forza intorno a me, pur non vedendo nessuno."],
  ["I feel that parts of my body have changed in some way, or that parts of my body are working differently than before.",
   "Sento che parti del mio corpo sono cambiate in qualche modo, o che funzionano diversamente da prima."],
];

export default {
  id: "pq16",
  modulo: 4,
  nome: { it: "PQ-16 — esperienze insolite", en: "PQ-16 — Prodromal Questionnaire" },
  fonte: "Ising HK et al. (2012). Schizophr Bull 38(6), 1288-1296.",
  licenza: "Libero uso di ricerca.",
  provenienza: "ricostruito",
  traduzioneValidata: false,
  finestra: { it: "nell'ultimo mese", en: "in the past month" },
  consegna: {
    it: "Ognuna di queste frasi ti è capitata nell'ultimo mese? Se sì, ti verrà chiesto anche quanto ti ha dato fastidio.",
    en: "Has each of these been true for you in the past month? If yes, you will also be asked how distressing it was.",
  },
  scala: { min: 0, max: 1, ancore: { it: ["No", "Sì"], en: ["No", "Yes"] } },
  // Ogni item positivo apre una seconda domanda sul disagio (0-3).
  disagio: {
    domanda: { it: "Quanto ti ha dato fastidio?", en: "How distressing was it?" },
    ancore: {
      it: ["Per niente", "Un po'", "Abbastanza", "Molto"],
      en: ["Not at all", "Mildly", "Moderately", "Severely"],
    },
  },
  item: RIGHE.map(([en, it], i) => ({
    id: "pq16_" + String(i + 1).padStart(2, "0"),
    scala: "esperienze",
    invertito: false,
    testo: { it, en },
    apreDisagio: true,
  })),
  scale: {
    esperienze: {
      nome: { it: "Esperienze insolite (PQ-16)", en: "Unusual experiences (PQ-16)" },
      intervallo: [0, 16],
      omega: 0.77,
      soglia: 6,
      notaSoglia: {
        it: "La soglia di 6 viene da chi si rivolge a un servizio di salute mentale, non dalla popolazione generale. Fuori da quel contesto la stragrande maggioranza di chi supera la soglia non ha e non svilupperà una psicosi. Le esperienze insolite sono comuni: circa una persona su venti ne riferisce qualcuna senza che significhi niente di clinico.",
        en: "The cutoff of 6 comes from a help-seeking population, not the general population. Outside that context the vast majority of people above the cutoff neither have nor will develop psychosis.",
      },
    },
  },
};
