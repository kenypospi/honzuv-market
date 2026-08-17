# Honzův Market – finální GitHub verze

Tato složka je připravená přímo do kořene repozitáře `honzuv-market`.

Ovládání přes Google Tabulky:
- Ceny: název, cena, kategorie, podkategorie, viditelnost a příznaky
- Kategorie: název, viditelnost, pořadí
- Podkategorie: název, viditelnost, pořadí
- Sekce: Akční nabídka, Nejprodávanější, Novinky, Výprodej, Doporučujeme
- Nastavení: názvy a cena dopravy

`index.html` používá kořenové `katalog.js`, `ceny.js`, `nastaveni.js`. Neobsahuje rozbitý odkaz na `Data/katalog.js`.


## Ceny a prodejní jednotky – důležité
Do listu `Produkty a ceny` přidejte sloupec `Prodejní jednotka`. Povolené hodnoty jsou `kg`, `ks`, `bal.` a `karton`.

- `kg`: cena je za 1 kg a web ji automaticky násobí hmotností celého balení (např. 179,90 Kč/kg × 5 kg = 899,50 Kč za balení).
- `ks`, `bal.`, `karton`: cena je konečná cena za uvedenou prodejní jednotku a hmotnost z textu balení ji nijak nemění.

Pokud sloupec nebo hodnota chybí, web kvůli zpětné kompatibilitě použije `kg`.
