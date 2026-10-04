"""The DhruvSetu starter repository: real, source-backed polar science records.

Run from the backend folder:

    python -m app.seed

The command is safe to run again. It removes the synthetic demo records that
older versions seeded, adds the real records below, and ingests the real
source documents. It never touches accounts, researcher requests or anything a
researcher submitted, and it keeps a verification status an admin has set.

Every fact here comes from the public source named beside it. The full list of
sources, with what was taken from each and the reuse terms, is in
backend/data/REAL_DATA_SOURCES.md. Nothing is estimated or invented, and a
relationship is only made where a source states it.
"""
from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.ingestion.service import DOCUMENT_STORE, ingest_document
from app.models import (
    Dataset,
    Document,
    Expedition,
    Institution,
    Location,
    MediaAsset,
    Publication,
    Report,
    ResearchStation,
    ResearchTopic,
    Scientist,
)

# --------------------------------------------------------------------------
# The synthetic records of earlier versions. They are only listed here so
# that they can be removed from an existing database, and so that tests can
# build temporary demo fixtures with the same IDs.
# --------------------------------------------------------------------------

DEMO_DATASET_FILE_NAME = "demo-prototype-preview-sample.csv"


def _demo_id(entity: str, key: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"dhruvsetu-demo:{entity}:{key}"))


DEMO_IDS = {
    "institutions": {
        key: _demo_id("institution", key) for key in ("polar", "ocean")
    },
    "scientists": {
        key: _demo_id("scientist", key)
        for key in ("alpha", "beta", "gamma", "delta", "epsilon")
    },
    "expeditions": {
        key: _demo_id("expedition", key) for key in ("climate", "sea-ice", "biology")
    },
    "research_topics": {
        key: _demo_id("research-topic", key)
        for key in ("climate", "sea-ice", "atmosphere", "biodiversity")
    },
    "locations": {
        key: _demo_id("location", key)
        for key in ("coastal", "inland", "ocean", "field-area")
    },
    "research_stations": {
        key: _demo_id("research-station", key) for key in ("coastal", "inland")
    },
    "publications": {
        key: _demo_id("publication", key)
        for key in ("climate", "sea-ice", "atmosphere", "biodiversity", "overview")
    },
    "reports": {
        key: _demo_id("report", key) for key in ("climate", "sea-ice", "biology")
    },
    "datasets": {
        key: _demo_id("dataset", key)
        for key in ("temperature", "sea-ice", "atmosphere", "biodiversity", "preview")
    },
    "media_assets": {
        key: _demo_id("media-asset", key)
        for key in (
            "climate-photo",
            "climate-diagram",
            "sea-ice-photo",
            "sea-ice-map",
            "biology-photo",
            "biology-chart",
        )
    },
}

DEMO_COUNTS = {entity: len(ids) for entity, ids in DEMO_IDS.items()}

DEMO_DOCUMENT_TITLES = (
    "Demo Antarctic Climate Field Notes",
    "Demo Sea Ice Observation Notes",
    "Prototype Polar Biodiversity Field Guide Notes",
)

MODEL_BY_ENTITY = {
    "institutions": Institution,
    "scientists": Scientist,
    "expeditions": Expedition,
    "research_topics": ResearchTopic,
    "locations": Location,
    "research_stations": ResearchStation,
    "publications": Publication,
    "reports": Report,
    "datasets": Dataset,
    "media_assets": MediaAsset,
}

# Records that point at other records are removed first.
_REMOVAL_ORDER = (
    "media_assets",
    "datasets",
    "reports",
    "publications",
    "expeditions",
    "research_stations",
    "locations",
    "scientists",
    "research_topics",
    "institutions",
)


def remove_demo_data(session: Session) -> dict[str, int]:
    """Delete the synthetic seeded records, and nothing else.

    Only records with the fixed demo IDs, and the three demo source documents,
    are removed. Accounts and researcher submissions are never matched.
    """
    removed = {}
    demo_documents = session.scalars(
        select(Document).where(
            Document.title.in_(DEMO_DOCUMENT_TITLES),
            Document.is_demo_data.is_(True),
            Document.submitted_by_user_id.is_(None),
        )
    ).all()
    for document in demo_documents:
        session.delete(document)
    removed["documents"] = len(demo_documents)

    for entity in _REMOVAL_ORDER:
        model = MODEL_BY_ENTITY[entity]
        records = session.scalars(
            select(model).where(model.id.in_(DEMO_IDS[entity].values()))
        ).all()
        for record in records:
            session.delete(record)
        removed[entity] = len(records)
        session.flush()
    session.commit()
    return removed


# --------------------------------------------------------------------------
# Real records
# --------------------------------------------------------------------------

NCPOR = "https://ncpor.res.in"
PIB = "https://www.pib.gov.in/PressReleasePage.aspx?PRID="
ARCTIC_REPORT_14 = (
    "https://www.ncpor.res.in/files/14-Arctic_Expedition-2023-24_Report-Low_Resolution.pdf"
)
ARCTIC_REPORT_15 = (
    "https://ncpor.res.in/files/Indian_Arctic_Expedition-2024-25_Report_compressed.pdf"
)
POLYNYA_DATA_URL = (
    "https://data.ncpor.res.in/static/datasets/"
    "MF131768238_evolution_of_maud_rise_polynya_during_the_last_250_years.xlsx"
)


def _real_id(entity: str, key: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"dhruvsetu-real:{entity}:{key}"))


