const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(__dirname));

// MySQL connection
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Root route
app.get('/', (req, res) => {
    res.send(`
        <h1>EcoLearn Server Running 🚀</h1>
        <p>Port: ${port}</p>
        <a href="/api/test-db">Test DB</a>
    `);
});

// Test DB
app.get('/api/test-db', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT 1 + 1 AS solution');
        connection.release();
        res.json({ success: true, result: rows[0].solution });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user data
app.get('/api/user/data', async (req, res) => {
    const { uid } = req.query;

    try {
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE uid = ?',
            [uid]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];

        const [activities] = await pool.execute(
            'SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
            [user.id]
        );

        const [badges] = await pool.execute(
            'SELECT * FROM badges WHERE user_id = ? ORDER BY created_at DESC LIMIT 3',
            [user.id]
        );

        const userData = {
            points: user.points,
            level: user.level,
            streak: user.streak,
            activities,
            badges
        };

        res.json(userData);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create user
app.post('/api/user/create', async (req, res) => {
    const { uid, email, displayName, photoURL } = req.body;

    try {
        const [result] = await pool.execute(
            'INSERT INTO users (uid, email, display_name, photo_url) VALUES (?, ?, ?, ?)',
            [uid, email, displayName, photoURL]
        );

        res.json({ success: true, id: result.insertId });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update points
app.post('/api/user/update-points', async (req, res) => {
    const { uid, points } = req.body;

    try {
        await pool.execute(
            'UPDATE users SET points = points + ? WHERE uid = ?',
            [points, uid]
        );

        res.json({ success: true });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =======================
// 🤖 GEMINI AI CHAT API
// =======================
app.post("/api/chat", async (req, res) => {
    const userMessage = req.body.message;
    const API_KEY = process.env.GEMINI_API_KEY;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: userMessage }]
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        console.log("Gemini response:", data);

        if (!data.candidates) {
            return res.json({ reply: "API error aa gaya 😢" });
        }

        const reply = data.candidates[0].content.parts[0].text;

        res.json({ reply });

    } catch (error) {
        console.error("ERROR:", error);
        res.json({ reply: "AI error aa gaya 😢" });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});