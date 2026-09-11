"""Estrazione dei tempi dal video: calibrazione, tripwire, fase del rotore, caduta.

LA REGOLA DI QUESTO FILE: NON SI INSEGUE LA BOCCIA. Il tracking fotogramma per
fotogramma di un oggetto piccolo, veloce e mosso e' fragile, e quando si rompe
lo fa in silenzio, restituendo numeri che sembrano buoni. Qui la boccia si
cerca in ogni fotogramma da zero (differenza dal fondo, solo dentro l'anello
della pista) e l'unica cosa che si registra sono gli ISTANTI in cui attraversa
una semiretta radiale fissa. Un fotogramma perso non propaga niente: il
passaggio successivo si misura da solo.

I QUATTRO PEZZI, e cosa succede se ne salti uno:

  calibrazione   fit di un'ellisse sul bordo, poi raddrizzamento a cerchio.
                 Senza, una camera di sbieco misura tempi angolari sbagliati:
                 la boccia sembra rallentare nella meta' lontana e accelerare
                 in quella vicina, con un errore periodico di decine di
                 millisecondi che un fit su pochi giri scambia per fisica.

  sfondo mediano mediana temporale dei fotogrammi. La ruota e il mobile
                 spariscono, restano boccia e rotore. Mediana e non media:
                 la media si porta dietro una scia della boccia.

  sub-frame      interpolazione lineare fra i due fotogrammi che circondano
                 il passaggio. A 60 fps la quantizzazione da sola vale 16,7/
                 sqrt(12) = 4,8 ms di sigma; interpolando si scende sotto il
                 millisecondo. Nel budget di precisione la differenza fra i
                 due e' la differenza fra due diamanti e mezzo e mezzo
                 diamante: e' il ritorno piu' alto per riga di codice di
                 tutto il progetto.

  raggio         l'uscita dalla pista si vede come discontinuita' del RAGGIO,
                 non dell'angolo. E' il ground truth della caduta, e serve
                 sia per calibrare omega_c sia per validare.

Numpy basta per tutto. OpenCV serve solo a leggere i file video: i fotogrammi
si possono passare anche come array, ed e' cosi' che li prova `autotest.py`.
"""
import math

import numpy as np

DUE_PI = 2.0 * math.pi


# ---------------------------------------------------------------- ellisse

def adatta_ellisse(punti):
    """Fit diretto di un'ellisse a minimi quadrati (Fitzgibbon, 1999).

    Ritorna (cx, cy, semiasse_maggiore, semiasse_minore, angolo_rad).

    Il vincolo 4ac - b^2 = 1 e' quello che rende il fit *diretto*: impone che
    la conica sia un'ellisse, quindi non capita mai che venga fuori
    un'iperbole perche' i punti coprono solo mezzo bordo - che succede spesso,
    perche' meta' ruota e' in ombra o coperta dal croupier.

    I punti si normalizzano prima: le coordinate in pixel arrivano a 1e3, i
    loro quadrati a 1e6, e la matrice di dispersione diventa mal condizionata
    abbastanza da spostare il centro di qualche pixel.
    """
    p = np.asarray(punti, dtype=float)
    if p.ndim != 2 or p.shape[1] != 2 or p.shape[0] < 5:
        raise ValueError("adatta_ellisse: servono almeno 5 punti (x, y)")
    media = p.mean(axis=0)
    scala = np.sqrt(((p - media) ** 2).sum(axis=1)).mean()
    if scala <= 0:
        raise ValueError("adatta_ellisse: punti tutti coincidenti")
    q = (p - media) / scala
    x, y = q[:, 0], q[:, 1]

    # Halir-Flusser: il problema agli autovalori generalizzato di Fitzgibbon
    # richiede di invertire la matrice di dispersione, che e' ESATTAMENTE
    # singolare quando i punti stanno davvero su una conica - cioe' nel caso
    # migliore. Qui si spezza in blocchi e si inverte solo il blocco 3x3
    # lineare, che e' singolare solo se i punti sono allineati.
    D1 = np.column_stack([x * x, x * y, y * y])
    D2 = np.column_stack([x, y, np.ones_like(x)])
    S1, S2, S3 = D1.T @ D1, D1.T @ D2, D2.T @ D2
    try:
        T = -np.linalg.solve(S3, S2.T)
    except np.linalg.LinAlgError:
        raise ValueError("adatta_ellisse: punti allineati o degeneri")
    M = S1 + S2 @ T
    # Moltiplicazione per l'inversa della matrice del vincolo 4ac - b^2 = 1,
    # scritta a mano perche' e' solo uno scambio di righe con segno.
    M = np.array([M[2] / 2.0, -M[1], M[0] / 2.0])
    autovalori, autovettori = np.linalg.eig(M)
    condizione = 4 * autovettori[0] * autovettori[2] - autovettori[1] ** 2
    validi = np.nonzero(condizione > 0)[0]
    if validi.size == 0:
        raise ValueError("adatta_ellisse: i punti non descrivono un'ellisse")
    a1 = autovettori[:, validi[0]].real
    a2 = T @ a1
    a, b, c = a1
    d, e, f = a2

    # Dalla conica ai parametri geometrici, poi si torna in pixel.
    den = b * b - 4 * a * c
    if abs(den) < 1e-18:
        raise ValueError("adatta_ellisse: conica degenere")
    cx = (2 * c * d - b * e) / den
    cy = (2 * a * e - b * d) / den
    # Semiassi e orientazione dagli autovalori della parte quadratica: la
    # forma chiusa con i radicali ha casi speciali (b = 0, a = c) che qui non
    # servono a niente.
    M = np.array([[a, b / 2.0], [b / 2.0, c]])
    costante = a * cx * cx + b * cx * cy + c * cy * cy + d * cx + e * cy + f
    val, vec = np.linalg.eigh(M)
    if np.any(val == 0) or costante == 0:
        raise ValueError("adatta_ellisse: conica degenere")
    semiassi2 = -costante / val
    if np.any(semiassi2 <= 0):
        raise ValueError("adatta_ellisse: la conica non e' un'ellisse")
    semiassi = np.sqrt(semiassi2)
    ordine = np.argsort(-semiassi)
    semiassi = semiassi[ordine]
    direzione = vec[:, ordine[0]]
    # L'autovettore e' definito a meno del segno: un'ellisse ruotata di pi e'
    # la stessa ellisse, ma restituire a volte ang e a volte ang-pi rende i
    # confronti in prova inutilmente confusi. Si normalizza in [0, pi).
    angolo = math.atan2(direzione[1], direzione[0]) % math.pi
    return (float(cx * scala + media[0]), float(cy * scala + media[1]),
            float(semiassi[0] * scala), float(semiassi[1] * scala), float(angolo))


def omografia_dlt(punti_immagine, punti_piano):
    """Omografia da 4+ corrispondenze, con normalizzazione di Hartley."""
    pi = np.asarray(punti_immagine, dtype=float)
    pp = np.asarray(punti_piano, dtype=float)
    if pi.shape != pp.shape or pi.shape[0] < 4:
        raise ValueError("omografia_dlt: servono almeno 4 corrispondenze")

    def normalizza(p):
        m = p.mean(axis=0)
        s = np.sqrt(((p - m) ** 2).sum(axis=1)).mean()
        s = math.sqrt(2.0) / s if s > 0 else 1.0
        T = np.array([[s, 0, -s * m[0]], [0, s, -s * m[1]], [0, 0, 1.0]])
        q = (T @ np.column_stack([p, np.ones(len(p))]).T).T
        return q[:, :2], T

    qi, Ti = normalizza(pi)
    qp, Tp = normalizza(pp)
    A = []
    for (u, v), (X, Y) in zip(qi, qp):
        A.append([-X, -Y, -1, 0, 0, 0, u * X, u * Y, u])
        A.append([0, 0, 0, -X, -Y, -1, v * X, v * Y, v])
    _, _, Vt = np.linalg.svd(np.asarray(A))
    H = Vt[-1].reshape(3, 3)
    H = np.linalg.inv(Ti) @ H @ Tp
    return H / H[2, 2]


