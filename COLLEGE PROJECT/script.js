/* script.js
   Firebase + UI + Admin Modal (Smart Mode)
*/
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

/* --------------- CONFIG --------------- */
const firebaseConfig = {
  apiKey: "AIzaSyBFoFP7GFzX09s_nHX-iVEpLAMcvQhJd-k",
  authDomain: "canteen-7d69b.firebaseapp.com",
  projectId: "canteen-7d69b",
  storageBucket: "canteen-7d69b.firebasestorage.app",
  messagingSenderId: "629005427626",
  appId: "1:629005427626:web:e4c4c0c392652737ea01d3",
  measurementId: "G-CKF8Y49PQ2"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* --------------- DOM Refs --------------- */
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const studentPanelBtn = document.getElementById("studentPanelBtn");
const facultyPanelBtn = document.getElementById("facultyPanelBtn");
const adminPanelBtn = document.getElementById("adminPanelBtn");
const profileSummary = document.getElementById("profileSummary");

const authModal = document.getElementById("authModal");
const orderModal = document.getElementById("orderModal");
const studentPanel = document.getElementById("studentPanel");
const facultyPanel = document.getElementById("facultyPanel");
const adminPanel = document.getElementById("adminPanel");

const authSubmit = document.getElementById("authSubmit");
const authUser = document.getElementById("authUser");
const authPass = document.getElementById("authPass");
const toggleAuth = document.getElementById("toggleAuth");
const authCollege = document.getElementById("authCollege");
const authPhone = document.getElementById("authPhone");
const authTitle = document.getElementById("authTitle");
const authClose = document.getElementById("authClose");
const orderClose = document.getElementById("orderClose");
const studentClose = document.getElementById("studentClose");
const facultyClose = document.getElementById("facultyClose");
const adminClose = document.getElementById("adminClose");

const studentInfo = document.getElementById("studentInfo");
const facultyInfo = document.getElementById("facultyInfo");

const logoutBtn = document.getElementById("logoutBtn");
const logoutFacultyBtn = document.getElementById("logoutFacultyBtn");

const menuGrid = document.getElementById("menuGrid");
const cartCountEl = document.getElementById("cartCount");
const cartSidebar = document.getElementById("cartSidebar");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const closeCart = document.getElementById("closeCart");
const cartBtnHeader = document.getElementById("cartBtn");

const placeOrderBtn = document.getElementById("placeOrder");
const facultyRoomInput = document.getElementById("facultyRoomInput");

const categoryButtons = document.querySelectorAll(".cat");
const searchInput = document.getElementById("searchInput");
const vegFilterBtn = document.getElementById("vegFilter");
const newLaunchBadge = document.getElementById("newLaunchBadge");

const adminViews = document.querySelectorAll(".admin-view");
const adminNavBtns = document.querySelectorAll(".admin-nav");
const admin_ordersList = document.getElementById("admin_ordersList");
const admin_orderSearch = document.getElementById("admin_orderSearch");
const admin_totalOrders = document.getElementById("admin_totalOrders");
const admin_earnings = document.getElementById("admin_earnings");
const admin_earnings_breakdown = document.getElementById("admin_earnings_breakdown");
const admin_pending = document.getElementById("admin_pending");
const admin_completed = document.getElementById("admin_completed");
const admin_menuList = document.getElementById("admin_menuList");
const admin_addItem = document.getElementById("admin_addItem");
const admin_newName = document.getElementById("admin_newName");
const admin_newPrice = document.getElementById("admin_newPrice");
const admin_newCat = document.getElementById("admin_newCat");
const admin_transactionsList = document.getElementById("admin_transactionsList");

/* --------------- State --------------- */
let currentUser = null;
let authMode = "login";
let cart = [];
let selectedCategory = "all";
let vegOnly = false;
let menuItems = []; // populated from Firestore
let orderDocsCache = []; // orders snapshot

/* --------------- Helpers --------------- */
function showToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--orange);color:#fff;padding:10px 16px;border-radius:999px;z-index:99999';
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 2200);
}

function formatTime(ts) {
  if (!ts) return '-';
  try {
    if (ts.toDate) return ts.toDate().toLocaleString();
    return new Date(ts).toLocaleString();
  } catch(e) { return '-'; }
}

