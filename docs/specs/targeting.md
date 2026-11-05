# Targeting, lock and firing — source spec

User's spec (Polish), pasted 2026-11-05. Implement its **mechanics** with SKYRIOT's own names: STD = Primary, ADV = Secondary; Gear classes map A→Bulwark, B→Anvil, I→Wasp, M→Halo; Siege Mode/Air Siege = our Ground Siege/Air Siege; GBM/ABM = Anvil's ground/air bombing modes; bundle = Bulwark Secondary salvo. Weapon, radar and item names in the tables are reference data only — never reuse them as names in the game. Tags: [ŹR] sourced, [ZAŁ] proposal to verify, [POTW] confirmed by the team (binding).

| Spec term               | Project term                           |
| ----------------------- | -------------------------------------- |
| STD                     | Primary (LMB)                          |
| ADV                     | Secondary (RMB)                        |
| Gear A / B / I / M      | Frame: Bulwark / Anvil / Wasp / Halo   |
| Siege / Air Siege       | Ground Siege / Air Siege               |
| GBM / ABM               | Anvil Ground Strike / Air Barrage Mode |
| Multitarget             | Anvil Wide Lock Mode                   |
| Bundle                  | Bulwark salvo (Secondary)              |
| Std / Adv Range (radar) | Primary / Secondary radar range        |
| Target / cel            | Target                                 |
| Lock                    | Lock                                   |
| VA                      | Valid Angle                            |

---

Ace Online – mechanika lockowania i strzelania (spec dla implementera)

## 1. Cel, zakres i słownik

W Ace Online broń standardowa (STD) strzela zawsze, a trafienie rozstrzyga rzut na celność względem wybranego celu; broń zaawansowana (ADV) wymaga celu w zasięgu radaru ADV i w stożku Valid Angle. Ten dokument opisuje to jako specyfikację do odtworzenia: stany celowania, warunki strzału, co widzi gracz na HUD i przypadki brzegowe.

| Pojęcie                 | Znaczenie                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| STD (Standard Weapon)   | Broń podstawowa: działka, gatlingi, armaty. LPM. Zasięg setki metrów, liczy się celność i przegrzanie. |
| ADV (Advanced Weapon)   | Broń zaawansowana: pociski, bundle (A-Gear), bomby GBM/ABM (B-Gear). PPM. Zasięg tysiące metrów.       |
| Target / cel            | Obiekt (gracz wrogiej nacji lub mob) wybrany przez gracza. Jeden naraz.                                |
| Lock                    | Stan, w którym ADV może zostać odpalona: cel w zasięgu radaru ADV i w kącie Valid Angle.               |
| Radar (Std / Adv Range) | Dwa osobne zasięgi — dla STD i ADV — np. 700 m STD / 1550 m ADV [ŹR].                                  |
| Valid Angle (VA)        | Kąt od osi podłużnej Geara, w którym ADV łapie lock (np. 2–11°) [ŹR].                                  |
| Attack pattern N×M      | Pocisków na strzał. 4×1 = 4 naraz; 1×4 = 4 pojedyncze serią; 2×2 = dwie serie po dwa [ŹR].             |
| Reattack time           | Czas do kolejnego wzoru ataku. Dla ADV nie wlicza czasu wystrzeliwania salwy [ŹR].                     |
| Overheat time           | Jak długo można strzelać ciągle z STD przed przegrzaniem [ŹR].                                         |
| Induction rate          | Prędkość skrętu pocisku samonaprowadzającego °/s; 0 = brak (bundle) [ŹR].                              |
| Explosion radius        | Bundle 100 m, zwykłe pociski 0 m [ŹR].                                                                 |
| Min range               | Dystans, poniżej którego A-Gear w Siege nie trafia; zależy od pancerza [ŹR].                           |
| Gear                    | A (artyleria/czołg), B (bombowiec), I (myśliwiec), M (wsparcie) [ŹR].                                  |

## 2. Klasy broni i sterowanie

Każdy Gear ma jeden slot STD i jeden ADV [ŹR].

| Akcja                      | Klawisz                            | Uwagi                                             |
| -------------------------- | ---------------------------------- | ------------------------------------------------- |
| Strzał STD                 | LPM (przytrzymanie = ogień ciągły) | nalicza przegrzanie [ŹR]                          |
| Strzał ADV                 | PPM                                | salwa leci też w trakcie beczki [ŹR]              |
| Widok do tyłu              | R                                  | Backshot / Zero Siege [ŹR]                        |
| Lądowanie / start (A-Gear) | C                                  | Siege wymaga ziemi (poza Air Siege) [ŹR]          |
| Boost                      | Spacja                             | [ŹR]                                              |
| Strafe                     | A / D                              | unika STD mobów, nie STD graczy [ŹR]              |
| Skille                     | 1–0, TAB przełącza strony paska    | skille celowane: kursor do kliknięcia na cel [ŹR] |

