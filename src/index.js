import Fastify from 'fastify'
import dotenv from 'dotenv'
import oauth2 from '@fastify/oauth2'
import cookie from '@fastify/cookie'
import session from '@fastify/session'
import path from 'path'
import cors from '@fastify/cors'
import { fileURLToPath } from 'url'

// Import routes
import authRoutes from './routes/auth.js'
import consentRoutes from './routes/consents.js'
import bankingRoutes from './routes/banking.js'
import adminRoutes from './routes/admin.js'

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from the local directory (one level up from src/)
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const app = Fastify({ 
  logger: true,
  trustProxy: true 
})

// Register core plugins
app.register(cookie)
app.register(cors, { 
  origin: true, // In production, replace with specific domain
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
})
app.register(session, {
  secret: process.env.SESSION_SECRET || 'a-very-secret-key-at-least-32-chars-long',
  cookie: {
    secure: false, // Localhost dev
    sameSite: 'lax', // Easier for dev across local ports
    httpOnly: true 
  },
  saveUninitialized: false
})

// Register OAuth2 plugin with Split URL configuration
app.register(oauth2, {
  name: 'keycloak',
  scope: ['openid', 'profile', 'email'],
  credentials: {
    client: {
      id: process.env.KC_CLIENT_ID || 'hub-client',
      secret: process.env.KC_CLIENT_SECRET || 'hub-secret-123'
    },
    auth: {
      authorizeHost: 'http://127.0.0.1:8080',
      authorizePath: `/realms/${process.env.KC_REALM || 'openbanking'}/protocol/openid-connect/auth`,
      tokenHost: 'http://127.0.0.1:8080',
      tokenPath: `/realms/${process.env.KC_REALM || 'openbanking'}/protocol/openid-connect/token`
    }
  },
  callbackUri: 'http://127.0.0.1:3000/login/callback'
})

// Register Routes
app.register(authRoutes);
app.register(consentRoutes);
app.register(bankingRoutes);
app.register(adminRoutes);

// Health check endpoint
app.get('/health', async () => ({
  status: 'ok',
  service: 'openbanking-hub',
  phase: 2,
  timestamp: new Date().toISOString()
}))

const start = async () => {
  try {
    await app.listen({
      port: process.env.PORT || 3000,
      host: '0.0.0.0'
    })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
