/* ============================================================
   admin.js — Admin Dashboard logic
   Covers:
   - Simple localStorage-based login (demo auth)
   - Product CRUD (Create/Read/Update/Delete) backed by the
     same "bazar_products" localStorage key used by app.js
   - Image handling: tries Google Drive upload (drive-upload.js)
     if configured, otherwise falls back to embedding the image
     as a base64 data URL so the demo works with zero setup
   - Website settings form (name, logo, header title)
   ============================================================ */

const PRODUCTS_KEY = "bazar_products";
const AUTH_KEY = "bazar_admin_auth";
const ADMIN_CREDS_KEY = "bazar_admin_creds";

/* Default admin credentials (demo only — change in a real deployment) */
const DEFAULT_CREDS = { username: "admin", password: "admin123" };

function getAdminCreds() {
  const raw = localStorage.getItem(ADMIN_CREDS_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_CREDS;
}

/* ---------------- Auth ---------------- */

function isLoggedIn() {
  return sessionStorage.getItem(AUTH_KEY) === "true";
}

function login(username, password) {
  const creds = getAdminCreds();
  if (username === creds.username && password === creds.password) {
    sessionStorage.setItem(AUTH_KEY, "true");
    return true;
  }
  return false;
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  window.location.href = "admin.html";
}

function guardAdminPage() {
  if (!isLoggedIn() && document.body.dataset.requireAuth === "true") {
    window.location.href = "admin.html";
  }
}

/* ---------------- Product data layer (shared shape with app.js) ---------------- */

function getProducts() {
  try {
    return JSON.parse(localStorage.getItem(PRODUCTS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveProducts(products) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

function generateId() {
  return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------------- Toast helper ---------------- */

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

/* ---------------- Login page ---------------- */

function initLoginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  if (isLoggedIn()) {
    window.location.href = "admin-dashboard.html";
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const errorEl = document.getElementById("loginError");

    if (login(username, password)) {
      window.location.href = "admin-dashboard.html";
    } else {
      errorEl.textContent = "Incorrect username or password.";
    }
  });
}

/* ---------------- Dashboard: product list ---------------- */

function formatPrice(price) {
  const n = Number(price);
  return "₹" + (isNaN(n) ? price : n.toLocaleString("en-IN"));
}

function renderAdminStats() {
  const products = getProducts();
  const cities = new Set(products.map(p => p.city).filter(Boolean));
  const totalEl = document.getElementById("statTotal");
  const citiesEl = document.getElementById("statCities");
  if (totalEl) totalEl.textContent = products.length;
  if (citiesEl) citiesEl.textContent = cities.size;
}

function renderProductTable() {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;
  const products = getProducts();

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-soft);padding:30px;">
      No products yet. Click "Add New Product" to create your first listing.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td><img class="table-thumb" src="${p.imageUrl}" alt="${p.name}"></td>
      <td>${p.name}</td>
      <td>${formatPrice(p.price)}</td>
      <td>${p.city}</td>
      <td>${p.whatsapp}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-outline" data-edit="${p.id}">Edit</button>
          <button class="btn btn-danger" data-delete="${p.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      window.location.href = `admin-product-form.html?id=${btn.dataset.edit}`;
    });
  });
  tbody.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!confirm("Delete this product? This cannot be undone.")) return;
      const products = getProducts().filter(p => p.id !== btn.dataset.delete);
      saveProducts(products);
      renderProductTable();
      renderAdminStats();
      showToast("Product deleted.");
    });
  });
}

/* ---------------- Add / Edit product form ---------------- */

