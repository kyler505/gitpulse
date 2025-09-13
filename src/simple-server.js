#!/usr/bin/env node

import { createServer } from 'http';

const port = parseInt(process.env.PORT || '3000');

const server = createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // Simple response that matches what Poke might expect
  const response = {
    success: true,
    status: 200,
    message: 'GitPulse MCP Server is running',
    server: 'GitPulse',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  };
  
  res.writeHead(200, { 
    'Content-Type': 'application/json',
    'Server': 'GitPulse/1.0.0'
  });
  res.end(JSON.stringify(response, null, 2));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Simple GitPulse server running on port ${port}`);
  console.log(`Local: http://localhost:${port}`);
  console.log(`Network: http://192.168.1.14:${port}`);
  console.log(`\nTry accessing from your phone:`);
  console.log(`http://192.168.1.14:${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    process.exit(0);
  });
});