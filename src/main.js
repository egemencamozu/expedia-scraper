import { Actor } from 'apify';
import { CheerioCrawler, RequestQueue } from 'crawlee';

import { router } from './routes.js';

await Actor.init();

const input = await Actor.getInput();
const { startDate, endDate, hotels } = input ?? {};

if (!startDate || !endDate || !hotels || hotels.length === 0) {
    throw new Error('Missing required input parameters. Please provide startDate, endDate, and hotels array.');
}

console.log(`📅 Date range: ${startDate} to ${endDate}`);
console.log(`🏨 Hotels to process: ${hotels.length}`);

// Proxy kullanımı
const proxyConfiguration = await Actor.createProxyConfiguration();

// RequestQueue başlat
const requestQueue = await RequestQueue.open();

// Otel URL’lerini kuyruğa ekle
for (const hotel of hotels) {
    await requestQueue.addRequest({
        url: hotel.url,
        userData: {
            hotelName: hotel.hotelName,
            startDate,
            endDate,
            label: 'hotel', // routes.js içinde handler belirlemek için
        },
    });
}

// CheerioCrawler oluştur
const crawler = new CheerioCrawler({
    requestQueue,
    proxyConfiguration,
    requestHandler: router,
    maxConcurrency: 5,
    requestHandlerTimeoutSecs: 150,
});

await crawler.run();

await Actor.exit();
