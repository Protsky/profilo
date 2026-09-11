"""Riga di comando.

    python -m boccia autotest
    python -m boccia simula --spin 300 --uscita sessione.json
    python -m boccia estrai video/*.mp4 --uscita sessione.json
    python -m boccia uniformita sessione.json
    python -m boccia budget sessione.json
    python -m boccia stima sessione.json --giri 4

L'ordine in cui usarli non e' quello in cui sono elencati. Prima `uniformita`,
che dice se su questa ruota c'e' qualcosa da trovare; poi `budget`, che dice
quanto stretto puo' essere il settore; solo dopo `stima`, che e' la parte che
sembra il progetto ma e' l'ultima a servire.
"""
import argparse
import math
import sys

import numpy as np

from . import budget as bg
from . import dati as dt
from . import modello as mdl
from . import numeri as nm
from . import uniformita as un


def _modello(nome):
    if nome not in mdl.MODELLI:
        raise SystemExit("modello sconosciuto: %s (scegli fra %s)"
                         % (nome, ", ".join(mdl.MODELLI)))
    return mdl.MODELLI[nome]


# ---------------------------------------------------------------- comandi

def comando_estrai(args):
    from . import video as vd

    registrazioni = []
    for percorso in args.video:
        try:
            sorgente = vd.SorgenteVideo(percorso, inizio=args.inizio, fine=args.fine)
            fps = args.fps or sorgente.fps
            esito = vd.estrai(sorgente, fps=fps,
                              angolo_tripwire=math.radians(args.tripwire),
                              con_rotore=args.rotore)
        except (IOError, ValueError, ImportError) as errore:
            print("  %s: SALTATO (%s)" % (percorso, errore))
            continue
        r = dt.Registrazione.da_estrazione(esito, sorgente=percorso)
        registrazioni.append(r)
        stato = ("caduta %.3f s" % r.t_caduta) if math.isfinite(r.t_caduta) else "CADUTA NON VISTA"
        print("  %s: %d passaggi, %s%s"
              % (percorso, r.tempi.size, stato,
                 ("  [%s]" % "; ".join(esito["avvisi"])) if esito["avvisi"] else ""))
    if not registrazioni:
        raise SystemExit("nessun video utilizzabile")
    dt.salva(args.uscita, registrazioni, ruota=args.ruota)
    print("%d spin salvati in %s" % (len(registrazioni), args.uscita))


def comando_simula(args):
    from . import sintetico as sn

    spin = sn.genera_sessione(args.spin, seme=args.seme, omega_iniziale=args.omega0,
                              omega_c=args.omega_c, sigma_omega_c=args.sigma_omega_c,
                              inclinazione_ruota=args.inclinazione,
                              angolo_inclinazione=math.radians(args.angolo_inclinazione),
                              jitter_s=args.jitter / 1000.0,
                              dispersione_diamante=math.radians(args.dispersione))
    registrazioni = [
        dt.Registrazione(s.tempi, s.t_caduta, angolo_caduta=s.angolo_caduta,
                         diamante=s.diamante, sorgente="simulato/%d" % i)
        for i, s in enumerate(spin)]
    dt.salva(args.uscita, registrazioni,
             ruota="simulata (inclinazione %.3f)" % args.inclinazione,
             note="ATTENZIONE: dati finti, servono a provare la catena")
    print("%d spin simulati in %s" % (len(registrazioni), args.uscita))


