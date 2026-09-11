"""Il budget di precisione: quanto e' largo davvero il settore che puoi dire.

E' la parte che decide se il progetto ha senso, e l'unica il cui risultato non
si puo' migliorare scrivendo codice migliore.

IL CONTO DI PARTENZA. Vicino alla caduta la boccia fa circa 1,5 giri al
secondo. Un ottavo di ruota e' quindi

    T = 2*pi / (8 * omega_c) ~ 83 ms

Per centrare UN diamante l'errore sull'istante previsto deve stare sotto ~40 ms
(meta' settore). Per centrarne tre, sotto ~125 ms. Il fit su 3-4 rivoluzioni,
con un'estrazione buona, sta fra i 100 e i 200 ms: da cui la previsione onesta
"due o tre diamanti", che non e' modestia ma aritmetica.

TRE MODI DI STIMARE L'ERRORE, in ordine di quanto ci si puo' credere:

  metodo delta       (`modello.prevedi`) veloce, ma crede al modello
  bootstrap          (`bootstrap`) non crede alle formule, crede ancora al modello
  estrapolazione     (`validazione_estrapolazione`) non crede a niente: fitta su
                     una finestra e confronta con la caduta VERA

Il terzo e' l'unico che misura anche l'errore di specificazione - cioe' il
fatto che la boccia vera non segue esattamente nessuna delle tre curve. Su dati
veri i primi due danno sistematicamente numeri piu' piccoli del terzo. Quando
succede, ha ragione il terzo.
"""
import math

import numpy as np

from . import modello as mdl

DUE_PI = 2.0 * math.pi


def tempo_per_settore(omega_c, n_settori=8):
    """Quanto dura il passaggio della boccia davanti a un settore, in secondi."""
    return DUE_PI / (n_settori * omega_c)


def errore_in_settori(errore_s, omega_c, n_settori=8):
    """Traduce un errore temporale in frazioni di settore."""
    return errore_s / tempo_per_settore(omega_c, n_settori)


class Budget:
    def __init__(self, sigma_t, omega_c, n_settori, sigma_residuo=float("nan"),
                 giri_residui=float("nan"), fonte=""):
        self.sigma_t = float(sigma_t)
        self.omega_c = float(omega_c)
        self.n_settori = int(n_settori)
        self.sigma_residuo = float(sigma_residuo)
        self.giri_residui = float(giri_residui)
        self.fonte = fonte

    @property
    def durata_settore(self):
        return tempo_per_settore(self.omega_c, self.n_settori)

    @property
    def settori_a_1sigma(self):
        return 2.0 * self.sigma_t / self.durata_settore

    @property
    def settori_a_95(self):
        return 2.0 * 1.96 * self.sigma_t / self.durata_settore

    def verdetto(self):
        """Una riga in italiano, perche' il numero da solo si legge male."""
        larghezza = self.settori_a_1sigma
        if larghezza <= 1.0:
            giudizio = "un diamante: non ci credo finche' non lo vedo su spin held-out"
        elif larghezza <= 3.0:
            giudizio = "due o tre diamanti, cioe' il regime utile"
        elif larghezza <= 6.0:
            giudizio = "meta' ruota: serve a poco"
        else:
            giudizio = "nessuna informazione utile"
        return ("sigma = %.0f ms, settore da %.0f ms -> %.1f diamanti a 1 sigma "
                "(%.1f al 95%%): %s" % (1000 * self.sigma_t, 1000 * self.durata_settore,
                                        larghezza, self.settori_a_95, giudizio))

    def __repr__(self):
        return "<Budget %s | %s>" % (self.fonte, self.verdetto())


def budget_da_previsione(previsione, n_settori=8):
    return Budget(previsione.sigma_t, previsione.omega_c, n_settori,
                  previsione.adattamento.sigma_residuo, previsione.giri_residui,
                  fonte="metodo delta")


# ---------------------------------------------------------------- bootstrap

