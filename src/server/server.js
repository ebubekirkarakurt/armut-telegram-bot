import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/api/serviceProviders', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:3000/serviceCategories');
    const serviceData = response.data;

    // Örnek: sadece provider isimlerini listele (veya tüm datayı döndür)
    const simplified = serviceData.flatMap(category =>
      category.providers.map(provider => ({
        name: provider.fullName,
        rating: provider.rating,
        category: category.categoryName,
        location: provider.location,
        available: provider.availability,
        reservedTime: provider.reservedTime,
      }))
    );

    res.json({ providers: simplified });
  } catch (error) {
    console.error('Service fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch service providers' });
  }
});

// Server
app.listen(3001, () => console.log('Server running on http://localhost:3001'));
