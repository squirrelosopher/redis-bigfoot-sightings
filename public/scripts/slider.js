$(document).ready(function() {
    $('#slider-range').on('input', (_) => {
        let value = $('#slider-range').val();
        $('#slider-data').html(value * 10);
    });
});