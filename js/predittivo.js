// Valore predittivo di uno screening.
//
// È il pezzo che manca a ogni test online, ed è il motivo per cui questo
// progetto esiste. Un punteggio sopra soglia non vuol dire "ce l'hai". Quanto
// valga davvero dipende da tre numeri: sensibilità, specificità e - soprattutto
// - quanto è diffusa la condizione fra chi fa il test.
//
// Esempio, MDQ (sens .80, spec .70) su 1000 persone con prevalenza 2%:
//   malati veri      20  ->  16 positivi (veri positivi)
//   sani            980  -> 294 positivi (falsi positivi)
//   totale positivi 310  ->  valore predittivo positivo = 16/310 = 5%
// Su 100 persone sopra soglia, 5 hanno davvero il disturbo. Le altre 95 no.
//
// Con la stessa scala in un reparto di psichiatria (prevalenza 40%) il conto
// cambia del tutto: VPP = 64%. Stesso test, stessa soglia, significato opposto.
// Non è un dettaglio statistico: è il significato del risultato.

// Caratteristiche note dalle meta-analisi. sens/spec sono proporzioni.
export const CARATTERISTICHE = {
  mdq: {
    sens: 0.8,
    spec: 0.7,
    fonte: "Meta-analisi HCL-32 vs MDQ (Psychiatry Res, 2019) e Critical Overview of Screening Tools for Detecting Bipolar Disorders (2025).",
  },
  hcl32: {
    sens: 0.82,
    spec: 0.57,
    fonte: "Meta-analisi HCL-32 vs MDQ (Psychiatry Res, 2019).",
  },
  pq16: {
    sens: 0.87,
    spec: 0.87,
    // Attenzione: validata su popolazione che cerca aiuto, non generale.
    fonte: "Ising HK et al. (2012), Schizophr Bull 38(6), popolazione help-seeking.",
  },
  phq9: {
    sens: 0.85,
    spec: 0.85,
    fonte: "Meta-analisi PHQ-9, soglia 10.",
  },
};

// Prevalenze di riferimento nella popolazione generale adulta.
// Servono a fare il conto onesto per chi compila il test a casa.
export const PREVALENZA = {
  bipolare: { valore: 0.02, etichetta: { it: "spettro bipolare", en: "bipolar spectrum" } },
  psicosi: { valore: 0.01, etichetta: { it: "disturbo psicotico", en: "psychotic disorder" } },
  depressione: { valore: 0.07, etichetta: { it: "episodio depressivo maggiore", en: "major depressive episode" } },
};

// Teorema di Bayes, scritto per esteso perché il conto si possa leggere.
export function valorePredittivo({ sens, spec, prevalenza, campione = 1000 }) {
  const malati = campione * prevalenza;
  const sani = campione - malati;
  const veriPositivi = malati * sens;
  const falsiPositivi = sani * (1 - spec);
  const veriNegativi = sani * spec;
  const falsiNegativi = malati * (1 - sens);
  const positivi = veriPositivi + falsiPositivi;
  const negativi = veriNegativi + falsiNegativi;
  return {
    campione,
    malati,
    sani,
    veriPositivi,
    falsiPositivi,
    veriNegativi,
    falsiNegativi,
    positivi,
    negativi,
    vpp: positivi > 0 ? veriPositivi / positivi : 0, // valore predittivo positivo
    vpn: negativi > 0 ? veriNegativi / negativi : 0, // valore predittivo negativo
  };
}

// La frase che accompagna ogni bandiera nel referto. Niente etichette:
// il numero e cosa vuol dire.
export function fraseAccantoAllaBandiera(strumento, chiavePrevalenza, lingua = "it") {
  const c = CARATTERISTICHE[strumento];
  const p = PREVALENZA[chiavePrevalenza];
  if (!c || !p) return null;
  const r = valorePredittivo({ sens: c.sens, spec: c.spec, prevalenza: p.valore });
  const su100 = Math.round(r.vpp * 100);
  const nome = p.etichetta[lingua] || p.etichetta.it;
  if (lingua === "en") {
    return (
      "Out of 100 people scoring above this cutoff in the general population, " +
      "roughly " + su100 + " actually have " + nome + ". " +
      "That is a reason to look further, not a result."
    );
  }
  return (
    "Su 100 persone che superano questa soglia nella popolazione generale, " +
    "circa " + su100 + " hanno davvero " + nome + ". " +
    "Le altre " + (100 - su100) + " no. È un motivo per approfondire, non un risultato."
  );
}

// Il conto per esteso, da mostrare a chi vuole vederlo.
export function conteggioLeggibile(strumento, chiavePrevalenza, lingua = "it") {
  const c = CARATTERISTICHE[strumento];
  const p = PREVALENZA[chiavePrevalenza];
  if (!c || !p) return null;
  const r = valorePredittivo({ sens: c.sens, spec: c.spec, prevalenza: p.valore });
  const arr = (x) => Math.round(x);
  return {
    righe:
      lingua === "en"
        ? [
            ["Sample", r.campione + " people"],
            ["Actually affected (" + (p.valore * 100).toFixed(1) + "%)", arr(r.malati)],
            ["Of those, flagged (sensitivity " + c.sens + ")", arr(r.veriPositivi)],
            ["Not affected", arr(r.sani)],
            ["Of those, wrongly flagged (specificity " + c.spec + ")", arr(r.falsiPositivi)],
            ["Total flagged", arr(r.positivi)],
            ["Of the flagged, truly affected", Math.round(r.vpp * 100) + "%"],
          ]
        : [
            ["Campione", r.campione + " persone"],
            ["Con la condizione (" + (p.valore * 100).toFixed(1) + "%)", arr(r.malati)],
            ["Di queste, segnalate (sensibilità " + c.sens + ")", arr(r.veriPositivi)],
            ["Senza la condizione", arr(r.sani)],
            ["Di queste, segnalate per errore (specificità " + c.spec + ")", arr(r.falsiPositivi)],
            ["Segnalate in tutto", arr(r.positivi)],
            ["Delle segnalate, davvero interessate", Math.round(r.vpp * 100) + "%"],
          ],
    fonte: c.fonte,
    vpp: r.vpp,
    vpn: r.vpn,
  };
}
