# Honzův Market – finální GitHub verze

Tato složka je připravená přímo do kořene repozitáře `honzuv-market`.

Ovládání přes Google Tabulky:
- Ceny: název, cena, kategorie, podkategorie, viditelnost a příznaky
- Kategorie: název, viditelnost, pořadí
- Podkategorie: název, viditelnost, pořadí
- Sekce: Akční nabídka, Nejprodávanější, Novinky, Výprodej, Doporučujeme
- Nastavení: názvy a cena dopravy

`index.html` používá kořenové `katalog.js`, `ceny.js`, `nastaveni.js`. Neobsahuje rozbitý odkaz na `Data/katalog.js`.


## Ceny – důležité
Cena v Google tabulce je vždy cena za 1 kg. Web automaticky násobí cenu hmotností celého balení (např. 179,90 Kč/kg × 5 kg = 899,50 Kč za balení).
