# Profilo

Una batteria di questionari di autovalutazione, letta come **dimensioni
continue** invece che come etichette. Copre personalità normale, umore,
attivazione, esperienze insolite e ansia — cioè anche il terreno su cui stanno
schizofrenia e disturbo bipolare, ma senza pretendere di diagnosticarli.

Gira nel browser, anche dal telefono. Le risposte restano sul dispositivo.

---

## Il vincolo che decide tutto il progetto

**Un questionario autosomministrato non può diagnosticare una psicosi o un
disturbo bipolare.** Non è prudenza da avvocato: è aritmetica.

Le meta-analisi danno all'MDQ una specificità del 70%. Prendi mille persone
della popolazione generale, dove la prevalenza dello spettro bipolare è circa
il 2%:

| | persone | sopra soglia |
|---|---|---|
| hanno davvero il disturbo | 20 | 16 |
| non ce l'hanno | 980 | 294 |
| **totale sopra soglia** | | **310** |

Su 310 segnalati, 16 sono veri. **Il 95% dei positivi è falso.** Un test che
stampasse "bipolare" su quello schermo mentirebbe a quasi trecento persone su
trecentodieci.

Lo stesso MDQ, con la stessa soglia, in un reparto di psichiatria dove la
prevalenza è del 40%, ha un valore predittivo del 64%. Stesso strumento,
significato opposto. Non è un cavillo statistico: è *il* significato del
risultato, e senza di esso il numero è disinformazione anche quando è calcolato
bene.

Da qui discende tutto il resto:

- **Nessuna etichetta.** Assi continui, con l'errore di misura disegnato
  addosso come banda invece che nascosto in una nota.
- **Ogni segnalazione porta il proprio valore predittivo**, con il conto
  apribile per esteso.
- **Nessuna schermata dice mai che va tutto bene.** Sotto soglia significa che
  questo strumento, che vede poco, non ha visto — non che non ci sia niente. Il
  silenzio di un rilevatore incompleto vale come veto, mai come affermazione.
- **Se i controlli di validità cadono, il profilo non si mostra.** Meglio niente
  che un profilo credibile e falso.

**Non è utilizzabile** per idoneità al lavoro, selezione del personale o
certificazioni mediche di qualunque genere.

---

## Come si usa

### Dal telefono, la via semplice

È pubblicato su GitHub Pages con un certificato vero:

```
https://protsky.github.io/profilo/
```

Aprilo nel browser del telefono e **installalo**: su Android compare il pulsante
«Installa l'app», su iPhone si fa con **Condividi → Aggiungi a Home**. Diventa
un'icona come qualunque altra app, si apre a schermo intero e funziona senza rete.

Installarlo non è una comodità estetica. **Safari cancella i dati dei siti non
usati per sette giorni**, e un test da 226 domande lo si fa in più sedute: se
resta una scheda del browser, le risposte a metà strada possono sparire da sole.
I dati di un'app aggiunta alla Home no. Dove il browser lo permette, l'app chiede
anche la «persistenza» dell'archiviazione, che rende i dati non sfrattabili.

Le risposte restano **sul telefono**, nel browser. L'hosting consegna i file e
basta: non riceve niente, non c'è nessun account, nessun server che sappia che
hai fatto il test. Rovescio della medaglia: da un altro dispositivo le risposte
non ci sono, e se svuoti i dati del browser spariscono. Per portarle via c'è
l'esportazione in JSON alla fine.

Si aggiorna con un `git push`: la novità si vede dalla seconda apertura.

### In locale

Serve solo Python (niente Node, niente installazioni).

```bash
python serve.py --http
```

