function populateAvgTable(tableId, dataArray) {
    var tableBody = $(tableId + ' tbody');
    dataArray.forEach(function (entry) {
        var rate = entry['fundingRate_percent_avg'];
        var rowClass = '';

        if (rate === null) {
            // Not enough data
            var rateDisplay = 'Not enough data';
        } else {
            var rateFormatted = rate.toFixed(6);
            var rateDisplay = rateFormatted;

            if (rate < 0) {
                // Negative funding rate: green (you get paid to long)
                rowClass = 'negative-funding';
            } else if (rate > 0) {
                // Positive funding rate: red (you get paid to short)
                rowClass = 'positive-funding';
            }
        }

        tableBody.append('<tr class="' + rowClass + '"><td>' + entry.coin + '</td><td>' + rateDisplay + '</td></tr>');
    });
    // Initialize DataTable if not already initialized
    if (!$.fn.DataTable.isDataTable(tableId)) {
        $(tableId).DataTable({
            paging: false,
            searching: false,
            order: [[1, 'desc']]
        });
    }
}

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

        var rateDisplay = rateFormatted;

        tableBody.append('<tr class="' + rowClass + '"><td>' + entry.coin + '</td><td>' + rateDisplay + '</td></tr>');
    });
    // Initialize DataTable if not already initialized
    if (!$.fn.DataTable.isDataTable(tableId)) {
        $(tableId).DataTable({
            paging: false,
            searching: false,
            order: [[1, 'desc']]
        });
    }
}

$(document).ready(function () {
    $.getJSON('funding_data.json', function (data) {
        // Update the data timestamp (from exchange)
        $('#timestamp').text(data.timestamp);

        // Update the generated_at timestamp (when the script finished executing)
        $('#generated_at').text(data.generated_at);

        // Populate the average funding rates table
        populateAvgTable('#averageFundingTable', data.avg_funding_rates);

        // Populate current funding rate tables
        populateTable('#positiveCurrentTable', data.positive_current, 'fundingRate_percent');
        populateTable('#negativeCurrentTable', data.negative_current, 'fundingRate_percent');
    });
});
