let appConfig = JSON.parse(localStorage.getItem('umah_config')) || {
    brandName: "Jastip Umma Shanum",
    brandAddress: "Kantor Pusat Rajeg, Tangerang",
    adminPass: "Rojak123",
    markupAmount: 5000,
    platformDiscountPercent: 0,
    sellerAudioUrl: "https://www.myinstants.com/media/sounds/notification-sound-7062.mp3",
    buyerAudioUrl: "https://www.myinstants.com/media/sounds/success-1-6283.mp3",

    // Konfigurasi API Eksternal & Pembayaran
    rajaOngkirApiKey: "",
    paymentApiKey: "",
    qrislyApiKey: "",

    marketLogoBase64: "",
    promoTopBase64: "",
    promoBottomBase64: "",
    categories: [
        { name: "Makanan", icon: "" },
        { name: "Minuman", icon: "" },
        { name: "Sembako", icon: "" },
        { name: "Elektronik", icon: "" }
    ]
};

let users = JSON.parse(localStorage.getItem('umah_users')) || [];
let products = JSON.parse(localStorage.getItem('umah_products')) || [];
let orders = JSON.parse(localStorage.getItem('umah_orders')) || [];
let reviews = JSON.parse(localStorage.getItem('umah_reviews')) || [];

let currentUser = JSON.parse(localStorage.getItem('umah_current_user')) || null;
let activeRole = null;
let selectedStoreId = null;
let selectedCategoryFilter = 'Semua';
let cart = [];
let signatureDataUrl = "";
let sigCanvas, sigCtx, isDrawing = false;

function speakVoice(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        let utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

// FUNGSI UNLOCK AUDIO DI BROWSER HP SAAT KLIK PERTAMA
function unlockAudioAndProceed(roleAction) {
    let dummyAudio = new Audio(appConfig.sellerAudioUrl || "https://www.myinstants.com/media/sounds/notification-sound-7062.mp3");
    dummyAudio.volume = 0.01;
    dummyAudio.play().catch(e => console.log("Audio unlock triggered"));

    if(roleAction === 'buyer') {
        showAuthMode('buyer');
    } else if(roleAction === 'seller-prop') {
        startSellerRegistrationFlow();
    }
}

function playSellerRingtone() {
    const audio = new Audio(appConfig.sellerAudioUrl || "https://www.myinstants.com/media/sounds/notification-sound-7062.mp3");
    audio.play().catch(e => console.log("Seller audio blocked"));
}

function playBuyerRingtone() {
    const audio = new Audio(appConfig.buyerAudioUrl || "https://www.myinstants.com/media/sounds/success-1-6283.mp3");
    audio.play().catch(e => console.log("Buyer audio blocked"));
}

function initSignaturePad() {
    sigCanvas = document.getElementById('seller-sig-canvas');
    if (!sigCanvas) return;
    sigCtx = sigCanvas.getContext('2d');
    sigCtx.strokeStyle = '#000';
    sigCtx.lineWidth = 2;

    sigCanvas.addEventListener('mousedown', startDraw);
    sigCanvas.addEventListener('mousemove', drawing);
    sigCanvas.addEventListener('mouseup', stopDraw);
    sigCanvas.addEventListener('mouseleave', stopDraw);

    sigCanvas.addEventListener('touchstart', (e) => {
        let touch = e.touches[0];
        let mouseEvent = new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY });
        sigCanvas.dispatchEvent(mouseEvent);
    }, { passive: true });

    sigCanvas.addEventListener('touchmove', (e) => {
        let touch = e.touches[0];
        let mouseEvent = new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY });
        sigCanvas.dispatchEvent(mouseEvent);
    }, { passive: true });

    sigCanvas.addEventListener('touchend', () => {
        let mouseEvent = new MouseEvent('mouseup', {});
        sigCanvas.dispatchEvent(mouseEvent);
    }, { passive: true });
}

