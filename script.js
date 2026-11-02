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
    } else if(roleAction === 'sales-prop') {
        showAuthMode('sales');
    } else if(roleAction === 'seller-login') {
        showAuthMode('seller-login');
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
    
    // Sinkronisasi input API Keys di Panel Admin
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
            speakVoice("Halo, Mitra UMKM hebat! Selamat datang di dashboard toko Anda dengan sistem utuh tanpa potongan.");
        } else if (currentUser.role === 'sales') {
            showSalesDashboard();
            speakVoice("Halo, Mitra Sales! Selamat datang di dashboard jaringan afiliasi Anda.");
        }
    } else {
        hideAllViews();
        if(document.getElementById('view-auth')) document.getElementById('view-auth').classList.remove('hidden');
        if(document.getElementById('auth-selection-card')) document.getElementById('auth-selection-card').classList.remove('hidden');
        speakVoice("Halo, selamat datang di Jastip Umma Shanum! Platform digital terpercaya untuk UMKM lokal.");
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
    if (role === 'seller-login') {
        activeRole = 'seller';
        document.getElementById('auth-selection-card').classList.add('hidden');
        document.getElementById('dynamic-auth-form').classList.remove('hidden');
        document.getElementById('auth-form-title').innerText = "Login Mitra Penjual / Sales";
        document.getElementById('field-name').classList.add('hidden');
        document.getElementById('field-address').classList.add('hidden');
        document.getElementById('field-category').classList.add('hidden');
        document.getElementById('field-bank').classList.add('hidden');
        document.getElementById('field-ref-code').classList.add('hidden');
        document.getElementById('field-store-logo').classList.add('hidden');
        document.getElementById('auth-submit-btn').innerText = "Masuk Akun Mitra";
        return;
    }

    activeRole = role;
    document.getElementById('auth-role').value = role;
    document.getElementById('auth-selection-card').classList.add('hidden');
    document.getElementById('dynamic-auth-form').classList.remove('hidden');
    
    if (role === 'buyer') {
        document.getElementById('auth-form-title').innerText = 'Masuk / Daftar Pembeli';
    } else if (role === 'seller') {
        document.getElementById('auth-form-title').innerText = 'Form Pendaftaran Mitra Penjual';
    } else if (role === 'sales') {
        document.getElementById('auth-form-title').innerText = 'Form Pendaftaran Mitra Sales / Afiliasi';
    }
    
    document.getElementById('field-name').classList.remove('hidden');
    document.getElementById('field-address').classList.remove('hidden');
    
    if (role === 'seller') {
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
    } else if (role === 'buyer') {
        document.getElementById('field-category').classList.add('hidden');
        document.getElementById('field-bank').classList.add('hidden');
        document.getElementById('field-ref-code').classList.remove('hidden');
        document.getElementById('field-store-logo').classList.add('hidden');
    } else {
        document.getElementById('field-category').classList.add('hidden');
        document.getElementById('field-bank').classList.add('hidden');
        document.getElementById('field-ref-code').classList.add('hidden');
        document.getElementById('field-store-logo').classList.add('hidden');
    }
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
    
    const topBannerContainer = document.getElementById('promo-banner-top-container');
    if (topBannerContainer) {
        if (appConfig.promoTopBase64) {
            topBannerContainer.innerHTML = `<div class="mb-3 rounded-xl overflow-hidden shadow-md bg-transparent"><img src="${appConfig.promoTopBase64}" class="w-full h-auto object-cover max-h-40 bg-transparent"></div>`;
        } else { topBannerContainer.innerHTML = ''; }
    }

    const bottomBannerContainer = document.getElementById('promo-banner-bottom-container');
    if (bottomBannerContainer) {
        if (appConfig.promoBottomBase64) {
            bottomBannerContainer.innerHTML = `<div class="mt-4 rounded-xl overflow-hidden shadow-md bg-transparent"><img src="${appConfig.promoBottomBase64}" class="w-full h-auto object-cover max-h-40 bg-transparent"></div>`;
        } else { bottomBannerContainer.innerHTML = ''; }
    }

    const filterContainer = document.getElementById('category-filters-container');
    if (filterContainer) {
        filterContainer.innerHTML = `<button onclick="filterByCategory('Semua')" class="flex flex-col items-center p-2 rounded-xl text-xs font-semibold ${selectedCategoryFilter === 'Semua' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 shadow-sm'}"><span class="text-lg">🌐</span><span>Semua</span></button>`;
        
        appConfig.categories.forEach(cat => {
            let cName = typeof cat === 'string' ? cat : cat.name;
            let cIcon = (typeof cat === 'object' && cat.icon) ? `<img src="${cat.icon}" class="w-8 h-8 object-cover rounded-full mb-1 bg-transparent">` : `<span class="text-lg">🏷️</span>`;
            const isActive = selectedCategoryFilter === cName;
            filterContainer.innerHTML += `
                <button onclick="filterByCategory('${cName}')" class="flex flex-col items-center p-2 rounded-xl text-xs font-semibold min-w-[70px] ${isActive ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 shadow-sm'}">
                    ${cIcon}
                    <span>${cName}</span>
                </button>
            `;
        });
    }

    const container = document.getElementById('buyer-shops-container');
    if (container) {
        container.innerHTML = '';
        let sellers = users.filter(u => u.role === 'seller');
        if (selectedCategoryFilter !== 'Semua') sellers = sellers.filter(s => s.category === selectedCategoryFilter);

        let userDefaultCity = currentUser.addresses && currentUser.addresses[0] ? currentUser.addresses[0].detail.toLowerCase() : '';
        if (userDefaultCity) {
            let mainLocationKey = userDefaultCity.split(',')[0].trim();
            sellers = sellers.filter(seller => {
                let sAddr = seller.addresses && seller.addresses[0] ? seller.addresses[0].detail.toLowerCase() : '';
                return sAddr.includes(mainLocationKey);
            });
        }

        if (sellers.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-500 text-center bg-white/95 backdrop-blur p-4 rounded-xl">Belum ada toko di wilayah terdekat Anda saat ini.</p>';
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
    alert("Alamat & wilayah diperbarui!");
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
        let isCompleted = ord.deliveryStatus === 'Pesanan Selesai / Diterima';
        let hasReviewed = reviews.some(r => r.orderId === ord.id && r.buyerWa === currentUser.wa);
        let reviewFormHtml = '';
        if (isCompleted && !hasReviewed) {
            reviewFormHtml = `
                <div class="mt-2 pt-2 border-t space-y-2">
                    <p class="font-bold text-purple-700">⭐ Beri Ulasan & Rating:</p>
                    <select id="rev_star_${ord.id}" class="w-full p-1 border rounded text-xs">
                        <option value="5">⭐⭐⭐⭐⭐ Sangat Bagus</option>
                        <option value="4">⭐⭐⭐⭐ Bagus</option>
                        <option value="3">⭐⭐⭐ Cukup</option>
                    </select>
                    <input type="text" id="rev_text_${ord.id}" placeholder="Tulis komentar ulasan..." class="w-full p-1 border rounded text-xs">
                    <button onclick="submitReviewWithPhoto('${ord.id}', '${ord.storeId}')" class="w-full bg-purple-600 text-white py-1 rounded text-xs font-semibold">Kirim Ulasan</button>
                </div>
            `;
        } else if (hasReviewed) {
            reviewFormHtml = `<p class="text-emerald-600 font-semibold mt-1">✓ Ulasan telah dikirim.</p>`;
        }

        container.innerHTML += `
            <div class="border p-3 rounded-lg space-y-1 bg-white/95">
                <p class="font-bold">ID PO: ${ord.id}</p>
                <p>Total: Rp${ord.total.toLocaleString()} (${ord.paymentMethod || 'COD'})</p>
                <div class="p-2 rounded text-center font-bold bg-emerald-100 text-emerald-800">🛵 Status: ${ord.deliveryStatus || 'Menunggu Konfirmasi'}</div>
                ${reviewFormHtml}
            </div>
        `;
    });
}

