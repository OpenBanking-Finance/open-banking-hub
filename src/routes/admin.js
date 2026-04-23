import db from '../db/knex.js'

export default async function adminRoutes(app) {
  
  // List all banks with full details (Admin view)
  app.get('/admin/banks', async (request, reply) => {
    const banks = await db('banks').select('*').orderBy('name', 'asc');
    return banks;
  });

  // Register a new bank in the directory
  app.post('/admin/banks', async (request, reply) => {
    const { id, name, authorise_url, api_url, jwks_url } = request.body;

    if (!id || !name || !authorise_url || !api_url) {
        return reply.status(400).send({ error: 'Missing required bank profile fields' });
    }

    try {
        const [newBank] = await db('banks').insert({
            id,
            name,
            authorise_url,
            api_url,
            jwks_url,
            status: 'active'
        }).returning('*');

        return reply.status(201).send(newBank);
    } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: 'Failed to register bank in directory' });
    }
  });

  // Update bank profile or status
  app.patch('/admin/banks/:id', async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;

    try {
        const [updatedBank] = await db('banks')
            .where({ id })
            .update({ ...updates, updated_at: db.fn.now() })
            .returning('*');

        if (!updatedBank) return reply.status(404).send({ error: 'Bank not found' });
        return updatedBank;
    } catch (err) {
        return reply.status(500).send({ error: 'Update failed' });
    }
  });

  // Delete/Deactivate bank
  app.delete('/admin/banks/:id', async (request, reply) => {
    const { id } = request.params;
    try {
        const count = await db('banks').where({ id }).delete();
        if (count === 0) return reply.status(404).send({ error: 'Bank not found' });
        return { message: 'Bank removed successfully' };
    } catch (err) {
        return reply.status(500).send({ error: 'Delete failed' });
    }
  });
}
