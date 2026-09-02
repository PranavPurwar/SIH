import { scrapeMitOcwCourses } from '../src/services/scraper.service.js';
import { pgPool } from '../src/db/connection.js';

async function run() {
  try {
    console.log("Starting full scraper...");
    const stats = await scrapeMitOcwCourses({ limit: 3000, department: 'all' });
    console.log(`Scrape finished. Total courses embedded and saved: ${stats.length}`);
  } catch (e) {
    console.error("Scraper failed:", e);
  } finally {
    await pgPool.end();
  }
}
run();
