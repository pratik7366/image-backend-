// server.js
const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
require('dotenv').config();

const User = require('./models/User'); // ✅ Imported user model

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// ✅ Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log('📁 uploads folder created');
}

// ✅ Connect to MongoDB Atlas
mongoose.connect(
  process.env.MONGO_URI
).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ✅ MongoDB Schema for Image
const imageSchema = new mongoose.Schema({
  code: String,
  filename: String,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // auto-delete after 24 hours
  }
});
const Image = mongoose.model('Image', imageSchema);

// ✅ Multer Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ✅ Upload Route
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const code = uuidv4().slice(0, 8);
    const newEntry = new Image({ code, filename: file.filename });
    await newEntry.save();

    res.json({ code });
  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({ error: 'Upload failed due to server error' });
  }
});

// ✅ Download Route
app.get('/download/:code', async (req, res) => {
  try {
    const image = await Image.findOne({ code: req.params.code });
    if (!image) return res.status(404).send('Invalid or expired code');

    const filePath = path.join(__dirname, 'uploads', image.filename);
    if (!fs.existsSync(filePath)) {
      await Image.deleteOne({ code: req.params.code });
      return res.status(404).send('Image expired or missing');
    }

    res.download(filePath);
  } catch (err) {
    console.error('Download Error:', err);
    res.status(500).send('Server error');
  }
});

// ✅ Signup Route
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ token: uuidv4() });
  } catch (err) {
    console.error('Signup Error:', err);
    res.status(500).json({ message: 'Signup failed' });
  }
});

// ✅ Login Route
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    res.json({ token: uuidv4() });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
