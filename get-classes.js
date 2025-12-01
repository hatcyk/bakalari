const axios = require('axios');
const cheerio = require('cheerio');

const COOKIE = process.env.BAKALARI_COOKIE;
if (!COOKIE) {
  console.log('⚠️ BAKALARI_COOKIE not set');
  process.exit(1);
}

const url = 'https://mot-spsd.bakalari.cz/Timetable/Public/Actual/Class/ZD';
axios.get(url, {
  headers: {
    'Cookie': COOKIE,
    'User-Agent': 'Mozilla/5.0'
  },
  timeout: 10000
}).then(res => {
  const $ = cheerio.load(res.data);
  console.log('📋 Dostupné třídy v Bakalářích:');
  $('#selectedClass option').each((i, el) => {
    const id = $(el).val();
    const name = $(el).text().trim();
    if (id && name && id !== '') {
      console.log(`  ${id} - ${name}`);
    }
  });
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
