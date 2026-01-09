// src/routes/favoriteRoutes.js

import express from 'express';
import * as favoriteController from '../controllers/favoriteController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get all favorites for current user (with optional type filter)
// Query params: ?type=pet|product|store
router.get('/', favoriteController.getFavorites);

// Get favorites count by type
router.get('/count', favoriteController.getFavoritesCount);

// Check if specific item is favorited
// Query params: ?itemType=pet|product|store&itemId=<id>
router.get('/check', favoriteController.checkFavorite);

// Add item to favorites
// Body: { itemType: 'pet|product|store', itemId: '<id>' }
router.post('/', favoriteController.addFavorite);

// Remove item from favorites
// Body: { itemType: 'pet|product|store', itemId: '<id>' }
router.delete('/', favoriteController.removeFavorite);

export default router;