function getMousePos(canvas, evt) {
    let rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

function startDraw(e) {
    isDrawing = true;
    let pos = getMousePos(sigCanvas, e);
    sigCtx.beginPath();
    sigCtx.moveTo(pos.x, pos.y);
    let statusText = document.getElementById('sig-status-text');
    if(statusText) statusText.innerText = "Sedang tanda tangan...";
}

function drawing(e) {
    if (!isDrawing) return;
    let pos = getMousePos(sigCanvas, e);
    sigCtx.lineTo(pos.x, pos.y);
    sigCtx.stroke();
}

function stopDraw() {
    if (!isDrawing) return;
    isDrawing = false;
    signatureDataUrl = sigCanvas.toDataURL();
    let statusText = document.getElementById('sig-status-text');
    if(statusText) statusText.innerText = "✓ Tanda tangan tersimpan";
}

function clearSellerSignature() {
    if (!sigCtx || !sigCanvas) return;
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    signatureDataUrl = "";
    let statusText = document.getElementById('sig-status-text');
    if(statusText) statusText.innerText = "Belum ditandatangani";
}

function compressImageHD(file, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(event) {
        const img = new Image();
        img.src = event.target.result;
        img.onload = function() {
            let width = img.width, height = img.height;
            const maxDim = 1280;
            if (width > maxDim || height > maxDim) {
                if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
                else { width = Math.round((width * maxDim) / height); height = maxDim; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.95));
        }
    }
}

function compressImage(file, maxWidth, maxHeight, quality, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(event) {
        const img = new Image();
        img.src = event.target.result;
        img.onload = function() {
            let width = img.width, height = img.height;
            if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
            if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', quality));
        }
    }
}

window.onload = function() {
    applyConfig();
    checkSession();
}

function applyConfig() {
    let titleEl = document.getElementById('app-title');
    if(titleEl) titleEl.innerText = appConfig.brandName;
    
    const marketLogoDisplay = document.getElementById('auth-brand-logo-display');
    const authFormLogo = document.getElementById('auth-form-brand-logo');
    if (marketLogoDisplay && authFormLogo) {
        if (appConfig.marketLogoBase64) {
            let logoHtml = `<img src="${appConfig.marketLogoBase64}" class="h-14 max-w-[240px] object-contain bg-transparent filter drop-shadow">`;
            marketLogoDisplay.innerHTML = logoHtml;
            authFormLogo.innerHTML = logoHtml;

            const manifestTag = document.getElementById('pwa-manifest');
            if(manifestTag) {
                const manifestData = {
                    name: appConfig.brandName,
                    short_name: "UmmaShanum",
                    start_url: ".",
                    display: "standalone",
                    background_color: "#ffffff",
                    theme_color: "#059669",
                    icons: [{ src: appConfig.marketLogoBase64, sizes: "192x192 512x512", type: "image/png" }]
                };
                manifestTag.href = "data:application/manifest+json;charset=utf-8," + encodeURIComponent(JSON.stringify(manifestData));
            }
        } else {
            let textHtml = `<h2 class="text-2xl font-bold text-emerald-600">${appConfig.brandName}</h2>`;
            marketLogoDisplay.innerHTML = textHtml;
            authFormLogo.innerHTML = textHtml;
        }
    }

    if(document.getElementById('admin-setting-brand')) document.getElementById('admin-setting-brand').value = appConfig.brandName;
    if(document.getElementById('admin-setting-address')) document.getElementById('admin-setting-address').value = appConfig.brandAddress;
    if(document.getElementById('admin-setting-pass')) document.getElementById('admin-setting-pass').value = appConfig.adminPass || 'Rojak123';
    if(document.getElementById('admin-setting-markup')) document.getElementById('admin-setting-markup').value = appConfig.markupAmount || 5000;
    if(document.getElementById('admin-setting-discount')) document.getElementById('admin-setting-discount').value = appConfig.platformDiscountPercent || 0;
    if(document.getElementById('admin-setting-seller-audio')) document.getElementById('admin-setting-seller-audio').value = appConfig.sellerAudioUrl || '';
    if(document.getElementById('admin-setting-buyer-audio')) document.getElementById('admin-setting-buyer-audio').value = appConfig.buyerAudioUrl || '';
    
    if(document.getElementById('admin-setting-rajaongkir-key')) document.getElementById('admin-setting-rajaongkir-key').value = appConfig.rajaOngkirApiKey || '';
    if(document.getElementById('admin-setting-payment-key')) document.getElementById('admin-setting-payment-key').value = appConfig.paymentApiKey || '';
    if(document.getElementById('admin-setting-qrisly-key')) document.getElementById('admin-setting-qrisly-key').value = appConfig.qrislyApiKey || '';

    renderAdminCodProofs();
}

function checkSession() {
    if (currentUser) {
        hideAllViews();
        if (currentUser.role === 'buyer') {
            showBuyerDashboard();
            speakVoice("Selamat datang kembali, Kak! Silakan pilih produk terbaik dari toko mitra lokal terdekat.");
        } else if (currentUser.role === 'seller') {
            showSellerDashboard();
            speakVoice("Halo, Mitra UMKM hebat! Selamat datang di dashboard toko Anda.");
        } else if (currentUser.role === 'sales') {
            showSalesDashboard();
            speakVoice("Halo, Mitra Sales! Selamat datang di dashboard jaringan afiliasi Anda.");
        }
    } else {
        hideAllViews();
        if(document.getElementById('view-auth')) document.getElementById('view-auth').classList.remove('hidden');
        if(document.getElementById('auth-selection-card')) document.getElementById('auth-selection-card').classList.remove('hidden');
    }
}

function hideAllViews() {
    document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));
    if(document.getElementById('dynamic-auth-form')) document.getElementById('dynamic-auth-form').classList.add('hidden');
    if(document.getElementById('auth-selection-card')) document.getElementById('auth-selection-card').classList.add('hidden');
    if(document.getElementById('view-seller-proposal')) document.getElementById('view-seller-proposal').classList.add('hidden');
}