def _station_id(entity: str, key: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"dhruvsetu-station:{entity}:{key}"))


@dataclass(frozen=True)
class StationLocation:
    key: str
    station_name: str
    location_name: str
    region: str
    latitude: Decimal
    longitude: Decimal
    published_coordinates: str
    source: str
    source_url: str
    description: str


# Indian research stations. Each coordinate is the value published by the
# National Centre for Polar and Ocean Research (NCPOR), converted to decimal
# degrees and rounded to six places. The descriptions repeat only what the
# NCPOR station pages say.
#
# Maitri: some NCPOR data pages list slightly different coordinates. The
# values from the NCPOR Maitri station page are used, and only those.
STATION_LOCATIONS = (
    StationLocation(
        key="bharati",
        station_name="Bharati",
        location_name="Bharati Station",
        region="Antarctica",
        latitude=Decimal("-69.406833"),
        longitude=Decimal("76.195333"),
        published_coordinates="69°24.41′ S, 76°11.72′ E",
        source="NCPOR Bharati station page",
        source_url=f"{NCPOR}/antarcticas/display/377-bharati",
        description=(
            "Indian research station in Antarctica, between Thala Fjord and Quilty "
            "Bay, east of the Stornes Peninsula, at about 35 m above sea level. It "
            "was commissioned on 18 March 2012 for year-round scientific research."
        ),
    ),
    StationLocation(
        key="maitri",
        station_name="Maitri",
        location_name="Maitri Station",
        region="Antarctica",
        latitude=Decimal("-70.764444"),
        longitude=Decimal("11.734167"),
        published_coordinates="70°45′52″ S, 11°44′03″ E",
        source="NCPOR Maitri station page",
        source_url=f"{NCPOR}/antarcticas/display/376-maitri-",
        description=(
            "India's second research station in Antarctica, on the ice-free "
            "Schirmacher Oasis. The site was selected in 1988. It is an inland "
            "station about 100 km from the shore, at about 50 m above sea level."
        ),
    ),
    StationLocation(
        key="himadri",
        station_name="Himadri",
        location_name="Himadri Station",
        region="Arctic",
        latitude=Decimal("78.916667"),
        longitude=Decimal("11.933333"),
        published_coordinates="78°55′ N, 11°56′ E",
        source="NCPOR Arctic data portal (Himadri)",
        source_url=f"{NCPOR}/app/webroot/pages/view/340-himadri-station",
        description=(
            "India's first Arctic research station, at the international research "
            "base at Ny-Ålesund, Svalbard, Norway. It was inaugurated on 1 July 2008."
        ),
    ),
)

STATION_IDS = {
    "locations": {item.key: _station_id("location", item.key) for item in STATION_LOCATIONS},
    "research_stations": {
        item.key: _station_id("research-station", item.key) for item in STATION_LOCATIONS
    },
}

# Field sites that are not stations. Coordinates as published by the source.
FIELD_SITES = {
    "kongsfjorden": {
        "name": "Kongsfjorden (IndARC mooring site)",
        "region": "Arctic",
        "latitude": Decimal("78.933333"),
        "longitude": Decimal("12.000000"),
        "description": (
            "Inner Kongsfjorden, Svalbard, where India's first multi-sensor mooring, "
            "IndARC, was deployed on 23 July 2014 at a depth of about 180 m. "
            "Coordinates 78°56′ N, 12° E, from the NCPOR IndARC page "
            f"({NCPOR}/arctics/display/398-indarc)."
        ),
    },
    "djupranen": {
        "name": "Djupranen Ice Rise",
        "region": "Antarctica",
        "latitude": Decimal("-70.180000"),
        "longitude": Decimal("9.180000"),
        "description": (
            "Ice rise at the western margin of the Nivlisen Ice Shelf in coastal "
            "Dronning Maud Land, where the ice core IND36/9 was drilled at 321 m "
            "above sea level. Coordinates 70.18° S, 9.18° E, from Dey et al. "
            "(2026), https://doi.org/10.5194/tc-20-4117-2026."
        ),
    },
}

INSTITUTIONS = {
    "ncpor": {
        "name": "National Centre for Polar and Ocean Research (NCPOR)",
        "description": (
            "An autonomous institute of the Ministry of Earth Sciences, in Goa. It "
            "manages the Indian Antarctic programme, organises the Indian Arctic "
            "expeditions and manages the Himadri station."
        ),
        "website": NCPOR,
    },
    "moes": {
        "name": "Ministry of Earth Sciences (MoES)",
        "description": (
            "Ministry of the Government of India. It conducts India's scientific "
            "expeditions to Antarctica and the Arctic through NCPOR."
        ),
        "website": "https://www.moes.gov.in",
    },
    "iitm": {
        "name": "Indian Institute of Tropical Meteorology (IITM), Pune",
        "description": (
            "An institute of the Ministry of Earth Sciences. Its researchers "
            "observed iodine monoxide at Bharati and Maitri, and it took part in "
            "the first batch of India's first winter Arctic expedition."
        ),
        "website": "http://www.tropmet.res.in/",
    },
}