def ellisse_a_omografia(ellisse):
    """Dall'ellisse in pixel alla mappa piano-ruota -> immagine.

    Il raddrizzamento inverso e': trasla al centro, ruota di -ang, riallunga
    l'asse minore fino a quello maggiore, normalizza a raggio 1.
    """
    cx, cy, A, B, ang = ellisse
    if B <= 0 or A <= 0:
        raise ValueError("ellisse_a_omografia: semiassi non positivi")
    c, s = math.cos(-ang), math.sin(-ang)
    rotazione = np.array([[c, -s], [s, c]])
    allunga = np.array([[1.0 / A, 0.0], [0.0, 1.0 / B]])
    M = allunga @ rotazione
    Hinv = np.eye(3)
    Hinv[:2, :2] = M
    Hinv[:2, 2] = -M @ np.array([cx, cy])
    return np.linalg.inv(Hinv)


class Calibrazione:
    """Il ponte fra i pixel e le coordinate polari vere della ruota.

    Il raggio esce in unita' del raggio della circonferenza di calibrazione:
    non serve sapere quanto misura in metri, perche' tutto quello che si fa
    dopo e' angolare o relativo. L'angolo esce giusto a meno di una rotazione
    globale, che e' esattamente l'informazione che non c'e' nell'immagine di
    un cerchio e che non serve: i diamanti si numerano a partire da uno scelto
    da noi.
    """

    def __init__(self, H, metodo="", residuo_gradi=float("nan")):
        self.H = np.asarray(H, dtype=float)
        self.Hinv = np.linalg.inv(self.H)
        self.metodo = metodo
        self.residuo_gradi = float(residuo_gradi)

    @classmethod
    def da_ellisse(cls, ellisse):
        """Raddrizzamento affine: trasla, ruota, riallunga l'asse minore.

        ASSUME PROIEZIONE QUASI ORTOGRAFICA, cioe' camera abbastanza lontana
        rispetto al diametro della ruota. Sotto prospettiva vera resta un
        errore angolare residuo, che cresce col rapporto diametro/distanza.
        Misurato su omografie vere, ruota da 52 cm di diametro:

            4,0 m, inclinata 20 gradi     1,3 gradi
            2,0 m, inclinata 38 gradi     4,6 gradi
            1,0 m, inclinata 55 gradi    12,4 gradi
            0,6 m, inclinata 65 gradi    23,6 gradi

        MA VA LETTO CON ATTENZIONE, perche' quell'errore colpisce una cosa sola
        delle due:

          - sui TEMPI DI ATTRAVERSAMENTO non ha nessun effetto. La distorsione
            e' una funzione fissa dell'angolo, il tripwire e' una semiretta
            fissa: quindi ogni passaggio avviene sempre allo stesso angolo
            VERO, e fra un passaggio e il successivo ci sono esattamente 2 pi
            comunque. Misurato, la sigma sui tempi resta sotto i 0,2 ms da 20
            a 65 gradi di inclinazione;
          - sull'ANGOLO ASSOLUTO, cioe' su QUALE DIAMANTE, colpisce eccome. Un
            diamante e' largo 45 gradi: a 0,6 metri la distorsione vale mezzo
            diamante e spalma l'istogramma di uniformita'.

        Quindi: per il budget di precisione questa calibrazione basta sempre.
        Per la prova di uniformita', o si tiene la camera alta e lontana, o si
        usa `da_punti_noti`, che toglie il termine del tutto.
        """
        return cls(ellisse_a_omografia(ellisse), metodo="ellisse affine")

    @classmethod
    def da_traiettoria(cls, punti_boccia):
        """Calibrazione dalla traiettoria stessa della boccia. LA PRIMA SCELTA.

        La boccia percorre una circonferenza a raggio fisso finche' sta sulla
        banchina: quella circonferenza, vista di sbieco, e' l'ellisse che
        serve. Vantaggi rispetto al cercare il bordo della ruota:

          - e' proprio il cerchio che interessa, non il bordo del mobile che
            sta su un altro piano e ha un altro raggio;
          - non serve nessun rilevamento di contorni, che e' la parte che si
            rompe quando cambia la luce;
          - il raggio della pista viene 1 per costruzione, quindi la caduta si
            legge come "il raggio scende sotto 1" senza tarare nessuna soglia;
          - i fotogrammi dopo la caduta si scartano da soli come outlier.

        Richiede che la boccia faccia almeno mezzo giro nella ripresa, il che
        e' sempre vero se c'e' abbastanza video per fittare qualcosa.
        """
        ellisse, tenuti = adatta_ellisse_robusta(punti_boccia)
        cal = cls(ellisse_a_omografia(ellisse), metodo="ellisse sulla traiettoria")
        raggi = np.array([cal.punto_a_polari(x, y)[0]
                          for x, y in np.asarray(punti_boccia)[tenuti]])
        # Il residuo qui e' un numero onesto: dice di quanto il raggio
        # ricostruito ondeggia lungo il giro, cioe' quanto l'ipotesi affine
        # sta sbagliando su questa inquadratura.
        cal.residuo_gradi = float("nan")
        cal.ondeggio_raggio = float(np.std(raggi))
        cal.punti_tenuti = int(tenuti.sum())
        cal.punti_totali = int(len(punti_boccia))
        return cal

    @classmethod
    def da_punti_noti(cls, punti_immagine, angoli_rad, raggio=1.0):
        """Omografia piena da punti sul bordo di cui si conosce l'angolo.

        I quattro diamanti a 90 gradi l'uno dall'altro sono i candidati
        naturali. Gestisce la prospettiva vera, e in piu' ancora l'angolo
        assoluto - cioe' i diamanti risultano numerati davvero, non a meno di
        una rotazione.
        """
        angoli = np.asarray(angoli_rad, dtype=float)
        piano = np.column_stack([raggio * np.cos(angoli), raggio * np.sin(angoli)])
        H = omografia_dlt(punti_immagine, piano)
        cal = cls(H, metodo="omografia da punti noti")
        cal.residuo_gradi = cal.residuo_angolare(punti_immagine, angoli)
        return cal

    def punto_a_polari(self, x, y):
        """Da pixel (anche frazionari) a (raggio, angolo) nel piano ruota."""
        v = self.Hinv @ np.array([x, y, 1.0], dtype=float)
        X, Y = v[0] / v[2], v[1] / v[2]
        return float(math.hypot(X, Y)), float(math.atan2(Y, X))

    def polari_a_punto(self, raggio, angolo):
        """Da (raggio, angolo) nel piano ruota a pixel. Accetta scalari o array
        di qualunque forma: `profilo_angolare` passa griglie 2-D, e la prima
        versione le appiattiva male facendo esplodere il prodotto. Non se n'era
        accorto nessuno perche' la fase del rotore non era provata da capo a
        fondo - lo e' adesso."""
        R = np.asarray(raggio, dtype=float)
        A = np.asarray(angolo, dtype=float)
        forma = np.broadcast_shapes(R.shape, A.shape)
        X = np.broadcast_to(R * np.cos(A), forma).ravel()
        Y = np.broadcast_to(R * np.sin(A), forma).ravel()
        v = self.H @ np.stack([X, Y, np.ones_like(X)])
        x, y = v[0] / v[2], v[1] / v[2]
        if forma == ():
            return float(x[0]), float(y[0])
        return x.reshape(forma), y.reshape(forma)

    def mappa(self, larghezza, altezza):
        """Raggio e angolo di OGNI pixel. Si calcola una volta e si riusa:
        e' la maschera che tiene la ricerca della boccia dentro la pista."""
        yy, xx = np.mgrid[0:altezza, 0:larghezza]
        punti = np.stack([xx.ravel(), yy.ravel(), np.ones(xx.size)])
        mondo = self.Hinv @ punti
        mondo = mondo[:2] / mondo[2]
        X = mondo[0].reshape(altezza, larghezza)
        Y = mondo[1].reshape(altezza, larghezza)
        return np.hypot(X, Y), np.arctan2(Y, X)

    def residuo_angolare(self, punti_immagine, angoli_veri):
        """Quanto sbaglia la calibrazione sui punti che dovrebbe azzeccare.

        E' un autocontrollo, non una misura di qualita' assoluta (i punti sono
        gli stessi del fit), ma prende comunque i casi in cui il bordo e' stato
        cliccato male o l'ellisse ha agganciato il bordo del mobile invece
        della banchina. Sopra il grado, meglio rifarla.
        """
        errori = []
        for (x, y), vero in zip(punti_immagine, angoli_veri):
            _, ang = self.punto_a_polari(x, y)
            d = (ang - vero + math.pi) % DUE_PI - math.pi
            errori.append(abs(math.degrees(d)))
        return float(np.max(errori)) if errori else float("nan")


