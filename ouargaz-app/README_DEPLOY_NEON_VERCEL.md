# Déploiement OUARGAZ APP V5.1 sur Vercel + Neon

1. Créer une base gratuite sur Neon.
2. Copier la variable `DATABASE_URL` PostgreSQL.
3. Dans Vercel > Project > Settings > Environment Variables, ajouter :
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NEXTAUTH_URL` = URL Vercel de l'application
4. Réglages Vercel :
   - Framework Preset : Next.js
   - Root Directory : `ouargaz-app`
   - Build Command : `npm run build`
   - Install Command : `npm install`
   - Output Directory : laisser vide
5. Après déploiement, initialiser la base une seule fois depuis Codespaces avec la même DATABASE_URL Neon :
   ```bash
   cd ouargaz-app
   npm install
   npm run db
   ```

Ne jamais relancer `npm run db:seed` après le début de l'exploitation réelle sans sauvegarde, pour éviter de modifier les référentiels.