# name, institution, designation, research area, official page
SCIENTISTS = {
    "thamban": (
        "Thamban Meloth", "ncpor", "Director",
        "Cryosphere and palaeoclimatology; Antarctic ice core studies, polar snow "
        "biogeochemistry, Himalayan glaciology",
        f"{NCPOR}/profiles/details/21",
    ),
    "laluraj": (
        "Laluraj C. M.", "ncpor", "Scientist F, Antarctic Cryosphere & Environment Section",
        "Holocene Antarctic climate variability, air-snow interactions and "
        "atmospheric chemistry, marine biogeochemistry",
        f"{NCPOR}/profiles/details/26",
    ),
    "goel": (
        "Vikram Goel", "ncpor", "Scientist D, Antarctic Cryosphere & Environment Section",
        None,
        f"{NCPOR}/profiles/details/255",
    ),
    "pratap": (
        "Bhanu Pratap", "ncpor", "Scientist D, Himalayan Cryosphere Studies",
        "Glacial dynamics and landforms, hydrology and mountain meteorology; mass "
        "balance of Himalayan glaciers and Antarctic ice rises",
        f"{NCPOR}/profiles/details/328",
    ),
    "redkar": (
        "Bhikaji Laxman Redkar", "ncpor",
        "Scientific Assistant Grade B, Antarctic Cryosphere & Environment Section",
        None,
        f"{NCPOR}/profiles/details/16",
    ),
    "dey": (
        "Rahul Dey", "ncpor", None,
        None,
        "https://orcid.org/0000-0002-8121-4777",
    ),
    "jena": (
        "Babula Jena", "ncpor", "Scientist F, Polar Remote Sensing",
        "Satellite oceanography and sea ice; remote sensing of polar sea ice, "
        "ocean-ice-atmosphere interaction, ocean colour, marine phytoplankton blooms",
        f"{NCPOR}/profiles/details/98",
    ),
    "singh": (
        "Archana Singh", "ncpor", "Scientist D, Arctic Ecology & Biogeochemistry",
        "Polar biogeochemistry using organic matter characterisation and dynamics",
        f"{NCPOR}/profiles/details/201",
    ),
    "jain": (
        "Anand Jain", "ncpor", "Scientist E, Arctic Ecology & Biogeochemistry",
        None,
        f"{NCPOR}/profiles/details/179",
    ),
    "tiwari": (
        "Manish Tiwari", "ncpor", "Scientist F, Past Climate and Ocean Studies",
        "Paleoceanography and paleoclimatology; stable isotopes and geochemical "
        "proxies of past climatic changes",
        f"{NCPOR}/profiles/details/31",
    ),
    "nuncio": (
        "Nuncio Murukesh", "ncpor", "Scientist E, Ocean Atmosphere Section",
        "Polar climate variability, atmosphere-ocean dynamics, numerical modelling "
        "of polar climate, tropical-polar remote linkages",
        f"{NCPOR}/profiles/details/65",
    ),
    "ray": (
        "Yogesh Ray", "ncpor", "Scientist F, Antarctic Exp. Logistics",
        "Geology; sedimentology, geomorphology, Himalayan geology, Antarctica",
        f"{NCPOR}/profiles/details/173",
    ),
    "mahajan": (
        "Anoop S. Mahajan", "iitm", None,
        None,
        "https://orcid.org/0000-0002-2909-5432",
    ),
}

TOPICS = {
    "cryosphere": (
        "Cryosphere and Glaciology",
        "Ice sheets, ice shelves, ice rises, glaciers and snow.",
    ),
    "paleoclimate": (
        "Paleoclimate and Ice Cores",
        "Past climate read from ice cores and other natural records.",
    ),
    "sea-ice": (
        "Sea Ice and Polynyas",
        "Sea ice cover and areas of open water within it.",
    ),
    "southern-ocean": (
        "Southern Ocean",
        "The ocean around Antarctica and the life in it.",
    ),
    "atmosphere": (
        "Atmospheric Science",
        "Clouds, precipitation, aerosols and atmospheric chemistry in the polar regions.",
    ),
    "arctic-biogeochemistry": (
        "Arctic Marine Biogeochemistry",
        "Organic matter, nutrients and microbial life in Arctic fjords and seas.",
    ),
    "remote-sensing": (
        "Remote Sensing",
        "Observation of the polar regions from satellites and with radar.",
    ),
    "geology": (
        "Geology and Geophysics",
        "Rocks, landforms and the structure of the Earth in the polar regions.",
    ),
}

