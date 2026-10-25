/*
 * TeknoSatış · müşteri mağazası
 * Ürün ve kategori verileri Spring Boot REST API'sinden gelir:
 *   GET  /api/categories
 *   POST /api/products/filter        (dinamik filtre)
 *   POST /api/products/filter-page   (filtre + sayfalama + sıralama)
 *   POST /api/order-items/filter     (çok satanlar)
 * Sepet tarayıcıda (localStorage) tutulur.
 */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const app = $("#app");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
  const fmt = (v) => money.format(Number(v || 0));
  const lower = (s) => String(s || "").toLocaleLowerCase("tr");

  // ---------------------------------------------------------------- API
  async function request(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${res.status} · ${(data && data.message) || res.statusText}`);
    return data;
  }
  const api = {
    categories: () => request("GET", "/api/categories"),
    products: (filters = []) => request("POST", "/api/products/filter", { searchRequestDto: filters }),
    productsPage: (filters, params) =>
      request("POST", `/api/products/filter-page?${new URLSearchParams(params)}`, { searchRequestDto: filters }),
    orderItems: () => request("POST", "/api/order-items/filter", {}),
  };

  // ---------------------------------------------------------------- görseller
  // Ürün fotoğrafı olmadığı için her ürüne kategori/isimden türetilmiş bir çizim ve renk veriyoruz.
  const ICONS = {
    laptop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/>',
    desktop: '<rect x="2" y="3" width="14" height="10" rx="2"/><path d="M6 17h6M9 13v4"/><rect x="18" y="3" width="4" height="18" rx="1"/><path d="M20 7h.01"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    mouse: '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v4"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    gpu: '<rect x="2" y="6" width="20" height="11" rx="2"/><circle cx="8" cy="11.5" r="3"/><circle cx="16" cy="11.5" r="3"/><path d="M5 17v3M9 17v3"/>',
    ssd: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h6M7 14h3"/><circle cx="17" cy="12" r="1"/>',
    ram: '<rect x="2" y="7" width="20" height="9" rx="1"/><path d="M6 16v3M10 16v3M14 16v3M18 16v3M6 10h3v3H6zM11 10h3v3h-3zM16 10h3v3h-3z"/>',
    headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
    webcam: '<circle cx="12" cy="10" r="7"/><circle cx="12" cy="10" r="3"/><path d="M8 21h8M12 17v4"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  };
  const HUES = [245, 205, 165, 285, 25, 330, 120, 50];

  function iconFor(product, category) {
    const n = lower(product?.name);
    if (/kulaklık|headphone|wh-/.test(n)) return "headphones";
    if (/webcam|kamera/.test(n)) return "webcam";
    if (/mouse|deathadder/.test(n)) return "mouse";
    if (/ssd|nvme/.test(n)) return "ssd";
    if (/ddr|ram/.test(n)) return "ram";
    if (/rtx|geforce|radeon|ekran kartı/.test(n)) return "gpu";
    if (/ryzen|intel|core i|işlemci/.test(n)) return "chip";
    const c = lower(category?.name || product?.category?.name);
    if (c.includes("laptop") || c.includes("dizüstü")) return "laptop";
    if (c.includes("masaüstü")) return "desktop";
    if (c.includes("monitör")) return "monitor";
    if (c.includes("klavye")) return "keyboard";
    if (c.includes("bileşen")) return "chip";
    if (c.includes("aksesuar")) return "headphones";
    return "box";
  }
  const hueFor = (categoryId) => HUES[((Number(categoryId) || 1) - 1) % HUES.length];
  function visual(product, category, { sku = false } = {}) {
    const cat = category || product?.category;
    return `<div class="visual" style="--h:${hueFor(cat?.id)}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[iconFor(product, cat)]}</svg>
      ${sku && product?.sku ? `<span class="sku">${esc(product.sku)}</span>` : ""}
    </div>`;
  }

  // ---------------------------------------------------------------- veri
  const state = { categories: [], products: [], sales: new Map(), ready: null };

  function loadBase() {
    state.ready ??= Promise.all([api.categories(), api.products(), api.orderItems().catch(() => [])])
      .then(([categories, products, items]) => {
        state.categories = categories;
        state.products = products;
        state.sales = new Map();
        for (const it of items) {
          const id = it.product?.id;
          if (id != null) state.sales.set(id, (state.sales.get(id) || 0) + (it.quantity || 0));
        }
        renderCategoryNav();
      })
      .catch((e) => { state.ready = null; throw e; });
    return state.ready;
  }
  const productById = (id) => state.products.find((p) => String(p.id) === String(id));
  const categoryById = (id) => state.categories.find((c) => String(c.id) === String(id));
  const countIn = (catId) => state.products.filter((p) => p.category?.id === catId).length;

  // ---------------------------------------------------------------- parçalar
  function stockLabel(s) {
    if (s <= 0) return '<span class="stock out">Tükendi</span>';
    if (s <= 3) return `<span class="stock low">Son ${s} ürün</span>`;
    return '<span class="stock ok">Stokta</span>';
  }

  function productCard(p) {
    const sold = state.sales.get(p.id) || 0;
    const out = (p.stockQuantity ?? 0) <= 0;
    const badges = [
      out ? '<span class="pill out">Tükendi</span>' : "",
      !out && sold >= 2 ? '<span class="pill hot">Çok satan</span>' : "",
    ].join("");
    return `<article class="product-card">
      <a href="#/urun/${p.id}" style="position:relative;display:block">
        <div class="badges">${badges}</div>
        ${visual(p, null, { sku: true })}
      </a>
      <div class="product-info">
        <span class="cat">${esc(p.category?.name || "")}</span>
        <a href="#/urun/${p.id}"><h3>${esc(p.name)}</h3></a>
        ${stockLabel(p.stockQuantity ?? 0)}
        <div class="product-bottom">
          <span class="price num">${fmt(p.price)}</span>
          <button class="add-btn" data-add="${p.id}" ${out ? "disabled" : ""} aria-label="${esc(p.name)} sepete ekle" title="Sepete ekle">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      </div>
    </article>`;
  }

  const skeletonGrid = (n = 8) =>
    `<div class="product-grid">${Array.from({ length: n }, () => '<div class="skeleton" style="aspect-ratio:3/4"></div>').join("")}</div>`;

  function errorState(e) {
    return `<div class="container state">
      <h2>Mağaza verileri yüklenemedi</h2>
      <p>Spring Boot uygulaması çalışıyor mu? <code>./mvnw spring-boot:run -Dspring-boot.run.profiles=h2</code></p>
      <p class="muted">${esc(e.message)}</p>
      <button class="btn primary" onclick="location.reload()">Tekrar dene</button>
    </div>`;
  }

  function renderCategoryNav() {
    const route = parseRoute();
    const activeCat = route.name === "list" ? route.params.get("kategori") : null;
    const isAll = route.name === "list" && !activeCat;
    $("#catNav").innerHTML =
      `<a href="#/urunler" class="${isAll ? "active" : ""}">Tüm ürünler</a>` +
      state.categories.map((c) =>
        `<a href="#/urunler?kategori=${c.id}" class="${String(c.id) === activeCat ? "active" : ""}">${esc(c.name)}</a>`).join("");
    $("#footerCats").innerHTML = state.categories
      .map((c) => `<li><a href="#/urunler?kategori=${c.id}">${esc(c.name)}</a></li>`).join("");
  }

  // ---------------------------------------------------------------- ana sayfa
  async function renderHome() {
    app.innerHTML = `<div class="container"><div class="skeleton" style="height:420px;border-radius:28px"></div>
      <div class="section">${skeletonGrid(4)}</div></div>`;
    await loadBase();

    const products = state.products;
    const inStock = products.filter((p) => (p.stockQuantity ?? 0) > 0);
    const bestSellers = [...products].sort((a, b) => (state.sales.get(b.id) || 0) - (state.sales.get(a.id) || 0)).slice(0, 4);
    // Haftanın ürünü: stoktakiler içinde en çok ciro getiren
    const revenue = (p) => (state.sales.get(p.id) || 0) * Number(p.price || 0);
    const featured = [...inStock].sort((a, b) => revenue(b) - revenue(a) || b.price - a.price)[0] || products[0];
    const newest = [...products].sort((a, b) => b.id - a.id).slice(0, 4);
    const promoCat = state.categories.find((c) => lower(c.name).includes("bileşen")) || state.categories[0];

    app.innerHTML = `
      <div class="container">
        <section class="hero">
          <div class="hero-copy">
            <span class="eyebrow">Yeni sezon · 2026</span>
            <h1>Performansı <span>seç</span>,<br>gerisini bize bırak.</h1>
            <p>Laptoptan ekran kartına, monitörden mekanik klavyeye; ihtiyacın olan donanım tek yerde.</p>
            <div class="hero-cta">
              <a class="btn light" href="#/urunler">Alışverişe başla
                <svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg></a>
              ${featured ? `<a class="btn ghost-light" href="#/urun/${featured.id}">Haftanın ürünü</a>` : ""}
            </div>
            <div class="hero-stats">
              <div><strong class="num">${products.length}</strong><span>ürün</span></div>
              <div><strong class="num">${state.categories.length}</strong><span>kategori</span></div>
              <div><strong class="num">${inStock.length}</strong><span>stokta</span></div>
            </div>
          </div>
          ${featured ? `
          <div class="hero-feature">
            <a class="hero-card" href="#/urun/${featured.id}">
              <div class="row"><span class="tag hot">Haftanın ürünü</span><span class="tag soft">${esc(featured.category?.name || "")}</span></div>
              ${visual(featured)}
              <div class="row">
                <h3>${esc(featured.name)}</h3>
                <span class="price num">${fmt(featured.price)}</span>
              </div>
            </a>
          </div>` : ""}
        </section>

        <div class="perks">
          ${perk('<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>', "Hızlı kargo", "Stoktaki ürünlerde aynı gün")}
          ${perk('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', "2 yıl garanti", "Tüm ürünlerde resmi garanti")}
          ${perk('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', "14 gün iade", "Koşulsuz iade hakkı")}
          ${perk('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', "Güvenli ödeme", "Kart, havale ve nakit")}
        </div>

        <section class="section">
          <div class="section-head">
            <div><span class="eyebrow">Kategoriler</span><h2>Ne arıyorsun?</h2></div>
            <a href="#/urunler">Tümünü gör →</a>
          </div>
          <div class="cat-grid">
            ${state.categories.map((c) => `
              <a class="cat-tile" href="#/urunler?kategori=${c.id}">
                ${visual(null, c)}
                <div><strong>${esc(c.name)}</strong><br><span>${countIn(c.id)} ürün</span></div>
              </a>`).join("")}
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <div><span class="eyebrow">En popüler</span><h2>Çok satanlar</h2></div>
            <a href="#/urunler">Tüm ürünler →</a>
          </div>
          <div class="product-grid">${bestSellers.map(productCard).join("")}</div>
        </section>

        ${promoCat ? `
        <section class="section">
          <div class="promo">
            <div>
              <h2>Sistemini yükselt.</h2>
              <p>Ekran kartı, işlemci, RAM ve SSD'lerde yeni nesil performans seni bekliyor.</p>
            </div>
            <a class="btn light" href="#/urunler?kategori=${promoCat.id}">${esc(promoCat.name)} ürünlerini keşfet</a>
          </div>
        </section>` : ""}

        <section class="section">
          <div class="section-head">
            <div><span class="eyebrow">Yeni</span><h2>Yeni gelenler</h2></div>
          </div>
          <div class="product-grid">${newest.map(productCard).join("")}</div>
        </section>
      </div>`;
  }

  function perk(path, title, sub) {
    return `<div class="perk"><svg viewBox="0 0 24 24">${path}</svg><div><strong>${title}</strong><span>${sub}</span></div></div>`;
  }

  // ---------------------------------------------------------------- liste (sunucu tarafı filtre)
  const SORTS = {
    onerilen: { label: "Önerilen", sort: "id,asc" },
    "fiyat-artan": { label: "Fiyat: düşükten yükseğe", sort: "price,asc" },
    "fiyat-azalan": { label: "Fiyat: yüksekten düşüğe", sort: "price,desc" },
    "isim": { label: "İsim (A-Z)", sort: "name,asc" },
    "stok": { label: "Stok miktarı", sort: "stockQuantity,desc" },
  };
  const PAGE_SIZE = 9;

  function listUrl(params, changes = {}) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === "" || v == null || v === false) p.delete(k); else p.set(k, v);
    }
    if (!("sayfa" in changes)) p.delete("sayfa");
    const qs = p.toString();
    return `#/urunler${qs ? `?${qs}` : ""}`;
  }

  async function renderList(params) {
    await loadBase();
    const kategori = params.get("kategori") || "";
    const q = params.get("q") || "";
    const min = params.get("min") || "";
    const max = params.get("max") || "";
    const stokta = params.get("stok") === "1";
    const sortKey = SORTS[params.get("sirala")] ? params.get("sirala") : "onerilen";
    const page = Math.max(0, Number(params.get("sayfa") || 1) - 1);
    const cat = categoryById(kategori);

    // Seçilen filtreler, backend'in beklediği SearchRequestDto listesine dönüşüyor
    const filters = [];
    if (q) filters.push({ column: "name", operation: "LIKE", value: q });
    if (cat) filters.push({ join: "category", column: "id", operation: "EQUAL", value: cat.id });
    if (min) filters.push({ column: "price", operation: "GREATER_THAN", value: Number(min) });
    if (max) filters.push({ column: "price", operation: "LESS_THAN", value: Number(max) });
    if (stokta) filters.push({ column: "stockQuantity", operation: "GREATER_THAN", value: 0 });

    const title = q ? `"${q}" için sonuçlar` : cat ? cat.name : "Tüm ürünler";
    const chips = [
      q && { label: `Arama: ${q}`, url: listUrl(params, { q: "" }) },
      cat && { label: cat.name, url: listUrl(params, { kategori: "" }) },
      min && { label: `En az ${fmt(min)}`, url: listUrl(params, { min: "" }) },
      max && { label: `En çok ${fmt(max)}`, url: listUrl(params, { max: "" }) },
      stokta && { label: "Sadece stoktakiler", url: listUrl(params, { stok: "" }) },
    ].filter(Boolean);

    app.innerHTML = `
      <div class="container">
        <div class="crumbs"><a href="#/">Ana sayfa</a><span>/</span><span>${esc(title)}</span></div>
        <div class="list-layout">
          <aside class="filters" id="filters">
            <div>
              <h4>Kategori</h4>
              <div class="filter-cats">
                <button data-cat="" class="${!cat ? "active" : ""}"><span>Tümü</span><small>${state.products.length}</small></button>
                ${state.categories.map((c) => `<button data-cat="${c.id}" class="${cat && c.id === cat.id ? "active" : ""}">
                  <span>${esc(c.name)}</span><small>${countIn(c.id)}</small></button>`).join("")}
              </div>
            </div>
            <div>
              <h4>Fiyat aralığı (₺)</h4>
              <div class="price-inputs">
                <input class="field-input" id="fmin" type="number" min="0" step="500" placeholder="En az" value="${esc(min)}">
                <input class="field-input" id="fmax" type="number" min="0" step="500" placeholder="En çok" value="${esc(max)}">
              </div>
            </div>
            <label class="check"><input type="checkbox" id="fstock" ${stokta ? "checked" : ""}> Sadece stoktakiler</label>
          </aside>

          <section>
            <div class="list-top">
              <div><h1>${esc(title)}</h1><p class="muted" id="resultCount">Yükleniyor…</p></div>
              <div style="display:flex;gap:8px">
                <button class="btn filter-toggle" id="filterToggle" type="button">
                  <svg viewBox="0 0 24 24"><path d="M22 3H2l8 9.5V19l4 2v-8.5z"/></svg>Filtreler</button>
                <select id="fsort" aria-label="Sırala">
                  ${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${k === sortKey ? "selected" : ""}>${v.label}</option>`).join("")}
                </select>
              </div>
            </div>
            ${chips.length ? `<div class="chips">${chips.map((c) => `<a class="chip" href="${c.url}">${esc(c.label)}
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></a>`).join("")}</div>` : ""}
            <div id="results">${skeletonGrid(6)}</div>
          </section>
        </div>
      </div>`;

    $("#filters").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-cat]");
      if (b) location.hash = listUrl(params, { kategori: b.dataset.cat });
    });
    $("#fmin").addEventListener("change", (e) => { location.hash = listUrl(params, { min: e.target.value }); });
    $("#fmax").addEventListener("change", (e) => { location.hash = listUrl(params, { max: e.target.value }); });
    $("#fstock").addEventListener("change", (e) => { location.hash = listUrl(params, { stok: e.target.checked ? "1" : "" }); });
    $("#fsort").addEventListener("change", (e) => { location.hash = listUrl(params, { sirala: e.target.value === "onerilen" ? "" : e.target.value }); });
    $("#filterToggle").addEventListener("click", () => $("#filters").classList.toggle("open"));

    try {
      const res = await api.productsPage(filters, { page, size: PAGE_SIZE, sort: SORTS[sortKey].sort });
      const items = res.content || [];
      const total = res.totalElements ?? items.length;
      const pages = Math.max(1, res.totalPages ?? 1);
      $("#resultCount").textContent = `${total} ürün bulundu`;
      $("#results").innerHTML = items.length
        ? `<div class="product-grid">${items.map(productCard).join("")}</div>
           ${pages > 1 ? `<nav class="pager" aria-label="Sayfalar">
              <button data-page="${page}" ${page === 0 ? "disabled" : ""} aria-label="Önceki">‹</button>
              ${Array.from({ length: pages }, (_, i) => `<button data-page="${i + 1}" class="${i === page ? "active" : ""}" ${i === page ? 'aria-current="page"' : ""}>${i + 1}</button>`).join("")}
              <button data-page="${page + 2}" ${page + 1 >= pages ? "disabled" : ""} aria-label="Sonraki">›</button>
            </nav>` : ""}`
        : `<div class="state"><h2>Sonuç bulunamadı</h2><p>Filtreleri gevşetmeyi ya da farklı bir arama yapmayı dene.</p>
             <a class="btn primary" href="#/urunler">Filtreleri temizle</a></div>`;
      $("#results").querySelectorAll(".pager button").forEach((b) => b.addEventListener("click", () => {
        location.hash = listUrl(params, { sayfa: b.dataset.page });
      }));
    } catch (e) {
      $("#results").innerHTML = `<div class="state"><h2>Ürünler alınamadı</h2><p class="muted">${esc(e.message)}</p></div>`;
    }
  }

  // ---------------------------------------------------------------- ürün detayı
  async function renderDetail(id) {
    app.innerHTML = `<div class="container detail"><div class="skeleton" style="aspect-ratio:1;border-radius:28px"></div>
      <div class="skeleton" style="height:360px"></div></div>`;
    await loadBase();
    const [fresh] = await api.products([{ column: "id", operation: "EQUAL", value: Number(id) }]);
    const p = fresh || productById(id);
    if (!p) {
      app.innerHTML = `<div class="container state"><h2>Ürün bulunamadı</h2><a class="btn primary" href="#/urunler">Ürünlere dön</a></div>`;
      return;
    }
    const stock = p.stockQuantity ?? 0;
    const similar = state.products.filter((x) => x.category?.id === p.category?.id && x.id !== p.id).slice(0, 4);
    const brand = String(p.name).split(" ")[0];
    let qty = 1;

    app.innerHTML = `
      <div class="container">
        <div class="crumbs"><a href="#/">Ana sayfa</a><span>/</span>
          <a href="#/urunler?kategori=${p.category?.id ?? ""}">${esc(p.category?.name || "Ürünler")}</a><span>/</span><span>${esc(p.name)}</span></div>
        <div class="detail">
          ${visual(p, null, { sku: true })}
          <div class="detail-info">
            <span class="eyebrow">${esc(p.category?.name || "")}</span>
            <h1>${esc(p.name)}</h1>
            ${stockLabel(stock)}
            <div class="detail-price num">${fmt(p.price)}<small>KDV dahil · ücretsiz kargo</small></div>
            <div class="qty-row">
              <div class="qty" aria-label="Adet">
                <button type="button" id="qMinus" aria-label="Azalt">−</button>
                <span id="qVal">1</span>
                <button type="button" id="qPlus" aria-label="Arttır">+</button>
              </div>
              <button class="btn primary" id="addDetail" ${stock <= 0 ? "disabled" : ""}>
                <svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
                ${stock <= 0 ? "Stokta yok" : "Sepete ekle"}
              </button>
            </div>
            <dl class="spec">
              <dt>Marka</dt><dd>${esc(brand)}</dd>
              <dt>Model kodu</dt><dd style="font-family:'SF Mono',Menlo,monospace">${esc(p.sku)}</dd>
              <dt>Kategori</dt><dd>${esc(p.category?.name || "—")}</dd>
              <dt>Stok</dt><dd>${stock > 0 ? `${stock} adet` : "Tükendi"}</dd>
              <dt>Ürün no</dt><dd>#${p.id}</dd>
            </dl>
            <div class="assure">
              <div><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>2 yıl garanti</div>
              <div><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>14 gün iade</div>
              <div><svg viewBox="0 0 24 24"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>Hızlı kargo</div>
            </div>
          </div>
        </div>
        ${similar.length ? `<section class="section">
          <div class="section-head"><div><span class="eyebrow">Benzer ürünler</span><h2>Bunlar da ilgini çekebilir</h2></div></div>
          <div class="product-grid">${similar.map(productCard).join("")}</div>
        </section>` : ""}
      </div>`;

    const max = Math.max(1, stock);
    const sync = () => { $("#qVal").textContent = qty; };
    $("#qMinus").addEventListener("click", () => { qty = Math.max(1, qty - 1); sync(); });
    $("#qPlus").addEventListener("click", () => { qty = Math.min(max, qty + 1); sync(); });
    $("#addDetail").addEventListener("click", () => addToCart(p, qty));
  }

  // ---------------------------------------------------------------- sepet
  const CART_KEY = "teknosatis-cart";
  let cart = (() => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } })();
  const saveCart = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* depolama kapalı */ } };

  function addToCart(p, qty = 1) {
    const stock = p.stockQuantity ?? 0;
    const line = cart.find((l) => l.id === p.id);
    const current = line ? line.qty : 0;
    const next = Math.min(stock, current + qty);
    if (next <= current) { toast(`Stokta yalnızca ${stock} adet var`); return; }
    if (line) line.qty = next; else cart.push({ id: p.id, qty: next });
    saveCart();
    updateCartCount(true);
    toast(`<b>${esc(p.name)}</b> sepete eklendi`);
  }

  function updateCartCount(bump) {
    const n = cart.reduce((s, l) => s + l.qty, 0);
    const el = $("#cartCount");
    el.hidden = n === 0;
    el.textContent = n;
    if (bump) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  }

  function renderCart() {
    const lines = cart.map((l) => ({ ...l, p: productById(l.id) })).filter((l) => l.p);
    const subtotal = lines.reduce((s, l) => s + Number(l.p.price) * l.qty, 0);
    if (!lines.length) {
      $("#cartBody").innerHTML = `<div class="empty-cart">
        <svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
        <strong>Sepetin boş</strong><span>Beğendiğin ürünleri buraya ekleyebilirsin.</span>
        <a class="btn primary" href="#/urunler" data-close>Alışverişe başla</a></div>`;
      $("#cartFoot").innerHTML = "";
      return;
    }
    $("#cartBody").innerHTML = lines.map((l) => `
      <div class="cart-item">
        <a href="#/urun/${l.p.id}" data-close>${visual(l.p)}</a>
        <div>
          <h4>${esc(l.p.name)}</h4>
          <div class="muted" style="font-size:13px">${fmt(l.p.price)}</div>
          <div class="qty" style="margin-top:6px">
            <button type="button" data-dec="${l.id}" aria-label="Azalt">−</button><span>${l.qty}</span>
            <button type="button" data-inc="${l.id}" aria-label="Arttır">+</button>
          </div>
        </div>
        <div class="right">
          <strong class="num">${fmt(Number(l.p.price) * l.qty)}</strong>
          <button class="link-btn" data-remove="${l.id}">Kaldır</button>
        </div>
      </div>`).join("");
    $("#cartFoot").innerHTML = `
      <div class="sum-row"><span>Ara toplam</span><span class="num">${fmt(subtotal)}</span></div>
      <div class="sum-row"><span>Kargo</span><span>Ücretsiz</span></div>
      <div class="sum-row total"><span>Toplam</span><span class="num">${fmt(subtotal)}</span></div>
      <button class="btn primary block" id="checkout">Siparişi tamamla</button>
      <small class="muted" style="text-align:center">Demo: sipariş, örnek müşteri (#${DEMO_CUSTOMER_ID}) adına oluşturulur.</small>`;
  }

  // Giriş sistemi olmadığı için siparişler demo verisindeki ilk müşteri adına verilir
  const DEMO_CUSTOMER_ID = 1;

  async function checkout(button) {
    const lines = cart.filter((l) => productById(l.id));
    if (!lines.length) return;
    button.disabled = true;
    button.textContent = "Sipariş oluşturuluyor…";
    try {
      const order = await request("POST", "/api/orders", {
        customerId: DEMO_CUSTOMER_ID,
        items: lines.map((l) => ({ productId: l.id, quantity: l.qty })),
      });
      cart = [];
      saveCart();
      updateCartCount();
      state.ready = null; // stoklar değişti, ürünleri yeniden yükle
      closeCart();
      toast(`✅ Sipariş #${order.id} oluşturuldu · ${fmt(order.totalPrice)}`, 4000);
      router();
    } catch (e) {
      button.disabled = false;
      button.textContent = "Siparişi tamamla";
      toast(esc(e.message.replace(/^\d+ · /, "")), 5000);
    }
  }

  const drawer = $("#cartDrawer");
  const overlay = $("#overlay");
  function openCart() { loadBase().then(renderCart); drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); overlay.hidden = false; }
  function closeCart() { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); overlay.hidden = true; }
  $("#cartBtn").addEventListener("click", openCart);
  $("#cartClose").addEventListener("click", closeCart);
  overlay.addEventListener("click", closeCart);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });
  drawer.addEventListener("click", (e) => {
    const t = e.target.closest("button, a");
    if (!t) return;
    if (t.hasAttribute("data-close")) { closeCart(); return; }
    const id = Number(t.dataset.inc || t.dataset.dec || t.dataset.remove);
    const line = cart.find((l) => l.id === id);
    if (t.dataset.inc && line) {
      const max = productById(id)?.stockQuantity ?? line.qty;
      if (line.qty < max) line.qty++; else toast(`Stokta yalnızca ${max} adet var`);
    } else if (t.dataset.dec && line) {
      line.qty--;
      if (line.qty <= 0) cart = cart.filter((l) => l.id !== id);
    } else if (t.dataset.remove) {
      cart = cart.filter((l) => l.id !== id);
    } else if (t.id === "checkout") {
      checkout(t);
      return;
    } else return;
    saveCart();
    updateCartCount();
    renderCart();
  });

  // Ürün kartlarındaki "+" butonları (sayfadaki tüm kartlar için tek dinleyici)
  app.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-add]");
    if (!b) return;
    const p = productById(b.dataset.add);
    if (p) addToCart(p, 1);
  });

  // ---------------------------------------------------------------- toast
  let toastTimer;
  function toast(html, ms = 2400) {
    const el = $("#toast");
    el.innerHTML = html;
    el.hidden = false;
    el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  // ---------------------------------------------------------------- arama
  $("#searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#searchInput").value.trim();
    location.hash = q ? `#/urunler?q=${encodeURIComponent(q)}` : "#/urunler";
  });

  // ---------------------------------------------------------------- router
  function parseRoute() {
    const raw = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = raw.split("?");
    const params = new URLSearchParams(qs || "");
    const m = path.match(/^\/urun\/(\d+)$/);
    if (m) return { name: "detail", id: m[1], params };
    if (path.startsWith("/urunler")) return { name: "list", params };
    return { name: "home", params };
  }

  async function router() {
    const route = parseRoute();
    closeCart();
    if (state.categories.length) renderCategoryNav();
    $("#searchInput").value = route.name === "list" ? route.params.get("q") || "" : "";
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    try {
      if (route.name === "detail") await renderDetail(route.id);
      else if (route.name === "list") await renderList(route.params);
      else await renderHome();
      const titles = { home: "TeknoSatış · Bilgisayar ve Donanım Mağazası" };
      document.title = titles[route.name] || `${$("h1")?.textContent || "Ürünler"} · TeknoSatış`;
    } catch (e) {
      app.innerHTML = errorState(e);
    }
  }
  window.addEventListener("hashchange", router);

  // ---------------------------------------------------------------- tema
  const stored = (() => { try { return localStorage.getItem("theme"); } catch { return null; } })();
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = stored || (prefersDark ? "dark" : "light");
  $("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* depolama kapalı */ }
  });

  updateCartCount();
  router();
})();