def punti_bordo_da_maschera(immagine, soglia=None, passo_angolare=2.0, spessore=4):
    """Punti del bordo esterno luminoso. Ripiego, non prima scelta.

    Dal baricentro della parte chiara si spara un raggio ogni `passo_angolare`
    gradi e si prende il punto piu' lontano sopra soglia che abbia dietro di se'
    almeno `spessore` pixel pieni. Quel "dietro di se'" non e' un dettaglio: la
    regola ingenua - il pixel piu' lontano sopra soglia - prende il singolo
    riflesso isolato a mezzo schermo di distanza, e un solo punto fuori posto
    sposta l'ellisse del doppio del suo raggio. E' esattamente il modo in cui
    questa funzione ha sbagliato la prima volta che e' stata provata.

    Per la calibrazione automatica si preferisce `Calibrazione.da_traiettoria`:
    il bordo del mobile non e' la pista, mentre la boccia percorre proprio la
    circonferenza che interessa.
    """
    img = np.asarray(immagine, dtype=float)
    if soglia is None:
        # Meta' strada fra il fondo e il chiaro, non un percentile: se la ruota
        # occupa un quinto dell'inquadratura il settantesimo percentile cade
        # nel nero e la maschera prende tutto.
        scuro = float(np.percentile(img, 20))
        chiaro = float(np.percentile(img, 99))
        soglia = scuro + 0.5 * (chiaro - scuro)
    maschera = img > soglia
    if not maschera.any():
        raise ValueError("punti_bordo_da_maschera: nessun pixel sopra soglia")
    ys, xs = np.nonzero(maschera)
    cx, cy = xs.mean(), ys.mean()
    altezza, larghezza = img.shape
    punti = []
    for gradi in np.arange(0.0, 360.0, passo_angolare):
        a = math.radians(gradi)
        dx, dy = math.cos(a), math.sin(a)
        massimo = None
        pieni = 0
        lunghezza = int(math.hypot(larghezza, altezza))
        for d in range(5, lunghezza):
            x, y = int(round(cx + dx * d)), int(round(cy + dy * d))
            if not (0 <= x < larghezza and 0 <= y < altezza):
                break
            if maschera[y, x]:
                pieni += 1
                if pieni >= spessore:
                    massimo = (x, y)
            else:
                pieni = 0
        if massimo:
            punti.append(massimo)
    if len(punti) < 5:
        raise ValueError("punti_bordo_da_maschera: bordo non trovato")
    return np.array(punti, dtype=float)


# ---------------------------------------------------------------- fondo e boccia

def sfondo_mediano(fotogrammi, massimo=120):
    """Mediana temporale su un campione di fotogrammi.

    `massimo` limita la memoria: 120 fotogrammi a 720p sono gia' 66 MB in
    float, e la mediana non migliora piu' dopo qualche decina.
    """
    pila = []
    for i, f in enumerate(fotogrammi):
        if len(pila) < massimo:
            pila.append(np.asarray(f, dtype=np.float32))
    if not pila:
        raise ValueError("sfondo_mediano: nessun fotogramma")
    return np.median(np.stack(pila), axis=0)


def _centroide(differenza, x0, y0, raggio=7):
    """Baricentro pesato in una finestra attorno al massimo: da' il sub-pixel.

    Il massimo secco sta sul pixel, e su una boccia da 10 pixel il pixel vale
    gia' mezzo grado di angolo. Il baricentro pesato dell'intorno costa niente
    e toglie quel termine.
    """
    altezza, larghezza = differenza.shape
    x0, y0 = int(round(x0)), int(round(y0))
    xa, xb = max(0, x0 - raggio), min(larghezza, x0 + raggio + 1)
    ya, yb = max(0, y0 - raggio), min(altezza, y0 + raggio + 1)
    finestra = differenza[ya:yb, xa:xb]
    peso = finestra.sum()
    if peso <= 0:
        return float(x0), float(y0)
    yy, xx = np.mgrid[ya:yb, xa:xb]
    return float((xx * finestra).sum() / peso), float((yy * finestra).sum() / peso)


def rileva_blob(differenza, soglia_rel=0.35, raggio_finestra=7):
    """Il punto piu' luminoso di un'immagine di differenza, in sub-pixel.

    Ritorna (x, y, altezza_del_picco). Nessuna calibrazione, nessuna maschera:
    e' il mattone usato sia dalla calibrazione da traiettoria (che gira prima
    di sapere dove sia la pista) sia dal tracking vero.
    """
    diff = np.asarray(differenza, dtype=np.float32)
    picco = float(diff.max())
    if picco <= 0:
        return float("nan"), float("nan"), 0.0
    iy, ix = np.unravel_index(int(np.argmax(diff)), diff.shape)
    pulita = np.where(diff > soglia_rel * picco, diff, 0.0)
    x, y = _centroide(pulita, ix, iy, raggio=raggio_finestra)
    return x, y, picco


def punti_traiettoria(fotogrammi, sfondo, soglia_minima=8.0):
    """Le posizioni in pixel della boccia, fotogramma per fotogramma.

    Nessun filtro geometrico: qui non si sa ancora dov'e' la pista. I punti
    sbagliati (riflessi, mano del croupier, la boccia gia' caduta) li toglie
    dopo il fit robusto dell'ellisse.
    """
    sfondo = np.asarray(sfondo, dtype=np.float32)
    punti = []
    for f in fotogrammi:
        diff = np.abs(np.asarray(f, dtype=np.float32) - sfondo)
        x, y, picco = rileva_blob(diff)
        if picco >= soglia_minima and math.isfinite(x):
            punti.append((x, y))
    if len(punti) < 8:
        raise ValueError("punti_traiettoria: la boccia non si vede quasi mai")
    return np.array(punti, dtype=float)