/* --------------- Modal system (Smart Mode) --------------- */
const MODALS = [authModal, orderModal, studentPanel, facultyPanel];
function openModal(modalEl) {
  // close admin specially if opening non-admin
  if (modalEl !== adminPanel) closeAdmin();
  // close other modals
  MODALS.forEach(m => { if (m && m !== modalEl) closeModal(m); });
  if (!modalEl) return;
  modalEl.classList.add('open');
  modalEl.setAttribute('aria-hidden','false');
}
function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('open');
  modalEl.setAttribute('aria-hidden','true');
}
function toggleModal(modalEl) {
  if (!modalEl) return;
  if (modalEl.classList.contains('open')) closeModal(modalEl);
  else openModal(modalEl);
}
/* Admin open/close */
function openAdmin() {
  // close other modal(s)
  MODALS.forEach(m => closeModal(m));
  adminPanel.classList.add('open');
  adminPanel.setAttribute('aria-hidden','false');
}
function closeAdmin() {
  adminPanel.classList.remove('open');
  adminPanel.setAttribute('aria-hidden','true');
}

/* Overlay (click outside to close) */
document.querySelectorAll('[data-modal]').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal(backdrop);
  });
});
document.querySelectorAll('[data-modal-admin]').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeAdmin();
  });
});

/* --------------- Render Menu --------------- */
function renderMenu(items = menuItems) {
  if (!menuGrid) return;
  menuGrid.innerHTML = "";
  const q = (searchInput?.value || "").toLowerCase();

  const filtered = items.filter(item => {
    if (!item.isAvailable) return false;
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
    if (vegOnly && !item.veg) return false;
    if (q && !item.name.toLowerCase().includes(q)) return false;
    return true;
  });

  if (filtered.length === 0) {
    menuGrid.innerHTML = `<div class="bg-white rounded-xl p-8 text-center shadow col-span-3">No items match your filters.</div>`;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'menu-card';
    card.innerHTML = `
      <div class="meta">
        <img src="${item.img || 'https://via.placeholder.com/300x180?text=Food'}" alt="${item.name}" style="width:120px;height:80px;object-fit:cover;border-radius:8px"/>
        <div style="flex:1;margin-left:10px">
          <div class="font-semibold">${item.name} <span class="${item.veg ? 'pill-veg pill' : 'pill-nv pill'}">${item.veg ? 'VEG' : 'NON-VEG'}</span></div>
          <div class="text-sm text-gray-600">₹${(item.price||0).toFixed(2)}</div>
        </div>
      </div>
      <div class="mt-3 flex justify-between items-center">
        <div><small class="text-xs text-gray-500">${item.category || ''}</small></div>
        <div>
          <button class="add-btn" data-id="${item.id}">Add</button>
        </div>
      </div>
    `;
    menuGrid.appendChild(card);
  });

  // attach add button handlers
  menuGrid.querySelectorAll('.add-btn').forEach(btn => {
    btn.onclick = () => window.addToCart(btn.dataset.id, btn);
    btn.addEventListener('mouseenter', () => {
      const el = document.getElementById('iconSvg');
      el && (el.style.transform = 'scale(1.05)');
      setTimeout(()=> el && (el.style.transform = ''), 380);
    });
  });
}

/* --------------- Cart & animation --------------- */
window.addToCart = function(id, element) {
  const item = menuItems.find(i => i.id === id);
  if (!item) { showToast("Item not found"); return; }
  const existing = cart.find(c => c.id === id);
  if (existing) existing.qty++;
  else cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
  updateCartUI();
  animateCartAdd(element);
  openCartSidebar();
};

function updateCartUI() {
  if (!cartItemsEl) return;
  cartItemsEl.innerHTML = "";
  let total = 0;
  cart.forEach((it, idx) => {
    total += (it.price || 0) * it.qty;
    const row = document.createElement('div');
    row.className = "flex justify-between items-center p-2 rounded";
    row.style.borderBottom = "1px solid #eee";
    row.style.marginBottom = "6px";
    row.innerHTML = `
      <div>
        <div class="font-semibold">${it.name}</div>
        <div class="text-xs text-gray-500">Qty: ${it.qty}</div>
      </div>
      <div>
        <div>₹${((it.price||0)*it.qty).toFixed(2)}</div>
        <button class="text-sm mt-1">Remove</button>
      </div>
    `;
    row.querySelector('button').onclick = () => { removeFromCart(idx); };
    cartItemsEl.appendChild(row);
  });
  cartTotalEl.textContent = total.toFixed(2);
  cartCountEl.textContent = String(cart.reduce((s,i)=> s+i.qty, 0));
}

