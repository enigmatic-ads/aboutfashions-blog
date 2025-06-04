const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 4000;

// Path to posts.json
const POSTS_FILE = path.join(__dirname, 'public', 'posts.json');
const SECRET = 'your_jwt_secret';
const USERS_FILE = './users.json';

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// Serve index.html on root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Get all blog posts
app.get('/posts', (req, res) => {
  try {
    const data = fs.readFileSync(POSTS_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read posts file.' });
  }
});

// Add a new blog post
app.post('/add-post', checkAuth, (req, res) => {
  try {
    const data = fs.readFileSync(POSTS_FILE, 'utf-8');
    const posts = JSON.parse(data);
    const newPost = {
      id: (parseInt(posts[posts.length - 1]?.id || '0') + 1).toString(), 
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      }), 
      ...req.body,
    };

    posts.push(newPost);
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
    res.json({ status: 'success', id: newPost.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save post.' });
  }
});

app.put('/api/blogs/:id', checkAuth, (req, res) => {
  try {
  const blogId = parseInt(req.params.id, 10);
  const updatedBlog = req.body;

  const data = fs.readFileSync(POSTS_FILE, 'utf-8');
    const posts = JSON.parse(data);
    const index = posts.findIndex(p => p.id == blogId);

    if (index === -1) return res.status(404).send('Blog not found');

    posts[index] = updatedBlog;

    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
    res.json({ status: 'success', id: updatedBlog.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save post.' });
  }
});

app.delete('/api/blogs/:id', checkAuth, (req, res) => {
  try {
    const blogId = parseInt(req.params.id, 10);

    const data = fs.readFileSync(POSTS_FILE, 'utf-8');
    const posts = JSON.parse(data);

    const index = posts.findIndex(post => post.id == blogId);
    if (index === -1) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    posts.splice(index, 1); // Remove the blog
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));

    res.json({ status: 'success', message: `Blog with ID ${blogId} deleted.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete blog.' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  bcrypt.compare(password, user.password, (err, result) => {
    if (!result) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '2h' });
    res.json({ token });
  });
});

const tokenBlacklist = new Set();

app.post('/api/logout', checkAuth, (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'No token provided' });

  if(isTokenBlacklisted(token)) {
    return res.status(403).json({ message: 'Token is already blacklisted' });
  }

  tokenBlacklist.add(token); // Blacklist the token
  res.json({ message: 'Logged out successfully' });
});

// Middleware to check if token is blacklisted
function isTokenBlacklisted(token) {
  return tokenBlacklist.has(token);
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});