def adatta_ellisse_robusta(punti, iterazioni=4, taglio_mad=3.0, minimo=12):
    """Fit dell'ellisse con scarto iterativo dei punti fuori posto.

    Il fit ai minimi quadrati non ha nessuna difesa contro gli outlier, e qui
    ce ne sono di sistematici: i fotogrammi dopo la caduta hanno la boccia
    dentro la pista, e sono decine. Si fitta, si misura il raggio di ogni punto
    nel sistema raddrizzato, si buttano quelli oltre `taglio_mad` deviazioni
    mediane da 1, si rifitta.

    Ritorna (ellisse, maschera_dei_punti_tenuti).
    """
    p = np.asarray(punti, dtype=float)
    tenuti = np.ones(p.shape[0], dtype=bool)
    ellisse = adatta_ellisse(p)
    for _ in range(iterazioni):
        cal = Calibrazione.da_ellisse(ellisse)
        raggi = np.array([cal.punto_a_polari(x, y)[0] for x, y in p])
        scarto = np.abs(raggi - np.median(raggi))
        mad = float(np.median(scarto))
        if mad <= 0:
            break
        nuovi = scarto <= taglio_mad * mad
        if nuovi.sum() < max(minimo, 5) or np.array_equal(nuovi, tenuti):
            break
        tenuti = nuovi
        ellisse = adatta_ellisse(p[tenuti])
    return ellisse, tenuti


def traccia(fotogrammi, calibrazione, fps, sfondo=None, raggio_pista=1.0,
            tolleranza_pista=0.30, soglia_rel=0.35):
    """Posizione polare della boccia in ogni fotogramma.

    Ritorna (t, raggio, angolo) con NaN dove la boccia non si e' vista: i buchi
    NON si interpolano qui. Interpolare un buco significa inventare un dato in
    mezzo alla serie che poi il fit scambia per misura; i passaggi li salta e
    basta, e `passaggi` segnala quanti giri mancano.

    raggio_pista/tolleranza    l'anello dove cercare, in unita' del raggio di
                               calibrazione. Largo, perche' deve contenere
                               anche la boccia che comincia a scendere.
    soglia_rel                 frazione del massimo della differenza sotto la
                               quale si dichiara "non vista". Serve: dopo la
                               caduta la boccia esce dall'anello, e senza
                               soglia si aggancerebbe il rotore.
    """
    fotogrammi = iter(fotogrammi)
    primo = np.asarray(next(fotogrammi), dtype=np.float32)
    altezza, larghezza = primo.shape[:2]
    if sfondo is None:
        raise ValueError("traccia: serve lo sfondo (vedi sfondo_mediano)")
    sfondo = np.asarray(sfondo, dtype=np.float32)
    raggi_pixel, _ = calibrazione.mappa(larghezza, altezza)
    anello = (np.abs(raggi_pixel - raggio_pista) < tolleranza_pista)
    if not anello.any():
        raise ValueError("traccia: l'anello di ricerca e' vuoto, calibrazione sbagliata?")

    t, rr, aa = [], [], []
    indice = 0
    for fotogramma in _con_primo(primo, fotogrammi):
        img = np.asarray(fotogramma, dtype=np.float32)
        diff = np.abs(img - sfondo)
        diff[~anello] = 0.0
        picco = float(diff.max())
        if picco < 8.0:  # niente si muove: boccia non vista
            rr.append(float("nan"))
            aa.append(float("nan"))
        else:
            iy, ix = np.unravel_index(int(np.argmax(diff)), diff.shape)
            pulita = np.where(diff > soglia_rel * picco, diff, 0.0)
            x, y = _centroide(pulita, ix, iy)
            raggio, angolo = calibrazione.punto_a_polari(x, y)
            rr.append(raggio)
            aa.append(angolo)
        t.append(indice / fps)
        indice += 1
    return np.array(t), np.array(rr), np.array(aa)


def _con_primo(primo, resto):
    yield primo
    for x in resto:
        yield x


# ---------------------------------------------------------------- il tripwire

def passaggi(t, angolo, angolo_tripwire=0.0):
    """Istanti in cui la boccia attraversa la semiretta fissa, con sub-frame.

    Ritorna (tempi, giri, avvisi):
      tempi   istanti interpolati
      giri    indice del giro di ogni passaggio, con i buchi saltati. Va
              passato tale e quale a `modello.adatta(..., giri=...)`: un giro
              perso e non dichiarato sposta il fit di un giro intero, che e'
              l'errore piu' grosso che questa catena possa fare.
      avvisi  elenco di cose andate storte, in italiano

    Come funziona: si srotola l'angolo, si conta in giri (u = angolo/2pi) e si
    cerca ogni attraversamento di un intero. Il tempo si interpola linearmente
    fra i due fotogrammi che lo circondano. La curvatura di angolo(t) dentro un
    fotogramma e' trascurabile - omega cambia dello 0,03% in 16 ms - quindi
    l'interpolazione lineare non lascia bias apprezzabile.
    """
    t = np.asarray(t, dtype=float)
    ang = np.asarray(angolo, dtype=float)
    buoni = np.isfinite(ang)
    if buoni.sum() < 3:
        raise ValueError("passaggi: troppi fotogrammi senza boccia")
    tb, ab = t[buoni], ang[buoni]
    srotolato = np.unwrap(ab)

    avvisi = []
    verso = 1.0 if np.median(np.diff(srotolato)) > 0 else -1.0
    if verso < 0:
        srotolato = -srotolato
        angolo_tripwire = -angolo_tripwire
        avvisi.append("la boccia gira in senso orario: angoli invertiti di segno")

    u = (srotolato - angolo_tripwire) / DUE_PI
    salti = np.abs(np.diff(u))
    if np.any(salti > 0.75):
        avvisi.append("almeno un intervallo copre piu' di 3/4 di giro: fps troppo "
                      "bassi o buchi nel tracking, i passaggi in quei punti "
                      "sono dichiarati mancanti")

    # Intervalli semiaperti [a, b): un attraversamento che cade esattamente su
    # un fotogramma appartiene all'intervallo che comincia li', e a quello solo.
    # Con [a, b] verrebbe contato due volte; con (a, b] - che era la prima
    # versione - si perdeva quello sul primissimo fotogramma, cioe' un giro
    # intero in meno all'inizio della serie. Non e' un caso di scuola: capita
    # ogni volta che si taglia il video a partire da un passaggio.
    tempi, giri = [], []
    for i in range(u.size - 1):
        a, b = u[i], u[i + 1]
        if b <= a:
            continue
        k = int(math.ceil(a))
        while k < b:
            frazione = (k - a) / (b - a)
            tempi.append(float(tb[i] + frazione * (tb[i + 1] - tb[i])))
            giri.append(int(k))
            k += 1
    if len(tempi) < 2:
        raise ValueError("passaggi: nessun attraversamento trovato")
    giri = np.array(giri) - giri[0]
    mancanti = int(giri[-1] + 1 - len(giri))
    if mancanti > 0:
        avvisi.append("%d passaggi mancanti, dichiarati in `giri`" % mancanti)
    return np.array(tempi), giri, avvisi


# ---------------------------------------------------------------- la caduta

