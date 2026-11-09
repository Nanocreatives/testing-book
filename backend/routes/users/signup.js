import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import defineUser from '../../models/users.js';
import { SIGNUP_DISABLED } from '../../config/config.js';
import { roles, defaultDangerKey } from './authSettings.js';

export default function (sequelize) {
  const User = defineUser(sequelize, DataTypes);
  const secretKey = process.env.SECRET_KEY || defaultDangerKey;

  // L'interface a besoin de le savoir pour ne pas proposer une porte fermée.
  // Publique, comme la page de connexion qu'elle sert.
  router.get('/signup/enabled', (req, res) => {
    res.json({ enabled: !SIGNUP_DISABLED });
  });

  router.post('/signup', async (req, res) => {
    // Le refus vit ici et pas seulement dans l'écran : une route ouverte est
    // ouverte à qui ne passe pas par l'écran.
    if (SIGNUP_DISABLED) {
      return res.status(403).json({ error: 'Sign up is disabled on this instance' });
    }

    try {
      const { email, password, username } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);

      const userCount = await User.count();
      const initialRole =
        userCount > 0
          ? roles.findIndex((entry) => entry.uid === 'user')
          : roles.findIndex((entry) => entry.uid === 'administrator');

      const user = await User.create({
        email,
        password: hashedPassword,
        username: username,
        role: initialRole,
      });

      const accessToken = jwt.sign({ userId: user.id }, secretKey, {
        expiresIn: '24h',
      });
      const expiresAt = Date.now() + 3600 * 1000 * 24; // expire date(ms)

      user.password = undefined;
      res.status(200).json({ access_token: accessToken, expires_at: expiresAt, user });
    } catch (error) {
      console.error(error);
      res.status(500).send('Sign up failed');
    }
  });

  return router;
}
