"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_slow_down_1 = __importDefault(require("express-slow-down"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const mongoose_1 = __importDefault(require("mongoose"));
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
// ========== CONNECTION TRACKING ==========
const activeConnections = new Set();
const MAX_CONNECTIONS = 500;
// ========== IP BLACKLIST ==========
const blacklistedIPs = new Set();
const requestTracker = new Map();
// Cleanup old request data every hour
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of requestTracker.entries()) {
        if (now - data.lastRequest > 3600000) {
            requestTracker.delete(ip);
        }
    }
}, 3600000);
// ========== SECURITY MIDDLEWARE ==========
// 1. Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);
// 2. IP Blacklist Middleware
const ipBlacklistMiddleware = (req, res, next) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (blacklistedIPs.has(clientIp)) {
        console.log(`🚫 Blocked blacklisted IP: ${clientIp}`);
        return res.status(403).json({
            message: 'Access denied. Contact support if this is an error.'
        });
    }
    next();
};
// 3. Connection Limiting (Prevents server overload)
const connectionLimiter = (req, res, next) => {
    if (activeConnections.size >= MAX_CONNECTIONS) {
        console.log(`⚠️ Max connections reached: ${activeConnections.size}`);
        return res.status(503).json({
            message: 'Server busy, please try again later.'
        });
    }
    const connectionId = (0, uuid_1.v4)();
    activeConnections.add(connectionId);
    res.on('finish', () => {
        activeConnections.delete(connectionId);
    });
    next();
};
// 4. Request Timeout (30 seconds)
const timeoutMiddleware = (req, res, next) => {
    req.setTimeout(30000, () => {
        if (!res.headersSent) {
            res.status(408).json({ message: 'Request timeout' });
        }
    });
    next();
};
// 5. Rate Limiting (Stops DDoS and brute force)
const generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return (req.ip || req.socket.remoteAddress || 'unknown') + (req.headers['user-agent'] || 'unknown');
    },
    skip: (req) => {
        const trustedIPs = ['127.0.0.1', '::1'];
        const clientIp = req.ip || req.socket.remoteAddress || '';
        return trustedIPs.includes(clientIp);
    },
    handler: (req, res) => {
        const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
        console.log(`⚠️ Rate limit exceeded for IP: ${clientIp}`);
        res.status(429).json({
            message: 'Too many requests. Please slow down.',
            retryAfter: Math.ceil(15 * 60)
        });
    }
});
// 6. Slow Down (Gradual rate limiting)
const speedLimiter = (0, express_slow_down_1.default)({
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    delayMs: (hits) => hits * 100,
    maxDelayMs: 10000
});
// 7. Strict rate limiter for auth routes
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
});
// 8. Strict rate limiter for upload routes
const uploadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 50,
    message: 'Upload limit reached. Please try again later.',
});
// Apply security middleware in order
app.use(connectionLimiter);
app.use(ipBlacklistMiddleware);
app.use(timeoutMiddleware);
// 9. Helmet - Enhanced security headers
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", process.env.FRONTEND_URL || "'self'"],
            frameAncestors: ["'none'"],
            formAction: ["'self'"]
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    frameguard: {
        action: 'deny'
    },
    noSniff: true,
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    }
}));
// 10. Compression with optimal settings
app.use((0, compression_1.default)({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression_1.default.filter(req, res);
    }
}));
// 11. CORS - Enhanced configuration
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        const allowedOrigins = [
            'https://campusconnectup.onrender.com',
            'https://frontend-knha.onrender.com',
            'https://faahhh.vercel.app',
            'http://localhost:3000',
            'http://localhost:5173'
        ];
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || !isProduction) {
            callback(null, true);
        }
        else {
            console.log(`🚫 Blocked CORS request from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 86400
}));
// 12. Body parser with stricter limits
app.use(express_1.default.json({
    limit: '5mb',
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf.toString());
        }
        catch (e) {
            throw new Error('Invalid JSON');
        }
    }
}));
app.use(express_1.default.urlencoded({ extended: true, limit: '5mb', parameterLimit: 1000 }));
// 13. Request ID for tracking
app.use((req, res, next) => {
    req.requestId = (0, uuid_1.v4)();
    res.setHeader('X-Request-ID', req.requestId);
    next();
});
// 14. Request logging with performance tracking
app.use((req, res, next) => {
    const start = Date.now();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    // Track requests per IP
    const now = Date.now();
    if (requestTracker.has(clientIp)) {
        const data = requestTracker.get(clientIp);
        data.requestCount++;
        data.lastRequest = now;
    }
    else {
        requestTracker.set(clientIp, {
            requestCount: 1,
            firstRequest: now,
            lastRequest: now
        });
    }
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (!isProduction || res.statusCode >= 400) {
            console.log(`${res.statusCode >= 400 ? '⚠️' : '✅'} ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms - ${clientIp}`);
        }
        // Auto-blacklist suspicious IPs
        const ipData = requestTracker.get(clientIp);
        if (ipData && ipData.requestCount > 200 && (now - ipData.firstRequest) < 60000) {
            console.log(`🚨 Suspicious activity detected from IP: ${clientIp}`);
            if (ipData.requestCount > 500) {
                blacklistedIPs.add(clientIp);
                console.log(`🔴 Auto-blacklisted IP: ${clientIp}`);
            }
        }
    });
    next();
});
// ========== DATABASE CONNECTION WITH RETRY LOGIC ==========
const connectWithRetry = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
        try {
            await (0, db_1.default)();
            console.log('✅ Database connected successfully');
            return;
        }
        catch (err) {
            console.log(`Connection attempt ${i + 1} failed. Retrying in 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    console.error('❌ Failed to connect to database after all retries');
    process.exit(1);
};
connectWithRetry();
(0, supabase_1.testSupabaseConnection)();
// ========== UPLOADS DIRECTORY WITH SECURITY ==========
const uploadsDir = path_1.default.resolve(__dirname, '../uploads');
try {
    if (!fs_1.default.existsSync(uploadsDir)) {
        fs_1.default.mkdirSync(uploadsDir, { recursive: true, mode: 0o750 });
    }
    // Set secure permissions
    fs_1.default.chmodSync(uploadsDir, 0o750);
    // Clean up old files every 24 hours
    setInterval(() => {
        const now = Date.now();
        fs_1.default.readdir(uploadsDir, (err, files) => {
            if (err)
                return;
            files.forEach(file => {
                const filePath = path_1.default.join(uploadsDir, file);
                fs_1.default.stat(filePath, (err, stats) => {
                    if (err)
                        return;
                    // Delete files older than 7 days
                    if (now - stats.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
                        fs_1.default.unlink(filePath, err => {
                            if (err)
                                console.error(`Error deleting old file: ${file}`);
                        });
                    }
                });
            });
        });
    }, 24 * 60 * 60 * 1000);
}
catch (error) {
    console.error('❌ Error with uploads directory:', error);
}
// Serve static files with security headers
app.use('/uploads', express_1.default.static(uploadsDir, {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Cache-Control', 'public, max-age=86400');
    }
}));
// ========== API ROUTES WITH ROUTE-SPECIFIC LIMITS ==========
console.log('📝 Registering routes...');
// Apply rate limiting to all API routes
app.use('/api', generalLimiter);
app.use('/api', speedLimiter);
// Auth routes with stricter limits
app.use('/api/auth', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
// Upload routes with specific limits
app.use('/api/upload', uploadLimiter);
// Register all routes
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
console.log('✅ Routes registered');
// ========== PUBLIC ROUTES ==========
// Root route
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Campus Connect API Server',
        status: 'running',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});
