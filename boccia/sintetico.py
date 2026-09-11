"""Generatore di spin e di video finti, per provare tutto senza una ruota.

Serve a due cose diverse, e conviene tenerle distinte in testa:

1. VERIFICARE IL CODICE. Un fit che recupera i parametri con cui hai generato
   i dati non dimostra niente sulla ruota vera, ma dimostra che la catena non
   ha bug - e sul resto del progetto i bug sarebbero invisibili, perche' un
   numero sbagliato di millisecondi ha esattamente lo stesso aspetto di un
   numero giusto.

2. MISURARE IL BUDGET DI PRECISIONE. Qui la simulazione dice qualcosa di vero:
   se con un jitter di 2 ms sui passaggi e 4 giri osservati l'errore di
   estrapolazione e' di 150 ms, quello e' un limite della geometria del
   problema, non della tua implementazione, e nessuna cura del codice lo toglie.

LA RUOTA STORTA E' SIMULATA COME STORTA DAVVERO. Non si sceglie a mano un
diamante dominante con una probabilita' truccata: si inclina la ruota, il che
rende omega_c funzione dell'angolo (su un lato la boccia regge un po' di piu'),
e il diamante dominante viene fuori da solo. E' l'unico modo per sapere se la
prova di uniformita' vede quello che deve vedere.

Il video finto usa un'omografia vera - proiezione prospettica di un piano - non
uno schiacciamento affine. Cosi' la calibrazione a ellisse, che affine lo e',
viene messa alla prova sul caso in cui sbaglia, invece che su uno costruito per
darle ragione.
"""
import math

import numpy as np

from . import modello as mdl

DUE_PI = 2.0 * math.pi


# ---------------------------------------------------------------- uno spin

class Spin:
    """Uno spin simulato, con la verita' che di solito non hai."""

    def __init__(self, tempi, t_caduta, angolo_caduta, diamante, parametri,
                 omega_c, angolo_tripwire):
        self.tempi = np.asarray(tempi, dtype=float)
        self.t_caduta = float(t_caduta)
        self.angolo_caduta = float(angolo_caduta)
        self.diamante = int(diamante)
        self.parametri = list(parametri)
        self.omega_c = float(omega_c)
        self.angolo_tripwire = float(angolo_tripwire)

    def finestra(self, n_giri, anticipo=0):
        """Gli ultimi `n_giri` attraversamenti utili, saltandone `anticipo`.

        Serve a simulare la scelta vera: quanto tardi osservi, e quanti giri
        riesci a misurare prima di dover scommettere.
        """
        fine = self.tempi.size - anticipo
        inizio = max(0, fine - n_giri)
        return self.tempi[inizio:fine]


