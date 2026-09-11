"""Le verifiche.

    python -m boccia autotest
    python -m boccia autotest --pesante     (include il video sintetico)

REGOLA DI QUESTO FILE, la stessa di js/selftest.js: le prove interessanti non
sono quelle che controllano che una funzione restituisca il numero che le si e'
dato in pasto, ma quelle che potrebbero far FALLIRE il progetto. Qui ce ne sono
tre, e sono le uniche che contano davvero:

  - su una ruota perfettamente in bolla, la validazione held-out NON deve
    trovare nessun vantaggio. E' la prova del falso positivo, e sarebbe
    l'errore piu' costoso possibile: non si perde tempo, si perdono soldi;
  - il settore dichiarato dal metodo delta non deve essere molto piu' stretto
    di quello misurato sugli spin non visti. Se lo e', il modello e' piu'
    sicuro di se' di quanto meriti;
  - la catena video->tempi deve ricostruire istanti che conosciamo, entro
    qualche millisecondo. Senza questa, tutte le altre misurano una fisica
    inventata dal generatore.
"""
import math
import sys

import numpy as np

from . import budget as bg
from . import dati as dt
from . import modello as mdl
from . import sintetico as sn
from . import statistica as st
from . import uniformita as un
from . import video as vd

_passate = 0
_fallite = 0


def segna(nome, ok, dettaglio=""):
    global _passate, _fallite
    if ok:
        _passate += 1
        print("  ok  %s%s" % (nome, ("  -- " + dettaglio) if dettaglio else ""))
    else:
        _fallite += 1
        print("  NO  %s%s" % (nome, ("  -- " + dettaglio) if dettaglio else ""))


def vicino(a, b, tolleranza):
    return math.isfinite(a) and math.isfinite(b) and abs(a - b) <= tolleranza


# ---------------------------------------------------------------- statistica

def prove_statistica():
    print("statistica")
    segna("chi2_sf(3.841, 1) = 0.05", vicino(st.chi2_sf(3.841459, 1), 0.05, 1e-5))
    segna("chi2_sf(14.067, 7) = 0.05", vicino(st.chi2_sf(14.06714, 7), 0.05, 1e-5))
    segna("chi2_ppf inverte chi2_cdf",
          vicino(st.chi2_cdf(st.chi2_ppf(0.9, 5), 5), 0.9, 1e-9))
    segna("cdf + sf = 1", vicino(st.chi2_cdf(9.1, 7) + st.chi2_sf(9.1, 7), 1.0, 1e-12))
    segna("non centrale con lambda=0 e' il centrale",
          vicino(st.chi2_nc_cdf(11.0, 7, 0.0), st.chi2_cdf(11.0, 7), 1e-9))
    segna("non centrale cresce con lambda",
          st.chi2_nc_cdf(11.0, 7, 5.0) < st.chi2_nc_cdf(11.0, 7, 0.0))
    segna("normale_ppf(0.975) = 1.95996", vicino(st.normale_ppf(0.975), 1.959964, 1e-5))
    # Binomiale contro il valore esatto: P(X >= 3) per B(10, 0.3) vale
    # 1 - (0.7^10 + 10*0.3*0.7^9 + 45*0.09*0.7^8) = 0.6172172136.
    segna("binomiale_sf(3, 10, 0.3) = 0.61722",
          vicino(st.binomiale_sf(3, 10, 0.3), 0.6172172136, 1e-9))
    segna("binomiale_sf(0, n, p) = 1", vicino(st.binomiale_sf(0, 10, 0.3), 1.0, 1e-12))
    segna("binomiale_sf(n+1, n, p) = 0", st.binomiale_sf(11, 10, 0.3) == 0.0)
    basso, alto = st.intervallo_wilson(0, 30)
    segna("Wilson con zero successi non e' [0,0]", alto > 0.05, "alto = %.3f" % alto)
    segna("Wilson contiene la proporzione",
          st.intervallo_wilson(15, 30)[0] < 0.5 < st.intervallo_wilson(15, 30)[1])


# ---------------------------------------------------------------- modello

