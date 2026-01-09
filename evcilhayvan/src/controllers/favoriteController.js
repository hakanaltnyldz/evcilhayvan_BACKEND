// src/controllers/favoriteController.js

import Favorite from '../models/Favorite.js';
import Pet from '../models/Pet.js';
import Product from '../models/Product.js';
import Store from '../models/Store.js';

// Get all favorites for the current user
export const getFavorites = async (req, res) => {
  try {
    const { type } = req.query; // Optional filter by type (pet, product, store)
    const userId = req.user._id;

    const filter = { user: userId };
    if (type && ['pet', 'product', 'store'].includes(type)) {
      filter.itemType = type;
    }

    const favorites = await Favorite.find(filter)
      .populate({
        path: 'itemId',
        populate: [
          { path: 'owner', select: 'name email profilePicture' },
          { path: 'store', select: 'name logoUrl description' },
          { path: 'category', select: 'name' },
        ],
      })
      .sort({ createdAt: -1 });

    // Format response to include the actual item data
    const formattedFavorites = favorites.map((fav) => ({
      _id: fav._id,
      itemType: fav.itemType,
      item: fav.itemId,
      createdAt: fav.createdAt,
    }));

    res.json({
      success: true,
      favorites: formattedFavorites,
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Favoriler yüklenirken hata oluştu',
      error: error.message,
    });
  }
};

// Add item to favorites
export const addFavorite = async (req, res) => {
  try {
    const { itemType, itemId } = req.body;
    const userId = req.user._id;

    // Validate itemType
    if (!['pet', 'product', 'store'].includes(itemType)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz favori tipi',
      });
    }

    // Verify item exists
    let itemExists = false;
    if (itemType === 'pet') {
      itemExists = await Pet.exists({ _id: itemId });
    } else if (itemType === 'product') {
      itemExists = await Product.exists({ _id: itemId });
    } else if (itemType === 'store') {
      itemExists = await Store.exists({ _id: itemId });
    }

    if (!itemExists) {
      return res.status(404).json({
        success: false,
        message: 'Öğe bulunamadı',
      });
    }

    // Check if already favorited
    const existingFavorite = await Favorite.findOne({
      user: userId,
      itemType,
      itemId,
    });

    if (existingFavorite) {
      return res.status(400).json({
        success: false,
        message: 'Bu öğe zaten favorilerde',
      });
    }

    // Create favorite
    const favorite = await Favorite.create({
      user: userId,
      itemType,
      itemId,
    });

    const populatedFavorite = await Favorite.findById(favorite._id).populate({
      path: 'itemId',
      populate: [
        { path: 'owner', select: 'name email profilePicture' },
        { path: 'store', select: 'name logoUrl description' },
        { path: 'category', select: 'name' },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Favorilere eklendi',
      favorite: {
        _id: populatedFavorite._id,
        itemType: populatedFavorite.itemType,
        item: populatedFavorite.itemId,
        createdAt: populatedFavorite.createdAt,
      },
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Favorilere eklenirken hata oluştu',
      error: error.message,
    });
  }
};

// Remove item from favorites
export const removeFavorite = async (req, res) => {
  try {
    const { itemType, itemId } = req.body;
    const userId = req.user._id;

    const favorite = await Favorite.findOneAndDelete({
      user: userId,
      itemType,
      itemId,
    });

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: 'Favori bulunamadı',
      });
    }

    res.json({
      success: true,
      message: 'Favorilerden kaldırıldı',
    });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Favorilerden kaldırılırken hata oluştu',
      error: error.message,
    });
  }
};

// Check if item is favorited by current user
export const checkFavorite = async (req, res) => {
  try {
    const { itemType, itemId } = req.query;
    const userId = req.user._id;

    const favorite = await Favorite.findOne({
      user: userId,
      itemType,
      itemId,
    });

    res.json({
      success: true,
      isFavorite: !!favorite,
    });
  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Favori kontrolü yapılırken hata oluştu',
      error: error.message,
    });
  }
};

// Get favorites count by type
export const getFavoritesCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const [petCount, productCount, storeCount] = await Promise.all([
      Favorite.countDocuments({ user: userId, itemType: 'pet' }),
      Favorite.countDocuments({ user: userId, itemType: 'product' }),
      Favorite.countDocuments({ user: userId, itemType: 'store' }),
    ]);

    res.json({
      success: true,
      counts: {
        pet: petCount,
        product: productCount,
        store: storeCount,
        total: petCount + productCount + storeCount,
      },
    });
  } catch (error) {
    console.error('Get favorites count error:', error);
    res.status(500).json({
      success: false,
      message: 'Favori sayısı alınırken hata oluştu',
      error: error.message,
    });
  }
};
