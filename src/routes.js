import { createCheerioRouter, Dataset } from 'crawlee';
import { franc } from 'franc';
import langs from 'langs';

export const router = createCheerioRouter();

// 🌐 Yardımcı: Yorum dilini tespit et
function detectLanguage(text) {
    if (!text || text.length < 10) return null;
    try {
        const lang3 = franc(text);
        if (lang3 === 'und') return null;
        const langObj = langs.where('3', lang3);
        return langObj?.['1'] || null;
    } catch {
        return null;
    }
}

// 🏨 Yorumları çeken handler
router.addHandler('hotel', async ({ request, log, crawler }) => {
    const { hotelName, startDate, endDate } = request.userData;

    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();

    // hotelId'yi URL'den çekiyoruz
    const match = request.url.match(/\.h(\d+)\.Hotel-Information/);
    if (!match) {
        log.warning(`Hotel ID not found in URL: ${request.url}`);
        return;
    }

    const hotelId = match[1];
    const baseApiUrl = `https://www.expedia.com/api/ugc/v2/property/${hotelId}/reviews`;

    let page = 1;
    let totalFetched = 0;

    while (true) {
        const apiUrl = `${baseApiUrl}?page=${page}&size=20&language=en-us&sortType=NEWEST_FIRST`;
        log.info(`📄 Fetching page ${page}: ${apiUrl}`);

        const res = await crawler.httpClient.get({ url: apiUrl, responseType: 'json' });
        const reviews = res.body?.reviews || [];

        if (reviews.length === 0) {
            log.info('✅ No more reviews found. Exiting loop.');
            break;
        }

        for (const r of reviews) {
            const reviewTimestamp = new Date(r.reviewSubmissionTime).getTime();
            if (reviewTimestamp < startTimestamp || reviewTimestamp > endTimestamp) continue;

            await Dataset.pushData({
                review_id: r.reviewId,
                date: new Date(r.reviewSubmissionTime).toISOString(),
                hotel_name: hotelName,
                reviewer: r.reviewer?.displayName || 'Anonymous',
                score: r.ratingOverall,
                title: r.reviewTitle,
                review_text: r.reviewText,
                language: detectLanguage(r.reviewText),
                source: 'Expedia',
                accommodation_type: r.roomTypeName || null,
                response: r.response?.responseText || null,
            });

            totalFetched++;
        }

        page++;
    }

    log.info(`✅ Fetched ${totalFetched} reviews for ${hotelName}`);
});
