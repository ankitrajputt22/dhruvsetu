# Real data sources

Every record that `python -m app.seed` adds is listed here with the source it
comes from. The records themselves are in `backend/app/seed.py`. All sources
were read on 4 October 2026.

Rules followed:

- A fact is stored only if a listed source states it. Nothing is estimated or
  invented: no names, dates, coordinates, numbers, findings or DOIs.
- A relationship between two records is stored only if a source states it.
  Where no source links two records, they are not linked.
- A file is kept in this repository only when its licence allows it. Other
  sources are linked, not copied.
- A real source is not the same as a verified record. Every seeded record
  starts as **Uploaded**. An admin marks it Reviewed and then Verified.
- No record is marked as demo data (`is_demo_data` is false for all of them).

## Reuse terms, in short

| Source | Terms | What DhruvSetu does |
|---|---|---|
| NCPOR website (ncpor.res.in) | "All Rights Reserved" | Uses facts and links only. No NCPOR report, page text or photograph is copied. |
| NCPOR Polar Data Centre (data.ncpor.res.in) | Data policy: free and open access, with the data owners acknowledged | Keeps one data table as CSV, with the authors and the paper named. |
| Press Information Bureau (pib.gov.in) | Copyright policy: material may be reproduced free of charge if reproduced accurately and the source is acknowledged | Keeps four press releases as text, each with its title, date and link. |
| Copernicus journals (The Cryosphere, ACP, Biogeosciences) | Open access, CC BY 4.0 (CC BY 3.0 for the 2012 paper) | Keeps five papers as PDF, unchanged, with authors, journal and DOI. |
| MDPI (Remote Sensing) | Open access, CC BY 4.0 | Stores the citation and DOI only. The PDF could not be downloaded automatically. |
| Zenodo | CC BY 4.0 for the dataset used | Keeps the data sheet as CSV, with the authors and DOI named. |
| Crossref (api.crossref.org) | Open bibliographic metadata | Used to check titles, authors, journals, years and DOIs. |
| ORCID (orcid.org) | Public record | Linked as the official page of two authors. Nothing is copied from it. |

## Institutions (3)

| Record | Source | Fields taken |
|---|---|---|
| National Centre for Polar and Ocean Research (NCPOR) | https://ncpor.res.in | Name, role in the Antarctic and Arctic programmes, website |
| Ministry of Earth Sciences (MoES) | https://www.moes.gov.in | Name, role, website |
| Indian Institute of Tropical Meteorology (IITM), Pune | http://www.tropmet.res.in/ and the two sources that name it: Mahajan et al. (2021) and the PIB release of 18 December 2023 | Name, website, what it did in the two sources |

## Research stations (3) and field sites (2)

Coordinates are the published values, converted to decimal degrees and rounded
to six places. The published form is the limit of their precision.

| Record | Published coordinate | Source |
|---|---|---|
| Bharati | 69°24.41′ S, 76°11.72′ E | NCPOR Bharati page, https://ncpor.res.in/antarcticas/display/377-bharati |
| Maitri | 70°45′52″ S, 11°44′03″ E | NCPOR Maitri page, https://ncpor.res.in/antarcticas/display/376-maitri- |
| Himadri | 78°55′ N, 11°56′ E | NCPOR Arctic data portal, https://ncpor.res.in/app/webroot/pages/view/340-himadri-station |
| Kongsfjorden (IndARC mooring site) | 78°56′ N, 12° E | NCPOR IndARC page, https://ncpor.res.in/arctics/display/398-indarc |
| Djupranen Ice Rise | 70.18° S, 9.18° E | Dey et al. (2026), https://doi.org/10.5194/tc-20-4117-2026 |

Fields taken: name, region, coordinates, and a short description that repeats
only what the source says (for example the commissioning date of Bharati and
the inauguration date of Himadri). Some NCPOR data pages give slightly different
coordinates for Maitri. Only the values of the NCPOR Maitri station page are
used.

## Expeditions (4)

| Record | Source | Fields taken |
|---|---|---|
| 41st Indian Scientific Expedition to Antarctica | PIB release of 15 November 2021, https://www.pib.gov.in/PressReleasePage.aspx?PRID=1771934 | Name, the two programmes, the partner institutes, the stations (Maitri, Bharati) |
| 43rd Indian Scientific Expedition to Antarctica | PIB release of 6 January 2024, https://www.pib.gov.in/PressReleasePage.aspx?PRID=1993769 | Name, the ship and its departure, the number of members, the leader (Dr Yogesh Ray) |
| 14th Indian Arctic Expedition (2023-24) | NCPOR expedition report 2023-24, https://www.ncpor.res.in/files/14-Arctic_Expedition-2023-24_Report-Low_Resolution.pdf, and the PIB release of 18 December 2023 | Name, number of projects, the winter expedition, two participants named in the report |
| 15th Indian Arctic Expedition (2024-25) | NCPOR expedition report 2024-25, https://ncpor.res.in/files/Indian_Arctic_Expedition-2024-25_Report_compressed.pdf | Name, batches, number of projects, the IndARC redeployment, the first working day (20 May 2024) |