EXPEDITIONS = {
    "isea-41": {
        "name": "41st Indian Scientific Expedition to Antarctica",
        "expedition_number": "ISEA-41",
        "summary": (
            "Launched in November 2021, when the first batch of 23 scientists and "
            "support staff reached Maitri. It had two major programmes: geological "
            "exploration of the Amery ice shelf at Bharati, and reconnaissance "
            "surveys and preparatory work for drilling 500 metres of ice core near "
            "Maitri, in collaboration with the British Antarctic Survey and the "
            "Norwegian Polar Institute. It also replenished the annual supplies of "
            "Maitri and Bharati. Source: Press Information Bureau, 15 November 2021."
        ),
        "start_date": None,
        "source_url": f"{PIB}1771934",
        "locations": ("maitri", "bharati"),
        "topics": ("geology", "paleoclimate"),
        "scientists": (),
        "reports": (),
    },
    "isea-43": {
        "name": "43rd Indian Scientific Expedition to Antarctica",
        "expedition_number": "ISEA-43",
        "summary": (
            "The expedition vessel MV Vasiliy Golovnin left Cape Town for "
            "Antarctica on 23 December 2023 for the 43rd expedition voyage, with 21 "
            "members from India, one from Bangladesh and two from Mauritius. The "
            "release names Dr Yogesh Ray of NCPOR's Antarctic Operations Group as "
            "leader. Source: Press Information Bureau, 6 January 2024."
        ),
        "start_date": None,
        "source_url": f"{PIB}1993769",
        "locations": (),
        "topics": (),
        "scientists": ("ray",),
        "reports": (),
    },
    "arctic-14": {
        "name": "14th Indian Arctic Expedition (2023-24)",
        "expedition_number": None,
        "summary": (
            "Expedition to Ny-Ålesund, Svalbard, organised by NCPOR. A total of 29 "
            "projects were implemented under its summer component. India's first "
            "winter scientific expedition to the Arctic began during this "
            "expedition: it was flagged off on 18 December 2023, with a first batch "
            "of researchers from NCPOR, IIT Mandi, IITM Pune and the Raman Research "
            "Institute. Sources: NCPOR expedition report 2023-24; Press Information "
            "Bureau, 18 December 2023."
        ),
        "start_date": None,
        "source_url": ARCTIC_REPORT_14,
        "locations": ("himadri",),
        "topics": ("arctic-biogeochemistry", "atmosphere", "cryosphere"),
        # Named in the report as participants of summer batch 4.
        "scientists": ("singh", "jain"),
        "reports": ("arctic-14",),
    },
    "arctic-15": {
        "name": "15th Indian Arctic Expedition (2024-25)",
        "expedition_number": None,
        "summary": (
            "Expedition to Ny-Ålesund, Svalbard, organised by NCPOR, with six "
            "summer and three winter batches. A total of 35 projects were "
            "implemented under the summer component and 10 under the winter "
            "component, and the IndARC mooring was redeployed after a break since "
            "2021. The work covered marine ecosystems, oceanographic observations, "
            "atmospheric sciences and the cryosphere. The first summer batches "
            "worked from 20 May 2024 and the winter batches from November 2024 to "
            "March 2025. Source: NCPOR expedition report 2024-25."
        ),
        "start_date": date(2024, 5, 20),
        "source_url": ARCTIC_REPORT_15,
        "locations": ("himadri", "kongsfjorden"),
        "topics": ("arctic-biogeochemistry", "atmosphere", "cryosphere"),
        "scientists": (),
        "reports": ("arctic-15",),
    },
}

REPORTS = {
    "arctic-15": {
        "title": "15th Indian Arctic Expedition Report (2024-2025)",
        "source_url": ARCTIC_REPORT_15,
        "summary": (
            "Report of the National Centre for Polar and Ocean Research on the "
            "scientific field activities and logistics of the 15th Indian "
            "expedition to the Arctic. DhruvSetu links to the report on the NCPOR "
            "website and holds no copy of it."
        ),
    },
    "arctic-14": {
        "title": "14th Indian Arctic Expedition Report (2023-2024)",
        "source_url": ARCTIC_REPORT_14,
        "summary": (
            "Report of the National Centre for Polar and Ocean Research on the 14th "
            "Indian expedition to the Arctic, with the projects implemented and the "
            "participants of each batch. DhruvSetu links to the report on the NCPOR "
            "website and holds no copy of it."
        ),
    },
}

