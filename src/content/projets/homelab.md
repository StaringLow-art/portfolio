---
title: "Homelab"
summary: "Infrastructure personnelle auto-hébergée sous Proxmox, entièrement reconstruite pour héberger et sécuriser mes services."
order: 1
role: "Projet personnel : conception, installation et maintenance"
technologies:
  - "Proxmox VE"
  - "machines virtuelles"
  - "Immich"
  - "Vaultwarden"
  - "Pi-hole"
  - "Tailscale"
  - "ufw"
cover: "../../assets/projets/homelab.png"
coverAlt: "Le mot HOMELAB en grandes capitales blanches sur fond noir, avec un aplat bordeaux"
draft: false
documents: []
---

## Contexte

J'ai créé ce homelab pour héberger moi-même mes photos et mes mots de passe, et pour mettre en pratique l'administration d'une infrastructure dans la durée.

## Ce que j'ai réalisé

J'ai reconstruit l'infrastructure de zéro sous Proxmox VE, avec des machines virtuelles dédiées à mes services. J'y ai déployé Immich pour les photos et Vaultwarden pour les mots de passe, avec Pi-hole pour le filtrage DNS et Tailscale pour l'accès à distance. J'ai ajouté un pare-feu ufw sur les machines virtuelles, activé la double authentification sur les comptes liés, et mis en place des sauvegardes régulières des données et des machines.

## Résultat

La reconstruction s'est terminée en octobre 2026. Les services sont opérationnels, et les sauvegardes ont été vérifiées par des tests de restauration.