def budget_analitico(omega_c, decelerazione, sigma_omega_c, sigma_fit=0.0, n_settori=8):
    """Il budget in forma chiusa, senza simulare niente.

        sigma_t = sqrt( (sigma_omega_c / |domega/dt|)^2 + sigma_fit^2 )

    I due termini sono indipendenti e si sommano in quadratura:

      sigma_omega_c / |domega/dt|   la soglia non e' la stessa a ogni spin.
                                    Non sta nei dati dello spin in corso,
                                    quindi nessun fit la riduce: e' un
                                    pavimento.
      sigma_fit                     l'errore di estrapolazione della curva,
                                    quello che migliora misurando meglio e
                                    osservando piu' giri.

    La cosa da vedere e' che sono di ordini diversi. Con una banchina normale
    (decelerazione ~1,7 rad/s^2) una variazione dell'1% su omega_c vale gia'
    55 ms, cioe' piu' di mezzo diamante; una buona estrazione sub-frame vale
    20-30 ms. Si passa il tempo a limare il termine sbagliato molto facilmente.
    """
    if decelerazione <= 0:
        raise ValueError("budget_analitico: decelerazione positiva")
    sigma_t = math.hypot(sigma_omega_c / decelerazione, sigma_fit)
    return Budget(sigma_t, omega_c, n_settori, fonte="analitico")


def sigma_omega_c_richiesta(diamanti, omega_c, decelerazione, n_settori=8):
    """Quanto deve ripetersi la soglia per poter dire `diamanti` diamanti.

    Il verso in cui si usa: hai deciso che vuoi sbagliare al massimo un
    diamante, e questa funzione ti dice quanto stabile deve essere la ruota.
    Di solito la risposta e' piu' severa di quanto ci si aspetti, e allora la
    domanda giusta non e' piu' "che modello uso" ma "questa ruota ce la fa?".
    """
    sigma_t = (diamanti / 2.0) * tempo_per_settore(omega_c, n_settori)
    return sigma_t * decelerazione


def diagnosi_soglia(spin_list, n_giri=3, modello=mdl.Lineare, anticipo=0, n_settori=8):
    """LA PROVA DA FARE PER SECONDA, subito dopo quella di uniformita'.

    Serve solo: gli ultimi tre attraversamenti di ogni spin e l'istante in cui
    la boccia lascia la pista. Niente calibrazione fine, niente estrapolazione
    lunga, niente modello globale.

    Misura quanto si ripete omega_c da spin a spin, e traduce la dispersione
    nel numero di diamanti che quella ruota consente PRIMA e a prescindere da
    come scriverai il resto. Se la ripetibilita' e' del 3%, il tuo settore e'
    largo tre-quattro diamanti qualunque cosa tu faccia dopo, e il tempo
    speso a perfezionare il tracking e' tempo buttato.

    Attenzione a non misurarla sull'ultimo attraversamento invece che sulla
    caduta: fra i due c'e' una frazione di giro casuale, durante la quale
    omega cala di un rad/s abbondante, e quella variabilita' finta e' piu'
    grande di quella vera.

    COSA MISURA ESATTAMENTE. La dispersione che esce contiene due cose: la
    variabilita' vera della soglia e l'errore di estrapolazione della finestra
    corta usata per stimarla. Quindi `sigma_omega_c` qui e' un LIMITE
    SUPERIORE della dispersione vera della ruota - mentre `sigma_t_atteso` e'
    gia' il numero realistico, perche' quell'errore di fit ci sara' anche in
    previsione. Per separare i due termini si guarda come cambia il risultato
    allungando la finestra: se allungandola la dispersione non cala, e' ruota;
    se cala, era fit.
    """
    valori, decelerazioni = [], []
    for s in spin_list:
        t = _finestra(s, n_giri, anticipo)
        if t.size < 3:
            continue
        try:
            a = mdl.adatta(t, modello)
        except (ValueError, np.linalg.LinAlgError):
            continue
        w = a.omega(s.t_caduta)
        if math.isfinite(w) and w > 0:
            valori.append(w)
            decelerazioni.append(a.decelerazione(s.t_caduta))
    if len(valori) < 2:
        raise RuntimeError("diagnosi_soglia: servono almeno due spin utilizzabili")
    v = np.array(valori)
    dec = float(np.median(decelerazioni))
    media, sigma = float(v.mean()), float(v.std(ddof=1))
    b = budget_analitico(media, dec, sigma, 0.0, n_settori)
    return {
        "n": int(v.size),
        "omega_c": media,
        "sigma_omega_c": sigma,
        "cv": sigma / media,
        "decelerazione": dec,
        "sigma_t_atteso": sigma / dec,
        "diamanti_attesi": b.settori_a_1sigma,
        "budget": b,
    }


