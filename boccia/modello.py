"""Il modello di decadimento della boccia e la previsione dell'istante di caduta.

L'IDEA IN UNA RIGA. La boccia lascia la banchina quando la sua velocita'
angolare scende sotto una soglia omega_c che dipende dalla geometria della
ruota e non dal giro in corso. Quindi: si stima la curva omega(t) dai pochi
giri che si vedono bene, e la si estrapola fino a omega_c.

DOVE SI FITTA, E PERCHE' LI'. La tentazione e' stimare omega giro per giro
(2*pi diviso il tempo di rivoluzione) e fare una retta su quei punti. Funziona,
ed e' qui dentro come `stima_da_velocita`, ma differenziare i tempi amplifica
il rumore e correla i residui di punti adiacenti: la banda di confidenza che ne
esce e' ottimista.

Il fit primario lavora invece direttamente sugli istanti di attraversamento.
Il dato misurato e' il tempo; l'angolo e' esatto per costruzione (fra un
passaggio e il successivo sullo stesso tripwire ci sono esattamente 2*pi). Si
inverte quindi il modello - "a che ora il modello dice che la boccia arriva a
questo angolo?" - e si minimizzano i residui IN SECONDI. Che e' comodo due
volte: e' la forma statisticamente corretta, e la deviazione standard del
residuo esce gia' nell'unita' di misura del budget di precisione.

LA FASE E' UN PARAMETRO. Il tempo si azzera sul primo attraversamento, e
l'angolo cumulato del primo passaggio (`fase`) si lascia libero. Senza, il
primo punto avrebbe residuo nullo per costruzione e le barre d'errore
sarebbero false.

I TRE MODELLI, e perche' quello a tre parametri di solito perde:

    lineare       domega/dt = -alfa                  (2 parametri)
    esponenziale  domega/dt = -omega/tau             (2 parametri)
    misto         domega/dt = -(a + b*omega)         (3 parametri)

Il misto e' il piu' "giusto" fisicamente - attrito volvente quasi costante piu'
resistenza dell'aria proporzionale alla velocita'. Ma su 3-4 rivoluzioni il
terzo parametro non e' sostenuto dai dati: estrapola PEGGIO, non meglio. Su
spin generati proprio con la legge mista - cioe' dove il modello a tre
parametri e' quello vero - a 5 giri osservati il lineare sbaglia 154 ms di rms
e il misto 206. La varianza in piu' del terzo parametro costa piu' del bias che
toglie, e si riprende solo oltre gli otto giri. Il default e' quindi `lineare`,
e non per pigrizia: lo misura `prove_budget` in `autotest.py`.
"""
import math

import numpy as np

GRAVITA = 9.80665
DUE_PI = 2.0 * math.pi


# ---------------------------------------------------------------- i modelli

class Lineare:
    """Decelerazione costante. Il modello di riferimento.

    omega(t) = omega0 - alfa*t. Non e' fisica dei principi primi: e' lo
    sviluppo al primo ordine di qualunque decadimento su una finestra corta, e
    la finestra che interessa qui (gli ultimi giri) e' corta.
    """

    nome = "lineare"
    parametri = ("omega0", "alfa")

    @staticmethod
    def omega(t, p):
        return p[0] - p[1] * t

    @staticmethod
    def theta(t, p):
        return p[0] * t - 0.5 * p[1] * t * t

    @staticmethod
    def tempo_a_angolo(th, p):
        omega0, alfa = p
        if abs(alfa) < 1e-12:
            return th / omega0 if omega0 > 0 else float("nan")
        disc = omega0 * omega0 - 2.0 * alfa * th
        if disc < 0.0:
            return float("nan")  # il modello si ferma prima di quell'angolo
        return (omega0 - math.sqrt(disc)) / alfa

    @staticmethod
    def tempo_a_omega(w, p):
        omega0, alfa = p
        if abs(alfa) < 1e-12:
            return float("nan")
        return (omega0 - w) / alfa

    @staticmethod
    def indovina(tempi, velocita, istanti):
        pendenza, intercetta = np.polyfit(istanti, velocita, 1)
        return [float(intercetta), float(-pendenza)]


