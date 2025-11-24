/**
 * Timetable Routes
 * Handles timetable fetching and definitions
 */

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const router = express.Router();

// Get cookie and base URL from environment
const MOJE_COOKIE = process.env.BAKALARI_COOKIE;
const BASE_URL_TEMPLATE = 'https://mot-spsd.bakalari.cz/Timetable/Public';
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Cookie': MOJE_COOKIE
};

// Get timetable data
router.get('/timetable', async (req, res) => {
    const { type, id, schedule, date } = req.query;

    let scheduleType = 'Actual';
    if (schedule === 'permanent') {
        scheduleType = 'Permanent';
    } else if (schedule === 'next') {
        scheduleType = 'Next';
    }

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

                            let changeInfo = null;
                            if (data.changeinfo) {
                                changeInfo = {
                                    raw: data.changeinfo,
                                    description: data.changeinfo
                                };
                            }

                            let subject = "";
                            let teacher = data.teacher || "";
                            let finalChangeInfo = changeInfo;

                            if (data.type === "removed" && data.removedinfo) {
                                const match = data.removedinfo.match(/\(([^,]+),\s*([^)]+)\)/);
                                if (match) {
                                    subject = match[1].trim();
                                    teacher = match[2].trim();
                                } else {
                                    subject = data.subjecttext ? data.subjecttext.split('|')[0].trim() : "";
                                }

                                finalChangeInfo = {
                                    raw: data.removedinfo,
                                    description: data.removedinfo
                                };
                            } else if (data.type === "absent" && data.InfoAbsentName) {
                                subject = data.InfoAbsentName;
                                if (subject && subject.length > 0) {
                                    subject = subject.charAt(0).toUpperCase() + subject.slice(1);
                                }

                                finalChangeInfo = {
                                    raw: data.absentinfo || "Absence",
                                    description: data.absentinfo ? `${data.InfoAbsentName} (${data.absentinfo})` : data.InfoAbsentName
                                };
                            } else {
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
                                _rawData: data
                            };

                            timetable.push(lessonData);
                        } catch (e) { }
                    }
                });
            });
        });

        res.json(timetable);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get definitions (classes, teachers, rooms)
router.get('/definitions', async (req, res) => {
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

        // Teachers
        $('#selectedTeacher option').each((_, el) => {
            let id = $(el).val();
            const name = $(el).text().trim();

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

module.exports = router;
