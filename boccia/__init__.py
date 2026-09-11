"""Settore di caduta della boccia: estrazione dal video, modello, prove.

Vedi boccia/README.md. In breve, l'ordine giusto delle cose:

    1. uniformita   c'e' qualcosa da trovare su questa ruota?
    2. budget       quanto stretto puo' essere il settore, al massimo?
    3. stima        la previsione vera e propria

Le prime due costano poco e decidono se la terza ha senso.
"""
__all__ = ["statistica", "modello", "budget", "uniformita", "sintetico",
           "video", "dati", "autotest"]
