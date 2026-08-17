const TELEFON_WHATSAPP = "420607967939";
const CENA_DOPRAVY = 79;
const FILTR_VSE = "__vse__";
const FILTR_AKCE = "__akcni_produkty__";
const FILTR_NEJPRODAVANEJSI = "__nejprodavanejsi__";
const FILTR_NOVINKY = "__novinky__";
const FILTR_VYPRODEJ = "__vyprodej__";
const FILTR_DOPORUCUJEME = "__doporucujeme__";
const FILTR_OBLIBENE = "__oblibene__";
const FILTR_STALA_NABIDKA = "__stala_nabidka__";
let produkty = [];
let ceny = {};
let kosik = nactiKosik();
let zpusobDopravy = nactiZpusobDopravy();
const OBLIBENE_STORAGE_KEY = "honzuv-market-oblibene-v1";
let oblibene = new Set();
try { oblibene = new Set(JSON.parse(localStorage.getItem(OBLIBENE_STORAGE_KEY) || "[]").map(String)); } catch(e) {}
let aktivniKategorie = FILTR_VSE;
let hledanyText = "";
let dodaciAdresa = "";

const formatCena = new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

document.addEventListener("DOMContentLoaded", async () => {
    pridejKontaktDoZahlavi();
    document.getElementById("hledat").addEventListener("input", vyhledatProdukty);

    try {
        const data = await nactiData();
        produkty = data.produkty;
        ceny = data.ceny;
        kategorieNastaveni = data.kategorie;
        nastaveni = data.nastaveni;
        sekceNastaveni = data.sekce;
        podkategorieNastaveni = data.podkategorie;
        synchronizujKosik();
        vytvorFiltry();
        vykresliProdukty();
        vykresliKosik();
    } catch (error) {
        console.error(error);
        document.getElementById("obsah").innerHTML = "<div class=\"empty-state\">Katalog se nepodařilo načíst. Zkuste stránku obnovit.</div>";
    }
});

let kategorieNastaveni = [];
let nastaveni = {};
let sekceNastaveni = [];
let podkategorieNastaveni = [];