def prove_modello():
    print("modello")
    for M, veri in ((mdl.Lineare, [30.0, 2.5]),
                    (mdl.Esponenziale, [30.0, 11.0]),
                    (mdl.Misto, [30.0, 1.2, 0.05])):
        # Inversa coerente con la diretta.
        t = M.tempo_a_angolo(20.0, veri)
        segna("%s: tempo_a_angolo inverte theta" % M.nome,
              vicino(M.theta(t, veri), 20.0, 1e-6))
        t2 = M.tempo_a_omega(15.0, veri)
        segna("%s: tempo_a_omega inverte omega" % M.nome,
              vicino(M.omega(t2, veri), 15.0, 1e-6))
        # Fit su dati esatti: deve tornare ai parametri veri.
        tempi = np.array([M.tempo_a_angolo(2 * math.pi * k, veri) for k in range(9)]) + 5.0
        a = mdl.adatta(tempi, M)
        errore = max(abs(x - y) / abs(y) for x, y in zip(a.p, veri))
        segna("%s: il fit recupera i parametri esatti" % M.nome, errore < 1e-3,
              "errore relativo max %.1e" % errore)
        segna("%s: residuo nullo su dati esatti" % M.nome,
              float(np.abs(a.residui).max()) < 1e-6)

    # Con rumore, il fit deve restare centrato e la sigma deve avere l'ordine
    # di grandezza del rumore messo dentro.
    veri = [30.0, 2.5]
    rng = np.random.default_rng(0)
    sigme, scarti = [], []
    for _ in range(200):
        tempi = np.array([mdl.Lineare.tempo_a_angolo(2 * math.pi * k, veri)
                          for k in range(6)]) + rng.normal(0, 0.002, 6)
        tempi.sort()
        a = mdl.adatta(tempi, mdl.Lineare)
        sigme.append(a.sigma_residuo)
        scarti.append(a.p[0] - veri[0])
    segna("sigma del residuo ~ rumore immesso",
          vicino(float(np.median(sigme)), 0.002, 0.0012),
          "mediana %.4f s contro 0.0020 immessi" % np.median(sigme))
    segna("il fit non e' distorto", abs(float(np.mean(scarti))) < 0.08,
          "bias su omega0 = %+.3f rad/s" % np.mean(scarti))

    # `stima_da_velocita` deve poter attraversare `prevedi` come l'altro fit:
    # la sua covarianza ha la dimensione dei parametri PIU' la fase, e quando
    # non l'aveva `prevedi` esplodeva - cioe' proprio nell'unico caso in cui
    # questa funzione serve, il confronto fra i due metodi.
    campione = sn.genera_sessione(80, seme=4, omega_iniziale=20.0, omega_c=9.0,
                                  sigma_omega_c=0.05, jitter_s=0.004)
    errori_tempi, errori_velocita = [], []
    for uno in campione:
        finestra = uno.finestra(6)
        if finestra.size < 3:
            continue
        errori_tempi.append(
            mdl.prevedi(mdl.adatta(finestra, mdl.Lineare), 9.0).t_caduta - uno.t_caduta)
        errori_velocita.append(
            mdl.prevedi(mdl.stima_da_velocita(finestra, mdl.Lineare), 9.0).t_caduta
            - uno.t_caduta)
    segna("prevedi funziona anche sul fit sulle velocita'",
          len(errori_velocita) == len(errori_tempi) and
          all(math.isfinite(x) for x in errori_velocita))
    sui_tempi = float(np.std(errori_tempi))
    sulle_velocita = float(np.std(errori_velocita))
    segna("il fit sui tempi non e' peggiore di quello sulle velocita'",
          sui_tempi <= sulle_velocita * 1.02,
          "%.0f ms contro %.0f ms" % (1000 * sui_tempi, 1000 * sulle_velocita))
    segna("il fit sulle velocita' non finge di avere una barra d'errore",
          not math.isfinite(
              mdl.prevedi(mdl.stima_da_velocita(campione[0].finestra(6),
                                                mdl.Lineare), 9.0).sigma_t))

    wc = mdl.omega_critica(45.0, 9.80665)
    segna("omega_critica(45 gradi, R=g) = 1 rad/s", vicino(wc, 1.0, 1e-9))
    segna("omega_critica cresce con l'inclinazione",
          mdl.omega_critica(50, 0.25) > mdl.omega_critica(30, 0.25))

    # La previsione deve cadere dove dice il modello.
    tempi = np.array([mdl.Lineare.tempo_a_angolo(2 * math.pi * k, veri) for k in range(6)])
    a = mdl.adatta(tempi, mdl.Lineare)
    pr = mdl.prevedi(a, 9.0)
    segna("previsione: omega alla caduta e' omega_c",
          vicino(a.omega(pr.t_caduta), 9.0, 1e-4))
    segna("previsione: sigma cresce con l'incertezza su omega_c",
          mdl.prevedi(a, 9.0, sigma_omega_c=0.3).sigma_t > pr.sigma_t)


# ---------------------------------------------------------------- budget

