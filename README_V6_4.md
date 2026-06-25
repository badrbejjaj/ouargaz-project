# OUARGAZ APP V6.4 PRO — Mouvements Camions + APK Ready

## Règle métier intégrée

- Entrée camion : bouteilles **vides + défectueuses + étrangères**.
- Sortie camion : bouteilles **pleines + défectueuses refusées + étrangères**.
- Les pleines à l'entrée sont neutralisées dans le workflow camions.

## Administrateur

- Chef de Centre et Adjoint Chef de Centre : accès complet obligatoire.
- Les autres profils suivent les menus/KPI/graphes paramétrés dans Administration → KPI par profil.

## APK sans installation PC

Le dossier contient un workflow GitHub Actions :

`.github/workflows/build-apk.yml`

Pour générer l'APK sans rien installer sur le PC :

1. Pousser ce dossier sur GitHub.
2. Ouvrir GitHub → Actions.
3. Lancer `Build OUARGAZ Chef Equipe APK`.
4. Télécharger l'artifact `OUARGAZ_CHEF_EQUIPE_APK`.

L'APK généré s'appelle :

`OUARGAZ_CHEF_EQUIPE.apk`