async function nactiData() {
    const [produktyCsv, kategorieCsv, nastaveniCsv, sekceCsv, podkategorieCsv] = await Promise.all([
        nactiCsvVolitelne(window.HONZUV_MARKET_PRODUKTY_CSV_URL, "Produkty a ceny"),
        nactiCsvVolitelne(window.HONZUV_MARKET_KATEGORIE_CSV_URL, "Kategorie"),
        nactiCsvVolitelne(window.HONZUV_MARKET_NASTAVENI_CSV_URL, "Nastavení"),
        nactiCsvVolitelne(window.HONZUV_MARKET_SEKCE_CSV_URL, "Sekce"),
        nactiCsvVolitelne(window.HONZUV_MARKET_PODKATEGORIE_CSV_URL, "Podkategorie")
    ]);

    const zakladniKatalog = Array.isArray(window.HONZUV_MARKET_KATALOG)
        ? window.HONZUV_MARKET_KATALOG
        : await (async () => {
            const response = await fetch("katalog.json");
            if (!response.ok) throw new Error("Katalog se nepodařilo načíst.");
            return response.json();
        })();

    const kategorie = kategorieZCsv(kategorieCsv);
    const nastaveniData = nastaveniZCsv(nastaveniCsv);
    const sekce = sekceZCsv(sekceCsv);
    const podkategorie = podkategorieZCsv(podkategorieCsv);
    let produktyData = [];
    try { produktyData = produktyZCsv(produktyCsv); }
    catch (error) { console.error("Produkty a ceny: CSV se nepodařilo zpracovat.", error); }

    const produktyMap = new Map(zakladniKatalog.map(p => [String(p.id), { ...p }]));
    for (const p of produktyData) {
        const id = String(p.id);
        const zakladni = produktyMap.get(id);
        if (!zakladni) {
            produktyMap.set(id, {
                id,
                nazev: p.nazev || `Produkt ${id}`,
                baleni: p.baleni || "dle balení",
                kategorie: p.kategorie || "Ostatní potraviny",
                podkategorie: p.podkategorie || "",
                fotkaSkupiny: ""
            });
            continue;
        }
        produktyMap.set(id, { ...zakladni,
            nazev: p.nazev || zakladni.nazev,
            baleni: p.baleni || zakladni.baleni,
            kategorie: p.kategorie || zakladni.kategorie,
            podkategorie: p.podkategorie || zakladni.podkategorie || ""
        });
    }

    const cenyFinal = produktyData.length ? Object.fromEntries(produktyData.map(p => [String(p.id), {
        cena:p.cena, akce:p.akce, vyprodej:p.vyprodej, zobrazit:p.zobrazit,
        nejprodavanejsi:p.nejprodavanejsi, novinka:p.novinka, doporucujeme:p.doporucujeme
    }])) : { ...(window.HONZUV_MARKET_CENY || {}) };
    return {produkty:[...produktyMap.values()], ceny:cenyFinal, kategorie, nastaveni:nastaveniData, sekce, podkategorie};
}
async function nactiCsvVolitelne(url, nazev) {
    try { return await nactiCsv(url); }
    catch (error) {
        console.warn(`${nazev}: volitelný Google list se nepodařilo načíst.`, error);
        return [];
    }
}
async function nactiCsv(url) {
    const adresa = String(url || "").trim();
    if (!adresa) return [];
    const oddelovac = adresa.includes("?") ? "&" : "?";
    const pokusy = [`${adresa}${oddelovac}_=${Date.now()}`];
    const shoda = adresa.match(/^(https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/[^/]+)\/pub\?.*gid=(\d+)/);
    if (shoda) pokusy.push(`${shoda[1]}/pub?output=csv&single=true&gid=${shoda[2]}&_=${Date.now()}`);
    let posledniChyba;
    for (const pokus of pokusy) {
        try {
            const response = await fetch(pokus, { cache: "no-store", mode: "cors", redirect: "follow" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            if (!text.trim()) throw new Error("Google vrátil prázdný soubor");
            return rozdelCsv(text.replace(/^\uFEFF/, ""));
        } catch (error) { posledniChyba = error; }
    }
    throw new Error(`Google Tabulka není dostupná: ${posledniChyba?.message || "neznámá chyba"}`);
}

function produktyZCsv(rows) {
    if (rows.length < 2) return [];
    const hlavicka = rows[0].map(normalizujText);
    const indexKodu = najdiSloupec(hlavicka, ["kod produktu", "kod"]);
    const indexNazvu = najdiSloupec(hlavicka, ["nazev produktu", "nazev"]);
    const indexBaleni = najdiSloupec(hlavicka, ["baleni"]);
    const indexKategorie = najdiSloupec(hlavicka, ["kategorie"]);
    // V Honzově Marketu je cena v Google tabulce vždy ZA 1 KG.
    // Bereme proto přednostně sloupec "Cena za kg"; pokud má tabulka
    // obecný název "Cena", používáme ho také jako cenu za kg.
    // Publikovaná Honzova tabulka historicky používá název „Cena za balení (Kč)",
    // ale hodnoty v tomto sloupci jsou podle používaného gastro modelu ceny za kg.
    // Přijímáme starý i nový název, aby změna hlavičky nikdy neshodila katalog.
    const indexCenyKg = najdiSloupec(hlavicka, ["cena za kg", "cena kg", "cena", "cena za baleni kc", "cena za baleni"]);
    const indexAkce = najdiSloupec(hlavicka, ["akcni produkt ano ne", "akcni produkt", "akce"]);
    const indexVyprodej = najdiSloupec(hlavicka, ["vyprodej ano ne", "vyprodej"]);
    const indexViditelnosti = najdiSloupec(hlavicka, ["zobrazit na webu ano ne", "zobrazit na webu", "zobrazit"]);
    const indexPodkategorie = najdiSloupec(hlavicka, ["podkategorie"]);
    const indexNejprodavanejsi = najdiSloupec(hlavicka, ["nejprodavanejsi"]);
    const indexNovinka = najdiSloupec(hlavicka, ["novinka"]);
    const indexDoporucujeme = najdiSloupec(hlavicka, ["doporucujeme"]);

    if (indexKodu === -1 || indexCenyKg === -1) {
        throw new Error(`Google tabulka produktů nemá rozpoznaný sloupec ceny. Nalezené sloupce: ${hlavicka.join(", ")}`);
    }

    return rows.slice(1).map(row => ({
        id: String(row[indexKodu] || "").trim(),
        nazev: indexNazvu >= 0 ? String(row[indexNazvu] || "").trim() : "",
        baleni: indexBaleni >= 0 ? String(row[indexBaleni] || "").trim() : "",
        kategorie: indexKategorie >= 0 ? String(row[indexKategorie] || "").trim() : "",
        podkategorie: indexPodkategorie >= 0 ? String(row[indexPodkategorie] || "").trim() : "",
        cena: prevedCenu(row[indexCenyKg]),
        akce: indexAkce >= 0 && /^(ano|yes|1|true)$/i.test(String(row[indexAkce] || "").trim()),
        vyprodej: indexVyprodej >= 0 && /^(ano|yes|1|true)$/i.test(String(row[indexVyprodej] || "").trim()),
        zobrazit: indexViditelnosti < 0 || !/^(ne|no|0|false)$/i.test(String(row[indexViditelnosti] || "").trim()),
        nejprodavanejsi: indexNejprodavanejsi >= 0 && /^(ano|yes|1|true)$/i.test(String(row[indexNejprodavanejsi] || "").trim()),
        novinka: indexNovinka >= 0 && /^(ano|yes|1|true)$/i.test(String(row[indexNovinka] || "").trim()),
        doporucujeme: indexDoporucujeme >= 0 && /^(ano|yes|1|true)$/i.test(String(row[indexDoporucujeme] || "").trim())
    })).filter(p => p.id);
}

function kategorieZCsv(rows) {
    if (rows.length < 2) return [];
    const hlavicka = rows[0].map(normalizujText);
    const iKat = najdiSloupec(hlavicka, ["kategorie"]);
    const iNazev = najdiSloupec(hlavicka, ["nazev na webu", "nazev"]);
    const iZobrazit = najdiSloupec(hlavicka, ["zobrazit"]);
    const iPoradi = najdiSloupec(hlavicka, ["poradi"]);
    if (iKat < 0) return [];
    return rows.slice(1).map(row => ({
        kategorie: String(row[iKat] || "").trim(),
        nazev: iNazev >= 0 ? String(row[iNazev] || "").trim() : String(row[iKat] || "").trim(),
        zobrazit: !/^(ne|no|0|false)$/i.test(String(row[iZobrazit] || "").trim()),
        poradi: Number(row[iPoradi]) || 9999
    })).filter(k => k.kategorie && k.zobrazit).sort((a,b) => a.poradi-b.poradi);
}

function sekceZCsv(rows) {
    if (rows.length < 2) return [];
    const h=rows[0].map(normalizujText), is=najdiSloupec(h,["sekce"]), inaz=najdiSloupec(h,["nazev na webu","nazev"]), iz=najdiSloupec(h,["zobrazit"]), ip=najdiSloupec(h,["poradi"]);
    return rows.slice(1).map(r=>({sekce:String(r[is]||"").trim(),nazev:String(r[inaz]||r[is]||"").trim(),zobrazit:!/^(ne|no|0|false)$/i.test(String(r[iz]||"").trim()),poradi:Number(r[ip])||9999})).filter(x=>x.sekce&&x.zobrazit).sort((a,b)=>a.poradi-b.poradi);
}
function podkategorieZCsv(rows) {
    if (rows.length < 2) return [];
    const h=rows[0].map(normalizujText), ik=najdiSloupec(h,["kategorie"]), ipod=najdiSloupec(h,["podkategorie"]), inaz=najdiSloupec(h,["nazev na webu","nazev"]), iz=najdiSloupec(h,["zobrazit"]), iord=najdiSloupec(h,["poradi"]);
    return rows.slice(1).map(r=>({kategorie:String(r[ik]||"").trim(),podkategorie:String(r[ipod]||"").trim(),nazev:String(r[inaz]||r[ipod]||"").trim(),zobrazit:!/^(ne|no|0|false)$/i.test(String(r[iz]||"").trim()),poradi:Number(r[iord])||9999})).filter(x=>x.kategorie&&x.podkategorie&&x.zobrazit).sort((a,b)=>a.kategorie.localeCompare(b.kategorie,"cs")||a.poradi-b.poradi);
}

function nastaveniZCsv(rows) {
    const result = {};
    if (rows.length < 2) return result;
    const hlavicka = rows[0].map(normalizujText);
    const iKlic = najdiSloupec(hlavicka, ["klic", "klíč"]);
    const iHodnota = najdiSloupec(hlavicka, ["hodnota"]);
    if (iKlic < 0 || iHodnota < 0) return result;
    rows.slice(1).forEach(row => {
        const klic = String(row[iKlic] || "").trim();
        if (klic) result[klic] = String(row[iHodnota] || "").trim();
    });
    return result;
}

function cenyZCsv(csv) {
    return produktyZCsv(rozdelCsv(csv));
}

function rozdelCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    const delimiter = text.includes(";") ? ";" : ",";

    for (let i = 0; i < text.length; i += 1) {
        const znak = text[i];
        const dalsiZnak = text[i + 1];
        if (znak === '"' && inQuotes && dalsiZnak === '"') {
            cell += '"';
            i += 1;
        } else if (znak === '"') {
            inQuotes = !inQuotes;
        } else if (znak === delimiter && !inQuotes) {
            row.push(cell.trim());
            cell = "";
        } else if ((znak === "\n" || znak === "\r") && !inQuotes) {
            if (znak === "\r" && dalsiZnak === "\n") i += 1;
            row.push(cell.trim());
            if (row.some(hodnota => hodnota)) rows.push(row);
            row = [];
            cell = "";
        } else {
            cell += znak;
        }
    }

    row.push(cell.trim());
    if (row.some(hodnota => hodnota)) rows.push(row);
    return rows;
}

function normalizujText(hodnota) {
    return String(hodnota)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function najdiSloupec(hlavicka, moznosti) {
    return hlavicka.findIndex(nazev => moznosti.includes(nazev));
}

function prevedCenu(hodnota) {
    const cislo = String(hodnota ?? "")
        .replace(/\s/g, "")
        .replace(/Kč/gi, "")
        .replace(",", ".")
        .replace(/[^0-9.-]/g, "");
    if (!cislo) return NaN;
    return Number(cislo);
}

function pridejKontaktDoZahlavi() {
    const kontakt = document.createElement("a");
    kontakt.className = "contact-phone";
    kontakt.href = "tel:+420607967939";
    kontakt.textContent = "Kontakt: 607 967 939";
    kontakt.setAttribute("aria-label", "Kontakt: 607 967 939");
    const kosikoveTlacitko = document.querySelector(".cart-button");
    kosikoveTlacitko.parentElement.insertBefore(kontakt, kosikoveTlacitko);
}

function vytvorFiltry() {
    const filtry=document.querySelector(".filters");
    const map={akce:FILTR_AKCE,nejprodavanejsi:FILTR_NEJPRODAVANEJSI,novinky:FILTR_NOVINKY,vyprodej:FILTR_VYPRODEJ,doporucujeme:FILTR_DOPORUCUJEME};
    const sekce=(sekceNastaveni.length?sekceNastaveni:[
        {sekce:"akce",nazev:nastaveni.akce_nazev||"Akční nabídka"},
        {sekce:"nejprodavanejsi",nazev:"Nejprodávanější"},
        {sekce:"novinky",nazev:"Novinky"},
        {sekce:"vyprodej",nazev:nastaveni.vyprodej_nazev||"Výprodej"},
        {sekce:"doporucujeme",nazev:"Doporučujeme"}
    ]).filter(s=>map[s.sekce]);
    const buttons=[[FILTR_VSE,"Vše"],...sekce.map(s=>[map[s.sekce],s.nazev])];
    filtry.innerHTML=buttons.map(([v,n])=>`<button class="filter" type="button" data-kategorie="${escapeHtml(v)}">${escapeHtml(n)}</button>`).join("");
    filtry.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>filtrKategorie(b.dataset.kategorie)));

    const list=document.getElementById("seznamKategorii");
    const zdrojKategorii=kategorieNastaveni.length?kategorieNastaveni:[...new Set(produkty.map(p=>p.kategorie))].map(k=>({kategorie:k,nazev:k,zobrazit:true,poradi:9999}));
    const poradiMrazenych=Number(zdrojKategorii.find(k=>k.kategorie==="Mražené výrobky")?.poradi)||4;
    const kats=zdrojKategorii.slice().sort((a,b)=>{
        const poradiKategorie = k => k.kategorie === "Zmrzliny" ? poradiMrazenych + 0.1 : Number(k.poradi) || 9999;
        return poradiKategorie(a)-poradiKategorie(b);
    });
    list.innerHTML=kats.map(k=>{
        // U Masa zobrazujeme pouze hlavní skupinu, bez Kuřecí/Vepřové/Hovězí atd.
        const subs=k.kategorie === "Maso"
            ? []
            : podkategorieNastaveni.filter(s=>s.kategorie===k.kategorie);
        const pocet=produkty.filter(p=>p.kategorie===k.kategorie&&jeProduktViditelny(p.id)).length;
        return `<div class="category-group"><button class="category-link" type="button" data-kategorie="${escapeHtml(k.kategorie)}"><span>${escapeHtml(k.nazev)}</span><strong>${pocet}</strong></button>${subs.length?`<div class="subcategory-list">${subs.map(s=>{const n=produkty.filter(p=>p.kategorie===s.kategorie&&p.podkategorie===s.podkategorie&&jeProduktViditelny(p.id)).length;return `<button class="subcategory-link" type="button" data-pod="${escapeHtml(s.kategorie+"||"+s.podkategorie)}"><span>${escapeHtml(s.nazev)}</span><strong>${n}</strong></button>`;}).join("")}</div>`:""}</div>`;
    }).join("");
    list.querySelectorAll(".category-link").forEach(b=>b.addEventListener("click",()=>filtrKategorie(b.dataset.kategorie)));
    list.querySelectorAll(".subcategory-link").forEach(b=>b.addEventListener("click",()=>filtrKategorie("__podkategorie__"+b.dataset.pod)));
    nastavAktivniTlacitko();
}
function zobrazNazevKategorie(kategorie) {
    return kategorieNastaveni.find(k => k.kategorie === kategorie)?.nazev || kategorie;
}

