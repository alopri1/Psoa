// Configuration publique de Psoa.
// Ces valeurs sont visibles par tous : ne mettez JAMAIS de clé secrète ici.
// Laissez SUPABASE_URL vide pour faire tourner Psoa en mode démo (données sur l'appareil, paiement simulé).
window.PSOA_CONFIG = {
  SUPABASE_URL: "",            // ex. https://abcdefgh.supabase.co
  SUPABASE_ANON_KEY: "",       // clé "anon" / "publishable" du projet Supabase
  VAPID_PUBLIC_KEY: ""         // clé publique pour les rappels (voir README, étape 5)
};
