const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path'); // <--- DŮLEŽITÉ: Toto musí být nahoře
const os = require('os'); // Pro získání IP adresy
const fs = require('fs'); // Pro zápis do souborů

const app = express();
app.use(cors());

// Set proper MIME types for JavaScript modules
app.use((req, res, next) => {
    if (req.url.endsWith('.js')) {
        res.type('application/javascript');
    } else if (req.url.endsWith('.css')) {
        res.type('text/css');
    }
    next();
});

// ==================================================================
// DŮLEŽITÉ: TENTO ŘÁDEK ŘÍKÁ SERVERU "UKAŽ OBSAH SLOŽKY PUBLIC"
// ==================================================================
app.use(express.static(path.join(__dirname, 'public')));


// === TVOJE COOKIE ===
const MOJE_COOKIE = process.env.BAKALARI_COOKIE || 'cookieconsent_bak={"level":["necessary","analytics"],"revision":0,"data":null,"rfc_cookie":false}; BakaAuth=CfDJ8Gtu_52PsAtKgtiJkbpNCpbTs4iEuWwdylRC2BLRwS_ZuoB_j8LvZ21cbkFF1WfBoTa6WWb1oXVKTw49fAPji4DbBeW-GFMAIl0uC5wXnGUlDzRwedIDKL2lRv6Ad2zmab4uEgzdsHMs7jxBZIrkX5LN1wmERWXchqhhIynQm2n4iR1IQznkTYABGLmqVkkPp06R4SnsyNz61SPgfO-lyD8gH2UWNvkcSthyMQdXLCV8PttNTyL53b8NTwUgBQst_Q_-Alx4v40r5bW7UmHQ4S237Y3QT151GjqRPD-h9vBDb5FynZW209r_ZJOT9G1zVbAGS9YxeJu4LGbkq2rgTSMzO8U95zR3812Axwa4dC--PpoLZbVOU4CsFN6aUEVJJF8gmvYdeTNIzayx3II0wQZhcCj3FJgdWoV1OF9epBpGTrHwDFuxxsJLV8N3PxIoH1xiAi-giup0Ii0xdKuLAG3bIdkx_cWyKjkx9iFp_m3zAikg-aCQwNjFd2emAkennvFxTj3SZODfaUgbfXuVAaaEXz646DSgZq8T1Z3aV471SM29OUGsu3fG3lLr72--saiNSrEI2D5uMGMdWbQEuRG2F0l6SjfUsB8aIHOmdY9e648bxKdtqsUznaRVhWeMdrCd6U7rz-YulUlITcLnkbTLLNzWX9S42RnOXQzQvr8LdAXJ5GtLL7FnX_4ZGEWH922rzxyKLfV-kihhHU46fJogAiJy_wqgTu0Ilt4nqnf3grNfAiWy8GA8mcEXCIseTCI3EYzaBitbBSrpiRSSRGT5J4_a_cmaTTK0Mq8CQju6ipyp6zEfOjFuMofayppiG6KtyeDiMN0yOpsFxYKhVc7mOud3RDbR23urLXWNuR50hwd9sIhV1OxLSCrK2-mHX8rjME8AzaJtm4QD4xTJC-DW-AVKUrbQLcPeQxKmv0R8tP8wg61FCwDXT30RuFb-gxJp7gigx_k8_en15edcNko8P2urWrCSrGr1EZDp_Zce9d7YJZEuMHVFleTybW1jn3DuKeuvU7l7YipbcrwZL2Kunl1vHVsnmZOFVMyxIx2kR5ymgK4xWqRRShHH4Q7EOMVt6Bp0MtyeZRuQTwyWR3vwADd6UmAMHt28REuDWI1PcpY7Ghq01DQcP60JDYy-oA; BakaAuth_ValidationCheck=gnompnhgcbpdjehgmbfbmgedghhahcolkdffohlnmfjenoafjdjpnojl; ASP.NET_SessionId=cjfoq31v2bhgwvsa4blftfsv';