function vykresliProdukty() {
    const obsah = document.getElementById("obsah");
    const zobrazeno = filtrujProdukty();
    obsah.innerHTML = "";

    if (zobrazeno.length === 0) {
        const zprava = aktivniKategorie === FILTR_OBLIBENE
            ? `<div class="favorites-empty"><div class="favorites-empty-icon">♡</div><h3>Zatím nemáte žádné oblíbené produkty</h3><p>U produktu klikněte na srdíčko a uloží se vám sem pro příště.</p></div>`
            : aktivniKategorie === FILTR_AKCE
                ? "Zatím zde není žádné akční zboží. V Google tabulce produkt označte ve sloupci Akční produkt jako Ano."
                : aktivniKategorie === FILTR_VYPRODEJ
                    ? "Zatím zde není žádný produkt ve výprodeji. V Google tabulce jej označte ve sloupci Výprodej jako Ano."
                    : "Žádný produkt neodpovídá hledání.";
        obsah.innerHTML = `<div class="empty-state">${zprava}</div>`;
        return;
    }

    zobrazeno.forEach(produkt => {
        const cena = cenaProduktu(produkt.id);
        const cenaKg = cenaZaKgProduktu(produkt.id);
        const index = produkty.findIndex(polozka => polozka.id === produkt.id);
        const maCenu = Number.isFinite(cena);
        const pocetVKosiku = mnozstviProduktuVKosiku(produkt.id);
        obsah.insertAdjacentHTML("beforeend", `
            <article class="card">
                <img src="Fotky/${encodeURIComponent(produkt.id)}.jpg" alt="${escapeHtml(produkt.nazev)}" class="product-photo" onerror="nahradFotkuSkupiny(this, '${escapeJs(produkt.fotkaSkupiny)}')" loading="lazy">
                <div class="card-body">
                    <div class="product-meta">
                        <span class="tag">${escapeHtml(zobrazNazevKategorie(produkt.kategorie))}</span>
                        ${jeAkcni(produkt.id) ? '<span class="tag sale-tag">AKCE</span>' : ''}
                        <span>ID ${escapeHtml(produkt.id)}</span>
                    </div>
                    <h2>${escapeHtml(produkt.nazev)}</h2>
                    <p class="product-description">Balení: ${escapeHtml(produkt.baleni)}${produkt.podkategorie ? ` · ${escapeHtml(produkt.podkategorie)}` : ""}</p>
                    <div class="price-row">
                        <span class="price ${maCenu ? "" : "price-unavailable"}">
                            ${maCenu ? `${formatCena.format(cenaKg)}/kg` : "Cena bude doplněna"}
                            <small>${maCenu ? `${escapeHtml(produkt.baleni)} → ${formatCena.format(cena)}/bal.` : ""}</small>
                        </span>
                        <div class="product-actions">
                            ${pocetVKosiku > 0 ? `<div class="card-quantity" aria-label="Množství v košíku"><button type="button" onclick="zmenMnozstviProduktu('${escapeJs(produkt.id)}',-1)">−</button><strong>${pocetVKosiku}</strong><button type="button" onclick="zmenMnozstviProduktu('${escapeJs(produkt.id)}',1)">+</button></div>` : `<button class="add-button" type="button" onclick="pridejDoKosiku(${index}, this)" ${maCenu ? "" : "disabled"}>${maCenu ? "Přidat" : "Není skladem"}</button>`}
                            <button class="favorite-product-button ${jeOblibeny(produkt.id) ? "is-favorite" : ""}" type="button" data-oblibene="${escapeHtml(produkt.id)}" aria-label="${jeOblibeny(produkt.id) ? "Odebrat z oblíbených" : "Přidat do oblíbených"}" title="${jeOblibeny(produkt.id) ? "Odebrat z oblíbených" : "Přidat do oblíbených"}">${jeOblibeny(produkt.id) ? "♥" : "♡"}</button>
                        </div>
                    </div>
                </div>
            </article>
        `);
    });
}

