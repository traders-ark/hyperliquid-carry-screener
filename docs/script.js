$(document).ready(function () {
    // Load the JSON data
    $.getJSON('funding_data.json', function (data) {
        // Update the timestamp
        $('#timestamp').text(data.timestamp);

        // Populate the tables
        populateTable('#positiveCurrentTable', data.positive_current, 'fundingRate_percent');
        populateTable('#negativeCurrentTable', data.negative_current, 'fundingRate_percent');
        populateTable('#positiveAvgTable', data.positive_avg, 'fundingRate_percent_avg');
        populateTable('#negativeAvgTable', data.negative_avg, 'fundingRate_percent_avg');
    });

    function populateTable(tableId, dataArray, rateKey) {
        var tableBody = $(tableId + ' tbody');
        dataArray.forEach(function (entry) {
            tableBody.append('<tr><td>' + entry.coin + '</td><td>' + entry[rateKey].toFixed(6) + '</td></tr>');
        });
        $(tableId).DataTable({
            paging: false,
            searching: false
        });
    }
});