STD (bazowe typy; wzór / celność / zasięg / reattack / overheat):
Vulcan B/I/M 4×1 65% 520 m 0,60 s 15 s · Rifle B/I/M 2×1 85% 520 m 0,55 s 24 s · Gatling B/I/M 4×1 80% 520 m 0,50 s 11 s · Automatic B/I/M 3×1 75% 460 m 0,65 s 21 s · Cannon A 1×1 75% 1000 m 0,45 s 28 s · Mass Drive A 1×1 95% 1000 m 0,43 s 28 s · Dualist A 2×1 85% 1200 m 0,48 s 22 s.

ADV (wzór / celność / zasięg / reattack / VA / prędkość / manewrowość):
Valleystar 1×2 80% 2600 m 1,90 s 10° 300 m/s 80 g · Moth 1×4 85% 2700 m 2,00 s 6° 300 · Holycross 2×2 85% 2800 m 2,00 s 4° 430 · Arrow 1×2 75% 3000 m 1,80 s 6° 420 · Hammerhead 1×2 90% 3200 m 1,80 s 4° 380 · Tongpha 2×2 85% 3300 m 1,60 s 4° 400 · Edrill 1×4 100% 3300 m 1,80 s 2° 450 · Hawk 4×1 90% 3300 m 1,40 s 4° 550 · Bundle (A) 4×1/6×1 90% 2600–3300 m 2,00 s 8–11° 1000 m/s 0 g.
Nowsze wersje: Induction Rate np. 120°/s (I-Gear), 40°/s (bomby B-Gear), 0°/s i wybuch 100 m dla bundle; lot ADV do 4000 m. Bomba B-Gear: 2×1, ~85%, reattack 4 s, najwyższe obrażenia, głównie w GBM/ABM [ŹR].

## 3. Model celowania

Cel wybiera się kursorem; o strzale decydują zasięgi radaru STD i ADV oraz — dla ADV — VA od osi Geara.

### 3.1 Wybór celu kursorem

- Gear leci za kursorem; kursor jest celownikiem. Najechanie na wroga go namierza [ŹR].
- Air Siege używa hitboxa siatki celownika (reticle) — brak min. zasięgu [ŹR].
- Cel jest jeden. Bez celu samo najechanie kursorem ustawia cel. Gdy cel jest, „przykleja się” — zejście kursorem go nie zmienia; zmiana na obiekt pod kursorem wymaga Shift. Cel zostaje do zmiany albo utraty (sekcja 4) **[POTW]**.
- Pojedynek 1:1: po odliczaniu przeciwnik auto-celem [ŹR].
- Siege / Air Siege: kursor nad celem w chwili włączenia → widok przeskakuje na cel i od razu lockuje [ŹR].

### 3.2 Zasięgi

| Parametr                                                                                                     | Skąd                       | Ogranicza                                    |
| ------------------------------------------------------------------------------------------------------------ | -------------------------- | -------------------------------------------- |
| Std Range radaru                                                                                             | radar, +% z Siege          | namierzanie i strzał STD [ŹR]                |
| Adv Range radaru                                                                                             | radar, +% z Multitarget    | lock ADV; w ABM dystans lotu bomb [ŹR]       |
| Range broni STD                                                                                              | broń                       | spadek celności powyżej zasięgu [ŹR]         |
| Range broni ADV                                                                                              | broń                       | pocisk samoniszczy się po tym dystansie [ŹR] |
| Valid Angle                                                                                                  | broń ADV, +° z Multitarget | stożek locka ADV [ŹR]                        |
| Przykładowe radary (STD/ADV): 1200/1000, 1250/1250, 700/1550, 800/1650 m. Radar wpływa też na minimapę [ŹR]. |

### 3.3 Kto może być celem

Wróg (gdzie PvP możliwe; nie w safe/misjach) — STD tak, ADV tak. Sojusznik — nie (poza pojedynkiem). Moby — tak. Obiekty wojny — tak (zniszczona brama: pasek, brak obrażeń). Niewidzialny Gear — nie; ujawnia go Scan M-Geara w promieniu. Skille wsparcia celują osobnym kursorem / klikiem w pasek formacji [ŹR].