def comando_uniformita(args):
    registrazioni, meta = dt.carica(args.sessione)
    d = dt.diamanti(registrazioni, args.diamanti, math.radians(args.offset))
    if len(d) < 20:
        raise SystemExit("servono almeno una ventina di spin con il diamante noto, "
                         "ce ne sono %d" % len(d))
    r = un.prova_uniformita(d, args.diamanti)
    print("ruota: %s" % (meta.get("ruota") or "senza nome"))
    print("spin: %d, attesi %.1f per casella" % (r["n"], r["attesi"]))
    print("conteggi: %s" % r["conteggi"])
    print("chi-quadro = %.2f (gl %d), p = %.4g, w di Cohen = %.3f"
          % (r["chi2"], r["gl"], r["p"], r["w_cohen"]))
    if r["avviso"]:
        print("AVVISO: %s" % r["avviso"])

    potenza = un.potenza_raggiunta(r["n"], r["w_cohen"], n_caselle=args.diamanti)
    print("potenza a questa dimensione d'effetto: %.2f" % potenza)
    if r["p"] >= 0.05:
        serve = un.spin_necessari(0.15, n_caselle=args.diamanti)
        print("NON significativo. Attenzione a come si legge: non vuol dire "
              "\"ruota in bolla\",\nvuol dire \"con questi spin non si vede\". "
              "Per una storta tenue (w=0,15)\nservirebbero circa %s spin." % serve)
    else:
        print("significativo.")

    print()
    print("per diamante (Holm su %d prove):" % args.diamanti)
    for e in un.diamante_dominante(d, args.diamanti):
        marca = " <-" if e["significativo"] else ""
        print("  %d: %4d spin  %5.1f%%  (IC95 %4.1f-%4.1f%%)  p=%.3g%s"
              % (e["diamante"], e["conteggio"], 100 * e["quota"],
                 100 * e["ic95"][0], 100 * e["ic95"][1], e["p_holm"], marca))

    print()
    for ampiezza in (1, 2, 3):
        try:
            v = un.validazione_holdout(d, seme=args.seme, n_caselle=args.diamanti,
                                       ampiezza_settore=ampiezza)
        except ValueError as errore:
            print("held-out: %s" % errore)
            break
        print("held-out, settore da %d diamante/i %s: %d/%d = %.1f%% "
              "(IC %.1f-%.1f%%) contro %.1f%% del caso -> %s"
              % (ampiezza, v["settore"], v["successi"], v["n_prova"], 100 * v["tasso"],
                 100 * v["ic95"][0], 100 * v["ic95"][1], 100 * v["caso"],
                 "batte il caso" if v["batte_il_caso"] else "NON batte il caso"))
    print()
    print("NOTA: un vantaggio sui DIAMANTI non e' un vantaggio sui NUMERI. Fra i due")
    print("ci sono la fase del rotore e il rimbalzo, che allargano la distribuzione")
    print("di parecchie caselle. Per il conto vero:  python -m boccia numeri %s"
          % args.sessione)


def comando_budget(args):
    registrazioni, meta = dt.carica(args.sessione)
    utili = [r for r in registrazioni if r.utilizzabile]
    if len(utili) < 10:
        raise SystemExit("servono almeno una decina di spin con la caduta misurata")
    M = _modello(args.modello)
    d = bg.diagnosi_soglia(utili, n_giri=args.giri, modello=M)
    print("ruota: %s  (%d spin)" % (meta.get("ruota") or "senza nome", d["n"]))
    print()
    print("soglia di caduta: omega_c = %.3f rad/s (%.2f giri/s)"
          % (d["omega_c"], d["omega_c"] / (2 * math.pi)))
    print("  si ripete a %.3f rad/s, cioe' il %.2f%%" % (d["sigma_omega_c"], 100 * d["cv"]))
    print("  decelerazione alla caduta: %.2f rad/s^2" % d["decelerazione"])
    print()
    print("settore di un ottavo: %.0f ms" % (1000 * bg.tempo_per_settore(d["omega_c"])))
    print(d["budget"].verdetto())
    print()
    for n_diamanti in (1, 2, 3):
        serve = bg.sigma_omega_c_richiesta(n_diamanti, d["omega_c"], d["decelerazione"])
        print("  per stare in %d diamante/i servirebbe una ripetibilita' di %.3f rad/s (%.2f%%)"
              % (n_diamanti, serve, 100 * serve / d["omega_c"]))
    print()
    try:
        r = bg.validazione_incrociata(utili, n_giri=args.giri, modello=M, seme=args.seme)
        print("validazione incrociata (calibrazione su %d spin, misura su %d):"
              % (r["n_calibrazione"], r["n"]))
        print("  bias %+.0f ms, sigma %.0f ms, |errore| al 90%% = %.0f ms"
              % (1000 * r["bias_t"], 1000 * r["sigma_t"], 1000 * r["p90_t"]))
        print("  " + r["budget"].verdetto())
        dichiarata = r["larghezza_dichiarata"]
        misurata = r["budget"].settori_a_1sigma
        if math.isfinite(dichiarata) and dichiarata < 0.7 * misurata:
            print("  ATTENZIONE: il metodo delta dichiara %.1f diamanti ma la misura "
                  "held-out ne da' %.1f.\n  Vale la seconda: il modello e' piu' "
                  "sicuro di se' di quanto meriti." % (dichiarata, misurata))
    except RuntimeError as errore:
        print("validazione incrociata non riuscita: %s" % errore)