function ulozOblibene(){localStorage.setItem(OBLIBENE_STORAGE_KEY,JSON.stringify([...oblibene]));}
function jeOblibeny(id){return oblibene.has(String(id));}
function aktualizujOblibeneUI(){
    const count=document.getElementById("favoritesCount");
    if(count) count.textContent=String(oblibene.size);
    const actions=document.getElementById("favoritesActions");
    if(actions) actions.hidden=oblibene.size===0;
    const hero=document.getElementById("favoritesHero");
    if(hero){
        hero.classList.toggle("is-active", aktivniKategorie===FILTR_OBLIBENE);
        hero.setAttribute("aria-pressed", aktivniKategorie===FILTR_OBLIBENE ? "true" : "false");
    }
}
function prepinOblibene(id){
    const k=String(id); if(oblibene.has(k))oblibene.delete(k);else oblibene.add(k);
    ulozOblibene(); aktualizujOblibeneUI(); vykresliProdukty();
}
function pridejOblibeneDoKosiku(){
    [...oblibene].forEach(id=>{const i=produkty.findIndex(p=>String(p.id)===String(id));if(i>=0&&jeProduktViditelny(id)&&Number.isFinite(cenaProduktu(id)))pridejDoKosiku(i);});
    zobrazKosik();
}
function filtrujProdukty() {
    const hledani=hledanyText.toLocaleLowerCase("cs-CZ").trim();
    return produkty.filter(p=>{
        if(!jeProduktViditelny(p.id)) return false;
        let ok;
        if(aktivniKategorie===FILTR_VSE) ok=true;
        else if(aktivniKategorie===FILTR_AKCE) ok=jeAkcni(p.id);
        else if(aktivniKategorie===FILTR_NEJPRODAVANEJSI) ok=jeNejprodavanejsi(p.id);
        else if(aktivniKategorie===FILTR_NOVINKY) ok=jeNovinka(p.id);
        else if(aktivniKategorie===FILTR_VYPRODEJ) ok=jeVyprodej(p.id);
        else if(aktivniKategorie===FILTR_DOPORUCUJEME) ok=jeDoporucujeme(p.id);
        else if(aktivniKategorie===FILTR_OBLIBENE) ok=jeOblibeny(p.id);
        else if(aktivniKategorie===FILTR_STALA_NABIDKA) ok=jeStalaNabidka(p.id);
        else if(aktivniKategorie.startsWith("__podkategorie__")) { const [k,pod]=aktivniKategorie.slice(16).split("||"); ok=p.kategorie===k&&p.podkategorie===pod; }
        else ok=p.kategorie===aktivniKategorie;
        const text=`${p.nazev} ${p.id} ${p.baleni} ${p.kategorie} ${p.podkategorie||""}`.toLocaleLowerCase("cs-CZ");
        return ok&&text.includes(hledani);
    });
}
function filtrKategorie(kategorie) {
    aktivniKategorie = kategorie;
    nastavAktivniTlacitko();
    vykresliProdukty();
}