window.removeFromCart = function(index) {
  cart.splice(index, 1);
  updateCartUI();
};

function animateCartAdd(element) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const bubble = document.createElement("div");
  bubble.innerText = "🛒";
  bubble.style.position = "fixed";
  bubble.style.left = `${rect.left + rect.width/2}px`;
  bubble.style.top = `${rect.top + rect.height/2}px`;
  bubble.style.fontSize = "26px";
  bubble.style.zIndex = 9999;
  bubble.style.transition = "all 700ms ease";
  document.body.appendChild(bubble);

  const targetRect = (cartBtnHeader && cartBtnHeader.getBoundingClientRect()) || { left: window.innerWidth - 60, top: 20 };

  requestAnimationFrame(() => {
    bubble.style.left = `${targetRect.left + 8}px`;
    bubble.style.top = `${targetRect.top + 8}px`;
    bubble.style.transform = "scale(0.4)";
    bubble.style.opacity = "0.2";
  });

  setTimeout(()=> bubble.remove(), 800);
}

function openCartSidebar() { cartSidebar.classList.add('open'); }
function closeCartSidebar() { cartSidebar.classList.remove('open'); }

closeCart && closeCart.addEventListener("click", closeCartSidebar);
cartBtnHeader && cartBtnHeader.addEventListener("click", openCartSidebar);

/* --------------- Place order --------------- */
if (placeOrderBtn) {
  placeOrderBtn.addEventListener("click", async () => {
    if (!currentUser) { showToast("Login required to place order"); openModal(authModal); return; }
    if (cart.length === 0) { showToast("Cart is empty"); return; }

    try {
      const snap = await getDoc(doc(db, "users", currentUser.uid));
      const profile = snap.exists() ? snap.data() : null;
      let roomNumber = null;

      if (profile && profile.role === "faculty") {
        if (facultyRoomInput && !facultyRoomInput.classList.contains("hidden") && facultyRoomInput.value.trim()) {
          roomNumber = facultyRoomInput.value.trim();
        } else {
          roomNumber = prompt("Enter Room Number for Delivery:");
        }
        if (!roomNumber) { showToast("Room number required for faculty delivery."); return; }
      }

      const ord = {
        userId: currentUser.uid,
        userName: profile?.name || currentUser.email.split('@')[0],
        items: cart,
        total: cart.reduce((s,i)=> s + (i.price||0) * i.qty, 0),
        status: "placed",
        paymentStatus: "unpaid",
        paymentMethod: "cash",
        tokenNumber: Date.now().toString().slice(-6),
        createdAt: serverTimestamp(),
        ...(roomNumber ? { roomNumber } : {})
      };

      await addDoc(collection(db, 'orders'), ord);
      showToast("Order placed!");
      cart = [];
      updateCartUI();
      closeCartSidebar();
      try { confetti({ particleCount: 120, spread: 70, origin: { y: 0.4 } }); } catch(e){}
    } catch (err) {
      console.error(err);
      showToast("Error placing order");
    }
  });
}

/* --------------- Auth UI handlers --------------- */
loginBtn && (loginBtn.onclick = () => {
  authMode = "login";
  authTitle && (authTitle.textContent = "Login");
  authCollege?.classList.add("hidden");
  authPhone?.classList.add("hidden");
  authSubmit && (authSubmit.textContent = "LOGIN");
  openModal(authModal);
});

signupBtn && (signupBtn.onclick = () => {
  authMode = "signup";
  authTitle && (authTitle.textContent = "Sign Up");
  authCollege?.classList.remove("hidden");
  authPhone?.classList.remove("hidden");
  authSubmit && (authSubmit.textContent = "SIGN UP");
  openModal(authModal);
});

toggleAuth && (toggleAuth.onclick = () => {
  if (authMode === "login") {
    authMode = "signup";
    authTitle && (authTitle.textContent = "Sign Up");
    authSubmit && (authSubmit.textContent = "SIGN UP");
    authCollege?.classList.remove("hidden");
    authPhone?.classList.remove("hidden");
    toggleAuth.textContent = "Login";
  } else {
    authMode = "login";
    authTitle && (authTitle.textContent = "Login");
    authSubmit && (authSubmit.textContent = "LOGIN");
    authCollege?.classList.add("hidden");
    authPhone?.classList.add("hidden");
    toggleAuth.textContent = "Sign Up";
  }
});