# Bibliographic details are from Crossref. The summaries are short paraphrases
# of the published abstracts.
PUBLICATIONS = {
    "goel-2026": {
        "title": (
            "A new coastal ice-core site identified in Dronning Maud Land, Antarctica, "
            "for high-resolution climate reconstructions to the Last Glacial Maximum"
        ),
        "authors": (
            "Vikram Goel, Carlos Martín, Kenichi Matsuoka, Bhanu Pratap, Geir Moholdt, "
            "Rahul Dey, Chavarukonam M. Laluraj, Meloth Thamban"
        ),
        "journal": "The Cryosphere, 20, 1363-1378",
        "year": 2026,
        "doi": "10.5194/tc-20-1363-2026",
        "summary": (
            "Radar surveys of two ice rises at the eastern edge of the Lazarev Ice "
            "Shelf, made in the austral summer of 2021-2022, show that the summit "
            "of the Kamelryggen ice rise is better suited for a long ice core. "
            "Open access, CC BY 4.0."
        ),
        "scientists": ("goel", "pratap", "dey", "laluraj", "thamban"),
        "topics": ("cryosphere", "paleoclimate", "remote-sensing"),
    },
    "dey-2026": {
        "title": (
            "Evolution of Maud Rise Polynya during the last 250 years – a multiproxy "
            "ice core reconstruction from coastal Dronning Maud Land, Antarctica"
        ),
        "authors": (
            "Rahul Dey, Chavarukonam M. Laluraj, Kenichi Matsuoka, Ashish Paiguinkar, "
            "Bhikaji L. Redkar, Meloth Thamban"
        ),
        "journal": "The Cryosphere, 20, 4117-4131",
        "year": 2026,
        "doi": "10.5194/tc-20-4117-2026",
        "summary": (
            "Builds a polynya index from snow accumulation, δ18O, deuterium excess "
            "and sea-salt sodium flux in an ice core from coastal Dronning Maud "
            "Land. The index reproduces the 1974-1976 Maud Rise Polynya and extends "
            "the record back to 1774. Open access, CC BY 4.0."
        ),
        "scientists": ("dey", "laluraj", "redkar", "thamban"),
        "topics": ("paleoclimate", "sea-ice", "southern-ocean"),
    },
    "jena-2020": {
        "title": (
            "Satellite observations of unprecedented phytoplankton blooms in the "
            "Maud Rise polynya, Southern Ocean"
        ),
        "authors": "Babula Jena, Anilkumar N. Pillai",
        "journal": "The Cryosphere, 14, 1385-1398",
        "year": 2020,
        "doi": "10.5194/tc-14-1385-2020",
        "summary": (
            "Satellite data show phytoplankton blooms in the Maud Rise polynya in "
            "2017, with chlorophyll a up to 4.67 mg per cubic metre, for the first "
            "time in records that start in 1978. The bloom is linked to nutrients "
            "brought up by Ekman upwelling and to better light conditions. Open "
            "access, CC BY 4.0."
        ),
        "scientists": ("jena",),
        "topics": ("southern-ocean", "sea-ice", "remote-sensing"),
    },
    "mahajan-2021": {
        "title": (
            "Observations of iodine monoxide over three summers at the Indian "
            "Antarctic bases of Bharati and Maitri"
        ),
        "authors": (
            "Anoop S. Mahajan, Mriganka S. Biswas, Steffen Beirle, Thomas Wagner, "
            "Anja Schönhardt, Nuria Benavent, Alfonso Saiz-Lopez"
        ),
        "journal": "Atmospheric Chemistry and Physics, 21, 11829-11842",
        "year": 2021,
        "doi": "10.5194/acp-21-11829-2021",
        "summary": (
            "Reports MAX-DOAS observations of iodine monoxide over three summers, "
            "2015 to 2017, at Bharati and Maitri. Mixing ratios stayed below 2 pptv, "
            "lower than the peak levels observed in West Antarctica. Open access, "
            "CC BY 4.0."
        ),
        "scientists": ("mahajan",),
        "topics": ("atmosphere",),
    },
    "asutosh-2021": {
        "title": (
            "Observation of Cloud Base Height and Precipitation Characteristics at a "
            "Polar Site Ny-Ålesund, Svalbard Using Ground-Based Remote Sensing and "
            "Model Reanalysis"
        ),
        "authors": (
            "Acharya Asutosh, Sourav Chatterjee, M.P. Subeesh, Athulya Radhakrishnan, "
            "Nuncio Murukesh"
        ),
        "journal": "Remote Sensing, 13, 2808",
        "year": 2021,
        "doi": "10.3390/rs13142808",
        "summary": (
            "Reports cloud base heights measured with a ceilometer at Ny-Ålesund, "
            "Svalbard. Low-level clouds were dominant, in 76% of cases, and almost "
            "40% of the lowest cloud bases were between 0.5 and 1 km. Open access, "
            "CC BY 4.0."
        ),
        "scientists": ("nuncio",),
        "topics": ("atmosphere", "remote-sensing"),
    },
    "mahalinganathan-2012": {
        "title": (
            "Relation between surface topography and sea-salt snow chemistry from "
            "Princess Elizabeth Land, East Antarctica"
        ),
        "authors": "K. Mahalinganathan, M. Thamban, C. M. Laluraj, B. L. Redkar",
        "journal": "The Cryosphere, 6, 505-515",
        "year": 2012,
        "doi": "10.5194/tc-6-505-2012",
        "summary": (
            "Uses snow cores along a 180 km coast-to-inland transect in Princess "
            "Elizabeth Land to study sodium, chloride and sulphate in snow. "
            "Variations in the chloride to sodium ratio are strongly associated "
            "with the slope of the ice surface. Open access, CC BY 3.0."
        ),
        "scientists": ("thamban", "laluraj", "redkar"),
        "topics": ("cryosphere", "atmosphere"),
    },
    "jagtap-2026": {
        "title": (
            "Macroalgal influence on particulate organic matter sources and early "
            "transformation in an Arctic fjord"
        ),
        "authors": "Ashok S. Jagtap, Archana Singh, Anand Jain, Nandini Raj, Manish Tiwari",
        "journal": "Biogeosciences, 23, 4227-4242",
        "year": 2026,
        "doi": "10.5194/bg-23-4227-2026",
        "summary": (
            "Compares surface particulate organic matter at macroalgal-dominated "
            "sites in Kongsfjorden, Svalbard, with waters 500 and 1500 m away, "
            "sampled in late summer 2023. Organic carbon, nitrogen, carbohydrates "
            "and proteins were consistently higher at the macroalgal sites. Open "
            "access, CC BY 4.0."
        ),
        "scientists": ("singh", "jain", "tiwari"),
        "topics": ("arctic-biogeochemistry",),
    },
}

