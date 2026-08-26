/**
 * Plotly rendering. Kept apart from data fetching so the charting library stays
 * one swappable dependency rather than something threaded through the page.
 *
 * `Plotly` is a global provided by the vendored bundle.
 */

/* global Plotly */

const BASE_MAP_TILES =
  'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}';

const CHART_OPTIONS = {
  modeBarButtonsToRemove: ['toImage', 'lasso2d', 'autoScale2d', 'zoom2d'],
  displaylogo: false,
  responsive: true,
};

const SEASON_COLORS = [
  'rgb(56, 75, 126)',
  'rgb(18, 36, 37)',
  'rgb(34, 53, 101)',
  'rgb(36, 55, 57)',
  'rgb(6, 4, 4)',
];

/**
 * @param {string} elementId
 * @param {{sightings: Array<object>, center: {longitude: number, latitude: number}, radiusLabel: string}} data
 * @param {(id: number) => void} onSightingClick
 */
export function renderSightingsMap(elementId, { sightings, center, radiusLabel }, onSightingClick) {
  const located = sightings.filter((sighting) => sighting.location !== null);

  const traces = [
    {
      type: 'scattermapbox',
      lon: located.map((sighting) => sighting.location.longitude),
      lat: located.map((sighting) => sighting.location.latitude),
      ids: located.map((sighting) => String(sighting.id)),
      customdata: located.map((sighting) => sighting.hoverText),
      marker: { color: 'rgb(255, 0, 255)', size: 5 },
      showlegend: false,
      hovertemplate: '%{lon:.2f}, %{lat:.2f}<br>%{customdata}<extra></extra>',
    },
    {
      type: 'scattermapbox',
      name: 'centre',
      lon: [center.longitude],
      lat: [center.latitude],
      mode: 'markers',
      marker: { color: 'rgba(255, 0, 255, 0.4)', size: 20 },
      showlegend: false,
      customdata: ['centre'],
      hovertemplate: `%{lon:.2f}, %{lat:.2f}<br>Search centre (${radiusLabel})<extra></extra>`,
    },
  ];

  const layout = {
    height: 560,
    dragmode: 'zoom',
    mapbox: {
      style: 'white-bg',
      layers: [{ sourcetype: 'raster', source: [BASE_MAP_TILES], below: 'traces' }],
      center: { lat: 44, lon: -92 },
      zoom: 2.5,
      autosize: true,
    },
    margin: { r: 0, t: 0, b: 0, l: 0 },
  };

  const element = document.getElementById(elementId);

  Plotly.newPlot(element, traces, layout, CHART_OPTIONS).then(() => {
    element.on('plotly_click', (event) => {
      const point = event.points?.[0];

      // The centre marker carries the literal string; report markers carry text.
      if (!point || point.data.name === 'centre') {
        return;
      }

      onSightingClick(Number(point.id));
    });
  });
}

/**
 * @param {string} elementId
 * @param {Array<{season: string, count: number}>} buckets
 */
export function renderSeasonChart(elementId, buckets) {
  const traces = [
    {
      type: 'pie',
      values: buckets.map((bucket) => bucket.count),
      labels: buckets.map((bucket) => bucket.season),
      textinfo: 'label+percent',
      textposition: 'outside',
      automargin: true,
      marker: { colors: SEASON_COLORS },
    },
  ];

  const layout = {
    height: 400,
    showlegend: true,
    legend: { x: -0.5, y: 0.5 },
    margin: { l: 0, r: 0 },
    title: 'Sightings by season',
  };

  Plotly.newPlot(document.getElementById(elementId), traces, layout, CHART_OPTIONS);
}

/**
 * @param {string} elementId
 * @param {Array<{year: number, count: number}>} buckets
 */
export function renderYearChart(elementId, buckets) {
  const traces = [
    {
      type: 'scatter',
      mode: 'lines',
      x: buckets.map((bucket) => bucket.year),
      y: buckets.map((bucket) => bucket.count),
      line: { color: 'rgb(34, 53, 101)' },
    },
  ];

  const layout = {
    height: 400,
    margin: { l: 40, r: 10 },
    title: 'Sightings by year',
    xaxis: { title: 'Year' },
    yaxis: { title: 'Reports' },
  };

  Plotly.newPlot(document.getElementById(elementId), traces, layout, CHART_OPTIONS);
}