def bootstrap(tempi, omega_c, modello=mdl.Lineare, n=400, sigma=None,
              sigma_omega_c=0.0, metodo="parametrico", seme=0, angolo_tripwire=0.0):
    """Rigenera il fit tante volte e guarda quanto balla la previsione.

    metodo="parametrico" rimette rumore gaussiano sui tempi, con sigma presa
    dal residuo del fit (o imposta a mano). E' il default perche' con 4-6
    attraversamenti il ricampionamento dei residui ha troppo poco da
    ricampionare: quattro numeri non fanno una distribuzione.

    metodo="residui" ricampiona i residui osservati. Piu' onesto quando gli
    attraversamenti sono tanti (8-10) e il rumore non e' gaussiano.

    Ritorna un dizionario con la mediana e le sigma di istante e angolo, piu'
    le due code al 5 e al 95 per cento.
    """
    rng = np.random.default_rng(seme)
    t = np.asarray(tempi, dtype=float)
    base = mdl.adatta(t, modello)
    if sigma is None:
        sigma = base.sigma_residuo
    if not math.isfinite(sigma) or sigma <= 0:
        sigma = 1e-3

    istanti, angoli = [], []
    for _ in range(n):
        if metodo == "residui" and base.residui.size >= 4:
            perturbato = t + rng.choice(base.residui, size=t.size, replace=True)
        else:
            perturbato = t + rng.normal(0.0, sigma, size=t.size)
        perturbato.sort()
        if np.any(np.diff(perturbato) <= 0):
            continue
        wc = omega_c + (rng.normal(0.0, sigma_omega_c) if sigma_omega_c > 0 else 0.0)
        try:
            a = mdl.adatta(perturbato, modello)
            pr = mdl.prevedi(a, wc, angolo_tripwire=angolo_tripwire)
        except (ValueError, RuntimeError, np.linalg.LinAlgError):
            continue
        if math.isfinite(pr.t_caduta):
            istanti.append(pr.t_caduta)
            angoli.append(pr.angolo)

    istanti = np.array(istanti)
    angoli = np.array(angoli)
    if istanti.size < 10:
        raise RuntimeError("bootstrap: troppi fit falliti, il modello non regge "
                           "il rumore che gli hai messo")
    # L'angolo si media in modo circolare: 359 e 1 grado distano 2 gradi, non 358.
    vettori = np.exp(1j * angoli)
    media_ang = float(np.angle(vettori.mean()))
    dispersione = float(abs(vettori.mean()))
    sigma_ang = float(math.sqrt(-2.0 * math.log(dispersione))) if dispersione > 0 else float("inf")
    return {
        "n_riusciti": int(istanti.size),
        "t_mediano": float(np.median(istanti)),
        "sigma_t": float(istanti.std(ddof=1)),
        "t_5": float(np.percentile(istanti, 5)),
        "t_95": float(np.percentile(istanti, 95)),
        "angolo_medio": media_ang % DUE_PI,
        "sigma_angolo": sigma_ang,
        "budget": Budget(float(istanti.std(ddof=1)), omega_c, 8, fonte="bootstrap"),
    }


# ---------------------------------------------------------------- la prova vera

def _finestra(spin, n_giri, anticipo):
    if hasattr(spin, "finestra"):
        return spin.finestra(n_giri, anticipo)
    t = np.asarray(spin.tempi, dtype=float)
    fine = t.size - anticipo
    return t[max(0, fine - n_giri):fine]


