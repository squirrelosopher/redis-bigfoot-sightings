import { ApiError, getFacets, searchSightings } from './api-client.js';
import { renderSeasonChart, renderSightingsMap, renderYearChart } from './charts.js';

/**
 * Search page controller.
 *
 * Criteria live in the URL query string, which makes any search shareable and
 * bookmarkable and means a reload restores exactly what was on screen. The form
 * writes to the URL, the page reads from it, and the API call is derived from
 * the URL alone.
 */

const DEFAULT_CENTER = { longitude: -110, latitude: 55 };
const DEFAULT_RADIUS = 5000;

const elements = {
  form: document.getElementById('searchForm'),
  text: document.getElementById('text'),
  state: document.getElementById('state'),
  county: document.getElementById('county'),
  longitude: document.getElementById('longitude'),
  latitude: document.getElementById('latitude'),
  radius: document.getElementById('radius'),
  radiusLabel: document.getElementById('radiusLabel'),
  units: document.getElementById('units'),
  unitsLabel: document.getElementById('unitsLabel'),
  unitsToggle: document.getElementById('unitsToggle'),
  reset: document.getElementById('resetSearch'),
  status: document.getElementById('searchStatus'),
  alert: document.getElementById('searchAlert'),
  statesList: document.getElementById('statesList'),
  countiesList: document.getElementById('countiesList'),
};

function readCriteriaFromUrl() {
  const params = new URLSearchParams(window.location.search);

  return {
    text: params.get('text') ?? '',
    state: params.get('state') ?? '',
    county: params.get('county') ?? '',
    lon: params.get('lon') ?? String(DEFAULT_CENTER.longitude),
    lat: params.get('lat') ?? String(DEFAULT_CENTER.latitude),
    radius: params.get('radius') ?? String(DEFAULT_RADIUS),
    units: params.get('units') ?? 'km',
  };
}

/**
 * Keeps the hidden field, the toggle button and the readout beside the slider in
 * step, so the unit is never shown in two places at once with two values.
 *
 * @param {string} units
 */
function setUnits(units) {
  elements.units.value = units;
  elements.unitsToggle.textContent = units;
  elements.unitsLabel.textContent = units;
}

function applyCriteriaToForm(criteria) {
  elements.text.value = criteria.text;
  elements.state.value = criteria.state;
  elements.county.value = criteria.county;
  elements.longitude.value = criteria.lon;
  elements.latitude.value = criteria.lat;
  elements.radius.value = criteria.radius;
  elements.radiusLabel.textContent = criteria.radius;
  setUnits(criteria.units);
}

function setStatus(message) {
  elements.status.textContent = message;
}

function showError(message) {
  elements.alert.textContent = message;
  elements.alert.classList.remove('d-none');
}

function clearError() {
  elements.alert.classList.add('d-none');
  elements.alert.textContent = '';
}

function fillDataList(list, values) {
  const fragment = document.createDocumentFragment();

  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    fragment.append(option);
  }

  list.replaceChildren(fragment);
}

/**
 * Observations run to several thousand characters, and a hover label is not a
 * reading surface: Plotly neither wraps nor clips it, so one long report used to
 * stretch a tooltip past the edge of the window.
 */
const MAX_HOVER_LENGTH = 180;
const HOVER_LINE_LENGTH = 60;

/** Words of context kept before the first match, so it does not open the line. */
const HOVER_LEAD_WORDS = 6;

/**
 * Flattens highlight segments into words, each carrying the match flag of the
 * segment it came from. Working in whole words keeps the bold runs aligned with
 * word boundaries and makes wrapping a matter of counting.
 *
 * @param {Array<{text: string, match: boolean}>} segments
 * @returns {Array<{text: string, match: boolean}>}
 */
function toHoverWords(segments) {
  const words = [];

  for (const segment of segments) {
    for (const word of segment.text.split(/\s+/)) {
      if (word.length > 0) {
        words.push({ text: word, match: Boolean(segment.match) });
      }
    }
  }

  return words;
}

/**
 * Picks the window of words to show. It starts shortly before the first matched
 * word rather than at the beginning of the report: the match is the reason the
 * point is on the map, and in these reports it is usually thousands of
 * characters in, so a window taken from the start would cut it off entirely.
 *
 * @param {Array<{text: string, match: boolean}>} words
 * @returns {{words: Array<{text: string, match: boolean}>, clippedStart: boolean, clippedEnd: boolean}}
 */
function selectHoverWindow(words) {
  const firstMatch = words.findIndex((word) => word.match);
  const start = firstMatch === -1 ? 0 : Math.max(0, firstMatch - HOVER_LEAD_WORDS);

  const picked = [];
  let length = 0;

  for (let index = start; index < words.length; index += 1) {
    const separator = picked.length === 0 ? 0 : 1;

    if (length + separator + words[index].text.length > MAX_HOVER_LENGTH) {
      break;
    }

    picked.push(words[index]);
    length += separator + words[index].text.length;
  }

  return {
    words: picked,
    clippedStart: start > 0,
    clippedEnd: start + picked.length < words.length,
  };
}

/**
 * Plotly parses a small subset of HTML in hover labels, so report text has to be
 * escaped before `<b>` is wrapped around the matched words.
 *
 * @param {string} value
 */
