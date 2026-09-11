"""Le registrazioni su disco: un JSON per sessione, uno spin per riga logica.

Formato deliberatamente piatto e leggibile: questi file si guardano a mano
quando un numero non torna, e si tengono per mesi mentre il resto del codice
cambia. Un pickle o un array binario sarebbero piu' comodi oggi e illeggibili
fra sei mesi.

Il campo `sorgente` non e' burocrazia: quando una sessione da' risultati strani
la prima domanda e' sempre "da quale video viene questo spin", e senza quel
campo la risposta non c'e' piu'.
"""
import json
import math
from pathlib import Path

import numpy as np

DUE_PI = 2.0 * math.pi


class Registrazione:
    """Uno spin misurato. Stessa interfaccia degli Spin sintetici.

    Cosi' `budget` e `uniformita` non sanno - e non devono sapere - se stanno
    lavorando su dati veri o su una simulazione: le stesse funzioni servono a
    provare il codice e ad analizzare la serata.
    """

    def __init__(self, tempi, t_caduta, giri=None, angolo_caduta=None, diamante=None,
                 sorgente="", angolo_tripwire=0.0, note=None):
        self.tempi = np.asarray(tempi, dtype=float)
        self.giri = (np.arange(self.tempi.size) if giri is None
                     else np.asarray(giri, dtype=int))
        self.t_caduta = float(t_caduta) if t_caduta is not None else float("nan")
        self.angolo_caduta = (float(angolo_caduta) if angolo_caduta is not None
                              else float("nan"))
        self.diamante = diamante
        self.sorgente = sorgente
        self.angolo_tripwire = float(angolo_tripwire)
        self.note = list(note or [])

    @property
    def utilizzabile(self):
        return self.tempi.size >= 3 and math.isfinite(self.t_caduta)

    def finestra(self, n_giri, anticipo=0):
        fine = self.tempi.size - anticipo
        return self.tempi[max(0, fine - n_giri):fine]

    def giri_finestra(self, n_giri, anticipo=0):
        """Gli indici di giro corrispondenti, da passare a `modello.adatta`."""
        fine = self.giri.size - anticipo
        g = self.giri[max(0, fine - n_giri):fine]
        return g - g[0] if g.size else g

    def diamante_da_angolo(self, n_diamanti=8, offset=0.0):
        if not math.isfinite(self.angolo_caduta):
            return None
        return int(math.floor(((self.angolo_caduta - offset) % DUE_PI)
                              / (DUE_PI / n_diamanti))) % n_diamanti

    def a_dizionario(self):
        return {
            "sorgente": self.sorgente,
            "tempi": self.tempi.tolist(),
            "giri": self.giri.tolist(),
            "t_caduta": None if not math.isfinite(self.t_caduta) else self.t_caduta,
            "angolo_caduta": (None if not math.isfinite(self.angolo_caduta)
                              else self.angolo_caduta),
            "diamante": self.diamante,
            "angolo_tripwire": self.angolo_tripwire,
            "note": self.note,
        }

    @classmethod
    def da_dizionario(cls, d):
        return cls(d["tempi"], d.get("t_caduta"), giri=d.get("giri"),
                   angolo_caduta=d.get("angolo_caduta"), diamante=d.get("diamante"),
                   sorgente=d.get("sorgente", ""),
                   angolo_tripwire=d.get("angolo_tripwire", 0.0),
                   note=d.get("note"))

    @classmethod
    def da_estrazione(cls, estrazione, sorgente=""):
        """Dall'uscita di `video.estrai` a una registrazione."""
        return cls(estrazione["tempi"], estrazione.get("t_caduta"),
                   giri=estrazione.get("giri"),
                   angolo_caduta=estrazione.get("angolo_caduta"),
                   sorgente=sorgente or estrazione.get("sorgente", ""),
                   angolo_tripwire=estrazione.get("angolo_tripwire", 0.0),
                   note=estrazione.get("avvisi"))

    def __repr__(self):
        return "<Registrazione %s: %d passaggi, caduta %.3f s>" % (
            self.sorgente or "?", self.tempi.size, self.t_caduta)


def salva(percorso, registrazioni, ruota="", note=""):
    dati = {
        "formato": "boccia/1",
        "ruota": ruota,
        "note": note,
        "spin": [r.a_dizionario() for r in registrazioni],
    }
    Path(percorso).write_text(json.dumps(dati, indent=1, ensure_ascii=False), encoding="utf-8")
    return percorso


def carica(percorso, solo_utilizzabili=True):
    dati = json.loads(Path(percorso).read_text(encoding="utf-8"))
    if dati.get("formato") != "boccia/1":
        raise ValueError("carica: formato sconosciuto (%r)" % dati.get("formato"))
    spin = [Registrazione.da_dizionario(d) for d in dati["spin"]]
    if solo_utilizzabili:
        scartati = [r for r in spin if not r.utilizzabile]
        spin = [r for r in spin if r.utilizzabile]
        if scartati:
            print("carica: %d spin scartati (meno di 3 passaggi o caduta mancante)"
                  % len(scartati))
    return spin, dati


def diamanti(registrazioni, n_diamanti=8, offset=0.0):
    """L'elenco dei diamanti di contatto, per la prova di uniformita'.

    Usa il campo `diamante` se c'e' (annotato a mano guardando il video), se no
    lo ricava dall'angolo di caduta. I due non sono la stessa cosa: fra il
    distacco e il contatto col diamante la boccia percorre un pezzo di pista in
    discesa, quindi l'angolo di caduta e' spostato all'indietro rispetto al
    diamante colpito, di una quantita' che dipende dalla ruota. Con `offset` si
    rimette in fase una volta per tutte, confrontando su una ventina di spin
    annotati a mano.
    """
    esito = []
    for r in registrazioni:
        d = r.diamante if r.diamante is not None else r.diamante_da_angolo(n_diamanti, offset)
        if d is not None:
            esito.append(int(d))
    return esito
