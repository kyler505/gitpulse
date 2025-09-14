#!/usr/bin/env node

// Wrapper to start the MCP server
// This file exists because Render seems to ignore render.yaml and looks for index.js
import('./mcp-server.js')
  .then(() => {
    console.log('GitPulse MCP Server wrapper loaded');
  })
  .catch((error) => {
    console.error('Failed to load MCP server:', error);
    process.exit(1);
  });