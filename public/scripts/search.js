

$("#search").keyup(function () {
    alert($("#search").val());
    $.get("/sightings", function (data, status) {
        if (status === 'success') {
            var longitudeData = data.longitudeData;
            var latitudeData = data.latitudeData;
            var hoverInfoData = data.hoverInfoData;
            var bigfootReports = data.bigfootReports;

            drawBigfootMap(longitudeData, latitudeData, hoverInfoData);
        }
    });
});