class Esponenziale:
    """Decadimento puramente viscoso: omega(t) = omega0 * exp(-t/tau).

    Non arriva mai a zero, il che e' sbagliato come fisica (l'attrito volvente
    ferma la boccia in tempo finito) ma innocuo qui: la boccia cade molto prima
    di fermarsi, e nella finestra che conta le due curve sono indistinguibili.
    """

    nome = "esponenziale"
    parametri = ("omega0", "tau")

    @staticmethod
    def omega(t, p):
        return p[0] * math.exp(-t / p[1])

    @staticmethod
    def theta(t, p):
        return p[0] * p[1] * (1.0 - math.exp(-t / p[1]))

    @staticmethod
    def tempo_a_angolo(th, p):
        omega0, tau = p
        resto = 1.0 - th / (omega0 * tau)
        if resto <= 0.0:
            return float("nan")  # angolo oltre l'asintoto
        return -tau * math.log(resto)

    @staticmethod
    def tempo_a_omega(w, p):
        omega0, tau = p
        if w <= 0.0 or omega0 <= 0.0:
            return float("nan")
        return tau * math.log(omega0 / w)

    @staticmethod
    def indovina(tempi, velocita, istanti):
        pendenza, intercetta = np.polyfit(istanti, np.log(velocita), 1)
        tau = -1.0 / pendenza if pendenza < 0 else 60.0
        return [float(math.exp(intercetta)), float(tau)]


class Misto:
    """Attrito volvente (costante) piu' resistenza dell'aria (lineare):

        domega/dt = -(a + b*omega)
        omega(t)  = (omega0 + a/b) * exp(-b*t) - a/b

    Tre parametri. Si tiene per confronto e per sessioni lunghe (8-10 giri
    visibili). Su 3-4 giri overfitta: il fit sui dati migliora, l'estrapolazione
    peggiora, ed e' esattamente la trappola che il progetto deve evitare.
    """

    nome = "misto"
    parametri = ("omega0", "a", "b")

    @staticmethod
    def omega(t, p):
        omega0, a, b = p
        if abs(b) < 1e-9:
            return omega0 - a * t
        k = a / b
        return (omega0 + k) * math.exp(-b * t) - k

    @staticmethod
    def theta(t, p):
        omega0, a, b = p
        if abs(b) < 1e-9:
            return omega0 * t - 0.5 * a * t * t
        k = a / b
        return ((omega0 + k) / b) * (1.0 - math.exp(-b * t)) - k * t

    @staticmethod
    def tempo_a_omega(w, p):
        omega0, a, b = p
        if abs(b) < 1e-9:
            return (omega0 - w) / a if a != 0 else float("nan")
        k = a / b
        rapporto = (w + k) / (omega0 + k)
        if rapporto <= 0.0:
            return float("nan")
        return -math.log(rapporto) / b

    @staticmethod
    def tempo_a_angolo(th, p):
        """Qui l'inversa non e' analitica: bisezione fra 0 e l'istante d'arresto.

        Bisezione e non Newton: theta(t) e' monotona e limitata, e vicino
        all'asintoto Newton scappa fuori dominio. Sessanta iterazioni sono
        gratis e non hanno casi patologici.
        """
        omega0, a, b = p
        if omega0 <= 0.0:
            return float("nan")
        t_arresto = Misto.tempo_a_omega(0.0, p)
        if not math.isfinite(t_arresto) or t_arresto <= 0.0:
            t_arresto = 1e4
        if th > Misto.theta(t_arresto, p):
            return float("nan")
        basso, alto = 0.0, t_arresto
        for _ in range(80):
            mezzo = 0.5 * (basso + alto)
            if Misto.theta(mezzo, p) < th:
                basso = mezzo
            else:
                alto = mezzo
        return 0.5 * (basso + alto)

    @staticmethod
    def indovina(tempi, velocita, istanti):
        if len(velocita) >= 3:
            dw = np.gradient(velocita, istanti)
            pendenza, intercetta = np.polyfit(velocita, dw, 1)
            b, a = float(-pendenza), float(-intercetta)
            if b <= 1e-4 or a <= 0.0:
                # Il fit di domega/dt contro omega ha dato un attrito negativo:
                # capita con pochi giri e rumore. Si ripiega sul decadimento
                # lineare, che e' il caso limite b -> 0 di questo modello.
                a, b = float(-np.polyfit(istanti, velocita, 1)[0]), 1e-3
        else:
            a, b = float(-np.polyfit(istanti, velocita, 1)[0]), 1e-3
        omega0 = float(np.polyval(np.polyfit(istanti, velocita, 1), 0.0))
        return [omega0, a, b]


