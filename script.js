const TELEFON_WHATSAPP = "420606656006";
const CENA_DOPRAVY = 79;
const VYCHOZI_PRODUKTY = [
    {
        id: "250002",
        nazev: "Kuřecí prsní řízky cca 2,5 kg",
        cena: 144.9,
        kategorie: "Stálá nabídka",
        popis: "Balení 2,5 kg, původ Evropský chov",
        hmotnostKg: 2.5
    },
    {
        id: "701804",
        nazev: "Eidam 30 % cihla (ČR) cca 2,7 kg",
        cena: 94.9,
        kategorie: "Akční nabídka",
        popis: "",
        hmotnostKg: 2.7
    },
    {
        id: "502010",
        nazev: "Kuba 48 x 50 ml",
        cena: 12.9,
        kategorie: "Stálá nabídka",
        popis: "Tvarohová zmrzlina s čokoládovou polevou",
        kusyVKartonu: 48
    },
    {
        id: "500010",
        nazev: "Mrož jahodový s tvarohem v tmavé polevě 48 x 45 ml",
        cena: 12.9,
        kategorie: "Stálá nabídka",
        popis: "Tvarohová zmrzlina s čokoládovou polevou",
        kusyVKartonu: 48
    }
];

let produkty = [];
let kosik = nactiKosik();
let zpusobDopravy = nactiZpusobDopravy();
let aktivniKategorie = "Vše";
let hledanyText = "";

const formatCena = {
    format(cena) {
        const maDesetiny = !Number.isInteger(cena);

        return new Intl.NumberFormat("cs-CZ", {
            style: "currency",
            currency: "CZK",
            minimumFractionDigits: maDesetiny ? 2 : 0,
            maximumFractionDigits: maDesetiny ? 2 : 0
        }).format(cena);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("hledat").addEventListener("input", vyhledatProdukty);

    document.querySelectorAll(".filter").forEach(button => {
        button.addEventListener("click", () => filtrKategorie(button.dataset.kategorie));
    });

    fetch("Data/produkty.json")
        .then(response => {
            if (!response.ok) {
                throw new Error("Produkty se nepodařilo načíst.");
            }
            return response.json();
        })
        .then(data => {
            produkty = data;
            synchronizujKosik();
            vykresliProdukty();
            vykresliKosik();
        })
        .catch(() => {
            produkty = VYCHOZI_PRODUKTY;
            synchronizujKosik();
            vykresliProdukty();
            vykresliKosik();
        });
});

function vykresliProdukty() {
    const obsah = document.getElementById("obsah");
    const zobrazeno = filtrujProdukty();
    const pocetProduktu = document.getElementById("pocetProduktu");

    if (pocetProduktu) {
        pocetProduktu.textContent = `${zobrazeno.length} ${sklonujProdukt(zobrazeno.length)}`;
    }

    obsah.innerHTML = "";

    if (zobrazeno.length === 0) {
        obsah.innerHTML = `<div class="empty-state">Žádný produkt neodpovídá hledání.</div>`;
        return;
    }

    zobrazeno.forEach(produkt => {
        const index = produkty.findIndex(polozka => polozka.id === produkt.id);

        obsah.insertAdjacentHTML("beforeend", `
            <article class="card">
                <img src="Fotky/${produkt.id}.jpg" alt="${produkt.nazev}" class="product-photo" loading="lazy" onerror="this.replaceWith(vytvorNahledBezFotky('${produkt.id}'))">
                <div class="card-body">
                    <div class="product-meta">
                        <span class="tag">${produkt.kategorie}</span>
                        <span>ID ${produkt.id}</span>
                    </div>
                    <h2>${produkt.nazev}</h2>
                    ${produkt.popis ? `<p class="product-description">${produkt.popis}</p>` : ""}
                    <div class="price-row">
                        <span class="price">
                            ${formatCena.format(produkt.cena)}
                            <small>${popisJednotkyKarty(produkt)}</small>
                        </span>
                        <button class="add-button" type="button" onclick="pridejDoKosiku(${index})">Přidat ${nazevJednotkyProTlacitko(produkt)}</button>
                    </div>
                </div>
            </article>
        `);
    });
}

function filtrujProdukty() {
    return produkty.filter(produkt => {
        const sediKategorie = aktivniKategorie === "Vše" || produkt.kategorie === aktivniKategorie;
        const text = `${produkt.nazev} ${produkt.id} ${produkt.popis || ""}`.toLowerCase();
        const sediHledani = text.includes(hledanyText.toLowerCase().trim());

        return sediKategorie && sediHledani;
    });
}

function filtrKategorie(kategorie) {
    aktivniKategorie = kategorie;

    document.querySelectorAll(".filter").forEach(button => {
        button.classList.toggle("active", button.dataset.kategorie === kategorie);
    });

    vykresliProdukty();
}

function vyhledatProdukty() {
    hledanyText = document.getElementById("hledat").value;
    vykresliProdukty();
}

