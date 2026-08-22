// Norme di popolazione: medie e deviazioni standard di campioni pubblicati.
//
// QUESTO FILE È QUASI VUOTO, ED È UNA SCELTA.
//
// Per trasformare un punteggio in un percentile serve la media e la deviazione
// standard di un campione vero, pubblicato, su una popolazione confrontabile.
// Per le scale usate qui quei numeri o non sono pubblici, o sono pubblicati su
// campioni (studenti americani, pazienti ambulatoriali olandesi) che non
// dicono granché a un adulto in Ticino.
//
// L'alternativa sarebbe inventarli, o copiarli da un campione che non c'entra
// e non dirlo. Un percentile inventato è peggio di un percentile assente:
// assente si vede, inventato no, e chi legge crede di sapere dove si trova
// nella popolazione quando non lo sa.
//
// Quindi: dove la norma manca, l'app mostra il punteggio grezzo sul suo
// intervallo e scrive che la norma manca. Il BFAS viene letto in profilo
// relativo - i dieci aspetti confrontati fra loro, dentro la stessa persona -
// che non ha bisogno di nessuna norma esterna per essere vero.
//
// COME AGGIUNGERNE UNA. Se trovi una norma pubblicata per una scala, mettila
// qui in questa forma e l'app comincia da sola a mostrare i percentili:
//
//   bfas: {
//     volatilita: { media: 28.4, ds: 7.9, fonte: "Autore (anno), N=..., paese" },
//   },
//
// Serve la fonte: senza, non si sa a chi ci si sta confrontando, e il
// percentile torna a essere un numero senza significato.

export const NORME = {
  // Nessuna norma inserita. Vedi sopra.
};

export default NORME;
