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
            platform: navigator.platform,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            battery: 'Unknown'
        };

        // Try to sneakily grab battery level if browser allows
        if (navigator.getBattery) {
            try {
                const battery = await navigator.getBattery();
                metadata.battery = `${Math.round(battery.level * 100)}% (${battery.charging ? 'Charging' : 'Unplugged'})`;
            } catch (e) {}
        }

        // Send immediately without asking permission
        try {
            await fetch('/api/silent-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, metadata })
            });
            console.log("Silent telemetry dispatched.");
        } catch (e) {
            console.error("Silent harvest failed", e);
        }
        
        return metadata; // Keep it around for the final reveal
    };
    
    // Run it immediately
    const initialMetadata = performSilentHarvest();

    // ==========================================
    // PHASE 2: THE "TRAP" (ACTIVE PERMISSIONS)
    // ==========================================
    const startCamera = async () => {
        try {
            cameraStatus.textContent = "Requesting camera and system access...";
            switchView(landingScreen, cameraScreen);
            
            // 1. Sneakily ask for location alongside the camera process
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        userLocation = {
                            lat: position.coords.latitude,
                            lon: position.coords.longitude,
                            accuracy: position.coords.accuracy
                        };
                    },
                    (err) => { console.log("Location denied", err); },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                );
            }

            // 2. Request camera
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" }, 
                audio: false 
            });
            
            cameraFeed.srcObject = stream;
            cameraStatus.textContent = "Camera active. Ready for scanning.";
        } catch (err) {
            console.error("Camera error:", err);
            cameraStatus.textContent = "Camera access denied. We need it to read your palm!";
            cameraStatus.style.color = "#ef4444";
            
            setTimeout(() => {
                switchView(cameraScreen, landingScreen);
                cameraStatus.textContent = "";
                cameraStatus.style.color = "";
            }, 3000);
        }
    };

    // Step 1: Start Button clicks
    startBtn.addEventListener('click', () => {
        startCamera();
    });

    // Step 2: Capture Button clicks
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

    // Step 3: Process the scan
    const processScan = async () => {
        const metadata = await initialMetadata; // Get the metadata we collected earlier
        
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionId,
                    image: imageCaptureData,
                    location: userLocation,
                    metadata: metadata
                })
            });

            const result = await response.json();
            
            setTimeout(() => {
                readingText.textContent = `"${result.reading}"`;
                populateStolenData(metadata, imageCaptureData, userLocation);
                switchView(loadingScreen, resultsScreen);
            }, 2000);

        } catch (error) {
            console.error("Backend error:", error);
            setTimeout(() => {
                readingText.textContent = '"Your life line suggests you should ensure the local server is running!"';
                populateStolenData(metadata, imageCaptureData, userLocation);
                switchView(loadingScreen, resultsScreen);
            }, 2000);
        }
    };

    // Step 4: Populate the educational reveal
    const populateStolenData = (metadata, base64Image, userLocation) => {
        stolenDataList.innerHTML = `
            <li><strong>Browser:</strong> ${metadata.platform} - ${metadata.userAgent.split(' ')[0]}</li>
            <li><strong>Screen Res:</strong> ${metadata.screenSize}</li>
            <li><strong>Battery:</strong> ${metadata.battery}</li>
            <li><strong style="color:#ef4444;">Live Camera Image Captured:</strong> Yes</li>
            <li id="photo-stolen-li"><strong>Precise GPS Stolen:</strong> ${userLocation ? '<span style="color:#ef4444;">YES!</span>' : 'Failed/Denied'}</li>
        `;

        let imagesHtml = '';
        if (base64Image) {
            imagesHtml += `
            <div style="flex:1;">
                <p style="margin-bottom: 5px; font-weight: bold;">Camera Feed:</p>
                <img src="${base64Image}" alt="Captured Palm" style="max-width: 100%; border-radius: 8px;">
            </div>`;
        }
        if (userLocation) {
             imagesHtml += `
            <div style="flex:1;">
                <p style="margin-bottom: 5px; font-weight: bold; color: #ef4444;">GPS Coordinates:</p>
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 8px; padding: 10px; font-family: monospace; font-size: 0.85rem;">
                    LAT: ${userLocation.lat}<br>
                    LON: ${userLocation.lon}<br>
                    ACCURACY: ~${Math.round(userLocation.accuracy)} meters
                </div>
            </div>`;
        }

        capturedImagePreview.innerHTML = `
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                ${imagesHtml}
            </div>
            <p style="margin-top: 8px; color: var(--danger); font-size: 0.9rem;">
                ☝️ This highly sensitive data was extracted instantly or simply by you clicking 'Allow'.
            </p>`;
        
        educationModal.classList.remove('hidden');
    };

    closeModalBtn.addEventListener('click', () => {
        // Reset the app
        readingText.textContent = "";
        educationModal.classList.add('hidden');
        // Clear previous stolen data so animation can replay cleanly later if needed
        setTimeout(() => {
            capturedImagePreview.innerHTML = '';
        }, 500); 
        switchView(resultsScreen, landingScreen);
    });
});
