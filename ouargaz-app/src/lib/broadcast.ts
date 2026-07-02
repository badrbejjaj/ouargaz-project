export async function triggerBroadcast(type: string, data?: any, role?: string) {
  try {
    const url = process.env.WS_INTERNAL_URL || 'http://localhost:3001/broadcast';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, data, role }),
    });
    if (!resp.ok) {
      console.warn(`[Broadcast] WebSocket server returned status ${resp.status}`);
    }
  } catch (err: any) {
    console.warn(`[Broadcast] Failed to trigger websocket broadcast: ${err.message}`);
  }
}
