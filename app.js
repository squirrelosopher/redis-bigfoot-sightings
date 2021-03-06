import createError from 'http-errors';
import express from 'express';
import path from 'path';
import logger from 'morgan';

import Debug from 'debug';
const debug = Debug('ERROR');

import sightingRouter from './src/route/sighting.js';
import sightingsRouter from './src/route/sightings.js';
import ViewConstants from './src/constant/view_constants.js';

const app = express();
const __dirname = path.resolve();

// Use EJS as View Engine.
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', sightingsRouter);
app.use(`/${ViewConstants.SIGHTING}`, sightingRouter);

// Catch 404 and forward to error handler.
app.use(function(req, res, next) {
  next(createError(404));
});

// Error handler.
app.use(function(err, req, res, next) {

  let errorStatus = err.status || 404;
  debug(`[${errorStatus}] unable to process request, reason '${err.message}'`);

  // Render the error page.
  res.status(errorStatus);
  res.render(ViewConstants.ERROR, {
    errorStatus: errorStatus
  });
});

export default app;
