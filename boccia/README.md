# Boccia — il settore di caduta

Prevedere in quale **ottavo di ruota** la boccia lascia la banchina, a partire
da un video. Non il numero: l'ottavo, e con quanta incertezza.

La buona notizia metodologica è che il settore di caduta vive nel **sistema
dello statore**. I diamanti sono fissi, quindi prevedere dove la boccia lascia
la pista dipende solo dalla dinamica della boccia: non c'è niente da
sincronizzare col rotore. È il più trattabile dei due sottoproblemi, e questo
pacchetto fa solo quello — più il conto, alla fine, di quanto poco basti.

Gira con `numpy`. OpenCV serve soltanto ad aprire i file video: tutta l'analisi
lavora su array, e infatti l'autotest la prova su fotogrammi sintetici senza
aprire niente.

---

## Il vincolo che decide tutto il progetto

La boccia lascia la pista quando la componente di gravità lungo la banchina
supera quella che la centrifuga riesce a bilanciare. In prima approssimazione
esiste una **velocità angolare critica** ω_c, costante per una data
combinazione ruota/boccia:

    ω_c ≈ √(g·tanθ / R)

e il problema si riduce a stimare ω(t) ed estrapolarla fino a ω_c. Da qui
discende l'unica formula che conta davvero, quella dell'errore:

    σ_t  =  √( (σ_ωc / |dω/dt|)²  +  σ_fit² )

I due termini **non sono della stessa specie**.

- `σ_fit` è l'errore di estrapolazione della curva. Migliora misurando meglio e
  osservando più giri. È quello su cui si è tentati di lavorare.
- `σ_ωc / |dω/dt|` è la soglia che **non si ripete uguale da uno spin
  all'altro** — usura della boccia, umidità, dove il croupier la lancia. Quella
  variabilità non sta nei dati dello spin in corso, quindi nessun fit la
  riduce. È un pavimento.

Con una banchina normale la decelerazione alla caduta vale circa 1,7 rad/s².
Quindi **l'1% di variazione su ω_c vale già 53 ms**, cioè più di mezzo diamante.
Misurato sulla simulazione, con 4 giri osservati e validazione su spin non
visti:

| σ_ωc (rad/s) | jitter sui passaggi | σ_t | diamanti a 1σ |
|---:|---:|---:|---:|
| 0,00 | 1 ms | 23 ms | 0,5 |
| 0,00 | 5 ms | 102 ms | 2,3 |
| 0,05 | 1 ms | 39 ms | 0,9 |
| 0,10 | 1 ms | 58 ms | 1,3 |
| 0,25 | 1 ms | 165 ms | 3,7 |
| 0,50 | 1 ms | 325 ms | 7,5 |

Un ottavo di ruota a 1,43 giri/s dura **87 ms**. Si legge tutto da lì:

- per centrare **un** diamante serve una ripetibilità di ω_c dello **0,85%**;
- per centrarne **tre**, del **2,6%**;
- una ruota che ripete al 3% dà un settore largo mezza ruota, e non c'è modello
  che la salvi.

È il motivo per cui la previsione onesta è «due o tre diamanti» e non uno. E il
motivo per cui **la seconda cosa da fare, dopo la prova di uniformità, è
misurare quanto si ripete ω_c** — non scrivere un modello migliore:

```
python -m boccia budget sessione.json
```

Servono solo gli ultimi tre attraversamenti di ogni spin e l'istante in cui la
boccia lascia la pista. Se la ripetibilità è del 3%, il resto del progetto è
già deciso.

> Attenzione a non misurare ω_c sull'**ultimo attraversamento** invece che
> sulla **caduta**: fra i due c'è una frazione di giro casuale, durante la quale
> ω cala di oltre un rad/s. Quella variabilità finta è più grande di quella
> vera, e farebbe scartare ruote buone.

---

## L'ordine giusto delle cose

1. **Uniformità** (`python -m boccia uniformita`). Costa un pomeriggio di video
   e un chi-quadro. Dice se su quella ruota c'è qualcosa da trovare.
2. **Budget** (`python -m boccia budget`). Dice quanto stretto può essere il
   settore, al massimo, su quella ruota.
