require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  path: '/prodash/socket.io'
});

app.use('/prodash', express.static(__dirname + '/public'));
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/prodash';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB database.'))
  .catch(err => {
    console.error('MongoDB connection error: ', err);
    process.exit(1);
  });

// Define the Mongoose schema and model
const dashboardStateSchema = new mongoose.Schema({
  modes: [String],
  targets: [String],
  modeColors: [String],
  targetColors: [String],
  modeActiveStates: [Boolean],
  modeTimes: [Number],
  modeMusicStates: [Boolean],
  currentModeIndex: { type: Number, default: 3 },
  currentTargetIndex: { type: Number, default: -1 },
  timerEndTime: { type: Number, default: null },
  pausedTimeRemaining: { type: Number, default: null }
});

const DashboardState = mongoose.model('DashboardState', dashboardStateSchema);

// Helper: get the dashboard state
async function getDashboardState(callback) {
  try {
    let state = await DashboardState.findOne();
    
    if (!state) {
      // If no state exists, initialize one
      state = new DashboardState({
        modes: ['Rest', 'Break', 'Light Work', 'Deep Focus'],
        targets: ['Client A', 'Project B', 'Subject C'],
        modeColors: ['#f0ad4e', '#5bc0de', '#0275d8', '#5cb85c'],
        targetColors: ['#5cb85c', '#5bc0de', '#f0ad4e'],
        modeActiveStates: [false, false, true, true],
        modeTimes: [0, 0, 0, 0],
        modeMusicStates: [false, false, false, false],
        currentModeIndex: 3,
        currentTargetIndex: -1,
        timerEndTime: null,
        pausedTimeRemaining: null
      });
      await state.save();
    }
    
    callback(null, state);
  } catch (err) {
    callback(err);
  }
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
app.post('/prodash/updateState', async (req, res) => {
  try {
    const newState = req.body;
    let state = await DashboardState.findOne();
    
    if (!state) {
      state = new DashboardState(newState);
    } else {
      Object.assign(state, newState);
    }
    
    await state.save();
    
    // Broadcast the updated state to all connected clients
    io.emit('prodash/stateUpdated', state);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating state:', err);
    res.status(500).json({ error: 'Database update error' });
  }
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