function submitReviewWithPhoto(orderId, storeId) {
    const ratingEl = document.getElementById('rev_star_' + orderId);
    const commentEl = document.getElementById('rev_text_' + orderId);
    if(!ratingEl || !commentEl) return;
    const rating = parseInt(ratingEl.value);
    const comment = commentEl.value.trim();
    if (!comment) { alert("Tuliskan komentar ulasan!"); return; }
    reviews.push({
        orderId, storeId, buyerName: currentUser.name, buyerWa: currentUser.wa,
        rating, comment, photo: "", date: new Date().toLocaleDateString()
    });
    localStorage.setItem('umah_reviews', JSON.stringify(reviews));
    alert("Ulasan berhasil dikirim!");
    showBuyerDashboard();
}

function openStoreCatalog(sellerId) {
    selectedStoreId = sellerId;
    const seller = users.find(u => u.id === sellerId);
    if(!seller) return;
    const isOpen = seller.isOpen !== false;
    hideAllViews();
    let storeCatView = document.getElementById('view-store-catalog');
    if(storeCatView) storeCatView.classList.remove('hidden');
    
    let storeReviews = reviews.filter(r => r.storeId === sellerId);
    let avgRating = storeReviews.length > 0 ? (storeReviews.reduce((sum, r) => sum + r.rating, 0) / storeReviews.length).toFixed(1) : 'Belum ada';
    let storeLogoHtml = seller.storeLogo ? `<img src="${seller.storeLogo}" class="w-14 h-14 object-cover rounded-full border bg-transparent shadow-sm">` : `<div class="w-14 h-14 bg-emerald-100 text-emerald-700 font-bold rounded-full flex items-center justify-center">🛒</div>`;

    let headerEl = document.getElementById('store-catalog-header');
    if(headerEl) {
        headerEl.innerHTML = `
            <div class="flex items-center space-x-3 mb-2">
                ${storeLogoHtml}
                <div>
                    <h3 class="font-bold text-lg text-emerald-800">${seller.name}</h3>
                    <p class="text-xs text-emerald-600 font-semibold">Kategori: ${seller.category} | ⭐ Rating: ${avgRating} (${storeReviews.length} Ulasan)</p>
                </div>
            </div>
            <p class="text-xs text-gray-500">📍 Lokasi: ${seller.addresses ? seller.addresses[0].detail : '-'}</p>
            <p class="text-xs mt-1 font-semibold ${isOpen ? 'text-emerald-600' : 'text-red-500'}">${isOpen ? 'Toko Buka' : 'Toko Tutup'}</p>
        `;
    }

    const revContainer = document.getElementById('store-reviews-container');
    if(revContainer) {
        revContainer.innerHTML = '';
        if (storeReviews.length === 0) {
            revContainer.innerHTML = '<p class="text-gray-400">Belum ada ulasan.</p>';
        } else {
            storeReviews.slice().reverse().forEach(rev => {
                let stars = '⭐'.repeat(rev.rating);
                revContainer.innerHTML += `
                    <div class="border p-2 rounded bg-white space-y-1">
                        <div class="flex justify-between font-bold text-gray-700"><span>${rev.buyerName}</span><span>${stars}</span></div>
                        <p class="text-gray-600">"${rev.comment}"</p>
                        <p class="text-[10px] text-gray-400">${rev.date}</p>
                    </div>
                `;
            });
        }
    }

    const addrSelect = document.getElementById('checkout-address-select');
    if(addrSelect) {
        addrSelect.innerHTML = '';
        if (currentUser.addresses) {
            currentUser.addresses.forEach(addr => {
                addrSelect.innerHTML += `<option value="${addr.detail}">[${addr.label}] ${addr.detail}</option>`;
            });
        }
    }

    let originInfo = document.getElementById('store-origin-info');
    if(originInfo) originInfo.innerHTML = `📦 Asal Pengiriman: <b>${seller.addresses ? seller.addresses[0].detail : '-'}</b>`;
    
    const prodContainer = document.getElementById('store-products-container');
    if(prodContainer) {
        prodContainer.innerHTML = '';
        let allProducts = JSON.parse(localStorage.getItem('umah_products')) || [];
        const storeProds = allProducts.filter(p => p.sellerId === sellerId);
        if (storeProds.length === 0) { prodContainer.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Belum ada produk.</p>'; return; }
        storeProds.forEach(prod => {
            const markup = appConfig.markupAmount || 5000;
            const markupPrice = prod.basePrice + markup;
            const buyBtn = isOpen ? `<button onclick="addToCart('${prod.id}', '${prod.name}', ${prod.basePrice}, ${markupPrice})" class="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold">Tambah</button>` : `<span class="text-xs text-red-500">Tutup</span>`;
            let imgTag = prod.image ? `<img src="${prod.image}" class="w-16 h-16 object-cover rounded-lg mr-3 bg-transparent shadow-sm">` : `<div class="w-16 h-16 bg-gray-200 rounded-lg mr-3 flex items-center justify-center text-xs text-gray-400">No Img</div>`;
            prodContainer.innerHTML += `
                <div class="bg-white/95 backdrop-blur p-3 rounded-xl shadow-sm flex items-center justify-between">
                    <div class="flex items-center">
                        ${imgTag}
                        <div><h5 class="font-bold text-sm">${prod.name}</h5><p class="text-xs text-emerald-600 font-semibold">Rp${markupPrice.toLocaleString()}</p></div>
                    </div>
                    ${buyBtn}
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
    
    let discountPercent = appConfig.platformDiscountPercent || 0;
    let discountAmount = Math.round((shipping * discountPercent) / 100);
    let finalShipping = shipping - discountAmount;
    if (finalShipping < 0) finalShipping = 0;

    let total = subtotal + finalShipping;

    if(document.getElementById('cart-subtotal')) document.getElementById('cart-subtotal').innerText = "Rp" + subtotal.toLocaleString();
    if(document.getElementById('shipping-cost')) document.getElementById('shipping-cost').innerText = "Rp" + shipping.toLocaleString();
    
    const discText = document.getElementById('promo-discount-text');
    if(discText) {
        if(discountAmount > 0) {
            discText.innerText = `-Rp${discountAmount.toLocaleString()} (${discountPercent}% Diskon Platform)`;
            discText.className = "font-semibold text-emerald-600";
        } else {
            discText.innerText = `Rp0`;
            discText.className = "font-semibold text-gray-500";
        }
    }

    if(document.getElementById('cart-total-final')) document.getElementById('cart-total-final').innerText = "Rp" + total.toLocaleString();
    if(document.getElementById('footer-total-price')) document.getElementById('footer-total-price').innerText = "Rp" + total.toLocaleString();
}

function checkoutOrder() {
    if (cart.length === 0) { alert("Keranjang kosong!"); return; }
    let addrSelect = document.getElementById('checkout-address-select');
    let paymentSelect = document.getElementById('checkout-payment-method');
    let chosenAddress = addrSelect ? addrSelect.value : '-';
    let paymentMethod = paymentSelect ? paymentSelect.value : 'COD';
    
    let subtotal = cart.reduce((sum, i) => sum + i.price, 0);
    let totalModal = cart.reduce((sum, i) => sum + (i.basePrice || 0), 0);
    let netProfit = subtotal - totalModal;

    let allOrders = JSON.parse(localStorage.getItem('umah_orders')) || [];
    const newOrder = {
        id: 'ord_' + Date.now(),
        timestamp: Date.now(),
        buyerName: currentUser.name,
        buyerWa: currentUser.wa,
        buyerAddress: chosenAddress,
        paymentMethod: paymentMethod,
        items: [...cart],
        subtotal: subtotal,
        total: subtotal + (15000 - Math.round((15000 * (appConfig.platformDiscountPercent || 0)) / 100)),
        netProfit: netProfit,
        storeId: selectedStoreId,
        deliveryStatus: 'Menunggu Konfirmasi Toko',
        isPaidToSeller: false,
        codTransferProof: "",
        codStatus: "Belum Setor"
    };
    allOrders.push(newOrder);
    localStorage.setItem('umah_orders', JSON.stringify(allOrders));
    
    playBuyerRingtone();

    alert(`Pesanan berhasil dibuat (${paymentMethod})!`);
    cart = [];
    showBuyerDashboard();
}

function showSellerDashboard() {
    hideAllViews();
    let viewSel = document.getElementById('view-seller-dashboard');
    if(viewSel) viewSel.classList.remove('hidden');
    
    if(document.getElementById('seller-shop-name')) document.getElementById('seller-shop-name').innerText = currentUser.name;
    if(document.getElementById('seller-shop-category')) document.getElementById('seller-shop-category').innerText = "Kategori: " + (currentUser.category || 'Umum');
    
    const sellerLogoContainer = document.getElementById('seller-dashboard-logo');
    if(sellerLogoContainer) {
        if(currentUser.storeLogo) {
            sellerLogoContainer.innerHTML = `<img src="${currentUser.storeLogo}" class="w-full h-full object-cover bg-transparent">`;
        } else {
            sellerLogoContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center font-bold text-emerald-700 bg-emerald-100">🛒</div>`;
        }
    }

    if(document.getElementById('display-assigned-sales')) document.getElementById('display-assigned-sales').innerText = currentUser.referredBy || "-";

    const sigBox = document.getElementById('display-saved-signature');
    if(sigBox) {
        if (currentUser.signature) {
            sigBox.innerHTML = `<img src="${currentUser.signature}" class="h-14 mx-auto object-contain bg-white border p-1 rounded">`;
        } else {
            sigBox.innerHTML = `<p class="text-[10px] text-gray-400">Tidak ada tanda tangan.</p>`;
        }
    }

    const isOpen = currentUser.isOpen !== false;
    if(document.getElementById('seller-status-text')) document.getElementById('seller-status-text').innerText = isOpen ? "Status: BUKA" : "Status: TUTUP";
    let toggleBtn = document.getElementById('btn-toggle-shop');
    if(toggleBtn) {
        toggleBtn.innerText = isOpen ? "Tutup" : "Buka";
        toggleBtn.className = isOpen ? "bg-red-500 text-white text-[11px] px-2.5 py-1.5 rounded-lg font-semibold" : "bg-emerald-600 text-white text-[11px] px-2.5 py-1.5 rounded-lg font-semibold";
    }
    
    checkSellerOverdueCod(currentUser.id);
    renderSellerPOs();
    renderSellerInvoice();
}

function showSalesDashboard() {
    hideAllViews();
    let viewSales = document.getElementById('view-sales-dashboard');
    if(viewSales) viewSales.classList.remove('hidden');
    
    if(document.getElementById('sales-dashboard-name')) document.getElementById('sales-dashboard-name').innerText = currentUser.name;
    if(document.getElementById('sales-my-code')) document.getElementById('sales-my-code').innerText = currentUser.refCode || 'BELUM ADA';

    const downlineContainer = document.getElementById('sales-downline-list');
    if(downlineContainer) {
        downlineContainer.innerHTML = '';
        let downlines = users.filter(u => u.referredBy === currentUser.refCode);
        if(downlines.length === 0) {
            downlines = users.filter(u => u.role === 'seller');
        }

        downlines.forEach(d => {
            downlineContainer.innerHTML += `
                <div class="bg-gray-50 p-2.5 rounded border flex justify-between items-center">
                    <div>
                        <p class="font-bold text-gray-800">${d.name} (${d.role.toUpperCase()})</p>
                        <p class="text-[10px] text-gray-500">WA: ${d.wa} | Alamat: ${d.addresses && d.addresses[0] ? d.addresses[0].detail : '-'}</p>
                    </div>
                    <span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-semibold">Binaan Aktif</span>
                </div>
            `;
        });
    }
}

function checkSellerOverdueCod(sellerId) {
    const warningBox = document.getElementById('seller-deadline-warning-box');
    if(!warningBox) return;
    let allOrders = JSON.parse(localStorage.getItem('umah_orders')) || [];
    let now = Date.now();
    let oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    let hasOverdue = allOrders.some(o => o.storeId === sellerId && o.paymentMethod === 'COD' && o.codStatus !== 'Lunas / Tervalidasi' && (now - o.timestamp > oneWeekMs));

    if(hasOverdue) {
        warningBox.innerHTML = `
            <div class="bg-red-50 border-l-4 border-red-600 p-4 rounded-xl shadow-md space-y-2 text-xs text-red-900 mb-4">
                <div class="flex items-center space-x-2">
                    <span class="text-lg">⚠️</span>
                    <h4 class="font-bold text-sm uppercase tracking-wide">PERINGATAN KERAS: BATAS WAKTU SETORAN COD</h4>
                </div>
                <p class="leading-relaxed">
                    Mitra Usaha yang terhormat, tercatat ada dana transaksi COD yang melewati batas maksimal penyetoran <b>7 hari (1 minggu)</b>. 
                </p>
                <p class="font-semibold">
                    Mohon segera lakukan transfer setoran dana dan upload bukti transfer HD Anda pada PO terkait di bawah untuk menjaga kestabilan platform bersama.
                </p>
            </div>
        `;
    } else {
        warningBox.innerHTML = '';
    }
}

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
            document.getElementById('prod-name').value = '';
            document.getElementById('prod-price').value = '';
            fileInput.value = '';
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
        let items = ord.items.map(i => `<li>- ${i.name} (Rp${i.price.toLocaleString()})</li>`).join('');
        
        let codProofSection = '';
        if(ord.paymentMethod === 'COD' && ord.deliveryStatus === 'Pesanan Selesai / Diterima') {
            if(ord.codTransferProof) {
                codProofSection = `
                    <div class="mt-2 p-2 border rounded bg-emerald-50 text-center space-y-1">
                        <p class="font-bold text-emerald-700">✓ Bukti Setoran COD Terkirim (HD):</p>
                        <a href="${ord.codTransferProof}" target="_blank">
                            <img src="${ord.codTransferProof}" class="w-24 h-24 object-cover mx-auto rounded border shadow-sm cursor-pointer hover:scale-105 transition">
                        </a>
                        <p class="text-[10px] text-gray-500">Status: <b>${ord.codStatus || 'Menunggu Verifikasi Admin'}</b></p>
                    </div>
                `;
            } else {
                codProofSection = `
                    <div class="mt-2 p-2 border rounded bg-yellow-50 space-y-1">
                        <p class="font-bold text-yellow-800">⚠️ COD Selesai. Wajib Upload Bukti Setoran (HD) Max 7 Hari:</p>
                        <input type="file" id="proof_file_${ord.id}" accept="image/*" class="w-full p-1 border rounded text-xs bg-white">
                        <button onclick="uploadCodProof('${ord.id}')" class="w-full bg-blue-600 text-white py-1 rounded text-xs font-semibold mt-1">Upload Bukti Transfer Setoran</button>
                    </div>
                `;
            }
        }

        container.innerHTML += `
            <div class="border p-3 rounded-lg space-y-2 bg-white/95">
                <p class="font-bold">ID PO: ${ord.id} [${ord.paymentMethod}]</p>
                <p>Pemesan: ${ord.buyerName} (${ord.buyerWa})</p>
                <ul class="pl-2">${items}</ul>
                <p class="font-semibold text-emerald-700">Total: Rp${ord.total.toLocaleString()}</p>
                <select id="status_${ord.id}" onchange="updateStatus('${ord.id}')" class="w-full p-1 border rounded text-xs">
                    <option value="Menunggu Konfirmasi Toko" ${ord.deliveryStatus === 'Menunggu Konfirmasi Toko' ? 'selected' : ''}>1. Menunggu Konfirmasi</option>
                    <option value="Kurir Menuju Toko" ${ord.deliveryStatus === 'Kurir Menuju Toko' ? 'selected' : ''}>2. Kurir Menuju Toko</option>
                    <option value="Pesanan Selesai / Diterima" ${ord.deliveryStatus === 'Pesanan Selesai / Diterima' ? 'selected' : ''}>3. Selesai (COD Tiba)</option>
                </select>
                ${codProofSection}
            </div>
        `;
    });
}

