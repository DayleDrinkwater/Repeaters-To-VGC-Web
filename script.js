// Function to convert Maidenhead locator to latitude and longitude
function toLocation(locator) {
    let lat;
    let lon;

    if (locator.length === 6) {
        const A = locator.charCodeAt(0) - 'A'.charCodeAt(0);
        const B = locator.charCodeAt(1) - 'A'.charCodeAt(0);
        const C = Number.parseInt(locator.charAt(2));
        const D = Number.parseInt(locator.charAt(3));
        const E = locator.charCodeAt(4) - 'A'.charCodeAt(0);
        const F = locator.charCodeAt(5) - 'A'.charCodeAt(0);

        lon = (A * 20) - 180 + (C * 2) + (E / 12) - (1 / 24);
        lat = (B * 10) - 90 + D + (F / 24) - (1 / 48);
    } else if (locator.length === 4) {
        const A = locator.charCodeAt(0) - 'A'.charCodeAt(0);
        const B = locator.charCodeAt(1) - 'A'.charCodeAt(0);
        const C = Number.parseInt(locator.charAt(2));
        const D = Number.parseInt(locator.charAt(3));

        lon = (A * 20) - 180 + (C * 2) + 1; // Center of the square
        lat = (B * 10) - 90 + D + 0.5; // Center of the square
    } else {
        return [Number.NaN, Number.NaN];
    }

    return [lat, lon];
}

// Function to calculate distance between two coordinates using Haversine formula
function haversineDistance(coords1, coords2) {
    const R = 6371; // Radius of the Earth in km
    const lat1 = coords1[0] * Math.PI / 180;
    const lon1 = coords1[1] * Math.PI / 180;
    const lat2 = coords2[0] * Math.PI / 180;
    const lon2 = coords2[1] * Math.PI / 180;

    const dlat = lat2 - lat1;
    const dlon = lon2 - lon1;

    const a = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dlon / 2) * Math.sin(dlon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

document.getElementById('repeaterForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const gridLocator = document.getElementById('gridLocator').value;
    const aprsEntry = document.getElementById('aprsEntry').value === 'yes';
    const numEntries = Number.parseInt(document.getElementById('numEntries').value);

    const apiUrl = "https://api-beta.rsgb.online/all/systems";
    const response = await fetch(apiUrl);
    const data = (await response.json()).data;

    const filteredData = data.filter(item => 
        item.modeCodes?.includes('A') &&
        ['AV', 'DM'].includes(item.type) &&
        ['2M', '70CM'].includes(item.band) &&
        item.status === 'OPERATIONAL'
    );

    const userLocation = toLocation(gridLocator);

    filteredData.sort((a, b) => {
        const locA = toLocation(a.locator);
        const locB = toLocation(b.locator);
        const distA = haversineDistance(userLocation, locA);
        const distB = haversineDistance(userLocation, locB);
        return distA - distB;
    });

    const csvHeaders = [
        'title', 'tx_freq', 'rx_freq', 'tx_sub_audio(CTCSS=freq/DCS=number)', 
        'rx_sub_audio(CTCSS=freq/DCS=number)', 'tx_power(H/M/L)', 'bandwidth(12500/25000)', 
        'scan(0=OFF/1=ON)', 'talk around(0=OFF/1=ON)', 'pre_de_emph_bypass(0=OFF/1=ON)', 
        'sign(0=OFF/1=ON)', 'tx_dis(0=OFF/1=ON)', 'mute(0=OFF/1=ON)', 
        'rx_modulation(0=FM/1=AM)', 'tx_modulation(0=FM/1=AM)'
    ];

    let csvContent = `${csvHeaders.join(',')}\n`;

    let totalEntries = aprsEntry ? 1 : 0;
    if (aprsEntry) {
        const aprsRow = [
            'APRS', '144800000', '144800000', '', '', 'H', '12500', '0', '0', '0', '0', '0', '0', '0', '0'
        ].join(',');
        csvContent += `${aprsRow}\n`;
    }

    for (const item of filteredData) {
        if (totalEntries >= numEntries) break;
        const ctcssValue = Math.round(Number.parseFloat(item.ctcss) * 100);
        const row = [
            item.repeater,
            String(item.rx).replace('.', ''),
            String(item.tx).replace('.', ''),
            ctcssValue,
            ctcssValue,
            item.dbwErp > 5 ? 'H' : 'L',
            item.txbw === 12.5 ? '12500' : '25000',
            '1', '0', '0', '0', '0', '0', '0', '0'
        ].join(',');
        csvContent += `${row}\n`;
        totalEntries++;
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.getElementById('downloadLink');
    downloadLink.href = url;
    downloadLink.download = `Repeaters - ${gridLocator}.csv`;
    downloadLink.style.display = 'block';
});