# BUILD APK — OUARGAZ Chef d'équipe (GitHub Actions uniquement)

Aucune installation locale de Flutter ou Android Studio n'est nécessaire.
Tout se compile dans GitHub Actions.

## Procédure

1. Pousser **tout le contenu du ZIP** sur GitHub (le dossier `.github/` doit être
   à la **racine du dépôt**, et `OUARGAZ_APP_V6_4_PRO_WEB_ANDROID_APK_READY/`
   reste un sous-dossier).
2. Aller dans l'onglet **Actions** du dépôt GitHub.
3. Lancer le workflow **« Build OUARGAZ Chef Equipe APK »** (bouton *Run workflow*),
   ou pousser une modification dans `mobile-chef-equipe/`.
4. À la fin du build, télécharger l'artifact **`OUARGAZ_CHEF_EQUIPE_APK`**
   qui contient **`OUARGAZ_CHEF_EQUIPE.apk`**.

## Correction du problème de desugaring (résolu)

L'erreur précédente :

```
> coreLibraryDesugaring configuration contains no dependencies.
```

avait deux causes, toutes deux corrigées :

1. **Dépendance inutile retirée** — `flutter_local_notifications` était déclarée
   dans `pubspec.yaml` mais jamais utilisée dans `lib/main.dart`. C'est elle qui
   imposait le *core library desugaring*. Elle a été supprimée. Les notifications
   de l'app reposent sur un badge interne (polling), pas sur les notifications
   système Android.

2. **Desugaring activé malgré tout** (robustesse) — le workflow régénère le
   dossier `android/` avec `flutter create`, ce qui écrase tout `build.gradle.kts`.
   La correction est donc appliquée **après** `flutter create` par le script
   `ci/patch_desugaring.sh`, qui injecte de façon idempotente :

   ```kotlin
   android {
       compileOptions {
           isCoreLibraryDesugaringEnabled = true
       }
   }
   dependencies {
       coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
   }
   ```

## Fichiers du module mobile

```
mobile-chef-equipe/
├── lib/main.dart                         App Flutter (chef d'équipe)
├── pubspec.yaml                          Dépendances (sans plugin inutile)
├── ci/
│   ├── patch_desugaring.sh               Patch desugaring post-flutter-create
│   └── AndroidManifest.xml               Manifest restauré après flutter create
├── android/app/src/main/AndroidManifest.xml
└── apk/                                  L'APK final y est copié pendant le build
```

## Personnalisations conservées après `flutter create`

- **AndroidManifest** : label « OUARGAZ Chef Equipe », permission INTERNET —
  restauré depuis `ci/AndroidManifest.xml`.
- **Desugaring** : injecté par `ci/patch_desugaring.sh`.

Si vous ajoutez plus tard un plugin qui exige une version Java/SDK plus récente,
le bloc `compileOptions` posé par le script cible déjà Java 17.
