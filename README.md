# Psoa : dossier de mise en ligne

Ce dossier contient la version complète de Psoa : l'application, les comptes, la synchronisation, le paiement Stripe, les rappels, l'installation sur le téléphone et les projets de pages légales.

**Ce qui a été testé, et ce qui ne l'a pas été.** L'application a été testée avec un faux serveur (connexion, inscription, synchronisation, blocage après 2 séances, abonnement actif, portail, déconnexion, suppression de compte) et en mode démo. En revanche, **rien n'a été exécuté contre un vrai Supabase, un vrai Stripe ni de vraies notifications** : je n'ai pas accès à vos comptes. Suivez donc l'étape 7 (tests) en mode test avant d'ouvrir à du public.

## Contenu

```
public/                  -> le site à mettre en ligne
  index.html             application
  config.js              VOS réglages publics (à remplir)
  sw.js, manifest.webmanifest, icônes   installation et hors ligne
  legal/                 projets de pages légales (à compléter et faire valider)
  _headers               en-têtes de sécurité (Cloudflare Pages / Netlify)
supabase/
  schema.sql             tables et règles de sécurité
  functions/             fonctions serveur (paiement, portail, webhook, rappels, suppression)
.env.example             liste des secrets serveur
```

## Ce que vous devez avoir avant de commencer

