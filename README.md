# Mémento opérationnel IA – RCH (V2)

Décisions intégrées :
- **Online**, usage de **BarcodeDetector**.
- **Types de champs étendus** : `textarea`, `date`, `time`, `datetime`, `radio`, `multiselect` (en plus de `text`, `number`, `select`, `gps`, `photo`).
- **Rattachement automatique** : si un IA possède `upload_url`, l’app envoie `multipart/form-data` (prompt + photos). Sinon, création automatique d’un **bundle** local (txt) puis ouverture de l’IA.
- **i18n FR/EN** (sélecteur dans l’en-tête).
- **Design** verrouillé selon la maquette ; libellés FR stables.

## Schéma JSON (V2)
```json
{
  "titre_fiche": "Analyse produit",
  "version": "V0",
  "categorie": "Analyse",
  "objectif": "Réaliser l'analyse d'un produit",
  "references_bibliographiques": ["INRS","ADR","NIOSH"],
  "champs_entree": [
    {"id":"code_onu","label":"Code ONU","type":"text","obligatoire":false},
    {"id":"description","label":"Description","type":"textarea","obligatoire":false},
    {"id":"urgence","label":"Urgence","type":"radio","options":[{"label":"Faible","value":"faible"},{"label":"Haute","value":"haute"}]},
    {"id":"equipements","label":"EPI disponibles","type":"multiselect","options":[{"label":"ARI","value":"ARI"},{"label":"APR","value":"APR"}]},
    {"id":"gps_site","label":"Localisation","type":"gps"},
    {"id":"photo_scene","label":"Photo","type":"photo"}
  ],
  "prompt": "Texte avec variables {{code_onu}}, etc.",
  "ia_cotation": {
    "chatgpt":   { "score": 3, "paid": true,  "label": "ChatGPT",
                   "url": "https://chat.openai.com/?q=%q%",
                   "upload_url": null, "upload_prompt_field": "prompt", "upload_file_field_prefix": "file" },
    "perplexity":{ "score": 3, "paid": true,  "label": "Perplexity",
                   "url": "https://www.perplexity.ai/search?q=%q%" },
    "lechat":    { "score": 2, "paid": false, "label": "Le Chat",
                   "url": "https://chat.mistral.ai/chat?input=%q%" },
    "gemini":    { "score": 2, "paid": true,  "label": "Gemini",
                   "url": "https://gemini.google.com/app?hl=fr&q=%q%" },
    "copilot":   { "score": 1, "paid": false, "label": "Copilot",
                   "url": "https://copilot.microsoft.com/?q=%q%" }
  },
  "infos_complementaires": "Etat: Maquette ; Auteur: ..."
}
```
> **Note** : pour un rattachement 100% automatique, fournissez un `upload_url` côté IA (avec CORS autorisé). L’app enverra `prompt.txt` + photos en `multipart/form-data` **avant** d’ouvrir l’URL de l’IA.

## QR maker
`qr-maker.html` (identique V1) génère un QR **data:application/json;base64** avec **pastille centrale**.

## Limitations navigateurs
L’upload direct vers une IA **nécessite** qu’elle publie un endpoint CORS. À défaut, l’app crée un bundle local (texte) puis ouvre l’IA (l’utilisateur pourra glisser-déposer les fichiers).

