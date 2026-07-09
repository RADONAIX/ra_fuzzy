// French translations for the application chrome.
//
// Keys are the exact English source strings passed to t(...). Anything not
// present here falls back to the English text. Domain/data labels (report
// titles, role names, assurance-scope names) are intentionally NOT translated.

export const FR: Record<string, string> = {
  // --- Root: not-found / error boundaries -----------------------------------
  "Page not found": "Page introuvable",
  "The page you're looking for doesn't exist or has been moved.":
    "La page que vous recherchez n'existe pas ou a été déplacée.",
  "Go home": "Retour à l'accueil",
  "This page didn't load": "Cette page n'a pas pu se charger",
  "Something went wrong on our end. You can try refreshing or head back home.":
    "Une erreur s'est produite de notre côté. Vous pouvez réessayer ou revenir à l'accueil.",
  "Try again": "Réessayer",

  // --- Sidebar --------------------------------------------------------------
  "Dashboard & KPIs": "Tableau de bord et KPI",
  "Reports & Certified Exports": "Rapports et exports certifiés",
  "Pipelines & Job Monitor": "Pipelines et suivi des tâches",
  MODULES: "MODULES",
  "Revenue Assurance": "Assurance des revenus",
  soon: "bientôt",
  "Not available yet": "Pas encore disponible",
  "Expand sidebar": "Déployer le menu latéral",
  "Collapse sidebar": "Réduire le menu latéral",
  Expand: "Déployer",
  Collapse: "Réduire",

  // --- Header ---------------------------------------------------------------
  "ASSURANCE SCOPE": "PÉRIMÈTRE D'ASSURANCE",
  "Toggle menu": "Afficher/masquer le menu",
  "Switch to light mode": "Passer en mode clair",
  "Switch to dark mode": "Passer en mode sombre",
  "Toggle dark mode": "Basculer le mode sombre",
  Settings: "Paramètres",
  "User Management": "Gestion des utilisateurs",
  "Role Management": "Gestion des rôles",
  "Audit Logs": "Journaux d'audit",
  "Sign out": "Se déconnecter",
  "Account menu": "Menu du compte",
  "View profile": "Voir le profil",
  User: "Utilisateur",
  Member: "Membre",

  // --- Profile --------------------------------------------------------------
  "User Profile": "Profil utilisateur",
  "Your account information and access.":
    "Les informations de votre compte et vos accès.",
  Email: "E-mail",
  Role: "Rôle",
  Department: "Service",
  "Last Login": "Dernière connexion",
  "Account Status": "Statut du compte",
  "Edit Profile": "Modifier le profil",
  "Change Password": "Changer le mot de passe",
  Language: "Langue",
  "Choose the language for the application interface.":
    "Choisissez la langue de l'interface de l'application.",

  // --- Dashboard ------------------------------------------------------------
  "Embedded Analytics — Superset Dashboard":
    "Analyse intégrée — Tableau de bord Superset",
  "Live Superset view embedded from the analytics platform.":
    "Vue Superset en direct intégrée depuis la plateforme d'analyse.",
  Refresh: "Actualiser",
  "Couldn't load the embedded dashboard":
    "Impossible de charger le tableau de bord intégré",
  "Open in Superset": "Ouvrir dans Superset",

  // --- Login ----------------------------------------------------------------
  "Welcome back": "Bon retour",
  "Sign in to your account": "Connectez-vous à votre compte",
  Password: "Mot de passe",
  "Sign in": "Se connecter",
  "Toggle password": "Afficher/masquer le mot de passe",
  'Demo accounts available — password is "demo"':
    'Comptes de démonstration disponibles — le mot de passe est « demo »',
  "Secure revenue assurance": "Assurance des revenus sécurisée",
  "Login failed": "Échec de la connexion",
  or: "ou",
  "Continue with Google": "Continuer avec Google",
  "Continue with Microsoft": "Continuer avec Microsoft",
  "Coming soon": "Bientôt disponible",
  "This sign-in option isn't configured yet.":
    "Cette option de connexion n'est pas encore configurée.",

  // --- Access denied --------------------------------------------------------
  "Access Denied": "Accès refusé",
  "Your role doesn’t have permission to view this module. Contact your administrator if you need access.":
    "Votre rôle n'a pas l'autorisation de consulter ce module. Contactez votre administrateur si vous avez besoin d'un accès.",
  "Back to dashboard": "Retour au tableau de bord",

  // --- Monitoring -----------------------------------------------------------
  "Live system and application health, powered by Prometheus + Grafana — embedded below.":
    "Santé du système et de l'application en direct, propulsée par Prometheus + Grafana — intégrée ci-dessous.",
  "Open in Grafana": "Ouvrir dans Grafana",
  System: "Système",
  "API health": "Santé de l'API",
  "CPU, memory, disk and network for the application server.":
    "Processeur, mémoire, disque et réseau du serveur applicatif.",
  "Request rate, error rate and latency (p50/p95/p99) for the backend.":
    "Taux de requêtes, taux d'erreurs et latence (p50/p95/p99) du backend.",
  "Metrics are scraped by Prometheus every 15s from":
    "Les métriques sont collectées par Prometheus toutes les 15 s depuis",
  "(system) and the backend": "(système) et le backend",
  "endpoint (application). If the panel is blank, confirm Grafana is reachable at":
    "(application). Si le panneau est vide, vérifiez que Grafana est accessible à",

  // --- Audit logs -----------------------------------------------------------
  "Immutable trail of operator and system actions.":
    "Trace immuable des actions des opérateurs et du système.",
  "Event ID": "ID d'événement",
  Actor: "Acteur",
  Action: "Action",
  Target: "Cible",
  When: "Quand",

  // --- System configuration -------------------------------------------------
  "System Configuration": "Configuration du système",
  "Global runtime parameters for the assurance platform.":
    "Paramètres d'exécution globaux de la plateforme d'assurance.",
  "Saving…": "Enregistrement…",
  "Save changes": "Enregistrer les modifications",
  Environment: "Environnement",
  "Retention (days)": "Rétention (jours)",
  "SLA Window (minutes)": "Fenêtre SLA (minutes)",
  "Alert Email": "E-mail d'alerte",
  "Maintenance Mode": "Mode maintenance",
  Off: "Désactivé",
  On: "Activé",
  "Configuration saved": "Configuration enregistrée",
  "Failed to save configuration": "Échec de l'enregistrement de la configuration",

  // --- Report catalog (sidebar groups + report titles) ----------------------
  Files: "Fichiers",
  Reconciliation: "Réconciliation",
  Correlation: "Corrélation",
  Operations: "Opérations",
  "Raw Record Sequence Check Report":
    "Rapport de vérification de séquence des enregistrements bruts",
  "Processed Record Sequence Check Report":
    "Rapport de vérification de séquence des enregistrements traités",
  "SDP Raw Record Sequence Check Report":
    "Rapport de vérification de séquence des enregistrements bruts SDP",
  "File Sequence Check Report": "Rapport de vérification de séquence des fichiers",
  "File Exception Report": "Rapport des exceptions de fichiers",
  "AIR Reconciliation Report": "Rapport de réconciliation AIR",
  "SDP Reconciliation Report": "Rapport de réconciliation SDP",
  "MSC Reconciliation Report": "Rapport de réconciliation MSC",
  "Report Batch Log": "Journal des lots de rapports",

  // --- Reports --------------------------------------------------------------
  Reports: "Rapports",
  "Revenue-assurance reports — pick a report from the sidebar to drill down and export.":
    "Rapports d'assurance des revenus — choisissez un rapport dans le menu latéral pour explorer et exporter.",
  "Select a report": "Sélectionnez un rapport",
  "Live · 30s": "En direct · 30s",
  "Auto-refreshes every 30 seconds": "Actualisation automatique toutes les 30 secondes",
  "findings · showing up to 100": "résultats · affichage limité à 100",
  "Exporting…": "Exportation…",
  "Export CSV": "Exporter en CSV",
  "This report is not available yet.": "Ce rapport n'est pas encore disponible.",
  "Loading…": "Chargement…",
  "No rows match the current filters.": "Aucune ligne ne correspond aux filtres actuels.",
  "No data available for this report yet.":
    "Aucune donnée disponible pour ce rapport pour l'instant.",
  "Export failed": "Échec de l'exportation",

  // --- Report filters / pagination ------------------------------------------
  Filters: "Filtres",
  "Search all columns…": "Rechercher dans toutes les colonnes…",
  All: "Tous",
  "Date column to filter on": "Colonne de date à filtrer",
  "From date": "Date de début",
  "To date": "Date de fin",
  "Clear filters": "Effacer les filtres",
  "Rows per page": "Lignes par page",
  "First page": "Première page",
  "Previous page": "Page précédente",
  "Next page": "Page suivante",
  "Last page": "Dernière page",
  of: "sur",

  // --- Users ----------------------------------------------------------------
  "Manage operators, analysts and auditors who have access to RADONaix. Assign roles to control permissions.":
    "Gérez les opérateurs, analystes et auditeurs ayant accès à RADONaix. Attribuez des rôles pour contrôler les autorisations.",
  "Add a new user": "Ajouter un nouvel utilisateur",
  "Add user": "Ajouter un utilisateur",
  "Search by name or email": "Rechercher par nom ou e-mail",
  "All roles": "Tous les rôles",
  "All status": "Tous les statuts",
  Active: "Actif",
  Disabled: "Désactivé",
  Inactive: "Inactif",
  "Full Name": "Nom complet",
  Phone: "Téléphone",
  Status: "Statut",
  "No users match the current filters.":
    "Aucun utilisateur ne correspond aux filtres actuels.",
  "No data found": "Aucune donnée trouvée",
  "Edit user": "Modifier l'utilisateur",
  "Reset password": "Réinitialiser le mot de passe",
  "Deactivate account": "Désactiver le compte",
  "Activate account": "Activer le compte",
  "User updated": "Utilisateur mis à jour",
  "User created": "Utilisateur créé",
  "Failed to save user": "Échec de l'enregistrement de l'utilisateur",
  "Account activated": "Compte activé",
  "Account deactivated": "Compte désactivé",
  "is now": "est désormais",
  active: "actif",
  disabled: "désactivé",
  "Failed to update status": "Échec de la mise à jour du statut",
  "Password reset sent to": "Réinitialisation du mot de passe envoyée à",
  "Confirm Deactivation": "Confirmer la désactivation",
  "Confirm Activation": "Confirmer l'activation",
  "This action will deactivate": "Cette action désactivera",
  "This action will activate": "Cette action activera",
  "The user will no longer be able to access the application.":
    "L'utilisateur ne pourra plus accéder à l'application.",
  "and allow access based on assigned permissions.":
    "et autorisera l'accès selon les autorisations attribuées.",
  "this account": "ce compte",
  "Confirm Deactivate": "Confirmer la désactivation",
  "Confirm Activate": "Confirmer l'activation",
  "Full name": "Nom complet",
  "Assigned role": "Rôle attribué",
  "Temporary password": "Mot de passe temporaire",
  "min 8 chars": "min. 8 caractères",
  Cancel: "Annuler",
  "Save user": "Enregistrer l'utilisateur",

  // --- Roles ----------------------------------------------------------------
  "Create roles, configure page-level access, and control which modules each role can view or edit.":
    "Créez des rôles, configurez l'accès au niveau des pages et contrôlez les modules que chaque rôle peut consulter ou modifier.",
  "Create a new role": "Créer un nouveau rôle",
  "Select role": "Sélectionner le rôle",
  "New role": "Nouveau rôle",
  Roles: "Rôles",
  Updated: "Mis à jour le",
  "Edit role": "Modifier le rôle",
  "Permission matrix": "Matrice des autorisations",
  "Save permission matrix": "Enregistrer la matrice des autorisations",
  "Save permissions": "Enregistrer les autorisations",
  "Module / Page": "Module / Page",
  View: "Consulter",
  Edit: "Modifier",
  "view-only supported": "consultation seule prise en charge",
  "Checking": "Cocher",
  "automatically grants": "accorde automatiquement",
  "Unchecking": "Décocher",
  "removes": "retire",
  "and hides the module from the sidebar.":
    "et masque le module du menu latéral.",
  "Permissions saved": "Autorisations enregistrées",
  "Updated for": "Mis à jour pour",
  "Failed to save permissions": "Échec de l'enregistrement des autorisations",
  "Role saved": "Rôle enregistré",
  "Failed to save role": "Échec de l'enregistrement du rôle",
  "Role name": "Nom du rôle",
  Description: "Description",
  "Save role": "Enregistrer le rôle",
  Close: "Fermer",

  // --- Pipelines ------------------------------------------------------------
  Live: "En direct",
  "every": "toutes les",
  updated: "mis à jour",
  Export: "Exporter",
  "Failed to load pipeline data:": "Échec du chargement des données du pipeline :",
  Retry: "Réessayer",
  "Loading pipeline data…": "Chargement des données du pipeline…",
  "Window:": "Fenêtre :",
  last: "derniers",
  batches: "lots",
  "Active Work Pools · Running": "Pools de travail actifs · En cours",
  "No pipelines currently running.": "Aucun pipeline en cours d'exécution.",
  "Failed / partial / crashed": "Échoué / partiel / interrompu",
  "Hide batches with no files": "Masquer les lots sans fichiers",
  "Show batches with no files": "Afficher les lots sans fichiers",
  failed: "échoué",
  partial: "partiel",
  "No issues in this window.": "Aucun problème sur cette période.",
  "Batch Status": "Statut des lots",
  "Flow Runs": "Exécutions de flux",
  "Batch durations (s) over the window": "Durées des lots (s) sur la période",
  total: "au total",
  "No batch data for the selected DAG / Stream.":
    "Aucune donnée de lot pour le DAG / flux sélectionné.",
  Failed: "Échoué",
  Partial: "Partiel",
  Success: "Réussi",
  Pending: "En attente",
  "Task Runs": "Exécutions de tâches",
  Completed: "Terminé",
  Events: "Événements",
  "AA Rows": "Lignes AA",
  "RR Rows": "Lignes RR",
  "Archived Files": "Fichiers archivés",
  Hour: "Heure",
  "Failed:": "Échoué :",
  "Partial:": "Partiel :",
  "Success:": "Réussi :",
  "Pending:": "En attente :",
  "No batches": "Aucun lot",
  Stream: "Flux",
  rows: "lignes",
  Watcher: "Surveillance",
  Decoder: "Décodeur",
  Ingestion: "Ingestion",
  Normalize: "Normalisation",
  Normalization: "Normalisation",
  Archived: "Archivés",
  Decoded: "Décodés",
  "Decode Failed": "Échec du décodage",
  Loaded: "Chargés",
  "Load Failed": "Échec du chargement",
  "Zero KB": "Zéro Ko",
  Duplicates: "Doublons",
  Corrupt: "Corrompus",
  Quarantined: "Mis en quarantaine",
  "Retried By": "Réessayé par",
  "Error:": "Erreur :",
  "Validation:": "Validation :",
  "Quarantine:": "Quarantaine :",
  Started: "Démarré",
  "files watched": "fichiers surveillés",
  complete: "terminé(s)",
  loaded: "chargé(s)",
  "rows normalized": "lignes normalisées",
  "Files watched": "Fichiers surveillés",
  Duplicate: "Doublon",
  Complete: "Terminé",
  Quarantine: "Quarantaine",
  Throughput: "Débit",
  "Average Latency": "Latence moyenne",
  "SLA Breaches": "Dépassements de SLA",
  "Failed in last 24h": "Échecs sur les dernières 24 h",

  // --- Export dialog --------------------------------------------------------
  "Export Batch Data": "Exporter les données de lots",
  "Filter the dataset, preview results, then download as CSV or drill into file-level logs.":
    "Filtrez le jeu de données, prévisualisez les résultats, puis téléchargez en CSV ou explorez les journaux au niveau des fichiers.",
  "DAG Type": "Type de DAG",
  "Stream Type": "Type de flux",
  From: "De",
  To: "À",
  "Search Batch ID": "Rechercher un ID de lot",
  "Reset filters": "Réinitialiser les filtres",
  Showing: "Affichage de",
  "records (filtered from": "enregistrements (filtrés sur",
  records: "enregistrements",
  "No records match the current filters.":
    "Aucun enregistrement ne correspond aux filtres actuels.",
  "View files": "Voir les fichiers",
  "Rows per page:": "Lignes par page :",
  Prev: "Préc.",
  Next: "Suiv.",
  Page: "Page",
  "Download CSV": "Télécharger en CSV",
  Back: "Retour",
  "File logs ·": "Journaux de fichiers ·",
  "Back to batches": "Retour aux lots",
  "File Status": "Statut du fichier",
  "File Type": "Type de fichier",
  "Search Filename": "Rechercher un nom de fichier",
  files: "fichiers",
  "No files match the current filters.":
    "Aucun fichier ne correspond aux filtres actuels.",
  "Loading files for": "Chargement des fichiers pour",
  "Failed to load files:": "Échec du chargement des fichiers :",
  Type: "Type",
  Start: "Début",
  End: "Fin",

  // --- MultiSelect ----------------------------------------------------------
  "Select…": "Sélectionner…",
  "Select all": "Tout sélectionner",
  Clear: "Effacer",
  selected: "sélectionné(s)",

  // --- Tooltip descriptions -------------------------------------------------
  "Open or close the navigation menu": "Ouvrir ou fermer le menu de navigation",
  "Change the assurance scope": "Changer le périmètre d'assurance",
  "Open the settings menu": "Ouvrir le menu des paramètres",
  "Sign out of your account": "Se déconnecter de votre compte",
  "Open the account menu": "Ouvrir le menu du compte",
  "Expand or collapse the reports list":
    "Développer ou réduire la liste des rapports",
  "Refresh the dashboard": "Actualiser le tableau de bord",
  "Show or hide the password": "Afficher ou masquer le mot de passe",
  "Save the configuration changes":
    "Enregistrer les modifications de configuration",
  "View this dashboard": "Afficher ce tableau de bord",
  "Download the report as CSV": "Télécharger le rapport au format CSV",
  "Show data for the last": "Afficher les données des derniers",
  "Export pipeline data": "Exporter les données du pipeline",
  "Retry loading the data": "Réessayer de charger les données",
  "Show batch details": "Afficher les détails du lot",
  "Hide batch details": "Masquer les détails du lot",
  "Show pipeline stages": "Afficher les étapes du pipeline",
  "Hide pipeline stages": "Masquer les étapes du pipeline",
  "Edit this user": "Modifier cet utilisateur",
  "Reset this user's password":
    "Réinitialiser le mot de passe de cet utilisateur",
  "Deactivate this account": "Désactiver ce compte",
  "Activate this account": "Activer ce compte",
  "Discard changes": "Annuler les modifications",
  "Save this user": "Enregistrer cet utilisateur",
  "Edit this role": "Modifier ce rôle",
  "View this role's permissions": "Afficher les autorisations de ce rôle",
  "Save the permission changes": "Enregistrer les modifications d'autorisations",
  "Save this role": "Enregistrer ce rôle",
  "Close this dialog": "Fermer cette fenêtre",
  "Confirm this action": "Confirmer cette action",
  "Cancel and close": "Annuler et fermer",
  "Select one or more options": "Sélectionner une ou plusieurs options",
  "Select all options": "Sélectionner toutes les options",
  "Clear the selection": "Effacer la sélection",
  "Reset all filters": "Réinitialiser tous les filtres",
  "View this batch's files": "Afficher les fichiers de ce lot",
  "Go to first page": "Aller à la première page",
  "Go to previous page": "Aller à la page précédente",
  "Go to next page": "Aller à la page suivante",
  "Go to last page": "Aller à la dernière page",
  "Download the data as CSV": "Télécharger les données au format CSV",
  "Go back": "Revenir en arrière",
  "Go back to the batch list": "Revenir à la liste des lots",
  "Edit your profile": "Modifier votre profil",
  "Change your password": "Changer votre mot de passe",
  "Expand the sidebar": "Développer le menu latéral",
  "Collapse the sidebar": "Réduire le menu latéral",

  // --- Page header info descriptions ----------------------------------------
  "View your account details and switch the application language.":
    "Consultez les détails de votre compte et changez la langue de l'application.",
  "Live revenue-assurance KPIs and the embedded Superset analytics dashboard.":
    "Indicateurs d'assurance des revenus en direct et tableau de bord Superset intégré.",
  "Browse certified revenue-assurance reports and export their findings.":
    "Parcourez les rapports certifiés d'assurance des revenus et exportez leurs résultats.",
  "Monitor processing pipelines, batch status and job health in real time.":
    "Surveillez les pipelines de traitement, l'état des lots et la santé des tâches en temps réel.",
  "System and application health metrics, powered by Prometheus and Grafana.":
    "Métriques de santé du système et de l'application, propulsées par Prometheus et Grafana.",
  "An immutable record of every operator and system action.":
    "Un enregistrement immuable de chaque action des opérateurs et du système.",
  "Global runtime settings for the assurance platform.":
    "Paramètres d'exécution globaux de la plateforme d'assurance.",
  "Create and manage users and assign their roles.":
    "Créez et gérez les utilisateurs et attribuez leurs rôles.",
  "Define roles and control each module's access permissions.":
    "Définissez les rôles et contrôlez les autorisations d'accès de chaque module.",

  // --- Report descriptions (info hint on the Reports page) ------------------
  "Detects gaps in the sequence of raw CDR records for each file and node. Each row flags a missing sequence range so dropped or lost records can be investigated.":
    "Détecte les ruptures dans la séquence des enregistrements CDR bruts pour chaque fichier et nœud. Chaque ligne signale une plage de séquence manquante afin d'enquêter sur les enregistrements perdus.",
  "Checks sequence continuity of processed records per file and node. Highlights missing sequence ranges introduced during processing so they can be traced.":
    "Vérifie la continuité de la séquence des enregistrements traités par fichier et par nœud. Met en évidence les plages de séquence manquantes apparues durant le traitement.",
  "Sequence-gap check for raw SDP records per file and node. Surfaces missing sequence ranges to catch records lost from the SDP source feed.":
    "Contrôle des ruptures de séquence pour les enregistrements SDP bruts par fichier et nœud. Fait ressortir les plages manquantes pour repérer les enregistrements perdus du flux SDP.",
  "Verifies that expected files arrive in sequence for each source and node. Flags missing or out-of-order files in the collection stream.":
    "Vérifie que les fichiers attendus arrivent dans l'ordre pour chaque source et nœud. Signale les fichiers manquants ou hors séquence dans le flux de collecte.",
  "Lists files that failed processing or arrived in an abnormal state. Use it to track rejected, corrupt or exception-flagged files per source.":
    "Liste les fichiers dont le traitement a échoué ou arrivés dans un état anormal. Permet de suivre les fichiers rejetés, corrompus ou signalés en exception par source.",
  "Reconciles raw versus processed AIR transactions and account balances per subscriber. Highlights amount or balance mismatches that may indicate revenue leakage.":
    "Réconcilie les transactions et soldes AIR bruts et traités par abonné. Met en évidence les écarts de montants ou de soldes pouvant indiquer une fuite de revenus.",
  "Reconciles SDP transactions between the source and processed data, surfacing discrepancies in amounts and balances. (Coming soon.)":
    "Réconcilie les transactions SDP entre les données source et traitées, en faisant ressortir les écarts de montants et de soldes. (Bientôt disponible.)",
  "Reconciles MSC call detail records between the source and processed data to detect mismatches. (Coming soon.)":
    "Réconcilie les enregistrements détaillés d'appels MSC entre les données source et traitées pour détecter les écarts. (Bientôt disponible.)",
  "Execution log of report-generation batches. Shows each run's process, start and end time, status and any error encountered.":
    "Journal d'exécution des lots de génération de rapports. Affiche pour chaque exécution le processus, les heures de début et de fin, le statut et toute erreur rencontrée.",

  // --- Filter descriptions (info hints on filter labels) --------------------
  "The source processing pipeline — AIR, MSC or SDP. Select one or more to filter the batches shown below.":
    "Le pipeline de traitement source — AIR, MSC ou SDP. Sélectionnez-en un ou plusieurs pour filtrer les lots affichés ci-dessous.",
  "The processing stage of the data — Raw (collected), Processed (decoded/loaded) or Reconciled. Choose which streams to include.":
    "L'étape de traitement des données — Brut (collecté), Traité (décodé/chargé) ou Réconcilié. Choisissez les flux à inclure.",
  "Filter batches by their source pipeline — AIR, MSC or SDP.":
    "Filtrer les lots par pipeline source — AIR, MSC ou SDP.",
  "Filter batches by processing stage — Raw, Processed or Reconciled.":
    "Filtrer les lots par étape de traitement — Brut, Traité ou Réconcilié.",
  "Filter batches by outcome — success, partial, failed, pending or running.":
    "Filtrer les lots par résultat — réussi, partiel, échoué, en attente ou en cours.",
  "Filter files by their processing outcome — success, failed, pending, running, duplicate or complete.":
    "Filtrer les fichiers par résultat de traitement — réussi, échoué, en attente, en cours, doublon ou terminé.",
  "Filter files by record type — AA, RR or CDR.":
    "Filtrer les fichiers par type d'enregistrement — AA, RR ou CDR.",
  "Narrow the rows below by text search, by a column's value, or by a date range. Filters apply to the rows currently loaded.":
    "Affinez les lignes ci-dessous par recherche de texte, par valeur de colonne ou par plage de dates. Les filtres s'appliquent aux lignes actuellement chargées.",

  // --- Status values (rendered via StatusBadge) -----------------------------
  SUCCESS: "RÉUSSI",
  FAILED: "ÉCHOUÉ",
  PARTIAL: "PARTIEL",
  PENDING: "EN ATTENTE",
  RUNNING: "EN COURS",
  IN_PROGRESS: "EN COURS",
  COMPLETE: "TERMINÉ",
  DUPLICATE: "DOUBLON",
  "In Progress": "En cours",
  Warning: "Avertissement",
  OK: "OK",
};