Si apre su `http://localhost:8443` (con `--port=8080` cambi porta). Per usarlo **dal telefono** sulla stessa
rete serve https, perché i browser fanno gli schizzinosi con localStorage su
indirizzi di rete in chiaro:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 825 -keyout certs/key.pem -out certs/cert.pem -subj "//CN=profilo" -addext "subjectAltName=IP:192.168.1.119,IP:127.0.0.1,DNS:localhost" -addext "basicConstraints=critical,CA:true"
```

(metti il tuo IP al posto di `192.168.1.119`), poi:

```bash
python serve.py
```

Il browser avviserà che il certificato non è riconosciuto: è normale per uno
fatto in casa. «Mostra dettagli» → «Visita il sito».

Le verifiche interne stanno su `/selftest.html`.

---

## Dove finiscono i dati

Nel `localStorage` del browser, e da nessun'altra parte.

`serve.py` consegna file e basta: `do_POST` risponde 405 e non esiste nessuna
rotta che riceva dati. Si può staccare la rete a metà test senza che cambi
niente. Rovescio della medaglia: se svuoti i dati del browser le risposte
spariscono, e da un altro dispositivo non ci sono. Per portarle via c'è
l'esportazione in JSON.

---

## I progressi, e come portarli via

### Non si perde niente a metà strada

Il salvataggio avviene a **ogni singola risposta**, non a fine blocco. Se il
telefono si spegne, la batteria muore o il browser uccide la scheda, quello che
hai risposto è già scritto: alla riapertura compare una fascia «Ripreso da dove
eri: N domande su M» e il test riparte dalla prima domanda senza risposta. La
fascia resta finché non rispondi davvero — a tempo non andava bene, chi riapre
dopo due giorni sta ancora capendo dov'era rimasto.

Se il salvataggio **fallisce** (navigazione privata, spazio esaurito) compare una
fascia rossa che resta lì. Prima l'errore finiva solo in console, dove non guarda
nessuno: e si continuava a rispondere per mezz'ora credendo di salvare.

### Tre formati, per tre usi diversi

Alla fine del profilo:

| Formato | A cosa serve |
|---|---|
| **JSON completo** | Tutto: risposte, testo delle domande, punteggi, indici di validità, soglie, fonti e licenze. Si descrive da sé: si rianalizza mesi dopo, con uno script, **senza avere questa app sotto mano**. È anche l'unico file che si può **rimettere dentro** dalla pagina iniziale — per passare a un altro dispositivo o tornare indietro dopo aver svuotato il browser. |
| **CSV, una riga per domanda** | Il formato lungo che vogliono pandas e R: `id_item, strumento, scala, invertito, testo_it, testo_en, risposta_grezza, valore_corretto, disagio, tempo_ms, provenienza`. La colonna `valore_corretto` ha già l'inversione applicata, quindi si ricalcola tutto da zero senza rifare la chiave. |
| **CSV, una riga per scala** | I punteggi già fatti, con banda d'errore, soglia e se è stata superata. Per un grafico veloce. |

I CSV seguono RFC 4180 (virgola, virgolette doppie raddoppiate): pandas e R li
leggono senza opzioni. Excel in italiano potrebbe volere il punto e virgola —
questi file nascono per gli altri due.

Una prova del selftest esporta, rilegge e **confronta**: il JSON deve rientrare
identico, e la colonna `valore_corretto` del CSV deve coincidere con il conto
fatto a mano su tutti e 46 gli item invertiti.

---

## Gli strumenti

Sei moduli, tredici strumenti. La numerazione salta il 3 perché quel modulo
era il B-HiTOP, che è rimasto fuori: vedi «Cosa non c'è, e perché».

| # | Scala | Item | Licenza | Provenienza |
|---|---|---|---|---|
| 1 | **BFAS** — dieci aspetti dei Big Five | 100 | dominio pubblico (IPIP) | trascritti dalla Table 4 del paper |
| 2 | **PID-5-BF** — i cinque tratti DSM-5/ICD-11 | 25 | APA, libero non commerciale | **ricostruito** |
| 5 | **PHQ-9** — umore depresso | 9 | nessun copyright dal 2010 | forma nota |
| 5 | **ASRM** — attivazione dell'ultima settimana | 5 | libero uso | forma nota |
| 5 | **MDQ** — episodi di attivazione nella vita | 13 + 2 | libero non commerciale | forma nota |
| 4 | **PQ-16** — esperienze insolite | 16 | libero di ricerca | **ricostruito** |
| 6 | **GAD-7** — ansia | 7 | nessun copyright dal 2010 | forma nota |
| 6 | **ASRS-5** — attenzione e irrequietezza | 6 | OMS, libero | forma nota |
| 6 | **AQ-10** — stile percettivo e sociale | 10 | libero non commerciale | forma nota |
| 6 | **PC-PTSD-5** — dopo un evento difficile | 1 + 5 | dominio pubblico (VA) | forma nota |
| 6 | **AUDIT-C** — alcol | 3 | libero (OMS) | forma nota |
| 6 | **ISI** — come dormi | 7 | libero personale e di ricerca | forma nota |
| 7 | **WHODAS 2.0** — funzionamento | 12 | OMS, con attribuzione | forma nota |

Più 4 controlli di attenzione e la domanda diretta sul rischio: **fino a 226
domande**, circa 50 minuti, interrompibili alla fine di ogni blocco. Sei domande
sono condizionali — la Q2 dell'MDQ e le cinque sul dopo-evento — e non vengono
poste quando non hanno oggetto, quindi chi non ha avuto un evento difficile ne
vede 220.

Il modulo 6 non è un contorno. Ansia, ADHD, stile autistico, trauma, alcol e
sonno **imitano tutti mania e psicosi**, e sono la spiegazione alternativa che
i test online saltano sempre. Il modulo 7 è la riga che separa un tratto da un
disturbo: senza compromissione non c'è disturbo, e il WHODAS è l'unico
strumento della batteria senza soglia proprio perché non serve a segnalare, ma
a dare peso a tutto il resto.

### Cosa vuol dire «ricostruito»

Il testo degli item di **PQ-16** e **PID-5-BF** è stato formulato a memoria e
**non** confrontato con la fonte primaria. L'app lo dichiara in tre punti — sulla
mappa dei moduli, sopra le domande, e accanto al risultato — e tratta quel
punteggio come indicazione, non come misura. Prima di dargli peso, vanno
confrontati con la fonte (materiale supplementare di Ising et al. 2012; scheda
APA delle misure di valutazione emergenti del DSM-5).

Del PID-5 **esiste** una versione italiana validata e standardizzata su 2143
adulti (Fossati, Borroni, Somma), ma è pubblicata da Raffaello Cortina ed è
commerciale: i suoi item non si possono riprodurre qui. Se il PID-5 serve sul
serio, è quella la versione da usare, con le sue norme — non questa.

### Cosa non c'è, e perché

- **B-HiTOP** (45 item, HiTOP Consortium 2025). Era il pezzo più aggiornato del
  piano ed è l'unico rimasto fuori del tutto: **gli item non sono pubblicati.**
  Il technical paper e la scheda del consorzio danno struttura, spettri e
  affidabilità (α da .82 a .90) ma non le domande. Scriverle a memoria vorrebbe
  dire inventare uno strumento del 2025 e poi chiamarlo col suo nome, che è
  peggio che non averlo. L'idea che porta — il terreno psicotico come dimensione
  continua invece che come categoria — è comunque nella batteria, attraverso il
  dominio **Psicoticismo** del PID-5.
- **CAPE-42, SPQ-BR, HCL-32.** Ricostruirli avrebbe aggiunto un centinaio di
  item di fedeltà bassa a fronte di poco guadagno: il PQ-16 copre già il
  versante positivo delle esperienze insolite, MDQ e ASRM coprono l'attivazione
  da due angoli diversi (storia di vita e stato attuale). Tre strumenti
  ricostruiti in più avrebbero abbassato il valore medio della batteria invece
  di alzarlo.
- **I sintomi negativi** restano il buco più grosso della batteria — e non per
  caso: sono esattamente ciò che chi li ha tende a non riferire di sé, quindi
  nessun autoquestionario li prende bene. Sta scritto anche in fondo al profilo.

Le traduzioni italiane sono tutte nostre e nessuna è validata. Chi vuole
rispondere sulla versione su cui i numeri sono stati calcolati può passare
all'inglese dalle impostazioni, o tenere l'originale visibile sotto ogni
domanda.

### Un errore trovato per strada

Il PDF del BFAS che gira in rete
(`goodmedicine.org.uk/media/files/assessment, big 5 aspects.pdf`) alterna le
italiche in modo meccanico e **marca come invertiti tre item che nel paper non
lo sono**:

| aspetto | item | loading nel paper |
|---|---|---|
| Volatilità 10 | *Can be stirred up easily* | **+.70** |
| Cortesia 5 | *Avoid imposing my will on others* | **+.42** |
| Cortesia 6 | *Rarely put people under pressure* | **+.48** |

Quei tre hanno il footnote (a): erano invertiti nel campione ESCS e sono stati
ri-orientati nella versione finale. Chi copia da quel PDF calcola male
Volatilità e Cortesia. Qui vale la Table 4 del paper originale, e il selftest
verifica ogni singolo item contro quella chiave: 100 item, 46 invertiti.

---

## Le tre condizioni dell'MDQ

L'MDQ **non** è «conta i sì e vedi se sono almeno sette». È positivo solo se
valgono tutte e tre insieme:

1. almeno 7 sì sui 13 sintomi
2. diversi sintomi presenti **nello stesso periodo**
3. i sintomi hanno causato un problema **moderato o serio**

I siti che chiedono solo i 13 sintomi producono falsi positivi a valanga,
perché «mi è capitato di dormire poco» e «mi è capitato di essere irritabile»
in due anni diversi non sono un episodio: sono la vita. La condizione 3 è
l'altra metà — un tratto senza compromissione non è un disturbo.

Il profilo mostra le tre condizioni una per una, con quale è mancata.

---

## Come si leggono i punteggi

**Somme, non IRT.** I parametri IRT di queste scale non sono pubblicati.
Inventarli darebbe numeri dall'aria più precisa e dal contenuto peggiore.

**Percentili solo dove c'è una norma vera.** `js/norme.js` è quasi vuoto, ed è
una scelta: per queste scale le medie e deviazioni standard o non sono
pubbliche, o vengono da campioni (studenti americani, pazienti olandesi) che non
dicono granché a un adulto in Ticino. Un percentile inventato è peggio di uno
assente — assente si vede, inventato no. Dove manca, l'app mostra il punteggio
grezzo sul suo intervallo e **scrive che la norma manca**. Se trovi una norma
pubblicata, il file spiega come aggiungerla e i percentili compaiono da soli.

Il BFAS viene quindi letto in **profilo relativo**: i dieci aspetti confrontati
fra loro, dentro la stessa persona. Non ha bisogno di nessuna norma esterna per
essere vero, e non pretende di dire dove stai nella popolazione.

**Bande, non punti.** Ogni punteggio arriva con `SEM = DS × √(1−ω)` e banda
`± 1.96 × SEM`. Due scale le cui bande si sovrappongono non vengono confrontate:
«sei più ansioso che depresso» con bande sovrapposte è rumore raccontato come
struttura.

---

## Gli indici di validità

Sette, perché la letteratura 2023-2025 è concorde che uno solo non basta:
ciascuno pesca respondenti diversi.

Risposte identiche di fila · coerenza fra le due metà di ogni scala · coppie di
domande quasi identiche · 4 controlli di attenzione · tempo per domanda · uso
della scala · peso combinato.

Verdetto a tre livelli: **attendibile**, **da prendere con cautela**,
**non interpretabile**. Nell'ultimo caso il profilo non viene disegnato affatto.

### Una cosa che non c'è, e perché

Il piano prevedeva anche la **distanza di Mahalanobis**, che è l'indice più
citato per il careless responding. Non c'è, e non per dimenticanza: Mahalanobis
misura quanto il pattern di una persona è anomalo rispetto alla *matrice di
covarianza del campione*. Con un solo rispondente non esiste nessun campione e
nessuna covarianza da stimare — la distanza sarebbe zero per costruzione.
Implementarlo qui vorrebbe dire mettere un indice che non misura niente e fa
sembrare la validazione più solida di com'è.

---

## Il percorso di sicurezza

Se una risposta indica pensieri di morte o di farsi del male — la domanda
diretta all'inizio, oppure l'item 9 del PHQ-9 — il test si ferma e mostra i
contatti **prima di calcolare qualunque punteggio**.

| | | |
|---|---|---|
| **143** | Telefono Amico | 24h, anonimo |
| **144** | Urgenza sanitaria | smista al picchetto psichiatrico |
| **091 611 48 28** | Picchetto psichiatrico cantonale | 18-08 feriali, festivi h24 |
| **0848 062 062** | Contact center OSC | orari d'ufficio, per appuntamenti |
| **112** | Emergenza | numero unico europeo |

Contatti verificati su www4.ti.ch (DSS) e OSC, agosto 2026.

La pagina sta su un indirizzo pubblico e può aprirla chiunque, da qualunque
paese: quattro di questi cinque numeri rispondono solo in Svizzera, e un numero
che non risponde nel momento sbagliato è peggio di nessun numero. Per questo
sotto ogni elenco di contatti — in home, durante il test e nel referto — c'è
scritto da dove valgono, con il 112 europeo come ripiego.

`js/sicurezza.js` contiene anche l'elenco `MAI_DIRE`: le frasi che questa app
non deve mai produrre («tutto a posto», «nessun rischio», «sei sano», «risulti
negativo»…). Il selftest le cerca dentro un referto completo generato davvero:
se qualcuno un giorno ne aggiunge una, la prova cade prima che la veda un
utente.

---

## Le verifiche

`/selftest.html`. Le prove **guidano l'interfaccia vera** dentro un iframe,
cliccando i bottoni reali sulle pagine reali — niente stato infilato a mano in
localStorage per far partire il codice da metà strada, che è il modo in cui i
bug arrivano in fondo con la suite verde.

Quindici prove, tutte verdi sulla batteria intera da 226 item.

| Prova | Cosa deve succedere |
|---|---|
| Inversione item per item | 100 item, 46 invertiti, ogni conversione giusta contro la Table 4 |
| MDQ, tre condizioni | 5 casi limite, positivo solo quando valgono tutte e tre |
| Risposta di rischio | schermata di sicurezza **prima** di qualunque punteggio |
| PHQ-9 item 9 sopra zero | il test si ferma al momento giusto |
| Tutto al minimo | profilo rifiutato |
| Tutto al massimo | profilo rifiutato |
| Punteggi BFAS | uguali a un conto scritto a parte nel file di prova |
| Interrotto e ripreso | stesse risposte e stessi punteggi di un giro intero |
| Domande condizionali | non poste, e il referto le distingue da un punteggio basso |
| Compilazione attenta | il protocollo risulta attendibile, nessun indice segnala |
| Lessico del referto | nessuna frase vietata nel testo generato |
| Norme | nessun percentile senza norma, e il referto lo dichiara |
| Valore predittivo | ogni segnalazione arriva col suo conto |
| Esportazione | il JSON rientra identico, il CSV ha i valori già raddrizzati |

### Tre bug trovati dalle prove, non a occhio

**Il long-string contava anche i sì/no.** La prima versione contava come
«risposte identiche di fila» qualunque sequenza uguale, PQ-16 compreso. Ma
rispondere «No» a sedici domande su voci e allucinazioni non è disattenzione:
è la risposta più comune e più sana che ci sia. Così com'era, l'indice avrebbe
rifiutato il profilo **proprio alle persone che stanno bene** — l'errore
opposto a quello per cui esiste. Adesso conta solo gli item a scala larga, e un
questionario sì/no in mezzo spezza la catena invece di allungarla.

**Il ridisegno delle condizionali perdeva risposte.** Quando una risposta apre
o chiude altre domande il blocco viene ridisegnato, e da quel momento i nodi
presi prima sono staccati dal documento. La prova «interrotto e ripreso» è
uscita con due risposte di scarto fra un giro e l'altro, che è esattamente il
genere di differenza che a occhio non si vede.

**Il salvataggio d'uscita resuscitava le sessioni cancellate.** Aggiungendo il
salvataggio su `pagehide` — quello che protegge i progressi quando il telefono
chiude la pagina — si è introdotto un bug: l'evento scatta anche mentre la
pagina se ne va *perché la sessione è appena stata cancellata*, e riscriveva in
memoria quello che era appena stato buttato via. In pratica «cancella tutto e
ricomincia» non cancellava niente. Quattro prove sono diventate rosse nello
stesso momento, tutte per questa causa.

Nessuno dei tre sarebbe emerso da una suite che prepara lo stato a mano: il
primo richiede di compilare davvero un questionario sì/no dall'inizio alla fine,
il secondo di cliccare sui bottoni veri mentre la pagina si ridisegna sotto, il
terzo di navigare via da una pagina vera dopo aver svuotato l'archivio.

---

## Cosa questo test non può vedere

Sta scritto anche in fondo al profilo, perché è la parte che conta:

- **La psicosi con scarso insight.** Chi la sta attraversando spesso non la vive
  come strana, quindi le domande non la agganciano.
- **I sintomi negativi** — appiattimento, ritiro, perdita di spinta: esattamente
  le cose che chi le ha tende a non riferire di sé.
- **Gli stati misti**, che l'autovalutazione separa male.
- **L'effetto di sostanze, farmaci e mancanza di sonno**, che imitano sia la
  mania sia la psicosi.
- **Tutto quello che è cambiato dopo.** Sono le risposte di un pomeriggio, non
  una proprietà di chi le ha date.

---

## Altro in questo repository

`boccia/` non c'entra niente con i questionari: è un pacchetto Python a sé, sul
settore di caduta della boccia della roulette a partire da un video — modello
fisico, estrazione dai fotogrammi, prova di uniformità sui diamanti. Condivide
però l'idea di fondo, che è misurare l'incertezza invece di nasconderla: vedi
[`boccia/README.md`](boccia/README.md).

---

## Fonti

- DeYoung CG, Quilty LC, Peterson JB (2007). *Between facets and domains: 10 aspects of the Big Five.* J Pers Soc Psychol 93(5), 880-896 — [Table 4, chiave del BFAS](https://www.jordanbpeterson.com/docs/230/2014/15DeYoung.pdf)
- Haehner P, Krämer MD, Bleidorn W, Hopwood CJ (2025). [*Validating the BFAS and the Short Form (BFAS-40) in German, French, and Italian*](https://journals.sagepub.com/doi/10.1177/27000710251391609) — N=4492 adulti svizzeri
- Kroenke K, Spitzer RL, Williams JBW (2001). *PHQ-9.* J Gen Intern Med 16(9) — [accesso libero](https://www.phqscreeners.com/select-screener)
- Spitzer RL et al. (2006). *GAD-7.* Arch Intern Med 166(10), 1092-1097
- Altman EG et al. (1997). *The Altman Self-Rating Mania Scale.* Biol Psychiatry 42(10), 948-955
- Hirschfeld RMA et al. (2000). *MDQ.* Am J Psychiatry 157(11), 1873-1875
- Ising HK et al. (2012). [*The validity of the PQ-16*](https://pubmed.ncbi.nlm.nih.gov/22516147/). Schizophr Bull 38(6), 1288-1296
- [*Critical Overview of Screening Tools for Detecting Bipolar Disorders*](https://pmc.ncbi.nlm.nih.gov/articles/PMC12538600/) (2025) — la fonte del problema del valore predittivo
- [*HCL-32 vs MDQ, meta-analisi*](https://www.sciencedirect.com/science/article/abs/pii/S0165178118320183), Psychiatry Res (2019)
- [*State of the Science: HiTOP*](https://pubmed.ncbi.nlm.nih.gov/39443056/), Behavior Therapy (2024)
- [`careless`](https://cran.r-project.org/web//packages/careless/careless.pdf) e [Jones et al. (2023)](https://doi.org/10.1177/01466216231194358) sugli indici di careless responding
- [Contatti utili, Cantone Ticino](https://www4.ti.ch/dss/dsp/depressione/contatti-utili/contatti-e-link-utili/) · [OSC](https://www4.ti.ch/dss/dsp/osc/chi-siamo/servizio-di-psichiatria-e-di-psicologia-medica)