def prove_budget():
    print("budget di precisione")
    segna("un ottavo a 1.43 giri/s dura ~87 ms",
          vicino(1000 * bg.tempo_per_settore(9.0), 87.3, 1.0),
          "%.1f ms" % (1000 * bg.tempo_per_settore(9.0)))
    b = bg.budget_analitico(9.0, 1.7, 0.17, 0.0)
    segna("budget analitico: sigma = sigma_w / decelerazione",
          vicino(b.sigma_t, 0.1, 1e-9))
    richiesta = bg.sigma_omega_c_richiesta(2.0, 9.0, 1.7)
    segna("sigma_omega_c_richiesta inverte il budget",
          vicino(bg.budget_analitico(9.0, 1.7, richiesta).settori_a_1sigma, 2.0, 1e-6))

    # La formula chiusa deve prevedere quello che si misura sulla simulazione.
    spin = sn.genera_sessione(120, seme=3, omega_iniziale=20.0, omega_c=9.0,
                              sigma_omega_c=0.25, jitter_s=0.002)
    misurato = bg.validazione_incrociata(spin, n_giri=5)
    previsto = bg.budget_analitico(9.0, 1.73, 0.25).sigma_t
    segna("la formula chiusa prevede la simulazione entro il 40%",
          abs(misurato["sigma_t"] - previsto) < 0.4 * previsto,
          "misurato %.0f ms, previsto %.0f ms" % (1000 * misurato["sigma_t"],
                                                  1000 * previsto))

    # LA PROVA CHE CONTA: il metodo delta non deve promettere piu' di quanto
    # la misura held-out mantenga.
    dichiarato = misurato["larghezza_dichiarata"]
    reale = misurato["budget"].settori_a_1sigma
    segna("il settore dichiarato non e' molto piu' stretto di quello misurato",
          dichiarato > 0.6 * reale,
          "dichiarato %.1f diamanti, misurato %.1f" % (dichiarato, reale))

    # Piu' rumore sui passaggi -> settore piu' largo. Se non succede, qualcosa
    # nel budget non sta guardando i dati.
    sporco = sn.genera_sessione(120, seme=3, omega_iniziale=20.0, omega_c=9.0,
                                sigma_omega_c=0.25, jitter_s=0.015)
    peggiore = bg.validazione_incrociata(sporco, n_giri=5)
    segna("peggiorando l'estrazione il settore si allarga",
          peggiore["sigma_t"] > misurato["sigma_t"],
          "%.0f ms contro %.0f ms" % (1000 * peggiore["sigma_t"],
                                      1000 * misurato["sigma_t"]))

    # Il bootstrap deve dare un'incertezza dello stesso ordine del metodo
    # delta: sono due strade diverse per lo stesso numero, e se divergono di
    # molto una delle due ha un errore.
    tempi = spin[0].finestra(6)
    b = bg.bootstrap(tempi, 9.0, n=200, seme=0)
    delta = mdl.prevedi(mdl.adatta(tempi, mdl.Lineare), 9.0).sigma_t
    rapporto = b["sigma_t"] / delta if delta > 0 else float("inf")
    segna("bootstrap e metodo delta d'accordo entro un fattore 3",
          0.33 < rapporto < 3.0,
          "bootstrap %.0f ms, delta %.0f ms" % (1000 * b["sigma_t"], 1000 * delta))
    segna("il bootstrap ha fatto convergere quasi tutti i fit",
          b["n_riusciti"] > 180, "%d su 200" % b["n_riusciti"])

    # Il modello a tre parametri e' quello VERO nel generatore, e deve
    # comunque perdere su finestre corte. Se un giorno smettesse di perdere, il
    # default `lineare` andrebbe rimesso in discussione: e' quello che questa
    # prova sorveglia.
    for giri in (4, 5):
        lin = bg.validazione_incrociata(spin, n_giri=giri, modello=mdl.Lineare)
        mis = bg.validazione_incrociata(spin, n_giri=giri, modello=mdl.Misto)
        segna("a %d giri il modello a 2 parametri batte quello a 3" % giri,
              lin["rms_t"] < mis["rms_t"],
              "lineare %.0f ms, misto %.0f ms" % (1000 * lin["rms_t"],
                                                  1000 * mis["rms_t"]))

    # LA FINESTRA DI SCOMMESSA. L'informazione deve degradare con l'anticipo e
    # spegnersi: se la previsione a cinque secondi dalla caduta valesse ancora
    # qualcosa, vorrebbe dire che qualcosa nel giro di misura sta barando.
    lunghi = sn.genera_sessione(400, seme=8, omega_iniziale=27.0, omega_c=9.0,
                               sigma_omega_c=0.15, jitter_s=0.0015)
    righe = bg.finestra_di_scommessa(lunghi, anticipi=(0.5, 1.5, 3.0, 5.0))
    segna("la finestra di scommessa si valuta a tutti gli anticipi",
          len(righe) == 4, "%d righe su 4" % len(righe))
    if len(righe) == 4:
        vicino_caduta, lontano = righe[0], righe[-1]
        segna("vicino alla caduta la previsione batte il caso",
              vicino_caduta["p_diamante"] > 2.0 * vicino_caduta["caso_diamante"],
              "%.1f%% contro %.1f%%" % (100 * vicino_caduta["p_diamante"],
                                        100 * vicino_caduta["caso_diamante"]))
        segna("a cinque secondi di anticipo non resta informazione",
              abs(lontano["p_diamante"] - lontano["caso_diamante"]) < 0.04,
              "%.1f%% contro il caso %.1f%%" % (100 * lontano["p_diamante"],
                                                100 * lontano["caso_diamante"]))
        # `giri_residui` e' il cancello che `stima` usa dal vivo, quando
        # l'istante di caduta non si conosce: deve crescere con l'anticipo, se
        # no il cancello non distingue niente.
        segna("i giri residui stimati crescono con l'anticipo",
              all(righe[i]["giri_residui"] < righe[i + 1]["giri_residui"]
                  for i in range(3)),
              " < ".join("%.1f" % r["giri_residui"] for r in righe))
        segna("sigma cresce con l'anticipo",
              all(righe[i]["sigma_t"] < righe[i + 1]["sigma_t"] for i in range(3)),
              " < ".join("%.0f" % (1000 * r["sigma_t"]) for r in righe) + " ms")
        # La distribuzione predittiva relativa: e' l'ingresso di
        # `numeri.catena`, quindi deve essere una distribuzione vera e deve
        # essere piccata sullo zero finche' la previsione vale qualcosa.
        q = righe[0]["scarto_diamanti"]
        segna("lo scarto in diamanti e' una distribuzione",
              abs(sum(q) - 1.0) < 1e-9 and all(x >= 0 for x in q))
        segna("ed e' piccata sul settore previsto vicino alla caduta",
              q[0] == max(q) and q[0] > 2.0 / 8, "%.1f%% sullo zero" % (100 * q[0]))
        lontano_q = righe[-1]["scarto_diamanti"]
        segna("e piatta quando l'informazione e' finita",
              max(lontano_q) < 2.0 / 8,
              "massimo %.1f%% contro il piatto 12.5%%" % (100 * max(lontano_q)))

        # Allargare il settore NON compra anticipo: il tasso assoluto sale ma
        # il moltiplicatore sul caso no, e il moltiplicatore e' quello che
        # paga. Prova che sorveglia la conclusione, perche' e' controintuitiva.
        stretto = bg.anticipo_per_settore(righe, 1)
        largo = bg.anticipo_per_settore(righe, 5)
        segna("allargare il settore non compra anticipo",
              stretto is not None and largo is not None and largo <= stretto,
              "1 diamante fino a %.1f s, 5 diamanti fino a %.1f s" % (stretto, largo))

        limite = bg.anticipo_massimo(righe)
        segna("l'anticipo massimo utile cade fra 1 e 3 secondi",
              limite is not None and 0.5 <= limite <= 3.0, "%s s" % limite)
        segna("la costante ANTICIPO_UTILE_GIRI e' coerente con la misura",
              any(abs(r["giri_residui"] - bg.ANTICIPO_UTILE_GIRI) < 2.0 and
                  r["p_diamante"] < 1.6 * r["caso_diamante"] for r in righe),
              "%.1f giri" % bg.ANTICIPO_UTILE_GIRI)

    # Con un'estrazione rovinata nessun anticipo deve passare: la funzione deve
    # saper dire "non si passa" invece di consigliare di chiudere piu' tardi.
    rovinati = sn.genera_sessione(300, seme=8, omega_iniziale=27.0, omega_c=9.0,
                                  sigma_omega_c=1.2, jitter_s=0.05)
    segna("su una ruota impossibile non esiste anticipo utile",
          bg.anticipo_massimo(bg.finestra_di_scommessa(
              rovinati, anticipi=(0.5, 1.5, 3.0))) is None)

    d = bg.diagnosi_soglia(spin, n_giri=4)
    segna("la diagnosi rapida ritrova la soglia messa nel generatore",
          vicino(d["omega_c"], 9.0, 0.5), "omega_c = %.2f" % d["omega_c"])