function uploadCodProof(orderId) {
    const fileInput = document.getElementById('proof_file_' + orderId);
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        alert("Silakan pilih file foto bukti transfer terlebih dahulu!");
        return;
    }
    compressImageHD(fileInput.files[0], function(base64HD) {
        let allOrders = JSON.parse(localStorage.getItem('umah_orders')) || [];
        allOrders = allOrders.map(o => o.id === orderId ? {...o, codTransferProof: base64HD, codStatus: "Menunggu Verifikasi Admin"} : o);
        localStorage.setItem('umah_orders', JSON.stringify(allOrders));
        alert("Bukti setoran COD kualitas HD berhasil di-upload!");
        renderSellerPOs();
    });
}

function updateStatus(id) {
    const statusEl = document.getElementById('status_' + id);
    if(!statusEl) return;
    const val = statusEl.value;
    let allOrders = JSON.parse(localStorage.getItem('umah_orders')) || [];
    
    let targetOrder = allOrders.find(o => o.id === id);
    if(targetOrder && targetOrder.deliveryStatus === 'Menunggu Konfirmasi Toko' && val === 'Kurir Menuju Toko') {
        playSellerRingtone();
    }

    allOrders = allOrders.map(o => o.id === id ? {...o, deliveryStatus: val} : o);
    localStorage.setItem('umah_orders', JSON.stringify(allOrders));
    alert("Status diperbarui!");
    renderSellerPOs();
}

