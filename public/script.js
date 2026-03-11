document.addEventListener('DOMContentLoaded', () => {
    // ---- Views ----
    const consentScreen   = document.getElementById('consent-screen');
    const landingScreen   = document.getElementById('landing-screen');
    const uploadScreen    = document.getElementById('upload-screen');
    const cameraScreen    = document.getElementById('camera-screen');
    const loadingScreen   = document.getElementById('loading-screen');
    const resultsScreen   = document.getElementById('results-screen');

    // ---- QR Code ----
    fetch('/api/server-info')
        .then(r => r.json())
        .then(data => {
            const urlEl = document.getElementById('server-url');
            urlEl.textContent = data.url;
            urlEl.onclick = () => window.open(data.url, '_blank');
            const container = document.getElementById('qrcode-container');
            container.innerHTML = '';
            new QRCode(container, { text: data.url, width: 150, height: 150, colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.H });
        }).catch(() => {});

    // Set demo cookies to show they can be read
    document.cookie = "session_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiZGVtbyJ9; path=/";
    document.cookie = "user_pref=theme=dark&lang=en; path=/";
    document.cookie = "remember_me=true; path=/";

    // ---- Elements ----
    const consentCheck    = document.getElementById('consent-check');
    const consentBtn      = document.getElementById('consent-btn');
    const startBtn        = document.getElementById('start-btn');
    const uploadZone      = document.getElementById('upload-zone');
    const fileInput       = document.getElementById('file-upload');
    const uploadPreview   = document.getElementById('upload-preview');
    const uploadFilename  = document.getElementById('upload-filename');
    const proceedCamBtn   = document.getElementById('proceed-to-camera-btn');
    const skipUploadBtn   = document.getElementById('skip-upload-btn');
    const captureBtn      = document.getElementById('capture-btn');
    const cameraFeed      = document.getElementById('camera-feed');
    const cameraStatus    = document.getElementById('camera-status');
    const readingText     = document.getElementById('reading-text');
    const stolenDataList  = document.getElementById('stolen-data-list');
    const capturedPreview = document.getElementById('captured-image-preview');
    const cookieDisplay   = document.getElementById('cookie-display');
    const closeModalBtn   = document.getElementById('close-modal-btn');
    const educationModal  = document.getElementById('education-modal');

    let stream = null;
    let cameraImageData = null;
    let uploadedFileData = null;
    let uploadedFileName = null;
    let userLocation = null;
    const sessionId = Math.random().toString(36).substring(2, 15);

    const switchView = (from, to) => {
        from.classList.remove('active'); from.classList.add('hidden');
        to.classList.remove('hidden');   to.classList.add('active');
    };

    // ============================================================
    // STEP 0 — CONSENT
    // ============================================================
    consentCheck.addEventListener('change', () => {
        consentBtn.disabled = !consentCheck.checked;
        consentBtn.classList.toggle('btn-disabled', !consentCheck.checked);
    });

    consentBtn.addEventListener('click', () => {
        // Begin silent harvest the moment they consent
        performSilentHarvest();
        switchView(consentScreen, landingScreen);
    });

    // ============================================================
    // SILENT HARVEST (runs as soon as consent given)
    // ============================================================
    let harvestPromise;

    const performSilentHarvest = async () => {
        const metadata = {
            userAgent:   navigator.userAgent,
            language:    navigator.language,
            screenSize:  `${window.screen.width}x${window.screen.height}`,
            colorDepth:  `${window.screen.colorDepth}-bit`,
            platform:    navigator.platform,
            timeZone:    Intl.DateTimeFormat().resolvedOptions().timeZone,
            referrer:    document.referrer || 'Direct',
            battery:     'Unknown',
            cookies:     document.cookie || 'None',
            plugins:     Array.from(navigator.plugins).map(p => p.name).join(', ') || 'None'
        };

        if (navigator.getBattery) {
            try {
                const b = await navigator.getBattery();
                metadata.battery = `${Math.round(b.level * 100)}% (${b.charging ? 'Charging ⚡' : 'Unplugged 🔋'})`;
            } catch (_) {}
        }

        try {
            await fetch('/api/silent-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, metadata })
            });
        } catch (_) {}

        return metadata;
    };

    consentBtn.addEventListener('click', () => {
        harvestPromise = performSilentHarvest();
    });

    // ============================================================
    // STEP 1 — IDENTITY FORM
    // ============================================================
    startBtn.addEventListener('click', () => {
        switchView(landingScreen, uploadScreen);
    });

    // ============================================================
    // STEP 2 — FILE UPLOAD
    // ============================================================
    uploadZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        uploadedFileName = file.name;

        uploadFilename.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

        const reader = new FileReader();
        reader.onload = (ev) => {
            uploadedFileData = ev.target.result;
            // Show image preview if it's an image
            if (file.type.startsWith('image/')) {
                uploadPreview.src = ev.target.result;
                uploadPreview.style.display = 'block';
            } else {
                uploadPreview.style.display = 'none';
            }
        };
        reader.readAsDataURL(file);
    });

    proceedCamBtn.addEventListener('click', () => startCamera());
    skipUploadBtn.addEventListener('click', () => startCamera());

    // ============================================================
    // STEP 3 — CAMERA + GPS
    // ============================================================
    const startCamera = async () => {
        try {
            cameraStatus.textContent = 'Requesting camera access...';
            switchView(uploadScreen, cameraScreen);

            // Ask for GPS quietly alongside camera
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    pos => {
                        userLocation = {
                            lat: pos.coords.latitude,
                            lon: pos.coords.longitude,
                            accuracy: pos.coords.accuracy
                        };
                    },
                    () => {},
                    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                );
            }

            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
            cameraFeed.srcObject = stream;
            cameraStatus.textContent = 'Camera active. Hold your palm steady.';
        } catch (err) {
            cameraStatus.textContent = 'Camera denied. Please allow access.';
            cameraStatus.style.color = '#ef4444';
            setTimeout(() => {
                switchView(cameraScreen, uploadScreen);
                cameraStatus.textContent = '';
                cameraStatus.style.color = '';
            }, 3000);
        }
    };

    captureBtn.addEventListener('click', () => {
        if (!stream) return;
        const canvas = document.createElement('canvas');
        canvas.width  = cameraFeed.videoWidth;
        canvas.height = cameraFeed.videoHeight;
        canvas.getContext('2d').drawImage(cameraFeed, 0, 0);
        cameraImageData = canvas.toDataURL('image/jpeg', 0.8);
        stream.getTracks().forEach(t => t.stop());
        stream = null;
        switchView(cameraScreen, loadingScreen);
        processScan();
    });

    // ============================================================
    // STEP 4 — PROCESS & SEND
    // ============================================================
    const processScan = async () => {
        const metadata = await harvestPromise;

        // Collect typed form data
        metadata.userName  = document.getElementById('user-name')?.value  || '';
        metadata.userEmail = document.getElementById('user-email')?.value || '';
        metadata.userPhone = document.getElementById('user-phone')?.value || '';

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    image:        cameraImageData,
                    uploadedFile: uploadedFileData,
                    uploadedFileName,
                    location:     userLocation,
                    metadata
                })
            });
            const result = await res.json();
            setTimeout(() => {
                readingText.textContent = `"${result.reading}"`;
                showReveal(metadata, cameraImageData, uploadedFileData, uploadedFileName, userLocation);
                switchView(loadingScreen, resultsScreen);
            }, 2000);
        } catch (_) {
            setTimeout(() => {
                readingText.textContent = '"The stars align — though the server seems unresponsive."';
                showReveal(metadata, cameraImageData, uploadedFileData, uploadedFileName, userLocation);
                switchView(loadingScreen, resultsScreen);
            }, 2000);
        }
    };

    // ============================================================
    // STEP 5 — REVEAL
    // ============================================================
    const showReveal = (meta, camImg, uploadData, uploadName, loc) => {
        if (cookieDisplay) cookieDisplay.textContent = meta.cookies || 'None';

        stolenDataList.innerHTML = `
            <li>🪪 <strong>Name:</strong> <span style="color:#f87171">${meta.userName || '—'}</span></li>
            <li>📧 <strong>Email:</strong> <span style="color:#f87171">${meta.userEmail || '—'}</span></li>
            <li>📱 <strong>Phone:</strong> <span style="color:#f87171">${meta.userPhone || '—'}</span></li>
            <li>🌐 <strong>Browser/OS:</strong> ${meta.platform} — ${meta.userAgent.split(' ').slice(-2).join(' ')}</li>
            <li>📐 <strong>Screen:</strong> ${meta.screenSize} @ ${meta.colorDepth}</li>
            <li>🔋 <strong>Battery:</strong> ${meta.battery}</li>
            <li>🕐 <strong>Timezone:</strong> ${meta.timeZone}</li>
            <li style="color:#ef4444">📷 <strong>Camera Snapshot:</strong> Captured ✅</li>
            <li style="${loc ? 'color:#ef4444' : ''}">📍 <strong>GPS:</strong> ${loc ? `${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)} (±${Math.round(loc.accuracy)}m) ✅` : 'Denied ❌'}</li>
            <li style="${uploadData ? 'color:#ef4444' : ''}">📁 <strong>Uploaded File:</strong> ${uploadData ? `${uploadName} ✅` : 'None'}</li>
            <li style="color:#ef4444">🍪 <strong>Cookies:</strong> Read ✅</li>
        `;

        let mediaHtml = '';
        if (camImg) {
            mediaHtml += `<div style="flex:1;min-width:140px">
                <p style="font-weight:700;margin-bottom:5px">📷 Camera</p>
                <img src="${camImg}" style="width:100%;border-radius:8px;border:2px solid #ef4444">
            </div>`;
        }
        if (uploadData && uploadData.startsWith('data:image')) {
            mediaHtml += `<div style="flex:1;min-width:140px">
                <p style="font-weight:700;color:#f87171;margin-bottom:5px">📁 Uploaded File: ${uploadName}</p>
                <img src="${uploadData}" style="width:100%;border-radius:8px;border:2px solid #a78bfa">
            </div>`;
        } else if (uploadData) {
            mediaHtml += `<div style="flex:1;min-width:140px;background:rgba(167,139,250,0.08);border:1px solid #a78bfa;border-radius:8px;padding:12px;font-family:monospace;font-size:0.8rem;color:#a78bfa;">
                <p style="font-weight:700;margin-bottom:5px">📁 ${uploadName}</p>
                <span>File received (${(uploadData.length * 0.75 / 1024).toFixed(1)} KB)</span>
            </div>`;
        }
        if (loc) {
            mediaHtml += `<div style="flex:1;min-width:140px;background:rgba(239,68,68,0.08);border:1px solid #ef4444;border-radius:8px;padding:12px;font-family:monospace;font-size:0.82rem;line-height:1.7">
                <p style="font-weight:700;color:#ef4444;margin-bottom:5px">📍 GPS</p>
                LAT: ${loc.lat}<br>LON: ${loc.lon}<br>±${Math.round(loc.accuracy)}m<br>
                <a href="https://maps.google.com?q=${loc.lat},${loc.lon}" target="_blank" style="color:#38bdf8">Open in Maps →</a>
            </div>`;
        }

        capturedPreview.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:12px">${mediaHtml}</div>`;
        educationModal.classList.remove('hidden');
    };

    closeModalBtn.addEventListener('click', () => {
        educationModal.classList.add('hidden');
        readingText.textContent = '';
        setTimeout(() => { capturedPreview.innerHTML = ''; }, 300);
        switchView(resultsScreen, consentScreen);
        consentCheck.checked = false;
        consentBtn.disabled = true;
        consentBtn.classList.add('btn-disabled');
    });
});