function nastavAktivniTlacitko() {
    document.querySelectorAll(".filter").forEach(tlacitko => {
        tlacitko.classList.toggle("active", tlacitko.dataset.kategorie === aktivniKategorie);
    });
    const hero=document.getElementById("favoritesHero");
    if(hero) hero.classList.toggle("is-active", aktivniKategorie===FILTR_OBLIBENE);
    document.querySelectorAll(".category-link").forEach(tlacitko => {
        tlacitko.classList.toggle("active", tlacitko.dataset.kategorie === aktivniKategorie);
    });
}

function vyhledatProdukty() {
    hledanyText = document.getElementById("hledat").value;
    vykresliProdukty();
}

function nahradFotkuSkupiny(obrazek, souborSkupiny) {
    if (obrazek.dataset.nahradniFotka === "ano") {
        obrazek.replaceWith(vytvorNahledBezFotky());
        return;
    }
    obrazek.dataset.nahradniFotka = "ano";
    obrazek.src = `Fotky/skupiny/${encodeURIComponent(souborSkupiny)}`;
}

function vytvorNahledBezFotky() {
    const nahled = document.createElement("div");
    nahled.className = "product-photo product-photo-missing";
    nahled.textContent = "Fotografie bude doplněna";
    return nahled;
}

function pridejDoKosiku(index, tlacitko) {
    const produkt = produkty[index];
    if (!produkt || !Number.isFinite(cenaProduktu(produkt.id))) return;
    const existuje = kosik.find(polozka => polozka.id === produkt.id);
    if (existuje) existuje.pocet += 1;
    else kosik.push({ id: produkt.id, pocet: 1 });
    ulozKosik();
    vykresliKosik();
    if (tlacitko) {
        tlacitko.textContent = "✓ Přidáno";
        tlacitko.disabled = true;
        setTimeout(vykresliProdukty, 450);
    } else {
        vykresliProdukty();
    }
}

