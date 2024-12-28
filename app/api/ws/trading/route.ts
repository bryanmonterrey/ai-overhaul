// app/api/ws/trading/route.ts
import { WebSocketServer } from 'ws';
import type { NextApiRequest } from 'next';
import { NextApiResponseServerIO } from '../../../types/socket';
import { Server } from 'socket.io';
import cors from 'cors';

// Add CORS middleware
const corsMiddleware = cors({
  origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true,
});

export default async function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  // Handle CORS
  await new Promise((resolve, reject) => {
    corsMiddleware(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });

  if (!res.socket.server.ws) {
    const wss = new WebSocketServer({ 
      noServer: true,
      path: '/ws/trading',
      clientTracking: true,
    });

    // Store WSS instance
    res.socket.server.ws = wss;

    // Handle upgrade
    res.socket.server.on('upgrade', (request, socket, head) => {
      // Check origin
      const origin = request.headers.origin;
      if (!origin || origin !== (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });

    wss.on('connection', (ws, request) => {
      console.log('Client connected to WebSocket');
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('Received message:', message);
          
          // Broadcast to all clients
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === ws.OPEN) {
              client.send(JSON.stringify(message));
            }
          });
          
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
      });
    });
  }

  res.end();
}