def comando_finestra(args):
    registrazioni, meta = dt.carica(args.sessione)
    utili = [r for r in registrazioni if r.utilizzabile]
    if len(utili) < 40:
        raise SystemExit("servono almeno una quarantina di spin con la caduta "
                         "misurata, ce ne sono %d" % len(utili))
    M = _modello(args.modello)
    righe = bg.finestra_di_scommessa(utili, n_giri=args.giri, modello=M,
                                     n_settori=args.diamanti, seme=args.seme)
    if not righe:
        raise SystemExit("nessun anticipo valutabile: spin troppo corti?")
    print("ruota: %s  (%d spin)" % (meta.get("ruota") or "senza nome", len(utili)))
    print()
    print("ANTICIPO = fra l'ultimo dato utilizzabile e l'uscita dalla pista.")
    print("Comprende la chiusura anticipata delle scommesse E il tempo per")
    print("calcolare e piazzare: un secondo speso a puntare pesa come un")
    print("secondo di chiusura anticipata.")
    print()
    bg.stampa_finestra(righe)

    if args.rimbalzo > 0:
        print()
        print("Margine sui NUMERI, convertendo il settore previsto attraverso la fase")
        print("del rotore (%.1f giri/s) e il rimbalzo (%.0f caselle di sigma):"
              % (args.rotore, args.rimbalzo))
        print("  anticipo   dispersione totale   margine su %d numeri" % args.coperti)
        for r in righe:
            cat = nm.catena(r["scarto_diamanti"], r["sigma_t"], args.rotore,
                            args.rimbalzo, n_numeri=args.numeri,
                            coperti=(args.coperti,))
            print("  %6.1f s %14.2f caselle %+13.1f%%"
                  % (r["anticipo"], cat["dispersione_totale"],
                     100 * cat["righe"][0]["margine"]))
        print("  (pareggio a 0; il banco della roulette europea vale -2,7%)")

    print()
    limite = bg.anticipo_massimo(righe, margine=args.margine)
    if limite is None:
        print("NESSUN anticipo passa la soglia del %.0f%% sopra il caso." % (100 * (args.margine - 1)))
        print("Su questa ruota, con questa estrazione, non c'e' finestra utile:")
        print("non e' una questione di chiudere piu' tardi.")
        return
    riga = max((r for r in righe if r["anticipo"] <= limite), key=lambda r: r["anticipo"])
    print("ANTICIPO MASSIMO UTILE: %.1f s, cioe' circa %.1f giri di boccia."
          % (limite, riga["giri_residui"]))
    print("A quell'anticipo: %.1f%% sul diamante (caso %.1f%%), %.1f%% entro uno (caso %.1f%%)."
          % (100 * riga["p_diamante"], 100 * riga["caso_diamante"],
             100 * riga["p_entro_uno"], 100 * riga["caso_entro_uno"]))
    print()
    residuo = limite - args.posa
    if residuo <= 0:
        print("Tradotto in finestra di scommessa: NON CI SI STA. Con %.1f s per"
              % args.posa)
        print("calcolare e piazzare hai gia' consumato tutto l'anticipo utile, che")
        print("qui vale %.1f s. Le scommesse dovrebbero chiudere DOPO che la boccia" % limite)
        print("e' caduta, il che non succede.")
        print()
        print("Le sole vie d'uscita sono ridurre il tempo di posa - una puntata")
        print("sola su un settore invece di fiches sparse, o un'interfaccia che")
        print("non richieda le mani - oppure trovare una ruota che ripeta meglio,")
        print("che allunga l'anticipo utile. Chiudere piu' tardi non dipende da te.")
    else:
        durata = float(np.median([r.t_caduta for r in utili]))
        print("Tradotto in finestra di scommessa: se ci metti %.1f s a piazzare, le"
              % args.posa)
        print("puntate devono restare aperte fino ad almeno %.1f s prima che la" % residuo)
        print("boccia lasci la pista. Su uno spin da %.1f s - la mediana di questa"
              % durata)
        print("sessione - vuol dire tenerle aperte per il %.0f%% del volo."
              % (100 * (1 - residuo / durata)))
        print()
        print("E siccome la durata dello spin varia (qui da %.1f a %.1f s), una"
              % (min(r.t_caduta for r in utili), max(r.t_caduta for r in utili)))
        print("chiusura a orologio fisso da' anticipi diversi a ogni spin: una")
        print("parte sara' dentro la finestra e una parte no. Non e' un tavolo")
        print("dove si gioca ogni colpo, e' un tavolo dove si aspetta.")


