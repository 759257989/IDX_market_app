const express = require('express');
const cors = require('cors');
require('dotenv').config();
const propertiesRouter = require('./routes/properties');
const requestLogger = require('./middleware/requestLogger');
const pool = require('./db');

const app = express();

app.use(cors());
app.use(express.json());
// Logger Middleware
app.use(requestLogger);
// Routes
app.use('/api/properties', propertiesRouter);  
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});