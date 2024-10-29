function populateAvgTable(tableId, dataArray, fundingHistory) {
    var tableBody = $(tableId + ' tbody');
    dataArray.forEach(function (entry) {
        var rate = entry['fundingRate_percent_avg'];
        var coin = entry.coin;
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

        var rowId = coin + '-avg';
        tableBody.append('<tr id="' + rowId + '" class="' + rowClass + ' expandable-row"><td>' + coin + '</td><td>' + rateDisplay + '</td></tr>');
        tableBody.append('<tr class="details-row"><td colspan="2"><div id="' + rowId + '-chart" class="chart-container"></div></td></tr>');
    });

    initializeDataTable(tableId);
}

function populateTable(tableId, dataArray, rateKey, fundingHistory) {
    var tableBody = $(tableId + ' tbody');
    dataArray.forEach(function (entry) {
        var rate = entry[rateKey];
        var coin = entry.coin;
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
        var rowId = coin + '-current';
        tableBody.append('<tr id="' + rowId + '" class="' + rowClass + ' expandable-row"><td>' + coin + '</td><td>' + rateDisplay + '</td></tr>');
        tableBody.append('<tr class="details-row"><td colspan="2"><div id="' + rowId + '-chart" class="chart-container"></div></td></tr>');
    });

    initializeDataTable(tableId);
}

function initializeDataTable(tableId) {
    if (!$.fn.DataTable.isDataTable(tableId)) {
        // Determine sort order based on tableId
        var sortOrder = [[1, 'desc']]; // Default for positive tables
        if (tableId.includes('negative')) {
            sortOrder = [[1, 'asc']]; // Ascending for negative tables
        }
        
        $(tableId).DataTable({
            paging: false,
            searching: false,
            order: sortOrder,
            columnDefs: [
                { targets: [0, 1], orderable: false }
            ]
        });
    }
}

function setupExpandableRows(fundingHistory) {
    $('.expandable-row').click(function () {
        var coinId = $(this).attr('id');
        var detailsRow = $(this).next('.details-row');

        if (detailsRow.is(':visible')) {
            detailsRow.hide();
        } else {
            detailsRow.show();

            // Check if the chart is already rendered
            var chartContainer = $('#' + coinId + '-chart');
            if (!chartContainer.data('chartRendered')) {
                var coin = coinId.split('-')[0];
                renderChart(coin, chartContainer, fundingHistory);
                chartContainer.data('chartRendered', true);
            }
        }
    });

    // Initially hide all details rows
    $('.details-row').hide();
}

function renderChart(coin, container, fundingHistory) {
    var history = fundingHistory[coin];
    if (!history) {
        container.html('<p>No funding history available.</p>');
        return;
    }

    var times = history.times;
    var fundingRates = history.fundingRates;
    var dataPoints = history.dataPoints;

    // Display stats overview
    var statsHtml = '<p>Data Points Collected: ' + dataPoints + '</p>';
    container.append(statsHtml);

    // Create canvas element for Chart.js
    var canvasId = coin + '-chart-canvas';
    container.append('<canvas id="' + canvasId + '"></canvas>');

    var ctx = document.getElementById(canvasId).getContext('2d');

    var chartData = {
        labels: times,
        datasets: [{
            label: 'Funding Rate (%)',
            data: fundingRates,
            backgroundColor: fundingRates.map(function (value) {
                return value >= 0 ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
            }),
            borderColor: fundingRates.map(function (value) {
                return value >= 0 ? 'rgba(0, 255, 0, 1)' : 'rgba(255, 0, 0, 1)';
            }),
            borderWidth: 1
        }]
    };

    var chartOptions = {
        scales: {
            x: {
                display: false // Hide x-axis labels to save space
            },
            y: {
                title: {
                    display: true,
                    text: 'Funding Rate (%)'
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        var label = ' ' + context.parsed.y.toFixed(6) + '%';
                        return label;
                    }
                }
            }
        },
        responsive: true,
        maintainAspectRatio: false
    };

    new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: chartOptions
    });
}

$(document).ready(function () {
    $.getJSON('funding_data.json', function (data) {
        // Update the data timestamp (from exchange)
        $('#timestamp').text(data.timestamp);

        // Update the generated_at timestamp (when the script finished executing)
        $('#generated_at').text(data.generated_at);

        // Populate the average funding rates tables
        populateAvgTable('#positiveAvgTable', data.positive_avg, data.funding_history);
        populateAvgTable('#negativeAvgTable', data.negative_avg, data.funding_history);

        // Populate current funding rate tables
        populateTable('#positiveCurrentTable', data.positive_current, 'fundingRate_percent', data.funding_history);
        populateTable('#negativeCurrentTable', data.negative_current, 'fundingRate_percent', data.funding_history);

        // Setup expandable rows
        setupExpandableRows(data.funding_history);
    });
});
