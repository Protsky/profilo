"""Dal settore di caduta al numero: dove il vantaggio si perde per strada.

QUESTO FILE ESISTE PER DIRE UNA COSA SOLA, e conviene dirla subito: azzeccare
il diamante NON e' azzeccare il numero, e la distanza fra le due cose e' molto
piu' grande di quanto sembri.

Fra il diamante e il numero ci sono due passaggi, e ognuno allarga la
distribuzione:

  1. LA FASE DEL ROTORE. Il diamante sta nel sistema dello statore, i numeri
     girano. Per sapere quale numero passa sotto il punto di contatto bisogna
     sapere dov'e' il rotore in quell'istante - e l'istante lo si conosce con
     l'errore sigma_t della previsione. Un rotore da 0,6 giri/s con sigma_t di
     150 ms sbaglia 0,09 giri, cioe' 3,3 caselle. Prima ancora di rimbalzare.

  2. IL RIMBALZO. La boccia colpisce il diamante e salta. La casella in cui
     finisce dista da quella sotto il punto di contatto di una quantita'
     casuale, con dispersione tipica di 5-9 caselle su una ruota da casino'.
     E' il termine piu' grande di tutti, e non dipende da niente che si possa
     misurare meglio.

I due si sommano in quadratura, e il risultato si convolve con la
distribuzione dei diamanti. Quello che esce e' una distribuzione sui 37 numeri
molto piu' piatta di quella sugli 8 diamanti, ed e' quella - non l'istogramma
dei diamanti - a decidere se c'e' un margine.

La aritmetica del margine: si punta su m numeri, si spende m, se esce si
incassa 36. Il pareggio e' a P(vincere) = m/36. Con m = 5 serve il 13,9%,
contro il 13,5% dell'uniforme: c'e' pochissimo spazio fra i due, e tutto quello
che sta qui sopra lo consuma.
"""
import math

import numpy as np

DUE_PI = 2.0 * math.pi


def dispersione_da_tempo(sigma_t, giri_al_secondo_rotore, n_numeri=37):
    """Lo sfocamento nel sistema del rotore dovuto all'errore sull'istante.

    In caselle. E' il prezzo che la previsione temporale paga UNA SECONDA
    VOLTA: la stessa sigma_t che allarga il settore sullo statore, qui la
    moltiplica la velocita' del rotore.
    """
    return abs(giri_al_secondo_rotore) * sigma_t * n_numeri


def distribuzione_numeri(quote_diamanti, dispersione_caselle, n_numeri=37,
                         sotto_campioni=16):
    """Dalla distribuzione sui diamanti a quella sui numeri.

    quote_diamanti       probabilita' per ciascun diamante (nel sistema dello
                         statore), somma 1
    dispersione_caselle  sigma totale dello scarto fra punto di contatto e
                         casella finale, in caselle: rimbalzo e fase del
                         rotore messi in quadratura

    La convoluzione e' circolare e si fa su una griglia fine, poi si raccoglie
    nelle caselle: farla direttamente sui 37 bin darebbe una discretizzazione
    grossolana proprio dove la distribuzione e' piu' stretta.
    """
    quote = np.asarray(quote_diamanti, dtype=float)
    if quote.size < 1 or quote.sum() <= 0:
        raise ValueError("distribuzione_numeri: quote non valide")
    quote = quote / quote.sum()

    n = n_numeri * sotto_campioni
    # I diamanti stesi sulla griglia fine, ciascuno come densita' costante sul
    # suo arco.
    densita = np.zeros(n)
    for i, q in enumerate(quote):
        inizio = int(round(i * n / quote.size))
        fine = int(round((i + 1) * n / quote.size))
        densita[inizio:fine] += q / max(fine - inizio, 1)

    if dispersione_caselle <= 0:
        nucleo = np.zeros(n)
        nucleo[0] = 1.0
    else:
        sigma = dispersione_caselle * sotto_campioni
        x = np.arange(n)
        x = np.minimum(x, n - x)  # distanza circolare
        nucleo = np.exp(-0.5 * (x / sigma) ** 2)
        nucleo /= nucleo.sum()

    convoluta = np.real(np.fft.ifft(np.fft.fft(densita) * np.fft.fft(nucleo)))
    convoluta = np.maximum(convoluta, 0.0)
    per_casella = convoluta.reshape(n_numeri, sotto_campioni).sum(axis=1)
    return per_casella / per_casella.sum()


def vantaggio_massimo(distribuzione, m, pagamento=36):
    """Il margine puntando sugli m numeri piu' probabili.

    Ritorna (margine, probabilita_totale, indici). Margine 0 = pareggio,
    -0.027 = il banco della roulette europea.
    """
    d = np.asarray(distribuzione, dtype=float)
    if not 1 <= m <= d.size:
        raise ValueError("vantaggio_massimo: m fuori intervallo")
    indici = np.argsort(-d)[:m]
    p = float(d[indici].sum())
    return pagamento * p / m - 1.0, p, np.sort(indici).tolist()


def catena(quote_diamanti, sigma_t, giri_al_secondo_rotore, dispersione_rimbalzo,
           n_numeri=37, pagamento=36, coperti=(1, 3, 5, 8, 12)):
    """Il conto intero, dal diamante al margine, con i termini separati.

    E' la funzione da guardare prima di decidere se il progetto vale il tempo:
    prende il vantaggio che hai sui diamanti e ti dice cosa ne resta.
    """
    disp_rotore = dispersione_da_tempo(sigma_t, giri_al_secondo_rotore, n_numeri)
    disp_totale = math.hypot(disp_rotore, dispersione_rimbalzo)
    d = distribuzione_numeri(quote_diamanti, disp_totale, n_numeri)
    righe = []
    for m in coperti:
        if m > n_numeri:
            continue
        margine, p, indici = vantaggio_massimo(d, m, pagamento)
        righe.append({"coperti": m, "probabilita": p, "margine": margine,
                      "numeri": indici})
    return {
        "dispersione_rotore": disp_rotore,
        "dispersione_rimbalzo": float(dispersione_rimbalzo),
        "dispersione_totale": disp_totale,
        "distribuzione": d.tolist(),
        "picco": float(d.max()),
        "uniforme": 1.0 / n_numeri,
        "righe": righe,
    }


def stampa_catena(esito):
    print("sfocamento nel sistema del rotore:")
    print("  dalla fase del rotore (sigma_t x velocita'): %.2f caselle"
          % esito["dispersione_rotore"])
    print("  dal rimbalzo sul diamante:                   %.2f caselle"
          % esito["dispersione_rimbalzo"])
    print("  in quadratura:                               %.2f caselle"
          % esito["dispersione_totale"])
    print("casella piu' probabile: %.2f%% contro %.2f%% dell'uniforme (x%.2f)"
          % (100 * esito["picco"], 100 * esito["uniforme"],
             esito["picco"] / esito["uniforme"]))
    print()
    print("numeri coperti   P(vincere)   pareggio   margine")
    print("-" * 50)
    for r in esito["righe"]:
        print("%12d %11.2f%% %10.2f%% %+9.1f%%"
              % (r["coperti"], 100 * r["probabilita"],
                 100 * r["coperti"] / 36.0, 100 * r["margine"]))
