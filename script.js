function populateTable(tableId, dataArray, rateKey) {
    var tableBody = $(tableId + ' tbody');
    dataArray.forEach(function (entry) {
        var rate = entry[rateKey];
        var rateFormatted = rate.toFixed(6);
        var rowClass = '';

        if (rate < 0) {
            // Negative funding rate: green (you get paid to long)
            rowClass = 'negative-funding';
        } else if (rate > 0) {
            // Positive funding rate: red (you get paid to short)
            rowClass = 'positive-funding';
        }

        tableBody.append('<tr class="' + rowClass + '"><td>' + entry.coin + '</td><td>' + rateFormatted + '</td></tr>');
    });
    $(tableId).DataTable({
        paging: false,
        searching: false
    });
}

$(document).ready(function () {
    $.getJSON('funding_data.json', function (data) {
        // Update the timestamp
        $('#timestamp').text(data.timestamp);

        if (data.not_enough_data) {
            $('#averageTables').html('<p>Not enough data to calculate averages.</p>');
        } else {
            // Populate the average tables
            populateTable('#positiveAvgTable', data.positive_avg, 'fundingRate_percent_avg');
            populateTable('#negativeAvgTable', data.negative_avg, 'fundingRate_percent_avg');
        }

        // Populate current funding rate tables
        populateTable('#positiveCurrentTable', data.positive_current, 'fundingRate_percent');
        populateTable('#negativeCurrentTable', data.negative_current, 'fundingRate_percent');
    });
});
