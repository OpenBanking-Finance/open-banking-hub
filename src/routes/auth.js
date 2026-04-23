export default async function authRoutes(app) {
  // CAUSA B: Ensuring session is persisted before redirecting to Keycloak
  app.get('/login', async (request, reply) => {
    try {
      // Geração Manual da URL (À prova de falhas de versão de plugin)
      const state = Math.random().toString(36).substring(7);
      const clientId = process.env.KC_CLIENT_ID || 'hub-client';
      const realm = process.env.KC_REALM || 'openbanking';
      const redirectUri = encodeURIComponent('http://127.0.0.1:3000/login/callback');
      const scope = encodeURIComponent('openid profile email');
      
      const keycloakUrl = `http://127.0.0.1:8080/realms/${realm}/protocol/openid-connect/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
      
      console.log('>>> [HUB] Redirecionando MANUALMENTE para Keycloak:', keycloakUrl);
      
      request.session.oauth_state = state
      await request.session.save()
      
      return reply.redirect(keycloakUrl)
    } catch (err) {
      console.error('>>> [HUB ERROR] Falha no login manual:', err.message);
      return reply.status(500).send({ error: 'Auth generation failed' });
    }
  })

  // Callback route with robust state validation and detailed error logging
  app.get('/login/callback', async function (request, reply) {
    const { code, state } = request.query
    const savedState = request.session.oauth_state

    // 1. Log received data for debugging
    request.log.info({ query: request.query, session: request.session }, 'Received callback from Keycloak')

    // 2. Validate state to prevent CSRF attacks
    if (!state || state !== savedState) {
      request.log.error({ received: state, expected: savedState }, 'Invalid OAuth state')
      return reply.status(403).send({ 
         error: 'Invalid state', 
         redirect_uri_sent: `http://localhost:${process.env.PORT || 3000}/login/callback` 
      })
    }

    // 3. Clear state immediately after validation as requested
    request.session.oauth_state = null
    await request.session.save()

    try {
      request.log.info({ code }, 'Exchanging code for token via back-channel')
      
      const { token } = await app.keycloak.getAccessTokenFromAuthorizationCodeFlow(request)
      request.log.info('Token exchange successful')
      
      request.session.token = token.access_token
      await request.session.save()

      // REDIRECIONAR DE VOLTA PARA O PORTAL (FINTECH APP)
      // Ajuste para o endereço onde você roda o seu portal
      return reply.redirect('http://localhost:5000/') 
    } catch (err) {
      request.log.error(err, 'Authentication failed during token exchange')
      return reply.status(500).send({ error: 'Authentication failed' })
    }
  })

  // Protected route to show user info
  app.get('/me', async (request, reply) => {
    const token = request.session.token
    
    if (!token) {
      return reply.status(401).send({ authenticated: false, error: 'Unauthorized' })
    }

    // Em um fluxo real, decodificaríamos o JWT do token para pegar o nome
    return { 
      authenticated: true,
      user: {
        name: 'João Silva', // Mockado para simplificar, mas vindo da sessão
        email: 'joao@fintech.com'
      }
    }
  })

  // Logout route: clears local session and redirects to Keycloak logout
  app.get('/logout', async (request, reply) => {
    request.session.destroy()
    
    const logoutUrl = `${process.env.KEYCLOAK_EXTERNAL_URL}/realms/${process.env.KC_REALM}/protocol/openid-connect/logout?client_id=${process.env.KC_CLIENT_ID}&post_logout_redirect_uri=http://localhost:${process.env.PORT || 3000}/health`
    
    return reply.redirect(logoutUrl)
  })
}
