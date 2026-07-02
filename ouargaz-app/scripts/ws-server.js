const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.WS_PORT || 3001;

const server = http.createServer((req, res) => {
  // Allow backend API routes to POST to /broadcast
  if (req.method === 'POST' && req.url === '/broadcast') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        broadcast(payload);
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' 
        });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else if (req.method === 'OPTIONS') {
    // CORS preflight
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('WS Client connected');
  ws.role = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'subscribe') {
        ws.role = data.role;
        console.log(`WS Client subscribed with role: ${ws.role}`);
      }
    } catch (e) {
      console.error('WS Error processing client message:', e.message);
    }
  });

  ws.on('error', (err) => {
    console.error('WS Client error:', err.message);
  });

  ws.on('close', () => {
    console.log('WS Client disconnected');
  });
});

function broadcast(payload) {
  const messageStr = JSON.stringify(payload);
  const targetRole = payload.role;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      // If a role is specified, send only to clients with that role or managers/admins
      const isAdminOrManager = ['ADMIN', 'CHEF_CENTRE', 'ADJOINT_CHEF_CENTRE'].includes(client.role);
      const matchesTargetRole = !targetRole || client.role === targetRole;

      if (matchesTargetRole || isAdminOrManager) {
        try {
          client.send(messageStr);
        } catch (err) {
          console.error('WS Broadcast failed for client:', err.message);
        }
      }
    }
  });
}

server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
