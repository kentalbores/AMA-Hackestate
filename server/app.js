require("dotenv").config();
const express = require('express');
const cors = require('cors');
const propertiesRouter = require('./routes/properties');
const usersRouter = require('./routes/users');
const authRoutes = require('./routes/auth');
const contractsRouter = require('./routes/contracts');
const agentsRouter = require('./routes/agents');
const buyersRouter = require('./routes/buyers');
const adminRouter = require('./routes/admin');
const notificationsRouter = require('./routes/notifications');
const inquiriesRouter = require('./routes/inquiries');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/contracts_files', express.static('server/contracts_files'));

// Routes
app.use('/api/properties', propertiesRouter);
app.use('/api/users', usersRouter);
app.use('/api/auth', authRoutes);
app.use('/api/contracts', contractsRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/buyers', buyersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/inquiries', inquiriesRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

module.exports = app;