function mnozstviProduktuVKosiku(id) {
    return kosik.find(polozka => polozka.id === String(id))?.pocet || 0;
}

function zmenMnozstviProduktu(id, rozdil) {
    const polozka = kosik.find(p => p.id === String(id));
    if (!polozka && rozdil > 0) kosik.push({ id: String(id), pocet: 1 });
    else if (polozka) polozka.pocet += rozdil;
    kosik = kosik.filter(p => p.pocet > 0);
    ulozKosik();
    vykresliKosik();
    vykresliProdukty();
}

function vykresliKosik() {
    const obsahKosiku = document.getElementById("obsahKosiku");
    const polozky = polozkyKosiku();
    const pocet = polozky.reduce((soucet, polozka) => soucet + polozka.pocet, 0);
    document.getElementById("pocetKosik").textContent = pocet;
    const hodnotaKosiku = polozky.reduce((soucet, polozka) => soucet + polozka.cena * polozka.pocet, 0);
    document.getElementById("kosikHodnota").textContent = formatCena.format(hodnotaKosiku);

    const vstupAdresy = document.getElementById("dodaciAdresa");
    if (vstupAdresy) dodaciAdresa = vstupAdresy.value;
    obsahKosiku.innerHTML = "";
    if (polozky.length === 0) {
        obsahKosiku.innerHTML = "<p class=\"empty-cart\">Košík je prázdný.</p>";
        return;
    }

    const mezisoucet = polozky.reduce((soucet, polozka) => soucet + polozka.cena * polozka.pocet, 0);
    const cenaDopravy = Number(nastaveni.cena_dopravy) || CENA_DOPRAVY;
    const doprava = zpusobDopravy === "doprava" ? cenaDopravy : 0;
    polozky.forEach(({ produkt, pocet: mnozstvi, index, cena }) => {
        obsahKosiku.insertAdjacentHTML("beforeend", `
            <div class="cart-item">
                <div><strong>${escapeHtml(produkt.nazev)}</strong><small>${escapeHtml(produkt.baleni)} · ${formatCena.format(cenaZaKgProduktu(produkt.id))}/kg</small><small>${formatCena.format(cena)} / bal.</small></div>
                <div>
                    <strong>${formatCena.format(cena * mnozstvi)}</strong>
                    <div class="cart-controls">
                        <button type="button" onclick="uberProdukt(${index})" aria-label="Odebrat">−</button>
                        <span>${mnozstvi} bal.</span>
                        <button type="button" onclick="pridejKus(${index})" aria-label="Přidat">+</button>
                    </div>
                </div>
            </div>
        `);
    });

    obsahKosiku.insertAdjacentHTML("beforeend", `
        <div class="delivery-choice">
            <strong>Způsob předání</strong>
            <label><input type="radio" name="zpusobDopravy" value="osobni" ${zpusobDopravy === "osobni" ? "checked" : ""} onchange="nastavZpusobDopravy(this.value)"> Osobní odběr</label>
            <label><input type="radio" name="zpusobDopravy" value="doprava" ${zpusobDopravy === "doprava" ? "checked" : ""} onchange="nastavZpusobDopravy(this.value)"> Doprava ${formatCena.format(cenaDopravy)}</label>
            ${zpusobDopravy === "doprava" ? `<label class="delivery-address" for="dodaciAdresa"><span>Dodací adresa <em>*</em></span><textarea id="dodaciAdresa" rows="3" autocomplete="street-address" required placeholder="Ulice a číslo, město, PSČ" oninput="ulozDodaciAdresu(this.value)">${escapeHtml(dodaciAdresa)}</textarea></label>` : ""}
        </div>
        <div class="cart-total cart-subtotal"><span>Mezisoučet</span><span>${formatCena.format(mezisoucet)}</span></div>
        <div class="cart-total cart-subtotal"><span>Doprava</span><span>${doprava ? formatCena.format(doprava) : "Osobní odběr"}</span></div>
        <div class="cart-total"><span>Celkem</span><span>${formatCena.format(mezisoucet + doprava)}</span></div>
    `);
}