def genera_spin(rng, omega_iniziale=None, a=None, b=None, omega_c=9.0,
                sigma_omega_c=0.0, inclinazione_ruota=0.0, angolo_inclinazione=0.0,
                jitter_s=0.002, angolo_tripwire=0.0, n_diamanti=8,
                dispersione_diamante=0.0):
    """Uno spin: attraversamenti del tripwire, istante e angolo di caduta.

    omega_iniziale       rad/s all'inizio della registrazione (4-5 giri/s tipico)
    a, b                 attrito volvente e viscoso, domega/dt = -(a + b*omega)
    omega_c              soglia di caduta media (9 rad/s ~ 1.43 giri/s)
    sigma_omega_c        quanto la soglia cambia DA SPIN A SPIN: usura della
                         boccia, umidita', punto in cui il croupier la lancia.
                         E' il termine d'errore che nessun fit puo' togliere,
                         perche' non sta nei dati dello spin in corso. Su una
                         ruota vera vale qualche punto percentuale di omega_c:
                         metterlo a zero e' il modo piu' rapido per convincersi
                         di una precisione che non si avra'.
    inclinazione_ruota   ampiezza relativa della modulazione di omega_c dovuta
                         alla ruota fuori bolla (0 = ruota perfetta; 0.02 = 2%,
                         gia' abbastanza per un diamante dominante visibile)
    angolo_inclinazione  dove punta il lato alto, in radianti
    jitter_s             rumore gaussiano sugli istanti di attraversamento,
                         cioe' la qualita' della tua estrazione dal video
    dispersione_diamante rumore angolare fra il distacco e il contatto col
                         diamante (rimbalzi, salto sulla pista)
    """
    omega0 = rng.uniform(26.0, 32.0) if omega_iniziale is None else omega_iniziale
    a_v = rng.uniform(0.9, 1.5) if a is None else a
    b_v = rng.uniform(0.03, 0.07) if b is None else b
    p = [omega0, a_v, b_v]
    if sigma_omega_c > 0.0:
        omega_c = max(0.5, omega_c + rng.normal(0.0, sigma_omega_c))

    fase0 = rng.uniform(0.0, DUE_PI)  # dove sta la boccia quando parte la ripresa

    def soglia(angolo):
        if inclinazione_ruota == 0.0:
            return omega_c
        return omega_c * (1.0 + inclinazione_ruota * math.cos(angolo - angolo_inclinazione))

    def scarto(t):
        return mdl.Misto.omega(t, p) - soglia(fase0 + mdl.Misto.theta(t, p))

    # Si cerca il primo istante in cui la boccia non regge piu'. Griglia grossa
    # per trovare il cambio di segno, poi bisezione: la soglia varia con
    # l'angolo, quindi la funzione oscilla e una sola bisezione cieca sul
    # dominio intero potrebbe saltare il primo passaggio.
    t_arresto = mdl.Misto.tempo_a_omega(0.0, p)
    if not math.isfinite(t_arresto):
        t_arresto = 60.0
    griglia = np.arange(0.0, t_arresto, 0.005)
    valori = np.array([scarto(t) for t in griglia])
    indici = np.nonzero(valori <= 0)[0]
    if indici.size == 0:
        raise RuntimeError("genera_spin: la boccia non cade mai, parametri assurdi")
    i = int(indici[0])
    basso = griglia[i - 1] if i > 0 else 0.0
    alto = griglia[i]
    for _ in range(60):
        mezzo = 0.5 * (basso + alto)
        if scarto(mezzo) > 0:
            basso = mezzo
        else:
            alto = mezzo
    t_caduta = 0.5 * (basso + alto)

    angolo_caduta = (fase0 + mdl.Misto.theta(t_caduta, p)) % DUE_PI

    # Gli attraversamenti del tripwire fino alla caduta.
    tempi = []
    k = 0
    while True:
        bersaglio = (angolo_tripwire - fase0) % DUE_PI + DUE_PI * k
        t = mdl.Misto.tempo_a_angolo(bersaglio, p)
        if not math.isfinite(t) or t >= t_caduta:
            break
        tempi.append(t)
        k += 1
    tempi = np.array(tempi) + rng.normal(0.0, jitter_s, size=len(tempi))
    tempi.sort()

    angolo_contatto = angolo_caduta
    if dispersione_diamante > 0.0:
        angolo_contatto = (angolo_caduta + rng.normal(0.0, dispersione_diamante)) % DUE_PI
    diamante = int(math.floor(angolo_contatto / (DUE_PI / n_diamanti))) % n_diamanti

    return Spin(tempi, t_caduta, angolo_caduta, diamante, p, omega_c, angolo_tripwire)


def genera_sessione(n, seme=0, **kwargs):
    """N spin sulla stessa ruota, con gli stessi difetti."""
    rng = np.random.default_rng(seme)
    return [genera_spin(rng, **kwargs) for _ in range(n)]


# ---------------------------------------------------------------- la camera finta

def omografia_camera(distanza=2.0, inclinazione_gradi=35.0, azimut_gradi=0.0,
                     focale_px=900.0, larghezza=1280, altezza=720, raggio_ruota=0.30):
    """Omografia dal piano della ruota (metri) all'immagine (pixel).

    Pinhole vero: K [r1 r2 t]. `inclinazione_gradi` e' quanto la camera guarda
    di sbieco - 0 = perfettamente a piombo sopra la ruota, 60 = molto radente,
    che e' il caso in cui l'ellisse e' schiacciata e la calibrazione conta.
    """
    incl = math.radians(inclinazione_gradi)
    azi = math.radians(azimut_gradi)

    # Rotazione: prima l'azimut attorno all'asse della ruota, poi l'inclinazione.
    Rz = np.array([[math.cos(azi), -math.sin(azi), 0.0],
                   [math.sin(azi), math.cos(azi), 0.0],
                   [0.0, 0.0, 1.0]])
    Rx = np.array([[1.0, 0.0, 0.0],
                   [0.0, math.cos(incl), -math.sin(incl)],
                   [0.0, math.sin(incl), math.cos(incl)]])
    R = Rx @ Rz
    t = np.array([0.0, 0.0, distanza])
    K = np.array([[focale_px, 0.0, larghezza / 2.0],
                  [0.0, focale_px, altezza / 2.0],
                  [0.0, 0.0, 1.0]])
    H = K @ np.column_stack([R[:, 0], R[:, 1], t])
    return H / H[2, 2]