## 4. Lock-on: maszyna stanów

| Stan     | Wejście                                                              | Wyjście                                                                                  | STD                                               | ADV                                                   |
| -------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| NONE     | start, utrata celu                                                   | ważny cel pod kursorem w zasięgu radaru                                                  | strzał możliwy, **bez obrażeń** dla nikogo [POTW] | zablokowana (poza GBM/ABM i bundle)                   |
| TARGETED | najechanie (gdy brak celu) lub Shift; auto w pojedynku; snap w Siege | poza radarem STD i ADV, śmierć, ukrycie, zmiana mapy → NONE; w VA i zasięgu ADV → LOCKED | rzut na celność, jeśli cel w zasięgu radaru STD   | zablokowana                                           |
| LOCKED   | cel w zasięgu ADV i kąt ≤ VA                                         | wyjście z VA/zasięgu → TARGETED; utrata → NONE                                           | jak TARGETED                                      | PPM odpala, gdy minął reattack i jest amunicja        |
| FIRING   | PPM                                                                  | koniec wzoru → LOCKED/TARGETED                                                           | bez zmian                                         | bundle wymaga utrzymania locka; wystrzelone lecą same |

1. VA liczony od osi podłużnej Geara, nie kamery/kursora [ŹR].
2. **Brak czasu łapania locka** — czysto warunkowy (zasięg ADV + VA) **[POTW]**.
3. Salwy wielopociskowe bundle: lock przez całą salwę, inaczej kolejne chybiają [ŹR].
4. Pocisk po starcie goni cel nawet po jego niewidzialności; ginie po zasięgu broni [ŹR].
5. Cel dostaje ostrzeżenie przy odpaleniu w niego pocisków (sekcja 7) [ŹR].
6. Multitarget Mode: VA +7,4°…+21,8°, radar ADV +10%…+45%, dodatkowe cele; wyłącza GBM/ABM [ŹR]. Dodatkowe cele: najbliższe wrogie w powiększonym stożku, wg kąta [ZAŁ].

## 5. Kiedy można strzelać STD

STD strzela zawsze, gdy minął reattack, broń nieprzegrzana i jest amunicja; obrażenia tylko celowi w zasięgu radaru STD; każdy pocisk to rzut na celność, nie fizyczny lot.

### 5.1 Bramka

LPM; minął reattack (po modyfikatorach); nieprzegrzana (heat < overheat time) — stygnięcie [ZAŁ] = overheat × 0,5; amunicja > 0; żywy, nie warp, brak Invincibility; A-Gear w Siege: krótkie opóźnienie po włączeniu [ŹR].

### 5.2 Rozstrzygnięcie trafienia

STD gracza = „hitscan z rzutem”: nie da się uniknąć strafe'em [ŹR].

1. Brak celu albo cel poza radarem STD → efekt wizualny w stronę kursora, **zero obrażeń, brak kolizji pocisków STD** [POTW].
2. Rzut per pocisk wzoru N×M: P_hit = (Acc_atk − Eva_def) · 0,983^((d/R − 1)·100); mnożnik tylko dla d > R, obcięty do ≤ 1 [ZAŁ]. Celność/unik STD i ADV osobno [ŹR].
3. Obrażenie: losowe ±12,5% od mediany, Pierce obniża obronę, obrona redukuje procentowo [ŹR].

### 5.3 Modyfikatory

Siege (ziemia): +10–22% obrażeń STD, +20–30% radaru STD, wyżej dodatkowe pociski. Concentration: + celność. Charge Shot (B): jeden strzał ×4. Hyper Shot (A): strzał w cel, wybuch 800 m, może chybić [ŹR].

## 6. Kiedy można strzelać ADV

Zwykły pocisk wymaga LOCKED; bundle lecą prosto (kontakt/wybuch); bomby GBM/ABM bez locka.

6.1 Bramka: PPM; minął reattack od **końca** poprzedniej salwy; amunicja; żywy, nie warp, brak Invincibility; warunek trybu (6.2).

6.2 Tryby:

- Pocisk (wszystkie): lock na start; homing z Induction Rate; rzut ADV vs unik ADV; cel może zrobić beczkę / schować się za terenem; samozniszczenie po zasięgu [ŹR].
- Frenzy / Berserker (I): dodatkowe salwy/pociski, −30% reattack [ŹR].
- Bundle (A): lock przez całą salwę; prosto 1000–1300 m/s, induction 0; kontakt, wybuch 100 m; 2600–3400 m [ŹR].
- GBM (B): bez locka; bomby w dół ~45°; trafiają też cele w powietrzu i niewidzialne; większy wybuch, więcej bomb; ~4000 m [ŹR].
- ABM (B): bez locka; bomby do przodu; zasięg ograniczony radarem ADV [ŹR].