MODELLI = {m.nome: m for m in (Lineare, Esponenziale, Misto)}


# ---------------------------------------------------------------- minimi quadrati

def _jacobiano(funzione, p, passo_rel=1e-6):
    """Jacobiano per differenze centrali.

    Differenze centrali e non in avanti: `tempo_a_angolo` del modello misto
    passa da una bisezione, quindi ha una rugosita' numerica dell'ordine di
    1e-12, e le differenze in avanti la amplificherebbero di un fattore due.
    """
    p = np.asarray(p, dtype=float)
    base = funzione(p)
    J = np.zeros((base.size, p.size))
    for i in range(p.size):
        h = passo_rel * max(abs(p[i]), 1e-6)
        pi_p = p.copy()
        pi_m = p.copy()
        pi_p[i] += h
        pi_m[i] -= h
        J[:, i] = (funzione(pi_p) - funzione(pi_m)) / (2.0 * h)
    return J


def minimi_quadrati(residui, p0, iterazioni=200, tolleranza=1e-12):
    """Levenberg-Marquardt, versione minima.

    Ritorna (parametri, residui finali, covarianza, iterazioni usate).

    La covarianza e' sigma^2 * (J'J)^-1 con sigma^2 = RSS/(n - p): vale sotto
    le ipotesi solite (residui indipendenti, stessa varianza, modello giusto).
    La prima ipotesi qui regge - gli errori di attraversamento vengono dal
    rumore del centroide, frame per frame. La terza no, mai del tutto: per
    questo `budget.py` affianca sempre un bootstrap.
    """
    p = np.asarray(p0, dtype=float).copy()
    lam = 1e-3
    r = residui(p)
    costo = float(r @ r)
    usate = 0
    for usate in range(1, iterazioni + 1):
        J = _jacobiano(residui, p)
        if not np.all(np.isfinite(J)):
            break
        A = J.T @ J
        g = J.T @ r
        migliorato = False
        for _ in range(30):
            try:
                passo = np.linalg.solve(A + lam * np.diag(np.diag(A) + 1e-12), -g)
            except np.linalg.LinAlgError:
                lam *= 10.0
                continue
            p_nuovo = p + passo
            r_nuovo = residui(p_nuovo)
            if not np.all(np.isfinite(r_nuovo)):
                lam *= 10.0
                continue
            costo_nuovo = float(r_nuovo @ r_nuovo)
            if costo_nuovo < costo:
                guadagno = costo - costo_nuovo
                p, r, costo = p_nuovo, r_nuovo, costo_nuovo
                lam = max(lam / 10.0, 1e-12)
                migliorato = True
                if guadagno < tolleranza * max(costo, 1e-18):
                    return p, r, _covarianza(residui, p, r), usate  # convergenza
                break
            lam *= 10.0
        if not migliorato:
            break
    return p, r, _covarianza(residui, p, r), usate


def _covarianza(residui, p, r):
    J = _jacobiano(residui, p)
    n, k = J.shape
    gl = max(n - k, 1)
    sigma2 = float(r @ r) / gl
    try:
        return sigma2 * np.linalg.pinv(J.T @ J)
    except np.linalg.LinAlgError:
        return np.full((k, k), np.nan)


# ---------------------------------------------------------------- l'adattamento

