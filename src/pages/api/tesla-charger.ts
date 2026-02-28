import type { APIRoute } from 'astro';
import { getStore } from '@netlify/blobs';
import type { ChargerConfig, ChargerActionRequest, ChargingSession } from '../../types';

export const prerender = false;

const STORE_NAME = 'tesla-chargers';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export const GET: APIRoute = async (context) => {
    const { searchParams } = new URL(context.url);
    const chargerId = searchParams.get('id');
    const store = getStore(STORE_NAME);

    if (chargerId) {
        const charger = await store.get(chargerId, { type: 'json' });
        if (!charger) {
            return jsonResponse({ error: `Charger "${chargerId}" not found` }, 404);
        }
        return jsonResponse(charger);
    }

    try {
        const { blobs } = await store.list();
        const chargers = await Promise.all(blobs.map(({ key }) => store.get(key, { type: 'json' })));
        return jsonResponse({ chargers: chargers.filter(Boolean) });
    } catch (e) {
        console.error('Failed to list chargers:', e);
        return jsonResponse({ error: 'Failed to retrieve chargers' }, 500);
    }
};

export const POST: APIRoute = async ({ request }) => {
    let body: ChargerActionRequest;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { action, chargerId, config } = body;
    const store = getStore(STORE_NAME);

    if (action === 'register') {
        if (!config?.name || !config?.location) {
            return jsonResponse({ error: '"name" and "location" are required to register a charger' }, 400);
        }
        const id = `charger-${Date.now()}`;
        const newCharger: ChargerConfig = {
            id,
            name: config.name,
            location: config.location,
            maxPower: config.maxPower ?? 11.5,
            status: 'available',
            lastUpdated: new Date().toISOString(),
        };
        await store.setJSON(id, newCharger);
        return jsonResponse(newCharger, 201);
    }

    if (!chargerId) {
        return jsonResponse({ error: '"chargerId" is required for this action' }, 400);
    }

    const charger = (await store.get(chargerId, { type: 'json' })) as ChargerConfig | null;
    if (!charger) {
        return jsonResponse({ error: `Charger "${chargerId}" not found` }, 404);
    }

    if (action === 'start') {
        if (charger.status === 'charging') {
            return jsonResponse({ error: 'Charger is already in a charging session' }, 409);
        }
        const session: ChargingSession = {
            id: `session-${Date.now()}`,
            startTime: new Date().toISOString(),
            energyDelivered: 0,
            maxPower: charger.maxPower,
            vehicleId: config?.currentSession?.vehicleId,
        };
        const updated: ChargerConfig = {
            ...charger,
            status: 'charging',
            currentSession: session,
            lastUpdated: new Date().toISOString(),
        };
        await store.setJSON(chargerId, updated);
        return jsonResponse(updated);
    }

    if (action === 'stop') {
        if (charger.status !== 'charging') {
            return jsonResponse({ error: 'No active charging session to stop' }, 409);
        }
        const finishedSession: ChargingSession = {
            ...charger.currentSession!,
            endTime: new Date().toISOString(),
        };
        const updated: ChargerConfig = {
            ...charger,
            status: 'available',
            currentSession: finishedSession,
            lastUpdated: new Date().toISOString(),
        };
        await store.setJSON(chargerId, updated);
        return jsonResponse(updated);
    }

    if (action === 'update') {
        if (!config) {
            return jsonResponse({ error: '"config" fields are required for an update' }, 400);
        }
        const { id: _id, currentSession: _session, ...safeUpdates } = config as ChargerConfig;
        const updated: ChargerConfig = {
            ...charger,
            ...safeUpdates,
            id: charger.id,
            lastUpdated: new Date().toISOString(),
        };
        await store.setJSON(chargerId, updated);
        return jsonResponse(updated);
    }

    return jsonResponse({ error: `Unknown action "${action}"` }, 400);
};

export const DELETE: APIRoute = async (context) => {
    const { searchParams } = new URL(context.url);
    const chargerId = searchParams.get('id');

    if (!chargerId) {
        return jsonResponse({ error: '"id" query param is required' }, 400);
    }

    const store = getStore(STORE_NAME);
    const charger = await store.get(chargerId, { type: 'json' }) as ChargerConfig | null;
    if (!charger) {
        return jsonResponse({ error: `Charger "${chargerId}" not found` }, 404);
    }
    if ((charger as ChargerConfig).status === 'charging') {
        return jsonResponse({ error: 'Cannot delete a charger with an active session' }, 409);
    }

    await store.delete(chargerId);
    return jsonResponse({ message: `Charger "${chargerId}" deleted` });
};