6.3 Blokady po stronie celu: Barrier (A, 15 s) — ADV 0 obrażeń, STD działa · Chaff (B) — plewa przyjmuje obrażenia · Invisible (B) / Camouflage (A, ziemia) — brak nowego locka, pociski w locie gonią, bomby trafiają · Silence (I) — cel nie słyszy ostrzeżeń, nie widzi pocisków, blok skilli · Snare (A) — prędkość −25% · Invincibility (M, 8 s) — brak obrażeń, M nie atakuje [ŹR].

## 7. UI/HUD

7.1 Świat: nazwa gracza (wróg czerwona) — widoczność w obie strony [ŹR] · nazwa moba kolor wg trudności [ŹR] · znacznik kandydata (kursor nad celem): cienkie nawiasy [ZAŁ] · znacznik celu (TARGETED/LOCKED): wyraźna ramka, poza ekranem strzałka na krawędzi [ZAŁ] · wskaźnik locka ADV: okrąg/romb zaciskający się, kolor „gotowe” [ZAŁ] · poza zasięgiem: wyszarzenie + dystans w m [ZAŁ] · pociski w locie zawsze widoczne (chyba że Silence) [ŹR] · bańka Barrier / pierścienie kitów [ŹR].

7.2 Ekran: kursor steruje i wskazuje cel [ŹR] · reticle w Air Siege [ŹR] · okno celu (TARGETED/LOCKED) u góry: nazwa, poziom, pasek energii/osłony [ZAŁ] · radar miga na czerwono przy pociskach w gracza [ŹR] · syrena „Missile Lock” przy odpaleniu w gracza, Silence wycisza [ŹR] · kursor skilla celowanego [ŹR] · pasek ciepła STD, odliczanie reattack ADV, amunicja [ZAŁ].

7.3 Dźwięki: syrena pocisków u celu w chwili odpalenia [ŹR]; syrena niskiej energii [ŹR]; ton „lock gotowy” [ZAŁ].

7.4 Ktoś cię namierza i odpala:

1. Namierzenie (TARGETED/LOCKED) — propozycja: dyskretny tik + żółty znacznik kierunku na krawędzi radaru, bez syreny [ZAŁ].
2. Odpalenie salwy — syrena + radar miga na czerwono [ŹR].
3. Pociski w locie — modele ze smugą [ŹR]; kontakty na radarze i czerwone strzałki kierunku na krawędzi ekranu [ZAŁ].
4. Podejście — syrena przyspiesza wraz ze spadkiem dystansu/czasu do trafienia [ZAŁ].
5. Trafienie/chybienie — po zniknięciu ostatniego pocisku alarm cichnie [ZAŁ].
   Reakcje celu: beczka (~3 s przerwy), Chain Roll (I) usuwa przerwę, beczka + reverse niszczy pociski z tyłu, zasłona terenem, ucieczka, Barrier, Chaff, Invisible, Invincibility [ŹR]. Atakujący: Silence, Snare, Frenzy/Berserker [ŹR].
   Zdarzenia sieciowe [ZAŁ]: LockedBy(attackerId) — żółty znacznik, bez syreny; MissileIncoming(attackerId, missileIds[], weaponId) — start syreny, miganie, strzałki; MissileState — co tick; MissileEnded(missileId, reason) — po ostatnim wyłącz alarm.

## 8. Przypadki szczególne

8.1 Siege (ziemia): tylko po lądowaniu (C); stacjonarna wieżyczka 360°; snap na cel pod kursorem przy włączeniu; hitbox: kursor; min. zasięg wg pancerza (do ~70 m); krótkie opóźnienie pierwszego strzału; koszt SP/s (toggle). Air Siege: zawis; nie celuje w dół — cel pod Gearem poza zasięgiem; snap jw.; hitbox reticle; brak min. zasięgu [ŹR]. Backshot / Zero Siege: cel za sobą (widok R) + Siege → wieża obraca się na cel z tyłu [ŹR]. Siege „łapie” wszystkie widoczne moby, ale strzela tylko w zalockowany cel.
8.2 Utrata celu: śmierć → NONE, pociski bez celu lecą prosto [ZAŁ] · Invisible/Camouflage → NONE u wszystkich, pociski gonią [ŹR] · start z ziemi wyłącza Camouflage [ŹR] · Scan M → namierzalny w promieniu [ŹR] · zmiana mapy/warp → NONE [ZAŁ] · poza oboma radarami → NONE; poza samym ADV → TARGETED [ZAŁ] · Purify (M) zdejmuje toggle (Siege, Multitarget, GBM/ABM) [ŹR].
8.3 Bez celowania: Big Boom (B) — wybuch 3 s po aktywacji, 1000 m, nie do uniknięcia · Hyper Shot (A) — wymaga celu, 800 m, może chybić · GBM/ABM.

