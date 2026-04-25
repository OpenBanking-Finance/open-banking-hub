import axios from 'axios'
import db from '../db/knex.js'
import consentService from '../services/consentService.js'

export default async function bankingRoutes(app) {

  // Middleware-like function to resolve bank API URL from Directory
  const getBankApiUrl = async (consent) => {
    const bank = await db('banks').where({ id: consent.bank_id }).first()
    return bank?.api_url || 'http://127.0.0.1:3001'
  }

  // GET /accounts
  app.get('/accounts', async (request, reply) => {
    const { consentId } = request.query
    
    if (!consentId) return reply.status(400).send({ error: 'consentId is required' })

    try {
      const consent = await consentService.getConsentById(consentId)
      console.log(`HUB: Fetching accounts for consent ${consentId}. Status in DB: ${consent?.status}`);
      
      if (!consent || !consent.access_token) {
        console.error(`HUB: Access denied for ${consentId}. Token missing: ${!consent?.access_token}`);
        return reply.status(403).send({ error: 'Unauthorised', message: 'No valid access token found' })
      }

      const bankUrl = await getBankApiUrl(consent)
      console.log(`HUB: Calling bank API at: ${bankUrl}/accounts`);

      const response = await axios.get(`${bankUrl}/accounts`, {
        headers: { 
          'Authorization': `Bearer ${consent.access_token}`,
          'X-Consent-ID': consentId 
        }
      })
      return response.data
    } catch (err) {
      return reply.status(err.response?.status || 502).send(err.response?.data || { error: 'Bank communication error' })
    }
  })

  // GET /accounts/:accountId/transactions
  app.get('/accounts/:accountId/transactions', async (request, reply) => {
    const { accountId } = request.params
    const { consentId } = request.query

    try {
      const consent = await consentService.getConsentById(consentId)
      if (!consent || !consent.access_token) return reply.status(403).send({ error: 'Unauthorised' })

      const bankUrl = await getBankApiUrl(consent)

      const response = await axios.get(`${bankUrl}/accounts/${accountId}/transactions`, {
        headers: { 'Authorization': `Bearer ${consent.access_token}` }
      })
      return response.data
    } catch (err) {
      return reply.status(502).send({ error: 'Bank communication error' })
    }
  })
}
