# Lietotāja rokasgrāmata

Tērpu inventāra pārvaldības lietotne (Dress Asset Management) palīdz organizācijai
uzskaitīt kopīgi lietotus tērpus, redzēt katra priekšmeta turētāju un pieprasīt
vai piedāvāt priekšmetus citiem dalībniekiem.

Atjaunināta: 2026. gada 7. oktobrī. Rokasgrāmata paredzēta dalībniekiem,
abonementu īpašniekiem un vietnes administratoriem. Pogām norādīti lietotnes
angļu nosaukumi un skaidrojumi latviski. Savas instances izvietošanai skatiet
[installation.md](installation.md).
[English manual](manual.en.md) · [Word dokuments](manual.lv.doc)

## 1. Lomas un piekļuve

**Abonements (Subscription)** ir organizācijas darba vide, kurā ietilpst grupas,
dalībnieki un tērpu katalogs. Lielākā daļa lomu attiecas uz konkrētu grupu.

| Loma | Pieejamās darbības |
| --- | --- |
| Joiner — jaunais dalībnieks | Sākotnējā loma pēc pievienošanās ar uzaicinājumu. Ja nav aktīvas grupas lomas, lietotnē pieejams tikai savs profils līdz lomas piešķiršanai. |
| User — lietotājs | Organizācijas kataloga un vēstures pārlūkošana; savas grupas priekšmetu pieprasīšana un komentēšana; turētu vai ilgtermiņā piešķirtu priekšmetu piedāvāšana atbilstošiem dalībniekiem. |
| Admin — administrators | Lietotāja darbības, kā arī savas pārvaldītās grupas kataloga un atļauto dalībnieku profilu pārvaldība, priekšmeta īpašnieka un turētāja tieša maiņa. |
| Superadmin — superadministrators | Administratora darbības, kā arī savas grupas lomu piešķiršana un noņemšana, grupas rediģēšana un dzēšana. Var izveidot papildu grupas. |
| Abonementa īpašnieks | Visu sava abonementa grupu, kataloga un dalībnieku pārvaldība, tostarp lomu maiņa un dalībnieku izslēgšana. Apstiprinātā pieteikuma iesniedzējs kļūst par īpašnieku un pirmās grupas superadministratoru. |
| Vietnes administrators | Jaunu abonementu pieteikumu izskatīšana, visu šīs instances abonementu apskate un nosaukumu maiņa. Šī piekļuve automātiski nepiešķir tiesības pārvaldīt citas organizācijas tērpus vai nodošanu. |

Vienam cilvēkam dažādās grupās var būt atšķirīgas lomas. Vietnes administratora
piekļuvi piešķir instances uzturētājs; to nevar piešķirt **Members** lomu izvēlnē.

## 2. Pierakstīšanās un pievienošanās organizācijai

1. Palūdziet organizācijas administratoram uzaicinājuma saiti
   (`.../join/<abonementa-id>`).
2. Atveriet saiti un vajadzības gadījumā nospiediet **Sign in with Google**
   (Pierakstīties ar Google). Pārbaudiet, vai izmantojat vēlamo Google kontu.
3. Nospiediet **Join** (Pievienoties), pēc veiksmīgas pievienošanās —
   **Go to Profile** (Atvērt profilu).
4. Aizpildiet profilu, kamēr abonementa īpašnieks vai attiecīgās grupas
   superadministrators piešķir jums `user`, `admin` vai `superadmin` lomu.

Pievienojoties saņemat `joiner` lomu katrā grupā, kas tajā brīdī pastāv šajā
abonementā. Kamēr gaidāt lomu, ir paredzēta piekļuve tikai profilam.

Ja pierakstāties galvenajā lapā bez piesaistes abonementam, redzat
**You need an invitation link** (Nepieciešama uzaicinājuma saite). Palūdziet
administratoram saiti un atveriet to. Ja norādīts nepareizais e-pasts, izmantojiet
**Sign out to use another account** (Izrakstīties, lai izmantotu citu kontu).

