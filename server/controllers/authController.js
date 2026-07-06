/**
 * @fileoverview BakeFlow ERP — controllers/authController.js
 * Handles signup, login, logout, and current-user info.
 * Passwords hashed with bcrypt. JWT issued as HttpOnly cookie.
 */

'use strict';

const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const Settings = require('../models/Settings');
const Ingredient = require('../models/Ingredient');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '30d';

/** Built-in ingredient seed data — inserted for every new user */
const BUILTIN_INGREDIENTS = [
  { key: 'flour',        label: 'Flour',        unit: 'kg',     threshold: 5,   isCustom: false },
  { key: 'wheatFlour',   label: 'Wheat Flour',  unit: 'kg',     threshold: 2,   isCustom: false },
  { key: 'sugar',        label: 'Sugar',        unit: 'kg',     threshold: 1,   isCustom: false },
  { key: 'salt',         label: 'Salt',         unit: 'kg',     threshold: 0.5, isCustom: false },
  { key: 'yeast',        label: 'Yeast',        unit: 'g',      threshold: 50,  isCustom: false },
  { key: 'margarine',    label: 'Margarine',    unit: 'kg',     threshold: 0.3, isCustom: false },
  { key: 'oil',          label: 'Oil',          unit: 'liters', threshold: 0.3, isCustom: false },
  { key: 'improver',     label: 'Improver',     unit: 'g',      threshold: 10,  isCustom: false },
  { key: 'preservative', label: 'Preservative', unit: 'g',      threshold: 5,   isCustom: false },
  { key: 'flavour',      label: 'Flavour',      unit: 'ml',     threshold: 5,   isCustom: false },
  { key: 'water',        label: 'Water',        unit: 'liters', threshold: 2,   isCustom: false },
];

/**
 * Issues a signed JWT.
 * @param {string} userId
 */
function issueToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/**
 * POST /api/auth/signup
 * Creates a new user + seeds their initial data (ingredients + settings).
 */
async function signup(req, res) {
  try {
    const { email, password, bakeryName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      email:      email.toLowerCase().trim(),
      passwordHash,
      bakeryName: bakeryName?.trim() || 'BakeFlow Bakery',
    });

    // Seed built-in ingredients for new user
    await Ingredient.insertMany(
      BUILTIN_INGREDIENTS.map(ing => ({ ...ing, userId: user._id, amount: 0, currentPrice: 0 }))
    );

    // Seed default settings
    await Settings.create({ userId: user._id });

    const token = issueToken(user._id.toString());

    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: { id: user._id, email: user.email, bakeryName: user.bakeryName },
    });
  } catch (err) {
    console.error('[Auth] Signup error:', err);
    res.status(500).json({ error: 'Server error during signup.' });
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = issueToken(user._id.toString());

    res.json({
      message: 'Logged in successfully.',
      token,
      user: { id: user._id, email: user.email, bakeryName: user.bakeryName },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
}

/**
 * POST /api/auth/logout
 * Clears authentication.
 */
function logout(req, res) {
  res.json({ message: 'Logged out successfully.' });
}

/**
 * GET /api/auth/me
 * Returns the current user (from cookie-verified JWT via requireAuth middleware).
 */
async function me(req, res) {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    console.error('[Auth] Me error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
}

module.exports = { signup, login, logout, me };
