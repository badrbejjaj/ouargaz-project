# OUARGAZ APP V6 — Module Mouvements Camions Dépositaires

Cette version ajoute le module **Mouvements Camions Dépositaires** dans OUARGAZ APP existante.

## Inclus

- File d’attente extérieure des camions.
- Entrée centre avec changement automatique de statut.
- Camions internes pour chef d’équipe.
- Démarrage emplissage.
- Fin chargement.
- Camions prêts à sortir.
- Sortie camion avec N° Bon de Livraison obligatoire.
- Annulation sans suppression physique avec justificatif obligatoire.
- Notifications internes via icône 🔔.
- Historique des actions camions.
- KPI camions, tonnages, défectueuses et taux de remplacement.
- Paramétrage KPI/menus par profil dans `Administration > KPI par profil`.

## Comptes ajoutés

- `agent_saisie` / `saisie123` → Agent de saisie / garde
- `chef_equipe` / `equipe123` → Chef d’équipe

Les anciens comptes sont conservés.

## Commandes de lancement GitHub Codespaces

```bash
cd /workspaces/ouargazvf/ouargaz-app
nvm use 20
npm install
npm run db
npm run dev
```

Ouvrir ensuite le port 3000.

## Important

Le ZIP contient `prisma/dev.db` avec les données existantes et les nouvelles tables du module camions créées.
Avant toute modification future, sauvegarder `prisma/dev.db`.

## Correctif V6.1 intégré

- Limitation stricte par profil : Agent de saisie/garde, Chef d’équipe, Consultation et Chef de Centre.
- Chef d’équipe : file d’attente en lecture seule ; actions uniquement sur camions internes.
- Agent de saisie/garde : création/modification file d’attente et validation sortie ; pas de traitement interne.
- Camions internes : remplacement du terme terrain par Plein 12 kg, Plein 6 kg, Plein 3 kg, Défectueux 12 kg, Défectueux 6 kg, Défectueux 3 kg.
- Fin de chargement : saisie uniquement des bouteilles acceptées ; traitées et refusées calculées automatiquement.
- Historique détail camion enrichi dans le panneau latéral.
- Profils Agent de saisie/garde et Chef d’équipe ajoutés dans Administration.
- Double header supprimé dans KPI par profil.
- Notifications avec compteur header et badge sur le menu Mouvements Camions.
- KPI séparés par thèmes : camions, tonnages, défectueuses, écarts.