const BASE_URL_TEMPLATE = 'https://mot-spsd.bakalari.cz/Timetable/Public';
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': MOJE_COOKIE
};

// === API ENDPOINTY ===
app.get('/api/timetable', async (req, res) => {
    const { type, id, schedule, date } = req.query;
    // Schedule can be 'actual' (default), 'permanent', or 'next'
    let scheduleType = 'Actual';
    if (schedule === 'permanent') {
        scheduleType = 'Permanent';
    } else if (schedule === 'next') {
        scheduleType = 'Next';
    }

    // Build URL with optional date parameter
    let url = `${BASE_URL_TEMPLATE}/${scheduleType}/${type}/${id}`;
    if (date) {
        url += `?date=${date}`;
    }

    console.log(`[API] Fetching timetable: ${url}`);
    try {
        const response = await axios.get(url, { headers });
        const $ = cheerio.load(response.data);
        const timetable = [];
        $('.bk-timetable-row').each((rowIndex, row) => {
            const dayName = $(row).find('.bk-day-day').text().trim();
            const dayIndex = ['po', 'út', 'st', 'čt', 'pá'].indexOf(dayName.toLowerCase());
            $(row).find('.bk-timetable-cell').each((cellIndex, cell) => {
                const items = $(cell).find('.day-item-hover');
                items.each((_, item) => {
                    const detailRaw = $(item).attr('data-detail');
                    if (detailRaw) {
                        try {
                            const data = JSON.parse(detailRaw);

                            // Parse change info if exists
                            let changeInfo = null;
                            if (data.changeinfo) {
                                changeInfo = {
                                    raw: data.changeinfo,
                                    description: data.changeinfo
                                };
                            }

                            // Parse subject - handle removed/absent lessons specially
                            let subject = "";
                            let teacher = data.teacher || "";
                            let finalChangeInfo = changeInfo;

                            if (data.type === "removed" && data.removedinfo) {
                                // Parse removedinfo: "Vyjmuto z rozvrhu (PŘEDMĚT, UČITEL)" nebo "Zrušeno (PŘEDMĚT, UČITEL)"
                                const match = data.removedinfo.match(/\(([^,]+),\s*([^)]+)\)/);
                                if (match) {
                                    subject = match[1].trim();  // Předmět (např. "TV")
                                    teacher = match[2].trim();  // Učitel (např. "Navrátilová Jana")
                                } else {
                                    // Fallback pokud formát neodpovídá
                                    subject = data.subjecttext ? data.subjecttext.split('|')[0].trim() : "";
                                }

                                // Přidat do changeInfo pro zobrazení v modálním okně
                                finalChangeInfo = {
                                    raw: data.removedinfo,
                                    description: data.removedinfo
                                };
                            } else if (data.type === "absent" && data.InfoAbsentName) {
                                // Pro absent hodiny použít InfoAbsentName jako subject
                                subject = data.InfoAbsentName;  // např. "přednáška"

                                // Přidat absentinfo do changeInfo
                                finalChangeInfo = {
                                    raw: data.absentinfo || "Absence",
                                    description: data.absentinfo ? `${data.InfoAbsentName} (${data.absentinfo})` : data.InfoAbsentName
                                };
                            } else {
                                // Normální hodiny - původní logika
                                subject = data.subjecttext ? data.subjecttext.split('|')[0].trim() : "";
                            }

                            const lessonData = {
                                day: dayIndex,
                                dayName: dayName,
                                hour: cellIndex,
                                subject: subject,
                                teacher: teacher,
                                room: data.room,
                                group: data.group,
                                theme: data.theme,
                                type: data.type,
                                changed: !!(finalChangeInfo),
                                changeInfo: finalChangeInfo,
                                // DEBUG: Přidáme všechna surová data pro debugging
                                _rawData: data
                            };

                            timetable.push(lessonData);
                        } catch (e) { }
                    }
                });
            });
        });

        // DEBUG: Uložit všechna data do YAML souboru
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
        const filename = `debug_${type}_${id}_${scheduleType}_${timestamp}.yaml`;
        const debugDir = path.join(__dirname, 'debug_output');

        // Vytvořit debug složku, pokud neexistuje
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir);
        }

        const filepath = path.join(debugDir, filename);

        let yamlContent = `# DEBUG: TIMETABLE DATA\n`;
        yamlContent += `# Type: ${type}\n`;
        yamlContent += `# ID: ${id}\n`;
        yamlContent += `# Schedule: ${scheduleType}\n`;
        yamlContent += `# Date: ${date || 'N/A'}\n`;
        yamlContent += `# Timestamp: ${new Date().toISOString()}\n`;
        yamlContent += `# Total lessons: ${timetable.length}\n\n`;
        yamlContent += `lessons:\n`;

        timetable.forEach((lesson, index) => {
            yamlContent += `  - lesson_number: ${index + 1}\n`;
            yamlContent += `    day: ${lesson.day}\n`;
            yamlContent += `    dayName: "${lesson.dayName}"\n`;
            yamlContent += `    hour: ${lesson.hour}\n`;
            yamlContent += `    subject: "${lesson.subject}"\n`;
            yamlContent += `    teacher: "${lesson.teacher || ''}"\n`;
            yamlContent += `    room: "${lesson.room || ''}"\n`;
            yamlContent += `    group: "${lesson.group || ''}"\n`;
            yamlContent += `    theme: "${lesson.theme || ''}"\n`;
            yamlContent += `    type: "${lesson.type || ''}"\n`;
            yamlContent += `    changed: ${lesson.changed}\n`;

            if (lesson.changeInfo) {
                yamlContent += `    changeInfo:\n`;
                yamlContent += `      raw: "${lesson.changeInfo.raw}"\n`;
                yamlContent += `      description: "${lesson.changeInfo.description}"\n`;
            }

            yamlContent += `    rawData:\n`;
            for (const [key, value] of Object.entries(lesson._rawData)) {
                const safeValue = String(value || '').replace(/"/g, '\\"');
                yamlContent += `      ${key}: "${safeValue}"\n`;
            }
            yamlContent += `\n`;
        });

        fs.writeFileSync(filepath, yamlContent, 'utf8');
        console.log(`\n✅ DEBUG: Data uložena do souboru: ${filepath}\n`);

        res.json(timetable);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/definitions', async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL_TEMPLATE}/Actual/Class/ZL`, { headers });
        const $ = cheerio.load(response.data);
        const data = { classes: [], teachers: [], rooms: [] };

        // Classes
        $('#selectedClass option').each((_, el) => {
            const id = $(el).val();
            const name = $(el).text().trim();
            if (id && name) {
                data.classes.push({ id, name });
            }
        });

        // Teachers - use name as ID if value is empty
        $('#selectedTeacher option').each((_, el) => {
            let id = $(el).val();
            const name = $(el).text().trim();

            // If ID is empty but name exists, use name as ID
            if ((!id || id.trim() === '') && name) {
                id = name;
            }

            if (id && name) {
                data.teachers.push({ id, name });
            }
        });

        // Rooms
        $('#selectedRoom option').each((_, el) => {
            const id = $(el).val();
            const name = $(el).text().trim();
            if (id && name) {
                data.rooms.push({ id, name });
            }
        });

        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Funkce pro získání lokální IP adresy
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Přeskočit interní (localhost) a non-IPv4 adresy
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'IP nenalezena';
}

const PORT = 3000;
const HOST = '0.0.0.0'; // Naslouchá na všech síťových rozhraních
app.listen(PORT, HOST, () => {
    const localIP = getLocalIP();
    console.log(`🤖 Web běží na:`);
    console.log(`   - Lokálně: http://localhost:${PORT}`);
    console.log(`   - V síti:  http://${localIP}:${PORT}`);
});