# Correction Chef de Centre / Adjoint

Cette version force l’accès complet aux menus pour :
- CHEF_CENTRE
- ADJOINT_CHEF_CENTRE

Corrections incluses :
- Sidebar : accès complet sans dépendre de KPI par profil.
- Administration API : tous les rôles acceptés.
- Auth : Adjoint traité comme administrateur opérationnel.
- Référentiels / Clôture : accès Adjoint ajouté.

Après extraction :
```bash
cd OUARGAZ_APP_V6_3_PRO/ouargaz-app
npm install
npx prisma generate
npx prisma db push
npm run dev
```