DATASETS = {
    "maud-rise-polynya": {
        "title": "Maud Rise Polynya index and ice core proxy records, 1774-2016",
        "file_name": "maud-rise-polynya-ice-core-dey-2026.csv",
        "source_url": POLYNYA_DATA_URL,
        "description": (
            "Yearly records from the ice core IND36/9 in coastal Dronning Maud "
            "Land, Antarctica: sea-salt sodium flux, δ18O, deuterium excess, snow "
            "accumulation and the polynya index with and without accumulation, for "
            "1774 to 2016 (243 rows). Data of Dey, R., Laluraj, C. M., Matsuoka, K., "
            "Paiguinkar, A., Redkar, B. L., and Thamban, M. (2026), The Cryosphere, "
            "https://doi.org/10.5194/tc-20-4117-2026, published by the authors at "
            "the NCPOR Polar Data Centre. Original format: Excel (.xlsx). Converted "
            "to CSV for the DhruvSetu preview: the two note rows above the table "
            "were left out, every row and column of the table is kept, and no "
            "value was altered. Reuse: NCPOR data policy, free and open access "
            "with the owners acknowledged."
        ),
        "topics": ("paleoclimate", "sea-ice"),
    },
    "kongsfjorden-pom": {
        "title": (
            "Particulate organic matter composition in and around macroalgal beds "
            "in Kongsfjorden, Arctic"
        ),
        "file_name": "kongsfjorden-particulate-organic-matter-jagtap-2026.csv",
        "source_url": "https://doi.org/10.5281/zenodo.18457176",
        "description": (
            "Hydrological parameters and the composition of particulate organic "
            "matter at twelve sampling stations in Kongsfjorden, Svalbard: four "
            "macroalgal-dominated sites and waters 500 m and 1500 m away (12 rows, "
            "92 columns). Dataset of Jagtap, A., Singh, A., Jain, A., Tiwari, M., and "
            "Raj, N. (2026), Zenodo, https://doi.org/10.5281/zenodo.18457176. "
            "Licence: CC BY 4.0. Original format: Excel (.xlsx). Converted to CSV "
            "for the DhruvSetu preview: every row and column of the data sheet is "
            "kept, and no value was altered."
        ),
        "topics": ("arctic-biogeochemistry",),
    },
    "maitri-surface-data": {
        "title": "Surface station data: Dakshin Gangotri (1985-1989) and Maitri (1990-2010)",
        "file_name": None,
        "source_url": "https://data.ncpor.res.in/ant_temp_pres",
        "description": (
            "Meteorological surface data from the Indian Antarctic stations, held "
            "by NCPOR: temperature, air pressure, wind speed and wind direction for "
            "1985 to 2010, and relative humidity for 1985. The data can be viewed "
            "on the NCPOR data portal. DhruvSetu holds no copy of it."
        ),
        "topics": ("atmosphere",),
    },
    "ice-rise-radar": {
        "title": "Radar surveys of the Kamelryggen and Kupol Verbljud ice rises, Dronning Maud Land",
        "file_name": None,
        "source_url": "https://data.ncpor.res.in",
        "description": (
            "Deep-sounding and shallow-sounding radar data from the surveys of two "
            "ice rises at the eastern edge of the Lazarev Ice Shelf in the austral "
            "summer of 2021-2022, as described in Goel et al. (2026), "
            "https://doi.org/10.5194/tc-20-1363-2026. The data are at the NCPOR "
            "Polar Data Centre. DhruvSetu holds no copy of it."
        ),
        "topics": ("cryosphere", "remote-sensing"),
    },
}

# Photographs shown on the site. The files and their licences are listed in
# frontend/public/images/ATTRIBUTIONS.md.
MEDIA = {
    "maitri-photo": {
        "title": "Maitri research station, Antarctica (photograph)",
        "media_type": "image",
        "source_url": (
            "https://commons.wikimedia.org/wiki/File:%E0%A4%AE%E0%A5%88%E0%A4%A4%E0%A5%8D%E0%A4%B0%E0%A5%80,"
            "_%E0%A4%AD%E0%A4%BE%E0%A4%B0%E0%A4%A4%E0%A5%80%E0%A4%AF_%E0%A4%B8%E0%A5%8D%E0%A4%9F%E0%A5%87"
            "%E0%A4%B6%E0%A4%A8_%E0%A4%85%E0%A4%82%E0%A4%9F%E0%A4%BE%E0%A4%B0%E0%A5%8D%E0%A4%95%E0%A4%9F"
            "%E0%A4%BF%E0%A4%95_%E0%A4%AE%E0%A4%B9%E0%A4%BE%E0%A4%A6%E0%A5%8D%E0%A4%B5%E0%A5%80%E0%A4%AA.jpg"
        ),
        "description": (
            "Photograph of the main building of Maitri, by Prakash khatarkar. "
            "Wikimedia Commons, CC BY-SA 4.0."
        ),
    },
    "maitri-aerial-photo": {
        "title": "Aerial view of Maitri station, Antarctica (photograph, 2005)",
        "media_type": "image",
        "source_url": (
            "https://commons.wikimedia.org/wiki/File:An_aerial_view_of_the_Indian_Station_Maitri,"
            "_Antarctica_on_February_2,_2005.jpg"
        ),
        "description": (
            "Aerial view of the Indian station Maitri on 2 February 2005. Ministry of "
            "Science and Technology, Government of India, published by the Press "
            "Information Bureau. Wikimedia Commons, Government Open Data License - India."
        ),
    },
    "schirmacher-photo": {
        "title": "Schirmacher Hills, Antarctica (aerial photograph, 1983)",
        "media_type": "image",
        "source_url": (
            "https://commons.wikimedia.org/wiki/File:An_aerial_view_of_Schirmacher_Hills.jpg"
        ),
        "description": (
            "Aerial view of the Schirmacher Hills, where Maitri now stands, by "
            "Pavan Nair, January 1983. Wikimedia Commons, CC BY-SA 4.0."
        ),
    },
    "ny-alesund-photo": {
        "title": "Ny-Ålesund seen from Kongsfjorden, Svalbard (photograph, 2012)",
        "media_type": "image",
        "source_url": (
            "https://commons.wikimedia.org/wiki/File:Ny-Aalesund_Zeppelinfjellet_IMG_6394.JPG"
        ),
        "description": (
            "View of Ny-Ålesund, the research settlement where Himadri is located, "
            "by Bjoertvedt, 9 August 2012. Wikimedia Commons, CC BY-SA 3.0."
        ),
    },
}


