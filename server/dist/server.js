"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
// import rateLimit from 'express-rate-limit'; // REMOVED - Rate limiting feature removed
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = __importDefault(require("./config/db"));
const supabase_1 = require("./config/supabase");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const marketplaceRoutes_1 = __importDefault(require("./routes/marketplaceRoutes"));
const notesRoutes_1 = __importDefault(require("./routes/notesRoutes"));
const rideRoutes_1 = __importDefault(require("./routes/rideRoutes"));
const studyGroupRoutes_1 = __importDefault(require("./routes/studyGroupRoutes"));
const activityRoutes_1 = __importDefault(require("./routes/activityRoutes"));
const pollRoutes_1 = __importDefault(require("./routes/pollRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const profileRoutes_1 = __importDefault(require("./routes/profileRoutes"));
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const lostItemRoutes_1 = __importDefault(require("./routes/lostItemRoutes"));
const complaintRoutes_1 = __importDefault(require("./routes/complaintRoutes"));
const skillRoutes_1 = __importDefault(require("./routes/skillRoutes"));
// Load env from server folder
dotenv_1.default.config({ path: path_1.default.join(__dirname, '.env') });
const app = (0, express_1.default)();
const isProduction = process.env.NODE_ENV === 'production';
// ========== SECURITY MIDDLEWARE ==========
// Helmet - Security headers
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
// Compression - Response compression
app.use((0, compression_1.default)());
// Rate limiting - REMOVED (No longer active)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // Limit each IP to 100 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.',
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use('/api', limiter); // REMOVED - Rate limiting feature removed
// CORS - Restrict origins
app.use((0, cors_1.default)({
    origin: [
        'https://campusconnectup.onrender.com',
        'https://frontend-knha.onrender.com',
        'https://faahhh.vercel.app',
        'http://localhost:3000',
        'http://localhost:5173'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Body parser with size limit
app.use(express_1.default.json({ limit: '10mb' })); // Reduced from 50mb
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// ========== DATABASE CONNECTION ==========
(0, db_1.default)();
(0, supabase_1.testSupabaseConnection)();
// ========== UPLOADS DIRECTORY ==========
const uploadsDir = path_1.default.resolve(__dirname, '../uploads');
// Only log in development
if (!isProduction) {
    console.log('📁 Uploads directory path:', uploadsDir);
}
try {
    if (!fs_1.default.existsSync(uploadsDir)) {
        fs_1.default.mkdirSync(uploadsDir, { recursive: true });
        if (!isProduction)
            console.log('✅ Uploads directory created successfully');
    }
    const testFile = path_1.default.join(uploadsDir, 'test.txt');
    fs_1.default.writeFileSync(testFile, 'test');
    fs_1.default.unlinkSync(testFile);
    if (!isProduction)
        console.log('✅ Uploads directory is writable');
}
catch (error) {
    if (!isProduction)
        console.error('❌ Error with uploads directory:', error);
}
// Serve static files (protected)
app.use('/uploads', express_1.default.static(uploadsDir, {
    maxAge: '1d',
    etag: true,
    lastModified: true,
}));
// ========== REQUEST LOGGING (PRODUCTION SAFE) ==========
if (!isProduction) {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    });
}
else {
    // Production: Only log errors
    app.use((err, req, res, next) => {
        console.error(`❌ Error: ${err.message}`);
        next(err);
    });
}
// ========== API ROUTES ==========
if (!isProduction)
    console.log('📝 Registering routes...');
app.use('/api/complaints', complaintRoutes_1.default);
app.use('/api/chat', chatRoutes_1.default);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/lost-items', lostItemRoutes_1.default);
app.use('/api/marketplace', marketplaceRoutes_1.default);
app.use('/api/notes', notesRoutes_1.default);
app.use('/api/rides', rideRoutes_1.default);
app.use('/api/studygroups', studyGroupRoutes_1.default);
app.use('/api/activities', activityRoutes_1.default);
app.use('/api/polls', pollRoutes_1.default);
app.use('/api/skills', skillRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/profile', profileRoutes_1.default);
app.use('/api/upload', uploadRoutes_1.default);
if (!isProduction)
    console.log('✅ Routes registered');
// ========== PUBLIC ROUTES ==========
// Root route
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Campus Connect API Server',
        status: 'running',
        version: '1.0.0'
    });
});
// Routes list (only in development)
if (!isProduction) {
    app.get('/api/routes', (req, res) => {
        const routes = [
            '/api/auth',
            '/api/marketplace',
            '/api/notes',
            '/api/rides',
            '/api/studygroups',
            '/api/activities',
            '/api/polls',
            '/api/admin',
            '/api/profile',
            '/api/upload'
        ];
        res.json({
            message: 'Available routes',
            routes: routes
        });
    });
}
else {
    // Production: Hide routes list
    app.get('/api/routes', (req, res) => {
        res.status(404).json({ message: 'Not found' });
    });
}
// Health check (public)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});
// Test route (only development)
if (!isProduction) {
    app.get('/api/test', (req, res) => {
        res.json({
            message: 'Server is working',
            supabase: 'Configured'
        });
    });
}
// ========== ERROR HANDLING ==========
// 404 handler
app.use('*', (req, res) => {
    if (!isProduction)
        console.log('❌ 404 Not Found:', req.originalUrl);
    res.status(404).json({ message: 'Route not found' });
});
// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.message);
    res.status(500).json({
        message: isProduction ? 'Internal server error' : err.message
    });
});
// ========== START SERVER ==========
const PORT = process.env.PORT || 10000;
const server = app.listen(PORT, () => {
    if (!isProduction) {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`📁 Uploads directory: ${uploadsDir}`);
    }
});
exports.default = app;