Konts var piederēt tikai vienam abonementam. Lai mainītu organizāciju, palūdziet
pašreizējam abonementa īpašniekam noņemt jūsu dalību pēc priekšmetu un gaidošo
nodošanu sakārtošanas, tad atveriet jaunās organizācijas uzaicinājumu.

## 3. Jauna abonementa pieteikšana

Organizācijas izveidotājam, kuram vajadzīga atsevišķa darba vide,
**pašam jāatver `/register`**. Galvenās lapas pierakstīšanās paredzēta
pievienošanās procesam ar esošas organizācijas uzaicinājumu.

1. Atveriet `/register` un pierakstieties ar Google.
2. Aizpildiet **Organization name** (Organizācijas nosaukums),
   **First group name** (Pirmās grupas nosaukums) un
   **Why do you need a subscription?** (Kāpēc nepieciešams abonements?).
   Visi trīs lauki ir obligāti. Izskaidrojiet, kam organizācija paredzēta,
   kādus tērpus pārvaldāt un kā izmantosiet lietotni.
3. Nospiediet **Submit for approval** (Iesniegt apstiprināšanai). Jauno abonementu
   varēsiet izmantot un dalībniekus uzaicināt pēc vietnes administratora apstiprinājuma.
4. Atgriezieties `/register` un nospiediet **Check status** (Pārbaudīt statusu).

- **Awaiting approval — gaida apstiprinājumu:** redzami iesniegtie dati,
  kamēr pieteikumu izskata.
- **Declined — noraidīts:** izlasiet administratora pamatojumu, izvēlieties
  **Revise and resubmit** (Labot un iesniegt atkārtoti), precizējiet datus un
  iesniedziet vēlreiz. **Cancel changes** (Atcelt izmaiņas) atgriež statusa skatu.
- **Approved — apstiprināts:** nospiediet **Open my organization**
  (Atvērt manu organizāciju), lai atvērtu **Administration**. Abonements un
  pirmā grupa ir izveidoti, un jūs esat abonementa īpašnieks.

Ja gaidīšanas laikā pievienojaties esošai organizācijai, pieteikums tiek slēgts.
Konts, kas jau pieder organizācijai, šajā procesā nevar izveidot papildu abonementu.

## 4. Organizācijas administrēšana un uzaicinājumi

Īpašnieks un grupu administratori vai superadministratori var atvērt
**Administration** (Administrēšana, `/administration`) sānjoslā vai tālruņa
izvēlnē **More**. Te pieejamas saites uz dalībnieku un kataloga pārvaldību;
grupas pārvalda īpašnieks un superadministratori. Tiesības joprojām ir atkarīgas
no lomas konkrētajā grupā.

Lai uzaicinātu dalībnieku, nospiediet **Copy invitation link**
(Kopēt uzaicinājuma saiti) un nosūtiet saiti jaunajam dalībniekam. Ja kopēšana
neizdodas, atlasiet un nokopējiet saiti manuāli. Darbvirsmas **Dashboard** arī
rāda uzaicinājuma saiti. Pievienošanās vēl nepiešķir aktīvu grupas lomu:
īpašniekam vai attiecīgās grupas superadministratoram tā jāpiešķir **Members**.

## 5. Grupas

Grupa ir organizācijas iedalījums, piemēram, *Seniori*, *Jaunieši* vai
*Vidējā paaudze*. Katra kategorija, produkts, fiziskais priekšmets un komplekts
pieder vienai grupai.

- Īpašnieks un superadministratori sadaļā **Groups** (Grupas) var izvēlēties
  **Add group** (Pievienot grupu), norādot nosaukumu un neobligātu aprakstu.
  Izveidotājs kļūst par šīs grupas superadministratoru.
