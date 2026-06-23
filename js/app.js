/* ============================================================
   app.js — Public website logic
   Covers:
   - Product data layer (localStorage as the JSON "database")
   - Seeding demo products on first run
   - Rendering the responsive product grid
   - Search by name + filter by city
   - Product detail modal (image, age, price, city, address,
     description, WhatsApp number)
   - "Contact on WhatsApp" deep link with prefilled message
   ============================================================ */

const PRODUCTS_KEY = "bazar_products";

/* ---------------- Demo seed data (first run only) ---------------- */
const SEED_PRODUCTS = [
  {
    id: "p1", name: "iPhone 14 — 128GB", age: "6 Months", price: "50000",
    city: "Delhi", address: "Kalkaji, New Delhi",
    description: "Excellent condition, single owner, comes with box, charger and a spare case. No scratches on screen.",
    whatsapp: "919999999999",
    imageUrl: "https://images.unsplash.com/photo-1592286927505-1def25115481?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "p2", name: "Royal Enfield Classic 350", age: "2 Years", price: "135000",
    city: "Mumbai", address: "Andheri West, Mumbai",
    description: "Well maintained, all papers clear, new tyres fitted last month. Genuine reason for sale.",
    whatsapp: "919888888888",
    imageUrl: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "p3", name: "Study Table with Chair", age: "1 Year", price: "3500",
    city: "Bengaluru", address: "Indiranagar, Bengaluru",
    description: "Sturdy wooden study table with matching chair, barely used. Pickup only.",
    whatsapp: "919777777777",
    imageUrl: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "p4", name: "Canon EOS 1500D DSLR", age: "8 Months", price: "28000",
    city: "Delhi", address: "Rohini, New Delhi",
    description: "With 18-55mm kit lens, bag and 32GB card included. Used for a few shoots only.",
    whatsapp: "919666666666",
    imageUrl: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "p5", name: "Sofa Set (3+1+1)", age: "3 Years", price: "12000",
    city: "Pune", address: "Kothrud, Pune",
    description: "Fabric sofa set, minor wear on armrests, very comfortable. Moving out sale.",
    whatsapp: "919555555555",
    imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "p6", name: "MacBook Air M1", age: "1 Year", price: "68000",
    city: "Mumbai", address: "Powai, Mumbai",
    description: "8GB/256GB, battery health 92%. Original charger included, AppleCare till next year.",
    whatsapp: "919444444444",
    imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=800&auto=format&fit=crop"
  }
];

function getProducts() {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    if (!raw) {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(SEED_PRODUCTS));
      return [...SEED_PRODUCTS];
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to read products:", e);
    return [];
  }
}

function saveProducts(products) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

/* ---------------- Rendering: index.html ---------------- */

let currentSearch = "";
let currentCity = "All";

function formatPrice(price) {
  const n = Number(price);
  return "₹" + (isNaN(n) ? price : n.toLocaleString("en-IN"));
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function renderCityFilters() {
  const row = document.getElementById("cityFilterRow");
  if (!row) return;
  const products = getProducts();
  const cities = ["All", ...new Set(products.map(p => p.city).filter(Boolean))];
  row.innerHTML = cities.map(city => `
    <button class="chip ${city === currentCity ? "active" : ""}" data-city="${escapeHtml(city)}">
      ${escapeHtml(city)}
    </button>
  `).join("");

  row.querySelectorAll(".chip").forEach(btn => {
    btn.addEventListener("click", () => {
      currentCity = btn.dataset.city;
      renderCityFilters();
      renderProductGrid();
    });
  });
}

function getFilteredProducts() {
  const products = getProducts();
  return products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(currentSearch.toLowerCase());
    const matchesCity = currentCity === "All" || p.city === currentCity;
    return matchesSearch && matchesCity;
  });
}

function renderProductGrid() {
  const grid = document.getElementById("productGrid");
  const countEl = document.getElementById("resultCount");
  if (!grid) return;

  const filtered = getFilteredProducts();
  if (countEl) countEl.textContent = `${filtered.length} listing${filtered.length === 1 ? "" : "s"}`;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No listings found</h3>
        <p>Try a different search term or choose another city.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map((p, i) => `
    <article class="product-card" data-id="${p.id}" style="animation-delay:${Math.min(i * 35, 300)}ms" tabindex="0">
      <img class="product-card-img" src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy">
      <div class="product-card-body">
        <div class="product-card-name">${escapeHtml(p.name)}</div>
        <div class="product-card-price">${formatPrice(p.price)}</div>
        <div class="product-card-city">📍 ${escapeHtml(p.city)}</div>
      </div>
    </article>
  `).join("");

  grid.querySelectorAll(".product-card").forEach(card => {
    const open = () => openProductModal(card.dataset.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
  });
}

/* ---------------- Product detail modal ---------------- */

function buildWhatsAppLink(product) {
  const message =
`Hello, I am interested in this product.

Product Name: ${product.name}
Price: ${formatPrice(product.price)}
Image: ${product.imageUrl}`;

  return `https://wa.me/${product.whatsapp}?text=${encodeURIComponent(message)}`;
}

function openProductModal(id) {
  const product = getProducts().find(p => p.id === id);
  if (!product) return;

  const overlay = document.getElementById("productModal");
  if (!overlay) return;

  overlay.querySelector(".modal-img").src = product.imageUrl;
  overlay.querySelector(".modal-img").alt = product.name;
  overlay.querySelector("[data-f='name']").textContent = product.name;
  overlay.querySelector("[data-f='price']").textContent = formatPrice(product.price);
  overlay.querySelector("[data-f='age']").textContent = product.age || "—";
  overlay.querySelector("[data-f='city']").textContent = product.city || "—";
  overlay.querySelector("[data-f='address']").textContent = product.address || "—";
  overlay.querySelector("[data-f='description']").textContent = product.description || "No description provided.";
  overlay.querySelector(".btn-whatsapp").href = buildWhatsAppLink(product);

  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  history.replaceState(null, "", `#product-${id}`);
}

function closeProductModal() {
  const overlay = document.getElementById("productModal");
  if (!overlay) return;
  overlay.classList.remove("open");
  document.body.style.overflow = "";
  history.replaceState(null, "", window.location.pathname);
}

/* ---------------- Init ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("productGrid")) return; // not on index page

  renderCityFilters();
  renderProductGrid();

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value;
      renderProductGrid();
    });
  }

  const overlay = document.getElementById("productModal");
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeProductModal();
    });
    overlay.querySelector(".modal-close").addEventListener("click", closeProductModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeProductModal();
    });
  }

  // Deep-link support: open a product directly if URL has #product-<id>
  if (window.location.hash.startsWith("#product-")) {
    openProductModal(window.location.hash.replace("#product-", ""));
  }

  // Re-render grid live if admin updates products in another tab
  window.addEventListener("storage", (e) => {
    if (e.key === PRODUCTS_KEY) {
      renderCityFilters();
      renderProductGrid();
    }
  });
});