function startSellerRegistrationFlow() {
    document.getElementById('auth-selection-card').classList.add('hidden');
    document.getElementById('view-seller-proposal').classList.remove('hidden');
    setTimeout(initSignaturePad, 100);
}

function agreeProposalAndProceed() {
    if (!signatureDataUrl) {
        alert("Mohon lakukan tanda tangan digital terlebih dahulu!");
        return;
    }
    document.getElementById('view-seller-proposal').classList.add('hidden');
    showAuthMode('seller');
}

function cancelProposal() {
    document.getElementById('view-seller-proposal').classList.add('hidden');
    document.getElementById('auth-selection-card').classList.remove('hidden');
}

function showAuthMode(role) {
    activeRole = role;
    document.getElementById('auth-role').value = role;
    document.getElementById('auth-selection-card').classList.add('hidden');
    document.getElementById('dynamic-auth-form').classList.remove('hidden');
    
    if (role === 'buyer') {
        document.getElementById('auth-form-title').innerText = 'Masuk / Daftar Pembeli';
        document.getElementById('field-category').classList.add('hidden');
        document.getElementById('field-bank').classList.add('hidden');
        document.getElementById('field-ref-code').classList.remove('hidden');
        document.getElementById('field-store-logo').classList.add('hidden');
    } else if (role === 'seller') {
        document.getElementById('auth-form-title').innerText = 'Form Pendaftaran Mitra Penjual';
        document.getElementById('field-category').classList.remove('hidden');
        document.getElementById('field-bank').classList.remove('hidden');
        document.getElementById('field-ref-code').classList.remove('hidden');
        document.getElementById('field-store-logo').classList.remove('hidden');
        
        let catSelect = document.getElementById('auth-category');
        if(catSelect) {
            catSelect.innerHTML = '';
            appConfig.categories.forEach(cat => {
                let cName = typeof cat === 'string' ? cat : cat.name;
                catSelect.innerHTML += `<option value="${cName}">${cName}</option>`;
            });
        }
    }
    document.getElementById('field-name').classList.remove('hidden');
    document.getElementById('field-address').classList.remove('hidden');
}