- Īpašnieks var rediģēt visas sava abonementa grupas, superadministrators — savas grupas.
- Grupu var dzēst pēc tās kataloga noņemšanas un gaidošo nodošanu slēgšanas.
  Abonementā jāsaglabā vismaz viena grupa.
- Grupas lomas sadaļā **Members** piešķir īpašnieks vai šīs grupas superadministrators.

## 6. Jūsu profils

Atveriet **Profile** (Profils), lai norādītu vārdu, dzimumu, izmērus un profila attēlu.

- **Gender — dzimums:** Male (Vīrietis) vai Female (Sieviete). Tas nosaka,
  kurām kategorijām redzami izmēra lauki.
- **Izmērs katrai kategorijai:** norādiet atsevišķi, piemēram, “Kleita: M” un
  “Kurpes: 42”. Redzamas Unisex kategorijas un tās, kas atbilst jūsu dzimumam.
  Ja saraksts ir tukšs, vispirms norādiet dzimumu.
- **Profila attēls:** pēc augšupielādes saglabājas uzreiz. Pārējos laukus
  saglabājiet ar **Save Changes** (Saglabāt izmaiņas).

Izvēloties tērpus, ņemiet vērā profilā norādītos izmērus. Inventāra kopējie
pieprasījumi izmanto tieši izvēlētos priekšmetus; tie automātiski neaizstāj tos
ar priekšmetiem, kas atbilst jūsu profilam.

## 7. Kataloga veidošana un rediģēšana

Īpašnieks un attiecīgās grupas administratori vai superadministratori pārvalda
**Kategorija → Produkts → Priekšmets**, kā arī **Komplektus**:

- **Category — kategorija:** plašs veids, piemēram, Kleita vai Kurpes, ar
  Male/Female/Unisex dzimumu.
- **Product — produkts:** konkrēts kategorijas variants, piemēram,
  Sarkani ziedu raksta svārki, ar dzimumu un neobligātu fotoattēlu.
- **Item — priekšmets:** viens fizisks apģērba gabals ar izmēru, dzimumu,
  stāvokli, neobligātu fotoattēlu, RFID birkas ID un aprakstu.
- **Kit — komplekts:** tērpa definīcija ar vajadzīgajiem produktiem, piemēram,
  konkrēti svārki un kurpes. Vienu produktu un tā fiziskos priekšmetus var
  izmantot vairākos komplektos bez inventāra dublēšanas.

Vispirms izveidojiet kategorijas, tad produktus un priekšmetus. Izvēlieties
grupu pirms saistītās kategorijas vai produkta izvēles un attēla augšupielādes.
Saistītajiem kataloga ierakstiem jābūt vienā grupā. Komplektus definējiet sadaļā
**Kits**; tālrunī rediģēšanai izmantojiet **More → Manage kits** un
**More → Manage items**.

Saglabāšanas laikā jāgaida darbības pabeigšana. Kļūdas gadījumā redaktors paliek
atvērts atkārtotam mēģinājumam. Katrs ieraksts atveras ar saviem datiem. Ja vecākam
ierakstam grupa ir nezināma, palūdziet abonementa īpašniekam pārbaudīt un piešķirt grupu.

## 8. Inventāra pārlūkošana, atlase un grupēšana

Darbvirsmas **Dashboard** (Panelis) sākotnēji rāda priekšmetus, kuru turētājs
esat jūs. Notīriet Holder filtru vai izvēlieties **Clear filters** (Notīrīt filtrus),
lai skatītu vairāk priekšmetu. **Inventory** rāda visu inventāru. Tālrunī izmantojiet
**My items** vai **More → Browse inventory**.

- Meklējiet pēc tērpa, cilvēka, komplekta vai birkas.
- Atlasiet pēc **Group** (Grupa), **Category** (Kategorija), **Product** (Produkts),
  **Holder** (Turētājs), **Owner** (Īpašnieks), **Kit** (Komplekts) un **Size** (Izmērs).
  Kategorija sašaurina produktu izvēli.