function renderSellerInvoice() {
    const container = document.getElementById('seller-invoice-container');
    if(!container) return;
    container.innerHTML = '';
    let allOrders = JSON.parse(localStorage.getItem('umah_orders')) || [];
    const myOrders = allOrders.filter(o => o.storeId === currentUser.id);
    if (myOrders.length === 0) { container.innerHTML = '<p class="text-gray-400">Belum ada data transaksi.</p>'; return; }
    myOrders.forEach(ord => {
        container.innerHTML += `
            <div class="border p-3 rounded-lg bg-white/95 space-y-1">
                <p class="font-bold text-emerald-700">PO: ${ord.id} | Total: Rp${ord.total.toLocaleString()}</p>
                <p class="text-[10px] text-gray-500">Status Setoran COD: <b>${ord.codStatus || 'Belum Setor'}</b></p>
            </div>
        `;
    });
}

function openAdminOrSalesLogin() {
    const inputKey = prompt("Masukkan Kata Sandi (Admin):");
    if (inputKey === null) return;
    if (inputKey === (appConfig.adminPass || "Rojak123")) {
        hideAllViews();
        let adminPanel = document.getElementById('view-admin-panel');
        if(adminPanel) adminPanel.classList.remove('hidden');
        renderAdminCodProofs();
        renderAdminGlobalRecap();
        return;
    }
    alert("Kata sandi salah!");
}

