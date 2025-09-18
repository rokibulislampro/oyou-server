const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const port = process.env.PORT || 5000;

// CORS Configuration
const corsOptions = {
  origin: ['https://oyou-client.vercel.app', 'http://localhost:3000'],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@oyou.oxi6mqt.mongodb.net/?retryWrites=true&w=majority&appName=Oyou`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const userCollection = client.db('oyouworld').collection('user');
    const viewCollection = client.db('oyouworld').collection('view');
    const searchCollection = client.db('oyouworld').collection('search');

    // JWT API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h',
      });
      res.send({ token });
    });

    // Middleware to verify token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Forbidden access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
      });
    };

    // Middleware to verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await userCollection.findOne({ email });
      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    };

    // Admin API
    app.get(
      '/user/admin/:email',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'Unauthorized access' });
        }

        const user = await userCollection.findOne({ email });
        const admin = user?.role === 'admin';
        res.send({ admin });
      }
    );

    // User APIs
    app.get('/user', verifyToken, async (req, res) => {
      const user = await userCollection.find().toArray();
      res.send(user);
    });

    // Get a single user by ID
    app.get('/user/:id', async (req, res) => {
      const id = req.params.id;
      const user = await userCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(user);
    });

    app.get('/user/email/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email });
      res.send(user);
    });

    // Create a new user
    app.post('/user', async (req, res) => {
      const newUser = req.body;
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    // Delete a user
    app.delete('/user/:id', async (req, res) => {
      const id = req.params.id;
      const result = await userCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Google Search API Route
    // Corrected version
    app.get('/search', async (req, res) => {
      const query = req.query.q;
      if (!query) {
        return res.status(400).json({ error: 'Query parameter missing' });
      }

      try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${
          process.env.GOOGLE_API_KEY
        }&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}`;

        const response = await fetch(url);
        const data = await response.json();

        const results = (data.items || []).map(item => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          displayLink: item.displayLink,
          image: item.pagemap?.cse_image?.[0]?.src || null,
        }));

        res.json(results); // শুধু results array পাঠাচ্ছি
      } catch (error) {
        console.error('Search API error:', error);
        res.status(500).json({ error: 'Failed to fetch search results' });
      }
    });

    // Order APIs
    app.get('/view', async (req, res) => {
      const view = await viewCollection.find().toArray();
      res.send(view);
    });

    app.get('/view/:email', async (req, res) => {
      const email = req.params.email;
      const view = await viewCollection.find({ email }).toArray();
      res.send(view);
    });

    app.post('/view', async (req, res) => {
      const viewData = req.body;
      const result = await viewCollection.insertOne(viewData);
      res.send(result);
    });

    app.delete('/view/:id', async (req, res) => {
      const id = req.params.id;
      const result = await viewCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Ping MongoDB
    // await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Uncomment the following line if you want to close the connection after every request
    // await client.close();
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Oyou server is running');
});

app.listen(port, () => console.log(`Server running on port ${port}`));
