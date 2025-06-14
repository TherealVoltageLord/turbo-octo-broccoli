// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const vCardsJS = require('vcards-js');
const rateLimit = require('express-rate-limit');
const basicAuth = require('express-basic-auth');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'voltageid123';

// Session data structure
let session = {
    active: false,
    startTime: null,
    duration: null,
    maxContacts: null,
    contacts: [],
    vcfAvailable: false
};

// Load session from file if exists
if (fs.existsSync('session.json')) {
    const data = fs.readFileSync('session.json', 'utf8');
    session = JSON.parse(data);
}

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP, please try again later'
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use('/api', apiLimiter);

// Basic Auth for admin routes
const auth = basicAuth({
    users: { admin: ADMIN_PASSWORD },
    challenge: true,
    realm: 'VOLTAGEID Admin'
});

// Save session to file
function saveSession() {
    fs.writeFileSync('session.json', JSON.stringify(session));
}

// Generate VCF file
function generateVcf() {
    const vcfFileName = path.join(__dirname, 'public', 'voltageid-contacts.vcf');
    
    // Delete existing file if it exists
    if (fs.existsSync(vcfFileName)) {
        fs.unlinkSync(vcfFileName);
    }
    
    // Create a new vCard for each contact
    session.contacts.forEach(contact => {
        const vCard = vCardsJS();
        vCard.firstName = contact.name.split(' ')[0] || '';
        vCard.lastName = contact.name.split(' ').slice(1).join(' ') || '';
        vCard.cellPhone = contact.whatsapp;
        vCard.email = contact.email || '';
        vCard.organization = 'VOLTAGEID';
        
        fs.appendFileSync(vcfFileName, vCard.getFormattedString());
    });
    
    session.vcfAvailable = true;
    saveSession();
}

// API Routes

// Check session status
app.get('/api/session-status', (req, res) => {
    let remainingTime = 0;
    
    if (session.active) {
        const elapsed = Date.now() - session.startTime;
        remainingTime = Math.max(0, session.duration - elapsed);
        
        // Check if session should end
        if (remainingTime <= 0 || 
            (session.maxContacts && session.contacts.length >= session.maxContacts)) {
            session.active = false;
            generateVcf();
            saveSession();
            remainingTime = 0;
        }
    }
    
    res.json({
        active: session.active,
        remainingTime,
        contactCount: session.contacts.length,
        vcfAvailable: session.vcfAvailable
    });
});

// Submit contact
app.post('/api/submit-contact', (req, res) => {
    if (!session.active) {
        return res.status(400).json({ error: 'No active session' });
    }
    
    const { name, whatsapp, email } = req.body;
    
    if (!name || !whatsapp) {
        return res.status(400).json({ error: 'Name and WhatsApp are required' });
    }
    
    session.contacts.push({ name, whatsapp, email });
    saveSession();
    
    res.json({ success: true });
});

// Download VCF
app.get('/api/download-vcf', (req, res) => {
    if (session.active) {
        return res.status(400).send('VCF download is only available after session ends');
    }
    
    if (!session.vcfAvailable) {
        return res.status(404).send('No VCF file available');
    }
    
    const filePath = path.join(__dirname, 'public', 'voltageid-contacts.vcf');
    res.download(filePath);
});

// Admin login
app.post('/api/admin-login', (req, res) => {
    const { password } = req.body;
    
    if (password === ADMIN_PASSWORD) {
        res.cookie('authenticated', 'true', { httpOnly: true });
        return res.json({ success: true });
    }
    
    res.status(401).json({ error: 'Invalid password' });
});

// Admin logout
app.post('/api/admin-logout', auth, (req, res) => {
    res.clearCookie('authenticated');
    res.json({ success: true });
});

// Start session (admin only)
app.post('/api/start-session', auth, (req, res) => {
    if (session.active) {
        return res.status(400).json({ error: 'Session already active' });
    }
    
    const { duration, maxContacts } = req.body;
    
    if (!duration || duration <= 0) {
        return res.status(400).json({ error: 'Invalid duration' });
    }
    
    // Reset previous data
    session.active = true;
    session.startTime = Date.now();
    session.duration = duration;
    session.maxContacts = maxContacts || null;
    session.contacts = [];
    session.vcfAvailable = false;
    
    saveSession();
    
    res.json({ success: true });
});

// Stop session (admin only)
app.post('/api/stop-session', auth, (req, res) => {
    if (!session.active) {
        return res.status(400).json({ error: 'No active session' });
    }
    
    session.active = false;
    generateVcf();
    saveSession();
    
    res.json({ success: true });
});

// Export JSON (admin only)
app.get('/api/export-json', auth, (req, res) => {
    const data = JSON.stringify(session.contacts, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=voltageid-contacts.json');
    res.send(data);
});

// Frontend Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(Server running on port ${PORT});
});