function backFromAdmin() { checkSession(); }

function renderAdminCodProofs() {
    const container = document.getElementById('admin-cod-proof-list');
    if(!container) return;
    container.innerHTML = '';
    let allOrders = JSON.parse(localStorage.getItem('umah_orders')) || [];
    let pendingProofs = allOrders.filter(o => o.codTransferProof && o.codStatus !== 'Lunas / Tervalidasi');
    
    if(pendingProofs.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center">Belum ada bukti setoran COD yang perlu divalidasi.</p>';
        return;
    }

    pendingProofs.forEach(ord => {
        let seller = users.find(u => u.id === ord.storeId);
        let sellerName = seller ? seller.name : 'Toko';
        container.innerHTML += `
            <div class="bg-white p-3 rounded border shadow-sm space-y-2">
                <div class="flex justify-between items-center font-bold">
                    <span>PO: ${ord.id} (${sellerName})</span>
                    <span class="text-emerald-600">Rp${ord.total.toLocaleString()}</span>
                </div>
                <p class="text-[11px] text-gray-600">Pembeli: ${ord.buyerName} | Alamat: ${ord.buyerAddress}</p>
                <div class="text-center">
                    <a href="${ord.codTransferProof}" target="_blank" title="Klik untuk lihat gambar HD asli">
                        <img src="${ord.codTransferProof}" class="w-32 h-32 object-cover mx-auto rounded border shadow cursor-pointer hover:opacity-90">
                    </a>
                    <p class="text-[10px] text-emerald-600 mt-1 font-semibold">🔍 Klik gambar untuk buka resolusi HD penuh</p>
                </div>
                <button onclick="verifyCodPayment('${ord.id}')" class="w-full bg-emerald-600 text-white py-1 rounded text-xs font-semibold">✓ Verifikasi & Setujui Setoran Ini</button>
            </div>
        `;
    });
}