function checkExistingUser() {
    const waInput = document.getElementById('auth-wa');
    if(!waInput) return;
    const wa = waInput.value.trim();
    if (!wa) return;
    let existing = users.find(u => u.wa === wa);
    if (existing) {
        activeRole = existing.role;
        document.getElementById('field-name').classList.add('hidden');
        document.getElementById('field-address').classList.add('hidden');
        document.getElementById('field-category').classList.add('hidden');
        document.getElementById('field-bank').classList.add('hidden');
        document.getElementById('field-ref-code').classList.add('hidden');
        document.getElementById('field-store-logo').classList.add('hidden');
        document.getElementById('auth-submit-btn').innerText = "Masuk (Akun Terdaftar)";
    } else {
        document.getElementById('field-name').classList.remove('hidden');
        document.getElementById('field-address').classList.remove('hidden');
        if(activeRole === 'seller') {
            document.getElementById('field-category').classList.remove('hidden');
            document.getElementById('field-bank').classList.remove('hidden');
            document.getElementById('field-ref-code').classList.remove('hidden');
            document.getElementById('field-store-logo').classList.remove('hidden');
        } else if(activeRole === 'buyer') {
            document.getElementById('field-ref-code').classList.remove('hidden');
        }
        document.getElementById('auth-submit-btn').innerText = "Daftar & Masuk";
    }
}

function cancelAuth() {
    document.getElementById('dynamic-auth-form').classList.add('hidden');
    document.getElementById('auth-selection-card').classList.remove('hidden');
}

function handleAuth(event) {
    event.preventDefault();
    const wa = document.getElementById('auth-wa').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    
    let user = users.find(u => u.wa === wa);
    if (user) {
        if (user.pass !== pass) { alert("Kata sandi salah!"); return; }
        currentUser = user;
        checkSession();
    } else {
        const name = document.getElementById('auth-name').value.trim();
        const address = document.getElementById('auth-address').value.trim();
        if (!name || !address) { alert("Nama dan alamat wajib diisi!"); return; }
        
        if (activeRole === 'seller') {
            const storeLogoFile = document.getElementById('auth-store-logo-file');
            if (storeLogoFile && storeLogoFile.files && storeLogoFile.files[0]) {
                compressImage(storeLogoFile.files[0], 200, 200, 0.9, function(base64Logo) {
                    saveNewUser(name, wa, pass, address, base64Logo, signatureDataUrl);
                });
                return;
            }
        }
        saveNewUser(name, wa, pass, address, "", signatureDataUrl);
    }
}

function saveNewUser(name, wa, pass, address, storeLogo, signature) {
    let generatedCode = activeRole === 'sales' ? (name.substring(0,3).toUpperCase() + Math.floor(100 + Math.random() * 900)) : '';
    let refCodeInputEl = document.getElementById('auth-ref-code');
    let refCodeInput = refCodeInputEl ? refCodeInputEl.value.trim().toUpperCase() : '-';

    let user = {
        id: 'usr_' + Date.now(),
        name: name,
        wa: wa,
        pass: pass,
        role: activeRole,
        category: activeRole === 'seller' ? (document.getElementById('auth-category') ? document.getElementById('auth-category').value : 'Umum') : '',
        addresses: [{ label: "Utama", detail: address }],
        storeLogo: storeLogo,
        signature: signature || "",
        refCode: generatedCode,
        referredBy: refCodeInput || '-',
        bank: activeRole === 'seller' ? (document.getElementById('auth-bank-info') ? document.getElementById('auth-bank-info').value : '') : '',
        isOpen: true
    };
    users.push(user);
    localStorage.setItem('umah_users', JSON.stringify(users));
    currentUser = user;
    localStorage.setItem('umah_current_user', JSON.stringify(currentUser));
    checkSession();
}

