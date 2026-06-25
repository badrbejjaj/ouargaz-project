# OUARGAZ - Application Mobile Chef d'Équipe 📱🔥

Cette application mobile Flutter est destinée aux **Chefs d'Équipe** de la plateforme **OUARGAZ**. Elle permet de suivre en temps réel les mouvements de camions, de superviser le remplissage et le chargement des bouteilles de gaz (12kg, 6kg, 3kg), et de consulter les indicateurs clés de performance (KPI) de la journée.

---

## 🚀 Fonctionnalités Principales

*   **Connexion Sécurisée & Configuration Flexible :**
    *   Saisie personnalisée de l'adresse URL du serveur backend.
    *   Authentification restreinte aux utilisateurs ayant le rôle `CHEF_EQUIPE`.
    *   Option "Se souvenir de moi" pour sauvegarder l'URL et les identifiants localement via `shared_preferences`.
*   **Tableau de Bord Temps Réel (Dashboard) :**
    *   Mise à jour automatique des données toutes les **3 secondes** par rafraîchissement périodique (polling).
    *   Support du geste *Pull-to-Refresh* sur tous les écrans principaux.
*   **Navigation par Onglets (6 Vues) :**
    1.  ⏳ **File d'attente** : Affiche les camions en attente (`EN_ATTENTE`) avec le détail des bouteilles saisies (12kg, 6kg, 3kg).
    2.  🚚 **Internes** : Liste les camions en cours de traitement (`EN_COURS_TRAITEMENT` ou `DEMARRAGE_EMPLISSAGE`).
    3.  ✅ **Prêts** : Liste les camions prêts à sortir (`PRET_A_SORTIR`).
    4.  📜 **Historique** : Affiche l'historique complet des mouvements de camions pour la journée.
    5.  🔔 **Notifications** : Système d'alertes temps réel avec compteur de messages non lus.
    6.  📊 **KPI** : Statistiques globales de la journée (Nombre de camions arrivés/sortis/prêts, totaux d'entrées/sorties de bouteilles).
*   **Thèmes Sombre et Clair :**
    *   Design moderne et premium (Glassmorphism & Couleurs HSL adaptées).
    *   Bouton de basculement rapide entre mode Sombre (par défaut) et Clair.

---

## 🛠️ Architecture & Structure du Projet

L'application a été conçue pour être compacte et performante :

*   **Point d'Entrée Unique** : Tout le code de l'application (Services API, Gestion d'état, Écrans et Composants) est regroupé dans le fichier [`lib/main.dart`](file:///C:/Users/badrb/Downloads/OUARGAZ_APP_V6_6_PRO_PREMIUM/mobile-chef-equipe/lib/main.dart).
*   **Gestion d'État** : Utilisation de `ValueNotifier` pour la réactivité du thème et de `StatefulWidget` pour les états locaux des écrans.
*   **Dépendances Principales ([pubspec.yaml](file:///C:/Users/badrb/Downloads/OUARGAZ_APP_V6_6_PRO_PREMIUM/mobile-chef-equipe/pubspec.yaml))** :
    *   `http` : Appels API REST.
    *   `shared_preferences` : Stockage persistant local pour la session et les préférences utilisateur.
    *   `intl` : Formatage des dates et heures.

---

## 📡 Intégration API

L'application communique avec le backend via les endpoints suivants :

*   `POST /api/auth/login` : Authentification et récupération du Cookie de session.
*   `GET /api/auth/session` : Vérification de la validité de la session active.
*   `POST /api/auth/logout` : Fermeture de session et nettoyage du stockage local.
*   `GET /api/mouvements-camions` : Récupération des mouvements de camions filtrés par statut (`EN_ATTENTE`, `PRET_A_SORTIR`, `TOUS`).
*   `GET /api/mouvements-camions/stats` : Statistiques de la journée pour les KPIs.
*   `GET /api/notifications` : Récupération des notifications.
*   `PUT /api/mouvements-camions` : Actions de mise à jour des mouvements (ex: démarrer remplissage ou terminer chargement).

---

## 💻 Configuration et Lancement

### Prérequis
*   [Flutter SDK](https://flutter.dev/docs/get-started/install) (version `>=3.0.0 <4.0.0`)
*   Un émulateur Android/iOS ou un appareil physique connecté.
*   Le serveur backend **OUARGAZ** démarré et accessible sur le même réseau.

### Installation & Démarrage
1.  **Récupérer les dépendances** :
    ```bash
    flutter pub get
    ```
2.  **Lancer l'application** :
    ```bash
    flutter run
    ```
3.  **Connexion au serveur** :
    *   Renseignez l'URL de votre serveur backend (ex: `http://192.168.1.100:3000`).
    *   Utilisez vos identifiants Chef d'Équipe.