@dataclass(frozen=True)
class SourceDocument:
    file_name: str
    title: str
    source_type: str
    source_url: str
    publication_date: date
    # At most one of these links is set, and only where the source supports it.
    publication: str | None = None
    expedition: str | None = None


# Documents that may be redistributed: open-access papers (CC BY) and press
# releases of the Press Information Bureau, reproduced with their source.
DOCUMENTS = (
    SourceDocument(
        "goel-2026-the-cryosphere-20-1363.pdf",
        PUBLICATIONS["goel-2026"]["title"],
        "research_paper",
        "https://doi.org/10.5194/tc-20-1363-2026",
        date(2026, 2, 26),
        publication="goel-2026",
    ),
    SourceDocument(
        "dey-2026-the-cryosphere-20-4117.pdf",
        PUBLICATIONS["dey-2026"]["title"],
        "research_paper",
        "https://doi.org/10.5194/tc-20-4117-2026",
        date(2026, 7, 27),
        publication="dey-2026",
    ),
    SourceDocument(
        "mahajan-2021-acp-21-11829.pdf",
        PUBLICATIONS["mahajan-2021"]["title"],
        "research_paper",
        "https://doi.org/10.5194/acp-21-11829-2021",
        date(2021, 8, 9),
        publication="mahajan-2021",
    ),
    SourceDocument(
        "jagtap-2026-biogeosciences-23-4227.pdf",
        PUBLICATIONS["jagtap-2026"]["title"],
        "research_paper",
        "https://doi.org/10.5194/bg-23-4227-2026",
        date(2026, 6, 26),
        publication="jagtap-2026",
    ),
    SourceDocument(
        "mahalinganathan-2012-the-cryosphere-6-505.pdf",
        PUBLICATIONS["mahalinganathan-2012"]["title"],
        "research_paper",
        "https://doi.org/10.5194/tc-6-505-2012",
        date(2012, 4, 18),
        publication="mahalinganathan-2012",
    ),
    SourceDocument(
        "pib-2021-11-15-41st-scientific-expedition-to-antarctica.txt",
        "India launches the 41st Scientific Expedition to Antarctica (press release)",
        "press_release",
        f"{PIB}1771934",
        date(2021, 11, 15),
        expedition="isea-41",
    ),
    SourceDocument(
        "pib-2023-12-18-first-winter-arctic-expedition.txt",
        "India's maiden winter scientific Arctic expedition launched (press release)",
        "press_release",
        f"{PIB}1987724",
        date(2023, 12, 18),
        expedition="arctic-14",
    ),
    SourceDocument(
        "pib-2024-01-06-43rd-antarctic-expedition-voyage.txt",
        "MV Vasiliy Golovnin crosses into Antarctic waters on the 43rd Indian "
        "Scientific Expedition (press release)",
        "press_release",
        f"{PIB}1993769",
        date(2024, 1, 6),
        expedition="isea-43",
    ),
    SourceDocument(
        "pib-2025-02-13-scientific-studies-in-the-arctic.txt",
        "Scientific studies carried out in the Arctic region (press release)",
        "press_release",
        f"{PIB}2102740",
        date(2025, 2, 13),
    ),
)

REAL_IDS = {
    "institutions": {key: _real_id("institution", key) for key in INSTITUTIONS},
    "scientists": {key: _real_id("scientist", key) for key in SCIENTISTS},
    "research_topics": {key: _real_id("research-topic", key) for key in TOPICS},
    "locations": {key: _real_id("location", key) for key in FIELD_SITES},
    "expeditions": {key: _real_id("expedition", key) for key in EXPEDITIONS},
    "reports": {key: _real_id("report", key) for key in REPORTS},
    "publications": {key: _real_id("publication", key) for key in PUBLICATIONS},
    "datasets": {key: _real_id("dataset", key) for key in DATASETS},
    "media_assets": {key: _real_id("media-asset", key) for key in MEDIA},
}

REAL_COUNTS = {entity: len(ids) for entity, ids in REAL_IDS.items()}


def _upsert(session: Session, model: type, record_id: str, **values: object):
    """Create the record, or bring it back to the sourced values.

    A new record starts as Uploaded. An existing record keeps the verification
    status an admin gave it.
    """
    record = session.get(model, record_id)
    if record is None:
        record = model(id=record_id)
        if hasattr(model, "verification_status"):
            record.verification_status = "uploaded"
        session.add(record)
    for name, value in values.items():
        setattr(record, name, value)
    if hasattr(model, "is_demo_data"):
        record.is_demo_data = False
    return record


def _connect(collection: list, records: Iterable) -> None:
    existing_ids = {record.id for record in collection}
    for record in records:
        if record.id not in existing_ids:
            collection.append(record)
            existing_ids.add(record.id)


def seed_station_locations(session: Session) -> int:
    """Add the real stations, or bring them back to the published values."""
    for item in STATION_LOCATIONS:
        location = _upsert(
            session,
            Location,
            STATION_IDS["locations"][item.key],
            name=item.location_name,
            region=item.region,
            latitude=item.latitude,
            longitude=item.longitude,
            description=(
                f"Location of India's {item.station_name} research station. "
                f"Coordinates {item.published_coordinates}, from the {item.source}."
            ),
        )
        _upsert(
            session,
            ResearchStation,
            STATION_IDS["research_stations"][item.key],
            name=item.station_name,
            location=location,
            description=item.description,
            source_url=item.source_url,
        )
    session.commit()
    return len(STATION_LOCATIONS)