A start date is stored only for the 15th Arctic expedition, because only its
source gives an exact day. No end date is stored for any expedition.

Relationships stored, each stated by the source of the expedition:

- 41st Antarctic expedition: Maitri and Bharati.
- 43rd Antarctic expedition: Yogesh Ray, named as leader in the release.
- 14th Arctic expedition: Himadri; Archana Singh and Anand Jain, listed in the
  report as participants; the report record.
- 15th Arctic expedition: Himadri and Kongsfjorden; the report record.

No publication or dataset is linked to an expedition. The papers do not say
which numbered expedition their field work belonged to, so no link is made.

## Reports (2)

The two NCPOR Arctic expedition reports above. DhruvSetu stores the title, a
one-sentence description and the link. The reports are not copied, because the
NCPOR website is "All Rights Reserved".

## Scientists (13)

A profile holds a name, an institution, a designation, a research area and a
link to the official page. A field is left empty when the official page does
not give it. No biography is written and no portrait is used.

| Source | People |
|---|---|
| NCPOR staff profiles, `https://ncpor.res.in/profiles/details/<number>` | Thamban Meloth (21), Laluraj C. M. (26), Vikram Goel (255), Bhanu Pratap (328), Bhikaji Laxman Redkar (16), Babula Jena (98), Archana Singh (201), Anand Jain (179), Manish Tiwari (31), Nuncio Murukesh (65), Yogesh Ray (173) |
| ORCID record | Rahul Dey (0000-0002-8121-4777), Anoop S. Mahajan (0000-0002-2909-5432) |

For the two people linked by ORCID, the institution is the affiliation printed
in their papers listed below.

These records describe published researchers. They are not login accounts, and
no account is created in anyone's name.

## Publications (7)

Title, authors, journal, volume, pages, year and DOI were checked against
Crossref and the publisher's page. Each summary is written in DhruvSetu's own
words from the abstract and states the licence.

| Record | Journal | DOI | Licence |
|---|---|---|---|
| Goel et al. (2026), a new coastal ice-core site in Dronning Maud Land | The Cryosphere, 20, 1363-1378 | 10.5194/tc-20-1363-2026 | CC BY 4.0 |
| Dey et al. (2026), evolution of the Maud Rise Polynya over 250 years | The Cryosphere, 20, 4117-4131 | 10.5194/tc-20-4117-2026 | CC BY 4.0 |
| Jena and Pillai (2020), phytoplankton blooms in the Maud Rise polynya | The Cryosphere, 14, 1385-1398 | 10.5194/tc-14-1385-2020 | CC BY 4.0 |
| Mahajan et al. (2021), iodine monoxide at Bharati and Maitri | Atmospheric Chemistry and Physics, 21, 11829-11842 | 10.5194/acp-21-11829-2021 | CC BY 4.0 |
| Asutosh et al. (2021), cloud and precipitation at Ny-Ålesund | Remote Sensing, 13, 2808 | 10.3390/rs13142808 | CC BY 4.0 |
| Mahalinganathan et al. (2012), sea-salt snow chemistry in Princess Elizabeth Land | The Cryosphere, 6, 505-515 | 10.5194/tc-6-505-2012 | CC BY 3.0 |
| Jagtap et al. (2026), particulate organic matter in an Arctic fjord | Biogeosciences, 23, 4227-4242 | 10.5194/bg-23-4227-2026 | CC BY 4.0 |

A scientist profile is linked to a paper only when that person is one of its
authors. Co-authors without a profile appear in the author list only.

## Datasets (4)

| Record | Source | Local file | Notes |
|---|---|---|---|
| Maud Rise Polynya index and ice core proxy records, 1774-2016 | NCPOR Polar Data Centre, https://data.ncpor.res.in/static/datasets/MF131768238_evolution_of_maud_rise_polynya_during_the_last_250_years.xlsx (data of Dey et al., 2026) | `datasets/maud-rise-polynya-ice-core-dey-2026.csv` | 243 rows, 7 columns |
| Particulate organic matter composition in Kongsfjorden | Zenodo, https://doi.org/10.5281/zenodo.18457176 (Jagtap, Singh, Jain, Tiwari and Raj, 2026), CC BY 4.0 | `datasets/kongsfjorden-particulate-organic-matter-jagtap-2026.csv` | 12 rows, 92 columns |
| Surface station data: Dakshin Gangotri (1985-1989) and Maitri (1990-2010) | NCPOR data portal, https://data.ncpor.res.in/ant_temp_pres | None | The portal shows the data but offers no download link, so only the description and the link are stored. |
| Radar surveys of the Kamelryggen and Kupol Verbljud ice rises | Described in Goel et al. (2026); data at the NCPOR Polar Data Centre, https://data.ncpor.res.in | None | Description and link only. |

