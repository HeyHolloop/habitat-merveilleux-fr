# Habitat Merveilleux — dessin

Mesures prises sur le HTML live de https://www.studio27interieur.fr/ (home + article « Lampe de chevet ») le 10 octobre 2026. Ce fichier oriente le moule Astro. Pas d’Elementor, pas du chrome Astra recopié, pas du logo « nos maisons ».

## Palette (tokens extraits)

- Papier : `#ffffff`
- Encre : `#2a2a2a` (`--ast-global-color-0`)
- Encre secondaire : `#444444` / `#545454`
- Lien / accent : `#2a8ed1` (couleur `a`, item de menu courant, focus)
- Fond discret : `#f7f8f9`
- Filet : `#dddddd`
- Fond menu actif : `#2a8ed1` + texte blanc

## Typo

- Corps : Open Sans 400 / 600, latin + latin-ext, self-host
- Titraille / masthead : DM Serif Display 400, latin + latin-ext, self-host
- Corps 16px / 1.7. H1 article ~2rem serif. H2 corps ~1.45rem serif.

## Colonne

- Coquille site : 1200px (`--ast-normal-container-width`)
- Colonne d’article : 750px (`--ast-narrow-container-width`)
- Gouttière 1.25rem. Fond page blanc.

## Header

- Barre blanche, filet bas `#dddddd`
- Masthead à gauche : « Habitat Merveilleux » en DM Serif Display, pas un carré de deux lettres, pas le PNG cropped-logo-nos-maisons
- Nav à droite : Décoration, Travaux et bricolage, Jardin, Immobilier, Vie pratique
- Rubrique courante : fond `#2a8ed1`, texte blanc, pas d’arrondi SaaS
- Mobile : masthead + bouton texte « Menu », liste empilée

## Home

- H1 unique : Habitat Merveilleux (serif)
- Chapô court sous le H1, pas de CTA qui pousse un lien
- Grille de 5 rubriques (cartes blanches, filet, titre serif)
- Derniers articles en cartes : image 16/10, kicker, titre

## Cartes

- Filet 1px `#dddddd`, fond blanc, pas d’ombre `shadow-lg`, pas de `rounded-xl`
- Image pleine largeur, titre serif 1.15rem, kicker 0.75rem uppercase tracking, couleur accent

## Article

- Fil d’Ariane 0.85rem
- Kicker rubrique accent
- H1 serif
- Meta : Par Habitat Merveilleux · date
- Cover pleine colonne
- Corps : liens `#2a8ed1` soulignés uniquement dans le corps
- Aside latérale : 5 derniers titres, filet gauche accent
- Suite : 3–4 cartes même rubrique

## Footer

- Fond `#2a2a2a`, texte `#f7f8f9`, liens blancs
- Colonne marque + rubriques + pages (Mentions, Confidentialité, Cookies, Contact)
- Pas de RCS, pas d’adresse, pas d’OVELIUM, pas de gérant

## Peau Nuclear

Préfixe `hm`. Fichier `article-blocks.css` : mêmes tokens (Open Sans / DM Serif Display / `#2a8ed1` / `#2a2a2a` / blanc).