function pridejDoKosiku(index) {
    const produkt = produkty[index];
    const existuje = kosik.find(polozka => polozka.id === produkt.id);

    if (existuje) {
        existuje.pocet += 1;
    } else {
        kosik.push({
            id: produkt.id,
            pocet: 1
        });
    }

    ulozKosik();
    vykresliKosik();
}

function vykresliKosik() {
    const obsahKosiku = document.getElementById("obsahKosiku");
    const pocetKosik = document.getElementById("pocetKosik");
    const polozky = polozkyKosiku();
    const pocet = polozky.reduce((soucet, polozka) => soucet + polozka.pocet, 0);
    const mezisoucetHalere = polozky.reduce((soucet, polozka) => soucet + cenaPolozkyHalere(polozka.produkt, polozka.pocet), 0);
    const dopravaHalere = zpusobDopravy === "doprava" ? cenaNaHalere(CENA_DOPRAVY) : 0;
    const celkemHalere = mezisoucetHalere + dopravaHalere;

    pocetKosik.textContent = pocet;
    obsahKosiku.innerHTML = "";

    if (polozky.length === 0) {
        obsahKosiku.innerHTML = `<p class="empty-cart">Košík je prázdný.</p>`;
        return;
    }

    polozky.forEach(({ produkt, pocet: pocetKusu, index }) => {
        const cenaPolozky = cenaPolozkyHalere(produkt, pocetKusu);
        const jednotka = nazevJednotkyKosiku(produkt);
        const popisCeny = popisJednotkyKosiku(produkt);

        obsahKosiku.insertAdjacentHTML("beforeend", `
            <div class="cart-item">
                <div>
                    <strong>${produkt.nazev}</strong>
                    <small>ID ${produkt.id} · ${popisCeny}</small>
                </div>
                <div>
                    <strong>${formatCena.format(halereNaKoruny(cenaPolozky))}</strong>
                    <div class="cart-controls">
                        <button type="button" onclick="uberProdukt(${index})" aria-label="Odebrat ${jednotka}">−</button>
                        <span>${pocetKusu} ${jednotka}</span>
                        <button type="button" onclick="pridejKus(${index})" aria-label="Přidat ${jednotka}">+</button>
                    </div>
                </div>
            </div>
        `);
    });

    obsahKosiku.insertAdjacentHTML("beforeend", `
        <div class="delivery-choice">
            <strong>Způsob předání</strong>
            <label>
                <input type="radio" name="zpusobDopravy" value="osobni" ${zpusobDopravy === "osobni" ? "checked" : ""} onchange="nastavZpusobDopravy(this.value)">
                Osobní odběr
            </label>
            <label>
                <input type="radio" name="zpusobDopravy" value="doprava" ${zpusobDopravy === "doprava" ? "checked" : ""} onchange="nastavZpusobDopravy(this.value)">
                Doprava ${formatCena.format(CENA_DOPRAVY)}
            </label>
        </div>
        <div class="cart-total cart-subtotal">
            <span>Mezisoučet</span>
            <span>${formatCena.format(halereNaKoruny(mezisoucetHalere))}</span>
        </div>
        <div class="cart-total cart-subtotal">
            <span>Doprava</span>
            <span>${dopravaHalere ? formatCena.format(halereNaKoruny(dopravaHalere)) : "Osobní odběr"}</span>
        </div>
        <div class="cart-total">
            <span>Celkem</span>
            <span>${formatCena.format(halereNaKoruny(celkemHalere))}</span>
        </div>
    `);
}

function uberProdukt(index) {
    if (kosik[index].pocet > 1) {
        kosik[index].pocet -= 1;
    } else {
        kosik.splice(index, 1);
    }

    ulozKosik();
    vykresliKosik();
}

function pridejKus(index) {
    kosik[index].pocet += 1;
    ulozKosik();
    vykresliKosik();
}

function vyprazdniKosik() {
    kosik = [];
    ulozKosik();
    vykresliKosik();
}

function nastavZpusobDopravy(hodnota) {
    zpusobDopravy = hodnota === "doprava" ? "doprava" : "osobni";
    localStorage.setItem("honzuvMarketDoprava", zpusobDopravy);
    vykresliKosik();
}

function zobrazKosik() {
    document.getElementById("prekryvKosiku").hidden = false;
    document.getElementById("oknoKosiku").hidden = false;
}

function zavriKosik() {
    document.getElementById("prekryvKosiku").hidden = true;
    document.getElementById("oknoKosiku").hidden = true;
}

