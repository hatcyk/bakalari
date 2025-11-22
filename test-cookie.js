require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');

const cookie = process.env.BAKALARI_COOKIE;
const url = 'https://mot-spsd.bakalari.cz/Timetable/Public/Actual/Class/ZL';

console.log('Testing Bakaláři cookie...\n');

axios.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Cookie': cookie
  }
})
.then(response => {
  const $ = cheerio.load(response.data);

  const classes = [];
  $('#selectedClass option').each((_, el) => {
    const name = $(el).text().trim();
    if (name) classes.push(name);
  });

  const teachers = [];
  $('#selectedTeacher option').each((_, el) => {
    const name = $(el).text().trim();
    if (name) teachers.push(name);
  });

  console.log(`Found ${classes.length} classes`);
  console.log(`Found ${teachers.length} teachers`);

  if (classes.length > 0) {
    console.log('\n✅ Cookie is VALID! Sample classes:');
    console.log(classes.slice(0, 5).join(', '));
  } else {
    console.log('\n❌ Cookie is EXPIRED or INVALID - No data fetched');
    console.log('You need to get a fresh cookie from your browser');
  }
})
.catch(err => {
  console.log('❌ Error:', err.message);
});
