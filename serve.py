"""Server https locale per usare il profilo anche dal telefono.

I browser danno localStorage e service worker senza storie su localhost, ma da
un indirizzo di rete in http diventano schizzinosi. Questo script serve la
cartella in https con un certificato autofirmato.

    python serve.py

Poi dal telefono, sulla stessa rete wi-fi:  https://<ip-che-stampa>:8443
Il browser avvisera' che il certificato non e' riconosciuto: e' normale per un
certificato fatto in casa. "Mostra dettagli" -> "Visita il sito".

Questo server CONSEGNA E BASTA. Non ha nessuna rotta che riceva dati: le
risposte restano nel localStorage del browser e non passano mai di qui. E' una
scelta, non una dimenticanza - vedi js/storage.js.
"""
import http.server
import mimetypes
import socket
import ssl
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CERT = ROOT / "certs" / "cert.pem"
KEY = ROOT / "certs" / "key.pem"
PORT = 8443

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("text/markdown", ".md")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # In sviluppo la cache nasconde le modifiche appena fatte.
        self.send_header("Cache-Control", "no-store")
        # Niente CORS aperto: qui non c'e' nessun ponte da aprire a nessuno.
        super().end_headers()

    def do_POST(self):
        # Detto esplicitamente: non si ricevono dati. Se un giorno qualcuno
        # aggiunge una rotta di raccolta, dovra' cancellare questa riga e
        # accorgersi di cosa sta facendo.
        self.send_error(405, "Questo server non riceve dati")

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


def local_ip():
    """Indirizzo con cui questo computer si presenta sulla rete locale."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("192.168.1.1", 1))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def main():
    plain = "--http" in sys.argv
    port = PORT
    for arg in sys.argv[1:]:
        if arg.startswith("--port="):
            port = int(arg.split("=", 1)[1])

    if plain:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
        print(f"\n  Profilo (senza cifratura) su http://localhost:{port}")
        print("  Va bene per provare qui; dal telefono serve https.\n")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            server.shutdown()
        return

    if not CERT.exists() or not KEY.exists():
        sys.exit(
            f"Certificato mancante in {CERT.parent}.\nGeneralo con:\n"
            "  openssl req -x509 -newkey rsa:2048 -nodes -days 825 "
            "-keyout certs/key.pem -out certs/cert.pem "
            '-subj "//CN=profilo" '
            '-addext "subjectAltName=IP:<il-tuo-ip>,IP:127.0.0.1,DNS:localhost" '
            '-addext "basicConstraints=critical,CA:true"'
            "\n\nOppure prova subito qui sul computer, senza certificato:\n"
            "  python serve.py --http"
        )

    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=CERT, keyfile=KEY)

    server = http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler)
    server.socket = context.wrap_socket(server.socket, server_side=True)

    ip = local_ip()
    print("\n  Profilo in ascolto")
    print(f"    dal telefono:       https://{ip}:{port}")
    print(f"    da questo computer: https://localhost:{port}")
    print(f"    verifiche interne:  https://localhost:{port}/selftest.html")
    print("\n  Le risposte restano sul dispositivo: questo server non le riceve.")
    print("  Ctrl+C per fermare.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Fermato.")
        server.shutdown()


if __name__ == "__main__":
    main()