function ulozDodaciAdresu(adresa) { dodaciAdresa = adresa; }
function uberProdukt(index) { if (kosik[index].pocet > 1) kosik[index].pocet -= 1; else kosik.splice(index, 1); ulozKosik(); vykresliKosik(); vykresliProdukty(); }
function pridejKus(index) { kosik[index].pocet += 1; ulozKosik(); vykresliKosik(); vykresliProdukty(); }
function vyprazdniKosik() { kosik = []; ulozKosik(); vykresliKosik(); vykresliProdukty(); }
function nastavZpusobDopravy(hodnota) { zpusobDopravy = hodnota === "doprava" ? "doprava" : "osobni"; localStorage.setItem("honzuvMarketDoprava", zpusobDopravy); vykresliKosik(); }
function zobrazKosik() { document.getElementById("prekryvKosiku").hidden = false; document.getElementById("oknoKosiku").hidden = false; }
function zavriKosik() { document.getElementById("prekryvKosiku").hidden = true; document.getElementById("oknoKosiku").hidden = true; }

function odeslatWhatsApp() {
    const polozky = polozkyKosiku();
    if (polozky.length === 0) { alert("Košík je prázdný."); return; }
    const adresa = document.getElementById("dodaciAdresa")?.value.trim() || dodaciAdresa.trim();
    if (zpusobDopravy === "doprava" && !adresa) { alert("Pro dopravu prosím vyplňte dodací adresu."); document.getElementById("dodaciAdresa")?.focus(); return; }

    const mezisoucet = polozky.reduce((soucet, polozka) => soucet + polozka.cena * polozka.pocet, 0);
    const cenaDopravy = Number(nastaveni.cena_dopravy) || CENA_DOPRAVY;
    const doprava = zpusobDopravy === "doprava" ? cenaDopravy : 0;
    const zprava = [
        "Dobrý den,", "", "objednávám:", "",
        ...polozky.flatMap(({ produkt, pocet, cena }) => [
            `${produkt.nazev} (ID: ${produkt.id})`,
            `${pocet} bal. · ${produkt.baleni}`,
            `${formatCena.format(cena)} / bal.`,
            `${formatCena.format(cenaZaKgProduktu(produkt.id))} / kg`,
            `Celkem položka: ${formatCena.format(cena * pocet)}`,
            ""
        ]),
        "", "--------------------", `Mezisoučet: ${formatCena.format(mezisoucet)}`,
        `Předání: ${zpusobDopravy === "doprava" ? `Doprava ${formatCena.format(doprava)}` : "Osobní odběr"}`,
        ...(zpusobDopravy === "doprava" ? [`Dodací adresa: ${adresa}`] : []),
        `Celkem: ${formatCena.format(mezisoucet + doprava)}`, "", "Děkuji."
    ].join("\n");
    window.open(`https://wa.me/${TELEFON_WHATSAPP}?text=${encodeURIComponent(zprava)}`, "_blank");
}