authClose && (authClose.onclick = () => closeModal(authModal));
orderClose && (orderClose.onclick = () => closeModal(orderModal));
studentClose && (studentClose.onclick = () => closeModal(studentPanel));
facultyClose && (facultyClose.onclick = () => closeModal(facultyPanel));

/* --------------- onAuthStateChanged: role-based UI --------------- */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  // reset UI
  loginBtn?.classList.remove("hidden");
  signupBtn?.classList.remove("hidden");
  studentPanelBtn?.classList.add("hidden");
  facultyPanelBtn?.classList.add("hidden");
  adminPanelBtn?.classList.add("hidden");
  profileSummary && (profileSummary.textContent = "");
  profileSummary && profileSummary.classList.add("hidden");

  if (!user) return;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? snap.data() : null;

    if (data) {
      profileSummary && (profileSummary.textContent = `${data.name || user.email} • ${data.role || ''}`);
      profileSummary && profileSummary.classList.remove("hidden");

      if (data.role === "faculty") facultyPanelBtn && facultyPanelBtn.classList.remove("hidden");
      else if (data.role === "admin") adminPanelBtn && adminPanelBtn.classList.remove("hidden");
      else studentPanelBtn && studentPanelBtn.classList.remove("hidden");
    } else {
      profileSummary && (profileSummary.textContent = user.email);
      studentPanelBtn && studentPanelBtn.classList.add("hidden");
    }
    loginBtn && loginBtn.classList.add("hidden");
    signupBtn && signupBtn.classList.add("hidden");
  } catch (err) {
    console.error("onAuthStateChanged error:", err);
  }
});

/* --------------- Student & Faculty Panel open --------------- */
studentPanelBtn && (studentPanelBtn.onclick = async () => {
  if (!currentUser) { showToast("Login first"); openModal(authModal); return; }
  const snap = await getDoc(doc(db, "users", currentUser.uid));
  const p = snap.exists() ? snap.data() : { email: currentUser.email };
  studentInfo && (studentInfo.innerHTML = `<div><strong>Name:</strong> ${p.name || currentUser.email.split('@')[0]}</div><div><strong>Email:</strong> ${p.email || currentUser.email}</div><div><strong>College:</strong> ${p.college || '-'}</div><div><strong>Phone:</strong> ${p.phone || '-'}</div>`);
  openModal(studentPanel);
});

facultyPanelBtn && (facultyPanelBtn.onclick = async () => {
  if (!currentUser) { showToast("Login first"); openModal(authModal); return; }
  const snap = await getDoc(doc(db, "users", currentUser.uid));
  const p = snap.exists() ? snap.data() : { email: currentUser.email };
  facultyInfo && (facultyInfo.innerHTML = `<div><strong>Name:</strong> ${p.name || currentUser.email.split('@')[0]}</div><div><strong>Email:</strong> ${p.email || currentUser.email}</div><div><strong>Phone:</strong> ${p.phone || '-'}</div>`);
  openModal(facultyPanel);
});

logoutBtn && (logoutBtn.onclick = async () => { await signOut(auth); closeModal(studentPanel); showToast("Logged out"); });
logoutFacultyBtn && (logoutFacultyBtn.onclick = async () => { await signOut(auth); closeModal(facultyPanel); showToast("Logged out"); });

/* --------------- Admin Panel UI --------------- */
adminPanelBtn && (adminPanelBtn.onclick = () => openAdmin());
adminClose && (adminClose.onclick = () => closeAdmin());

adminNavBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    adminNavBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const view = btn.dataset.view;
    adminViews.forEach(v => v.classList.add("hidden"));
    document.getElementById(`adminView_${view}`)?.classList.remove("hidden");
  });
});

/* --------------- Firestore listeners --------------- */
const ordersCol = collection(db, 'orders');
const ordersQuery = query(ordersCol, orderBy('createdAt', 'desc'));
onSnapshot(ordersQuery, snap => {
  orderDocsCache = snap.docs.map((d, idx) => ({ id: d.id, ...d.data(), __idx: idx+1 }));
  updateAdminDashboard();
  renderAdminOrders(orderDocsCache);
  renderTransactions(orderDocsCache);
});

const menuCol = collection(db, 'menuItems');
onSnapshot(menuCol, snap => {
  menuItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderMenu(menuItems);
  renderAdminMenu(menuItems);
});