class Adattamento:
    """Il risultato di un fit su una serie di attraversamenti."""

    def __init__(self, modello, p, fase, residui, covarianza, tempi, origine):
        self.modello = modello
        self.p = np.asarray(p, dtype=float)
        self.fase = float(fase)
        self.residui = np.asarray(residui, dtype=float)
        self.covarianza = np.asarray(covarianza, dtype=float)
        self.tempi = np.asarray(tempi, dtype=float)
        self.origine = float(origine)

    @property
    def n(self):
        return int(self.tempi.size)

    @property
    def gradi_liberta(self):
        return max(self.n - (self.p.size + 1), 0)

    @property
    def sigma_residuo(self):
        """Deviazione standard del residuo, in secondi.

        E' il numero che conta piu' di tutti gli altri: se qui leggi 8 ms la
        tua estrazione dal video e' buona, se leggi 60 ms hai un problema di
        misura e nessun modello lo recupera.
        """
        gl = self.gradi_liberta
        if gl <= 0:
            return float("nan")
        return float(math.sqrt(float(self.residui @ self.residui) / gl))

    def omega(self, t_assoluto):
        return self.modello.omega(t_assoluto - self.origine, self.p)

    def theta(self, t_assoluto):
        return self.modello.theta(t_assoluto - self.origine, self.p)

    def giri_al_secondo(self, t_assoluto):
        return self.omega(t_assoluto) / DUE_PI

    def decelerazione(self, t_assoluto):
        """|domega/dt| all'istante dato. E' il cambio che traduce un errore
        sulla soglia in un errore sull'istante di caduta: sigma_t = sigma_w /
        decelerazione. Vale 1,5-2 rad/s^2 vicino alla caduta su una ruota da
        casino'."""
        t = t_assoluto - self.origine
        h = 1e-4
        return abs((self.modello.omega(t + h, self.p) - self.modello.omega(t - h, self.p)) / (2 * h))

    def __repr__(self):
        nomi = self.modello.parametri
        corpo = ", ".join("%s=%.5g" % (k, v) for k, v in zip(nomi, self.p))
        return "<Adattamento %s %s, n=%d, sigma=%.1f ms>" % (
            self.modello.nome, corpo, self.n, 1000 * self.sigma_residuo)


def adatta(tempi, modello=Lineare, giri=None):
    """Fit del modello sugli istanti di attraversamento del tripwire.

    tempi   istanti (s) in cui la boccia attraversa la semiretta fissa
    modello una classe fra Lineare, Esponenziale, Misto
    giri    indici dei giri, se qualche passaggio e' stato perso. Di norma
            None, cioe' 0,1,2,...; se l'estrattore segnala un buco lo si
            dichiara qui invece di far finta che i giri siano consecutivi -
            un giro mancante non dichiarato sballa tutto il fit.
    """
    t = np.asarray(tempi, dtype=float)
    if t.ndim != 1 or t.size < 3:
        raise ValueError("adatta: servono almeno 3 attraversamenti")
    if np.any(np.diff(t) <= 0):
        raise ValueError("adatta: i tempi devono essere crescenti")
    k = np.arange(t.size, dtype=float) if giri is None else np.asarray(giri, dtype=float)
    if k.size != t.size:
        raise ValueError("adatta: `giri` e `tempi` di lunghezza diversa")

    origine = float(t[0])
    ts = t - origine
    angoli = DUE_PI * (k - k[0])

    # Stima iniziale dalle velocita' giro per giro. Serve solo a partire vicino:
    # LM da un punto stupido su un modello con l'inversa implicita diverge.
    dt = np.diff(ts)
    dk = np.diff(k)
    velocita = DUE_PI * dk / dt
    istanti = 0.5 * (ts[:-1] + ts[1:])
    p0 = list(modello.indovina(ts, velocita, istanti)) + [0.0]

    def residui(par):
        fisici, fase = par[:-1], par[-1]
        previsti = np.array([modello.tempo_a_angolo(a + fase, fisici) for a in angoli])
        # Fuori dominio il modello non ha risposta: invece di NaN (che ferma
        # LM) si mette una penalita' grande, cosi' l'ottimizzatore ci gira
        # attorno da solo.
        previsti = np.where(np.isfinite(previsti), previsti, 1e3)
        return ts - previsti

    p, r, cov, _ = minimi_quadrati(residui, p0)
    return Adattamento(modello, p[:-1], p[-1], r, cov, t, origine)