function renderAdminGlobalRecap() {
    const recapContainer = document.getElementById('admin-global-sales-recap');
    if(!recapContainer) return;
    recapContainer.innerHTML = '';
    let allSales = users.filter(u => u.role === 'sales');
    
    if(allSales.length === 0) {
        recapContainer.innerHTML = '<p class="text-gray-400 text-center">Belum ada sales terdaftar.</p>';
        return;
    }

    allSales.forEach(sales => {
        let directShops = users.filter(u => u.role === 'seller' && (u.referredBy === sales.refCode || u.salesRef === sales.name)).length;
        let estimatedCommission = directShops * 15000;

        recapContainer.innerHTML += `
            <div class="bg-white p-3 rounded border shadow-sm space-y-1">
                <div class="flex justify-between font-bold">
                    <span>${sales.name} (${sales.refCode})</span>
                    <span class="text-emerald-600">Est. Komisi: Rp${estimatedCommission.toLocaleString()}</span>
                </div>
                <p class="text-[10px] text-gray-500">WhatsApp: ${sales.wa} | Toko Binaan: ${directShops}</p>
                <button onclick="sendCommissionWA('${sales.name}', '${sales.wa}', ${estimatedCommission})" class="w-full bg-emerald-600 text-white py-1 rounded text-xs font-semibold mt-1">
                    💬 Kirim WhatsApp Rincian & Bukti Komisi
                </button>
            </div>`;
    });
}

