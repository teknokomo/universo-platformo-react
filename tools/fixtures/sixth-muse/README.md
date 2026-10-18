# Sixth Muse reviewed content fixture

The reviewed runtime edition contains 30 questions in three blocks. All 30 rows are scoring-approved, with zero unresolved or author-decision-required rows. The earlier “13 unresolved” count is stale; `source.json` is the current content and evidence register.

Every source prompt and `sourceAnswer` remains verbatim from `.backup/Квиз-Шестая-муза.md`. Any scored wording or key change is recorded in `editorialMapping` and `provenanceReviewRegister`. Each runtime row has one evidence-backed correct option, three reviewed distractors, and per-option review notes and evidence references.

## Checks

Run from the repository root:

```sh
node tools/fixtures/sixth-muse/validate.mjs
node --test tools/fixtures/sixth-muse/contract.test.mjs
```

The validator compares the complete source transcription with the pinned Markdown SHA-256 and transcription digest. The contract tests cover exact provenance, one correct answer and three distinct distractors per row, citation integrity, source-specific resolutions, and the seeded option order.

Correct answer positions use a reproducible seeded Fisher–Yates shuffle with counts `8/7/7/8`; each row's distractors are shuffled from the same seed family. The seed, algorithm, and full position sequence are stored in `source.json`.

## Key reviewed evidence

The complete source register, including direct URLs and per-question references for correct answers and distractors, is in `source.json`. These sources document the rows that were previously weak or ambiguous:

-   Q1 narrows the two-sobriquet source clue to the museum-attested «Француз»: [Pushkin Museum study of Lyceum sobriquets](https://www.museumpushkin.ru/assets/files/pushkinsky_museum_2020.pdf).
-   Q4 ties «Крот» and its stated reason to a scholarly MGIMO account and Korf's memoir: [MGIMO, “Diplomats — Lyceum friends of A. S. Pushkin”](https://mgimo.ru/upload/2020/10/diplomaty-licejskie-druzya-a-s-pushkina.pdf).
-   Q7 uses the institutional source named in the prompt: [Culture.ru, “Alexander Pushkin: the fates of the poet's Lyceum friends”](https://www.culture.ru/materials/238554/sudby-liceistov).
-   Q10 retains Korf's “our Karamzin” wording, cross-checked by [Klin municipal library's Maslov biography](https://www.biblio-klin.ru/kray_otd/gordost_zemli/5777-maslov-dm.html).
-   Q17 uses the [Federal Archives catalog entry for Mikhail Yakovlev](https://portal.rusarchives.ru/guide/perech_12/perech20061223117_p_008.shtml); Q20 uses the [Pushkin Museum Lyceum guide](https://www.museumpushkin.ru/assets/files/annotaciya_v_zaly_2020.pdf) for Volkhovsky's military rank.
-   Q18 and Q26 use the [FEB critical-edition notes on Illichevsky](https://feb-web.ru/feb/pushkin/texts/push10/v01/d01-429.htm?cmd=p) and its [scholarly account of his translation work](https://feb-web.ru/feb/classics/critics/tomashevsky_b/tp/tp1-001-.htm?cmd=p).
-   Q29 relies on the [Russian Geographical Society's biography of Matyushkin](https://rgo.ru/activity/redaction/articles/voln-i-bur-lyubimoe-ditya-kak-litseist-fedor-matyushkin-stal-moryakom-i-polyarnikom/), which directly gives his age as 73.

Disputed source claims are preserved in provenance but excluded from scored runtime wording when the evidence does not settle them, including the competing «Тосе» form, the source's merged Maslov wording, Malinovsky's “oldest” ranking, Danzas's disputed birth year, and the incorrect claim that Kornilov and Maslov had matching full lifespans.
