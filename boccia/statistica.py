"""Le prove statistiche che servono qui, scritte a mano.

Perche' a mano: tutto il resto di questo sottoprogetto gira con numpy e basta,
e per tre funzioni (la coda del chi-quadro, il chi-quadro non centrale per la
potenza, l'intervallo di Wilson) tirare dentro scipy significherebbe una
dipendenza da centinaia di megabyte su un portatile che deve solo macinare
qualche centinaio di numeri.

Le formule sono quelle classiche: serie e frazione continua per la funzione
gamma incompleta (Numerical Recipes, cap. 6), miscela di Poisson per il
chi-quadro non centrale, Wilson invece di Wald per gli intervalli su una
proporzione - perche' con 30 spin e una proporzione vicina a 1/8 l'intervallo
di Wald esce storto e a volte sfora sotto zero.
"""
import math

_EPS = 3.0e-12
_ITER_MAX = 400


# ---------------------------------------------------------------- gamma incompleta

def _serie_gamma_p(a, x):
    """P(a,x) sviluppata in serie. Converge in fretta per x < a+1."""
    if x <= 0.0:
        return 0.0
    ap = a
    somma = 1.0 / a
    termine = somma
    for _ in range(_ITER_MAX):
        ap += 1.0
        termine *= x / ap
        somma += termine
        if abs(termine) < abs(somma) * _EPS:
            break
    return somma * math.exp(-x + a * math.log(x) - math.lgamma(a))


def _frazione_gamma_q(a, x):
    """Q(a,x) = 1 - P(a,x) in frazione continua. Buona per x >= a+1.

    E' la forma modificata di Lentz: si porta dietro b, c, d invece di
    valutare la frazione dal fondo, cosi' non serve sapere in anticipo quanti
    livelli servono.
    """
    minuscolo = 1.0e-300
    b = x + 1.0 - a
    c = 1.0 / minuscolo
    d = 1.0 / b
    h = d
    for i in range(1, _ITER_MAX):
        an = -i * (i - a)
        b += 2.0
        d = an * d + b
        if abs(d) < minuscolo:
            d = minuscolo
        c = b + an / c
        if abs(c) < minuscolo:
            c = minuscolo
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < _EPS:
            break
    return h * math.exp(-x + a * math.log(x) - math.lgamma(a))


def gamma_p(a, x):
    """Gamma incompleta inferiore regolarizzata P(a, x)."""
    if x < 0.0 or a <= 0.0:
        raise ValueError("gamma_p: servono a > 0 e x >= 0")
    if x == 0.0:
        return 0.0
    if x < a + 1.0:
        return _serie_gamma_p(a, x)
    return 1.0 - _frazione_gamma_q(a, x)


def gamma_q(a, x):
    """Gamma incompleta superiore regolarizzata Q(a, x) = 1 - P(a, x)."""
    if x < 0.0 or a <= 0.0:
        raise ValueError("gamma_q: servono a > 0 e x >= 0")
    if x == 0.0:
        return 1.0
    if x < a + 1.0:
        return 1.0 - _serie_gamma_p(a, x)
    return _frazione_gamma_q(a, x)


# ---------------------------------------------------------------- chi quadro

def chi2_cdf(x, gl):
    """P(X <= x) per un chi-quadro con `gl` gradi di liberta'."""
    if x <= 0.0:
        return 0.0
    return gamma_p(gl / 2.0, x / 2.0)


def chi2_sf(x, gl):
    """La coda destra: P(X > x). E' il valore p di una prova chi-quadro.

    Si calcola direttamente come Q e non come 1 - CDF: per code piccole la
    sottrazione perderebbe tutte le cifre che contano, e sono proprio quelle
    il motivo per cui si guarda il valore p.
    """
    if x <= 0.0:
        return 1.0
    return gamma_q(gl / 2.0, x / 2.0)


def chi2_ppf(p, gl):
    """Il quantile: il valore critico x tale che P(X <= x) = p.

    Bisezione su un intervallo allargato finche' serve. Lento e stupido, ma
    qui lo si chiama una volta per calcolo di potenza, non in un ciclo.
    """
    if not 0.0 < p < 1.0:
        raise ValueError("chi2_ppf: p deve stare fra 0 e 1")
    basso, alto = 0.0, max(gl * 2.0, 10.0)
    while chi2_cdf(alto, gl) < p:
        alto *= 2.0
        if alto > 1e9:
            return alto
    for _ in range(200):
        mezzo = 0.5 * (basso + alto)
        if chi2_cdf(mezzo, gl) < p:
            basso = mezzo
        else:
            alto = mezzo
    return 0.5 * (basso + alto)