/* --------------- Admin: Dashboard & Orders --------------- */
function updateAdminDashboard() {
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  let totalOrders = 0, earnings = 0, cash = 0, upi = 0, pending = 0, completed = 0;
  orderDocsCache.forEach(o => {
    totalOrders++;
    const created = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : null;
    if (!created) return;
    if (created >= todayStart) {
      earnings += (o.total||0);
      if (o.paymentMethod === 'upi' || o.paymentMethod === 'online') upi += (o.total||0); else cash += (o.total||0);
    }
    if (o.status === 'placed' || o.status === 'prepared') pending++;
    if (o.status === 'delivered' || o.status === 'completed') completed++;
  });

  admin_totalOrders && (admin_totalOrders.textContent = totalOrders);
  admin_earnings && (admin_earnings.textContent = `₹${earnings.toFixed(2)}`);
  admin_earnings_breakdown && (admin_earnings_breakdown.textContent = `Cash: ₹${cash.toFixed(2)} | Online: ₹${upi.toFixed(2)}`);
  admin_pending && (admin_pending.textContent = pending);
  admin_completed && (admin_completed.textContent = completed);
}

function renderAdminOrders(orders = []) {
  if (!admin_ordersList) return;
  const filter = (admin_orderSearch?.value || "").toLowerCase();
  admin_ordersList.innerHTML = "";
  orders.forEach(o => {
    const customer = o.userName || (o.userId && o.userId.slice(0,6)) || '';
    const token = o.tokenNumber || o.__idx || '-';
    const time = formatTime(o.createdAt);
    const line = `${customer} • ${token} • ${time} • ${o.status}`;
    if (filter && !line.toLowerCase().includes(filter) && !o.id.toLowerCase().includes(filter)) return;

    const el = document.createElement("div");
    el.className = "p-3 bg-white rounded shadow flex justify-between items-start";
    el.innerHTML = `
      <div style="flex:1">
        <div class="font-semibold">#${o.id} — ${customer}</div>
        <div class="text-xs text-gray-500">${time} • Token: ${token}</div>
        <div class="mt-2 text-sm">Total: ₹${(o.total||0).toFixed(2)} • ${o.paymentMethod || 'cash'} • ${o.paymentStatus || 'unpaid'}</div>
        <div class="mt-2 text-xs text-gray-600">Items: ${Array.isArray(o.items) ? o.items.map(it=> it.name + ` (x${it.qty})`).join(', ') : '-'}</div>
      </div>
      <div style="min-width:220px;text-align:right">
        <div class="mb-2">
          <button class="login-btn" data-id="${o.id}" data-action="prepare">Prepare</button>
          <button class="login-btn" data-id="${o.id}" data-action="deliver">Deliver</button>
        </div>
        <div>
          <button class="login-btn bg-white text-orange-600 border" data-id="${o.id}" data-action="cancel">Cancel</button>
          <button class="login-btn bg-white text-orange-600 border" data-id="${o.id}" data-action="togglepay">Toggle Pay</button>
        </div>
      </div>
    `;
    admin_ordersList.appendChild(el);
  });

  admin_ordersList.querySelectorAll('button[data-action]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const act = btn.dataset.action;
      if (act === 'prepare') await updateOrderStatus(id, 'prepared');
      if (act === 'deliver') await updateOrderStatus(id, 'delivered');
      if (act === 'cancel') await updateOrderStatus(id, 'cancelled');
      if (act === 'togglepay') await togglePaymentStatus(id);
    };
  });
}

async function updateOrderStatus(orderId, status) {
  try {
    await updateDoc(doc(db, 'orders', orderId), { status });
    showToast(`Order ${orderId} marked ${status}`);
  } catch (err) { console.error(err); showToast('Error updating order'); }
}

