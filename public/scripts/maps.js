const mapOptions = {
  modeBarButtonsToRemove: [
    'toImage',
    'lasso2d',
    'autoScale2d',
    'zoom2d'
  ],
  displaylogo: false
};

function drawBigfootMap(longitude, latitude, hoverInfo) {
  var data = [
    {
      type: "scattermapbox",
      text: hoverInfo,
      lon: longitude,
      lat: latitude,
      marker: { color: "fuchsia", size: 4 }
    }
  ];

  var layout = {
    dragmode: "zoom",
    mapbox: {
      style: "white-bg",
      layers: [
        {
          sourcetype: "raster",
          source: ["https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}"],
          below: "traces"
        }
      ],
      center: {
        lat: 38, lon: -90
      },
      zoom: 3,
      autosize: true
    },
    margin: { r: 0, t: 0, b: 0, l: 0 }
  };

  Plotly.newPlot('bigfootMap', data, layout, mapOptions);
}

function drawSeasonMap(classifications, counts) {
  var colors = ['rgb(56, 75, 126)', 'rgb(18, 36, 37)', 'rgb(34, 53, 101)', 'rgb(36, 55, 57)', 'rgb(6, 4, 4)'];
  var data = [{
    values: counts,
    labels: classifications,
    textinfo: "label+percent+name",
    textposition: "outside",
    automargin: true,
    type: 'pie',
    marker: {
      colors: colors
    }
  }];

  var layout = {
    height: 400,
    margin: {
      l: 0,
      r: 0
    },
    title: 'Sightings by Class'
  };

  Plotly.newPlot('seasonMap', data, layout, mapOptions);
}

function drawYearlyMap(years, counts) {
  var trace = {
    x: years,
    y: counts,
    type: 'scatter'
  };

  var data = [trace];
  var layout = {
    height: 400,
    margin: {
      l: 0,
      r: 0
    },
    title: 'Sightings by Year'
  };

  Plotly.newPlot('yearlyMap', data, layout, mapOptions);
}