- **My items** atlasa priekšmetus pie jums; **Available** (Pieejamie) atlasa Storage turētāju.
- Izvēlieties **No grouping** (Bez grupēšanas), **Group by owner** (Pēc īpašnieka),
  **Group by kit** (Pēc komplekta) vai **Group by owner + kit** (Pēc īpašnieka un komplekta).
  Kārtojiet pēc produkta, īpašnieka, turētāja vai izmēra.
- Tālrunī atlase, grupēšana un kārtošana atrodama zem **Filters** (Filtri).

Grupēšana pēc komplekta rāda tā definīcijai atbilstošos priekšmetus, arī nepilnus
tērpus. Priekšmets var parādīties vairākos komplektos. Atveriet priekšmetu, lai skatītu detaļas.

## 9. Priekšmetu pieprasīšana

Pieprasīšanai vajadzīga aktīva loma priekšmeta grupā vai abonementa īpašnieka statuss.

1. Inventārā izvēlieties **Request** (Pieprasīt) konkrētam priekšmetam,
   **Request matching items** (Pieprasīt atlasītos priekšmetus) visam filtrētajam
   sarakstam vai **Request all** (Pieprasīt visus) attēlotajai grupētajai sadaļai.
2. Pārbaudiet apstiprināšanas sarakstu, tostarp izmērus un pašreizējos turētājus,
   tad nospiediet **Send requests** (Nosūtīt pieprasījumus).
3. Sekojiet statusam **Transfers → My requests and offers** (Mani pieprasījumi un piedāvājumi).

Priekšmeti, kas jau ir pie jums vai kurus jau esat pieprasījis, tiek izlaisti.
Vienā kopējā pieprasījumā var būt līdz 100 atbilstošiem priekšmetiem; lielākam
sarakstam sašauriniet filtrus. Tiek pieprasīti tieši redzamie priekšmeti, arī
vairāki izmēri vai vairāki viena produkta gabali, ja tie ietilpst sarakstā.
Pilns tērps netiek automātiski salikts. **Kits** rāda tērpa sastāvu; vajadzīgo
gabalu izvēlei inventārā izmantojiet komplekta un izmēra filtrus.

Varat arī atvērt priekšmetu un izvēlēties **Request Transfer** (Pieprasīt nodošanu)
vai **Request from Storage** (Pieprasīt no glabātavas). Pirms turētāja maiņas
pieprasījums jāapstiprina pašreizējam turētājam vai pilnvarotam administratoram.

Gaidošs pieprasījums priekšmetu nerezervē. Pirmā derīgā apstiprinātā nodošana uzvar;
pārējie gaidošie pieprasījumi šim priekšmetam tiek automātiski noraidīti.
Nevajadzīgu pieprasījumu atceliet ar **Cancel** sadaļā **My requests and offers**.

## 10. Piedāvāšana, pieņemšana un atdošana

Priekšmetu ar pieprasījumu var nodot divos veidos:

- Kāds pieprasa priekšmetu, kas ir pie jums: atveriet **Transfers → Pending**
  (Gaidošie) un izvēlieties **Approve & Transfer** (Apstiprināt un nodot) vai
  **Decline** (Noraidīt).
- Jūs piedāvājat priekšmetu, kuru turat vai kurš jums piešķirts ilgtermiņā:
  tā detaļās izvēlieties saņēmēju laukā **Transfer to...** (Nodot...) un
  nospiediet **Send Transfer Offer**. Tālrunī izvēlieties
  **Offer to another member**, norādiet saņēmēju un nospiediet **Send offer**.
  Saņēmējam sadaļā Transfers jāizvēlas **Accept & Transfer** (Pieņemt un nodot)
  vai **Decline** (Noraidīt).