def correggi_ondeggio(raggi, angoli, armoniche=2, iterazioni=3, taglio_mad=3.0,
                      maschera_fit=None):
    """Toglie dal raggio la parte che dipende solo dall'angolo.

    PERCHE' ESISTE. Il raggio ricostruito di una boccia che sta ferma sulla
    banchina non e' costante: ondeggia dell'1-3% lungo il giro. Le cause sono
    tutte sistematiche - la prospettiva residua che il raddrizzamento affine
    non toglie, il centro dell'ellisse stimato mezzo pixel fuori, la boccia che
    si proietta allungata nella direzione radente. Essendo sistematiche, sono
    una funzione liscia dell'angolo, e una funzione liscia si stima e si
    sottrae.

    Conta perche' la caduta si legge sul raggio: un ondeggio del 2,5% su una
    discesa che vale il 35% in un quarto di secondo sposta il ginocchio di una
    ventina di millisecondi, in un verso che cambia a ogni spin a seconda di
    dove la boccia si trova quando cade. Cioe' e' rumore vero sul dato che
    calibra omega_c.

    Il fit e' sui primi `armoniche` coseni e seni dell'angolo (l'errore
    prospettico e' dominato dalla prima armonica, quello di centratura pure) e
    salta i punti fuori posto, che sono i fotogrammi dopo la caduta.

    Ritorna (raggi_corretti, ampiezza_dell_ondeggio).
    """
    r = np.asarray(raggi, dtype=float)
    a = np.asarray(angoli, dtype=float)
    buoni = np.isfinite(r) & np.isfinite(a)
    if maschera_fit is not None:
        # I fotogrammi dopo la caduta vanno esclusi dal fit, non lasciati allo
        # scarto robusto: sono un quarto della serie e tutti dalla stessa parte,
        # cioe' troppi e troppo coerenti perche' una soglia su MAD li veda come
        # outlier. Li riconosce invece il primo passaggio del rilevatore di
        # caduta, ed e' il motivo per cui `estrai` lo chiama due volte.
        buoni = buoni & np.asarray(maschera_fit, dtype=bool)
    if buoni.sum() < 4 * armoniche + 4:
        return r, float("nan")

    colonne = [np.ones(buoni.sum())]
    for k in range(1, armoniche + 1):
        colonne += [np.cos(k * a[buoni]), np.sin(k * a[buoni])]
    A = np.column_stack(colonne)
    y = r[buoni]
    peso = np.ones(y.size, dtype=bool)
    coefficienti = None
    for _ in range(iterazioni):
        if peso.sum() < A.shape[1] + 2:
            break
        coefficienti, *_ = np.linalg.lstsq(A[peso], y[peso], rcond=None)
        residuo = y - A @ coefficienti
        mad = float(np.median(np.abs(residuo - np.median(residuo))))
        if mad <= 0:
            break
        nuovo = np.abs(residuo - np.median(residuo)) <= taglio_mad * mad
        if np.array_equal(nuovo, peso):
            break
        peso = nuovo
    if coefficienti is None:
        return r, float("nan")

    # Il modello si valuta su TUTTI i fotogrammi, anche quelli dopo la caduta:
    # la correzione dipende solo dall'angolo, e li' vale ugualmente.
    colonne_tutti = [np.ones(r.size)]
    for k in range(1, armoniche + 1):
        colonne_tutti += [np.cos(k * a), np.sin(k * a)]
    modello = np.column_stack(colonne_tutti) @ coefficienti
    ampiezza = float(np.std(A[:, 1:] @ coefficienti[1:])) if coefficienti.size > 1 else 0.0
    corretti = np.where(np.isfinite(modello) & (modello > 0), r / modello * coefficienti[0], r)
    return corretti, ampiezza