function odeslatWhatsApp() {
    const polozky = polozkyKosiku();

    if (polozky.length === 0) {
        alert("Košík je prázdný.");
        return;
    }

    const mezisoucetHalere = polozky.reduce((soucet, polozka) => soucet + cenaPolozkyHalere(polozka.produkt, polozka.pocet), 0);
    const dopravaHalere = zpusobDopravy === "doprava" ? cenaNaHalere(CENA_DOPRAVY) : 0;
    const celkemHalere = mezisoucetHalere + dopravaHalere;
    const textPolozky = polozky
        .map(({ produkt, pocet }) => {
            const cenaPolozky = cenaPolozkyHalere(produkt, pocet);
            const jednotka = nazevJednotkyKosiku(produkt);
            const kartonInfo = produkt.kusyVKartonu ? ` (${produkt.kusyVKartonu} ks v kartonu)` : "";
            const kgInfo = produkt.hmotnostKg ? ` (${produkt.hmotnostKg} kg balení)` : "";

            return `${pocet}x ${jednotka} ${produkt.nazev}${kartonInfo}${kgInfo} (ID: ${produkt.id}) - ${formatCena.format(halereNaKoruny(cenaPolozky))}`;
        })
        .join("\n");

    const zprava = [
        "Dobrý den,",
        "",
        "objednávám:",
        "",
        textPolozky,
        "",
        "--------------------",
        `Mezisoučet: ${formatCena.format(halereNaKoruny(mezisoucetHalere))}`,
        `Předání: ${zpusobDopravy === "doprava" ? `Doprava ${formatCena.format(CENA_DOPRAVY)}` : "Osobní odběr"}`,
        `Celkem: ${formatCena.format(halereNaKoruny(celkemHalere))}`,
        "",
        "Děkuji."
    ].join("\n");

    window.open(`https://wa.me/${TELEFON_WHATSAPP}?text=${encodeURIComponent(zprava)}`, "_blank");
}

function ulozKosik() {
    localStorage.setItem("honzuvMarketKosik", JSON.stringify(kosik));
}

function nactiKosik() {
    try {
        return JSON.parse(localStorage.getItem("honzuvMarketKosik")) || [];
    } catch {
        return [];
    }
}

function nactiZpusobDopravy() {
    return localStorage.getItem("honzuvMarketDoprava") === "doprava" ? "doprava" : "osobni";
}

function synchronizujKosik() {
    kosik = kosik
        .map(polozka => ({
            id: String(polozka.id),
            pocet: Number(polozka.pocet) || 0
        }))
        .filter(polozka => polozka.pocet > 0 && produkty.some(produkt => produkt.id === polozka.id));

    ulozKosik();
}

function polozkyKosiku() {
    return kosik
        .map((polozka, index) => ({
            index,
            pocet: polozka.pocet,
            produkt: produkty.find(produkt => produkt.id === polozka.id)
        }))
        .filter(polozka => polozka.produkt);
}

function cenaNaHalere(cena) {
    return Math.round(Number(cena) * 100);
}

function cenaPolozkyHalere(produkt, pocet) {
    return Math.round(cenaNaHalere(produkt.cena) * pocet * mnozstviProVypocet(produkt));
}

function mnozstviProVypocet(produkt) {
    return Number(produkt.kusyVKartonu) || Number(produkt.hmotnostKg) || 1;
}

function halereNaKoruny(halere) {
    return halere / 100;
}

function sklonujProdukt(pocet) {
    if (pocet === 1) {
        return "produkt";
    }

    if (pocet >= 2 && pocet <= 4) {
        return "produkty";
    }

    return "produktů";
}

function popisJednotkyKarty(produkt) {
    if (produkt.kusyVKartonu) {
        return `bez DPH / ks · karton ${produkt.kusyVKartonu} ks`;
    }

    if (produkt.hmotnostKg) {
        return `bez DPH / kg · balení cca ${formatKg(produkt.hmotnostKg)}`;
    }

    return "bez DPH / ks";
}

function popisJednotkyKosiku(produkt) {
    if (produkt.kusyVKartonu) {
        return `${formatCena.format(produkt.cena)} bez DPH za kus · ${produkt.kusyVKartonu} ks v kartonu`;
    }

    if (produkt.hmotnostKg) {
        return `${formatCena.format(produkt.cena)} bez DPH za kg · balení cca ${formatKg(produkt.hmotnostKg)}`;
    }

    return `${formatCena.format(produkt.cena)} bez DPH za kus`;
}

function nazevJednotkyProTlacitko(produkt) {
    if (produkt.kusyVKartonu) {
        return "karton";
    }

    if (produkt.hmotnostKg) {
        return "balení";
    }

    return "";
}

function nazevJednotkyKosiku(produkt) {
    if (produkt.kusyVKartonu) {
        return "karton";
    }

    if (produkt.hmotnostKg) {
        return "balení";
    }

    return "ks";
}

function formatKg(hodnota) {
    return `${String(hodnota).replace(".", ",")} kg`;
}

function vytvorNahledBezFotky(id) {
    const nahled = document.createElement("div");
    nahled.className = "product-photo product-photo-missing";
    nahled.textContent = `Foto ${id}`;
    return nahled;
}
