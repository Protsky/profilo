"""La prova di uniformita' sui diamanti, e la validazione su spin non visti.

QUESTA E' LA PRIMA COSA DA FARE, prima di scrivere una riga di modello fisico.
Costa un pomeriggio di video e un chi-quadro, e risponde alla sola domanda che
conta all'inizio: su QUESTA ruota c'e' qualcosa da prevedere?

Due esiti, opposti:

  istogramma piatto     la ruota e' in bolla. Non c'e' nessuna asimmetria
                        meccanica da sfruttare, e il modello fisico non
                        salva niente: prevedere l'istante di caduta con
                        sigma di 150 ms su un settore da 83 ms da' un
                        settore largo mezza ruota, che e' come dire niente.

  un diamante dominante hai trovato un difetto meccanico - tipicamente la
                        ruota fuori bolla, e il diamante sul lato basso. Da
                        li' in poi e' quel difetto a fare il lavoro
                        predittivo, non le equazioni. Il modello fisico serve
                        semmai a dire QUANDO il difetto e' in fase.

LA TRAPPOLA E' IL NUMERO DI SPIN. Con 50 spin su 8 caselle l'istogramma sembra
sempre storto: la deviazione standard di ogni casella e' gia' il 33% del suo
valore atteso. `spin_necessari` dice quanti ne servono per distinguere una
storta vera da una immaginaria, e la risposta e' qualche centinaio.

E LA TRAPPOLA PEGGIORE E' GUARDARE PRIMA E DECIDERE DOPO. Se scegli il
diamante dominante guardando l'istogramma e poi misuri quanto spesso ci
azzecchi sullo stesso istogramma, ti stai misurando addosso. Tutto quello che
c'e' qui sotto separa i due insiemi, e `validazione_holdout` non ti lascia
nemmeno l'opzione di confonderli.
"""
import math

import numpy as np

from . import statistica as st

N_DIAMANTI = 8


def istogramma(diamanti, n_caselle=N_DIAMANTI):
    """Conteggi per casella. `diamanti` sono interi 0..n-1."""
    d = np.asarray(diamanti, dtype=int)
    if d.size and (d.min() < 0 or d.max() >= n_caselle):
        raise ValueError("istogramma: indice di diamante fuori intervallo")
    return np.bincount(d, minlength=n_caselle)[:n_caselle]


def prova_uniformita(diamanti, n_caselle=N_DIAMANTI):
    """Chi-quadro contro l'uniforme.

    Ritorna un dizionario con statistica, gradi di liberta', valore p, il w di
    Cohen (la dimensione dell'effetto) e un avviso se le celle sono troppo
    poco popolate perche' l'approssimazione chi-quadro valga.
    """
    conteggi = istogramma(diamanti, n_caselle)
    n = int(conteggi.sum())
    if n == 0:
        raise ValueError("prova_uniformita: nessuno spin")
    attesi = np.full(n_caselle, n / n_caselle, dtype=float)
    stat, gl, p, w = st.prova_chi2_bonta(conteggi, attesi)
    return {
        "n": n,
        "conteggi": conteggi.tolist(),
        "attesi": float(n / n_caselle),
        "chi2": stat,
        "gl": gl,
        "p": p,
        "w_cohen": w,
        "attesi_sufficienti": bool(n / n_caselle >= 5),
        "avviso": None if n / n_caselle >= 5 else
                  "meno di 5 spin attesi per casella: il valore p del chi-quadro "
                  "non e' affidabile, servono piu' spin",
    }


def diamante_dominante(diamanti, n_caselle=N_DIAMANTI, alfa=0.05):
    """Quale casella e' sopra la sua quota, con la correzione per il fatto che
    le caselle sono otto.

    Si fa un test binomiale a una coda per ogni casella e si corregge con Holm.
    Senza correzione, su otto caselle e ruota perfetta, la probabilita' di
    trovarne almeno una "significativa" al 5% e' circa il 34%: si troverebbe
    un diamante dominante una volta su tre su ruote perfettamente in bolla.
    """
    conteggi = istogramma(diamanti, n_caselle)
    n = int(conteggi.sum())
    p0 = 1.0 / n_caselle
    grezzi = [(i, int(c), st.binomiale_sf(int(c), n, p0)) for i, c in enumerate(conteggi)]
    ordinati = sorted(grezzi, key=lambda x: x[2])
    esiti, massimo = [], 0.0
    for rango, (i, c, p) in enumerate(ordinati):
        corretto = min(1.0, p * (n_caselle - rango))
        massimo = max(massimo, corretto)  # Holm e' monotono per costruzione
        esiti.append({
            "diamante": i,
            "conteggio": c,
            "quota": c / n if n else 0.0,
            "p_grezzo": p,
            "p_holm": massimo,
            "significativo": bool(massimo < alfa),
            "ic95": st.intervallo_wilson(c, n),
        })
    esiti.sort(key=lambda e: -e["conteggio"])
    return esiti


def spin_necessari(w, potenza=0.80, alfa=0.05, n_caselle=N_DIAMANTI, massimo=20000):
    """Quanti spin servono per vedere una storta di dimensione `w` (w di Cohen).

    Sotto l'alternativa la statistica e' un chi-quadro non centrale con
    lambda = N*w^2: si cerca il primo N che porta la potenza alla soglia.

    Ordini di grandezza utili, su 8 caselle e potenza 0,80:

        w = 0,10  (storta tenue)      ~ 1300 spin
        w = 0,15                      ~  600 spin
        w = 0,20  (visibile a occhio) ~  340 spin
        w = 0,30  (sfacciata)         ~  150 spin

    Cioe': i "200-300 spin" della regola pratica bastano per una storta
    marcata, e non bastano per una tenue. Ed e' proprio quella tenue il caso
    interessante, perche' e' quella che nessuno ha ancora notato.
    """
    critico = st.chi2_ppf(1.0 - alfa, n_caselle - 1)
    basso, alto = 5, massimo
    if 1.0 - st.chi2_nc_cdf(critico, n_caselle - 1, massimo * w * w) < potenza:
        return None  # nemmeno con `massimo` spin
    while basso < alto:
        mezzo = (basso + alto) // 2
        pot = 1.0 - st.chi2_nc_cdf(critico, n_caselle - 1, mezzo * w * w)
        if pot < potenza:
            basso = mezzo + 1
        else:
            alto = mezzo
    return int(basso)