Saņēmējam vajadzīga aktīva loma priekšmeta grupā vai jābūt abonementa īpašniekam.
Joiner un dalībnieki ar lomām tikai citās grupās nav pieejami saņēmēju izvēlē.
Ja cilvēka sarakstā nav, palūdziet īpašniekam vai grupas superadministratoram
pārbaudīt viņa grupas lomu. Ja piekļuve mainās pirms pieņemšanas, gaidošo
piedāvājumu var būt nepieciešams sakārtot administratoram.

Tālrunī nodošanas pogas ir **Approve transfer** (Apstiprināt nodošanu),
**Accept transfer** (Pieņemt nodošanu) un **Cancel request** (Atcelt pieprasījumu).

Pēc priekšmeta fiziskas atdošanas turētājs var izvēlēties **Return to storage**
(Atdot glabātavā). Īpašnieks un pilnvaroti grupas administratori vai
superadministratori var turētāju mainīt tieši. Katra pabeigta turētāja maiņa
redzama **History** darbvirsmā vai **Holder history** (Turētāju vēsture) tālrunī. Ilgtermiņa **Owner** (Īpašnieks)
maināms atsevišķi; šī maiņa neveido turētāja vēstures ierakstu.

## 11. Priekšmeta detaļas un nodošanas statuss

Detaļās redzami fotoattēli, izmērs, dzimums, stāvoklis, apraksts, RFID birka,
pašreizējais turētājs un ilgtermiņa īpašnieks. **Comments** (Komentāri) paredzēti
piezīmēm, **History** (tālrunī **Holder history**) — datētiem turētāju maiņu ierakstiem un to
ierosinātājiem. Tālrunī administrators piešķīrumus maina ar **Manage owner and holder**.

Darbvirsmas **Transfers** sadaļā **Pending** ir pieprasījumi, ko varat apstiprināt;
**My requests and offers** rāda jūsu nosūtītos pieprasījumus, **History** — slēgtos.
Tālrunī atbilstošie skati ir **Pending** (Gaidošie), **Outgoing** (Izejošie) un
**History** (Vēsture). “Item assigned elsewhere” nozīmē, ka uzvarēja cita nodošana.
Ja redzat “Old request”, atceliet veco pieprasījumu un izveidojiet jaunu.

## 12. Dalībnieki un lomu piešķiršana

Atveriet **Members** (Dalībnieki), lai skatītu abonementa dalībniekus un lomas grupās.

- Īpašnieks vai attiecīgās grupas superadministrators var izvēlēties `joiner`,
  `user`, `admin`, `superadmin` vai **No role** (Bez lomas). “No role” noņem
  piekļuvi šai grupai, bet ne dalību abonementā.
- Jaunam dalībniekam piešķiriet aktīvu lomu grupā, kurā viņš darbosies.
  Vienas grupas loma nepiešķir pārvaldības vai pieprasīšanas tiesības visās grupās.
- Pilnvaroti administratori vai superadministratori var rediģēt dalībnieku
  profilus, taču ne brīvi mainīt visu administratoru profilus. Lomu izvēlnes
  pieejamas tikai īpašniekam un superadministratoriem.
- Abonementa īpašnieks var izvēlēties **Remove** (Izslēgt) pēc dalībnieka
  priekšmetu pārpiešķiršanas un gaidošo nodošanu sakārtošanas.
- Katrā grupā jāsaglabā vismaz viens superadministrators. Abonementa īpašnieku
  dalībnieku pārvaldībā nevar izslēgt.

## 13. Vietnes administrēšana

Vietnes administrators atver **Site administration** (`/site-admin`) izvēlnē
vai tieši. Tā ir atsevišķa lapa no organizācijas **Administration**.

Abonementa pieteikuma izskatīšana:

1. Atveriet cilni **Subscription requests** (Abonementu pieteikumi).
   Sākotnēji redzami gaidošie pieteikumi. Statusa izvēlnē var skatīt citus
   lēmumus; **Refresh** (Atsvaidzināt) pārlādē sarakstu.
