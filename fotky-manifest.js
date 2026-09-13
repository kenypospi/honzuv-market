// Skutečné fotky se ověřují při načtení. Nové produkty z Google tabulky
// nepotřebují žádnou ruční aktualizaci seznamu fotografií.
window.HONZUV_MARKET_FOTKY = {};
async function overFotkyProduktu() {
    const seznam = produkty.filter(p => Number.isFinite(cenaProduktu(p.id)) && cenaProduktu(p.id)>0 && ceny[p.id]?.zobrazit !== false);
    let cursor = 0;
    const exists = src => new Promise(resolve => { const image = new Image(); let finished=false; const end=value=>{if(finished)return;finished=true;clearTimeout(timer);resolve(value);}; const timer=setTimeout(()=>end(false),8000); image.onload=()=>end(image.naturalWidth>0); image.onerror=()=>end(false); image.src=src; });
    const worker = async () => { while(cursor<seznam.length) { const p=seznam[cursor++]; for(const ext of ['jpg','png']) { const src=`Fotky/${encodeURIComponent(p.id)}.${ext}`; if(await exists(src)) { window.HONZUV_MARKET_FOTKY[p.id]=src; break; } } } };
    await Promise.all(Array.from({length:Math.min(8,seznam.length)},worker));
}
