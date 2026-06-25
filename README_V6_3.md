# OUARGAZ APP V6.3 PRO — Notes de version

## Évolutions V6.3 vs V6.2

### ✅ Bouteilles étrangères
- Présentes dans toutes les étapes : file d'attente, entrée, camions internes, vérification chef d'équipe, fin chargement, sortie, historique, exports
- Champs : étrangères 12 kg / 6 kg / 3 kg

### ✅ Calcul des casiers (corrigé)
- Défectueuses ET étrangères occupent aussi les casiers
- `casiers_12 = ceil((pleines_12 + def_12 + etr_12) / 35)`
- `casiers_6  = ceil((pleines_6  + def_6  + etr_6)  / 60)`
- `casiers_3  = ceil((pleines_3  + def_3  + etr_3)  / 120)`
- Affichage : casiers 12 kg / 6 kg / 3 kg + total casiers

### ✅ Correction des droits
**Agent de saisie**
- Peut : créer, modifier file d'attente, annuler, faire entrer, voir camions internes, voir prêts à sortir, sortir
- Ne peut PAS : démarrer emplissage, terminer chargement

**Chef d'équipe**
- Peut : voir file d'attente (LECTURE SEULE), voir camions internes, modifier quantités terrain, démarrer emplissage, terminer chargement
- Ne peut PAS : créer camion, supprimer, sortir

### ✅ Historique détaillé
Ouverture d'un camion affiche :
- Infos : client, marque, matricule, chauffeur, BC, BL
- Entrée : pleines + défectueuses + étrangères par emballage
- Chargement : acceptées + refusées
- Dates : arrivée, entrée, emplissage, fin chargement, sortie
- Utilisateurs : saisie, chef équipe, sortie

### ✅ Notifications (corrigées)
- Badge disparaît quand les notifications sont lues
- Clic sur notification → marquée comme lue individuellement
- Suppression automatique après 30 minutes
- Badge rouge sur l'onglet "Camions internes" quand nouveau camion entre
- Badge rouge sur l'onglet "Prêts à sortir" quand camion prêt

### ✅ Synchronisation temps réel
- Polling automatique toutes les **3 secondes**
- Listes mises à jour automatiquement sans rechargement de page

### ✅ KPI Dashboard (enrichis)
**Camions** : arrivés / en attente / entrés / internes / en emplissage / prêts sortie / sortis / annulés
**Bouteilles** : entrées + sorties par emballage (12/6/3 kg)
**Étrangères** : entrées + sorties par emballage
**Défectueuses** : rendues / acceptées / refusées par emballage
**Taux remplacement** : 12 kg / 6 kg / 3 kg / global

### ✅ Profil Adjoint Chef de Centre
- Mêmes droits que Chef de Centre / Administrateur
- Déjà présent dans `roles.ts` depuis V6.2 — confirmé

### ✅ Application Android (mobile-chef-equipe/)
- Flutter, réservée au rôle CHEF_EQUIPE
- Login avec URL configurable
- Camions internes en temps réel (polling 3s)
- Détail : saisie pleines / défectueuses / étrangères
- Démarrer emplissage
- Fin chargement : saisie acceptées, calcul auto refusées
- Notifications avec badge
- Historique (lecture seule)

## Architecture

```
ouargaz-app/          Next.js 14 / TypeScript / Prisma / SQLite
mobile-chef-equipe/   Flutter Android app
README_V6_3.md        Ce fichier
README_BUILD_APK.md   Guide build APK
```

## Démarrage rapide

```bash
cd ouargaz-app
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## Contraintes respectées
- ❌ Bouteilles VIDES non ajoutées (contrainte V6.3)
- ✅ Toutes les tables Prisma existantes conservées
- ✅ dev.db préservé
- ✅ Modules existants non modifiés (Rapport, Jaugeage, Ventes, Stocks, Exports, etc.)