function logout() {
    localStorage.removeItem('umah_current_user');
    currentUser = null;
    cart = [];
    checkSession();
}

function showBuyerDashboard() {
    hideAllViews();
    let dash = document.getElementById('view-buyer-dashboard');
    if(dash) dash.classList.remove('hidden');
    
    let greeting = document.getElementById('buyer-greeting');
    if(greeting) greeting.innerText = "Halo, " + currentUser.name;
    
    const container = document.getElementById('buyer-shops-container');
    if (container) {
        container.innerHTML = '';
        let sellers = users.filter(u => u.role === 'seller');
        if (selectedCategoryFilter !== 'Semua') sellers = sellers.filter(s => s.category === selectedCategoryFilter);

        if (sellers.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-500 text-center bg-white/95 backdrop-blur p-4 rounded-xl">Belum ada toko mitra saat ini.</p>';
        } else {
            sellers.forEach(seller => {
                const isOpen = seller.isOpen !== false;
                let storeReviews = reviews.filter(r => r.storeId === seller.id);
                let avgRating = storeReviews.length > 0 ? (storeReviews.reduce((sum, r) => sum + r.rating, 0) / storeReviews.length).toFixed(1) : 'Belum ada rating';
                const statusBadge = isOpen ? '<span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold">BUKA</span>' : '<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-semibold">TUTUP</span>';
                let storeLogoHtml = seller.storeLogo ? `<img src="${seller.storeLogo}" class="w-12 h-12 object-cover rounded-full mr-3 border bg-transparent flex-shrink-0">` : `<div class="w-12 h-12 bg-emerald-100 text-emerald-700 font-bold rounded-full mr-3 flex items-center justify-center flex-shrink-0">🛒</div>`;

                container.innerHTML += `
                    <div onclick="openStoreCatalog('${seller.id}')" class="bg-white/95 backdrop-blur p-4 rounded-xl shadow-md cursor-pointer transition hover:shadow-lg ${isOpen ? '' : 'shop-closed'} flex items-center">
                        ${storeLogoHtml}
                        <div class="flex-grow">
                            <div class="flex justify-between items-center mb-0.5">
                                <h4 class="font-bold text-md text-emerald-800">${seller.name}</h4>
                                ${statusBadge}
                            </div>
                            <p class="text-xs text-emerald-600 font-semibold mb-0.5">📂 ${seller.category || 'Umum'} | ⭐ ${avgRating} (${storeReviews.length})</p>
                            <p class="text-xs text-gray-500">📍 ${seller.addresses ? seller.addresses[0].detail : 'Alamat tidak diisi'}</p>
                        </div>
                    </div>
                `;
            });
        }
    }
    renderBuyerTracking();
}

function filterByCategory(cat) { selectedCategoryFilter = cat; showBuyerDashboard(); }

function openAddressManager() {
    let modal = document.getElementById('modal-address-manager');
    if(modal) modal.classList.remove('hidden');
    renderBuyerAddressList();
}
function closeAddressManager() {
    let modal = document.getElementById('modal-address-manager');
    if(modal) modal.classList.add('hidden');
}

function renderBuyerAddressList() {
    const container = document.getElementById('buyer-address-list');
    if(!container) return;
    container.innerHTML = '';
    if (!currentUser.addresses) currentUser.addresses = [];
    currentUser.addresses.forEach((addr, idx) => {
        container.innerHTML += `
            <div class="border p-2 rounded bg-gray-50 flex justify-between items-center">
                <div><b>${addr.label}</b>: ${addr.detail}</div>
                ${currentUser.addresses.length > 1 ? `<button onclick="removeBuyerAddress(${idx})" class="text-red-500 font-bold px-2">×</button>` : ''}
            </div>
        `;
    });
}