3. **Finestra** (`python -m boccia finestra`). Dice quanto presto sei costretto
   a impegnarti, e se a quell'anticipo resta qualcosa. È il vincolo che non
   dipende da te: [vedi sotto](#quanto-deve-restare-aperta-la-scommessa).
4. **Stima** (`python -m boccia stima`). La previsione vera e propria: la parte
   che *sembra* il progetto, ed è l'ultima a servire.

I primi tre passi possono tutti concludersi con «no», e ognuno costa meno del
successivo. Il quarto è l'unico che assomiglia a un progetto di software, ed è
quello che ha meno probabilità di cambiare l'esito.

### La prova di uniformità

Estrai da N video il diamante di contatto, costruisci l'istogramma sugli 8,
confronta con l'uniforme via chi-quadro. Se l'istogramma è piatto, la ruota è
in bolla e nessun modello fisico ti salva. Se esce un **diamante dominante** —
tipicamente quello sul lato basso — hai trovato un'asimmetria meccanica, ed è
quella, non le equazioni, a fare il grosso del lavoro predittivo.

Quanti spin servono, davvero (potenza 0,80, α = 0,05, 8 caselle, calcolato col
chi-quadro non centrale invece che a occhio):

| storta | w di Cohen | spin necessari |
|---|---:|---:|
| tenue | 0,10 | 1436 |
| media | 0,15 | 638 |
| visibile a occhio | 0,20 | 359 |
| sfacciata | 0,30 | 160 |

I «200-300 spin» della regola pratica bastano per una storta marcata e **non**
bastano per una tenue — che è proprio il caso interessante, perché è quella che
nessuno ha ancora notato.

Tre difese contro l'autoinganno, tutte attive per default:

- **Correzione di Holm** sui test per diamante. Senza, su otto caselle e ruota
  perfetta, la probabilità di trovarne almeno una «significativa» al 5% è circa
  il 34%: si troverebbe un diamante dominante su una ruota su tre, tutte in
  bolla.
- **Potenza riportata** anche quando il test *non* è significativo. «p = 0,34»
  con potenza 0,25 non vuol dire «ruota in bolla», vuol dire «non ho guardato
  abbastanza». Sono due conclusioni diverse e vengono confuse di continuo.
- **Validazione held-out**: il settore si sceglie su metà degli spin e si misura
  sull'altra metà, con intervallo di Wilson. Scegliere il diamante guardando
  l'istogramma e poi misurarsi su quello stesso istogramma è misurarsi addosso.

L'autotest verifica il caso che conta: su 60 sessioni finte da ruota
perfettamente in bolla, la validazione held-out trova un «vantaggio» nel **2%**
dei casi. È la prova del falso positivo, e sarebbe l'errore più costoso
possibile: non si perde tempo, si perdono soldi.

---

## La fisica, e perché il modello più giusto perde

Tre modelli di decadimento:

| | equazione | parametri |
|---|---|---:|
| `lineare` | dω/dt = −α | 2 |
| `esponenziale` | dω/dt = −ω/τ | 2 |
| `misto` | dω/dt = −(a + b·ω) | 3 |

Il `misto` è il più giusto fisicamente — attrito volvente quasi costante più
resistenza dell'aria proporzionale alla velocità. Ma su 3-4 rivoluzioni il
terzo parametro non è sostenuto dai dati. Misurato, su spin generati proprio
con la legge `misto`, cioè dove il modello a tre parametri è *vero*:

| modello | giri osservati | bias | σ | diamanti a 1σ |
|---|---:|---:|---:|---:|
| lineare | 3 | +1 ms | 170 ms | 3,9 |
| lineare | 4 | −2 ms | **157 ms** | 3,6 |
| lineare | 6 | +5 ms | 151 ms | 3,4 |
| lineare | 8 | +7 ms | 149 ms | 3,3 |
| esponenziale | 4 | −1 ms | 185 ms | 4,3 |
| misto | 4 | +29 ms | **184 ms** | 4,2 |
| misto | 8 | +3 ms | 161 ms | 3,7 |

Il modello vero estrapola **peggio** di quello sbagliato, finché i giri sono
pochi: la varianza in più del terzo parametro costa più del bias che toglie. Si
riprende solo oltre gli otto giri. Il default è quindi `lineare`, e non per
pigrizia.

Si legge anche un'altra cosa: passare da 4 a 8 giri osservati guadagna **8 ms**
su 157. La curva è piatta perché il termine che domina non è il fit — è σ_ωc.

### Dove si fitta, e perché lì

La tentazione è stimare ω giro per giro (2π diviso il tempo di rivoluzione) e
fare una retta su quei punti. È nel codice come `stima_da_velocita`, e va detto
che come *punto stimato* se la cava benissimo: misurato, σ identica fino a 4
giri osservati (90 ms contro 90) e peggiore di circa il 10% oltre (59 ms contro
54 a 6 giri). Chi si aspettava un massacro resta deluso.

Il vantaggio vero sta altrove, e non si vede nel punto stimato: differenziare i
tempi amplifica il rumore e correla i residui di punti adiacenti, quindi da
quella strada **una barra d'errore credibile non esce**. Il fit sui tempi ne
produce una, ed è l'unica cosa che serve davvero, visto che l'intero progetto
consiste nel dire quanto è largo il settore.

Il fit primario lavora direttamente sugli **istanti di attraversamento**. Il
dato misurato è il tempo; l'angolo è esatto per costruzione (fra un passaggio e
il successivo sullo stesso tripwire ci sono esattamente 2π). Si inverte quindi
il modello — «a che ora il modello dice che la boccia arriva a questo angolo?»
— e si minimizzano i residui **in secondi**. Che è comodo due volte: è la forma
statisticamente corretta, e `σ_residuo` esce già nell'unità di misura del
budget.

