import { scrape } from '../src/services/scraper.service.js';
import { pgPool } from '../src/db/connection.js';

async function run() {
  try {
    const shouldTruncate = process.argv.includes('--truncate') || process.env.TRUNCATE_COURSES === 'true';

    if (shouldTruncate) {
      console.log("Truncating 'courses' table (only courses table)...");
      await pgPool.query('TRUNCATE TABLE courses;');
      console.log("✓ 'courses' table truncated successfully.");
    }

    console.log("=== Starting Unified Scraper (SWAYAM -> Skill India -> MIT) ===");
    console.log("Fetching live data from SWAYAM, Skill India Digital, and MIT OCW in order...");

    const stats = await scrape({
      sources: ['swayam', 'skill_india', 'mit'],
      swayamLimit: Infinity,
      skillIndiaLimit: Infinity,
      mitLimit: Infinity,
      mitDepartment: 'all',
    });

    console.log("\n=== Scraping and Ingestion Summary ===");
    console.log(`✓ SWAYAM courses processed & saved: ${stats.swayam.length}`);
    console.log(`✓ Skill India Digital sectors & courses saved: ${stats.skillIndia.length}`);
    console.log(`✓ MIT OCW courses processed & saved: ${stats.mit.length}`);
    console.log(`✓ Total new records indexed into database: ${stats.total}`);
  } catch (e) {
    console.error("Scraper failed with error:", e);
    process.exitCode = 1;
  } finally {
    await pgPool.end();
  }
}

run();