2. Izvēlieties **Review request** (Izskatīt pieteikumu). Izlasiet iesniedzēja
   datus, organizācijas un pirmās grupas nosaukumu, kā arī obligāto pamatojumu.
3. Izvēlieties **Approve request** (Apstiprināt pieteikumu), tad **Confirm approval**, lai izveidotu
   abonementu, pirmo grupu un īpašnieka dalību. Vai izvēlieties **Decline request**,
   norādiet obligātu, iesniedzējam redzamu pamatojumu un nospiediet **Confirm decline**.
4. **View request** ļauj skatīt jau pieņemtu lēmumu. **Load more requests**
   parādās, ja pieejama nākamā saraksta daļa.

Cilnē **Subscriptions** (Abonementi) izvēlieties **Manage** darbvirsmā vai
**Manage subscription** tālrunī, lai skatītu grupas un dalībniekus.
Mainiet **Subscription name** un nospiediet **Save name**, lai pārdēvētu
abonementu. **Load more subscriptions** ielādē nākamos ierakstus. Šeit nav
abonementa dzēšanas, dalībnieku pārcelšanas vai citas organizācijas tērpu
pārvaldības darbību.

## 14. Lietošana tālrunī

Ja ekrāns ir šaurāks par 768 pikseļiem, pieejams tālruņa izkārtojums ar
**My items**, **Kits**, **Transfers** un **Profile** apakšējā navigācijā.
**More** satur inventāra pārlūkošanu, administrēšanu, uzaicinājuma kopēšanu
un izrakstīšanos. Joiner bez aktīvas lomas redz tikai profilu.
Kataloga administrēšanā ir kartītes un pilnekrāna redaktori.

Saglabājiet izmaiņas pirms lapas pārlādes, izrakstīšanās, konta maiņas vai
ekrāna izmēra maiņas pāri darbvirsmas un tālruņa robežai. Pierakstīšanās datu
atjaunošana fonā saglabā atvērtos melnrakstus, taču pilna lapas pārlāde vai
izkārtojuma maiņa tos var pazaudēt. Tālruņa tīmekļa skats ir atsevišķs no
plānotā NFC skenera.

## 15. Bieži jautājumi

- **“You need an invitation link”:** palūdziet organizācijas administratoram
  saiti. Pārbaudiet, vai pierakstījāties ar pareizo e-pastu.
- **Pieejams tikai profils:** palūdziet īpašniekam vai savas grupas
  superadministratoram piešķirt aktīvu grupas lomu.
- **Abonementa pieteikums gaida:** atgriezieties `/register` un izvēlieties
  **Check status**. Noraidītam pieteikumam izlasiet atsauksmi un precizējiet pamatojumu.
- **Darbība nav pieejama vai tiek atteikta:** pārbaudiet lomu priekšmeta grupā.
  Vietnes administratora piekļuve viena pati nedod tērpu pārvaldības tiesības.
- **Nav piemērota priekšmeta:** pārbaudiet grupas, komplekta, izmēra un turētāja
  filtrus; jautājiet pašreizējam turētājam vai administratoram par atdošanu.
  Storage nozīmē, ka priekšmets nav izsniegts, taču tam var būt konkurējoši pieprasījumi.
- **Saglabāšana neizdodas:** novērsiet norādīto lauka vai savienojuma kļūdu un
  mēģiniet vēlreiz. Pēc iesniegšanas kļūdas atvērtais redaktors saglabā ievadīto.

## 16. NFC skenera lietotne

Atsevišķa mobilā lietotne priekšmetu atpazīšanai ar NFC birkas pieskārienu ir
plānota un vēl nav pieejama. RFID birkas ID ievadīšana tīmekļa katalogā neieslēdz
tālruņa NFC skenēšanu. Priekšmetu un nodošanas pārvaldībai turpiniet izmantot tīmekļa lietotni.