def chi2_nc_cdf(x, gl, lam):
    """Chi-quadro NON centrale, come miscela di Poisson di chi-quadri centrali.

        F(x; k, lam) = somma_j  Pois(j; lam/2) * P(k/2 + j, x/2)

    Serve per la potenza: sotto l'alternativa "la ruota e' storta cosi'", la
    statistica non e' piu' un chi-quadro centrale, e usare quello centrale
    darebbe risposte ottimistiche su quanti spin bastano.

    I pesi si calcolano in logaritmo: con lam = 100 (ruota molto storta e
    tanti spin) il termine (lam/2)^j esplode molto prima che la serie converga.
    """
    if x <= 0.0:
        return 0.0
    if lam < 0.0:
        raise ValueError("chi2_nc_cdf: lam >= 0")
    if lam == 0.0:
        return chi2_cdf(x, gl)
    mezzo_lam = lam / 2.0
    # Si parte dalla moda della Poisson e si cammina nelle due direzioni:
    # cominciare da j = 0 con lam grande vuol dire sommare per migliaia di
    # termini trascurabili prima di arrivare dove sta la massa.
    moda = int(mezzo_lam)
    totale = 0.0
    for direzione in (0, 1):
        j = moda if direzione == 0 else moda + 1
        while j >= 0 and j < moda + 20000:
            log_peso = -mezzo_lam + j * math.log(mezzo_lam) - math.lgamma(j + 1.0)
            peso = math.exp(log_peso)
            if peso < 1e-16 and abs(j - moda) > 3:
                break
            totale += peso * gamma_p(gl / 2.0 + j, x / 2.0)
            j += 1 if direzione else -1
            if direzione == 0 and j < 0:
                break
    return min(1.0, totale)


def prova_chi2_bonta(osservati, attesi):
    """Chi-quadro di bonta' d'adattamento.

    Ritorna (statistica, gradi di liberta', valore p, w di Cohen).

    Il w di Cohen - radice di chi2/N - e' li' perche' il valore p da solo non
    dice quanto e' storta la ruota, dice solo quanto sei sicuro che lo sia. Con
    5000 spin anche una sbilanciatura inutilizzabile esce con p < 0.001.
    """
    import numpy as np

    o = np.asarray(osservati, dtype=float)
    a = np.asarray(attesi, dtype=float)
    if o.shape != a.shape:
        raise ValueError("prova_chi2_bonta: osservati e attesi di forma diversa")
    if np.any(a <= 0):
        raise ValueError("prova_chi2_bonta: attesi tutti > 0")
    stat = float(np.sum((o - a) ** 2 / a))
    gl = int(o.size - 1)
    n = float(o.sum())
    return stat, gl, chi2_sf(stat, gl), math.sqrt(stat / n) if n > 0 else 0.0


# ---------------------------------------------------------------- normale e binomiale

def normale_sf(z):
    """Coda destra della normale standard."""
    return 0.5 * math.erfc(z / math.sqrt(2.0))


def normale_ppf(p):
    """Quantile della normale standard, per bisezione su erfc."""
    if not 0.0 < p < 1.0:
        raise ValueError("normale_ppf: p fra 0 e 1")
    basso, alto = -40.0, 40.0
    for _ in range(200):
        mezzo = 0.5 * (basso + alto)
        if 1.0 - normale_sf(mezzo) < p:
            basso = mezzo
        else:
            alto = mezzo
    return 0.5 * (basso + alto)


def binomiale_sf(k, n, p):
    """P(X >= k) esatta per una binomiale. Somma diretta in logaritmi.

    Esatta e non normale approssimata: qui n e' spesso 30-50 spin di prova e
    p e' 1/8, cioe' proprio il regime dove l'approssimazione normale sbaglia
    nella direzione che fa comodo a chi spera.
    """
    if k <= 0:
        return 1.0
    if k > n:
        return 0.0
    totale = 0.0
    for i in range(int(k), int(n) + 1):
        log_c = math.lgamma(n + 1) - math.lgamma(i + 1) - math.lgamma(n - i + 1)
        if p <= 0.0:
            continue
        if p >= 1.0:
            totale += 1.0 if i == n else 0.0
            continue
        totale += math.exp(log_c + i * math.log(p) + (n - i) * math.log1p(-p))
    return min(1.0, totale)


def intervallo_wilson(successi, prove, z=1.96):
    """Intervallo di Wilson per una proporzione.

    Con successi = 0 Wald darebbe [0, 0] - cioe' "certezza assoluta da zero
    osservazioni". Wilson no, ed e' tutta la ragione per cui sta qui.
    """
    if prove <= 0:
        return (0.0, 1.0)
    n = float(prove)
    p = successi / n
    denom = 1.0 + z * z / n
    centro = (p + z * z / (2 * n)) / denom
    meta = (z / denom) * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (max(0.0, centro - meta), min(1.0, centro + meta))
