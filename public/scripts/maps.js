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
      type: 'scattermapbox',
      lon: longitudeData,
      lat: latitudeData,
      ids: idData,
      marker: { color: 'rgb(255, 0, 255)', size: 4 },
      showlegend: false,
      hovertext: hoverInfoData,
      hovertemplate: '%{lon:.2f}, %{lat:.2f} <br> %{hovertext}<extra></extra>'
    },
    {
      type: 'scattermapbox',
      lat: ['55.0'],
      lon: ['-110.0'],
      mode: 'markers',
      marker: {
        color: 'rgba(255, 0, 255, 0.4)',
        size: 20
      },
      showlegend: false,
      customdata: 'geological',
      hovertemplate: '%{lon:.2f}, %{lat:.2f} <br> Geological center for radius search [<b>hardcoded</b>]<extra></extra>'
    }
  ];

  var layout = {
    height: 560,
    dragmode: 'zoom',
    mapbox: {
      style: 'white-bg',
      layers: [
        {
          sourcetype: 'raster',
          source: ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}'],
          below: 'traces'
        }
      ],
      center: {
        lat: 44, lon: -92
      },
      zoom: 2.5,
      autosize: true
    },
    margin: { r: 0, t: 0, b: 0, l: 0 }
  };

  Plotly.newPlot('bigfootMap', data, layout, mapOptions);
  $('#bigfootMap').on('plotly_click', (_, pointsData) => {
    let point = pointsData.points[0];
    let customData = point.data.customdata;

    if (!customData) {
      let id = point.id;
      let url = `${urlToOpen}?id=${id}`;
      window.open(url, '_blank');
    }
  });
}

function drawSeasonMap(classifications, counts) {
  var colors = ['rgb(56, 75, 126)', 'rgb(18, 36, 37)', 'rgb(34, 53, 101)', 'rgb(36, 55, 57)', 'rgb(6, 4, 4)'];
  var data = [{
    values: counts,
    labels: classifications,
    textinfo: 'label+percent+name',
    textposition: 'outside',
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