function addNewBuyerAddress() {
    const label = document.getElementById('new-addr-label').value.trim();
    const detail = document.getElementById('new-addr-detail').value.trim();
    if (!label || !detail) { alert("Label dan detail alamat wajib diisi!"); return; }
    currentUser.addresses.push({ label, detail });
    users = users.map(u => u.id === currentUser.id ? currentUser : u);
    localStorage.setItem('umah_users', JSON.stringify(users));
    localStorage.setItem('umah_current_user', JSON.stringify(currentUser));
    document.getElementById('new-addr-label').value = '';
    document.getElementById('new-addr-detail').value = '';
    renderBuyerAddressList();
    showBuyerDashboard();
}

function removeBuyerAddress(idx) {
    currentUser.addresses.splice(idx, 1);
    users = users.map(u => u.id === currentUser.id ? currentUser : u);
    localStorage.setItem('umah_users', JSON.stringify(users));
    localStorage.setItem('umah_current_user', JSON.stringify(currentUser));
    renderBuyerAddressList();
    showBuyerDashboard();
}

function renderBuyerTracking() {
    const container = document.getElementById('buyer-tracking-container');
    if(!container) return;
    container.innerHTML = '';
    let allOrders = JSON.parse(localStorage.getItem('umah_orders')) || [];
    const myOrders = allOrders.filter(o => o.buyerWa === currentUser.wa);
    if (myOrders.length === 0) { container.innerHTML = '<p class="text-gray-400">Belum ada pesanan.</p>'; return; }
    myOrders.forEach(ord => {
        container.innerHTML += `
            <div class="border p-3 rounded-lg space-y-1 bg-white/95">
                <p class="font-bold">ID PO: ${ord.id}</p>
                <p>Total: Rp${ord.total.toLocaleString()} (${ord.paymentMethod || 'COD'})</p>
                <div class="p-2 rounded text-center font-bold bg-emerald-100 text-emerald-800">🛵 Status: ${ord.deliveryStatus || 'Menunggu Konfirmasi'}</div>
            </div>
        `;
    });
}

