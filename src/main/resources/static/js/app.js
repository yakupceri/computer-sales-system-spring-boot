/*
 * TeknoSatış Yönetim Paneli
 * Spring Boot REST API'sini (POST /api/{kaynak}/filter, /filter-page, GET /api/categories) kullanan
 * bağımlılıksız tek sayfalık arayüz.
 */
(() => {
  "use strict";

  // ---------------------------------------------------------------- yardımcılar
  const $ = (sel, root = document) => root.querySelector(sel);
  const view = $("#view");

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat("tr-TR");
  const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  const dateTimeFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const fmtMoney = (v) => money.format(Number(v || 0));
  const fmtDate = (v) => (v ? dateFmt.format(new Date(v)) : "—");
  const fmtDateTime = (v) => (v ? dateTimeFmt.format(new Date(v)) : "—");
  const initials = (c) => ((c?.firstName?.[0] || "") + (c?.lastName?.[0] || "")).toUpperCase();
  const fullName = (c) => (c ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() : "—");

  const PAYMENT = {
    CREDIT_CARD: { label: "Kredi Kartı", cls: "blue" },
    TRANSFER: { label: "Havale / EFT", cls: "green" },
    CASH: { label: "Nakit", cls: "amber" },
  };
  const paymentBadge = (m) => {
    const p = PAYMENT[m] || { label: m || "—", cls: "" };
    return `<span class="badge ${p.cls}">${esc(p.label)}</span>`;
  };
  const stockBadge = (s) => {
    if (s <= 0) return `<span class="badge red">Tükendi</span>`;
    if (s <= 3) return `<span class="badge amber">Kritik · ${num.format(s)}</span>`;
    return `<span class="badge green">${num.format(s)} adet</span>`;
  };

  const icon = {
    revenue: '<svg viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    orders: '<svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg>',
    users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/></svg>',
    box: '<svg viewBox="0 0 24 24"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>',
  };

  // ---------------------------------------------------------------- API
  const api = {
    async request(method, url, body) {
      const res = await fetch(url, {
        method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (!res.ok) {
        const msg = (data && data.errors && data.errors[0] && data.errors[0].defaultMessage) || (data && data.message) || res.statusText || "İstek başarısız";
        const err = new Error(`${res.status} · ${msg}`);
        err.status = res.status;
        throw err;
      }
      return data;
    },
    filter(resource, filters = [], globalOperator = "AND") {
      return this.request("POST", `/api/${resource}/filter`, { searchRequestDto: filters, globalOperator });
    },
    filterPage(resource, filters, params) {
      const qs = new URLSearchParams(params).toString();
      return this.request("POST", `/api/${resource}/filter-page?${qs}`, { searchRequestDto: filters });
    },
  };

  // Sayfa geçişlerinde aynı veriyi tekrar tekrar çekmemek için kısa ömürlü önbellek
  const cache = new Map();
  const all = (resource) => {
    if (!cache.has(resource)) {
      cache.set(resource, api.filter(resource).catch((e) => { cache.delete(resource); throw e; }));
    }
    return cache.get(resource);
  };

  const loading = (rows = 4) =>
    `<div class="card card-body">${Array.from({ length: rows }, () => '<div class="skeleton" style="margin:10px 0"></div>').join("")}</div>`;
  const errorBox = (e) =>
    `<div class="card error-box"><strong>Veri alınamadı.</strong><br><span class="mono">${esc(e.message)}</span><br><br>
     <span class="muted">Uygulama <code>h2</code> profiliyle çalışıyor mu? <code>./mvnw spring-boot:run -Dspring-boot.run.profiles=h2</code></span></div>`;

  // ---------------------------------------------------------------- drawer
  const drawer = $("#drawer");
  const backdrop = $("#drawerBackdrop");
  function openDrawer(title, html) {
    $("#drawerTitle").textContent = title;
    $("#drawerBody").innerHTML = html;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    backdrop.hidden = false;
  }
  function closeDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
  }
  $("#drawerClose").addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

  // ---------------------------------------------------------------- sayfalar
  const routes = {};

  // ===== Panel
  routes.panel = {
    title: "Panel",
    subtitle: "Satış, stok ve müşteri özetiniz",
    async render() {
      view.innerHTML = `<div class="grid kpis">${loading(2).repeat(4)}</div>${loading(6)}`;
      const [orders, customers, products, items] = await Promise.all([
        all("orders"), all("customers"), all("products"), all("order-items"),
      ]);

      const revenue = orders.reduce((s, o) => s + Number(o.totalPrice || 0), 0);
      const stockValue = products.reduce((s, p) => s + Number(p.price || 0) * (p.stockQuantity || 0), 0);
      const critical = products.filter((p) => (p.stockQuantity ?? 0) <= 3).sort((a, b) => a.stockQuantity - b.stockQuantity);

      const byCategory = {};
      const byProduct = {};
      for (const it of items) {
        const total = Number(it.price || 0) * (it.quantity || 0);
        const cat = it.product?.category?.name || "Diğer";
        byCategory[cat] = (byCategory[cat] || 0) + total;
        const key = it.product?.id;
        if (key != null) {
          byProduct[key] ??= { product: it.product, qty: 0, total: 0 };
          byProduct[key].qty += it.quantity || 0;
          byProduct[key].total += total;
        }
      }
      const catRows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
      const maxCat = Math.max(1, ...catRows.map((r) => r[1]));
      const topProducts = Object.values(byProduct).sort((a, b) => b.total - a.total).slice(0, 5);
      const recent = [...orders].sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate)).slice(0, 5);

      view.innerHTML = `
        <div class="grid kpis">
          ${kpi("Toplam Ciro", fmtMoney(revenue), `${num.format(orders.length)} siparişten`, icon.revenue)}
          ${kpi("Sipariş", num.format(orders.length), `Ortalama sepet ${fmtMoney(revenue / Math.max(1, orders.length))}`, icon.orders)}
          ${kpi("Müşteri", num.format(customers.length), `${num.format(new Set(orders.map((o) => o.customer?.id)).size)} aktif alıcı`, icon.users)}
          ${kpi("Stok Değeri", fmtMoney(stockValue), `${num.format(critical.length)} üründe kritik stok`, icon.box)}
        </div>

        <div class="grid two">
          <section class="card">
            <div class="card-head"><h2>Kategoriye göre satış</h2><span class="muted">${fmtMoney(revenue)}</span></div>
            <div class="card-body bars">
              ${catRows.map(([name, total]) => `
                <div class="bar-row">
                  <span title="${esc(name)}">${esc(name)}</span>
                  <div class="bar-track"><div class="bar-fill" style="width:${(total / maxCat) * 100}%"></div></div>
                  <span class="num muted">${fmtMoney(total)}</span>
                </div>`).join("") || '<div class="empty">Henüz satış yok</div>'}
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2>Son siparişler</h2><a href="#/siparisler">Tümü →</a></div>
            <div class="card-body list">
              ${recent.map((o) => `
                <div class="list-item">
                  <span class="avatar">${esc(initials(o.customer))}</span>
                  <div class="grow">
                    <div class="cell-title">${esc(fullName(o.customer))}</div>
                    <div class="cell-sub">#${o.id} · ${fmtDate(o.orderDate)} · ${num.format(o.items?.length || 0)} kalem</div>
                  </div>
                  <strong class="num">${fmtMoney(o.totalPrice)}</strong>
                </div>`).join("")}
            </div>
          </section>
        </div>

        <div class="grid two">
          <section class="card">
            <div class="card-head"><h2>En çok kazandıran ürünler</h2><a href="#/urunler">Ürünler →</a></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Ürün</th><th class="right">Adet</th><th class="right">Tutar</th></tr></thead>
                <tbody>
                  ${topProducts.map((r) => `
                    <tr>
                      <td><div class="cell-title">${esc(r.product.name)}</div><div class="cell-sub">${esc(r.product.category?.name || "")}</div></td>
                      <td class="right num">${num.format(r.qty)}</td>
                      <td class="right num">${fmtMoney(r.total)}</td>
                    </tr>`).join("")}
                </tbody>
              </table>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2>Kritik stok</h2><a href="#/stok">Hareketler →</a></div>
            <div class="card-body list">
              ${critical.map((p) => `
                <div class="list-item">
                  <div class="grow">
                    <div class="cell-title">${esc(p.name)}</div>
                    <div class="cell-sub mono">${esc(p.sku)}</div>
                  </div>
                  ${stockBadge(p.stockQuantity)}
                </div>`).join("") || '<div class="empty">Tüm ürünlerde yeterli stok var 🎉</div>'}
            </div>
          </section>
        </div>`;
    },
  };

  function kpi(label, value, sub, svg) {
    return `<div class="card kpi">
      <div class="kpi-top"><span>${esc(label)}</span>${svg}</div>
      <strong class="num">${esc(value)}</strong>
      <small>${esc(sub)}</small>
    </div>`;
  }

  // ===== Ürünler (sunucu tarafı dinamik filtre + sayfalama + sıralama)
  const productState = { q: "", categoryId: "", min: "", max: "", sort: "name", dir: "asc", page: 0, size: 8 };

  function productFilters() {
    const f = [];
    if (productState.q) f.push({ column: "name", operation: "LIKE", value: productState.q });
    if (productState.categoryId) f.push({ join: "category", column: "id", operation: "EQUAL", value: Number(productState.categoryId) });
    if (productState.min !== "") f.push({ column: "price", operation: "GREATER_THAN", value: Number(productState.min) });
    if (productState.max !== "") f.push({ column: "price", operation: "LESS_THAN", value: Number(productState.max) });
    return f;
  }

  routes.urunler = {
    title: "Ürünler",
    subtitle: "Arama ve filtreler sunucuda JPA Specification ile çalışır",
    async render() {
      const categories = await api.request("GET", "/api/categories");
      view.innerHTML = `
        <section class="card card-body">
          <div class="toolbar">
            <div class="field grow">
              <label for="pq">Ürün ara</label>
              <div class="search">${icon.search}<input id="pq" type="search" placeholder="ör. lenovo, rtx, monitör" value="${esc(productState.q)}"></div>
            </div>
            <div class="field">
              <label for="pc">Kategori</label>
              <select id="pc">
                <option value="">Tümü</option>
                ${categories.map((c) => `<option value="${c.id}" ${String(c.id) === productState.categoryId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
              </select>
            </div>
            <div class="field"><label for="pmin">Min. fiyat</label><input id="pmin" type="number" min="0" step="500" placeholder="₺" value="${esc(productState.min)}"></div>
            <div class="field"><label for="pmax">Maks. fiyat</label><input id="pmax" type="number" min="0" step="500" placeholder="₺" value="${esc(productState.max)}"></div>
            <button id="preset" type="button">Temizle</button>
          </div>
        </section>
        <section class="card" id="productResults">${loading(6)}</section>
        <details class="card card-body" id="requestDetails">
          <summary>Sunucuya giden istek</summary>
          <pre class="code-block" id="requestPreview"></pre>
        </details>`;

      let timer;
      const update = (key, value, debounce) => {
        productState[key] = value;
        productState.page = 0;
        clearTimeout(timer);
        timer = setTimeout(loadProducts, debounce ? 300 : 0);
      };
      $("#pq").addEventListener("input", (e) => update("q", e.target.value.trim(), true));
      $("#pc").addEventListener("change", (e) => update("categoryId", e.target.value));
      $("#pmin").addEventListener("input", (e) => update("min", e.target.value, true));
      $("#pmax").addEventListener("input", (e) => update("max", e.target.value, true));
      $("#preset").addEventListener("click", () => {
        Object.assign(productState, { q: "", categoryId: "", min: "", max: "", page: 0 });
        routes.urunler.render();
      });

      await loadProducts();
    },
  };

  async function loadProducts() {
    const box = $("#productResults");
    if (!box) return;
    const filters = productFilters();
    const params = { page: productState.page, size: productState.size, sort: `${productState.sort},${productState.dir}` };
    $("#requestPreview").textContent =
      `POST /api/products/filter-page?${new URLSearchParams(params)}\n\n` + JSON.stringify({ searchRequestDto: filters }, null, 2);

    try {
      const page = await api.filterPage("products", filters, params);
      const rows = page.content || [];
      const total = page.totalElements ?? rows.length;
      const totalPages = Math.max(1, page.totalPages ?? 1);
      const th = (field, label, cls = "") => {
        const active = productState.sort === field;
        const arrow = active ? (productState.dir === "asc" ? "▲" : "▼") : "";
        return `<th class="sortable ${cls}" data-sort="${field}">${label}<span class="arrow">${arrow}</span></th>`;
      };
      box.innerHTML = `
        <div class="card-head"><h2>${num.format(total)} ürün</h2><span class="muted">Başlıklara tıklayarak sıralayın</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              ${th("name", "Ürün")}
              <th class="hide-sm">Kategori</th>
              ${th("price", "Fiyat", "right")}
              ${th("stockQuantity", "Stok")}
            </tr></thead>
            <tbody>
              ${rows.map((p) => `
                <tr>
                  <td><div class="cell-title">${esc(p.name)}</div><div class="cell-sub mono">${esc(p.sku)}</div></td>
                  <td class="hide-sm"><span class="badge">${esc(p.category?.name || "—")}</span></td>
                  <td class="right num">${fmtMoney(p.price)}</td>
                  <td>${stockBadge(p.stockQuantity ?? 0)}</td>
                </tr>`).join("") || `<tr><td colspan="4"><div class="empty">Bu filtrelere uyan ürün yok</div></td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="pager">
          <span class="muted">Sayfa ${productState.page + 1} / ${totalPages}</span>
          <div>
            <button id="prevPage" ${productState.page <= 0 ? "disabled" : ""}>← Önceki</button>
            <button id="nextPage" ${productState.page + 1 >= totalPages ? "disabled" : ""}>Sonraki →</button>
          </div>
        </div>`;

      box.querySelectorAll("th[data-sort]").forEach((el) => el.addEventListener("click", () => {
        const field = el.dataset.sort;
        productState.dir = productState.sort === field && productState.dir === "asc" ? "desc" : "asc";
        productState.sort = field;
        loadProducts();
      }));
      $("#prevPage").addEventListener("click", () => { productState.page--; loadProducts(); });
      $("#nextPage").addEventListener("click", () => { productState.page++; loadProducts(); });
    } catch (e) {
      box.innerHTML = errorBox(e);
    }
  }

  // ===== Kategoriler
  routes.kategoriler = {
    title: "Kategoriler",
    subtitle: "Ekleme, düzenleme ve silme: POST / PUT / DELETE /api/categories",
    async render() {
      view.innerHTML = loading(5);
      const [categories, products, items] = await Promise.all([
        api.request("GET", "/api/categories"), all("products"), all("order-items"),
      ]);
      const stats = (id) => {
        const ps = products.filter((p) => p.category?.id === id);
        const sales = items.filter((i) => i.product?.category?.id === id)
          .reduce((s, i) => s + Number(i.price || 0) * (i.quantity || 0), 0);
        return { count: ps.length, stock: ps.reduce((s, p) => s + (p.stockQuantity || 0), 0), sales };
      };
      view.innerHTML = `
        <section class="card card-body">
          <form class="toolbar" id="catForm">
            <div class="field"><label for="cn">Yeni kategori adı</label><input id="cn" required maxlength="100" placeholder="ör. Tablet"></div>
            <div class="field grow"><label for="cd">Açıklama</label><input id="cd" maxlength="255" placeholder="ör. Tablet bilgisayarlar"></div>
            <button class="primary" type="submit">+ Kategori ekle</button>
          </form>
          <div id="catMsg" class="form-msg" hidden></div>
        </section>
        <div class="grid cards">
        ${categories.map((c) => {
          const s = stats(c.id);
          return `<article class="card cat-card">
            <div class="top">
              <div><h3>${esc(c.name)}</h3><p class="muted" style="margin:4px 0 0">${esc(c.description || "")}</p></div>
              <span class="badge blue">#${c.id}</span>
            </div>
            <div class="cat-stats">
              <div><strong class="num">${num.format(s.count)}</strong><small>ürün</small></div>
              <div><strong class="num">${num.format(s.stock)}</strong><small>stok</small></div>
              <div><strong class="num">${fmtMoney(s.sales)}</strong><small>satış</small></div>
            </div>
            <div class="cat-actions">
              <a href="#/urunler" data-cat="${c.id}">Ürünleri gör →</a>
              <span>
                <button class="ghost" type="button" data-edit="${c.id}">Düzenle</button>
                <button class="ghost danger" type="button" data-del="${c.id}">Sil</button>
              </span>
            </div>
          </article>`;
        }).join("")}
      </div>`;
      view.querySelectorAll("a[data-cat]").forEach((a) => a.addEventListener("click", () => {
        Object.assign(productState, { q: "", min: "", max: "", page: 0, categoryId: a.dataset.cat });
      }));

      const msg = (text, ok) => {
        const el = $("#catMsg");
        el.hidden = false;
        el.className = `form-msg ${ok ? "ok" : "err"}`;
        el.textContent = text;
      };
      const refresh = (text) => routes.kategoriler.render().then(() => msg(text, true));

      $("#catForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          const created = await api.request("POST", "/api/categories", { name: $("#cn").value, description: $("#cd").value || null });
          await refresh(`"${created.name}" eklendi (id: ${created.id}) · 201 Created`);
        } catch (err) { msg(err.message, false); }
      });

      view.querySelectorAll("button[data-del]").forEach((b) => b.addEventListener("click", async () => {
        const c = categories.find((x) => String(x.id) === b.dataset.del);
        if (!confirm(`"${c.name}" kategorisi silinsin mi?`)) return;
        try {
          await api.request("DELETE", `/api/categories/${c.id}`);
          await refresh(`"${c.name}" silindi · 204 No Content`);
        } catch (err) { msg(err.message, false); }
      }));

      view.querySelectorAll("button[data-edit]").forEach((b) => b.addEventListener("click", () => {
        const c = categories.find((x) => String(x.id) === b.dataset.edit);
        openDrawer(`Kategori #${c.id}`, `
          <form id="editForm" style="display:flex;flex-direction:column;gap:14px">
            <div class="field"><label for="en">Ad</label><input id="en" required maxlength="100" value="${esc(c.name)}"></div>
            <div class="field"><label for="ed">Açıklama</label><input id="ed" maxlength="255" value="${esc(c.description || "")}"></div>
            <div id="editMsg" class="form-msg err" hidden></div>
            <button class="primary" type="submit">Kaydet (PUT)</button>
          </form>`);
        $("#editForm").addEventListener("submit", async (e) => {
          e.preventDefault();
          try {
            const updated = await api.request("PUT", `/api/categories/${c.id}`, { name: $("#en").value, description: $("#ed").value || null });
            closeDrawer();
            await refresh(`"${updated.name}" güncellendi · 200 OK`);
          } catch (err) {
            $("#editMsg").hidden = false;
            $("#editMsg").textContent = err.message;
          }
        });
      }));
    },
  };

  // ===== Siparişler
  routes.siparisler = {
    title: "Siparişler",
    subtitle: "Bir siparişe tıklayarak kalemlerini, ödemesini ve faturasını görün",
    async render() {
      view.innerHTML = loading(6);
      const [orders, payments, invoices] = await Promise.all([all("orders"), all("payments"), all("invoices")]);
      const payByOrder = new Map(payments.map((p) => [p.order?.id, p]));
      const invByOrder = new Map(invoices.map((i) => [i.order?.id, i]));
      const sorted = [...orders].sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));

      view.innerHTML = `
        <section class="card card-body">
          <div class="toolbar">
            <div class="field grow">
              <label for="oq">Müşteri veya ürün ara</label>
              <div class="search">${icon.search}<input id="oq" type="search" placeholder="ör. Elif, ThinkPad"></div>
            </div>
            <div class="field">
              <label for="om">Ödeme yöntemi</label>
              <select id="om"><option value="">Tümü</option>
                ${Object.entries(PAYMENT).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}
              </select>
            </div>
          </div>
        </section>
        <section class="card" id="orderTable"></section>`;

      const draw = () => {
        const q = $("#oq").value.trim().toLocaleLowerCase("tr");
        const m = $("#om").value;
        const rows = sorted.filter((o) => {
          if (m && payByOrder.get(o.id)?.method !== m) return false;
          if (!q) return true;
          const hay = [fullName(o.customer), o.customer?.email, ...(o.items || []).map((i) => i.product?.name)]
            .join(" ").toLocaleLowerCase("tr");
          return hay.includes(q);
        });
        $("#orderTable").innerHTML = `
          <div class="card-head"><h2>${num.format(rows.length)} sipariş</h2>
            <span class="muted">${fmtMoney(rows.reduce((s, o) => s + Number(o.totalPrice || 0), 0))}</span></div>
          <div class="table-wrap"><table>
            <thead><tr><th>Sipariş</th><th>Müşteri</th><th class="hide-sm">Ödeme</th><th class="right">Tutar</th></tr></thead>
            <tbody>
              ${rows.map((o) => `
                <tr class="clickable" data-id="${o.id}">
                  <td><div class="cell-title">#${o.id}</div><div class="cell-sub">${fmtDateTime(o.orderDate)}</div></td>
                  <td><div class="person"><span class="avatar">${esc(initials(o.customer))}</span>
                    <div><div class="cell-title">${esc(fullName(o.customer))}</div><div class="cell-sub">${num.format(o.items?.length || 0)} kalem</div></div></div></td>
                  <td class="hide-sm">${paymentBadge(payByOrder.get(o.id)?.method)}</td>
                  <td class="right num cell-title">${fmtMoney(o.totalPrice)}</td>
                </tr>`).join("") || `<tr><td colspan="4"><div class="empty">Sonuç yok</div></td></tr>`}
            </tbody>
          </table></div>`;
        $("#orderTable").querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => {
          const o = orders.find((x) => String(x.id) === tr.dataset.id);
          showOrder(o, payByOrder.get(o.id), invByOrder.get(o.id));
        }));
      };
      $("#oq").addEventListener("input", draw);
      $("#om").addEventListener("change", draw);
      draw();
    },
  };

  function showOrder(o, pay, inv) {
    openDrawer(`Sipariş #${o.id}`, `
      <dl class="kv">
        <dt>Müşteri</dt><dd>${esc(fullName(o.customer))}</dd>
        <dt>E-posta</dt><dd>${esc(o.customer?.email || "—")}</dd>
        <dt>Tarih</dt><dd>${fmtDateTime(o.orderDate)}</dd>
        <dt>Ödeme</dt><dd>${pay ? `${paymentBadge(pay.method)} <span class="muted">${fmtDate(pay.paymentDate)}</span>` : "—"}</dd>
        <dt>Fatura</dt><dd class="mono">${esc(inv?.invoiceNumber || "—")}</dd>
      </dl>
      <div>
        <div class="section-title">Kalemler</div>
        <div class="list">
          ${(o.items || []).map((i) => `
            <div class="list-item">
              <div class="grow"><div class="cell-title">${esc(i.product?.name)}</div>
                <div class="cell-sub">${num.format(i.quantity)} × ${fmtMoney(i.price)}</div></div>
              <strong class="num">${fmtMoney(Number(i.price) * i.quantity)}</strong>
            </div>`).join("")}
        </div>
        <div class="total-row"><span>Toplam</span><span class="num">${fmtMoney(o.totalPrice)}</span></div>
      </div>`);
  }

  // ===== Müşteriler
  routes.musteriler = {
    title: "Müşteriler",
    subtitle: "Sipariş geçmişi ve harcama özetleri",
    async render() {
      view.innerHTML = loading(6);
      const [customers, orders] = await Promise.all([all("customers"), all("orders")]);
      const stats = new Map();
      for (const o of orders) {
        const id = o.customer?.id;
        if (id == null) continue;
        const s = stats.get(id) || { count: 0, total: 0, last: null, orders: [] };
        s.count++;
        s.total += Number(o.totalPrice || 0);
        if (!s.last || new Date(o.orderDate) > new Date(s.last)) s.last = o.orderDate;
        s.orders.push(o);
        stats.set(id, s);
      }
      const rows = [...customers].sort((a, b) => (stats.get(b.id)?.total || 0) - (stats.get(a.id)?.total || 0));
      view.innerHTML = `
        <section class="card">
          <div class="card-head"><h2>${num.format(customers.length)} müşteri</h2><span class="muted">Harcamaya göre sıralı</span></div>
          <div class="table-wrap"><table>
            <thead><tr><th>Müşteri</th><th class="right">Sipariş</th><th class="right">Toplam harcama</th><th class="hide-sm">Son sipariş</th></tr></thead>
            <tbody>
              ${rows.map((c) => {
                const s = stats.get(c.id) || { count: 0, total: 0 };
                return `<tr class="clickable" data-id="${c.id}">
                  <td><div class="person"><span class="avatar">${esc(initials(c))}</span>
                    <div><div class="cell-title">${esc(fullName(c))}</div><div class="cell-sub">${esc(c.email)}</div></div></div></td>
                  <td class="right num">${num.format(s.count)}</td>
                  <td class="right num cell-title">${fmtMoney(s.total)}</td>
                  <td class="hide-sm">${fmtDate(s.last)}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table></div>
        </section>`;
      view.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => {
        const c = customers.find((x) => String(x.id) === tr.dataset.id);
        const s = stats.get(c.id) || { orders: [], total: 0 };
        openDrawer(fullName(c), `
          <div class="person"><span class="avatar" style="width:48px;height:48px;font-size:16px">${esc(initials(c))}</span>
            <div><div class="cell-title">${esc(fullName(c))}</div><div class="cell-sub">${esc(c.email)}</div></div></div>
          <div>
            <div class="section-title">Siparişler</div>
            <div class="list">
              ${s.orders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate)).map((o) => `
                <div class="list-item">
                  <div class="grow"><div class="cell-title">#${o.id}</div>
                    <div class="cell-sub">${fmtDate(o.orderDate)} · ${(o.items || []).map((i) => esc(i.product?.name)).join(", ")}</div></div>
                  <strong class="num">${fmtMoney(o.totalPrice)}</strong>
                </div>`).join("") || '<div class="empty">Henüz sipariş yok</div>'}
            </div>
            <div class="total-row"><span>Toplam harcama</span><span class="num">${fmtMoney(s.total)}</span></div>
          </div>`);
      }));
    },
  };

  // ===== Stok hareketleri (tür filtresi sunucuda)
  routes.stok = {
    title: "Stok Hareketleri",
    subtitle: "Giriş ve çıkışlar; tür filtresi API'ye EQUAL filtresi olarak gider",
    async render() {
      view.innerHTML = `
        <section class="card card-body"><div class="toolbar">
          <div class="field"><label for="st">Hareket türü</label>
            <select id="st"><option value="">Tümü</option><option value="IN">Giriş (IN)</option><option value="OUT">Çıkış (OUT)</option></select>
          </div>
        </div></section>
        <section class="card" id="stockTable">${loading(6)}</section>`;
      const draw = async () => {
        const type = $("#st").value;
        const box = $("#stockTable");
        try {
          const rows = await api.filter("stock-movements", type ? [{ column: "type", operation: "EQUAL", value: type }] : []);
          rows.sort((a, b) => new Date(b.movementDate) - new Date(a.movementDate));
          box.innerHTML = `
            <div class="card-head"><h2>${num.format(rows.length)} hareket</h2></div>
            <div class="table-wrap"><table>
              <thead><tr><th>Ürün</th><th>Tür</th><th class="right">Miktar</th><th class="hide-sm">Tarih</th></tr></thead>
              <tbody>
                ${rows.map((m) => `<tr>
                  <td><div class="cell-title">${esc(m.product?.name)}</div><div class="cell-sub mono">${esc(m.product?.sku)}</div></td>
                  <td>${m.type === "IN" ? '<span class="badge green">Giriş</span>' : '<span class="badge red">Çıkış</span>'}</td>
                  <td class="right num cell-title">${m.quantityChange > 0 ? "+" : ""}${num.format(m.quantityChange)}</td>
                  <td class="hide-sm">${fmtDateTime(m.movementDate)}</td>
                </tr>`).join("") || `<tr><td colspan="4"><div class="empty">Hareket yok</div></td></tr>`}
              </tbody>
            </table></div>`;
        } catch (e) { box.innerHTML = errorBox(e); }
      };
      $("#st").addEventListener("change", draw);
      await draw();
    },
  };

  // ===== Tedarikçiler
  routes.tedarikciler = {
    title: "Tedarikçiler",
    subtitle: "Ürün tedarik ettiğimiz firmalar",
    async render() {
      view.innerHTML = loading(4);
      const suppliers = await all("suppliers");
      view.innerHTML = `<div class="grid cards">
        ${suppliers.map((s) => `
          <article class="card cat-card">
            <div class="top"><h3>${esc(s.name)}</h3><span class="badge blue">#${s.id}</span></div>
            <div class="list">
              <div class="list-item">${icon.mail}<a href="mailto:${esc(s.email)}">${esc(s.email)}</a></div>
              <div class="list-item">${icon.phone}<span>${esc(s.phone)}</span></div>
            </div>
          </article>`).join("")}
      </div>`;
    },
  };

  // ===== API Gezgini
  const RESOURCES = ["products", "categories", "customers", "orders", "order-items", "payments", "invoices", "stock-movements", "suppliers", "addresses"];
  const EXAMPLES = {
    "Hepsini getir": { searchRequestDto: [] },
    "İsimde 'lenovo' geçenler (LIKE)": { searchRequestDto: [{ column: "name", operation: "LIKE", value: "lenovo" }] },
    "Fiyatı 20.000 ₺ üstü (GREATER_THAN)": { searchRequestDto: [{ column: "price", operation: "GREATER_THAN", value: 20000 }] },
    "Kategorisi 'Monitör' olanlar (join)": { searchRequestDto: [{ join: "category", column: "name", operation: "EQUAL", value: "Monitör" }] },
    "Laptop VEYA 5.000 ₺ altı (OR)": {
      globalOperator: "OR",
      searchRequestDto: [
        { join: "category", column: "name", operation: "EQUAL", value: "Laptop" },
        { column: "price", operation: "LESS_THAN", value: 5000 },
      ],
    },
  };

  routes.api = {
    title: "API Gezgini",
    subtitle: "Dinamik filtre uç noktasını tarayıcıdan deneyin",
    async render() {
      view.innerHTML = `
        <div class="grid two">
          <section class="card card-body" style="display:flex;flex-direction:column;gap:14px">
            <div class="toolbar">
              <div class="field"><label for="ar">Kaynak</label>
                <select id="ar">${RESOURCES.map((r) => `<option ${r === "products" ? "selected" : ""}>${r}</option>`).join("")}</select>
              </div>
              <div class="field grow"><label for="ae">Örnek filtre</label>
                <select id="ae">${Object.keys(EXAMPLES).map((k) => `<option>${esc(k)}</option>`).join("")}</select>
              </div>
            </div>
            <div class="field"><label for="ab">İstek gövdesi (JSON)</label><textarea id="ab" spellcheck="false"></textarea></div>
            <div style="display:flex;align-items:center;gap:12px">
              <button class="primary" id="as" type="button">${icon.send}Gönder</button>
              <span class="mono muted" id="aurl"></span>
            </div>
          </section>
          <section class="card">
            <div class="card-head"><h2>Cevap</h2><span id="ameta" class="muted"></span></div>
            <div class="card-body"><pre class="code-block" id="aout">Bir istek gönderin…</pre></div>
          </section>
        </div>`;

      const setExample = () => { $("#ab").value = JSON.stringify(EXAMPLES[$("#ae").value], null, 2); };
      const setUrl = () => { $("#aurl").textContent = `POST /api/${$("#ar").value}/filter`; };
      $("#ae").addEventListener("change", setExample);
      $("#ar").addEventListener("change", setUrl);
      setExample();
      setUrl();

      $("#as").addEventListener("click", async () => {
        const out = $("#aout");
        const meta = $("#ameta");
        let body;
        try { body = JSON.parse($("#ab").value || "{}"); } catch (e) {
          meta.innerHTML = '<span class="badge red">Geçersiz JSON</span>';
          out.textContent = e.message;
          return;
        }
        const started = performance.now();
        try {
          const res = await fetch(`/api/${$("#ar").value}/filter`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
          });
          const ms = Math.round(performance.now() - started);
          const data = await res.json().catch(() => null);
          const count = Array.isArray(data) ? ` · ${data.length} kayıt` : "";
          meta.innerHTML = `<span class="badge ${res.ok ? "green" : "red"}">${res.status}</span> ${ms} ms${count}`;
          if (!res.ok && data) delete data.trace;
          out.textContent = JSON.stringify(data, null, 2);
        } catch (e) {
          meta.innerHTML = '<span class="badge red">Hata</span>';
          out.textContent = e.message;
        }
      });
    },
  };

  // ---------------------------------------------------------------- router
  async function navigate() {
    const key = (location.hash.replace(/^#\/?/, "") || "panel").split("?")[0];
    const route = routes[key] || routes.panel;
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === key || (!routes[key] && a.dataset.route === "panel")));
    $("#pageTitle").textContent = route.title;
    $("#pageSubtitle").textContent = route.subtitle;
    document.title = `${route.title} · TeknoSatış`;
    $("#sidebar").classList.remove("open");
    closeDrawer();
    try {
      await route.render();
    } catch (e) {
      view.innerHTML = errorBox(e);
    }
  }
  window.addEventListener("hashchange", navigate);
  $("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

  // ---------------------------------------------------------------- tema
  const themeBtn = $("#themeToggle");
  const storedTheme = (() => { try { return localStorage.getItem("theme"); } catch { return null; } })();
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const applyTheme = (t) => {
    document.documentElement.dataset.theme = t;
    themeBtn.querySelector("span").textContent = t === "dark" ? "Açık tema" : "Koyu tema";
  };
  applyTheme(storedTheme || (prefersDark ? "dark" : "light"));
  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("theme", next); } catch { /* depolama kapalıysa sorun değil */ }
  });

  // ---------------------------------------------------------------- API durumu
  api.request("GET", "/api/categories")
    .then(() => { $("#apiStatus").className = "status ok"; $("#apiStatus").lastChild.textContent = "API bağlı"; })
    .catch(() => { $("#apiStatus").className = "status err"; $("#apiStatus").lastChild.textContent = "API yok"; });

  navigate();
})();