def seed_real_data(session: Session) -> dict[str, int]:
    """Add the real repository records, or bring them back to the sourced values."""
    seed_station_locations(session)

    institutions = {
        key: _upsert(session, Institution, REAL_IDS["institutions"][key], **values)
        for key, values in INSTITUTIONS.items()
    }
    scientists = {
        key: _upsert(
            session,
            Scientist,
            REAL_IDS["scientists"][key],
            name=name,
            institution=institutions[institution],
            designation=designation,
            research_area=research_area,
            profile_url=profile_url,
            short_bio=None,
        )
        for key, (name, institution, designation, research_area, profile_url) in SCIENTISTS.items()
    }
    topics = {
        key: _upsert(
            session, ResearchTopic, REAL_IDS["research_topics"][key], name=name, description=text
        )
        for key, (name, text) in TOPICS.items()
    }
    locations = {
        key: session.get(Location, STATION_IDS["locations"][key]) for key in STATION_IDS["locations"]
    }
    locations.update(
        {
            key: _upsert(session, Location, REAL_IDS["locations"][key], **values)
            for key, values in FIELD_SITES.items()
        }
    )
    reports = {
        key: _upsert(
            session, Report, REAL_IDS["reports"][key], publication_date=None, **values
        )
        for key, values in REPORTS.items()
    }
    publications = {
        key: _upsert(
            session,
            Publication,
            REAL_IDS["publications"][key],
            title=item["title"],
            authors=item["authors"],
            journal=item["journal"],
            publication_year=item["year"],
            doi=item["doi"],
            source_url=f"https://doi.org/{item['doi']}",
            summary=item["summary"],
        )
        for key, item in PUBLICATIONS.items()
    }
    datasets = {
        key: _upsert(
            session,
            Dataset,
            REAL_IDS["datasets"][key],
            title=item["title"],
            description=item["description"],
            source_url=item["source_url"],
            file_name=item["file_name"],
            file_type="csv" if item["file_name"] else None,
        )
        for key, item in DATASETS.items()
    }
    for key, values in MEDIA.items():
        _upsert(session, MediaAsset, REAL_IDS["media_assets"][key], **values)
    expeditions = {
        key: _upsert(
            session,
            Expedition,
            REAL_IDS["expeditions"][key],
            name=item["name"],
            expedition_number=item["expedition_number"],
            summary=item["summary"],
            start_date=item["start_date"],
            end_date=None,
            source_url=item["source_url"],
        )
        for key, item in EXPEDITIONS.items()
    }
    session.flush()

    # Only relationships that a source states.
    for key, item in EXPEDITIONS.items():
        expedition = expeditions[key]
        _connect(expedition.locations, (locations[name] for name in item["locations"]))
        _connect(expedition.research_topics, (topics[name] for name in item["topics"]))
        _connect(expedition.scientists, (scientists[name] for name in item["scientists"]))
        _connect(expedition.reports, (reports[name] for name in item["reports"]))
    for key, item in PUBLICATIONS.items():
        _connect(publications[key].scientists, (scientists[name] for name in item["scientists"]))
        _connect(publications[key].research_topics, (topics[name] for name in item["topics"]))
    for key, item in DATASETS.items():
        _connect(datasets[key].research_topics, (topics[name] for name in item["topics"]))

    session.commit()
    return {
        entity: len(
            session.scalars(
                select(MODEL_BY_ENTITY[entity].id).where(
                    MODEL_BY_ENTITY[entity].id.in_(ids.values())
                )
            ).all()
        )
        for entity, ids in REAL_IDS.items()
    }


def seed_real_documents(session: Session) -> tuple[int, int]:
    """Ingest the real source documents. A document already stored is skipped."""
    created = 0
    chunk_count = 0
    for item in DOCUMENTS:
        result = ingest_document(
            session,
            DOCUMENT_STORE / item.file_name,
            title=item.title,
            source_type=item.source_type,
            source_url=item.source_url,
            publication_date=item.publication_date,
            verification_status="uploaded",
            is_demo_data=False,
            publication_id=REAL_IDS["publications"][item.publication] if item.publication else None,
            expedition_id=REAL_IDS["expeditions"][item.expedition] if item.expedition else None,
        )
        created += int(not result.duplicate)
        chunk_count += result.chunk_count
    return created, chunk_count


def main() -> None:
    with SessionLocal() as session:
        removed = remove_demo_data(session)
        summary = seed_real_data(session)
        created, chunk_count = seed_real_documents(session)

    if any(removed.values()):
        print("Removed synthetic demo records from earlier versions:")
        for entity, count in removed.items():
            if count:
                print(f"- {entity.replace('_', ' ').title()}: {count}")
    print("DhruvSetu real starter data is ready:")
    for entity, expected in REAL_COUNTS.items():
        print(f"- {entity.replace('_', ' ').title()}: {summary[entity]}/{expected}")
    print(f"- Research Stations: {len(STATION_LOCATIONS)}")
    print(
        f"- Documents: {len(DOCUMENTS)} ({created} newly ingested, {chunk_count} chunks)"
    )
    print("Now rebuild the search index: python -m app.search.build_index")


if __name__ == "__main__":
    main()