function openStoreCatalog(sellerId) {
    selectedStoreId = sellerId;
    const seller = users.find(u => u.id === sellerId);
    if(!seller) return;
    const isOpen = seller.isOpen !== false;
    hideAllViews();
    let storeCatView = document.getElementById('view-store-catalog');
    if(storeCatView) storeCatView.classList.remove('hidden');
    
    let headerEl = document.getElementById('store-catalog-header');
    if(headerEl) {
        headerEl.innerHTML = `
            <h3 class="font-bold text-lg text-emerald-800">${seller.name}</h3>
            <p class="text-xs text-gray-500">📍 Lokasi: ${seller.addresses ? seller.addresses[0].detail : '-'}</p>
        `;
    }
    
    const prodContainer = document.getElementById('store-products-container');
    if(prodContainer) {
        prodContainer.innerHTML = '';
        let allProducts = JSON.parse(localStorage.getItem('umah_products')) || [];
        const storeProds = allProducts.filter(p => p.sellerId === sellerId);
        if (storeProds.length === 0) { prodContainer.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Belum ada produk.</p>'; return; }
        storeProds.forEach(prod => {
            const markup = appConfig.markupAmount || 5000;
            const markupPrice = prod.basePrice + markup;
            prodContainer.innerHTML += `
                <div class="bg-white/95 backdrop-blur p-3 rounded-xl shadow-sm flex items-center justify-between">
                    <div><h5 class="font-bold text-sm">${prod.name}</h5><p class="text-xs text-emerald-600 font-semibold">Rp${markupPrice.toLocaleString()}</p></div>
                    <button onclick="addToCart('${prod.id}', '${prod.name}', ${prod.basePrice}, ${markupPrice})" class="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold">Tambah</button>
                </div>
            `;
        });
    }
    updateCartSummary();
}

function backToBuyerDashboard() { selectedStoreId = null; cart = []; showBuyerDashboard(); }
function addToCart(id, name, basePrice, price) { cart.push({ id, name, basePrice, price, storeId: selectedStoreId }); updateCartSummary(); alert(name + " ditambahkan!"); }

function updateCartSummary() {
    let subtotal = cart.reduce((sum, i) => sum + i.price, 0);
    let shipping = subtotal > 0 ? 15000 : 0;
    let total = subtotal + shipping;

    if(document.getElementById('cart-subtotal')) document.getElementById('cart-subtotal').innerText = "Rp" + subtotal.toLocaleString();
    if(document.getElementById('shipping-cost')) document.getElementById('shipping-cost').innerText = "Rp" + shipping.toLocaleString();
    if(document.getElementById('cart-total-final')) document.getElementById('cart-total-final').innerText = "Rp" + total.toLocaleString();
}

function checkoutOrder() {
    if (cart.length === 0) { alert("Keranjang kosong!"); return; }
    let subtotal = cart.reduce((sum, i) => sum + i.price, 0);
    let allOrders = JSON.parse(localStorage.getItem('umah_orders')) || [];
    const newOrder = {
        id: 'ord_' + Date.now(),
        timestamp: Date.now(),
        buyerName: currentUser.name,
        buyerWa: currentUser.wa,
        paymentMethod: 'COD',
        items: [...cart],
        total: subtotal + 15000,
        storeId: selectedStoreId,
        deliveryStatus: 'Menunggu Konfirmasi Toko',
        codStatus: "Belum Setor"
    };
    allOrders.push(newOrder);
    localStorage.setItem('umah_orders', JSON.stringify(allOrders));
    playBuyerRingtone();
    alert("Pesanan berhasil dibuat!");
    cart = [];
    showBuyerDashboard();
}

function showSellerDashboard() {
    hideAllViews();
    let viewSel = document.getElementById('view-seller-dashboard');
    if(viewSel) viewSel.classList.remove('hidden');
    if(document.getElementById('seller-shop-name')) document.getElementById('seller-shop-name').innerText = currentUser.name;
    renderSellerPOs();
}

function showSalesDashboard() {
    hideAllViews();
    let viewSales = document.getElementById('view-sales-dashboard');
    if(viewSales) viewSales.classList.remove('hidden');
    if(document.getElementById('sales-dashboard-name')) document.getElementById('sales-dashboard-name').innerText = currentUser.name;
    if(document.getElementById('sales-my-code')) document.getElementById('sales-my-code').innerText = currentUser.refCode || 'BELUM ADA';
}

function checkSellerOverdueCod(sellerId) {}
function toggleShopStatus() {
    currentUser.isOpen = !currentUser.isOpen;
    users = users.map(u => u.id === currentUser.id ? currentUser : u);
    localStorage.setItem('umah_users', JSON.stringify(users));
    localStorage.setItem('umah_current_user', JSON.stringify(currentUser));
    showSellerDashboard();
}

function addSellerProduct(event) {
    event.preventDefault();
    const name = document.getElementById('prod-name').value;
    const basePrice = parseInt(document.getElementById('prod-price').value);
    const fileInput = document.getElementById('prod-image-file');

    if (fileInput && fileInput.files && fileInput.files[0]) {
        compressImage(fileInput.files[0], 500, 500, 0.9, function(base64Img) {
            let allProducts = JSON.parse(localStorage.getItem('umah_products')) || [];
            allProducts.push({ id: 'prd_' + Date.now(), sellerId: currentUser.id, name, basePrice, image: base64Img });
            localStorage.setItem('umah_products', JSON.stringify(allProducts));
            alert("Produk berhasil disimpan!");
            showSellerDashboard();
        });
    } else { alert("Wajib upload foto produk!"); }
}

function renderSellerPOs() {
    const container = document.getElementById('seller-po-container');
    if(!container) return;
    container.innerHTML = '';
    let allOrders = JSON.parse(localStorage.getItem('umah_orders')) || [];
    const myOrders = allOrders.filter(o => o.storeId === currentUser.id);
    if (myOrders.length === 0) { container.innerHTML = '<p class="text-gray-400">Belum ada PO masuk.</p>'; return; }
    myOrders.forEach(ord => {
        container.innerHTML += `
            <div class="border p-3 rounded-lg space-y-2 bg-white/95">
                <p class="font-bold">ID PO: ${ord.id}</p>
                <p>Pemesan: ${ord.buyerName}</p>
                <p class="font-semibold text-emerald-700">Total: Rp${ord.total.toLocaleString()}</p>
            </div>
        `;
    });
}

function updateStatus(id) {}
function renderSellerInvoice() {}

// ⭐ GERBANG CERDAS RODA GIGI (Akses Admin atau Login Otomatis Mitra via Kode Unik)
function openAdminOrSalesLogin() {
    const inputKey = prompt("Masukkan Kata Sandi Admin / Kode Unik Mitra:");
    if (inputKey === null) return;
    
    let cleanKey = inputKey.trim();

    // 1. Cek apakah yang dimasukkan adalah Sandi Admin Utama
    if (cleanKey === (appConfig.adminPass || "Rojak123")) {
        hideAllViews();
        let adminPanel = document.getElementById('view-admin-panel');
        if(adminPanel) adminPanel.classList.remove('hidden');
        renderAdminCodProofs();
        renderAdminGlobalRecap();
        return;
    }

    // 2. Cek apakah yang dimasukkan adalah Kode Unik / Nomor WA Mitra (Seller/Sales)
    let foundUser = users.find(u => u.refCode === cleanKey.toUpperCase() || u.wa === cleanKey || u.id === cleanKey);
    if (foundUser) {
        currentUser = foundUser;
        localStorage.setItem('umah_current_user', JSON.stringify(currentUser));
        checkSession();
        alert(`Berhasil masuk ke akun: ${currentUser.name} (${currentUser.role.toUpperCase()})`);
        return;
    }

    alert("Kata sandi atau Kode Unik tidak dikenali!");
}

function backFromAdmin() { checkSession(); }

function renderAdminCodProofs() {}
function renderAdminGlobalRecap() {}
function verifyCodPayment(orderId) {}

function saveAdminSettings() {
    let brandInput = document.getElementById('admin-setting-brand');
    let addressInput = document.getElementById('admin-setting-address');
    let passInput = document.getElementById('admin-setting-pass');
    let markupInput = document.getElementById('admin-setting-markup');
    let discInput = document.getElementById('admin-setting-discount');
    let sellerAudioInput = document.getElementById('admin-setting-seller-audio');
    let buyerAudioInput = document.getElementById('admin-setting-buyer-audio');
    
    let rajaKeyInput = document.getElementById('admin-setting-rajaongkir-key');
    let paymentKeyInput = document.getElementById('admin-setting-payment-key');
    let qrislyKeyInput = document.getElementById('admin-setting-qrisly-key');

    if(brandInput) appConfig.brandName = brandInput.value;
    if(addressInput) appConfig.brandAddress = addressInput.value;
    if(passInput && passInput.value.trim()) appConfig.adminPass = passInput.value.trim();

    if(markupInput) appConfig.markupAmount = parseInt(markupInput.value) || 5000;
    if(discInput) appConfig.platformDiscountPercent = parseInt(discInput.value) || 0;
    if(sellerAudioInput) appConfig.sellerAudioUrl = sellerAudioInput.value.trim();
    if(buyerAudioInput) appConfig.buyerAudioUrl = buyerAudioInput.value.trim();

    if(rajaKeyInput) appConfig.rajaOngkirApiKey = rajaKeyInput.value.trim();
    if(paymentKeyInput) appConfig.paymentApiKey = paymentKeyInput.value.trim();
    if(qrislyKeyInput) appConfig.qrislyApiKey = qrislyKeyInput.value.trim();

    localStorage.setItem('umah_config', JSON.stringify(appConfig));
    applyConfig();
    alert("Pengaturan & API Keys berhasil disimpan!");
}
