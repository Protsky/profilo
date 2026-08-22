// Grafici in SVG scritto a mano. Niente librerie: non c'è Node su questa
// macchina e per disegnare delle barre non serve un bundler.
//
// La regola di disegno che conta: un punteggio non è mai un punto. È una
// banda, larga quanto l'errore di misura. Chi guarda deve vedere l'incertezza
// prima di vedere il numero, non dopo averlo letto in una nota a piè di pagina.

const NS = "http://www.w3.org/2000/svg";

function el(nome, attributi = {}) {
  const e = document.createElementNS(NS, nome);
  for (const [k, v] of Object.entries(attributi)) e.setAttribute(k, String(v));
  return e;
}

// Barra con banda di confidenza. Il rettangolo pieno è la banda; la tacca è
// il punteggio puntuale, disegnato sottile apposta perché non domini.
export function bandaOrizzontale({ valore, banda, intervallo, soglia, larghezza = 100 }) {
  const [min, max] = intervallo;
  const span = max - min || 1;
  const pos = (v) => ((Math.min(max, Math.max(min, v)) - min) / span) * larghezza;

  const svg = el("svg", {
    viewBox: "0 0 " + larghezza + " 30",
    preserveAspectRatio: "none",
    width: "100%",
    height: "30",
    role: "img",
  });

  // binario
  svg.appendChild(
    el("rect", { x: 0, y: 13, width: larghezza, height: 4, rx: 2, fill: "var(--bordo)" })
  );

  // banda di errore
  if (banda) {
    const da = pos(banda.da);
    const a = pos(banda.a);
    svg.appendChild(
      el("rect", {
        x: da,
        y: 9,
        width: Math.max(1.5, a - da),
        height: 12,
        rx: 6,
        fill: "var(--accento)",
        "fill-opacity": banda.dsStimata ? 0.35 : 0.6,
      })
    );
  }

  // punteggio
  const x = pos(valore);
  svg.appendChild(
    el("rect", { x: Math.max(0, x - 0.6), y: 5, width: 1.2, height: 20, fill: "var(--testo)" })
  );

  // soglia, se c'è
  if (soglia !== undefined && soglia !== null) {
    const xs = pos(soglia);
    svg.appendChild(
      el("rect", {
        x: Math.max(0, xs - 0.35),
        y: 3,
        width: 0.7,
        height: 24,
        fill: "var(--allarme)",
        "fill-opacity": 0.9,
      })
    );
  }

  return svg;
}

// Profilo a barre per un gruppo di scale confrontabili fra loro (per esempio i
// dieci aspetti del BFAS), disegnate rispetto alla media della persona stessa.
// È l'unica lettura possibile quando manca una norma di popolazione, e va
// etichettata per quello che è: un confronto interno, non una posizione.
export function profiloRelativo(punteggi, { etichetta, larghezza = 320, altezzaRiga = 26 }) {
  const validi = punteggi.filter((p) => p && !p.incompleta && p.zRelativo !== undefined);
  if (!validi.length) return null;

  const altezza = validi.length * altezzaRiga + 24;
  const svg = el("svg", {
    viewBox: "0 0 " + larghezza + " " + altezza,
    width: "100%",
    height: altezza,
    role: "img",
  });

  const centro = larghezza * 0.52;
  const scala = larghezza * 0.2; // 1 deviazione = 20% della larghezza

  // asse centrale = la media della persona
  svg.appendChild(
    el("rect", { x: centro - 0.5, y: 6, width: 1, height: altezza - 24, fill: "var(--bordo)" })
  );

  validi.forEach((p, i) => {
    const y = 12 + i * altezzaRiga;
    const z = Math.max(-2.5, Math.min(2.5, p.zRelativo));
    const w = Math.abs(z) * scala;
    const x = z >= 0 ? centro : centro - w;

    svg.appendChild(
      el("rect", {
        x,
        y: y + 4,
        width: Math.max(1.5, w),
        height: altezzaRiga - 12,
        rx: 3,
        fill: z >= 0 ? "var(--accento)" : "var(--testo-fioco)",
        "fill-opacity": 0.75,
      })
    );

    const testo = el("text", {
      x: centro - scala * 2.7,
      y: y + altezzaRiga / 2,
      "dominant-baseline": "middle",
      "font-size": "11",
      fill: "var(--testo-tenue)",
    });
    testo.textContent = etichetta(p);
    svg.appendChild(testo);
  });

  return svg;
}

// Legenda della banda, da mettere una volta sola in cima al profilo.
export function legenda(lingua = "it") {
  const div = document.createElement("div");
  div.className = "legenda";
  div.innerHTML =
    lingua === "en"
      ? "<span class='chiave banda'></span> measurement error band &nbsp; " +
        "<span class='chiave tacca'></span> score &nbsp; " +
        "<span class='chiave soglia'></span> cutoff"
      : "<span class='chiave banda'></span> banda d'errore &nbsp; " +
        "<span class='chiave tacca'></span> punteggio &nbsp; " +
        "<span class='chiave soglia'></span> soglia";
  return div;
}