def calibra_omega_c(spin_list, n_giri=4, modello=mdl.Lineare, anticipo=0):
    """La soglia di caduta misurata su un insieme di spin.

    Per ogni spin si fitta la stessa finestra che si userebbe in previsione e
    si valuta il modello all'istante di caduta osservato. Fitta la finestra e
    non tutto lo spin apposta: se la calibrazione usasse piu' informazione di
    quanta ne avra' la previsione, omega_c uscirebbe leggermente diversa e il
    settore dichiarato sarebbe troppo stretto.

    Ritorna (omega_c, sigma_omega_c, n_spin_usati).
    """
    adattamenti, cadute = [], []
    for s in spin_list:
        t = _finestra(s, n_giri, anticipo)
        if t.size < 3:
            continue
        try:
            adattamenti.append(mdl.adatta(t, modello))
            cadute.append(s.t_caduta)
        except (ValueError, np.linalg.LinAlgError):
            continue
    return mdl.omega_critica_empirica(adattamenti, cadute)


def validazione_estrapolazione(spin_list, n_giri=4, modello=mdl.Lineare,
                               omega_c=None, sigma_omega_c=0.0, anticipo=0,
                               n_settori=8, calibra_su=None):
    """Fitta su una finestra, prevede, confronta con la caduta vera.

    E' la sola misura che non si autoconferma: la finestra usata per il fit non
    contiene mai l'istante che si vuole indovinare.

    spin_list    oggetti con .tempi, .t_caduta, .angolo_caduta (gli Spin di
                 `sintetico`, o qualunque cosa esponga quei tre attributi -
                 le registrazioni lette da `dati.py` lo fanno)
    n_giri       quanti attraversamenti si danno in pasto al fit
    anticipo     quanti attraversamenti scartare in coda, cioe' quanto prima
                 della caduta si e' costretti a scommettere
    omega_c      la soglia. Se None si guarda `calibra_su`; se anche quello e'
                 None si calibra sugli spin stessi, e il risultato esce
                 marchiato come ottimista - perche' lo e'.
    calibra_su   un secondo elenco di spin, usati SOLO per calibrare omega_c.
                 E' il modo giusto.

    BIAS E SIGMA NON SONO LA STESSA COSA. Il bias - previsione sistematicamente
    in anticipo o in ritardo - viene quasi tutto dall'errore di specificazione
    del modello, ed e' assorbito dalla calibrazione di omega_c: e' un errore
    che si paga una volta e poi sparisce. La sigma no: quella e' larghezza del
    settore, spin per spin, e non la toglie nessuna calibrazione. Per questo
    sono riportate separate, e il verdetto guarda la sigma.
    """
    errori_t, errori_ang, larghezze, usati = [], [], [], 0
    calibrata_qui = False

    if omega_c is None:
        sorgente = calibra_su if calibra_su is not None else spin_list
        calibrata_qui = calibra_su is None
        omega_c, sigma_stima, n_cal = calibra_omega_c(sorgente, n_giri, modello, anticipo)
        if not math.isfinite(omega_c):
            raise RuntimeError("validazione_estrapolazione: calibrazione di omega_c fallita")
        if sigma_omega_c == 0.0 and math.isfinite(sigma_stima):
            sigma_omega_c = sigma_stima

    for s in spin_list:
        t = _finestra(s, n_giri, anticipo)
        if t.size < 3:
            continue
        try:
            a = mdl.adatta(t, modello)
            pr = mdl.prevedi(a, omega_c, sigma_omega_c=sigma_omega_c,
                             angolo_tripwire=getattr(s, "angolo_tripwire", 0.0))
        except (ValueError, RuntimeError, np.linalg.LinAlgError):
            continue
        if not math.isfinite(pr.t_caduta):
            continue
        errori_t.append(pr.t_caduta - s.t_caduta)
        errori_ang.append((pr.angolo - s.angolo_caduta + math.pi) % DUE_PI - math.pi)
        larghezze.append(pr.larghezza_settori(n_settori))
        usati += 1

    if usati == 0:
        raise RuntimeError("validazione_estrapolazione: nessuno spin utilizzabile")

    et = np.array(errori_t)
    ea = np.array(errori_ang)
    sigma = float(et.std(ddof=1)) if et.size > 1 else float("nan")
    return {
        "n": usati,
        "n_giri": n_giri,
        "anticipo": anticipo,
        "modello": modello.nome,
        "omega_c": float(omega_c),
        "sigma_omega_c": float(sigma_omega_c),
        "omega_c_calibrata_sugli_stessi_spin": calibrata_qui,
        "bias_t": float(et.mean()),
        "sigma_t": sigma,
        "rms_t": float(np.sqrt(np.mean(et ** 2))),
        "mad_t": float(np.median(np.abs(et - np.median(et)))),
        "p90_t": float(np.percentile(np.abs(et), 90)),
        "sigma_angolo": float(ea.std(ddof=1)) if ea.size > 1 else float("nan"),
        "diamanti_errore_tipico": float(np.median(np.abs(ea)) / (DUE_PI / n_settori)),
        "larghezza_dichiarata": float(np.median(larghezze)) if larghezze else float("nan"),
        "budget": Budget(sigma, float(omega_c), n_settori,
                         giri_residui=float("nan"),
                         fonte="estrapolazione held-out"),
    }