## 9. Implementacja

9.1 Klient wybiera cel i pokazuje lock natychmiast; serwer jedynym arbitrem: przy każdym strzale sam sprawdza zasięg, VA, widoczność, cooldowny i sam rzuca na trafienie [ZAŁ]. Lock ADV: serwer liczy z tolerancją na lag (+1° VA, +2% zasięgu). Ostrzeżenie: serwer wysyła MissileIncoming (chyba że Silence). Utrata celu: serwer emituje TargetLost.

9.2 Parametry: radar.stdRange/advRange; weapon.range/reattack/overheatTime/pattern/accuracy; adv.validAngleDeg/speed/inductionRateDegPerSec/explosionRadius; lockAcquireTime = brak [POTW]; overheatCooldown 0,5 × overheat [ZAŁ]; siege.minRange; siege.armDelay 0,5 s [ZAŁ]; net.vaTolerance 1°, rangeTolerance 2% [ZAŁ].

9.3 Pseudokod:

```ts
function canLockAdv(shooter, target, weapon): boolean {
  if (!isValidHostile(shooter, target)) return false;
  const d = distance(shooter.pos, target.pos);
  if (d > shooter.radar.advRange * mods.advRangeMul) return false;
  const angle = angleBetween(shooter.forward, target.pos - shooter.pos);
  return angle <= weapon.validAngleDeg + mods.validAngleBonus;
}
function tryFireStd(s, now) {
  if (now < s.std.nextFireAt || s.std.overheated || s.std.ammo <= 0) return;
  if (s.isSiege && now < s.siegeArmedAt) return;
  s.std.nextFireAt = now + s.std.reattack;
  s.std.heat += s.std.reattack;
  if (s.std.heat >= s.std.overheatTime) s.std.overheated = true;
  const t = s.target;
  for (const shot of s.std.pattern) {
    if (!t || distance(s, t) > s.radar.stdRange * mods.stdRangeMul) {
      spawnVisualOnly(shot);
      continue;
    }
    if (s.isSiege && distance(s, t) < s.armor.siegeMinRange) {
      spawnVisualOnly(shot);
      continue;
    }
    if (rand() < hitChance(s.std, t, distance(s, t))) applyDamage(t, rollDamage(s.std, t));
  }
}
function tryFireAdv(s, now) {
  if (now < s.adv.nextFireAt || s.adv.ammo <= 0) return;
  if (s.mode === 'GBM' || s.mode === 'ABM') return fireBombs(s);
  if (!s.target || !canLockAdv(s, s.target, s.adv)) return;
  fireSalvo(s, s.target);
  s.adv.nextFireAt = now + salvoDuration(s.adv) + s.adv.reattack;
  notifyIncoming(s.target);
}
```

9.4 Checklista: kursor nad wrogiem w radarze → TARGETED, nad sojusznikiem → brak · cel w zasięgu ADV poza VA → PPM nic; nos na cel → LOCKED · VA per broń, Multitarget zwiększa VA · ciągły ogień przegrzewa po overheat time · STD poza zasięgiem broni niższa celność · Invisible: lock znika, pociski gonią, bomby trafiają · Barrier: ADV 0, STD normalnie · Silence: brak syreny i widoku pocisków · Siege bliżej min. zasięgu → brak trafień; Air Siege → trafienia · Siege z kursorem nad celem → snap + lock · bundle: utrata locka w połowie → reszta chybia · bez celu: najechanie ustawia cel; z celem: najechanie na innego nic, Shift przełącza · STD bez celu: zero obrażeń · wejście w VA i zasięg: PPM w tej samej klatce.

9.5 Rozstrzygnięte [POTW]: wybór celu najechaniem, zmiana Shiftem; brak czasu łapania locka; STD bez celu nie zadaje obrażeń nikomu.
