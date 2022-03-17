const mapOptions = {
  modeBarButtonsToRemove: [
    'toImage',
    'lasso2d',
    'autoScale2d',
    'zoom2d'
  ],
  displaylogo: false,
  responsive: true
};

function drawBigfootMap(urlToOpen, idData, longitudeData, latitudeData, hoverInfoData) {
  var data = [
    {
      type: "scattermapbox",
      text: hoverInfoData,
      lon: longitudeData,
      lat: latitudeData,
      ids: idData,
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
  let bigfootPlot = $('#bigfootMap');
  bigfootPlot.on('plotly_click', (_, pointsData) => {
    let id = pointsData.points[0].id;
    let url = `${urlToOpen}?id=${id}`;
    window.open(url, '_blank');
  });
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
    showLegend: true,
    legend: {
      x: -0.5,
      y: 0.5
    },
    margin: {
      l: 0,
      r: 0
    },
    title: 'Sightings by Season'
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