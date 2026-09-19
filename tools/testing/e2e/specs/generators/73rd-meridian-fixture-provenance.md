# 73rd Meridian marketing fixture provenance

-   Russian source: `.backup/Лендинг-для-Консорциума.md`
-   Russian source SHA-256: `9587951419350b4e0301e74e64ba8dc3ae099cd2b312ff3ddbced562d7ad2e7a`
-   English content status: faithful translation of the recorded Russian landing draft; human publication approval remains an editorial step outside the fixture generator.
-   Hero editorial choice: the fixture uses the investment-oriented source headline `73-й Меридиан — новый индустриально-логистический коридор Север–Юг`. The alternative headline remains source material and is not emitted as a competing Hero title.
-   Contacts: the fixture publishes the verified Consortium destinations only — the Telegram channel `https://t.me/meridian73omsk`, the email `igor_glushkov@mail.ru` (`mailto:`) and the phone `+7-913-602-21-53` (`tel:+79136022153`). Every previously used demo destination (VK, Max, 2GIS, the placeholder phone) stays omitted and is asserted as absent by the contract.
-   CTA destinations: the draft contains button labels but no approved destinations, so the fixture disables the Hero lead form and does not emit functional CTA links.
-   Central media: `https://mui.com/static/screenshots/material-ui/getting-started/templates/dashboard.jpg` is the user-requested temporary editable placeholder for the standalone `marketing.image` widget.
-   Partner ecosystem media: partner categories are rendered as text-only labels because the source contains categories, not approved customer/company logos. No third-party artwork is embedded.
-   MUI demo content: customer/company names, testimonial people, pricing tiers, newsletter copy, and demo avatars are removed before export. Activity cards keep no authored media, and the renderer now shows an icon-only placeholder instead of the original MUI template screenshots.
-   Header widgets: the configuration is authored from the `marketing-page` metahub template and then adjusted — the language and color-mode switchers stay enabled for the RU/EN audience, while the authentication widget remains in the layout but is disabled via `isActive: false`.
-   Investment stages: the three funding stages stay in a single `marketing.pricing` widget with `cardStyle: 'uniform'` (equal cards, no highlighted tier) while `cardWidth: 'auto'` keeps the cards inside the base layout width (the wider `full` container stays available as a widget setting); the cards carry up to five benefits per stage, financing lives in the tier description and the stage horizon/mandates in the benefits.
-   Areas of activity: the widget enables `fixedItemsHeight`, so the card list scrolls inside the template-height area instead of stretching the section.
