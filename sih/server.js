const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the current directory
app.use(express.static(__dirname));

// MySQL connection pool
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
        <!DOCTYPE html>
        <html>
        <head>
            <title>EcoLearn Server</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
                h1 { color: #2e7d32; }
                .links { margin-top: 30px; }
                a { display: inline-block; margin: 10px; padding: 10px 20px; background: #2e7d32; color: white; text-decoration: none; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>EcoLearn Server is Running!</h1>
            <p>Your MySQL backend server is successfully running on port ${port}.</p>
            
            <div class="links">
                <a href="/test">Test API Endpoints</a>
                <a href="/api/test-db">Test Database Connection</a>
            </div>
            
            <div style="margin-top: 40px;">
                <h3>Next Steps:</h3>
                <p>1. Make sure your frontend HTML file is in the same directory as server.js</p>
                <p>2. Update your frontend fetch calls to use http://localhost:3000/api/...</p>
                <p>3. Test the API endpoints using the links above</p>
            </div>
        </body>
        </html>
    `);
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT 1 + 1 AS solution');
        connection.release();
        
        res.json({ 
            success: true, 
            message: 'Database connection successful',
            result: rows[0].solution 
        });
    } catch (error) {
        console.error('Database connection error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Database connection failed',
            error: error.message 
        });
    }
});

// API Routes

// Get user data
app.get('/api/user/data', async (req, res) => {
    const { uid } = req.query;
    
    try {
        // Get user basic info
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE uid = ?',
            [uid]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = users[0];
        
        // Get user activities
        const [activities] = await pool.execute(
            'SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
            [user.id]
        );
        
        // Get user badges
        const [badges] = await pool.execute(
            'SELECT * FROM badges WHERE user_id = ? ORDER BY created_at DESC LIMIT 3',
            [user.id]
        );
        
        // Get weekly progress (current week)
        const currentDate = new Date();
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + (currentDate.getDay() === 0 ? -6 : 1));
        
        const [weeklyProgress] = await pool.execute(
            'SELECT * FROM weekly_progress WHERE user_id = ? AND week_start = ?',
            [user.id, startOfWeek.toISOString().split('T')[0]]
        );
        
        let progressData = [0, 0, 0, 0, 0, 0, 0];
        
        if (weeklyProgress.length > 0) {
            const progress = weeklyProgress[0];
            progressData = [
                progress.monday,
                progress.tuesday,
                progress.wednesday,
                progress.thursday,
                progress.friday,
                progress.saturday,
                progress.sunday
            ];
        }
        
        // Prepare response
        const userData = {
            points: user.points,
            level: user.level,
            streak: user.streak,
            completedChallenges: user.completed_challenges,
            badges: user.badges,
            treesPlanted: user.trees_planted,
            learningTime: user.learning_time,
            activities: activities,
            badges: badges,
            weeklyProgress: progressData
        };
        
        res.json(userData);
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new user
app.post('/api/user/create', async (req, res) => {
    const { uid, email, displayName, photoURL } = req.body;
    
    try {
        const [result] = await pool.execute(
            'INSERT INTO users (uid, email, display_name, photo_url) VALUES (?, ?, ?, ?)',
            [uid, email, displayName, photoURL]
        );
        
        res.json({ success: true, userId: result.insertId });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user points
app.post('/api/user/update-points', async (req, res) => {
    const { uid, points, activity } = req.body;
    
    try {
        // Start transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            // Update user points
            await connection.execute(
                'UPDATE users SET points = points + ? WHERE uid = ?',
                [points, uid]
            );
            
            // Add activity
            if (activity) {
                const [user] = await connection.execute(
                    'SELECT id FROM users WHERE uid = ?',
                    [uid]
                );
                
                if (user.length > 0) {
                    await connection.execute(
                        'INSERT INTO activities (user_id, type, title, description, icon, time) VALUES (?, ?, ?, ?, ?, ?)',
                        [user[0].id, activity.type, activity.title, activity.description, 'fa-gamepad', activity.time]
                    );
                }
            }
            
            // Update weekly progress
            const currentDate = new Date();
            const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
            
            if (dayOfWeek > 0) { // Skip Sunday (0) if your week starts on Monday
                const startOfWeek = new Date(currentDate);
                startOfWeek.setDate(currentDate.getDate() - dayOfWeek + 1); // Set to Monday of this week
                
                const weekStartStr = startOfWeek.toISOString().split('T')[0];
                const dayColumn = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek - 1];
                
                const [user] = await connection.execute(
                    'SELECT id FROM users WHERE uid = ?',
                    [uid]
                );
                
                if (user.length > 0) {
                    // Check if weekly progress record exists
                    const [weeklyProgress] = await connection.execute(
                        'SELECT id FROM weekly_progress WHERE user_id = ? AND week_start = ?',
                        [user[0].id, weekStartStr]
                    );
                    
                    if (weeklyProgress.length > 0) {
                        // Update existing record
                        await connection.execute(
                            `UPDATE weekly_progress SET ${dayColumn} = ${dayColumn} + ? WHERE user_id = ? AND week_start = ?`,
                            [points, user[0].id, weekStartStr]
                        );
                    } else {
                        // Create new record
                        await connection.execute(
                            `INSERT INTO weekly_progress (user_id, ${dayColumn}, week_start) VALUES (?, ?, ?)`,
                            [user[0].id, points, weekStartStr]
                        );
                    }
                }
            }
            
            await connection.commit();
            connection.release();
            
            res.json({ success: true });
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error) {
        console.error('Error updating points:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve test page
app.get('/test', (req, res) => {
    res.sendFile(__dirname + '/test.html');
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Visit http://localhost:${port} to check if it's working`);
});

