"""Genera le icone PNG dell'app a partire dal disegno di icon.svg.

Il motivo e' quello del progetto: non un punto, una banda. Due righe, ognuna
con il binario grigio, la banda d'errore azzurra e la tacca bianca del
punteggio - la stessa cosa che si vede accanto a ogni scala del referto.

    python genera-icone.py

Si disegna a 4x e si rimpicciolisce: e' il modo piu' semplice per avere i bordi
morbidi senza dipendere da un rasterizzatore SVG (cairosvg qui non c'e').

Servono tre formati diversi, e non e' pignoleria:
  icon-192 / icon-512   Android e il manifest, sfondo compreso
  icon-180              apple-touch-icon: iOS applica la SUA maschera, quindi
                        l'immagine deve arrivare fino al bordo senza angoli
                        arrotondati, se no si vedono due arrotondamenti
  icon-512-maskable     Android puo' ritagliare l'icona in cerchio, rombo o
                        goccia a seconda del telefono: il contenuto deve stare
                        dentro l'80% centrale, o il ritaglio mangia la tacca
"""
from PIL import Image, ImageDraw

FONDO = (16, 19, 26, 255)       # --fondo
BINARIO = (42, 50, 64, 255)     # --bordo
BANDA = (110, 168, 254, 255)    # --accento
TACCA = (230, 233, 239, 255)    # --testo

SU = 4  # si disegna quattro volte piu' grandi e poi si riduce


def disegna(lato, raggio_rel=0.22, scala_contenuto=1.0, sfondo=True):
    """Un'icona quadrata di `lato` pixel.

    raggio_rel      angolo arrotondato, in frazione del lato (0 = quadrato)
    scala_contenuto quanto rimpicciolire il disegno dentro la tela; serve per
                    la versione maskable, dove il ritaglio puo' essere molto
                    aggressivo
    """
    L = lato * SU
    img = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if sfondo:
        if raggio_rel > 0:
            d.rounded_rectangle([0, 0, L - 1, L - 1], radius=int(L * raggio_rel), fill=FONDO)
        else:
            d.rectangle([0, 0, L - 1, L - 1], fill=FONDO)

    # Il disegno originale e' pensato su una griglia di 64 unita'.
    u = (L / 64.0) * scala_contenuto
    off = (L - 64 * u) / 2.0  # ricentra quando il contenuto e' rimpicciolito

    def rett(x, y, w, h, colore, r=0):
        box = [off + x * u, off + y * u, off + (x + w) * u, off + (y + h) * u]
        if r:
            d.rounded_rectangle(box, radius=r * u, fill=colore)
        else:
            d.rectangle(box, fill=colore)

    def banda(colore, alfa):
        return colore[:3] + (int(255 * alfa),)

    # riga 1: banda larga, tacca al centro
    rett(8, 17, 48, 4, BINARIO, r=2)
    rett(14, 13, 26, 12, banda(BANDA, 0.60), r=6)
    rett(26, 9, 2, 20, TACCA)

    # riga 2: banda piu' stretta, tacca spostata a destra
    rett(8, 37, 48, 4, BINARIO, r=2)
    rett(26, 33, 22, 12, banda(BANDA, 0.60), r=6)
    rett(39, 29, 2, 20, TACCA)

    return img.resize((lato, lato), Image.LANCZOS)


def salva(img, nome, opaca=False):
    if opaca:
        # apple-touch-icon non deve avere trasparenza: iOS la renderebbe nera.
        piatta = Image.new("RGB", img.size, FONDO[:3])
        piatta.paste(img, mask=img.split()[3])
        piatta.save(nome, "PNG", optimize=True)
    else:
        img.save(nome, "PNG", optimize=True)
    print("  " + nome)


if __name__ == "__main__":
    print("icone generate:")
    salva(disegna(192), "icon-192.png")
    salva(disegna(512), "icon-512.png")
    # iOS mette la sua maschera: niente angoli nostri, niente trasparenza.
    salva(disegna(180, raggio_rel=0), "icon-180.png", opaca=True)
    # Android ritaglia: il contenuto sta nell'80% centrale, lo sfondo riempie tutto.
    salva(disegna(512, raggio_rel=0, scala_contenuto=0.72), "icon-512-maskable.png")