# ---------------------------------------------------------------- uniformita

def prove_uniformita():
    print("uniformita")
    segna("chi-quadro nullo su istogramma perfettamente piatto",
          vicino(un.prova_uniformita([i for i in range(8)] * 25)["chi2"], 0.0, 1e-9))
    r = un.prova_uniformita([0] * 100)
    segna("chi-quadro massimo su una casella sola", r["p"] < 1e-9)
    segna("spin_necessari cala al crescere dell'effetto",
          un.spin_necessari(0.30) < un.spin_necessari(0.15) < un.spin_necessari(0.10))
    segna("spin_necessari(0.20) ~ 350", vicino(un.spin_necessari(0.20), 350, 40),
          "%d" % un.spin_necessari(0.20))
    segna("potenza cresce col numero di spin",
          un.potenza_raggiunta(100, 0.2) < un.potenza_raggiunta(500, 0.2))

    # Il tasso di falsi positivi del chi-quadro deve essere quello dichiarato.
    rng = np.random.default_rng(7)
    significativi = sum(1 for _ in range(400)
                        if un.prova_uniformita(rng.integers(0, 8, 300))["p"] < 0.05)
    segna("falsi positivi del chi-quadro vicini al 5%",
          0.02 < significativi / 400 < 0.09, "%.1f%%" % (100 * significativi / 400))

    # La correzione di Holm deve tenere i falsi positivi sotto controllo anche
    # guardando otto caselle insieme.
    falsi = sum(1 for _ in range(300)
                if any(e["significativo"]
                       for e in un.diamante_dominante(rng.integers(0, 8, 300))))
    segna("Holm tiene i falsi 'diamante dominante' sotto il 10%",
          falsi / 300 < 0.10, "%.1f%%" % (100 * falsi / 300))

    # LA PROVA DEL FALSO POSITIVO: ruota perfetta, validazione held-out.
    tassi = []
    for seme in range(60):
        d = np.random.default_rng(seme).integers(0, 8, 400)
        v = un.validazione_holdout(d, seme=seme, ampiezza_settore=3)
        tassi.append(v["batte_il_caso"])
    quota = sum(tassi) / len(tassi)
    segna("su ruota in bolla l'held-out non trova vantaggi",
          quota < 0.10, "%.0f%% di falsi positivi su 60 sessioni finte" % (100 * quota))

    # E su una ruota storta lo deve trovare.
    spin = sn.genera_sessione(400, seme=1, omega_iniziale=20.0, omega_c=9.0,
                              sigma_omega_c=0.2, inclinazione_ruota=0.02,
                              angolo_inclinazione=2.0, dispersione_diamante=0.35)
    d = [s.diamante for s in spin]
    segna("su ruota inclinata il chi-quadro se ne accorge",
          un.prova_uniformita(d)["p"] < 0.001)
    v = un.validazione_holdout(d, ampiezza_settore=3)
    segna("e l'held-out conferma il vantaggio", v["batte_il_caso"],
          "%.1f%% contro %.1f%%" % (100 * v["tasso"], 100 * v["caso"]))

    segna("pareggio a 5 numeri coperti = 13.9%",
          vicino(un.vantaggio(5.0 / 36.0, 5), 0.0, 1e-12))
    segna("piu' il margine e' sottile, piu' spin servono a dimostrarlo",
          un.spin_per_dimostrare_vantaggio(0.02, 5) >
          un.spin_per_dimostrare_vantaggio(0.20, 5))