def potenza_raggiunta(n, w, alfa=0.05, n_caselle=N_DIAMANTI):
    """La potenza che hai davvero con gli spin che hai gia'.

    Da chiamare DOPO un chi-quadro non significativo, e non e' un dettaglio:
    "p = 0,34" con potenza 0,25 non vuol dire "la ruota e' in bolla", vuol
    dire "non ho guardato abbastanza". Sono due conclusioni diverse e vengono
    confuse di continuo.
    """
    critico = st.chi2_ppf(1.0 - alfa, n_caselle - 1)
    return 1.0 - st.chi2_nc_cdf(critico, n_caselle - 1, n * w * w)


# ---------------------------------------------------------------- validazione

def validazione_holdout(diamanti, frazione_addestramento=0.5, seme=0,
                        n_caselle=N_DIAMANTI, ampiezza_settore=1):
    """Scegli il settore su una meta' degli spin, misuralo sull'altra.

    ampiezza_settore  quante caselle contigue si scommettono (1 = un solo
                      diamante, 3 = il diamante e i due vicini)

    Ritorna il tasso di successo sugli spin NON visti, con intervallo di
    Wilson, e il confronto col caso (ampiezza/n_caselle). Se l'intervallo
    contiene il caso, non hai dimostrato niente - per quanto bello fosse
    l'istogramma di addestramento.
    """
    d = np.asarray(diamanti, dtype=int)
    if d.size < 20:
        raise ValueError("validazione_holdout: con meno di 20 spin non ha senso")
    rng = np.random.default_rng(seme)
    ordine = rng.permutation(d.size)
    taglio = max(1, int(d.size * frazione_addestramento))
    addestramento, prova = d[ordine[:taglio]], d[ordine[taglio:]]
    if prova.size == 0:
        raise ValueError("validazione_holdout: nessuno spin per la prova")

    conteggi = istogramma(addestramento, n_caselle)
    # Il settore migliore in addestramento: finestra scorrevole circolare.
    somme = [int(sum(conteggi[(inizio + j) % n_caselle] for j in range(ampiezza_settore)))
             for inizio in range(n_caselle)]
    inizio_scelto = int(np.argmax(somme))
    scelte = {(inizio_scelto + j) % n_caselle for j in range(ampiezza_settore)}

    successi = int(sum(1 for x in prova if int(x) in scelte))
    tasso = successi / prova.size
    caso = ampiezza_settore / n_caselle
    ic = st.intervallo_wilson(successi, prova.size)
    p_valore = st.binomiale_sf(successi, prova.size, caso)
    return {
        "settore": sorted(scelte),
        "n_addestramento": int(addestramento.size),
        "n_prova": int(prova.size),
        "successi": successi,
        "tasso": tasso,
        "ic95": ic,
        "caso": caso,
        "p": p_valore,
        "batte_il_caso": bool(ic[0] > caso),
        "tasso_addestramento": max(somme) / addestramento.size,
    }


def vantaggio(tasso, numeri_coperti, numeri_totali=37, pagamento=36):
    """Il margine per unita' puntata, dato un tasso di successo SUI NUMERI.

    ATTENZIONE A COSA SI PASSA. `tasso` deve essere la probabilita' di
    azzeccare uno dei numeri coperti, non quella di azzeccare il diamante:
    fra le due ci sono la fase del rotore e il rimbalzo, e sono grandi. Chi
    infila qui il tasso sui diamanti si legge un margine tre o quattro volte
    piu' grande di quello vero. La conversione sta in `numeri.catena`.

    Si punta su `numeri_coperti` numeri, si spende quello, e se esce uno di
    quelli si incassa `pagamento` (35 di vincita piu' la puntata). Quindi

        margine = pagamento * tasso / numeri_coperti - 1

    Il pareggio e' a tasso = numeri_coperti / pagamento: con 5 numeri coperti
    serve azzeccarne il 13,9%, contro il 13,5% del caso. Il margine da battere
    e' sottile, ed e' il motivo per cui il numero di spin necessari a
    DIMOSTRARE un vantaggio e' nell'ordine delle migliaia, non delle centinaia:
    la varianza di una scommessa a 35:1 e' enorme rispetto al segnale.
    """
    if numeri_coperti <= 0:
        raise ValueError("vantaggio: numeri_coperti positivo")
    return pagamento * tasso / numeri_coperti - 1.0


def spin_per_dimostrare_vantaggio(margine, numeri_coperti, pagamento=36, z=1.96):
    """Quanti spin per distinguere quel margine dallo zero.

    Il ritorno per spin ha media `margine` e una deviazione standard che, per
    una puntata su pochi numeri, e' dell'ordine di sqrt(pagamento/coperti).
    Servono N tali che margine*sqrt(N) > z*sigma.
    """
    if margine <= 0:
        return None
    tasso = (margine + 1.0) * numeri_coperti / pagamento
    vincita = pagamento / numeri_coperti - 1.0
    var = tasso * vincita ** 2 + (1 - tasso) * 1.0 - margine ** 2
    return int(math.ceil((z * math.sqrt(max(var, 1e-9)) / margine) ** 2))
