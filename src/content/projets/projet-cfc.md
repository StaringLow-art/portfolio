---
title: "Supervision d'infrastructure avec PRTG"
summary: "Travail pratique individuel de CFC : mise en place d'une solution de supervision pour un environnement hybride, physique et virtualisé. Note obtenue : 5.6/6."
order: 2
role: "Travail pratique individuel (TPI), avril à mai 2026"
technologies:
  - "PRTG Network Monitor"
  - "Proxmox VE"
  - "Windows Server 2022"
  - "Windows 10"
  - "Ubuntu"
  - "SNMPv3"
  - "WMI"
  - "SSH"
  - "Cisco Catalyst 2960-S"
  - "Netgear Nighthawk AX2400"
cover: "../../assets/projets/projet-cfc-prtg.png"
coverAlt: "Capture du tableau de bord PRTG : routeur, switch et hyperviseur Proxmox VE avec leurs capteurs"
# Vignette : garder le haut de la capture ; lien vers l'image en taille réelle
coverPosition: "50% 0%"
coverZoom: true
draft: false
documents: []
---

## Contexte

Ce projet a été réalisé pour la validation de mon CFC d'informaticien en exploitation et infrastructure. L'objectif était de mettre en place, configurer et valider une petite infrastructure capable de surveiller plusieurs types de systèmes en temps réel, dans un scénario pouvant illustrer un petit environnement professionnel.

## Ce que j'ai réalisé

J'ai configuré un serveur HPE ProLiant MicroServer Gen10 Plus v2 comme hyperviseur Proxmox VE, avec trois machines virtuelles : un Windows Server 2022 hébergeant PRTG, un client Windows 10 et un client Ubuntu. J'ai aussi intégré à la supervision un switch Cisco Catalyst 2960-S et un routeur Netgear Nighthawk AX2400. J'ai configuré des capteurs pour suivre la disponibilité, l'utilisation du CPU et de la RAM, le stockage, les services critiques (SSH, RDP et HTTP) et le trafic réseau. J'ai défini des seuils d'alerte pour chaque type de métrique et créé un tableau de bord donnant une vue d'ensemble de l'infrastructure.

## Résultat

Tous les objectifs du cahier des charges ont été atteints. La solution est fonctionnelle, documentée et testée, et le projet a obtenu la note de 5.6/6.
