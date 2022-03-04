#!/usr/bin/env node

/*
* Module dependencies.
*/


import 'dotenv/config';
import app from '../app.js';
import * as http from 'http';
import Debug from 'debug';
const debug = Debug('redis-bigfoot-sightings:server');

/*
* Get port from environment and store in Express.
*/

const PORT = normalizePort(process.env.PORT || '3000');
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
* Normalize a port into a number, string, or false.
*/
function normalizePort(val) {
  let port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

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