let selectedImageDataUrl = null; // base64 fallback image
let selectedDriveImage = null;   // { fileId, imageUrl } from Drive

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function initProductFormPage() {
  const form = document.getElementById("productForm");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const editId = params.get("id");
  const preview = document.getElementById("imagePreview");
  const fileInput = document.getElementById("imageFile");
  const driveBtn = document.getElementById("driveUploadBtn");
  const driveStatus = document.getElementById("driveStatus");

  let existingImageUrl = "";

  if (editId) {
    const product = getProducts().find(p => p.id === editId);
    if (product) {
      document.getElementById("formTitle").textContent = "Edit Product";
      document.getElementById("name").value = product.name;
      document.getElementById("age").value = product.age;
      document.getElementById("price").value = product.price;
      document.getElementById("city").value = product.city;
      document.getElementById("address").value = product.address;
      document.getElementById("description").value = product.description;
      document.getElementById("whatsapp").value = product.whatsapp;
      existingImageUrl = product.imageUrl;
      if (preview) { preview.src = product.imageUrl; preview.style.display = "block"; }
    }
  }

  // Local file -> base64 fallback (works with zero Google setup)
  if (fileInput) {
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      selectedImageDataUrl = await readFileAsDataUrl(file);
      selectedDriveImage = null;
      if (preview) { preview.src = selectedImageDataUrl; preview.style.display = "block"; }
    });
  }

  // Google Drive upload button (requires drive-upload.js to be configured)
  if (driveBtn) {
    driveBtn.addEventListener("click", async () => {
      if (!isDriveConfigured()) {
        driveStatus.textContent = "Google Drive isn't configured yet — see README-google-drive-setup.md. Using local file upload instead works fine for now.";
        return;
      }
      const file = fileInput.files[0];
      if (!file) {
        driveStatus.textContent = "Choose an image file first, then click this button to send it to Drive.";
        return;
      }
      try {
        driveStatus.textContent = "Uploading to Google Drive…";
        const result = await uploadImageToDrive(file);
        selectedDriveImage = result;
        selectedImageDataUrl = null;
        if (preview) { preview.src = result.imageUrl; preview.style.display = "block"; }
        driveStatus.textContent = "Uploaded to Drive ✓ (File ID: " + result.fileId + ")";
      } catch (err) {
        console.error(err);
        driveStatus.textContent = "Drive upload failed. Falling back to local image is fine for this demo.";
      }
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const imageUrl = selectedDriveImage?.imageUrl || selectedImageDataUrl || existingImageUrl;
    if (!imageUrl) {
      showToast("Please add a product image.");
      return;
    }

    const productData = {
      id: editId || generateId(),
      name: document.getElementById("name").value.trim(),
      age: document.getElementById("age").value.trim(),
      price: document.getElementById("price").value.trim(),
      city: document.getElementById("city").value.trim(),
      address: document.getElementById("address").value.trim(),
      description: document.getElementById("description").value.trim(),
      whatsapp: document.getElementById("whatsapp").value.trim().replace(/[^0-9]/g, ""),
      imageUrl,
      driveFileId: selectedDriveImage?.fileId || null
    };

    const products = getProducts();
    if (editId) {
      const idx = products.findIndex(p => p.id === editId);
      if (idx > -1) products[idx] = productData;
    } else {
      products.push(productData);
    }
    saveProducts(products);
    showToast(editId ? "Product updated." : "Product added.");
    window.location.href = "admin-dashboard.html";
  });
}

/* ---------------- Settings page ---------------- */

function initSettingsPage() {
  const form = document.getElementById("settingsForm");
  if (!form) return;

  const settings = getSettings();
  document.getElementById("siteName").value = settings.siteName;
  document.getElementById("headerTitle").value = settings.headerTitle;
  const logoPreview = document.getElementById("logoPreview");
  if (settings.logoUrl && logoPreview) logoPreview.src = settings.logoUrl;

  let newLogoDataUrl = null;
  const logoInput = document.getElementById("logoFile");
  if (logoInput) {
    logoInput.addEventListener("change", async () => {
      const file = logoInput.files[0];
      if (!file) return;
      newLogoDataUrl = await readFileAsDataUrl(file);
      if (logoPreview) logoPreview.src = newLogoDataUrl;
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const updated = {
      siteName: document.getElementById("siteName").value.trim() || "Bazar",
      headerTitle: document.getElementById("headerTitle").value.trim(),
      logoUrl: newLogoDataUrl || settings.logoUrl
    };
    saveSettings(updated);
    applySettingsToPage();
    showToast("Settings saved. Changes are live on the website.");
  });
}

/* ---------------- Credentials change (bonus, inside settings) ---------------- */

function initCredsForm() {
  const form = document.getElementById("credsForm");
  if (!form) return;
  const creds = getAdminCreds();
  document.getElementById("newUsername").value = creds.username;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("newUsername").value.trim();
    const password = document.getElementById("newPassword").value;
    if (!username || !password) {
      showToast("Username and password are required.");
      return;
    }
    localStorage.setItem(ADMIN_CREDS_KEY, JSON.stringify({ username, password }));
    showToast("Login credentials updated.");
    document.getElementById("newPassword").value = "";
  });
}

/* ---------------- Init ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  guardAdminPage();
  initLoginPage();
  renderAdminStats();
  renderProductTable();
  initProductFormPage();
  initSettingsPage();
  initCredsForm();

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  const addProductBtn = document.getElementById("addProductBtn");
  if (addProductBtn) {
    addProductBtn.addEventListener("click", () => window.location.href = "admin-product-form.html");
  }
});
