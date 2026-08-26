import { ApiError, getSighting } from './api-client.js';

/**
 * Detail page controller. Every value is written with `textContent`, so a
 * report cannot inject markup into the page.
 */

const elements = {
  content: document.getElementById('sightingContent'),
  alert: document.getElementById('sightingAlert'),
  title: document.getElementById('sightingTitle'),
  observed: document.getElementById('sightingObserved'),
  mapLink: document.getElementById('sightingMapLink'),
};

const DETAIL_FIELDS = [
  'id',
  'date',
  'classification',
  'season',
  'state',
  'county',
  'location',
  'locationDetails',
];

const EMPTY_PLACEHOLDER = 'Not recorded';

function formatDate(epochSeconds) {
  if (!Number.isFinite(epochSeconds)) {
    return EMPTY_PLACEHOLDER;
  }

  return new Date(epochSeconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatValue(field, sighting) {
  if (field === 'date') {
    return formatDate(sighting.date);
  }

  const value = sighting[field];

  if (value === null || value === undefined || value === '') {
    return EMPTY_PLACEHOLDER;
  }

  return String(value);
}

function showError(message) {
  elements.content.classList.add('d-none');
  elements.alert.textContent = message;
  elements.alert.classList.remove('d-none');
}

function renderMapLink(location) {
  const [longitude, latitude] = String(location ?? '').split(',');

  if (!longitude || !latitude) {
    return;
  }

  const query = new URLSearchParams({ mlat: latitude, mlon: longitude });
  elements.mapLink.href =
    'https://www.openstreetmap.org/?' + query.toString() + '#map=10/' + latitude + '/' + longitude;
  elements.mapLink.classList.remove('d-none');
}

function render(sighting) {
  document.title = sighting.title + ' - Bigfoot Sightings';
  elements.title.textContent = sighting.title;
  elements.observed.textContent = sighting.observed;

  for (const field of DETAIL_FIELDS) {
    const element = document.getElementById('sighting-' + field);

    if (element) {
      element.textContent = formatValue(field, sighting);
    }
  }

  renderMapLink(sighting.location);
  elements.content.classList.remove('d-none');
}

async function main() {
  const id = new URLSearchParams(window.location.search).get('id');

  if (id === null || id.trim() === '') {
    showError('No report was requested. Pick a sighting from the map to see its details.');
    return;
  }

  try {
    render(await getSighting(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      showError('No report exists with id ' + id + '.');
      return;
    }

    if (error instanceof ApiError && error.status === 400) {
      showError('"' + id + '" is not a valid report id.');
      return;
    }

    showError('This report could not be loaded right now.');
  }
}

void main();