def fotogrammi_sintetici(spin, fps=60.0, H=None, larghezza=1280, altezza=720,
                         raggio_pista=0.26, raggio_rotore=0.20, raggio_boccia_px=None,
                         omega_rotore=-2.8, n_caselle=37, rumore=3.0, seme=1,
                         esposizione=0.5, sotto_campioni=5):
    """Generatore di fotogrammi (uint8, scala di grigi) dello spin.

    Non e' un rendering realistico ed e' inutile che lo sia: serve a mettere
    alla prova geometria e tempi, non l'aspetto. Ci sono pero' le tre cose che
    fanno soffrire un estrattore vero:

      - il rotore ha 37 caselle quasi identiche (la trappola dell'aliasing
        della correlazione di fase);
      - la boccia e' piccola, grande il 5% del raggio della pista come quella
        vera, e non un blob comodo da agganciare;
      - la boccia e' MOSSA. A 2 giri/s con un tempo di posa di mezzo
        fotogramma la boccia si spalma su 6 gradi d'arco, e la scia e' curva.
        E' l'effetto che domina l'errore di centroide in un video vero:
        simulare una boccia nitida vuol dire misurare una precisione che non
        si avra' mai;
      - la camera e' di sbieco, quindi il tempo angolare misurato in pixel e'
        sbagliato se non si calibra.

    `esposizione` e' il tempo di posa in frazione dell'intervallo fra
    fotogrammi: 0 = stroboscopica, 1 = otturatore sempre aperto. Mezzo e' il
    valore tipico di una camera che riprende con luce da interno.
    """
    rng = np.random.default_rng(seme)
    if H is None:
        H = omografia_camera(larghezza=larghezza, altezza=altezza)
    Hinv = np.linalg.inv(H)

    # Coordinate di ogni pixel nel piano della ruota: si calcolano una volta.
    yy, xx = np.mgrid[0:altezza, 0:larghezza]
    punti = np.stack([xx.ravel(), yy.ravel(), np.ones(xx.size)])
    mondo = Hinv @ punti
    mondo = mondo[:2] / mondo[2]
    X = mondo[0].reshape(altezza, larghezza)
    Y = mondo[1].reshape(altezza, larghezza)
    R = np.hypot(X, Y)
    FI = np.arctan2(Y, X)

    if raggio_boccia_px is None:
        # La boccia e' circa il 5% del raggio della pista su una ruota vera. Se
        # la si disegna di dimensione fissa in pixel, rimpicciolendo
        # l'inquadratura diventa enorme rispetto alla ruota e il centroide
        # prende un errore che sulla ruota vera non c'e': si finirebbe per
        # tarare l'estrattore contro un difetto del disegno.
        v0 = H @ np.array([0.0, 0.0, 1.0])
        v1 = H @ np.array([raggio_pista, 0.0, 1.0])
        pista_px = math.hypot(v1[0] / v1[2] - v0[0] / v0[2], v1[1] / v1[2] - v0[1] / v0[2])
        raggio_boccia_px = max(1.5, 0.055 * pista_px)

    fondo = np.zeros((altezza, larghezza), dtype=np.float32)
    fondo[R < raggio_pista * 1.25] = 35.0          # il mobile attorno
    anello_pista = (R > raggio_pista * 0.94) & (R < raggio_pista * 1.06)
    fondo[anello_pista] = 90.0                      # la banchina, chiara
    p = mdl.Misto
    durata = spin.t_caduta + 1.0
    n_frame = int(durata * fps)

    for i in range(n_frame):
        t = i / fps
        img = fondo.copy()

        # Rotore: 37 caselle alternate piu' lo zero, che gira per conto suo.
        fase_rotore = omega_rotore * t
        settore = np.floor(((FI - fase_rotore) % DUE_PI) / (DUE_PI / n_caselle))
        anello_rotore = R < raggio_rotore
        img[anello_rotore] = 40.0 + 30.0 * (settore[anello_rotore] % 2)
        zero = anello_rotore & (settore == 0)
        img[zero] = 120.0

        # La boccia, integrata lungo il tempo di posa: sulla pista prima della
        # caduta, dentro dopo.
        n_sotto = max(1, sotto_campioni if esposizione > 0 else 1)
        for j in range(n_sotto):
            frazione = (j + 0.5) / n_sotto - 0.5
            ts = t + frazione * esposizione / fps
            if ts <= spin.t_caduta:
                ang = (spin.angolo_caduta - (p.theta(spin.t_caduta, spin.parametri)
                                             - p.theta(max(ts, 0.0), spin.parametri)))
                raggio = raggio_pista
            else:
                # Dopo il distacco il raggio collassa: e' il segnale che cerchiamo.
                caduto = min(1.0, (ts - spin.t_caduta) / 0.25)
                ang = spin.angolo_caduta + 3.0 * caduto
                raggio = raggio_pista * (1.0 - 0.35 * caduto)
            bx, by = raggio * math.cos(ang), raggio * math.sin(ang)
            pb = H @ np.array([bx, by, 1.0])
            px, py = pb[0] / pb[2], pb[1] / pb[2]
            if 0 <= px < larghezza and 0 <= py < altezza:
                d2 = (xx - px) ** 2 + (yy - py) ** 2
                img += (200.0 / n_sotto) * np.exp(-d2 / (2.0 * raggio_boccia_px ** 2))

        if rumore > 0:
            img += rng.normal(0.0, rumore, size=img.shape)
        yield np.clip(img, 0, 255).astype(np.uint8)