// Health check with detailed status
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        activeConnections: activeConnections.size,
        requestId: req.requestId,
        environment: isProduction ? 'production' : 'development'
    });
});
// Metrics endpoint (protected with admin key)
app.get('/api/metrics', (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    res.json({
        activeConnections: activeConnections.size,
        blacklistedIPs: Array.from(blacklistedIPs),
        requestStats: {
            totalTrackedIPs: requestTracker.size,
            topIPs: Array.from(requestTracker.entries())
                .sort((a, b) => b[1].requestCount - a[1].requestCount)
                .slice(0, 10)
                .map(([ip, data]) => ({
                ip,
                requests: data.requestCount
            }))
        },
        memory: process.memoryUsage(),
        uptime: process.uptime()
    });
});
// Routes list (hidden in production)
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
            '/api/upload',
            '/api/chat',
            '/api/complaints',
            '/api/lost-items',
            '/api/skills'
        ];
        res.json({
            message: 'Available routes',
            routes: routes
        });
    });
}
else {
    app.get('/api/routes', (req, res) => {
        res.status(404).json({ message: 'Not found' });
    });
}
// Test route (only development)
if (!isProduction) {
    app.get('/api/test', (req, res) => {
        res.json({
            message: 'Server is working',
            supabase: 'Configured',
            timestamp: new Date().toISOString()
        });
    });
}
// ========== ERROR HANDLING ==========
// 404 handler
app.use('*', (req, res) => {
    if (!isProduction) {
        console.log('❌ 404 Not Found:', req.originalUrl);
    }
    res.status(404).json({ message: 'Route not found' });
});
// Global error handler
app.use((err, req, res, next) => {
    const errorId = (0, uuid_1.v4)();
    console.error(`❌ Error ${errorId}:`, {
        message: err.message,
        stack: isProduction ? undefined : err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip || req.socket.remoteAddress,
        requestId: req.requestId
    });
    const errorResponse = {
        message: isProduction ? 'Internal server error' : err.message,
        errorId: errorId
    };
    if (!isProduction) {
        errorResponse.stack = err.stack;
    }
    res.status(err.status || 500).json(errorResponse);
});
// ========== GRACEFUL SHUTDOWN ==========
const gracefulShutdown = async () => {
    console.log('🛑 Received shutdown signal, closing gracefully...');
    server.close(async () => {
        console.log('✅ HTTP server closed');
        try {
            await mongoose_1.default.connection.close();
            console.log('✅ Database connections closed');
        }
        catch (err) {
            console.error('Error closing database:', err);
        }
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    });
    // Force close after 30 seconds
    setTimeout(() => {
        console.error('⚠️ Force closing connections');
        process.exit(1);
    }, 30000);
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown();
});
// ========== MEMORY MONITORING ==========
setInterval(() => {
    const used = process.memoryUsage();
    const heapUsedMB = (used.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (used.heapTotal / 1024 / 1024).toFixed(2);
    const rssMB = (used.rss / 1024 / 1024).toFixed(2);
    if (!isProduction) {
        console.log(`📊 Memory: ${heapUsedMB}MB / ${heapTotalMB}MB (RSS: ${rssMB}MB)`);
    }
    // Alert if memory usage is high
    if (used.heapUsed / used.heapTotal > 0.8) {
        console.error(`⚠️ HIGH MEMORY USAGE ALERT: ${heapUsedMB}MB / ${heapTotalMB}MB`);
    }
}, 60000);
// ========== START SERVER ==========
const PORT = process.env.PORT || 10000;
const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📁 Uploads directory: ${uploadsDir}`);
    console.log(`🔒 Security features: Rate limiting, IP blacklisting, Connection limiting`);
    console.log(`🌍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`📊 Max connections: ${MAX_CONNECTIONS}`);
});
exports.default = app;