def comando_numeri(args):
    registrazioni, meta = dt.carica(args.sessione)
    d = dt.diamanti(registrazioni, args.diamanti, math.radians(args.offset))
    if len(d) < 20:
        raise SystemExit("servono almeno una ventina di spin col diamante noto")
    quote = np.asarray(un.istogramma(d, args.diamanti), dtype=float)
    quote = quote / quote.sum()

    sigma_t = args.sigma_t / 1000.0 if args.sigma_t is not None else None
    if sigma_t is None:
        utili = [r for r in registrazioni if r.utilizzabile]
        if len(utili) < 10:
            raise SystemExit("senza --sigma-t servono almeno 10 spin con la caduta "
                             "misurata, per stimarla")
        r = bg.validazione_incrociata(utili, n_giri=args.giri, seme=args.seme)
        sigma_t = r["sigma_t"]
        print("sigma_t misurata sugli spin non visti: %.0f ms" % (1000 * sigma_t))

    print("distribuzione dei diamanti: %s"
          % " ".join("%.1f%%" % (100 * q) for q in quote))
    print()
    esito = nm.catena(quote, sigma_t, args.rotore, args.rimbalzo,
                      n_numeri=args.numeri)
    nm.stampa_catena(esito)
    print()
    print("Il rimbalzo e' assunto, non misurato: %.0f caselle di sigma. E' il termine"
          % args.rimbalzo)
    print("piu' grande di tutti e va misurato sulla ruota vera, annotando per una")
    print("cinquantina di spin il numero uscito e quello sotto il punto di contatto.")