function escapeForHover(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Renders the window as `<br>` separated lines with the matched words bold, so
 * the tooltip grows downwards instead of sideways and the reason the point
 * matched is visible at a glance.
 *
 * @param {{words: Array<{text: string, match: boolean}>, clippedStart: boolean, clippedEnd: boolean}} window
 * @returns {string}
 */
function renderHoverLines({ words, clippedStart, clippedEnd }) {
  const lines = [];
  let line = clippedStart ? '…' : '';
  let width = line.length;

  for (const word of words) {
    if (width > 0 && width + 1 + word.text.length > HOVER_LINE_LENGTH) {
      lines.push(line);
      line = '';
      width = 0;
    }

    const rendered = word.match
      ? '<b>' + escapeForHover(word.text) + '</b>'
      : escapeForHover(word.text);

    line += width === 0 ? rendered : ' ' + rendered;
    width += (width === 0 ? 0 : 1) + word.text.length;
  }

  if (clippedEnd) {
    line += '…';
  }

  if (line.length > 0) {
    lines.push(line);
  }

  return lines.join('<br>');
}

/**
 * @param {Array<{text: string, match: boolean}>} segments
 * @param {string} fallback
 */
function usableSegments(segments, fallback) {
  return Array.isArray(segments) && segments.length > 0
    ? segments
    : [{ text: fallback, match: false }];
}

/** @param {Array<{match: boolean}>} segments */
function hasMatch(segments) {
  return segments.some((segment) => segment.match);
}

/**
 * The map tooltip shows the matched part of the observation when the user
 * searched for text, and the report title otherwise.
 *
 * A term can match either field, so prefer whichever one actually contains it -
 * the query matches on title and narrative alike, and always showing the
 * narrative left the tooltips of title-only matches with nothing marked.
 */
function toHoverText(sighting, hasTextQuery) {
  const title = usableSegments(sighting.titleHighlights, sighting.title);

  if (!hasTextQuery) {
    return renderHoverLines(selectHoverWindow(toHoverWords(title)));
  }

  const observed = usableSegments(sighting.observedHighlights, sighting.observed);
  const preferred = hasMatch(observed) || !hasMatch(title) ? observed : title;

  return renderHoverLines(selectHoverWindow(toHoverWords(preferred)));
}

async function loadFacets() {
  try {
    const facets = await getFacets();
    fillDataList(elements.statesList, facets.states);
    fillDataList(elements.countiesList, facets.counties);
  } catch {
    // Autocomplete is a convenience; the page is fully usable without it.
  }
}

function describeTotal(total) {
  if (total === 0) {
    return 'No reports match these criteria.';
  }

  const plural = total === 1 ? '' : 's';
  return total.toLocaleString() + ' report' + plural + ' matched.';
}

async function runSearch(criteria) {
  clearError();
  setStatus('Searching...');

  try {
    const result = await searchSightings({
      text: criteria.text,
      state: criteria.state,
      county: criteria.county,
      lon: criteria.lon,
      lat: criteria.lat,
      radius: criteria.radius,
      units: criteria.units,
    });

    const hasTextQuery = criteria.text.trim().length > 0;
    const sightings = result.sightings.map((sighting) => ({
      ...sighting,
      hoverText: toHoverText(sighting, hasTextQuery),
    }));

    setStatus(describeTotal(result.total));

    renderSightingsMap(
      'sightingsMap',
      {
        sightings,
        center: { longitude: Number(criteria.lon), latitude: Number(criteria.lat) },
        radiusLabel: criteria.radius + ' ' + criteria.units,
      },
      (id) => window.open('/sighting?id=' + id, '_blank', 'noopener'),
    );

    renderSeasonChart('seasonChart', result.statistics.bySeason);
    renderYearChart('yearChart', result.statistics.byYear);
  } catch (error) {
    setStatus('');

    if (error instanceof ApiError && error.status === 400) {
      showError('Those search criteria are not valid: ' + error.message);
      return;
    }

    showError('The search could not be completed. Is the data loaded and Redis running?');
  }
}

function submitSearch(event) {
  event.preventDefault();

  const params = new URLSearchParams();
  const fields = {
    text: elements.text.value.trim(),
    state: elements.state.value.trim(),
    county: elements.county.value.trim(),
    lon: elements.longitude.value,
    lat: elements.latitude.value,
    radius: elements.radius.value,
    units: elements.units.value,
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value !== '') {
      params.set(key, value);
    }
  }

  window.location.assign('/?' + params.toString());
}

function registerFormBehaviour() {
  elements.form.addEventListener('submit', submitSearch);

  elements.radius.addEventListener('input', () => {
    elements.radiusLabel.textContent = elements.radius.value;
  });

  // Switching the unit changes what the current results mean, so re-run the
  // search straight away. Toggling the label without refreshing the map left the
  // page showing kilometre results under a "mi" label.
  elements.unitsToggle.addEventListener('click', () => {
    setUnits(elements.units.value === 'km' ? 'mi' : 'km');
    elements.form.requestSubmit();
  });

  elements.reset.addEventListener('click', () => window.location.assign('/'));
}

const criteria = readCriteriaFromUrl();
applyCriteriaToForm(criteria);
registerFormBehaviour();

void loadFacets();
void runSearch(criteria);
