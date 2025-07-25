require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  path: '/prodash/socket.io'
});

app.use('/prodash', express.static(__dirname + '/public'));
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error('MySQL connection error: ', err);
    process.exit(1);
  }
  console.log('Connected to MySQL database.');
});

// Helper: get the dashboard state (assumes a single-row table)
function getDashboardState(callback) {
  const query = 'SELECT * FROM prodash_state LIMIT 1';
  db.query(query, (err, results) => {
    if (err) return callback(err);
    if (results.length > 0) {
      callback(null, results[0]);
    } else {
      // If no state exists, initialize one
      const initState = {
        id: 1,
        modes: JSON.stringify(['Rest', 'Break', 'Light Work', 'Deep Focus']),
        targets: JSON.stringify(['Client A', 'Project B', 'Subject C']),
        modeColors: JSON.stringify(['#f0ad4e', '#5bc0de', '#0275d8', '#5cb85c']),
        targetColors: JSON.stringify(['#5cb85c', '#5bc0de', '#f0ad4e']),
        modeActiveStates: JSON.stringify([false, false, true, true]),
        modeTimes: JSON.stringify([0, 0, 0, 0]),
        modeMusicStates: JSON.stringify([false, false, false, false]),
        currentModeIndex: 3,
        currentTargetIndex: -1,
        timerEndTime: null,
        pausedTimeRemaining: null,
      };

      const insertQuery = `
        INSERT INTO prodash_state SET ?
        ON DUPLICATE KEY UPDATE
          modes = VALUES(modes),
          targets = VALUES(targets),
          modeColors = VALUES(modeColors),
          targetColors = VALUES(targetColors),
          modeActiveStates = VALUES(modeActiveStates),
          modeTimes = VALUES(modeTimes),
          modeMusicStates = VALUES(modeMusicStates),
          currentModeIndex = VALUES(currentModeIndex),
          currentTargetIndex = VALUES(currentTargetIndex),
          timerEndTime = VALUES(timerEndTime),
          pausedTimeRemaining = VALUES(pausedTimeRemaining)
      `;
      
      db.query(insertQuery, initState, (err, result) => {
        if (err) return callback(err);
        callback(null, initState);
      });
    }
  });
}

// API endpoint to get the dashboard state
app.get('/prodash/getState', (req, res) => {
  getDashboardState((err, state) => {
    if (err) {
      console.error('Error fetching state:', err);
      return res.status(500).json({ error: 'Database fetch error' });
    }
    res.json(state);
  });
});

// API endpoint to update the dashboard state.
// The client sends a complete state JSON, including the "id" field.
app.post('/prodash/updateState', (req, res) => {
  const newState = req.body;
  const updateQuery = 'UPDATE prodash_state SET ? WHERE id = ?';
  db.query(updateQuery, [newState, newState.id], (err, result) => {
    if (err) {
      console.error('Error updating state:', err);
      return res.status(500).json({ error: 'Database update error' });
    }
    // Broadcast the updated state to all connected clients
    io.emit('prodash/stateUpdated', newState);
    res.json({ success: true });
  });
});

// When a client connects, send the current state
io.on('connection', (socket) => {
  console.log('A user connected');
  getDashboardState((err, state) => {
    if (!err) {
      socket.emit('prodash/stateUpdated', state);
    }
  });
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
