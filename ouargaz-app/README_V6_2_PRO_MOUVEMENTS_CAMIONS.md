# OUARGAZ APP V6.2 PRO — Mouvements Camions Conditionnés

## Contenu V6.2

Cette version ajoute et corrige le module mouvements camions conditionnés avec :

- bouteilles pleines, vides, défectueuses et étrangères en 12 kg, 6 kg et 3 kg ;
- saisie file d’attente, vérification chef d’équipe, fin chargement et sortie camion ;
- calcul automatique des casiers selon la somme pleines + défectueuses + étrangères ;
- KPI avancés mouvements camions dans le dashboard général ;
- KPI dédiés dans le module mouvements camions ;
- notifications rapides avec lecture automatique au clic et expiration 30 minutes ;
- profil Adjoint Chef de Centre ;
- paramétrage KPI, menus et graphes par profil ;
- correction des droits : agent de saisie = file d’attente + sortie ; chef d’équipe = camions internes ; consultation = lecture seule.

## Lancement GitHub Codespaces

```bash
cd /workspaces/ouargazvf/ouargaz-app
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## Important

Après décompression, si la base SQLite existe déjà dans `prisma/dev.db`, elle est conservée.  
Si Prisma signale des colonnes manquantes, lancer :

```bash
npx prisma db push
```

## Profils de test

- admin / admin123
- adjoint / adjoint123
- agent_saisie / saisie123
- chef_equipe / equipe123
- administratif / admin456
- lecture / lecture123
