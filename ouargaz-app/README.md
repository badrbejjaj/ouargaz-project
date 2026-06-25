# OUARGAZ APP — Centre Emplisseur GPL 🔴⛽

**Plateforme de gestion industrielle — TotalEnergies Marketing Maroc**

Application web complète pour la gestion des opérations du Centre Emplisseur GPL OUARGAZ S.A.

---

## 🚀 Démarrage rapide (GitHub Codespaces)

### 1. Ouvrir dans Codespaces

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/)

Ou depuis le dépôt : **Code → Codespaces → Create codespace on main**

### 2. Installation des dépendances

```bash
npm install
```

### 3. Configuration de l'environnement

Le fichier `.env` est déjà configuré pour le développement local :

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="ouargaz-super-secret-jwt-key-2026"
NODE_ENV="development"
```

> ⚠️ En production, changez `JWT_SECRET` par une valeur sécurisée aléatoire.

### 4. Initialisation de la base de données

```bash
# Générer le client Prisma
npx prisma generate

# Créer la base de données et appliquer le schéma
npx prisma db push

# Remplir les données initiales (utilisateurs, référentiels, barème)
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

### 5. Lancer le serveur de développement

```bash
npm run dev
```

L'application sera accessible sur : **http://localhost:3000**

---

## 🔐 Comptes de test

| Identifiant | Mot de passe | Rôle | Permissions |
|-------------|-------------|------|-------------|
| `admin` | `admin123` | Chef de Centre | Accès complet + administration |
| `administratif` | `admin456` | Agent Administratif | Saisie + exports (pas de suppression) |
| `lecture` | `lecture123` | Consultation | Lecture seule |

---

## 📋 Fonctionnalités

### Opérations
- **Saisie Journalière** — Jaugeage réservoirs (C1–C5), ventes clients, stock bouteilles, approvisionnements citernes
- **Dashboard** — KPIs temps réel, graphiques, indicateurs Boni/Mali
- **Historique** — Consultation et filtrage de toutes les données

### Calculs automatiques
- VCF (Volume Correction Factor) — Approximation ASTM 54B pour GPL Butane
- Barème réservoirs OUARGAZ (2975 points, 0–2974mm → 0–150046L)
- Boni/Mali journalier et cumulatif
- Masse liquide + masse vapeur par réservoir
- Poids conditionné (12kg, 3kg, 6kg, 34kg)
- Écart approvisionnement (Q_net - Q_BL)

### Rapports & Exports
- **Export Excel** sur canevas officiels OUARGAZ :
  - Rapport Journalier
  - Approvisionnements
  - Vente AFRIQUIA GAZ
  - Vente TISSIR
  - Vente VIVO ENERGY
  - Vente TotalEnergies & Dimagaz
- **Export ZIP** — Tous les fichiers du mois en un clic

### Administration
- Clôture/réouverture journalière (Chef de Centre)
- Référentiels maîtres (clients, transporteurs, provenances, marques)
- Gestion des utilisateurs (Chef de Centre)
- Journal d'audit complet

---

## 🏗️ Architecture technique

```
ouargaz-app/
├── src/
│   ├── app/
│   │   ├── (pages)/          # Pages Next.js (dashboard, saisie, etc.)
│   │   └── api/              # Routes API REST
│   ├── components/
│   │   └── layout/           # Sidebar, Header
│   └── lib/
│       ├── auth.ts            # JWT authentication
│       ├── bareme-data.ts     # Barème OUARGAZ (2975 entrées)
│       ├── calculations.ts    # Calculs GPL (VCF, masse, boni/mali)
│       ├── excel-export.ts    # Exports Excel sur canevas officiels
│       └── prisma.ts          # Client base de données
├── prisma/
│   ├── schema.prisma          # Schéma Prisma (SQLite)
│   └── seed.ts                # Données initiales
└── public/
    ├── images/logo.png        # Logo TotalEnergies
    └── templates/             # Canevas Excel officiels OUARGAZ
```

### Stack technique
- **Frontend** — Next.js 14, TypeScript, Tailwind CSS
- **Backend** — Next.js API Routes (Node.js)
- **Base de données** — SQLite via Prisma ORM
- **Authentification** — JWT (jose) avec cookies HTTP-only
- **Exports** — ExcelJS (template-based), JSZip
- **Graphiques** — Recharts
- **Design** — Dark/Light mode, TotalEnergies brand colors

---

## 📊 Modèle de données