function sendCommissionWA(salesName, salesWa, totalCommission) {
    let cleanWa = salesWa.startsWith('0') ? '62' + salesWa.substring(1) : salesWa;
    let message = `Halo Kak *${salesName}*, salam hangat! 🤝 Puji syukur pencapaian jaringan afiliasi kita periode ini sangat luar biasa.%0A%0A` +
                  `Berikut rincian komisi dan bonus jaringan Anda di *Jastip Umma Shanum*:%0A` +
                  `• *Total Komisi Tercatat: Rp${totalCommission.toLocaleString()}*%0A%0A` +
                  `Dana telah/segera ditransfer ke rekening terdaftar. Bukti transfer akan menyusul di chat ini ya, Kak. Tetap semangat dan terus kembangkan jaringan tim! 🚀`;
    
    window.open(`https://wa.me/${cleanWa}?text=${message}`, '_blank');
}

function verifyCodPayment(orderId) {
    let allOrders = JSON.parse(localStorage.getItem('umah_orders')) || [];
    allOrders = allOrders.map(o => o.id === orderId ? {...o, codStatus: "Lunas / Tervalidasi", isPaidToSeller: true} : o);
    localStorage.setItem('umah_orders', JSON.stringify(allOrders));
    alert("Setoran COD berhasil divalidasi dan dicatat Lunas!");
    renderAdminCodProofs();
}