# ---------------------------------------------------------------- video

def prove_video():
    print("video (geometria e tempi)")
    cx, cy, A, B, ang = 640.0, 360.0, 300.0, 180.0, 0.4
    u = np.linspace(0, 2 * math.pi, 40, endpoint=False)
    bordo = np.column_stack([
        cx + A * np.cos(u) * math.cos(ang) - B * np.sin(u) * math.sin(ang),
        cy + A * np.cos(u) * math.sin(ang) + B * np.sin(u) * math.cos(ang)])
    trovata = vd.adatta_ellisse(bordo)
    segna("ellisse esatta ricostruita",
          max(abs(a - b) for a, b in zip(trovata, (cx, cy, A, B, ang))) < 1e-6)
    segna("ellisse da mezzo bordo soltanto",
          max(abs(a - b) for a, b in zip(vd.adatta_ellisse(bordo[:20]),
                                         (cx, cy, A, B, ang))) < 1e-5)
    # Un solo punto sbagliato non deve spostare il fit robusto.
    sporco = bordo.copy()
    sporco[3] = [50.0, 50.0]
    robusta, tenuti = vd.adatta_ellisse_robusta(sporco)
    segna("il fit robusto scarta il punto fuori posto",
          abs(robusta[2] - A) < 1.0 and not tenuti[3],
          "semiasse %.2f contro %.2f" % (robusta[2], A))

    cal = vd.Calibrazione.da_ellisse(trovata)
    raggi = [cal.punto_a_polari(x, y)[0] for x, y in bordo]
    segna("dopo la calibrazione il bordo ha raggio 1",
          max(abs(r - 1.0) for r in raggi) < 1e-9)

    # L'omografia da punti noti deve dare gli angoli ASSOLUTI giusti.
    H = sn.omografia_camera(distanza=2.0, inclinazione_gradi=45.0, azimut_gradi=30.0,
                            focale_px=600.0, larghezza=1280, altezza=720)
    angoli_noti = np.array([0.0, math.pi / 2, math.pi, 3 * math.pi / 2])
    punti = []
    for a in angoli_noti:
        v = H @ np.array([0.26 * math.cos(a), 0.26 * math.sin(a), 1.0])
        punti.append([v[0] / v[2], v[1] / v[2]])
    cal2 = vd.Calibrazione.da_punti_noti(punti, angoli_noti, raggio=0.26)
    prova = 1.1
    v = H @ np.array([0.26 * math.cos(prova), 0.26 * math.sin(prova), 1.0])
    _, ricostruito = cal2.punto_a_polari(v[0] / v[2], v[1] / v[2])
    segna("omografia da 4 punti noti: angolo assoluto esatto",
          vicino(ricostruito, prova, 1e-6),
          "%.6f contro %.6f" % (ricostruito, prova))

    # L'ERRORE DELLA CALIBRAZIONE AFFINE, misurato invece che asserito. Punti
    # esatti su un cerchio, proiettati con un'omografia prospettica vera, poi
    # raddrizzati in modo affine: quanto sbaglia l'angolo?
    def distorsione(distanza, inclinazione):
        Hc = sn.omografia_camera(distanza=distanza, inclinazione_gradi=inclinazione,
                                 azimut_gradi=15.0, focale_px=900 * 2.0 / distanza,
                                 larghezza=1280, altezza=720)
        veri = np.linspace(0, 2 * math.pi, 120, endpoint=False)
        proiettati = []
        for ang in veri:
            w = Hc @ np.array([0.26 * math.cos(ang), 0.26 * math.sin(ang), 1.0])
            proiettati.append([w[0] / w[2], w[1] / w[2]])
        proiettati = np.array(proiettati)
        calibrata = vd.Calibrazione.da_ellisse(vd.adatta_ellisse(proiettati))
        letti = np.unwrap([calibrata.punto_a_polari(x, y)[1] for x, y in proiettati])
        verso = np.sign(np.median(np.diff(letti)))
        scarto = letti - verso * np.unwrap(veri)
        return math.degrees(float(np.max(np.abs(scarto - np.median(scarto)))))

    lontana = distorsione(4.0, 20.0)
    vicina = distorsione(0.6, 65.0)
    segna("camera alta e lontana: distorsione affine trascurabile", lontana < 2.0,
          "%.2f gradi, cioe' il %.0f%% di un diamante" % (lontana, 100 * lontana / 45))
    segna("camera vicina e radente: la distorsione affine NON e' trascurabile",
          vicina > 10.0,
          "%.1f gradi, cioe' il %.0f%% di un diamante" % (vicina, 100 * vicina / 45))
    segna("l'omografia da punti noti toglie del tutto quel termine",
          cal2.residuo_gradi < 1e-6, "residuo %.1e gradi" % cal2.residuo_gradi)

    # Sub-frame: da una serie angolare nota devono uscire gli istanti noti.
    fps = 60.0
    veri = [mdl.Misto.tempo_a_angolo(2 * math.pi * k, [22.0, 1.2, 0.05]) for k in range(9)]
    t = np.arange(0, veri[-1] + 0.2, 1.0 / fps)
    angoli = np.array([mdl.Misto.theta(x, [22.0, 1.2, 0.05]) for x in t])
    tempi, giri, avvisi = vd.passaggi(t, (angoli + 0.7) % (2 * math.pi), 0.7)
    n = min(len(tempi), len(veri))
    errore = max(abs(tempi[i] - veri[i]) for i in range(n))
    segna("interpolazione sub-frame entro 1 ms", errore < 1e-3,
          "errore max %.2f ms su %d passaggi" % (1000 * errore, n))
    segna("nessun passaggio inventato o perso", n == len(veri) and not avvisi,
          "%d trovati, %d veri" % (len(tempi), len(veri)))

    # Senza sub-frame l'errore sarebbe la quantizzazione: verifica che
    # l'interpolazione serva davvero e non sia decorativa.
    grezzi = np.round(np.array(tempi) * fps) / fps
    segna("il sub-frame migliora di almeno 5 volte",
          np.std(grezzi - veri[:n]) > 4 * np.std(np.array(tempi) - veri[:n]),
          "%.2f ms contro %.2f ms" % (1000 * np.std(grezzi - veri[:n]),
                                      1000 * np.std(np.array(tempi) - veri[:n])))

    # Caduta da una serie di raggi costruita a mano.
    t = np.arange(0, 4.0, 1 / 60.0)
    caduta_vera = 3.0
    raggi = np.where(t < caduta_vera, 1.0,
                     1.0 - 0.35 * np.clip((t - caduta_vera) / 0.25, 0, 1))
    raggi = raggi + np.random.default_rng(0).normal(0, 0.004, t.size)
    stimata, riferimento = vd.istante_caduta(t, raggi)
    segna("istante di caduta dal raggio", vicino(stimata, caduta_vera, 0.03),
          "%.3f contro %.3f s" % (stimata, caduta_vera))

    # L'ondeggio bloccato sull'angolo si deve poter togliere.
    angoli = (t * 12.0) % (2 * math.pi)
    ondeggiati = raggi * (1 + 0.03 * np.cos(angoli) + 0.01 * np.sin(2 * angoli))
    corretti, ampiezza = vd.correggi_ondeggio(ondeggiati, angoli,
                                              maschera_fit=t < caduta_vera)
    prima = float(np.std(ondeggiati[t < caduta_vera]))
    dopo = float(np.std(corretti[t < caduta_vera]))
    segna("la correzione dell'ondeggio lo toglie davvero", dopo < 0.3 * prima,
          "da %.4f a %.4f" % (prima, dopo))

    # Correlazione di fase, compresa la trappola delle 37 caselle.
    n_bin = 720
    DUE_PI = 2 * math.pi
    phi = np.linspace(0, DUE_PI, n_bin, endpoint=False)
    profilo = np.sign(np.sin(37 * phi)) + 0.3 * np.cos(phi)
    for gradi in (0.5, 3.0, -2.0):
        spostato = np.roll(profilo, int(round(gradi / 360.0 * n_bin)))
        misurato = math.degrees(vd.spostamento_fase(spostato, profilo, massimo_bin=40))
        segna("correlazione di fase, spostamento %+.1f gradi" % gradi,
              vicino(misurato, gradi, 0.3), "misurato %+.2f" % misurato)
    # Spostamenti NON multipli del bin: e' li' che il raffinamento
    # sull'armonica batte la parabola, e il confronto sta nella prova perche'
    # la differenza e' un bias sistematico, non rumore.
    for gradi in (1.91, 0.43, -2.37):
        continuo = np.interp((phi - math.radians(gradi)) % DUE_PI, phi, profilo,
                             period=DUE_PI)
        fine = math.degrees(vd.spostamento_fase(continuo, profilo, massimo_bin=40))
        parabola = math.degrees(vd.spostamento_fase(continuo, profilo, massimo_bin=40,
                                                    armonica=False))
        segna("armonica dominante batte la parabola a %+.2f gradi" % gradi,
              abs(fine - gradi) < 0.02 and abs(fine - gradi) < abs(parabola - gradi),
              "armonica %+.3f, parabola %+.3f" % (fine, parabola))
    # Riprese occluse: il supporto valido e' un pezzo di circonferenza, e le
    # due funzioni devono dare lo stesso numero, segno compreso.
    coperti = (phi < math.radians(100)) | (phi > math.radians(260))
    for gradi in (1.91, -2.4, 0.5):
        continuo = np.interp((phi - math.radians(gradi)) % DUE_PI, phi, profilo,
                             period=DUE_PI)
        mascherato, qualita = vd.spostamento_mascherato(continuo, profilo, coperti, 14)
        intero = vd.spostamento_fase(continuo, profilo, massimo_bin=14)
        segna("correlazione mascherata a %+.2f gradi (supporto %.0f%%)"
              % (gradi, 100 * coperti.mean()),
              vicino(math.degrees(mascherato), gradi, 0.1) and qualita > 0.9,
              "mascherata %+.3f, intera %+.3f, corr %.3f"
              % (math.degrees(mascherato), math.degrees(intero), qualita))
    # Un profilo senza struttura non deve produrre un numero convincente: la
    # funzione deve restituire NaN e correlazione nulla, cosi' `fase_rotore` lo
    # scarta invece di mediarlo con gli altri.
    piatto = np.ones(n_bin)
    sp, q = vd.spostamento_mascherato(piatto, piatto, coperti, 14)
    segna("su un profilo senza struttura la correlazione si dichiara nulla",
          (not math.isfinite(sp)) and q < 0.4, "spostamento %s, correlazione %.2f"
          % (sp, q))

    # LA TRAPPOLA DELLE 37 CASELLE. Uno spostamento di 12 gradi supera il mezzo
    # passo casella (4,87): la correlazione trova il picco piu' vicino a zero,
    # che e' l'alias 12 - 9,73 = 2,27. Non e' rumore, e' deterministico, e sul
    # video vero si presenta come un rotore che sembra girare piano.
    passo = 360.0 / 37
    oltre = 12.0
    aliasato = np.roll(profilo, int(round(oltre / 360.0 * n_bin)))
    # Finestra sotto il mezzo passo (4,87 gradi), come quella che usa
    # `fase_rotore`: lo spostamento vero ci cade fuori e resta solo l'alias.
    finestra_bin = int(0.8 * (180.0 / 37) / 360.0 * n_bin)
    cieco = math.degrees(vd.spostamento_fase(aliasato, profilo, massimo_bin=finestra_bin))
    # Quale alias esca dipende da dettagli di campionamento (720 bin non sono
    # un multiplo di 37); quello che conta, ed e' il difetto, e' che il numero
    # restituito non c'entra piu' niente con lo spostamento vero.
    segna("oltre mezzo passo casella la fase si aliasa",
          abs(cieco - oltre) > passo / 2,
          "misura %+.2f invece di %+.2f, sbagliato di %.1f gradi"
          % (cieco, oltre, abs(cieco - oltre)))
    # Con la finestra centrata sull'atteso, invece, torna giusta.
    guidato = math.degrees(vd.spostamento_fase(aliasato, profilo,
                                               massimo_bin=finestra_bin,
                                               centro=math.radians(oltre)))
    segna("con la finestra centrata sull'atteso torna giusta",
          abs(guidato - oltre) < 0.5, "misura %+.2f" % guidato)
    segna("fps_minimi_rotore(0.8 giri/s) ~ 59",
          vicino(vd.fps_minimi_rotore(0.8, margine=2.0), 59.2, 0.5),
          "%.1f fps" % vd.fps_minimi_rotore(0.8, margine=2.0))