def istante_caduta(t, raggio, calo=0.04, conferme=4, k_mad=6.0):
    """Quando la boccia lascia la pista, dalla discontinuita' del raggio.

    Riferimento: la mediana del raggio nella prima meta' della serie (robusta,
    la boccia sta sulla banchina per quasi tutto il tempo). Soglia: il
    riferimento meno il PIU' GRANDE fra un calo relativo fisso e `k_mad`
    deviazioni mediane del raggio misurato.

    Quel massimo e' la correzione che conta. Una soglia fissa al 4% funziona
    finche' la ruota riempie l'inquadratura; quando la ruota e' piccola - camera
    lontana, o grandangolo - il raggio ricostruito ondeggia gia' del 3-4% per
    conto suo, e la soglia fissa scatta a meta' spin dichiarando una caduta che
    non c'e'. Siccome quel numero e' poi il dato che calibra omega_c, l'errore
    non resta locale: avvelena tutta la sessione. Legandola al rumore misurato
    la soglia si adatta da sola all'inquadratura.

    Ritorna (istante, raggio_di_riferimento).
    """
    t = np.asarray(t, dtype=float)
    r = np.asarray(raggio, dtype=float)
    buoni = np.isfinite(r)
    if buoni.sum() < 10:
        raise ValueError("istante_caduta: troppi pochi raggi validi")
    tb, rb = t[buoni], r[buoni]
    meta = max(5, rb.size // 2)
    riferimento = float(np.median(rb[:meta]))
    mad = float(np.median(np.abs(rb[:meta] - riferimento)))
    soglia = riferimento - max(calo * riferimento, k_mad * mad)
    if soglia <= 0:
        raise ValueError("istante_caduta: il raggio e' troppo rumoroso per "
                         "distinguere la caduta (calibrazione da rifare?)")
    sotto = rb < soglia
    conferma = None
    for i in range(sotto.size - conferme):
        if sotto[i] and sotto[i:i + conferme].all():
            conferma = i
            break
    if conferma is None:
        raise ValueError("istante_caduta: il raggio non cala mai, la boccia non "
                         "cade dentro la ripresa")
    if conferma == 0:
        return float(tb[0]), riferimento

    # Il momento in cui la soglia viene attraversata NON e' il momento in cui la
    # boccia lascia la pista: e' quello in cui e' gia' scesa abbastanza da
    # superare il rumore, cioe' sistematicamente tardi (di 50-100 ms, misurati).
    # Siccome e' il dato che calibra omega_c, un ritardo costante si tradurrebbe
    # in una soglia sbagliata per tutta la sessione.
    #
    # Si stima invece il ginocchio: si fitta una retta sul tratto in discesa e
    # si intercetta la linea di base. La discesa vera non e' rettilinea, ma nel
    # primo decimo di secondo lo e' abbastanza, e l'intersezione toglie quasi
    # tutto il ritardo.
    inizio = conferma
    while inizio > 0 and rb[inizio - 1] < riferimento - 2.0 * mad:
        inizio -= 1
    fine = min(rb.size, conferma + conferme + 2)
    if fine - inizio >= 3:
        pendenza, intercetta = np.polyfit(tb[inizio:fine], rb[inizio:fine], 1)
        if pendenza < 0:
            stima = (riferimento - intercetta) / pendenza
            # Il ginocchio deve stare fra l'ultimo raggio sano e la conferma:
            # fuori da li' il fit ha preso una retta che non c'entra.
            minimo = tb[max(0, inizio - 3)]
            if minimo <= stima <= tb[conferma]:
                return float(stima), riferimento

    r0, r1 = rb[conferma - 1], rb[conferma]
    if r1 == r0:
        return float(tb[conferma]), riferimento
    frazione = (r0 - soglia) / (r0 - r1)
    return float(tb[conferma - 1] + frazione * (tb[conferma] - tb[conferma - 1])), riferimento


# ---------------------------------------------------------------- il rotore

def copertura_angolare(calibrazione, larghezza, altezza, raggio_interno=0.30,
                       raggio_esterno=0.70, n_bin=720, n_radiale=12,
                       maschera_pixel=None):
    """Quanta parte di ogni bin angolare e' davvero visibile.

    Serve per le riprese occluse, che nelle app di casino' online sono la
    regola e non l'eccezione: il racetrack delle puntate copre il centro della
    ruota e lascia scoperti due spicchi. Su un video cosi' la correlazione di
    fase sul profilo intero non aggancia il rotore, aggancia l'OVERLAY - che e'
    fermo, periodico e molto contrastato - e restituisce velocita' prossima a
    zero con aria convinta.

    `maschera_pixel` e' una matrice booleana della dimensione dell'immagine:
    True dove il pixel e' utilizzabile. Se manca si considera visibile tutto
    quello che cade dentro l'inquadratura.

    Ritorna un vettore di `n_bin` frazioni fra 0 e 1.
    """
    angoli = np.linspace(0.0, DUE_PI, n_bin, endpoint=False)
    raggi = np.linspace(raggio_interno, raggio_esterno, n_radiale)
    A, R = np.meshgrid(angoli, raggi)
    x, y = calibrazione.polari_a_punto(R, A)
    dentro = (x >= 0) & (x < larghezza - 1) & (y >= 0) & (y < altezza - 1)
    if maschera_pixel is not None:
        xi = np.clip(np.round(x).astype(int), 0, larghezza - 1)
        yi = np.clip(np.round(y).astype(int), 0, altezza - 1)
        dentro &= np.asarray(maschera_pixel, dtype=bool)[yi, xi]
    return dentro.mean(axis=0)


def spostamento_mascherato(p1, p2, buoni, massimo_bin, centro=0.0):
    """Spostamento fra due profili quando una parte dell'angolo non si vede.

    Correlazione incrociata normalizzata calcolata SOLO sul supporto valido,
    cercata a spostamenti interi dentro la finestra e poi raffinata con una
    parabola sulla curva di correlazione. Niente FFT: con dei buchi la FFT
    considererebbe gli zeri come segnale, ed e' proprio da li' che nasce
    l'aggancio sull'overlay.

    Ritorna (spostamento in radianti, correlazione al picco), con lo stesso
    segno e la stessa convenzione di `spostamento_fase` - che non e' gratis:
    qui si cerca di quanto ARRETRARE p1 per sovrapporlo a p2, che e' l'opposto,
    e senza il segno cambiato le due funzioni darebbero rotori che girano al
    contrario a seconda di quale ramo del codice si attiva.

    Una correlazione bassa - sotto 0,4 - vuol dire che l'aggancio non c'e'
    stato, e il numero va buttato invece che mediato con gli altri.
    """
    a = np.asarray(p1, dtype=float)
    b = np.asarray(p2, dtype=float)
    buoni = np.asarray(buoni, dtype=bool)
    n = a.size
    centro_bin = int(round(centro * n / DUE_PI))
    spostamenti = np.arange(centro_bin - massimo_bin, centro_bin + massimo_bin + 1)
    correlazioni = np.full(spostamenti.size, -2.0)
    for i, s in enumerate(spostamenti):
        m = buoni & np.roll(buoni, s)
        if m.sum() < max(32, n // 20):
            continue
        u = np.roll(a, s)[m]
        v = b[m]
        u = u - u.mean()
        v = v - v.mean()
        norma = np.linalg.norm(u) * np.linalg.norm(v)
        if norma <= 0:
            continue
        correlazioni[i] = float(u @ v / norma)
    j = int(np.argmax(correlazioni))
    if correlazioni[j] <= -1.5:
        return float("nan"), 0.0
    delta = 0.0
    if 0 < j < spostamenti.size - 1:
        y0, y1, y2 = correlazioni[j - 1], correlazioni[j], correlazioni[j + 1]
        den = y0 - 2 * y1 + y2
        if abs(den) > 1e-12:
            delta = 0.5 * (y0 - y2) / den
    return -(spostamenti[j] + delta) * DUE_PI / n, float(correlazioni[j])


def profilo_angolare(immagine, calibrazione, raggio_interno=0.30, raggio_esterno=0.70,
                     n_bin=720, n_radiale=12):
    """L'anello del rotore srotolato in un profilo di intensita' p(angolo).

    Campionamento bilineare su una griglia polare: si legge l'immagine dove
    serve invece di raggrupparne i pixel, cosi' il profilo non dipende da come
    i pixel cadono nei bin (che cambia con la posizione e introduce un
    battimento con la periodicita' delle caselle).
    """
    img = np.asarray(immagine, dtype=np.float32)
    altezza, larghezza = img.shape[:2]
    angoli = np.linspace(0.0, DUE_PI, n_bin, endpoint=False)
    raggi = np.linspace(raggio_interno, raggio_esterno, n_radiale)
    A, R = np.meshgrid(angoli, raggi)
    x, y = calibrazione.polari_a_punto(R, A)

    x0 = np.clip(np.floor(x).astype(int), 0, larghezza - 2)
    y0 = np.clip(np.floor(y).astype(int), 0, altezza - 2)
    fx, fy = np.clip(x - x0, 0, 1), np.clip(y - y0, 0, 1)
    valori = ((1 - fx) * (1 - fy) * img[y0, x0] + fx * (1 - fy) * img[y0, x0 + 1]
              + (1 - fx) * fy * img[y0 + 1, x0] + fx * fy * img[y0 + 1, x0 + 1])
    return valori.mean(axis=0)


def spostamento_fase(p1, p2, massimo_bin=None, centro=0.0, armonica=True):
    """Correlazione di fase 1-D fra due profili, con picco sub-bin.

    LA TRAPPOLA DELLE 37 CASELLE, e il vincolo su fps che ne esce.

    Il profilo del rotore e' quasi periodico con periodo 2pi/37 = 9,73 gradi,
    quindi la correlazione ha 37 picchi quasi uguali: lo zero verde e i numeri
    li distinguono appena. Il massimo globale e' quindi quello VERO piu' un
    multiplo qualunque del passo casella, deciso da dettagli irrilevanti.

    Rimedio: cercare il picco solo dentro una finestra, centrata non su zero ma
    sullo spostamento ATTESO (`centro`). Il che funziona finche'

        spostamento per fotogramma < mezzo passo casella

    cioe' - con 37 caselle - finche'  fps > 74 * giri_al_secondo_del_rotore.
    Un rotore da 0,8 giri/s vuole almeno 59 fps: a 30 fps la fase del rotore
    NON e' recuperabile per correlazione, e non e' un problema di codice ma di
    campionamento. Vedi `fps_minimi_rotore`.

    Nota che questo NON riguarda la boccia: quella si misura per posizione, non
    per correlazione, e un passaggio si riconosce comunque.
    """
    a = np.asarray(p1, dtype=float)
    b = np.asarray(p2, dtype=float)
    if a.shape != b.shape:
        raise ValueError("spostamento_fase: profili di lunghezza diversa")
    n = a.size
    a = a - a.mean()
    b = b - b.mean()
    A, B = np.fft.rfft(a), np.fft.rfft(b)
    incrociato = A * np.conj(B)
    modulo = np.abs(incrociato)
    modulo[modulo < 1e-12] = 1e-12
    correlazione = np.fft.irfft(incrociato / modulo, n)

    if massimo_bin is None:
        indice = int(np.argmax(correlazione))
    else:
        finestra = int(max(1, massimo_bin))
        centro_bin = int(round(centro * n / DUE_PI))
        candidati = (np.arange(centro_bin - finestra, centro_bin + finestra + 1)) % n
        indice = int(candidati[int(np.argmax(correlazione[candidati]))])

    # Picco sub-bin per parabola sui tre campioni attorno al massimo.
    y0 = correlazione[(indice - 1) % n]
    y1 = correlazione[indice]
    y2 = correlazione[(indice + 1) % n]
    den = y0 - 2 * y1 + y2
    delta = 0.5 * (y0 - y2) / den if abs(den) > 1e-15 else 0.0
    spostamento = indice + delta
    if spostamento > n / 2:
        spostamento -= n
    grezzo = spostamento * DUE_PI / n

    if not armonica:
        return grezzo

    # RAFFINAMENTO SULL'ARMONICA DOMINANTE, e perche' serve.
    #
    # La correlazione di fase sbianca lo spettro, quindi il picco che ne esce e'
    # quasi una delta: interpolarlo con una parabola su tre campioni e' una
    # stima cattiva, e cattiva in modo SISTEMATICO, non rumoroso. Misurato sul
    # video sintetico: la velocita' del rotore usciva sbagliata del 5% con 720
    # bin, e infittendo i bin peggiorava invece di migliorare - che e' la firma
    # di un bias di interpolazione, non di risoluzione.
    #
    # Il rotore pero' ha una firma spettrale fortissima su una sola armonica,
    # quella delle caselle (k = 37). La fase di quell'armonica da' lo
    # spostamento in modo esatto, ma solo MODULO 2*pi/k - cioe' modulo un passo
    # casella, che e' la stessa ambiguita' di prima. Si usano quindi le due
    # cose insieme: il picco nella finestra sceglie il passo, l'armonica da' la
    # posizione dentro il passo. Errore che ne esce: qualche millesimo di grado
    # invece di qualche centesimo.
    ampiezze = np.abs(B)
    alto = max(3, ampiezze.size // 4)
    if alto <= 2:
        return grezzo
    k = int(np.argmax(ampiezze[2:alto]) + 2)
    if ampiezze[k] < 3.0 * float(np.median(ampiezze[2:alto])):
        return grezzo  # nessuna armonica davvero dominante: meglio il grezzo
    fase = float(np.angle(incrociato[k]))
    m = round((-grezzo * k - fase) / DUE_PI)
    return -(fase + DUE_PI * m) / k


def fps_minimi_rotore(giri_al_secondo, n_caselle=37, margine=2.0):
    """Gli fps sotto i quali la fase del rotore non e' piu' recuperabile.

    La correlazione di fase distingue lo spostamento vero dall'alias solo se
    fra due fotogrammi il rotore si muove meno di mezzo passo casella. Con
    `margine` = 2 si chiede il doppio di sicurezza, perche' il rotore accelera
    quando il croupier lo rilancia.

        fps_minimi = margine * n_caselle * giri_al_secondo
    """
    return margine * n_caselle * abs(giri_al_secondo)


def fase_rotore(fotogrammi, calibrazione, fps, n_bin=720, massimo_gradi=None,
                n_caselle=37, giri_al_secondo_attesi=None, maschera_pixel=None,
                correlazione_minima=0.4, **kw):
    """Angolo cumulato del rotore, fotogramma per fotogramma.

    Non serve a prevedere la caduta - il settore di caduta vive nel sistema
    dello statore e i diamanti sono fissi - ma serve dopo, per passare dal
    diamante al numero. Sta qui perche' e' lo stesso video e la stessa
    calibrazione.

    La finestra di ricerca insegue: si centra sullo spostamento del fotogramma
    precedente, non su zero. Cosi' il vincolo diventa "il rotore non deve
    ACCELERARE di mezzo passo casella per fotogramma" invece di "non deve
    MUOVERSI di mezzo passo casella", che e' molto piu' facile da rispettare.
    Il primo passo pero' parte al buio: se il rotore gia' si muove piu' di
    mezzo passo, la fase si aggancia sbagliata e ci resta. Per questo si puo'
    dare `giri_al_secondo_attesi` per seminare l'inseguimento.

    Ritorna (t, angolo_cumulato, omega_media, avvisi).
    """
    # La finestra deve stare SOTTO il mezzo passo casella, se no contiene due
    # picchi e la scelta torna ad essere arbitraria. Non e' un parametro da
    # regolare a occhio: lo detta il numero di caselle.
    if massimo_gradi is None:
        massimo_gradi = 0.8 * (180.0 / n_caselle)
    massimo_bin = int(math.ceil(massimo_gradi / 360.0 * n_bin))
    atteso = (DUE_PI * giri_al_secondo_attesi / fps
              if giri_al_secondo_attesi is not None else 0.0)

    buoni = None
    if maschera_pixel is not None:
        prima = np.asarray(next(iter(fotogrammi)))
        copertura = copertura_angolare(calibrazione, prima.shape[1], prima.shape[0],
                                       n_bin=n_bin, maschera_pixel=maschera_pixel,
                                       **{k: v for k, v in kw.items()
                                          if k in ("raggio_interno", "raggio_esterno",
                                                   "n_radiale")})
        buoni = copertura > 0.9

    t, fasi, passi, scartati = [], [], [], 0
    precedente = None
    cumulato = 0.0
    for i, f in enumerate(fotogrammi):
        p = profilo_angolare(f, calibrazione, n_bin=n_bin, **kw)
        if precedente is not None:
            if buoni is None:
                passo = spostamento_fase(p, precedente, massimo_bin=massimo_bin,
                                         centro=atteso)
                qualita = 1.0
            else:
                passo, qualita = spostamento_mascherato(p, precedente, buoni,
                                                        massimo_bin, centro=atteso)
            if math.isfinite(passo) and qualita >= correlazione_minima:
                cumulato += passo
                passi.append(passo)
                atteso = passo  # la finestra insegue
            else:
                scartati += 1
        precedente = p
        t.append(i / fps)
        fasi.append(cumulato)
    if len(t) < 2:
        raise ValueError("fase_rotore: servono almeno due fotogrammi")
    t = np.array(t)
    fasi = np.array(fasi)
    omega = float(np.polyfit(t, fasi, 1)[0])

    avvisi = []
    if buoni is not None:
        avvisi.append("ripresa occlusa: solo il %.0f%% della circonferenza e' "
                      "visibile" % (100 * buoni.mean()))
    if scartati:
        avvisi.append("%d passi su %d scartati per correlazione bassa"
                      % (scartati, scartati + len(passi)))
    mezzo_passo = math.pi / n_caselle
    tipico = float(np.median(np.abs(passi))) if passi else 0.0
    if tipico > mezzo_passo:
        avvisi.append(
            "il rotore si sposta di %.1f gradi per fotogramma, contro un mezzo "
            "passo casella di %.1f: la fase e' aliasata e il valore che esce e' "
            "sbagliato di un multiplo del passo. Servono almeno %.0f fps."
            % (math.degrees(tipico), math.degrees(mezzo_passo),
               fps_minimi_rotore(abs(omega) / DUE_PI, n_caselle)))
    return t, fasi, omega, avvisi


# ---------------------------------------------------------------- lettura video

class SorgenteVideo:
    """Fotogrammi in scala di grigi da un file. Qui serve OpenCV.

    Si tiene separata dal resto apposta: tutta l'analisi lavora su array, e
    infatti `autotest.py` la prova su fotogrammi sintetici senza aprire niente.
    """

    def __init__(self, percorso, inizio=0, fine=None, passo=1):
        try:
            import cv2
        except ImportError as errore:
            raise ImportError(
                "per leggere i video serve OpenCV:  pip install opencv-python-headless"
            ) from errore
        self._cv2 = cv2
        self.percorso = str(percorso)
        self.inizio, self.fine, self.passo = inizio, fine, passo
        cap = cv2.VideoCapture(self.percorso)
        if not cap.isOpened():
            raise IOError("non riesco ad aprire il video: %s" % percorso)
        self.fps = float(cap.get(cv2.CAP_PROP_FPS)) or 30.0
        self.n_fotogrammi = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()
        if self.passo > 1:
            self.fps /= self.passo

    def __iter__(self):
        cv2 = self._cv2
        cap = cv2.VideoCapture(self.percorso)
        try:
            indice = 0
            emessi = 0
            while True:
                ok, fotogramma = cap.read()
                if not ok:
                    break
                if indice >= self.inizio and (self.fine is None or indice < self.fine):
                    if (indice - self.inizio) % self.passo == 0:
                        yield cv2.cvtColor(fotogramma, cv2.COLOR_BGR2GRAY)
                        emessi += 1
                indice += 1
                if self.fine is not None and indice >= self.fine:
                    break
        finally:
            cap.release()


# ---------------------------------------------------------------- la catena intera

def _angolo_a(t, angolo, istante):
    """L'angolo della boccia a un istante qualunque, interpolato e srotolato.

    ATTENZIONE ALL'ANGOLO ASSOLUTO. Con la calibrazione affine (da ellisse o da
    traiettoria) l'angolo e' definito a meno di una rotazione globale
    sconosciuta: i diamanti risultano numerati a partire da uno arbitrario. Va
    benissimo, PURCHE' LA CAMERA NON SI SPOSTI fra uno spin e l'altro - se si
    sposta, gli istogrammi di due sessioni non sono piu' confrontabili e
    sommarli mescola diamanti diversi. Per avere l'angolo assoluto, e potersi
    permettere di muovere la camera, si calibra con `Calibrazione.da_punti_noti`
    sui quattro diamanti.
    """
    t = np.asarray(t, dtype=float)
    a = np.asarray(angolo, dtype=float)
    buoni = np.isfinite(a)
    tb, ab = t[buoni], np.unwrap(a[buoni])
    if tb.size < 2:
        return None
    return float(np.interp(istante, tb, ab) % DUE_PI)


def estrai(fotogrammi, fps, calibrazione=None, angolo_tripwire=0.0,
           raggio_pista=None, tolleranza_pista=0.30, con_rotore=False,
           maschera_pixel=None):
    """Dal video ai numeri: un dizionario pronto da salvare in JSON.

    `fotogrammi` puo' essere una SorgenteVideo o una qualunque sequenza di
    array. Se e' un generatore viene materializzato: servono tre passate (fondo,
    boccia, eventualmente rotore).

    `maschera_pixel` marca i pixel utilizzabili (True) ed e' quello che serve
    sulle riprese di app, dove un'interfaccia copre parte della ruota: senza,
    la fase del rotore si aggancia all'interfaccia, che e' ferma e periodica, e
    restituisce una velocita' quasi nulla con tutta l'aria di essere giusta.

    `raggio_pista` lasciato a None si MISURA invece di darlo per scontato. Con
    la calibrazione da traiettoria vale 1 per costruzione, ma con una
    calibrazione passata da fuori - `da_punti_noti` su diamanti dichiarati in
    metri, per dire - puo' valere 0,26, e un anello di ricerca centrato su 1
    non troverebbe mai la boccia. Misurarlo costa una mediana e toglie un modo
    silenzioso di non funzionare.
    """
    fotogrammi = [np.asarray(f) for f in fotogrammi]
    if len(fotogrammi) < 10:
        raise ValueError("estrai: servono almeno una decina di fotogrammi")

    fondo = sfondo_mediano(fotogrammi)
    punti = punti_traiettoria(fotogrammi, fondo)
    if calibrazione is None:
        calibrazione = Calibrazione.da_traiettoria(punti)
    if raggio_pista is None:
        raggi_visti = np.array([calibrazione.punto_a_polari(x, y)[0] for x, y in punti])
        raggio_pista = float(np.median(raggi_visti))

    t, raggi, angoli = traccia(fotogrammi, calibrazione, fps, sfondo=fondo,
                               raggio_pista=raggio_pista,
                               tolleranza_pista=tolleranza_pista)
    # Due passaggi sulla caduta: il primo, sul raggio grezzo, serve solo a
    # sapere quali fotogrammi sono ancora "boccia in pista" e possono entrare
    # nel fit dell'ondeggio; il secondo, sul raggio corretto, e' quello buono.
    try:
        caduta_grezza, _ = istante_caduta(t, raggi)
        prima_della_caduta = t < caduta_grezza
    except ValueError:
        prima_della_caduta = None
    raggi, ampiezza_ondeggio = correggi_ondeggio(raggi, angoli,
                                                 maschera_fit=prima_della_caduta)
    tempi, giri, avvisi = passaggi(t, angoli, angolo_tripwire)
    ondeggio = float(getattr(calibrazione, "ondeggio_raggio", float("nan")))
    if math.isfinite(ondeggio) and ondeggio > 0.05:
        avvisi.append("il raggio ricostruito ondeggia del %.0f%%: la calibrazione "
                      "non tiene (ruota troppo piccola nel fotogramma, o "
                      "prospettiva forte). I tempi non sono affidabili."
                      % (100 * ondeggio))

    esito = {
        "fps": float(fps),
        "n_fotogrammi": len(fotogrammi),
        "calibrazione": calibrazione.metodo,
        "residuo_calibrazione_gradi": calibrazione.residuo_gradi,
        "ondeggio_raggio": float(getattr(calibrazione, "ondeggio_raggio", float("nan"))),
        "ondeggio_corretto": float(ampiezza_ondeggio),
        "angolo_tripwire": float(angolo_tripwire),
        "tempi": tempi.tolist(),
        "giri": [int(g) for g in giri],
        "frazione_fotogrammi_con_boccia": float(np.isfinite(angoli).mean()),
        "avvisi": list(avvisi),
    }
    try:
        t_caduta, raggio_pista_misurato = istante_caduta(t, raggi)
        esito["t_caduta"] = t_caduta
        esito["raggio_pista_misurato"] = raggio_pista_misurato
        esito["angolo_caduta"] = _angolo_a(t, angoli, t_caduta)
        esito["tempi"] = [x for x in esito["tempi"] if x <= t_caduta]
        esito["giri"] = esito["giri"][:len(esito["tempi"])]
    except ValueError as errore:
        esito["t_caduta"] = None
        esito["angolo_caduta"] = None
        esito["avvisi"].append("caduta non rilevata: %s" % errore)

    if con_rotore:
        _, fasi, omega_rotore, avvisi_rotore = fase_rotore(
            fotogrammi, calibrazione, fps, maschera_pixel=maschera_pixel)
        esito["omega_rotore"] = omega_rotore
        esito["fase_rotore"] = fasi.tolist()
        esito["avvisi"].extend(avvisi_rotore)
    return esito