def comando_stima(args):
    registrazioni, _ = dt.carica(args.sessione, solo_utilizzabili=False)
    M = _modello(args.modello)
    if args.omega_c is not None:
        omega_c, sigma_omega_c = args.omega_c, args.sigma_omega_c
    elif args.inclinazione is not None and args.raggio is not None:
        omega_c = mdl.omega_critica(args.inclinazione, args.raggio)
        sigma_omega_c = args.sigma_omega_c
        print("omega_c dalla geometria: %.3f rad/s. E' una prima "
              "approssimazione:\nappena hai una decina di spin con la caduta "
              "misurata, calibrala con `budget`." % omega_c)
    else:
        utili = [r for r in registrazioni if r.utilizzabile]
        if len(utili) < 5:
            raise SystemExit("senza --omega-c servono almeno 5 spin con la caduta "
                             "misurata, per calibrarla")
        omega_c, sigma_omega_c, n = bg.calibra_omega_c(utili, n_giri=args.giri, modello=M)
        print("omega_c calibrata su %d spin di questa stessa sessione: %.3f +- %.3f rad/s"
              % (n, omega_c, sigma_omega_c))
        print("(per un numero onesto, calibra su una sessione e misura su un'altra)")
    print()

    troppo_presto = 0
    for r in registrazioni:
        finestra = r.finestra(args.giri)
        if finestra.size < 3:
            print("%-28s troppo pochi passaggi" % r.sorgente)
            continue
        try:
            a = mdl.adatta(finestra, M, giri=r.giri_finestra(args.giri))
            pr = mdl.prevedi(a, omega_c, sigma_omega_c=sigma_omega_c,
                             angolo_tripwire=r.angolo_tripwire)
        except (ValueError, RuntimeError) as errore:
            print("%-28s non stimabile (%s)" % (r.sorgente, errore))
            continue
        larghezza = pr.larghezza_settori(args.diamanti)
        riga = ("%-28s caduta prevista %7.3f s (+-%3.0f ms), settore %d, "
                "largo %.1f diamanti" % (r.sorgente, pr.t_caduta, 1000 * pr.sigma_t,
                                         pr.settore(args.diamanti), larghezza))
        if math.isfinite(r.t_caduta):
            riga += "  | vera %.3f s, errore %+.0f ms" % (
                r.t_caduta, 1000 * (pr.t_caduta - r.t_caduta))
        if pr.giri_residui > bg.ANTICIPO_UTILE_GIRI:
            riga += "  [TROPPO PRESTO: %.1f giri residui]" % pr.giri_residui
            troppo_presto += 1
        print(riga)
    if troppo_presto:
        print()
        print("%d previsioni sono state fatte con piu' di %.1f giri di boccia davanti."
              % (troppo_presto, bg.ANTICIPO_UTILE_GIRI))
        print("A quell'anticipo la previsione vale il caso, misurato: vedi")
        print("`python -m boccia finestra`. Non e' una barra d'errore larga, e'")
        print("assenza di informazione, ed e' diverso.")


def comando_autotest(args):
    from . import autotest
    return autotest.esegui(pesante=args.pesante)


# ---------------------------------------------------------------- argomenti