1. Un compte **Supabase** (choisissez une région de l'Union européenne).
2. Un compte **Stripe** (commencez en mode test).
3. Un **nom de domaine** et un hébergeur de site statique (Cloudflare Pages, Netlify ou Vercel).
4. Un ordinateur avec **Node.js** pour installer deux outils en ligne de commande : la CLI Supabase (`npm i -g supabase`) et, pour les rappels, `web-push`.

## Étape 1. Supabase : base de données et comptes

1. Créez un projet Supabase. Notez l'**URL du projet** et la clé **anon** (Settings, API).
2. Ouvrez **SQL Editor**, collez le contenu de `supabase/schema.sql`, cliquez sur **Run**. Vérifiez dans Table Editor que 4 tables existent : `user_state`, `session_logs`, `subscriptions`, `push_subscriptions`.
3. **Authentication, URL Configuration** : mettez votre domaine final dans « Site URL » et ajoutez-le dans « Redirect URLs ».
4. **Authentication, Providers, Email** : laissez la confirmation d'e-mail activée. Traduisez les modèles d'e-mails en français (Authentication, Email Templates).
5. Ouvrez `public/config.js` et remplissez `SUPABASE_URL` et `SUPABASE_ANON_KEY`. Ces deux valeurs sont publiques ; la clé « service_role » ne doit **jamais** y apparaître.

## Étape 2. Stripe : produits et prix

Dans le tableau de bord Stripe (mode test d'abord) :

1. Créez 3 prix : **mensuel 7,99 € récurrent**, **annuel 49 € récurrent**, **paiement unique 29 €**. Notez leurs identifiants `price_...`. (Les montants sont ceux de la démo : ajustez-les à votre décision.)
2. **Settings, Billing, Customer portal** : activez le portail et autorisez l'annulation d'abonnement. Sans cela, le bouton « Gérer mon abonnement » ne fonctionnera pas.
3. **Settings, Public details** : renseignez l'URL de vos CGU (`https://votre-domaine/legal/cgu.html`). Le paiement exige l'acceptation des conditions.
4. Activez le calcul de la **TVA** si vous y êtes assujetti, et vérifiez la configuration fiscale avec votre comptable.

## Étape 3. Fonctions serveur

Dans un terminal, depuis ce dossier :

```
supabase login
supabase link --project-ref VOTRE_REF_PROJET
cp .env.example .env        # puis remplissez les valeurs
supabase secrets set --env-file ./.env
supabase functions deploy create-checkout
supabase functions deploy create-portal
supabase functions deploy delete-account
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy send-reminders --no-verify-jwt
```

## Étape 4. Webhook Stripe

1. Stripe, **Developers, Webhooks, Add endpoint**.
2. URL : `https://VOTRE_REF_PROJET.supabase.co/functions/v1/stripe-webhook`.
3. Événements : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
4. Copiez la « signing secret » (`whsec_...`) dans `.env` (`STRIPE_WEBHOOK_SECRET`) et relancez `supabase secrets set --env-file ./.env`.

## Étape 5. Rappels de séance (notifications)

1. Générez les clés : `npx web-push generate-vapid-keys`.
2. Mettez la clé **publique** dans `public/config.js` (`VAPID_PUBLIC_KEY`), et les clés publique et privée dans `.env`. Mettez aussi une valeur longue et aléatoire dans `CRON_SECRET`.
3. Dans Supabase, activez les extensions **pg_cron** et **pg_net** (Database, Extensions), puis exécutez dans le SQL Editor (remplacez les valeurs) :

```
select cron.schedule('psoa-rappels', '0 * * * *', $$
  select net.http_post(
    url := 'https://VOTRE_REF_PROJET.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('x-cron-secret', 'VOTRE_CRON_SECRET', 'Content-Type', 'application/json')
  );
$$);
```

Le rappel part à l'heure choisie par chaque utilisateur, dans son fuseau. **Sur iPhone**, les notifications ne fonctionnent que si Psoa est installée sur l'écran d'accueil (iOS 16.4 ou plus). Cette partie est la plus fragile : testez-la sur de vrais téléphones.

## Étape 6. Mise en ligne du site

1. Déposez le dossier `public/` sur Cloudflare Pages (« Direct upload »), Netlify (glisser-déposer) ou Vercel (`vercel --prod` depuis `public/`).
2. Associez votre nom de domaine. Le HTTPS est indispensable (installation et notifications ne marchent pas sans).
3. Vérifiez que `https://votre-domaine/sw.js`, `/manifest.webmanifest` et `/legal/cgu.html` s'ouvrent.
4. Complétez les champs entre crochets des 4 pages dans `public/legal/`, faites-les valider par un juriste, puis supprimez l'encadré « Projet de document ».

## Étape 7. Tests en mode test (avant le public)

Avec les clés Stripe de test (carte `4242 4242 4242 4242`) :

- [ ] Inscription, e-mail de confirmation reçu en français, connexion.
- [ ] Création d'un programme, puis connexion depuis un autre appareil : le programme est retrouvé.
- [ ] Deux séances gratuites, puis le paiement s'affiche à la troisième.
- [ ] Essai mensuel : redirection Stripe, retour sur Psoa, Profil indique « Essai gratuit ».
- [ ] Dans la table `subscriptions` de Supabase, la ligne se met à jour (le webhook fonctionne).
- [ ] « Gérer mon abonnement » ouvre le portail ; une annulation y est répercutée dans Psoa.
- [ ] Paiement unique : accès pendant 12 semaines (`entitlement_until`).
- [ ] « Mot de passe oublié » et « Supprimer mon compte » (le client Stripe disparaît aussi).
- [ ] Installation sur iPhone (Safari, Partager, Sur l'écran d'accueil) et sur Android (Installer).
- [ ] Rappel : activé dans Profil, notification reçue à l'heure choisie.
- [ ] Sons du chrono et animations sur de vrais téléphones, mode silencieux compris.

## Étape 8. Passage en production

1. Dans Stripe, passez en mode live : recréez les 3 prix et le webhook, remplacez `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et les `PRICE_*`, puis relancez `supabase secrets set`.
2. Refaites un achat réel de test avec votre propre carte, puis remboursez-le.
3. Vérifiez les sauvegardes de la base (Supabase, Database, Backups) selon votre offre.

## Points d'attention

- **Juridique** : les pages de `public/legal/` sont des projets. Les textes de consentement, les CGU/CGV (droit de rétractation, médiation de la consommation), la politique de confidentialité et la qualification de la « difficulté ressentie » (donnée de santé ou non) doivent être validés par un juriste.
- **Contenus** : faites relire les 205 consignes par un kiné ou un coach, et les mini-cours de nutrition par un diététicien.
- **Sécurité** : seules les clés « anon » (Supabase) et « publique » (VAPID) vont dans `public/`. Les autres restent dans les secrets Supabase. Les règles de sécurité de `schema.sql` empêchent un utilisateur de lire les données d'un autre ; ne les désactivez pas.
- **Coûts** : consultez les pages de tarifs actuelles de Supabase, Stripe, de l'hébergeur et du nom de domaine avant de vous engager.
- **Mode démo** : si `SUPABASE_URL` reste vide dans `config.js`, Psoa tourne en mode démo (données sur l'appareil, paiement simulé).
- **Version des bibliothèques** : `index.html` charge `supabase-js` en version 2.45.4 depuis jsDelivr. Pour plus de maîtrise, vous pouvez héberger ce fichier vous-même.