### Principales tables
| Table | Description |
|-------|-------------|
| `User` | Utilisateurs et rôles |
| `Jaugeage` | Mesures réservoirs C1-C5 par date |
| `VenteClient` | Ventes quotidiennes par client/marque |
| `StockBouteilles` | Stock conditionné par marque |
| `Approvisionnement` | Citernes VRAC reçues |
| `JourneeStatus` | Clôture journalière |
| `BaremeReservoir` | Table de jaugeage (2975 entrées) |
| `AuditLog` | Journal de traçabilité |
| `Client` | Référentiel clients |
| `Transporteur` | Référentiel transporteurs |
| `Provenance` | Référentiel provenances VRAC |

---

## 🔧 Commandes utiles

```bash
# Développement
npm run dev

# Build production
npm run build
npm start

# Base de données
npx prisma studio          # Interface graphique base de données
npx prisma db push         # Appliquer le schéma
npx prisma db seed         # Insérer les données initiales

# Vérification TypeScript
npx tsc --noEmit
```

---

## 🌐 Déploiement en production

### Variables d'environnement requises
```env
DATABASE_URL="file:/data/ouargaz.db"  # Chemin absolu en production
JWT_SECRET="<clé aléatoire sécurisée>"
NODE_ENV="production"
```

### Build
```bash
npm run build
npm start
```

---

## 📁 Canevas Excel (templates)

Les fichiers Excel officiels OUARGAZ sont dans `public/templates/` :
- `APPROVISIONNEMENTS.xlsx` — Suivi citernes VRAC
- `RECAP.xlsx` — Récapitulatif annuel
- `STOCK_ET_VENTES.xlsx` — Stock et ventes consolidés
- `VENTE_AFRIQUIA.xlsx` — Dépositaires Afriquia Gaz
- `VENTE_TISSIR.xlsx` — Dépositaires Tissir
- `VENTE_TOTALENERGIES_ET_DIMAGAZ.xlsx` — TotalEnergies + Dimagaz
- `VENTE_VIVO.xlsx` — Bouhalba VIVO Energy
- `Rapport_Journalier_template.xlsx` — Rapport opérationnel journalier

---

## 🏭 Centre Emplisseur OUARGAZ S.A.

**Réservoirs GPL :** C1, C2, C3, C4, C5  
**Capacité par réservoir :** 150 000 L (150 m³)  
**Produit :** Gaz de Pétrole Liquéfié (GPL) — Butane  
**Affiliation :** TotalEnergies Marketing Maroc (TEMM)

---

*Développé pour OUARGAZ S.A. — Centre Emplisseur GPL, Ouarzazate, Maroc*  
*© 2026 — TotalEnergies Marketing Maroc*

---

## 🆕 Notes de version — itération V5

Améliorations additives (aucune route ni fonctionnalité existante supprimée) :

- **Exports Excel fiabilisés** : remplissage strict des canevas officiels (cellules d'entrée uniquement), formules / fusions / styles / zones d'impression conservés, `fullCalcOnLoad` activé pour recalcul automatique à l'ouverture dans Excel. Mappages recalés sur la structure réelle des canevas (Rapport Journalier, Approvisionnements, Vente Afriquia/Tissir/Vivo/TE-Dimagaz).
- **Logique métier GPL** : *Stock Début J = Stock Fin J-1* — report automatique depuis la veille (endpoint `/api/stock-debut`), affiché en bandeau dans la Saisie, jamais ressaisi.
- **Sidebar 3 modes** : complète → réduite → masquée, choix mémorisé (`sidebar-mode`).
- **Alerte Boni/Mali** : seuil aligné à ±3 %.

> Les canevas Excel restent la **vérité absolue** : ils ne sont jamais recréés, uniquement copiés puis remplis.

## Correctif ChatGPT — V5 Enterprise Patch

Cette version renforce les points critiques demandés :

- Stock début VRAC et stock début conditionné repris séparément depuis le dernier stock fin disponible avant la date.
- Jaugeages visibles dans l'historique avec filtre par date/période.
- Sauvegarde jaugeage fiabilisée : remplacement complet de la journée pour éviter les valeurs fantômes.
- Dashboard enrichi : KPI sélectionnables, alertes VRAC/Boni, réservoirs horizontaux, graphiques modernes.
- Rapport journalier dans l'application recentré sur une date unique.
- Exports : ajout rapport mensuel journalier, récap, stock et ventes dans le ZIP ; remplissage par canevas.
- Login : suppression de l'affichage des comptes de test dans l'interface.

Lancement :

```bash
npm install
npm run db
npm run dev
```

Si `npm run db` échoue :

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```
