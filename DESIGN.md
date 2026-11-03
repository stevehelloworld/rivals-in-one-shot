---
name: RIVALS
description: Competitive broadcast lobby and combat HUD.
colors:
  background: "#0a111d"
  panel: "#101b2b"
  selected: "#356fe7"
  primary: "#f5d84f"
  text: "#f3f6fa"
  muted: "#aebbd0"
  rival: "#ff9b88"
typography:
  display:
    fontFamily: "Barlow Condensed"
    fontWeight: 800
  body:
    fontFamily: "Barlow"
    fontWeight: 400
rounded:
  control: "4px"
  dialog: "12px"
---

## Overview

The arena preview sets the scene. The match sheet uses the visual language of a
competitive broadcast: strong lettering, fine rules and distinct team colors.

## Colors

Yellow signals the main action. Cobalt identifies selection and the player;
coral identifies the rival or damage. Use navy backing behind combat text.

## Typography

Use condensed lettering for scores, headings and action labels. Use regular
Barlow for instructions, room status and settings.

## Layout

Stack the arena above the match sheet on narrow screens. Place them side by
side on desktop. In combat, anchor persistent information to the edges and
reserve the center for aiming.

## Components

Mode tabs use a solid selected fill; difficulty uses an underline. Touch
actions stay at least 44 pixels wide and preserve saved player layouts.