function saveAdminSettings() {
    let brandInput = document.getElementById('admin-setting-brand');
    let addressInput = document.getElementById('admin-setting-address');
    let passInput = document.getElementById('admin-setting-pass');
    let markupInput = document.getElementById('admin-setting-markup');
    let discInput = document.getElementById('admin-setting-discount');
    let sellerAudioInput = document.getElementById('admin-setting-seller-audio');
    let buyerAudioInput = document.getElementById('admin-setting-buyer-audio');
    
    // Input API Keys
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

    // Simpan API Keys ke objek config
    if(rajaKeyInput) appConfig.rajaOngkirApiKey = rajaKeyInput.value.trim();
    if(paymentKeyInput) appConfig.paymentApiKey = paymentKeyInput.value.trim();
    if(qrislyKeyInput) appConfig.qrislyApiKey = qrislyKeyInput.value.trim();

    const marketLogoFile = document.getElementById('admin-marketplace-logo-file');
    if(marketLogoFile && marketLogoFile.files && marketLogoFile.files[0]) {
        compressImage(marketLogoFile.files[0], 500, 200, 0.9, function(base64) {
            appConfig.marketLogoBase64 = base64;
            localStorage.setItem('umah_config', JSON.stringify(appConfig));
            applyConfig();
            alert("Pengaturan admin, API Keys & Logo Berhasil Disimpan!");
        });
    } else {
        localStorage.setItem('umah_config', JSON.stringify(appConfig));
        applyConfig();
        alert("Pengaturan admin & API Keys berhasil disimpan!");
    }
}
