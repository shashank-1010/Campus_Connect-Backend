import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import connectDB from './config/db';
import { testSupabaseConnection } from './config/supabase';
import authRoutes from './routes/authRoutes';
import marketplaceRoutes from './routes/marketplaceRoutes';
import notesRoutes from './routes/notesRoutes';
import rideRoutes from './routes/rideRoutes';
import studyGroupRoutes from './routes/studyGroupRoutes';
import activityRoutes from './routes/activityRoutes';
import pollRoutes from './routes/pollRoutes';
import adminRoutes from './routes/adminRoutes';
import profileRoutes from './routes/profileRoutes';
import uploadRoutes from './routes/uploadRoutes';
import chatRoutes from './routes/chatRoutes';
import lostItemRoutes from './routes/lostItemRoutes';
import complaintRoutes from './routes/complaintRoutes';
import skillRoutes from './routes/skillRoutes';

// Load env from server folder
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// ========== SECURITY MIDDLEWARE ==========

// Helmet - Security headers
app.use(helmet({
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
app.use(compression());

// Rate limiting - Prevent DDoS
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// CORS - Restrict origins
app.use(cors({
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
app.use(express.json({ limit: '10mb' })); // Reduced from 50mb
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== DATABASE CONNECTION ==========
connectDB();
testSupabaseConnection();

// ========== UPLOADS DIRECTORY ==========
const uploadsDir = path.resolve(__dirname, '../uploads');

// Only log in development
if (!isProduction) {
  console.log('📁 Uploads directory path:', uploadsDir);
}

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    if (!isProduction) console.log('✅ Uploads directory created successfully');
  }
  
  const testFile = path.join(uploadsDir, 'test.txt');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  if (!isProduction) console.log('✅ Uploads directory is writable');
  
} catch (error) {
  if (!isProduction) console.error('❌ Error with uploads directory:', error);
}

// Serve static files (protected)
app.use('/uploads', express.static(uploadsDir, {
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
} else {
  // Production: Only log errors
app.use((err: any, req: any, res: any, next: any) => {
  console.error(`❌ Error: ${err.message}`);
  next(err);
});
}

// ========== API ROUTES ==========
if (!isProduction) console.log('📝 Registering routes...');

app.use('/api/complaints', complaintRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/lost-items', lostItemRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/studygroups', studyGroupRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/upload', uploadRoutes);

if (!isProduction) console.log('✅ Routes registered');

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
} else {
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
  if (!isProduction) console.log('❌ 404 Not Found:', req.originalUrl);
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
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

export default app;
