const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

// === TVOJE COOKIE (Zkopíruj sem tu funkční z prohlížeče) ===
// Pokud je nastavená proměnná prostředí (na Renderu), použij ji.
// Jinak použij tu natvrdo napsanou (pro lokální testování).
const MOJE_COOKIE = process.env.BAKALARI_COOKIE || 'SEM_DEJ_TU_TVOJI_COOKIE_PRO_LOKALNI_TEST';

const BASE_URL = 'https://mot-spsd.bakalari.cz/Timetable/Public/Actual';

const log = (msg) => console.log(`\x1b[36m[${new Date().toLocaleTimeString()}]\x1b[0m ${msg}`);

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': MOJE_COOKIE
};

app.get('/api/timetable', async (req, res) => {
    const { type, id } = req.query; 
    const url = `${BASE_URL}/${type}/${id}`;
    log(`📥 Stahuji: ${url}`);

    try {
        const response = await axios.get(url, { headers });
        const $ = cheerio.load(response.data);
        
        const timetable = [];

        // 1. Projdeme všechny řádky (Dny)
        $('.bk-timetable-row').each((rowIndex, row) => {
            // Zjistíme, jaký je to den (Po, Út...)
            const dayName = $(row).find('.bk-day-day').text().trim();
            const dayIndex = ['po', 'út', 'st', 'čt', 'pá'].indexOf(dayName.toLowerCase());

            // 2. Projdeme všechny buňky v řádku (Hodiny)
            $(row).find('.bk-timetable-cell').each((cellIndex, cell) => {
                // cellIndex odpovídá vyučovací hodině (0, 1, 2...)
                
                // 3. Uvnitř buňky hledáme konkrétní lístky s předměty (.day-item-hover)
                const items = $(cell).find('.day-item-hover');
                
                items.each((_, item) => {
                    const detailRaw = $(item).attr('data-detail');
                    if (detailRaw) {
                        try {
                            const data = JSON.parse(detailRaw);
                            
                            // Přidáme do výsledku a doplníme souřadnice (den, hodina)
                            timetable.push({
                                day: dayIndex,       // 0 = Pondělí
                                dayName: dayName,    // "po"
                                hour: cellIndex,     // 0, 1, 2...
                                subject: data.subjecttext ? data.subjecttext.split('|')[0].trim() : "", // Očistíme název
                                teacher: data.teacher,
                                room: data.room,
                                group: data.group,
                                theme: data.theme,
                                type: data.type,      // "atom", "removed" atd.
                                changed: !!data.changeinfo // true/false jestli je změna
                            });
                        } catch (e) {
                            console.error("Chyba parsování JSONu v buňce");
                        }
                    }
                });
            });
        });

        log(`✅ ÚSPĚCH! Staženo ${timetable.length} položek rozvrhu.`);
        res.json(timetable);

    } catch (error) {
        log('❌ Chyba: ' + error.message);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint pro seznamy tříd/učitelů (ten fungoval už předtím)
app.get('/api/definitions', async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL}/Class/ZL`, { headers });
        const $ = cheerio.load(response.data);
        const data = { classes: [], teachers: [], rooms: [] };

        $('#selectedClass option').each((_, el) => data.classes.push({ id: $(el).val(), name: $(el).text().trim() }));
        $('#selectedTeacher option').each((_, el) => data.teachers.push({ id: $(el).val(), name: $(el).text().trim() }));
        $('#selectedRoom option').each((_, el) => data.rooms.push({ id: $(el).val(), name: $(el).text().trim() }));

        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    log(`🤖 Server běží na http://localhost:${PORT}`);
    log('⚡ Testuji...');
    axios.get(`http://localhost:${PORT}/api/timetable?type=Class&id=ZL`)
        .then(r => log(`✅ TEST OK: Našlo se ${r.data.length} hodin.`))
        .catch(e => log(`❌ TEST SELHAL.`));
});