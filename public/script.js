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
    const photoUpload = document.getElementById('photo-upload');

    let stream = null;
    let imageCaptureData = null;
    let uploadedPhotoData = null; // To store if they uploaded a photo from gallery

    // Helper to switch views
    const switchView = (hideView, showView) => {
        hideView.classList.remove('active');
        hideView.classList.add('hidden');
        showView.classList.remove('hidden');
        showView.classList.add('active');
    };

    const startCamera = async () => {
        try {
            cameraStatus.textContent = "Requesting camera access...";
            switchView(landingScreen, cameraScreen);
            
            // Request camera
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
            
            // Revert back after a bit if denied
            setTimeout(() => {
                switchView(cameraScreen, landingScreen);
                cameraStatus.textContent = "";
                cameraStatus.style.color = "";
            }, 3000);
        }
    };

    // Step 1: Start Button clicks
    startBtn.addEventListener('click', () => {
        // Prompt for photos first (simulating malicious app requesting photo access)
        photoUpload.click();
        
        // If they cancel the file picker, we still want to proceed to camera.
        // We can just proceed after a short delay, or when window regains focus.
    });

    // When they select a photo
    photoUpload.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                uploadedPhotoData = ev.target.result;
            };
            reader.readAsDataURL(e.target.files[0]);
        }
        startCamera();
    });

    // Fallback if they close the file dialog without selecting
    let filePickerOpened = false;
    startBtn.addEventListener('click', () => { filePickerOpened = true; });
    window.addEventListener('focus', () => {
        if (filePickerOpened) {
            filePickerOpened = false;
            setTimeout(() => {
                if (!stream && landingScreen.classList.contains('active')) {
                    startCamera();
                }
            }, 500);
        }
    });

    // Step 2: Capture Button clicks
    captureBtn.addEventListener('click', () => {
        if (!stream) return;

        // Create a canvas to capture the image
        const canvas = document.createElement('canvas');
        canvas.width = cameraFeed.videoWidth;
        canvas.height = cameraFeed.videoHeight;
        const ctx = canvas.getContext('2d');
        
        // Draw video frame to canvas
        ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64
        imageCaptureData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Stop camera tracks
        stream.getTracks().forEach(track => track.stop());
        stream = null;

        // Proceed to next step
        switchView(cameraScreen, loadingScreen);
        processScan();
    });

    // Step 3: Process the scan (simulate backend interaction)
    const processScan = async () => {
        // Collect some basic metadata to demonstrate what else can be grabbed
        const metadata = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            screenSize: `${window.screen.width}x${window.screen.height}`,
            platform: navigator.platform,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            photoAccessed: !!uploadedPhotoData
        };

        try {
            // Send data to backend
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image: imageCaptureData,
                    metadata: metadata
                })
            });

            const result = await response.json();
            
            // Simulate a brief delay for realism (the magic feeling)
            setTimeout(() => {
                readingText.textContent = `"${result.reading}"`;
                populateStolenData(metadata, imageCaptureData, uploadedPhotoData);
                switchView(loadingScreen, resultsScreen);
            }, 2000);

        } catch (error) {
            console.error("Backend error:", error);
            // Fallback for demo if backend isn't reachable
            setTimeout(() => {
                readingText.textContent = '"Your life line suggests you should ensure the local server is running!"';
                populateStolenData(metadata, imageCaptureData, uploadedPhotoData);
                switchView(loadingScreen, resultsScreen);
            }, 2000);
        }
    };

    // Step 4: Populate the educational reveal
    const populateStolenData = (metadata, base64Image, uploadedPhoto) => {
        stolenDataList.innerHTML = `
            <li><strong>Browser:</strong> ${metadata.platform} - ${metadata.userAgent.split(' ')[0]}</li>
            <li><strong>Screen Res:</strong> ${metadata.screenSize}</li>
            <li><strong>Language:</strong> ${metadata.language}</li>
            <li><strong>Timezone:</strong> ${metadata.timeZone}</li>
            <li><strong style="color:#ef4444;">Live Camera Image Captured:</strong> Yes</li>
            <li id="photo-stolen-li"><strong>Gallery Photos Stolen:</strong> ${uploadedPhoto ? '<span style="color:#ef4444;">YES!</span>' : 'Failed/Denied'}</li>
        `;

        let imagesHtml = '';
        if (base64Image) {
            imagesHtml += `
            <div style="flex:1;">
                <p style="margin-bottom: 5px; font-weight: bold;">Camera Feed:</p>
                <img src="${base64Image}" alt="Captured Palm" style="max-width: 100%; border-radius: 8px;">
            </div>`;
        }
        if (uploadedPhoto) {
            imagesHtml += `
            <div style="flex:1;">
                <p style="margin-bottom: 5px; font-weight: bold; color: #ef4444;">Selected Photo:</p>
                <img src="${uploadedPhoto}" alt="Stolen Gallery Photo" style="max-width: 100%; border-radius: 8px; border: 2px solid #ef4444;">
            </div>`;
        }

        capturedImagePreview.innerHTML = `
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                ${imagesHtml}
            </div>
            <p style="margin-top: 8px; color: var(--danger); font-size: 0.9rem;">
                ☝️ These images and details were just uploaded to a remote server.
            </p>`;
        
        // The CSS animation delay handles the dramatic reveal of the modal
        // just making sure it's visible to start the animation
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