def principale(argomenti=None):
    p = argparse.ArgumentParser(
        prog="python -m boccia",
        description="Settore di caduta della boccia: estrazione, modello, prove.")
    sub = p.add_subparsers(dest="comando", required=True)

    e = sub.add_parser("estrai", help="da uno o piu' video a una sessione JSON")
    e.add_argument("video", nargs="+")
    e.add_argument("--uscita", required=True)
    e.add_argument("--fps", type=float, default=None,
                   help="forza gli fps invece di leggerli dal file")
    e.add_argument("--tripwire", type=float, default=0.0,
                   help="angolo della semiretta fissa, in gradi (default 0)")
    e.add_argument("--inizio", type=int, default=0)
    e.add_argument("--fine", type=int, default=None)
    e.add_argument("--rotore", action="store_true", help="misura anche la fase del rotore")
    e.add_argument("--ruota", default="", help="nome della ruota, per ritrovarla dopo")
    e.set_defaults(funzione=comando_estrai)

    s = sub.add_parser("simula", help="genera una sessione finta per provare la catena")
    s.add_argument("--spin", type=int, default=300)
    s.add_argument("--uscita", required=True)
    s.add_argument("--seme", type=int, default=0)
    s.add_argument("--omega0", type=float, default=20.0)
    s.add_argument("--omega-c", type=float, default=9.0)
    s.add_argument("--sigma-omega-c", type=float, default=0.2)
    s.add_argument("--inclinazione", type=float, default=0.0,
                   help="quanto e' fuori bolla la ruota (0 = perfetta, 0.01 = 1%%)")
    s.add_argument("--angolo-inclinazione", type=float, default=115.0)
    s.add_argument("--jitter", type=float, default=2.0, help="rumore sui passaggi, in ms")
    s.add_argument("--dispersione", type=float, default=20.0,
                   help="dispersione fra distacco e contatto, in gradi")
    s.set_defaults(funzione=comando_simula)

    u = sub.add_parser("uniformita", help="la prova da fare per prima")
    u.add_argument("sessione")
    u.add_argument("--diamanti", type=int, default=8)
    u.add_argument("--numeri", type=int, default=37, help="numeri sulla ruota")
    u.add_argument("--offset", type=float, default=0.0,
                   help="sfasamento fra angolo di caduta e diamante, in gradi")
    u.add_argument("--seme", type=int, default=0)
    u.set_defaults(funzione=comando_uniformita)

    b = sub.add_parser("budget", help="quanto stretto puo' essere il settore")
    b.add_argument("sessione")
    b.add_argument("--giri", type=int, default=4)
    b.add_argument("--modello", default="lineare")
    b.add_argument("--seme", type=int, default=0)
    b.set_defaults(funzione=comando_budget)

    w = sub.add_parser("finestra", help="quanto deve restare aperta la scommessa")
    w.add_argument("sessione")
    w.add_argument("--giri", type=int, default=5)
    w.add_argument("--diamanti", type=int, default=8)
    w.add_argument("--modello", default="lineare")
    w.add_argument("--margine", type=float, default=1.3,
                   help="quanto deve battere il caso per contare (1.3 = +30%%)")
    w.add_argument("--posa", type=float, default=1.0,
                   help="secondi per calcolare e piazzare la puntata")
    w.add_argument("--rimbalzo", type=float, default=7.0,
                   help="dispersione del rimbalzo in caselle (0 per non stimare il margine)")
    w.add_argument("--rotore", type=float, default=0.6, help="velocita' del rotore, giri/s")
    w.add_argument("--coperti", type=int, default=5, help="numeri coperti dalla puntata")
    w.add_argument("--numeri", type=int, default=37)
    w.add_argument("--seme", type=int, default=0)
    w.set_defaults(funzione=comando_finestra)

    n = sub.add_parser("numeri", help="dal diamante al numero: cosa resta del vantaggio")
    n.add_argument("sessione")
    n.add_argument("--diamanti", type=int, default=8)
    n.add_argument("--numeri", type=int, default=37)
    n.add_argument("--offset", type=float, default=0.0)
    n.add_argument("--sigma-t", type=float, default=None,
                   help="errore sull'istante di caduta, in ms (se manca si misura)")
    n.add_argument("--rotore", type=float, default=0.6,
                   help="velocita' del rotore in giri/s")
    n.add_argument("--rimbalzo", type=float, default=7.0,
                   help="dispersione del rimbalzo, in caselle")
    n.add_argument("--giri", type=int, default=4)
    n.add_argument("--seme", type=int, default=0)
    n.set_defaults(funzione=comando_numeri)

    t = sub.add_parser("stima", help="la previsione, spin per spin")
    t.add_argument("sessione")
    t.add_argument("--giri", type=int, default=4)
    t.add_argument("--modello", default="lineare")
    t.add_argument("--diamanti", type=int, default=8)
    t.add_argument("--omega-c", type=float, default=None)
    t.add_argument("--sigma-omega-c", type=float, default=0.0)
    t.add_argument("--inclinazione", type=float, default=None,
                   help="inclinazione della banchina in gradi, per omega_c teorica")
    t.add_argument("--raggio", type=float, default=None, help="raggio della pista in metri")
    t.set_defaults(funzione=comando_stima)

    a = sub.add_parser("autotest", help="le verifiche")
    a.add_argument("--pesante", action="store_true",
                   help="include le prove sul video sintetico (lente)")
    a.set_defaults(funzione=comando_autotest)

    args = p.parse_args(argomenti)
    return args.funzione(args) or 0


if __name__ == "__main__":
    sys.exit(principale())