def stima_da_velocita(tempi, modello=Lineare):
    """Il fit ingenuo: omega giro per giro, poi regressione.

    Non e' qui per essere usato in produzione ma per avere un metro di
    paragone, e il paragone e' meno schiacciante di quanto la teoria faccia
    sperare: misurato, la sigma dell'errore di previsione e' identica fino a 4
    giri osservati (90 ms contro 90) e migliore di circa il 10% oltre (54 ms
    contro 59 a 6 giri, 47 contro 51 a 8).

    Il vantaggio vero del fit sui tempi e' un altro, e non si vede nel punto
    stimato: da' una covarianza e una sigma del residuo IN SECONDI, cioe'
    l'unica barra d'errore in cui si possa credere. Questo metodo
    un'incertezza non la fornisce affatto, e restituisce infatti una covarianza
    di NaN.
    """
    t = np.asarray(tempi, dtype=float)
    ts = t - t[0]
    velocita = DUE_PI / np.diff(ts)
    istanti = 0.5 * (ts[:-1] + ts[1:])
    p = modello.indovina(ts, velocita, istanti)
    residui_finti = np.zeros(t.size - 1)
    # La covarianza deve avere la dimensione dei parametri PIU' LA FASE, come
    # quella che produce `adatta`: `prevedi` deriva rispetto a tutti, fase
    # compresa. Con la dimensione sbagliata il prodotto matriciale esplode, ed
    # e' successo davvero la prima volta che i due metodi sono stati
    # confrontati - cioe' l'unica volta in cui questa funzione viene usata.
    # NaN e non zeri: questo metodo un'incertezza non la fornisce, e uno zero
    # direbbe "precisione infinita".
    cov = np.full((len(p) + 1, len(p) + 1), np.nan)
    return Adattamento(modello, p, 0.0, residui_finti, cov, t, float(t[0]))


# ---------------------------------------------------------------- la soglia di caduta

def omega_critica(inclinazione_gradi, raggio_m, gravita=GRAVITA):
    """omega_c = sqrt(g * tan(theta) / R).

    CONVENZIONE: `inclinazione_gradi` e' l'angolo della banchina rispetto
    all'ORIZZONTALE (curva sopraelevata). Parete verticale -> theta = 90 ->
    omega_c infinita, che e' corretto: una parete verticale senza attrito non
    trattiene niente. Le banchine vere stanno fra i 20 e i 40 gradi.

    E' una prima approssimazione e va detto quanto: assume la boccia puntiforme
    su una superficie conica liscia. Una boccia vera rotola (parte dell'energia
    sta nella rotazione propria), la banchina vera e' incurvata e non conica, e
    il distacco avviene su un arco, non in un punto. La formula serve a sapere
    l'ordine di grandezza e a partire; il numero da usare davvero e' quello che
    esce da `omega_critica_empirica` sugli spin registrati.
    """
    if not 0.0 < inclinazione_gradi < 90.0:
        raise ValueError("omega_critica: inclinazione fra 0 e 90 gradi esclusi")
    if raggio_m <= 0.0:
        raise ValueError("omega_critica: raggio positivo")
    return math.sqrt(gravita * math.tan(math.radians(inclinazione_gradi)) / raggio_m)


def omega_critica_empirica(adattamenti, istanti_caduta):
    """La soglia misurata invece che dedotta.

    Per ogni spin si valuta il modello adattato all'istante in cui il video
    mostra la boccia lasciare la pista. La media di quei valori e' omega_c; la
    loro deviazione standard e' il pezzo di incertezza che non dipende dal fit
    ma dalla ruota, e va sommata al resto.

    Se la deviazione standard e' grossa rispetto alla media, la soglia costante
    non esiste su quella ruota e il modello e' sbagliato in partenza: meglio
    saperlo qui che dopo trecento spin.
    """
    valori = np.array([a.omega(tc) for a, tc in zip(adattamenti, istanti_caduta)], dtype=float)
    valori = valori[np.isfinite(valori)]
    if valori.size == 0:
        return float("nan"), float("nan"), 0
    sigma = float(valori.std(ddof=1)) if valori.size > 1 else float("nan")
    return float(valori.mean()), sigma, int(valori.size)


# ---------------------------------------------------------------- la previsione

