// PID-5-BF — Personality Inventory for DSM-5, forma breve per adulti
//
// Krueger RF, Derringer J, Markon KE, Watson D, Skodol AE (2013). Pubblicato
// dall'American Psychiatric Association come misura di valutazione emergente
// del DSM-5: libero per uso clinico e di ricerca non commerciale.
//
// PROVENIENZA: ricostruito. Il testo degli item è formulato a memoria e non
// confrontato con la scheda APA in questa sessione. L'app lo dichiara e tratta
// il risultato come indicazione.
//
// NOTA SULLA VERSIONE ITALIANA. Esiste ed è validata (Fossati, Borroni, Somma,
// standardizzazione su 2143 adulti), ma è pubblicata da Raffaello Cortina ed è
// commerciale: gli item italiani di quella versione non si possono riprodurre
// qui. La traduzione sotto è nostra. Se il PID-5 ti serve sul serio, la
// versione italiana con le sue norme è quella, non questa.
//
// PERCHÉ STA IN QUESTA BATTERIA. È il ponte fra i due mondi che questo test
// tiene separati: i Big Five descrivono come sei, le scale cliniche cosa ti
// succede, e i cinque domini del PID-5 stanno esattamente in mezzo. Il dominio
// Psicoticismo, in particolare, è il modo in cui DSM-5 e ICD-11 trattano il
// terreno psicotico come tratto continuo invece che come categoria - la stessa
// idea che il modello HiTOP porta più avanti.

// dominio | testo inglese | traduzione
const RIGHE = [
  ["disinibizione", "People would describe me as reckless.",
   "Gli altri mi descriverebbero come uno che si butta senza pensarci."],
  ["disinibizione", "I feel like I act totally on impulse.",
   "Mi sembra di agire completamente d'impulso."],
  ["disinibizione", "Even though I know better, I can't stop making rash decisions.",
   "Anche sapendo che non va, non riesco a smettere di prendere decisioni avventate."],
  ["distacco", "I often feel like nothing I do really matters.",
   "Spesso ho la sensazione che niente di quello che faccio conti davvero."],
  ["disinibizione", "Others see me as irresponsible.",
   "Gli altri mi vedono come una persona inaffidabile."],
  ["disinibizione", "I'm not good at planning ahead.",
   "Non sono bravo a programmare in anticipo."],
  ["psicoticismo", "My thoughts often don't make sense to others.",
   "I miei pensieri spesso non hanno senso per gli altri."],
  ["affettivitaNegativa", "I worry about almost everything.",
   "Mi preoccupo di quasi tutto."],
  ["affettivitaNegativa", "I get emotional easily, often for very little reason.",
   "Mi commuovo o mi altero facilmente, spesso per pochissimo."],
  ["affettivitaNegativa", "I fear being alone in life more than anything else.",
   "Temo di restare solo nella vita più di qualunque altra cosa."],
  ["affettivitaNegativa", "I get stuck on one way of doing things, even when it's clear it won't work.",
   "Mi fisso su un modo di fare le cose, anche quando è chiaro che non funzionerà."],
  ["psicoticismo", "I have seen things that weren't really there.",
   "Ho visto cose che non c'erano davvero."],
  ["distacco", "I steer clear of romantic relationships.",
   "Sto alla larga dalle relazioni sentimentali."],
  ["distacco", "I'm not interested in making friends.",
   "Non mi interessa fare amicizia."],
  ["affettivitaNegativa", "I get irritated easily by all sorts of things.",
   "Mi irrito facilmente per ogni genere di cosa."],
  ["distacco", "I don't like to get too close to people.",
   "Non mi piace avvicinarmi troppo alle persone."],
  ["antagonismo", "It's no big deal if I hurt other people's feelings.",
   "Non è un gran problema se ferisco i sentimenti degli altri."],
  ["distacco", "I rarely get enthusiastic about anything.",
   "Mi entusiasmo raramente per qualcosa."],
  ["antagonismo", "I crave attention.",
   "Ho un gran bisogno di attenzione."],
  ["antagonismo", "I often have to deal with people who are less important than me.",
   "Mi tocca spesso avere a che fare con persone meno importanti di me."],
  ["psicoticismo", "I often have thoughts that make sense to me but that other people say are strange.",
   "Ho spesso pensieri che per me hanno senso ma che gli altri dicono siano strani."],
  ["antagonismo", "I use people to get what I want.",
   "Uso le persone per ottenere quello che voglio."],
  ["psicoticismo", "I often zone out and then suddenly come to and realize that a lot of time has passed.",
   "Mi capita spesso di assentarmi e poi accorgermi di colpo che è passato molto tempo."],
  ["psicoticismo", "Things around me often feel unreal, or more real than usual.",
   "Le cose intorno a me spesso sembrano irreali, oppure più reali del solito."],
  ["antagonismo", "It is easy for me to take advantage of others.",
   "Mi viene facile approfittare degli altri."],
];

export const DOMINI = {
  affettivitaNegativa: { it: "Affettività negativa", en: "Negative affect" },
  distacco: { it: "Distacco", en: "Detachment" },
  antagonismo: { it: "Antagonismo", en: "Antagonism" },
  disinibizione: { it: "Disinibizione", en: "Disinhibition" },
  psicoticismo: { it: "Psicoticismo", en: "Psychoticism" },
};

const scaleDa = () => {
  const s = {};
  for (const [chiave, nome] of Object.entries(DOMINI)) {
    s[chiave] = {
      nome: { it: nome.it + " (PID-5)", en: nome.en + " (PID-5)" },
      intervallo: [0, 15],
      omega: 0.75,
      // Nessuna soglia: il PID-5 non è uno screening a cutoff, è un profilo di
      // tratti. Mettere una soglia dove gli autori non ne mettono vorrebbe dire
      // trasformare una dimensione in una categoria, che è esattamente la cosa
      // che questo modello è nato per non fare.
    };
  }
  return s;
};

export default {
  id: "pid5bf",
  modulo: 2,
  nome: { it: "PID-5-BF — i cinque tratti del DSM-5", en: "PID-5-BF — DSM-5 trait domains" },
  fonte: "Krueger RF, Derringer J, Markon KE, Watson D, Skodol AE (2013). The Personality Inventory for DSM-5 - Brief Form (PID-5-BF). American Psychiatric Association.",
  licenza: "Libero per uso clinico e di ricerca non commerciale (APA).",
  provenienza: "ricostruito",
  traduzioneValidata: false,
  consegna: {
    it: "Quanto ti descrivono queste frasi, in generale?",
    en: "How well do these statements describe you, in general?",
  },
  scala: {
    min: 0,
    max: 3,
    ancore: {
      it: ["Per niente vero", "Poco vero", "Abbastanza vero", "Molto vero"],
      en: ["Very false", "Somewhat false", "Somewhat true", "Very true"],
    },
  },
  domini: DOMINI,
  item: RIGHE.map(([scala, en, it], i) => ({
    id: "pid5_" + String(i + 1).padStart(2, "0"),
    scala,
    invertito: false, // nessun item invertito nella forma breve
    testo: { it, en },
  })),
  scale: scaleDa(),
};