How the two files were made:

- Each source file is an Excel workbook. The data table was written to CSV so
  that the Dataset Explorer and the Data Lab can read it.
- Every row and every column of the table is kept. No value was changed,
  rounded or filled in. The one empty cell in the Kongsfjorden table is still
  empty.
- Excel stores a number with 17 digits, for example `80.126999999999995`. The
  CSV writes the shortest text that reads back as the same number, `80.127`.
  Every cell of both files was compared with its workbook again on 4 October
  2026, and each one is the same number.
- Column names are the ones in the source file. Only extra spaces were removed:
  spaces at the start or end of a name, and doubled spaces inside one.
- In the polynya workbook, the two note rows above the table ("For more
  details..." and "How to cite...") and the empty rows were left out. In the
  Kongsfjorden workbook, the empty rows below the table were left out. None of
  them holds data.

The description of each dataset names its authors, its source and this
conversion.

## Source documents (9)

These files are in `backend/data/documents`. They are read into text chunks for
search and for the assistant, with their page numbers.

| File | Source | Licence or terms | Linked to |
|---|---|---|---|
| `goel-2026-the-cryosphere-20-1363.pdf` | https://doi.org/10.5194/tc-20-1363-2026 | CC BY 4.0 | Its publication record |
| `dey-2026-the-cryosphere-20-4117.pdf` | https://doi.org/10.5194/tc-20-4117-2026 | CC BY 4.0 | Its publication record |
| `mahajan-2021-acp-21-11829.pdf` | https://doi.org/10.5194/acp-21-11829-2021 | CC BY 4.0 | Its publication record |
| `jagtap-2026-biogeosciences-23-4227.pdf` | https://doi.org/10.5194/bg-23-4227-2026 | CC BY 4.0 | Its publication record |
| `mahalinganathan-2012-the-cryosphere-6-505.pdf` | https://doi.org/10.5194/tc-6-505-2012 | CC BY 3.0 | Its publication record |
| `pib-2021-11-15-41st-scientific-expedition-to-antarctica.txt` | https://www.pib.gov.in/PressReleasePage.aspx?PRID=1771934 | PIB copyright policy | 41st Antarctic expedition |
| `pib-2023-12-18-first-winter-arctic-expedition.txt` | https://www.pib.gov.in/PressReleasePage.aspx?PRID=1987724 | PIB copyright policy | 14th Arctic expedition |
| `pib-2024-01-06-43rd-antarctic-expedition-voyage.txt` | https://www.pib.gov.in/PressReleasePage.aspx?PRID=1993769 | PIB copyright policy | 43rd Antarctic expedition |
| `pib-2025-02-13-scientific-studies-in-the-arctic.txt` | https://www.pib.gov.in/PressReleasePage.aspx?PRID=2102740 | PIB copyright policy | Nothing. It is about Arctic studies in general. |

- The PDFs are the publishers' files, unchanged. Each paper is © its authors
  and is distributed under the Creative Commons Attribution licence named
  above. The authors, journal and DOI are in the publication record and on the
  first page of each PDF.
- Each press release file starts with "Press Information Bureau, Government of
  India", the ministry, the title, the date and the link. The paragraphs of the
  release follow as published. Page navigation and images were left out.

## Research topics (8)

Cryosphere and Glaciology; Paleoclimate and Ice Cores; Sea Ice and Polynyas;
Southern Ocean; Atmospheric Science; Arctic Marine Biogeochemistry; Remote
Sensing; Geology and Geophysics.

The topics are DhruvSetu's own grouping, with a one-line description each. A
record is given a topic only when its source is plainly about it.

## Media records (4)

Photograph records for Maitri (two), the Schirmacher Hills and Ny-Ålesund, each
with a link to its Wikimedia Commons file page. The image files and their
licences are listed in `frontend/public/images/ATTRIBUTIONS.md`.

## What was removed

The earlier synthetic records are deleted by `python -m app.seed`: 2
institutions, 5 scientists, 3 expeditions, 4 topics, 4 locations, 2 stations,
5 publications, 3 reports, 5 datasets, 6 media records and 3 documents. They
now exist only as test fixtures in `backend/tests`, where they are created for
a test run and removed after it.
