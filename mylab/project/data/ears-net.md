# `ears-net.csv`: national reference values for the map

Real country-level antimicrobial resistance figures from the European Antimicrobial Resistance
Surveillance Network (EARS-Net, ECDC). They are shown in the European view of `/map`, next to the same
indicator computed from the synthetic extract. Unlike the rest of `data/`, these figures are not
synthetic.

## Source

ECDC, _Antimicrobial resistance – Annual Epidemiological Report – Country summaries – 2024 data_
(published 18 November 2025), linked from the
[EARS-Net data page](https://www.ecdc.europa.eu/en/about-us/networks/disease-networks-and-laboratory-networks/ears-net-data):
<https://www.ecdc.europa.eu/sites/default/files/documents/antimicrobial-resistance-annual-epidemiological-report-country-summaries-2024-data.pdf>

For each country, the values come from the table _"Total number of invasive isolates tested (n) and
percentage of isolates with resistance phenotype (%)"_, 2024 columns. Every row also carries the
EU/EEA population-weighted mean printed on the same line of the report (16.0 % for E. coli 3GC,
14.2 % for MRSA); this was used to check that the right row and column were extracted. Spot checks:
Finland 7.5 % (n = 4 132) and 3.7 % (n = 2 294); Ireland 11.9 %, matching the Irish national
report (12 %). Liechtenstein is not included: too few isolates (reported as NA).

## Format

| Column              | Meaning                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| `iso3`              | ISO 3166-1 alpha-3 code                                                     |
| `iso_numeric`       | ISO 3166-1 numeric code (matches the `world-atlas` shapes)                  |
| `country`           | Country name                                                                |
| `indicator`         | `ecoli_3gc_resistant` or `saureus_mrsa` (other values are ignored)          |
| `year`              | Data year                                                                   |
| `isolates_tested`   | Invasive isolates tested (n)                                                |
| `percent_resistant` | % resistant (E. coli: cefotaxime/ceftriaxone/ceftazidime; S. aureus: MRSA)  |
| `eu_eea_mean`       | EU/EEA population-weighted mean for the same indicator and year             |
| `source`            | Publication the row was taken from                                          |

To update: add the rows of a newer report (same columns, new `year`) and remove the old ones. The
page shows whatever the file contains; with an empty file (header only) the European map is drawn
grey with "no data" and the regional view is unaffected.