async function togglePaymentStatus(orderId) {
  try {
    const ref = doc(db, 'orders', orderId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const newStatus = (data.paymentStatus === 'paid') ? 'unpaid' : 'paid';
    await updateDoc(ref, { paymentStatus: newStatus });
    showToast(`Payment status toggled to ${newStatus}`);
  } catch (err) { console.error(err); showToast('Error toggling payment'); }
}

function renderTransactions(orders = []) {
  if (!admin_transactionsList) return;
  admin_transactionsList.innerHTML = "";
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  orders.filter(o => {
    const created = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : null;
    return created && created >= todayStart;
  }).forEach(o => {
    const el = document.createElement("div");
    el.className = "p-2 bg-white rounded shadow flex justify-between items-center";
    el.innerHTML = `<div><b>${o.id}</b> • ${o.userName || o.userId} • Token: ${o.tokenNumber || '-'}</div><div>₹${(o.total||0).toFixed(2)} • ${o.paymentMethod || 'cash'} • ${o.paymentStatus || 'unpaid'}</div>`;
    admin_transactionsList.appendChild(el);
  });
}

/* --------------- Admin menu management --------------- */
function renderAdminMenu(menu = []) {
  if (!admin_menuList) return;
  admin_menuList.innerHTML = "";
  menu.forEach(it => {
    const el = document.createElement("div");
    el.className = "p-2 bg-white rounded shadow flex justify-between items-center";
    el.innerHTML = `
      <div>
        <div class="font-semibold">${it.name} ${it.isAvailable ? '' : '(Sold out)'}</div>
        <div class="text-xs text-gray-600">${it.category} • ₹${(it.price||0).toFixed(2)}</div>
      </div>
      <div style="min-width:160px;text-align:right">
        <button class="login-btn bg-white text-orange-600 border" data-id="${it.id}" data-action="edit">Edit</button>
        <button class="login-btn bg-white text-orange-600 border" data-id="${it.id}" data-action="toggle">${it.isAvailable ? 'Mark Sold Out' : 'Mark In Stock'}</button>
        <button class="login-btn bg-white text-red-600 border" data-id="${it.id}" data-action="delete">Delete</button>
      </div>
    `;
    admin_menuList.appendChild(el);
  });

  admin_menuList.querySelectorAll('button[data-action]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const act = btn.dataset.action;
      if (act === 'edit') {
        const newPrice = prompt("Enter new price:");
        if (!newPrice) return;
        await updateDoc(doc(db,'menuItems',id), { price: Number(newPrice) });
      } else if (act === 'toggle') {
        const snap = await getDoc(doc(db,'menuItems',id));
        if (!snap.exists()) return;
        await updateDoc(doc(db,'menuItems',id), { isAvailable: !snap.data().isAvailable });
      } else if (act === 'delete') {
        if (!confirm("Delete this menu item?")) return;
        await deleteDoc(doc(db,'menuItems',id));
      }
    };
  });
}

/* Add new menu item */
admin_addItem && (admin_addItem.onclick = async () => {
  const name = (admin_newName?.value || "").trim();
  const price = Number(admin_newPrice?.value || 0);
  const cat = admin_newCat?.value || 'snacks';
  if (!name || !price) return showToast("Enter name & price");
  try {
    await addDoc(collection(db,'menuItems'), { name, price, category: cat, veg: true, img: '', isAvailable: true, createdAt: serverTimestamp() });
    admin_newName.value = ''; admin_newPrice.value = '';
    showToast("Menu item added");
  } catch (err) { console.error(err); showToast("Error adding item"); }
});

/* --------------- Admin search hook --------------- */
admin_orderSearch && admin_orderSearch.addEventListener("input", () => renderAdminOrders(orderDocsCache));

/* --------------- Category / Search / Veg --------------- */
categoryButtons && categoryButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    categoryButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCategory = btn.dataset.cat || "all";
    renderMenu();
  });
});

searchInput && searchInput.addEventListener("input", () => renderMenu());
vegFilterBtn && vegFilterBtn.addEventListener("click", () => { vegOnly = !vegOnly; vegFilterBtn.textContent = vegOnly ? "Veg Only" : "All"; renderMenu(); });

/* --------------- Auth submit handling --------------- */
authSubmit && (authSubmit.onclick = async () => {
  const email = (authUser?.value || "").trim().toLowerCase();
  const pass = (authPass?.value || "").trim();
  const college = (authCollege?.value || "").trim();
  const phone = (authPhone?.value || "").trim();

  if (!email || !pass) { showToast("Enter Email & Password"); return; }

  const role = (email.endsWith("@sigce.edu.in") || email.endsWith("@college.edu")) ? "faculty" : "student";

  try {
    if (authMode === "signup") {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db, "users", res.user.uid), {
        email,
        role,
        name: email.split("@")[0],
        phone,
        college,
        createdAt: serverTimestamp()
      });
      showToast(`Registered as ${role}`);
      closeModal(authModal);
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
      showToast("Login successful");
      closeModal(authModal);
    }
  } catch (err) {
    console.error(err);
    showToast(err.message || "Authentication error");
  }
});

/* --------------- Init small: render placeholders until Firestore data arrives --------------- */
renderMenu();
updateCartUI();
closeCartSidebar();