def prove_rotore():
    """La fase del rotore, da capo a fondo su fotogrammi sintetici.

    Esisteva una prova su `spostamento_fase` isolata, e passava; ma
    `profilo_angolare` non era mai stato eseguito, e aveva un bug che lo
    rendeva impossibile da chiamare. Una funzione provata solo nei suoi pezzi
    puo' essere rotta nel modo piu' banale possibile.
    """
    print("rotore (catena completa)")
    rng = np.random.default_rng(11)
    spin = sn.genera_spin(rng, omega_iniziale=16.0, omega_c=9.0, jitter_s=0.0)
    L, A = 640, 360
    omega_vera = -2.0  # rad/s, cioe' 0.32 giri/s: dentro il limite a 60 fps
    H = sn.omografia_camera(distanza=2.0, inclinazione_gradi=35.0, azimut_gradi=10.0,
                            focale_px=300.0, larghezza=L, altezza=A)
    fotogrammi = list(sn.fotogrammi_sintetici(spin, fps=60.0, H=H, larghezza=L, altezza=A,
                                              omega_rotore=omega_vera))
    cal = vd.Calibrazione.da_ellisse(vd.adatta_ellisse(
        vd.punti_traiettoria(fotogrammi, vd.sfondo_mediano(fotogrammi))))

    profilo = vd.profilo_angolare(fotogrammi[0], cal, n_bin=720)
    segna("profilo_angolare produce un profilo della lunghezza giusta",
          profilo.shape == (720,) and np.all(np.isfinite(profilo)))
    segna("il profilo vede le caselle del rotore",
          float(profilo.std()) > 1.0, "deviazione %.1f livelli" % profilo.std())

    t, fasi, omega, avvisi = vd.fase_rotore(fotogrammi[:80], cal, 60.0,
                                            n_caselle=37)
    segna("la velocita' del rotore e' quella messa nel generatore",
          vicino(omega, omega_vera, 0.25),
          "%.3f contro %.3f rad/s" % (omega, omega_vera))
    segna("nessun avviso di aliasing a 60 fps con rotore lento", not avvisi,
          "; ".join(avvisi) if avvisi else "")

    # Sotto-campionando a 15 fps lo stesso rotore deve risultare aliasato, e la
    # funzione deve DIRLO invece di restituire un numero sbagliato in silenzio.
    veloci = list(sn.fotogrammi_sintetici(spin, fps=60.0, H=H, larghezza=L, altezza=A,
                                          omega_rotore=-9.0))[:80:1]
    _, _, om2, avvisi2 = vd.fase_rotore(veloci[:60], cal, 12.0, n_caselle=37)
    segna("con pochi fps e rotore veloce l'aliasing viene segnalato",
          bool(avvisi2), "; ".join(avvisi2)[:80] if avvisi2 else "nessun avviso")


