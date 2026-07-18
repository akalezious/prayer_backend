const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors()); // lets your Flutter app call this from a different origin/device
const PORT = process.env.PORT || 3000;

const db = new Database('./prayers.db');

// Create the table if it doesn't already exist
db.exec(`
  CREATE TABLE IF NOT EXISTS prayer_times (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city TEXT,
    date TEXT,
    fajr TEXT,
    dhuhr TEXT,
    asr TEXT,
    maghrib TEXT,
    isha TEXT,
    UNIQUE(city, date)
  )
`);

async function fetchFromAladhan(city, country, date) {
  const url = `https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}&date=${date}&method=2`;
  const response = await fetch(url);
  const data = await response.json();
  const timings = data.data.timings;
  return {
    fajr: timings.Fajr,
    dhuhr: timings.Dhuhr,
    asr: timings.Asr,
    maghrib: timings.Maghrib,
    isha: timings.Isha
  };
}

app.get('/api/prayer-times', async (req, res) => {
  const { city, country, date } = req.query;

  try {
    // Step A: check if we already have it saved
    const existing = db
      .prepare(`SELECT * FROM prayer_times WHERE city = ? AND date = ?`)
      .get(city, date);

    if (existing) {
      return res.json(existing); // already cached — return immediately
    }

    // Step B: not found, so fetch from Aladhan and save it
    const times = await fetchFromAladhan(city, country, date);

    db.prepare(
      `INSERT INTO prayer_times (city, date, fajr, dhuhr, asr, maghrib, isha)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(city, date, times.fajr, times.dhuhr, times.asr, times.maghrib, times.isha);

    res.json({ city, date, ...times });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not fetch prayer times' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});