La fase (l'angolo cumulato al primo passaggio) è un parametro libero. Senza, il
primo punto avrebbe residuo nullo per costruzione e le barre d'errore sarebbero
false.

---

## Estrarre i dati dal video

**La regola: non si insegue la boccia.** Il tracking fotogramma per fotogramma
di un oggetto piccolo, veloce e mosso è fragile, e quando si rompe lo fa in
silenzio. Qui la boccia si cerca in ogni fotogramma da zero e l'unica cosa che
si registra sono gli **istanti** in cui attraversa una semiretta radiale fissa.
Un fotogramma perso non propaga niente.

### Calibrazione: dalla traiettoria, non dal bordo

Fit di un'ellisse, poi raddrizzamento a cerchio. Ma l'ellisse da fittare **non**
è il bordo della ruota: è la **traiettoria della boccia stessa**. La boccia
percorre una circonferenza a raggio fisso finché sta sulla banchina, e quella è
esattamente la circonferenza che interessa. Vantaggi:

- è il cerchio giusto, non il bordo del mobile che sta su un altro piano;
- non serve nessun rilevamento di contorni, cioè la parte che si rompe quando
  cambia la luce;
- il raggio della pista viene 1 per costruzione, quindi la caduta si legge come
  «il raggio scende sotto 1» senza tarare soglie;
- i fotogrammi dopo la caduta si scartano da soli come outlier.

Il fit è quello di **Halíř–Flusser**, non quello di Fitzgibbon: il problema agli
autovalori generalizzato di Fitzgibbon richiede di invertire la matrice di
dispersione, che è *esattamente* singolare quando i punti stanno davvero su una
conica — cioè nel caso migliore. Con punti esatti fallisce; con punti rumorosi
no, il che lo rende un bug che si presenta solo nei test.

Il raddrizzamento è affine, quindi assume proiezione quasi ortografica. Sotto
prospettiva vera resta un errore angolare, e non è piccolo — misurato su
omografie vere, ruota da 52 cm di diametro:

| camera | errore angolare | in frazione di diamante |
|---|---:|---:|
| 4,0 m, inclinata 20° | 1,3° | 3% |
| 2,0 m, inclinata 38° | 4,6° | 10% |
| 1,0 m, inclinata 55° | 12,4° | 27% |
| 0,6 m, inclinata 65° | 23,6° | **52%** |

**Ma quell'errore colpisce una sola delle due cose che ci servono**, e la
distinzione è tutta la ragione per cui l'impianto regge:

- **sui tempi di attraversamento non ha alcun effetto.** La distorsione è una
  funzione fissa dell'angolo e il tripwire è una semiretta fissa: ogni passaggio
  avviene sempre allo stesso angolo *vero*, quindi fra un passaggio e il
  successivo ci sono esattamente 2π comunque. Misurato, la σ sui tempi resta
  sotto 0,2 ms da 20° a 65° di inclinazione. Il budget di precisione, che vive
  interamente sui tempi, è immune.
- **sull'angolo assoluto — cioè su *quale* diamante — colpisce eccome.** A 0,6 m
  vale mezzo diamante e spalma l'istogramma di uniformità.

Quindi: per il budget questa calibrazione basta sempre; per la prova di
uniformità o si tiene la camera alta e lontana, o si usa
`Calibrazione.da_punti_noti` sui quattro diamanti a 90°, che toglie il termine
del tutto (residuo misurato: 1e-13 gradi) e dà anche l'angolo assoluto — sul
video sintetico, caduta ricostruita a 267,8° contro i 267,3° veri.

> Con la calibrazione affine l'angolo è definito a meno di una rotazione
> globale: i diamanti risultano numerati a partire da uno arbitrario. Va bene,
> **purché la camera non si sposti fra uno spin e l'altro**. Se si sposta,
> sommare due sessioni mescola diamanti diversi.

### Sub-frame: il ritorno più alto per riga di codice

Interpolazione lineare fra i due fotogrammi che circondano il passaggio. A 60
fps la sola quantizzazione vale 16,7/√12 = 4,8 ms di σ. Misurato sulla catena
completa, su fotogrammi sintetici con mosso realistico:

| configurazione | σ sui passaggi | caduta: bias / σ |
|---|---:|---:|
| 2 m, 38°, posa 1/2 fotogramma | **0,10 ms** | −4,6 / 2,7 ms |
| idem, **senza** sub-frame | **6,98 ms** | −4,6 / 2,7 ms |
| idem, posa piena (più mosso) | 0,17 ms | −4,1 / 2,5 ms |
| idem, 30 fps | 0,16 ms | −9,2 / 7,5 ms |
| 4 m, 20° (quasi dall'alto) | 0,12 ms | −1,0 / 1,2 ms |
| 1 m, 55° (prospettiva forte) | 0,19 ms | −11,5 / 3,4 ms |
| 0,6 m, 65° (radente) | 0,18 ms | −13,2 / 18,5 ms |
| 2 m, 38°, rumore ×4 | 0,22 ms | −2,6 / 5,0 ms |

Il sub-frame vale un fattore **70**, non 5. E nella tavola A sopra è la
differenza fra 2,3 diamanti e mezzo diamante.

Il mosso quasi non conta, ed è una conseguenza sana: la scia è simmetrica
rispetto al centro dell'esposizione, quindi il baricentro cade dove la boccia
era a metà posa — che è proprio l'istante nominale del fotogramma.

> Questi numeri vengono da video **sintetici**. Un video vero ha in più:
> otturatore a scorrimento, artefatti di compressione, riflessi speculari sulla
> banchina, la mano del croupier. Prendi 0,1 ms come «il metodo non è il collo
> di bottiglia», non come la precisione che avrai.

### La caduta si legge sul raggio, con due cautele

L'uscita dalla pista è una discontinuità del **raggio**, non dell'angolo. Due
correzioni, entrambe nate da misure sbagliate:

1. **Soglia legata al rumore, non fissa.** Una soglia fissa al 4% funziona
   finché la ruota riempie l'inquadratura; quando è piccola il raggio
   ricostruito ondeggia già del 3% per conto suo e la soglia scatta a metà
   spin. Adesso è `max(4%, 6·MAD)`.
2. **Ginocchio, non attraversamento.** Il momento in cui la soglia viene
   superata è sistematicamente **tardi** — misurato, di 50-90 ms. Si fitta una
   retta sul tratto in discesa e si intercetta la linea di base. Il bias passa
   da +90 ms a −2 ms, e la σ da 61 ms a 1,2 ms.

In più si toglie dal raggio la parte che dipende **solo dall'angolo**
(`correggi_ondeggio`): prospettiva residua, centro dell'ellisse fuori di mezzo
pixel, boccia proiettata allungata. Essendo sistematiche sono una funzione
liscia dell'angolo, e una funzione liscia si stima e si sottrae. Conta perché
un ondeggio del 2,5% su una discesa che vale il 35% in un quarto di secondo
sposta il ginocchio di venti millisecondi, in un verso che cambia a ogni spin.

### Fase del rotore: il vincolo su fps che nessuno dice

Il rotore non serve per il settore di caduta — i diamanti sono fissi — ma serve
dopo, per passare dal diamante al numero. Si misura per **correlazione di
fase** sull'anello srotolato in profilo angolare: robusta, sub-pixel,
insensibile all'illuminazione.

C'è però una trappola. Il profilo è quasi periodico con periodo 2π/37 = 9,73°,
quindi la correlazione ha 37 picchi quasi uguali e lo zero verde li distingue
appena. Il massimo globale è quello vero **più un multiplo qualunque del passo
casella**. Ne esce un vincolo duro:

    spostamento per fotogramma < mezzo passo casella
    ⟹  fps > 74 × (giri/s del rotore)

Un rotore da 0,8 giri/s vuole almeno **59 fps**: a 30 fps la fase del rotore non
è recuperabile per correlazione, e non è un problema di codice ma di
campionamento. Il rimedio parziale è la finestra **inseguente**, centrata sullo
spostamento atteso invece che su zero: così il vincolo diventa «il rotore non
deve *accelerare* di mezzo passo per fotogramma», molto più facile. Ma il primo
passo parte al buio, e se si aggancia sbagliato ci resta: per questo
`fase_rotore` accetta `giri_al_secondo_attesi` e segnala l'aliasing invece di
restituire numeri belli e falsi.

---

## Dal diamante al numero: dove il vantaggio si perde

**Azzeccare il diamante non è azzeccare il numero**, e la distanza fra le due
cose è più grande di quanto sembri. In mezzo ci sono due passaggi:

1. **La fase del rotore.** Il diamante sta nello statore, i numeri girano. Un
   rotore da 0,6 giri/s con σ_t di 150 ms sbaglia 0,09 giri = **3,3 caselle**.
   È la stessa σ_t di prima, che si paga una seconda volta.
2. **Il rimbalzo.** La casella finale dista da quella sotto il punto di contatto
   di una quantità casuale, con dispersione tipica di **5-9 caselle**. È il
   termine più grande, e non dipende da niente che si possa misurare meglio.

Margine puntando 5 numeri, partendo da una ruota il cui diamante dominante
prende il 22,5% invece del 12,5% (`python -m boccia numeri`):

| | σ_t = 20 ms | 50 ms | 100 ms | 150 ms | 250 ms | 400 ms |
|---|---:|---:|---:|---:|---:|---:|
| rimbalzo 2 caselle | +55,4% | +53,5% | +48,1% | +42,0% | +29,9% | +15,9% |
| rimbalzo 4 caselle | +41,1% | +40,3% | +37,7% | +33,9% | +25,0% | +14,0% |
| **rimbalzo 7 caselle** | +24,2% | +23,8% | +22,7% | **+20,9%** | +16,5% | +10,3% |
| rimbalzo 10 caselle | +13,3% | +13,2% | +12,7% | +12,0% | +10,1% | +7,0% |
| rimbalzo 14 caselle | +6,2% | +6,1% | +6,0% | +5,7% | +5,0% | +3,8% |

Si legge di traverso, ed è il risultato più utile di tutto il pacchetto:
**portare σ_t da 150 ms a 20 ms vale un sesto; il rimbalzo vale un fattore
nove.** Cioè il tempo speso a perfezionare il modello fisico rende poco rispetto
al tempo speso a trovare una ruota con una storta marcata e un rimbalzo
stretto. Che è, detto in numeri, la stessa cosa che dice l'intuizione: è
l'asimmetria meccanica a fare il lavoro predittivo, non le equazioni.

Controllo di coerenza, attivo nell'autotest: con una ruota **uniforme** la
catena restituisce esattamente **−2,70%**, cioè il margine del banco della
roulette europea. Se non uscisse quello, tutto il resto della tavola sarebbe da
buttare.

---

## Quanto deve restare aperta la scommessa

C'è un secondo vincolo, indipendente dal primo e altrettanto duro: **quanto
presto sei costretto a impegnarti**. La variabile che conta non è «quanto prima
chiudono le puntate» né «quanto ci metti a piazzare», ma la loro somma:

    anticipo = (chiusura anticipata delle scommesse) + (tempo per calcolare e piazzare)

cioè il tempo fra **l'ultimo dato utilizzabile** e l'uscita della boccia dalla
pista. Un secondo speso a piazzare le fiches pesa esattamente quanto un secondo
di chiusura anticipata — e questo si misura, non si assume.

Misurato su spin simulati (ruota che ripete all'1,7%, estrazione buona, ω_c
calibrata su metà degli spin *per quell'anticipo* e misurata sull'altra metà):

| anticipo | giri di boccia | σ_t | settore | P(diamante) | P(entro uno) |
|---:|---:|---:|---:|---:|---:|
| 0,5 s | 1,2 | 102 ms | 2,3 | **36,2%** | **80,9%** |
| 1,0 s | 2,1 | 112 ms | 2,5 | 28,0% | 76,0% |
| 1,5 s | 2,9 | 122 ms | 2,7 | 26,4% | 70,2% |
| 2,0 s | 3,9 | 151 ms | 3,3 | 18,2% | 50,9% |
| 2,5 s | 4,8 | 195 ms | 4,2 | 14,7% | 42,0% |
| 3,0 s | 5,9 | 236 ms | 5,0 | 12,0% | 38,7% |
| 4,0 s | 8,2 | 361 ms | 7,2 | 13,1% | 37,8% |
| 5,0 s | 10,9 | 519 ms | 9,6 | 13,8% | 38,9% |

Caso: 12,5% il diamante esatto, 37,5% entro uno. Si legge una soglia netta:

> **Il valore di riferimento: l'anticipo massimo utile è ~2 secondi, cioè circa
> 4 giri di boccia. Sotto i 2 secondi la previsione diventa buona; oltre i 3
> l'informazione è finita** — e non «peggiorata», proprio finita: la riga a 5
> secondi è indistinguibile dal caso, e la σ di 519 ms su un settore da 87
> significa che l'angolo previsto è uniforme sulla ruota.

Notare che oltre i 3 secondi **la qualità della ruota non conta più**: su una
ruota tipica (2,8%) la riga a 0,5 s dà 25,8% e quella a 3 s dà 12,4%, cioè lo
stesso esito della ruota buona. Vicino alla caduta domina σ_ωc; lontano domina
l'estrapolazione, e quella è uguale per tutti.

### Tradotto in finestra di scommessa

Se ci metti **1 secondo** a calcolare e piazzare, l'ultimo dato utile è 1
secondo prima della chiusura, quindi le puntate devono restare aperte fino a
**circa 1 secondo prima che la boccia lasci la pista**. Su uno spin da 8,7 s
sono gli ultimi **~90% del volo**: chiudere a metà spin rende la previsione
esattamente inutile.

Il tempo di posa entra in pieno nel bilancio, e se ne mangia una fetta enorme:

| tempo per piazzare | P(diamante), impegno a 1 giro residuo |
|---:|---:|
| 0,5 s | 27,8% |
| 1,0 s | 23,8% |
| 2,0 s | 13,2% |
| 3,0 s | 14,0% |

**A 2 secondi di posa è già tutto finito**, qualunque sia la ruota. Il che
sposta la priorità in un posto inatteso: ridurre il gesto — una puntata sola su
un settore invece di fiches sparse su numeri singoli — vale più che migliorare
il modello.

### Allargare il settore non compra tempo

Sembra ovvio che rinunciare alla risoluzione — «non mi serve il numero, mi
basta un settore» — permetta di impegnarsi prima. **Misurato, non è vero:**

| anticipo | 1 diamante (caso 12,5%) | 3 diamanti (caso 37,5%) | 5 diamanti (caso 62,5%) |
|---:|---:|---:|---:|
| 0,5 s | 36,3% — ×2,91 | 81,2% — ×2,16 | 96,0% — ×1,54 |
| 1,2 s | 27,0% — ×2,16 | 71,3% — ×1,90 | 90,8% — ×1,45 |
| 2,0 s | 18,2% — ×1,45 | 51,8% — ×1,38 | 78,0% — ×1,25 |
| 3,0 s | 12,0% — ×0,96 | 36,8% — ×0,98 | 65,7% — ×1,05 |

Il tasso assoluto sale col settore, ma il **moltiplicatore sul caso** scende, e
il moltiplicatore è quello che paga: un settore da 5 diamanti ha un tetto di
×1,6 perché il caso è già 62,5%. Le tre colonne muoiono allo stesso anticipo.
Allargare il settore compra *probabilità*, non *tempo*.

### Il tempo minimo, con mezzo secondo per piazzare

Il conto che conta davvero non è la probabilità sul diamante ma il **margine
sui numeri**, cioè il settore previsto fatto passare attraverso la fase del
rotore e il rimbalzo. Con `t_posa = 0,5 s`, rotore a 0,6 giri/s, ruota che
ripete all'1,7%:

| rimbalzo | margine positivo fino a | sopra +20% fino a | ⟹ chiusura al più |
|---|---:|---:|---|
| 5 caselle | 3,2 s di anticipo | 2,2 s | 2,7 s / **1,7 s** prima della caduta |
| 7 caselle | 3,2 s | 2,0 s | 2,7 s / **1,5 s** prima della caduta |
| 10 caselle | 2,6 s | 1,5 s | 2,1 s / **1,0 s** prima della caduta |

> **Risposta secca.** Con mezzo secondo per piazzare, le puntate devono restare
> aperte fino a **~1,5 s prima che la boccia lasci la pista** perché resti un
> margine che si possa davvero usare. A 2,5 s prima si è già al pareggio, cioè
> a niente. Su uno spin da 8,7 s vuol dire una finestra di **~7,2 s, l'83% del
> volo**.

Il pareggio non è un obiettivo: a +5% di margine servono **9900 spin** per
distinguerlo dallo zero, a +10% ne servono 2600. Solo da **+20% in su** (692
spin) il vantaggio è dimostrabile in un tempo umano — ed è esattamente la
colonna «sopra +20%» della tabella.

**La regola osservabile**, che non richiede di sapere in anticipo quando cadrà
la boccia: l'ultimo giro che riesci a cronometrare deve durare almeno

| anticipo | giri residui | durata dell'ultimo giro |
|---:|---:|---:|
| 1,2 s | 1,9 | 546 ms |
| 2,0 s | 3,4 | **488 ms** |
| 2,9 s | 5,3 | 434 ms |

Cioè: **se l'ultimo giro che hai potuto misurare è più veloce di ~490 ms, salta
lo spin.** È un criterio che si applica dal vivo, senza conoscere la caduta.

```
python -m boccia finestra sessione.json --posa 0.5 --rimbalzo 7
```


### La durata dello spin varia, quindi non si gioca ogni colpo

Il croupier chiude a orologio, non a giri residui, e la durata dello spin varia
parecchio (nella simulazione: mediana 8,7 s, da 6,6 a 12,4). La stessa chiusura
dà quindi anticipi diversi a ogni colpo:

| chiusura dal lancio | spin con anticipo ≤ 2 s | ≤ 3 s | già caduta |
|---:|---:|---:|---:|
| 6,0 s | 2% | 26% | 0% |
| 7,0 s | 24% | 56% | 2% |
| 7,5 s | **32%** | 62% | 11% |
| 8,0 s | 32% | 57% | 26% |
| 8,5 s | 30% | 46% | 43% |

Nel migliore dei casi **circa un terzo degli spin** cade dentro la finestra
utile; spostare la chiusura più avanti non aiuta, perché cresce la quota di
spin in cui la boccia è già caduta. Non è un tavolo dove si gioca ogni colpo: è
un tavolo dove si aspetta il colpo giusto, e la selezione va decisa *prima* di
vedere il risultato, se no si torna a misurarsi addosso.

```
python -m boccia finestra sessione.json --posa 0.5 --rimbalzo 7
```

Dal vivo l'istante di caduta non si conosce, quindi il cancello non è
l'anticipo ma **i giri residui che il modello stesso stima**: `stima` segnala
`[TROPPO PRESTO]` sopra i 3,5 giri. È lo stesso fit a dire se è ancora presto
per fidarsi di sé.

---

## Cosa questo non può vedere

- **Il rimbalzo, che è il termine dominante.** Qui è un parametro che si assume,
  non una misura. Va misurato sulla ruota vera, annotando per una cinquantina di
  spin il numero uscito e quello sotto il punto di contatto.
- **Le ruote che cambiano.** ω_c dipende da umidità, usura, dalla boccia che il
  croupier sceglie. Una calibrazione di ieri sera non vale stasera: va rifatta
  per sessione, ed è il motivo per cui il modello empirico a due parametri batte
  la derivazione dai principi primi.
- **Il croupier che varia il lancio.** Tutto il conto assume che la boccia entri
  sulla banchina in modo confrontabile da uno spin all'altro.
- **La banchina vera.** La formula di ω_c assume boccia puntiforme su superficie
  conica liscia. Una boccia vera rotola (parte dell'energia sta nella rotazione
  propria), la banchina vera è incurvata, il distacco avviene su un arco. Serve
  a sapere l'ordine di grandezza; il numero da usare è quello empirico.
- **Se la ruota è in bolla.** Allora non c'è niente da trovare, e nessuna delle
  cose qui sopra cambia quel fatto.
- **Quando chiude il croupier.** La finestra di scommessa è l'unico vincolo del
  progetto su cui non si può lavorare: o è abbastanza lunga o non lo è. Tutto
  quello che si può fare da questo lato è ridurre il proprio tempo di posa, che
  entra nel bilancio allo stesso titolo.

---

## Come si usa

```
pip install numpy
pip install opencv-python-headless      # solo per leggere i file video

python -m boccia autotest               # le verifiche (93, tutte verdi)
python -m boccia autotest --pesante     # include la catena su video sintetico

# provare la catena senza avere video
python -m boccia simula --spin 400 --inclinazione 0.012 --uscita sessione.json

# dai video veri
python -m boccia estrai video/*.mp4 --uscita sessione.json --tripwire 0

# nell'ordine giusto
python -m boccia uniformita sessione.json
python -m boccia budget sessione.json
python -m boccia finestra sessione.json --posa 0.5 --rimbalzo 7
python -m boccia numeri sessione.json --rimbalzo 7
python -m boccia stima sessione.json --giri 4
```

I file della sessione sono JSON piatti e leggibili: si guardano a mano quando un
numero non torna, e si tengono per mesi mentre il codice cambia.

### I moduli

| file | cosa c'è |
|---|---|
| `statistica.py` | chi-quadro, chi-quadro non centrale, binomiale, Wilson — senza scipy |
| `modello.py` | i tre modelli di decadimento, Levenberg-Marquardt, ω_c, previsione |
| `budget.py` | budget di precisione, bootstrap, held-out, finestra di scommessa |
| `uniformita.py` | chi-quadro sugli 8 diamanti, potenza, Holm, validazione |
| `numeri.py` | dal diamante al numero: fase del rotore, rimbalzo, margine |
| `video.py` | calibrazione, tripwire, sub-frame, caduta, fase del rotore |
| `sintetico.py` | spin e video finti, ruota inclinata simulata come inclinata davvero |
| `dati.py` | le registrazioni su disco |
| `autotest.py` | le verifiche |

---

## Note

**Sulla simulazione.** La ruota storta non è simulata truccando le probabilità
dei diamanti: è simulata **inclinando la ruota**, il che rende ω_c funzione
dell'angolo, e il diamante dominante viene fuori da solo. È l'unico modo per
sapere se la prova di uniformità vede quello che deve vedere, invece di vedere
quello che le è stato messo davanti.

**Sull'uso.** In molte giurisdizioni usare un dispositivo per calcolare le
probabilità di un gioco d'azzardo mentre lo si gioca è un reato — per esempio
NRS 465.075 in Nevada, o la sezione 42 del Gambling Act 2005 nel Regno Unito — e
i casinò lo vietano comunque, indipendentemente dalla legge locale. Quanto sopra
descrive analisi di video registrati.

---

## Fonti

- Small M, Tse CK (2012). *Predicting the outcome of roulette.* Chaos 22, 033150
  — il lavoro di riferimento sulla dinamica e sui limiti di predicibilità
- Halíř R, Flusser J (1998). *Numerically stable direct least squares fitting of
  ellipses.* Proc. WSCG — il fit dell'ellisse usato qui
- Fitzgibbon A, Pilu M, Fisher R (1999). *Direct least square fitting of
  ellipses.* IEEE PAMI 21(5) — la versione originale, e il suo problema
- Reddy BS, Chatterji BN (1996). *An FFT-based technique for translation,
  rotation and scale-invariant image registration.* IEEE Trans. Image Processing
  5(8) — la correlazione di fase
- Hartley R, Zisserman A (2003). *Multiple View Geometry in Computer Vision*, 2ª
  ed. — DLT, omografie, e l'ambiguità di una conica isolata
- Press WH et al. *Numerical Recipes*, cap. 6 — serie e frazione continua per la
  gamma incompleta
- Cohen J (1988). *Statistical Power Analysis for the Behavioral Sciences*, 2ª
  ed. — il w e il calcolo di potenza
- Holm S (1979). *A simple sequentially rejective multiple test procedure.*
  Scandinavian Journal of Statistics 6 — la correzione sui diamanti
- Wilson EB (1927). *Probable inference, the law of succession, and statistical
  inference.* JASA 22 — l'intervallo su una proporzione