class Previsione:
    def __init__(self, t_caduta, sigma_t, angolo, sigma_angolo, giri_residui,
                 omega_c, adattamento):
        self.t_caduta = float(t_caduta)
        self.sigma_t = float(sigma_t)
        self.angolo = float(angolo)
        self.sigma_angolo = float(sigma_angolo)
        self.giri_residui = float(giri_residui)
        self.omega_c = float(omega_c)
        self.adattamento = adattamento

    def settore(self, n_settori=8):
        """In quale degli n settori fissi cade l'angolo previsto."""
        return int(math.floor((self.angolo % DUE_PI) / (DUE_PI / n_settori)))

    def larghezza_settori(self, n_settori=8, z=1.0):
        """Quanti settori copre l'intervallo +-z*sigma. Il numero onesto."""
        return 2.0 * z * self.sigma_angolo / (DUE_PI / n_settori)

    def __repr__(self):
        return ("<Previsione t=%.3fs +-%.0fms, angolo=%.1f deg +-%.1f, "
                "%.1f giri di estrapolazione>" % (
                    self.t_caduta, 1000 * self.sigma_t,
                    math.degrees(self.angolo % DUE_PI), math.degrees(self.sigma_angolo),
                    self.giri_residui))


def prevedi(adattamento, omega_c, sigma_omega_c=0.0, angolo_tripwire=0.0):
    """Da un adattamento alla previsione di dove la boccia lascia la pista.

    L'incertezza si propaga col metodo delta sui parametri (gradiente numerico
    per la covarianza del fit) piu' il termine dovuto all'incertezza su omega_c
    stessa. Quel secondo termine di solito domina: vicino alla caduta omega
    cala di poco ogni giro, quindi un errore piccolo sulla soglia si traduce in
    un errore grosso sull'istante. E' la ragione fisica per cui il settore e'
    largo, e non si aggira con piu' matematica.
    """
    mod = adattamento.modello
    p = adattamento.p
    fase = adattamento.fase

    def tempo(par):
        return mod.tempo_a_omega(omega_c, par[:-1])

    def angolo(par):
        tc = mod.tempo_a_omega(omega_c, par[:-1])
        if not math.isfinite(tc):
            return float("nan")
        return angolo_tripwire + mod.theta(tc, par[:-1]) - par[-1]

    par_pieni = np.concatenate([p, [fase]])
    t_rel = tempo(par_pieni)
    if not math.isfinite(t_rel):
        raise ValueError("prevedi: il modello non raggiunge omega_c "
                         "(soglia sopra la velocita' iniziale?)")
    ang = angolo(par_pieni)

    grad_t = _gradiente(tempo, par_pieni)
    grad_a = _gradiente(angolo, par_pieni)
    cov = adattamento.covarianza
    var_t = float(grad_t @ cov @ grad_t)
    var_a = float(grad_a @ cov @ grad_a)

    if sigma_omega_c > 0.0:
        # d(t_caduta)/d(omega_c): quanto sposta la previsione un errore sulla
        # soglia. Vale 1/|domega/dt| valutato alla caduta.
        h = max(1e-6 * abs(omega_c), 1e-9)
        t_piu = mod.tempo_a_omega(omega_c + h, p)
        t_meno = mod.tempo_a_omega(omega_c - h, p)
        dt_dw = (t_piu - t_meno) / (2 * h)
        var_t += (dt_dw * sigma_omega_c) ** 2
        # sull'angolo il fattore e' omega_c stessa: d(theta)/dt = omega
        var_a += (omega_c * dt_dw * sigma_omega_c) ** 2

    t_assoluto = adattamento.origine + t_rel
    ultimo = float(adattamento.tempi[-1])
    giri = (mod.theta(t_rel, p) - mod.theta(ultimo - adattamento.origine, p)) / DUE_PI

    return Previsione(t_assoluto, math.sqrt(max(var_t, 0.0)), ang,
                      math.sqrt(max(var_a, 0.0)), giri, omega_c, adattamento)


def _gradiente(funzione, p, passo_rel=1e-6):
    p = np.asarray(p, dtype=float)
    g = np.zeros(p.size)
    for i in range(p.size):
        h = passo_rel * max(abs(p[i]), 1e-6)
        pp, pm = p.copy(), p.copy()
        pp[i] += h
        pm[i] -= h
        g[i] = (funzione(pp) - funzione(pm)) / (2 * h)
    return g