def prove_video_pesanti():
    print("video (catena completa su fotogrammi sintetici)")
    errori_passaggi, errori_caduta = [], []
    for seme in range(4):
        rng = np.random.default_rng(200 + seme)
        spin = sn.genera_spin(rng, omega_iniziale=16.0, omega_c=9.0, jitter_s=0.0)
        L, A = 720, 405
        H = sn.omografia_camera(distanza=2.0, inclinazione_gradi=38.0, azimut_gradi=15.0,
                                focale_px=340.0, larghezza=L, altezza=A)
        fotogrammi = list(sn.fotogrammi_sintetici(spin, fps=60.0, H=H, larghezza=L,
                                                  altezza=A))
        esito = vd.estrai(fotogrammi, fps=60.0)
        tempi = np.array(esito["tempi"])
        if tempi.size < 3 or esito["t_caduta"] is None:
            segna("spin %d estratto" % seme, False, "estrazione fallita")
            continue
        # L'errore si misura in modo indipendente dalla fase del tripwire:
        # l'angolo VERO percorso fra due passaggi deve fare esattamente 2 pi.
        angoli = np.array([mdl.Misto.theta(x, spin.parametri) for x in tempi])
        omega = np.array([mdl.Misto.omega(x, spin.parametri) for x in tempi[:-1]])
        errori_passaggi.extend(1000 * (np.diff(angoli) - 2 * math.pi) / omega)
        errori_caduta.append(1000 * (esito["t_caduta"] - spin.t_caduta))

    if not errori_passaggi:
        segna("catena video completa", False, "nessuno spin estratto")
        return
    prova_lettore_video()
    sigma = float(np.std(errori_passaggi))
    segna("tempi di passaggio entro 3 ms di sigma", sigma < 3.0,
          "sigma %.2f ms (la sola quantizzazione a 60 fps darebbe 4.8 ms)" % sigma)
    scarto = float(np.std(errori_caduta)) if len(errori_caduta) > 1 else 0.0
    segna("istante di caduta ripetibile entro 30 ms", scarto < 30.0,
          "sigma %.1f ms, bias %+.1f ms" % (scarto, float(np.mean(errori_caduta))))


