#!/usr/bin/env node

/*
* Module dependencies.
*/

import ConfigurationConstants from '../util/configuration_constants.js';
import app from '../app.js';
import * as http from 'http';

import Debug from 'debug';
const debug = Debug('redis-bigfoot-sightings:server');

/*
* Get port from environment and store in Express.
*/
const PORT = ConfigurationConstants.SERVER_PORT;
app.set('port', PORT);

/*
* Create HTTP server.
*/

const server = http.createServer(app);

/*
* Listen on provided port, on all network interfaces.
*/
server.listen(PORT);
server.on('error', onError);
server.on('listening', onListening);

/*
* Event listener for HTTP server "error" event.
*/
function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  let bind = typeof PORT === 'string'
    ? `Pipe ${PORT}`
    : `Port ${PORT}`;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
      process.exit(1);
    default:
      throw error;
  }
}

/*
* Event listener for HTTP server "listening" event.
*/

function onListening() {
  let addr = server.address();
  let bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug(`server listening on ${bind}`);
}