function polozkyKosiku() {
    return kosik.map((polozka, index) => {
        const produkt = produkty.find(hledanyProdukt => hledanyProdukt.id === polozka.id);
        return { index, produkt, pocet: polozka.pocet, cena: produkt ? cenaProduktu(produkt.id) : NaN };
    }).filter(polozka => polozka.produkt && Number.isFinite(polozka.cena));
}

function koeficientBaleni(baleni) {
    const text = String(baleni || "")
        .toLocaleLowerCase("cs-CZ")
        .replace(/\u00a0/g, " ")
        .replace(",", ".")
        .trim();

    // "1 x 5 kg", "2 x 2.5 kg", "1 x 800 g"
    const nasobene = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g)\b/);
    if (nasobene) {
        const pocet = Number(nasobene[1]);
        const hmotnost = Number(nasobene[2]);
        const kg = nasobene[3] === "g" ? hmotnost / 1000 : hmotnost;
        return pocet * kg;
    }

    // "10 kg", "cca 2.5 kg", "800 g"
    const jednaHmotnost = text.match(/(\d+(?:\.\d+)?)\s*(kg|g)\b/);
    if (jednaHmotnost) {
        const hmotnost = Number(jednaHmotnost[1]);
        return jednaHmotnost[2] === "g" ? hmotnost / 1000 : hmotnost;
    }

    // Váhové zboží nemá pevné balení – cena zůstává za 1 kg.
    return 1;
}

// DŮLEŽITÉ: cena uložená v Google tabulce = cena ZA 1 KG.
// Web ji vždy přepočítá podle skutečné hmotnosti balení.
function cenaProduktu(id) {
    const hodnota = ceny[String(id)];
    const cenaZaKg = typeof hodnota === "number" ? hodnota : Number(hodnota?.cena);
    if (!Number.isFinite(cenaZaKg)) return NaN;

    const produkt = produkty.find(p => p.id === String(id));
    const kgVBaleni = koeficientBaleni(produkt?.baleni);
    return cenaZaKg * kgVBaleni;
}

function cenaZaKgProduktu(id) {
    const hodnota = ceny[String(id)];
    const cenaZaKg = typeof hodnota === "number" ? hodnota : Number(hodnota?.cena);
    return Number.isFinite(cenaZaKg) ? cenaZaKg : NaN;
}

function maPriznak(id,klic){const h=ceny[String(id)];return typeof h==="object"&&h?.[klic]===true&&Number.isFinite(cenaProduktu(id));}
function jeNejprodavanejsi(id){return maPriznak(id,"nejprodavanejsi");}
function jeNovinka(id){return maPriznak(id,"novinka");}
function jeDoporucujeme(id){return maPriznak(id,"doporucujeme");}

function jeAkcni(id) {
    const hodnota = ceny[String(id)];
    return typeof hodnota === "object" && hodnota?.akce === true && Number.isFinite(cenaProduktu(id));
}

function jeVyprodej(id) {
    const hodnota = ceny[String(id)];
    return typeof hodnota === "object" && hodnota?.vyprodej === true && Number.isFinite(cenaProduktu(id));
}

function jeStalaNabidka(id) {
    return Number.isFinite(cenaProduktu(id)) && !jeAkcni(id) && !jeVyprodej(id);
}

function jeProduktViditelny(id) {
    const hodnota = ceny[String(id)];
    return Number.isFinite(cenaProduktu(id)) &&
        (typeof hodnota !== "object" || hodnota?.zobrazit !== false);
}

function ulozKosik() { localStorage.setItem("honzuvMarketKosik", JSON.stringify(kosik)); }
function nactiKosik() { try { return JSON.parse(localStorage.getItem("honzuvMarketKosik")) || []; } catch { return []; } }
function nactiZpusobDopravy() { return localStorage.getItem("honzuvMarketDoprava") === "doprava" ? "doprava" : "osobni"; }
function synchronizujKosik() { kosik = kosik.map(polozka => ({ id: String(polozka.id), pocet: Number(polozka.pocet) || 0 })).filter(polozka => polozka.pocet > 0 && produkty.some(produkt => produkt.id === polozka.id) && Number.isFinite(cenaProduktu(polozka.id))); ulozKosik(); }
function escapeHtml(hodnota) { return String(hodnota ?? "").replace(/[&<>'\"]/g, znak => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[znak]); }
function escapeJs(hodnota) { return String(hodnota ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }


document.addEventListener("click",(event)=>{
    const b=event.target.closest("[data-oblibene]");
    if(!b)return;
    event.preventDefault(); event.stopPropagation(); prepinOblibene(b.dataset.oblibene);
});
document.addEventListener("DOMContentLoaded",()=>{
    const hero=document.getElementById("favoritesHero");
    if(hero)hero.addEventListener("click",()=>filtrKategorie(FILTR_OBLIBENE));
    const addAll=document.getElementById("addAllFavorites");
    if(addAll)addAll.addEventListener("click",pridejOblibeneDoKosiku);
    aktualizujOblibeneUI();
});