# ---------------------------------------------------------------- dati

def prova_lettore_video():
    """Scrive un video vero e lo rilegge: e' l'unico pezzo che dipende da
    OpenCV, e l'unico modo di provarlo e' fargli attraversare un file."""
    try:
        import cv2
    except ImportError:
        print("  --  lettore video: saltato, OpenCV non installato")
        return
    import os
    import tempfile

    percorso = os.path.join(tempfile.mkdtemp(), "prova.mp4")
    fotogrammi = [(np.full((120, 160), i * 2 % 250)).astype(np.uint8) for i in range(30)]
    scrittore = cv2.VideoWriter(percorso, cv2.VideoWriter_fourcc(*"mp4v"), 25.0,
                                (160, 120), False)
    if not scrittore.isOpened():
        print("  --  lettore video: saltato, nessun codec disponibile")
        return
    for f in fotogrammi:
        scrittore.write(f)
    scrittore.release()

    sorgente = vd.SorgenteVideo(percorso)
    letti = list(sorgente)
    segna("il lettore video ritrova tutti i fotogrammi", len(letti) == len(fotogrammi),
          "%d letti su %d" % (len(letti), len(fotogrammi)))
    segna("il lettore video legge gli fps giusti", vicino(sorgente.fps, 25.0, 0.1),
          "%.1f" % sorgente.fps)
    segna("i fotogrammi arrivano in scala di grigi e nell'ordine giusto",
          letti and letti[0].ndim == 2 and
          float(letti[0].mean()) < float(letti[10].mean()))
    parziale = list(vd.SorgenteVideo(percorso, inizio=5, fine=15))
    segna("il taglio inizio/fine funziona", len(parziale) == 10, "%d" % len(parziale))


def prove_dati():
    print("dati")
    import tempfile
    import os

    spin = sn.genera_sessione(5, seme=0, omega_iniziale=20.0, omega_c=9.0)
    registrazioni = [dt.Registrazione(s.tempi, s.t_caduta, angolo_caduta=s.angolo_caduta,
                                      diamante=s.diamante, sorgente="prova/%d" % i)
                     for i, s in enumerate(spin)]
    percorso = os.path.join(tempfile.mkdtemp(), "sessione.json")
    dt.salva(percorso, registrazioni, ruota="prova")
    rilette, meta = dt.carica(percorso)
    segna("salva e rileggi: stesso numero di spin", len(rilette) == len(registrazioni))
    segna("salva e rileggi: stessi tempi",
          all(np.allclose(a.tempi, b.tempi) for a, b in zip(registrazioni, rilette)))
    segna("salva e rileggi: nome della ruota", meta["ruota"] == "prova")
    r = rilette[0]
    segna("finestra prende gli ultimi giri",
          np.allclose(r.finestra(3), r.tempi[-3:]))
    segna("giri_finestra parte da zero", r.giri_finestra(3)[0] == 0)
    segna("diamante ricavato dall'angolo coincide con quello annotato",
          all(x.diamante == x.diamante_da_angolo() for x in rilette))


# ---------------------------------------------------------------- tutto

def esegui(pesante=False):
    global _passate, _fallite
    _passate = _fallite = 0
    prove_statistica()
    prove_modello()
    prove_budget()
    prove_uniformita()
    prove_video()
    prove_dati()
    if pesante:
        prove_rotore()
        prove_video_pesanti()
    else:
        print("video (catena completa): saltata, si attiva con --pesante")
    print()
    print("%d passate, %d fallite" % (_passate, _fallite))
    return 1 if _fallite else 0


if __name__ == "__main__":
    sys.exit(esegui("--pesante" in sys.argv))