def validazione_incrociata(spin_list, n_giri=4, modello=mdl.Lineare,
                           frazione_calibrazione=0.5, seme=0, anticipo=0, n_settori=8):
    """Il protocollo onesto, in una chiamata.

    Divide gli spin in due meta' a caso, calibra omega_c sulla prima e misura
    l'errore sulla seconda. Gli spin di prova non toccano la calibrazione in
    nessun punto.

    Perche' importa tanto: omega_c ha un solo grado di liberta', ma e' quello
    che sposta l'intera previsione avanti o indietro. Calibrarla sugli stessi
    spin su cui poi si misura l'errore fa sparire tutto il bias per
    costruzione, e il numero che esce e' piu' bello di quello vero. Con pochi
    parametri liberi si fitta bene qualunque cosa a posteriori: e' il motivo
    per cui questa funzione esiste al posto di un flag.
    """
    rng = np.random.default_rng(seme)
    indici = rng.permutation(len(spin_list))
    taglio = max(1, int(len(spin_list) * frazione_calibrazione))
    calibrazione = [spin_list[i] for i in indici[:taglio]]
    prova = [spin_list[i] for i in indici[taglio:]]
    if not prova:
        raise RuntimeError("validazione_incrociata: nessuno spin rimasto per la prova")
    esito = validazione_estrapolazione(prova, n_giri=n_giri, modello=modello,
                                       omega_c=None, anticipo=anticipo,
                                       n_settori=n_settori, calibra_su=calibrazione)
    esito["n_calibrazione"] = len(calibrazione)
    return esito


def tabella_precisione(spin_list, giri=(3, 4, 5, 6, 8),
                       modelli=(mdl.Lineare, mdl.Esponenziale, mdl.Misto),
                       omega_c=None, anticipo=0, seme=0):
    """Quanto migliora la previsione osservando piu' giri, per ogni modello.

    Il risultato tipico - e vale la pena guardarlo prima di scrivere altro
    codice - e' che la curva si appiattisce presto e che il modello a tre
    parametri sta sotto solo quando i giri sono tanti.
    """
    righe = []
    for M in modelli:
        for g in giri:
            try:
                if omega_c is None:
                    r = validazione_incrociata(spin_list, n_giri=g, modello=M,
                                               anticipo=anticipo, seme=seme)
                else:
                    r = validazione_estrapolazione(spin_list, n_giri=g, modello=M,
                                                   omega_c=omega_c, anticipo=anticipo)
            except RuntimeError:
                continue
            righe.append({
                "modello": M.nome, "giri": g, "n": r["n"],
                "sigma_t_ms": 1000 * r["sigma_t"],
                "bias_ms": 1000 * r["bias_t"],
                "rms_ms": 1000 * r["rms_t"],
                "diamanti": r["budget"].settori_a_1sigma,
            })
    return righe


def stampa_tabella(righe):
    print("modello        giri    n   bias(ms)  sigma(ms)   rms(ms)  diamanti(1sigma)")
    print("-" * 76)
    for r in righe:
        print("%-13s %4d %4d %9.1f %10.1f %9.1f %12.1f" % (
            r["modello"], r["giri"], r["n"], r["bias_ms"], r["sigma_t_ms"],
            r["rms_ms"], r["diamanti"]))
