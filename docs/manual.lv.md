# Lietotāja rokasgrāmata

Ceļvedis Tērpu inventāra pārvaldības lietotnes (Dress Asset Management)
lietošanai — lietotne, ko jūsu kolektīvs izmanto, lai sekotu līdzi kopīgi
lietotiem tērpiem, redzētu, kam kas ir rokā, un pieprasītu vai nodotu
priekšmetus tālāk.

Šī rokasgrāmata paredzēta ikdienas lietotājiem, administratoriem un
superadministratoriem. Ja izvietojat savu lietotnes instanci, skatiet
[installation.md](installation.md).

## 1. Lomas

Katram dalībniekam ir loma **katrā grupā atsevišķi**:

- **Pievienotājs (Joiner)** — sākotnējā loma ikvienam, kas pievienojas caur
  ielūguma saiti. Var redzēt tikai savu Profila lapu — neko citu —, kamēr
  administrators nepiešķir īstu lomu.
- **Lietotājs (User)** — var pārlūkot katalogu, pieprasīt priekšmetus un
  komplektus, pievienot komentārus un skatīt vēsturi. Var arī nodot tālāk
  priekšmetu, kas šobrīd ir viņa rokās vai īpašumā, citam cilvēkam.
- **Administrators (Admin)** — viss, ko var Lietotājs, kā arī kataloga
  pārvaldība (kategorijas, produkti, priekšmeti, komplekti), grupas un
  tiešā priekšmeta turētāja/īpašnieka maiņa.
- **Superadministrators (Superadmin)** — viss, ko var Administrators, kā
  arī dalībnieku lomu pārvaldība un jaunu grupu izveide.

## 2. Pierakstīšanās un pievienošanās

1. Atveriet lietotnes tīmekļa adresi un pierakstieties ar Google kontu.
2. **Veidojat jaunu organizāciju pirmo reizi?** Jums tiks piedāvāts izveidot
   organizāciju (Subscription) un pirmo grupu — jūs kļūsiet par tās
   superadministratoru.
3. **Pievienojaties esošai organizācijai?** Administrators atsūtīs jums
   ielūguma saiti (`.../join/<id>`). Pierakstieties, atveriet saiti, un
   jūs tiksiet pievienots kā **Pievienotājs (Joiner)** visās šīs
   organizācijas grupās. Jūs varēsiet redzēt tikai savu Profila lapu,
   kamēr administrators jūs nepaaugstinās uz īstu lomu Dalībnieku
   (Members) lapā — kamēr gaidāt, aizpildiet savu profilu (vārdu, dzimumu,
   izmērus).

## 3. Grupas

**Grupa** ir jūsu organizācijas iedalījums — piemēram, vecuma grupas, tādas
kā *Senioru*, *Jauniešu* un *Vidējās paaudzes* grupa. Katra kategorija,
produkts, priekšmets un komplekts pieder tieši vienai grupai.

- Sānjoslā atveriet **Groups (Grupas)**, lai redzētu esošās grupas.
- Superadministratori var nospiest **Add Group (Pievienot grupu)**, lai
  izveidotu jaunu (nosaukums + neobligāts apraksts). Izveidojot grupu, jūs
  automātiski kļūstat par tās superadministratoru.
- Administratori/superadministratori piesaista dalībniekus grupām (un
  superadministratori vai organizācijas īpašnieks nosaka viņu lomu katrā no tām, tostarp Pievienotāja lomu) **Members
  (Dalībnieki)** lapā.

## 4. Jūsu profils

Atveriet **Profile (Profils)**, lai iestatītu:

- **Profila attēls** — pēc augšupielādes tas saglabājas uzreiz. Pārējās profila izmaiņas saglabājiet ar **Save Changes (Saglabāt izmaiņas)**.

- **Dzimums (Gender)** — Vīrietis vai Sieviete. Izmanto, lai pieprasot
  komplektus, jums piemeklētu atbilstošus priekšmetus, kā arī lai noteiktu,
  kurām kategorijām zemāk redzēsiet izmēra lauku.
- **Izmērs katrai kategorijai** — kurpju izmērs un kleitas izmērs nav viena
  un tā pati skala, tāpēc katrai kategorijai norādāt savu izmēru (piem.,
  "Kleita: M", "Kurpes: 42"). Redzamas tikai tās kategorijas, kas atzīmētas
  kā "Unisex", vai kas atbilst jūsu dzimumam — ja saraksts šķiet tukšs,
  vispirms iestatiet dzimumu augstāk. Iestatiet izmēru pirms komplekta, kas
  ietver šo kategoriju, pieprasīšanas — pretējā gadījumā pieprasījums
  neizdosies ar skaidru kļūdas paziņojumu, kurā norādīts, kāda izmēra trūkst.

## 5. Kataloga veidošana (Administrators/Superadministrators)

Katalogs veidots pēc principa **Kategorija → Produkts → Priekšmets**, kā
arī **Komplekti**:

- **Kategorijas (Categories)** — plaši iedalījumi, piem., "Kleita",
  "Kurpes", "Bikses". Katrai ir dzimums (Vīrietis/Sieviete/Unisex), kas
  nosaka, kuru dalībnieku Profilā tā rādās kā izmēra lauks (skat. "Jūsu
  profils" augstāk).
- **Produkti (Products)** — konkrēts variants kategorijas ietvaros, piem.,
  "Sarkans ziedu raksta svārki". Tam ir dzimums un var būt fotoattēls.
- **Priekšmeti (Items)** — reāli fiziski gabali, kas jums pieder, piem.,
  trīs "Sarkans ziedu raksta svārki" priekšmeti izmēros S/M/L. Katram
  priekšmetam ir izmērs, stāvoklis, neobligāta RFID birkas ID, neobligāts
  apraksts, un tas pieder vienai grupai.
- **Komplekti (Kits)** — nosaukts konkrētu produktu kopums, kas kopā veido
  pilnu tērpu (piem., "Kāzu tērps A" = konkrēta kleita + konkrētas kurpes).
  Dalībnieki pieprasa visu komplektu uzreiz; sistēma automātiski atrod
  pieejamu katra nepieciešamā produkta priekšmetu pieprasītāja izmērā un
  dzimumā.

Katrai kategorijai, produktam, priekšmetam un komplektam, to izveidojot,
jāpiešķir **grupa**.

Vienu produktu un tā fiziskos priekšmetus var izmantot vairāku komplektu definīcijās. Komplekts apraksta vajadzīgos produktus un nav pastāvīgi piesaistīts konkrētiem priekšmetiem — citam komplektam nav jāveido dublēts inventārs.

## 6. Pārlūkošana un meklēšana (Dashboard)

**Dashboard (Panelis)** rāda jūsu organizācijas priekšmetu sarakstu ar
filtriem augšpusē:

- **Search (Meklēt)** — meklē pēc produkta nosaukuma.
- **Category (Kategorija)** / **Product (Produkts)** — Produkta izvēlne
  sašaurinās tikai uz izvēlētās kategorijas produktiem; mainot kategoriju,
  produkta izvēle tiek notīrīta, ja tā vairs neatbilst.
- **Holder (Turētājs)** / **Owner (Īpašnieks)** — izvēlieties konkrētu
  personu (vai "Storage" turētājam), lai redzētu tikai viņa priekšmetus.
  **Turētāja filtrs pēc noklusējuma ir jūs pats**, atverot Paneli — tas
  vispirms parāda "kas man ir rokās?" — notīriet to, lai pārlūkotu visu
  dalībnieku priekšmetus.

Katra priekšmeta kartīte īsumā rāda izmēru, dzimumu un pašreizējo turētāju;
noklikšķiniet uz tās, lai atvērtu detalizēto lapu.

## 7. Priekšmeta vai komplekta pieprasīšana

- Atveriet **Items (Priekšmeti)** un izvēlieties vēlamo priekšmetu. Ja tas
  jau nav pie jums, nospiediet **Request Transfer (Pieprasīt nodošanu)**
  (vai **Request from Storage (Pieprasīt no noliktavas)**, ja to šobrīd
  neviens netur). Tas nosūta pieprasījumu tam, kura rokās priekšmets
  šobrīd atrodas (vai administratoram) apstiprināšanai.
- Atveriet **Kits (Komplekti)** un nospiediet **Request Kit (Pieprasīt
  komplektu)**, lai vienā reizē pieprasītu visu tērpu. Sistēma automātiski
  izvēlas pa vienam pieejamam priekšmetam katram nepieciešamajam
  produktam, kas atbilst jūsu izmēram un dzimumam.
- Savu pieprasījumu statusu un jums adresētos pieprasījumus skatiet un
  apstrādājiet sānjoslas sadaļā **Transfers (Nodošanas)**.

Vairāki gaidoši pieprasījumi drīkst attiekties uz vienu priekšmetu, arī dažādu komplektu pieprasījumos. Pieprasījums to nerezervē. Pirmā apstiprinātā nodošana saņem priekšmetu; pārējie gaidošie pieprasījumi šim priekšmetam tiek automātiski noraidīti. Savu pieprasījumu statusu un atcelšanu atradīsiet Transfers (Nodošanas) → My requests and offers (Mani pieprasījumi un piedāvājumi).

## 8. Priekšmeta nodošana citam

Priekšmets no viena cilvēka pie cita var nonākt divos veidos:

1. **Kāds pieprasa to no jums** (skat. iepriekš) — tas parādās jūsu
   **Transfers (Nodošanas)** iesūtnē kā kaut kas, ko var *Apstiprināt un
   nodot (Approve & Transfer)* vai *Noraidīt (Decline)*.
2. **Jūs nododat to konkrētam cilvēkam** — ja esat priekšmeta pašreizējais
   turētājs vai īpašnieks, atveriet tā detalizēto lapu un izmantojiet
   izvēlni **Transfer to... (Nodot...)** lapas augšdaļā: izvēlieties
   personu un nospiediet **Send Transfer Offer (Nosūtīt piedāvājumu)**.
   Tas parādās *šīs personas* Nodošanu iesūtnē kā piedāvājums, kas
   viņam/viņai jāpieņem (*Accept & Transfer / Pieņemt un nodot*) vai
   jānoraida (*Decline / Noraidīt*), pirms priekšmets tiešām kļūst viņa
   rīcībā.

Abos gadījumos katra pabeigta nodošana tiek ierakstīta priekšmeta
**History (Vēsture)** cilnē, tāpēc vienmēr varat redzēt, kam un kad
priekšmets ir bijis rokās.

Administratoriem/superadministratoriem ir trešā iespēja: priekšmeta
detalizētajā lapā lauki **Current Holder (Pašreizējais turētājs)** un
**Owner (Īpašnieks)** ir rediģējamas izvēlnes, kas ļauj tos pārtēlot
tiešā veidā (turētāja maiņas joprojām tiek ierakstītas Vēsturē; īpašnieka
maiņas — nē, jo īpašnieks ir tikai ilgtermiņa uzskaite, atsevišķi no tā,
kam priekšmets fiziski pieder šobrīd).

## 9. Priekšmeta detalizētā lapa

Noklikšķinot uz jebkura priekšmeta (Priekšmetu sarakstā, Panelī vai caur
nodošanu), redzēsiet:

- Fotoattēlu, RFID birku, izmēru, stāvokli, aprakstu.
- **Current Holder (Pašreizējais turētājs)** / **Owner (Īpašnieks)** — kam
  priekšmets ir rokās šobrīd un kam tas piešķirts ilgtermiņā. Tās ir
  atšķirīgas lietas: jūs varat turēt priekšmetu, kas pieder kādam citam,
  vai kas vienkārši nav nevienam piešķirts.
- **Comments (Komentāri)** — atstājiet piezīmes citiem dalībniekiem par
  priekšmeta stāvokli, piegulumu utt.
- **History (Vēsture)** — katra turētāja maiņa ar datumu, kas to
  ierosinājis un kā (pieprasījums, administratora tiešā maiņa vai NFC
  skenēšana).

## 10. Dalībnieki un lomas (Administrators/Superadministrators)

Atveriet **Members (Dalībnieki)**, lai redzētu visus organizācijas
dalībniekus un viņu lomu katrā grupā. Mainiet izvēlni, lai paaugstinātu vai
pazeminātu kāda lomu (tostarp piešķirtu vai atņemtu Pievienotāja lomu), vai
izvēlieties "None", lai izslēgtu dalībnieku no grupas pavisam.

## 11. NFC mobilā skenera lietotne

Ir plānota papildu mobilā lietotne, kas ļaus, pieskaroties apģērba NFC
birkai, to uzreiz identificēt un ātri veikt izņemšanu/atgriešanu — noderīgi
aizkulisēs, kur nav ērti rakstīt uz klēpjdatora. Tā vēl nav pieejama; kad
tā tiks izlaista, pierakstīšanās notiks ar to pašu kontu, ko izmantojat
tīmekļa lietotnē.

## Padomi

- Ja komplekta pieprasījums neizdodas ar paziņojumu, ka trūkst izmēra,
  dodieties uz **Profile (Profils)** un iestatiet savu izmēru minētajai
  kategorijai.
- Ja komplekta pieprasījums neizdodas ar paziņojumu, ka nav pieejama
  priekšmeta, kādam jāatgriež attiecīgā produkta/izmēra/dzimuma priekšmets
  Noliktavā, lai komplektu varētu izpildīt.
- "Storage" (Noliktava) kā turētājs nozīmē, ka priekšmets nav izņemts —
  tas ir pieejams.
- Tikko pievienojāties caur ielūguma saiti un redzat tikai Profila lapu?
  Tā arī jābūt — jūs esat Pievienotājs (Joiner), kamēr administrators
  nepiešķir jums lomu.

## Tālruņa saskarne

Ja ekrāna platums ir mazāks par 768 pikseļiem, lietotne izmanto atsevišķu tālruņa izkārtojumu. Apakšējā navigācijā ir **My items** (Mani priekšmeti), **Kits** (Komplekti), **Transfers** (Nodošana) un **Profile** (Profils). Izvēlnē **More** (Vairāk) atrodama visu priekšmetu pārlūkošana, kataloga un administrēšanas lapas, uzaicinājuma saites kopēšana un izrakstīšanās. Priekšmetu sarakstā var izvēlēties **Available** (Pieejamie) vai **All** (Visi), bet papildu atlasi atvērt ar **Filters** (Filtri). Priekšmeta skatā ir komentāri, turētāju vēsture, pieprasīšana, atdošana glabātavā un nodošanas piedāvājumi. Administrēšanā tiek izmantotas kartītes un pilnekrāna redaktori. Platākos ekrānos saglabājas darbvirsmas izkārtojums. Pirms ekrāna platuma maiņas pāri šai robežai saglabājiet formas izmaiņas.
