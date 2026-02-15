import os
import random
import re
from collections import defaultdict

import requests

from .extensions import db
from .models import Choice, NLCategory, Question

MIN_QUESTIONS_PER_CATEGORY = 220
MAX_QUESTIONS_PER_CATEGORY = 320
EXTERNAL_TIMEOUT_SECONDS = 15
EXTERNAL_PAGE_SIZE = 100
EXTERNAL_FETCH_LENGTH = 600
EXTERNAL_MAX_PER_CATEGORY = 140
PALMER_PER_TOPIC_TARGET = 16
MEDMCQA_FETCH_LENGTH = 500
MEDMCQA_MAX_PER_CATEGORY = 140

CATEGORY_DEFINITIONS = [
    ("NP1", "Nursing Practice I (Community Health Nursing)", "heart"),
    ("NP2", "Nursing Practice II (Care of Healthy/At-Risk Mother and Child)", "baby"),
    ("NP3", "Nursing Practice III (Care of Clients with Physiologic and Psychosocial Alterations - Part A)", "hospital"),
    ("NP4", "Nursing Practice IV (Care of Clients with Physiologic and Psychosocial Alterations - Part B)", "brain"),
    ("NP5", "Nursing Practice V (Care of Clients with Physiologic and Psychosocial Alterations - Part C)", "globe"),
]

REAL_PNLE_QUESTION_BANK = [
    {
        "category_code": "NP1",
        "text": "Which criterion in priority setting of health problems is used only in community health care?",
        "choices": [
            ("Modifiability of the problem", False),
            ("Nature of the problem presented", False),
            ("Magnitude of the health problem", True),
            ("Preventive potential of the health problem", False),
        ],
        "rationale": "In community diagnosis, magnitude estimates how many people are affected and strongly influences prioritization.",
    },
    {
        "category_code": "NP2",
        "text": "Inevitable abortion is characterized by which of the following?",
        "choices": [
            ("No bleeding or cramping", False),
            ("Moderate to severe bleeding and cervical dilation", True),
            ("Rupture of membranes only", False),
            ("Fetal demise with no uterine changes", False),
        ],
        "rationale": "Inevitable abortion presents with active bleeding and cervical dilation indicating progression cannot be stopped.",
    },
    {
        "category_code": "NP3",
        "text": "What is the nurse's first action when a postoperative client shows signs of respiratory distress?",
        "choices": [
            ("Increase IV fluids", False),
            ("Assess airway and breathing", True),
            ("Call for help after documentation", False),
            ("Encourage coughing and deep breathing", False),
        ],
        "rationale": "Airway and breathing take priority; immediate assessment guides urgent interventions.",
    },
    {
        "category_code": "NP4",
        "text": "A client with acute chest pain and unstable vital signs arrives in triage. Which action is priority?",
        "choices": [
            ("Obtain full health history before interventions", False),
            ("Prioritize rapid ABC assessment and immediate monitoring", True),
            ("Delay triage until laboratory data are complete", False),
            ("Provide routine discharge teaching", False),
        ],
        "rationale": "Unstable chest pain requires immediate ABC-focused triage and urgent monitoring to prevent deterioration.",
    },
    {
        "category_code": "NP5",
        "text": "Which response by the nurse best demonstrates therapeutic communication for a client with anxiety?",
        "choices": [
            ("Calm down, you are overreacting.", False),
            ("I can see this is difficult. Tell me what worries you most right now.", True),
            ("You should ignore those feelings.", False),
            ("Let's discuss that after rounds tomorrow.", False),
        ],
        "rationale": "Therapeutic communication validates feelings and uses open-ended questions to explore concerns safely.",
    },
]

PALMER_QUESTIONS = [
    {
        "text": "Which leadership style best promotes team participation in nursing units?",
        "choices": [
            ("Autocratic", False),
            ("Laissez-faire", False),
            ("Democratic", True),
            ("Authoritarian", False),
        ],
        "rationale": "Democratic leadership encourages participation, shared decisions, and stronger team ownership.",
    },
    {
        "text": "What principle supports patient confidentiality in nursing practice?",
        "choices": [
            ("Beneficence", False),
            ("Nonmaleficence", False),
            ("Fidelity", True),
            ("Justice", False),
        ],
        "rationale": "Fidelity includes faithfulness to professional promises, including protection of confidential information.",
    },
    {
        "text": "Which delegation principle is correct for unlicensed assistive personnel (UAP)?",
        "choices": [
            ("Delegate initial patient assessment", False),
            ("Delegate unstable patient monitoring", False),
            ("Delegate routine, predictable, low-risk tasks", True),
            ("Delegate clinical judgment tasks", False),
        ],
        "rationale": "UAP delegation is limited to stable, routine tasks that do not require nursing judgment.",
    },
    {
        "text": "What is the best first response when receiving a verbal order that is unclear?",
        "choices": [
            ("Document and carry it out immediately", False),
            ("Ask another nurse to interpret it", False),
            ("Read back and clarify the order with the prescriber", True),
            ("Delay until the next shift", False),
        ],
        "rationale": "Read-back and clarification reduce medication and treatment errors from unclear verbal orders.",
    },
    {
        "text": "Which action reflects evidence-based infection prevention in nursing care?",
        "choices": [
            ("Use gloves only for invasive procedures", False),
            ("Perform hand hygiene before and after patient contact", True),
            ("Reuse single-use PPE if visibly clean", False),
            ("Skip hand hygiene when wearing gloves", False),
        ],
        "rationale": "Hand hygiene before and after contact is a primary, proven infection-prevention measure.",
    },
    {
        "text": "Which charting entry follows legal documentation standards?",
        "choices": [
            ("'Patient looks better today.'", False),
            ("'Given meds as ordered.'", False),
            ("'0800: BP 90/60, dizzy; notified physician and initiated fall precautions.'", True),
            ("'Client noncompliant and difficult.'", False),
        ],
        "rationale": "Legal documentation is objective, time-stamped, specific, and action-oriented.",
    },
    {
        "text": "Which quality-improvement metric best reflects medication safety in a ward?",
        "choices": [
            ("Average visitor count", False),
            ("Number of reported medication errors per 1,000 doses", True),
            ("Nurse uniform compliance rate", False),
            ("Average meal tray delivery time", False),
        ],
        "rationale": "Medication error rate per dose is a direct and meaningful patient-safety indicator.",
    },
]

TEMPLATE_TOPICS = {
    "NP1": ["Community Assessment", "Disease Prevention", "Public Health Education", "Outbreak Control"],
    "NP2": ["Prenatal Care", "Labor Monitoring", "Postpartum Care", "Newborn Assessment"],
    "NP3": ["Cardiovascular Care", "Respiratory Support", "Fluid Balance", "Perioperative Nursing"],
    "NP4": ["Emergency Triage", "Neurologic Monitoring", "Critical Care Priorities", "Complex Care Coordination"],
    "NP5": ["Therapeutic Communication", "Psychiatric Safety", "Crisis Intervention", "Rehabilitation Support"],
}
TEMPLATE_STEMS = [
    "Which nursing action should be done first?",
    "What is the highest-priority intervention in this case?",
    "Which finding requires immediate follow-up?",
    "Which instruction should the nurse reinforce now?",
    "What is the safest next nursing decision?",
]
TEMPLATE_SCENARIOS = [
    "A client suddenly reports worsening symptoms during rounds.",
    "A newly admitted patient has incomplete baseline data.",
    "A caregiver requests immediate discharge guidance.",
    "A change in condition occurs after medication administration.",
    "A handoff report contains conflicting clinical information.",
]
TEMPLATE_PATIENTS = [
    "a primigravida client",
    "a postpartum mother",
    "an older adult with comorbidities",
    "a pediatric client",
    "a client with limited health literacy",
    "a client with newly diagnosed chronic illness",
    "a post-op client",
    "a client from a high-risk community",
]
TEMPLATE_SETTINGS = [
    "in the ER",
    "in the ward",
    "during home visit",
    "during triage",
    "during shift handoff",
    "in an outpatient clinic",
]
TEMPLATE_CUES = [
    "reports sudden dizziness and weakness",
    "develops abnormal vital signs",
    "shows signs of medication adverse reaction",
    "has worsening pain despite intervention",
    "shows confusion and reduced responsiveness",
    "reports new shortness of breath",
    "demonstrates escalating anxiety and restlessness",
    "has unexpected bleeding",
]


def _normalize_prompt(text: str):
    return " ".join((text or "").strip().lower().split())


_FINGERPRINT_STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "what",
    "which",
    "when",
    "where",
    "your",
    "their",
    "into",
    "during",
    "after",
    "before",
    "have",
    "has",
    "should",
    "nurse",
    "client",
    "patient",
    "care",
    "nursing",
    "practice",
}


def _prompt_core(text: str):
    value = (text or "").strip()
    value = re.sub(r"^nursing practice\s+[ivx]+\s*\(.*?\)\s*-\s*", "", value, flags=re.IGNORECASE)
    value = re.sub(r"^(curated|palmer|template case|external case)\s*[\w\-#]*:\s*", "", value, flags=re.IGNORECASE)
    return value.strip()


def _question_fingerprint(text: str):
    core = _prompt_core(text).lower()
    core = re.sub(r"[^a-z0-9\s]", " ", core)
    tokens = [t for t in core.split() if len(t) > 2 and t not in _FINGERPRINT_STOPWORDS]
    if not tokens:
        return ""
    return " ".join(tokens[:24])


def _upsert_categories():
    category_codes = {c.code for c in NLCategory.query.all()}
    has_legacy = any(code.startswith("NL") for code in category_codes)
    if has_legacy:
        # Legacy NL categories/questions are noisy and duplicate-heavy; rebuild a clean NP-only bank.
        Choice.query.delete()
        Question.query.delete()
        NLCategory.query.delete()
        db.session.commit()

    for code, title, icon in CATEGORY_DEFINITIONS:
        category = NLCategory.query.filter_by(code=code).first()
        if category is None:
            db.session.add(NLCategory(code=code, title=title, icon=icon))
        else:
            category.title = title
            category.icon = icon
    db.session.commit()


def _insert_question(category: NLCategory, prompt: str, topic: str, rationale: str, choices: list[tuple[str, bool]]):
    question = Question(
        nl_category_id=category.id,
        prompt=prompt,
        explanation=rationale,
        topic=topic,
    )
    for body, is_correct in choices:
        question.choices.append(Choice(body=body, is_correct=is_correct))
    db.session.add(question)


def _fetch_mednurse_rows():
    if os.getenv("NPE_EXTERNAL_QUESTION_SOURCE", "1") != "1":
        return []

    url = "https://datasets-server.huggingface.co/rows"
    total = int(os.getenv("NPE_EXTERNAL_FETCH_LENGTH", str(EXTERNAL_FETCH_LENGTH)))
    rows = []
    offset = 0
    while offset < total:
        length = min(EXTERNAL_PAGE_SIZE, total - offset)
        params = {
            "dataset": "NevenaD/MedNurse-QA",
            "config": "default",
            "split": "train",
            "offset": offset,
            "length": length,
        }
        try:
            res = requests.get(url, params=params, timeout=EXTERNAL_TIMEOUT_SECONDS)
            res.raise_for_status()
            chunk = (res.json() or {}).get("rows", [])
            if not chunk:
                break
            rows.extend([(x or {}).get("row") or {} for x in chunk])
            if len(chunk) < length:
                break
            offset += length
        except requests.RequestException:
            break
    return rows


def _fetch_medmcqa_rows():
    if os.getenv("NPE_EXTERNAL_QUESTION_SOURCE", "1") != "1":
        return []

    url = "https://datasets-server.huggingface.co/rows"
    total = int(os.getenv("NPE_MEDMCQA_FETCH_LENGTH", str(MEDMCQA_FETCH_LENGTH)))
    rows = []
    offset = 0
    while offset < total:
        length = min(EXTERNAL_PAGE_SIZE, total - offset)
        params = {
            "dataset": "openlifescienceai/medmcqa",
            "config": "default",
            "split": "train",
            "offset": offset,
            "length": length,
        }
        try:
            res = requests.get(url, params=params, timeout=EXTERNAL_TIMEOUT_SECONDS)
            res.raise_for_status()
            chunk = (res.json() or {}).get("rows", [])
            if not chunk:
                break
            rows.extend([(x or {}).get("row") or {} for x in chunk])
            if len(chunk) < length:
                break
            offset += length
        except requests.RequestException:
            break
    return rows


def _map_np_code(question: str, chapter: str, sub_chapter: str, book: str):
    text = f"{question} {chapter} {sub_chapter} {book}".lower()
    if "nursing fundamentals" in (book or "").lower():
        return "NP1"
    if any(k in text for k in ["community", "public health", "epidemiology", "health promotion", "disease prevention"]):
        return "NP1"
    if any(k in text for k in ["maternal", "pregnan", "newborn", "pediatric", "child", "postpartum", "labor"]):
        return "NP2"
    if any(k in text for k in ["surgical", "cardio", "respir", "renal", "endocrine", "perioperative", "pharmaco"]):
        return "NP3"
    if any(k in text for k in ["critical care", "triage", "emergency", "icu", "neurolog", "hemodynamic"]):
        return "NP4"
    if any(k in text for k in ["psychi", "mental health", "behavioral", "depress", "suicide", "psychosis", "rehabilitation"]):
        return "NP5"
    return None


def _map_np_code_medmcqa(question: str, subject: str, topic: str):
    text = f"{question} {subject} {topic}".lower()
    if any(k in text for k in ["obstetric", "obstetrics", "gyne", "pediatric", "newborn", "neonat", "pregnan", "labor", "postpartum", "maternal", "child"]):
        return "NP2"
    if any(k in text for k in ["medicine", "surgery", "cardio", "respir", "renal", "endocrine", "gastro", "infection", "pharmacology", "anatomy", "physiology"]):
        return "NP3"
    if any(k in text for k in ["emergency", "critical", "icu", "trauma", "neurology", "anesthesia", "hemodynamic", "triage"]):
        return "NP4"
    if any(k in text for k in ["psychi", "mental", "behavior", "addiction", "psychology", "rehabilitation"]):
        return "NP5"
    return None


def _truncate_answer(text: str):
    if not text:
        return "No rationale available."
    compact = " ".join(text.split())
    return compact[:220]


def _seed_external_nursing_questions(
    categories_by_code: dict[str, NLCategory],
    used_prompts: set[str],
    used_fingerprints: set[str],
):
    rows = _fetch_mednurse_rows()
    medmcqa_rows = _fetch_medmcqa_rows()
    if not rows and not medmcqa_rows:
        return 0

    grouped = defaultdict(list)
    for row in rows:
        q = (row.get("question") or "").strip()
        a = (row.get("answer") or "").strip()
        chapter = (row.get("chapter ") or "").strip()
        sub_chapter = (row.get("sub-chapter") or "").strip()
        book = (row.get("book") or "").strip()
        if not q or not a or len(q) < 18:
            continue
        np_code = _map_np_code(q, chapter, sub_chapter, book)
        if not np_code or np_code not in categories_by_code:
            continue
        norm = _normalize_prompt(q)
        fp = _question_fingerprint(q)
        if norm in used_prompts or (fp and fp in used_fingerprints):
            continue
        grouped[np_code].append(
            {
                "source": "MedNurse-QA",
                "question": q,
                "answer": _truncate_answer(a),
                "topic": sub_chapter or chapter or np_code,
                "choices": None,
            }
        )

    for row in medmcqa_rows:
        q = (row.get("question") or "").strip()
        if len(q) < 18:
            continue
        if (row.get("choice_type") or "").strip().lower() != "single":
            continue
        subject = (row.get("subject_name") or "").strip()
        topic_name = (row.get("topic_name") or "").strip()
        np_code = _map_np_code_medmcqa(q, subject, topic_name)
        if np_code not in {"NP2", "NP3", "NP4", "NP5"} or np_code not in categories_by_code:
            continue

        options_raw = [
            (row.get("opa") or "").strip(),
            (row.get("opb") or "").strip(),
            (row.get("opc") or "").strip(),
            (row.get("opd") or "").strip(),
        ]
        if not all(options_raw):
            continue

        cop_raw = str(row.get("cop", "")).strip().lower()
        answer_index_map = {"a": 0, "b": 1, "c": 2, "d": 3, "1": 0, "2": 1, "3": 2, "4": 3}
        if cop_raw not in answer_index_map:
            continue
        answer_idx = answer_index_map[cop_raw]
        if answer_idx < 0 or answer_idx > 3:
            continue

        norm = _normalize_prompt(q)
        fp = _question_fingerprint(q)
        if norm in used_prompts or (fp and fp in used_fingerprints):
            continue

        choices = [(opt, i == answer_idx) for i, opt in enumerate(options_raw)]
        grouped[np_code].append(
            {
                "source": "MedMCQA",
                "question": q,
                "answer": _truncate_answer((row.get("exp") or "").strip()),
                "topic": topic_name or subject or np_code,
                "choices": choices,
            }
        )

    inserted = 0
    rng = random.Random(42)
    current_count = {code: Question.query.filter_by(nl_category_id=cat.id).count() for code, cat in categories_by_code.items()}
    medmcqa_cap = int(os.getenv("NPE_MEDMCQA_MAX_PER_CATEGORY", str(MEDMCQA_MAX_PER_CATEGORY)))
    mednurse_cap = int(os.getenv("NPE_EXTERNAL_MAX_PER_CATEGORY", str(EXTERNAL_MAX_PER_CATEGORY)))

    for np_code, items in grouped.items():
        category = categories_by_code[np_code]
        mednurse_items = [x for x in items if x["source"] == "MedNurse-QA"]
        medmcqa_items = [x for x in items if x["source"] == "MedMCQA"]
        random.shuffle(mednurse_items)
        random.shuffle(medmcqa_items)

        selected = []
        selected.extend(medmcqa_items[:medmcqa_cap] if np_code in {"NP2", "NP3", "NP4", "NP5"} else [])
        selected.extend(mednurse_items[:mednurse_cap])

        answer_pool = [x["answer"] for x in mednurse_items if x["answer"]]
        for item in selected:
            norm = _normalize_prompt(item["question"])
            fp = _question_fingerprint(item["question"])
            if norm in used_prompts or (fp and fp in used_fingerprints):
                continue

            options = item["choices"]
            if options is None:
                # Build MCQ from QA row: 1 correct + 3 distractors from same nursing corpus.
                distractors = [a for a in answer_pool if a and a != item["answer"]]
                if len(distractors) < 3:
                    continue
                picked = rng.sample(distractors, 3)
                options = [(picked[0], False), (picked[1], False), (item["answer"], True), (picked[2], False)]
                rng.shuffle(options)

            rationale = (
                f"Rationale: {item['answer']}. Source: {item['source']}."
                if item["answer"]
                else f"Rationale: Review key nursing principles for this item. Source: {item['source']}."
            )
            _insert_question(category, item["question"], item["topic"], rationale, options)
            used_prompts.add(norm)
            if fp:
                used_fingerprints.add(fp)
            inserted += 1
            current_count[np_code] = current_count.get(np_code, 0) + 1
    return inserted


def _seed_curated_questions(
    categories_by_code: dict[str, NLCategory],
    used_prompts: set[str],
    used_fingerprints: set[str],
):
    inserted = 0
    for item in REAL_PNLE_QUESTION_BANK:
        code = item["category_code"]
        category = categories_by_code.get(code)
        if category is None:
            continue
        norm = _normalize_prompt(item["text"])
        fp = _question_fingerprint(item["text"])
        if norm in used_prompts or (fp and fp in used_fingerprints):
            continue
        _insert_question(category, item["text"], code, f"Rationale: {item['rationale']}. Source: Curated NP bank.", item["choices"])
        used_prompts.add(norm)
        if fp:
            used_fingerprints.add(fp)
        inserted += 1

    return inserted


def _seed_palmer_per_topic(
    categories_by_code: dict[str, NLCategory],
    used_prompts: set[str],
    used_fingerprints: set[str],
):
    inserted = 0
    per_topic_target = int(os.getenv("NPE_PALMER_PER_TOPIC", str(PALMER_PER_TOPIC_TARGET)))
    situational_contexts = [
        "during endorsement",
        "while handling two unstable patients",
        "during medication reconciliation",
        "while coordinating discharge teaching",
        "during high census hours",
        "while supervising junior staff",
        "during emergency admissions",
        "while updating care plans",
    ]
    for code, category in categories_by_code.items():
        topics = TEMPLATE_TOPICS.get(code, [code])
        for topic_idx, topic in enumerate(topics, start=1):
            for idx in range(per_topic_target):
                template = PALMER_QUESTIONS[(topic_idx + idx) % len(PALMER_QUESTIONS)]
                context = situational_contexts[(topic_idx * 3 + idx) % len(situational_contexts)]
                text = f"In {topic.lower()} {context}, {template['text']}"
                norm = _normalize_prompt(text)
                fp = _question_fingerprint(text)
                if norm in used_prompts or (fp and fp in used_fingerprints):
                    continue
                rationale = f"Rationale: {template['rationale']}. Source: Palmer-style nursing review."
                _insert_question(category, text, topic, rationale, template["choices"])
                used_prompts.add(norm)
                if fp:
                    used_fingerprints.add(fp)
                inserted += 1
    return inserted


def _rewrite_stale_template_rows(categories_by_code: dict[str, NLCategory]):
    updated = 0
    for code, category in categories_by_code.items():
        stale_rows = (
            Question.query.filter(
                Question.nl_category_id == category.id,
                Question.prompt.ilike("%practice scenario%"),
            )
            .order_by(Question.id.asc())
            .all()
        )
        if not stale_rows:
            continue
        topics = TEMPLATE_TOPICS.get(code, [code])
        for idx, q in enumerate(stale_rows, start=1):
            topic = q.topic if q.topic and q.topic not in {"PALMER", code} else topics[(idx - 1) % len(topics)]
            stem = TEMPLATE_STEMS[(idx - 1) % len(TEMPLATE_STEMS)]
            scenario = TEMPLATE_SCENARIOS[(idx - 1) % len(TEMPLATE_SCENARIOS)]
            q.prompt = f"{topic}: {scenario} {stem}"
            q.topic = topic
            q.explanation = f"Rationale: Prioritize immediate safety and unstable cues first for {topic.lower()}."
            updated += 1
    if updated:
        db.session.commit()


def _fill_with_templates(
    categories_by_code: dict[str, NLCategory],
    used_prompts: set[str],
    used_fingerprints: set[str],
    target_min: int,
):
    # Rebuild template pool each seed to avoid accumulating repetitive patterns.
    for category in categories_by_code.values():
        template_rows = Question.query.filter(
            Question.nl_category_id == category.id,
            Question.explanation.ilike("Rationale: Prioritize immediate safety and unstable cues first for %"),
        ).all()
        for row in template_rows:
            db.session.delete(row)
    db.session.flush()

    for code, category in categories_by_code.items():
        current_count = Question.query.filter_by(nl_category_id=category.id).count()
        idx = current_count + 1
        tries = 0
        max_tries = max(target_min * 80, 5000)
        topics = TEMPLATE_TOPICS.get(code, [code])
        used_core_keys: set[str] = set()
        existing_prompts = (
            Question.query.filter_by(nl_category_id=category.id)
            .with_entities(Question.prompt)
            .all()
        )
        for (pmt,) in existing_prompts:
            txt = (pmt or "")
            core = txt.split(": ", 1)[1] if ": " in txt else txt
            used_core_keys.add(_question_fingerprint(core))
        while current_count < target_min and tries < max_tries:
            tries += 1
            topic = topics[(idx * 3 + 1) % len(topics)]
            stem = TEMPLATE_STEMS[(idx * 5 + 2) % len(TEMPLATE_STEMS)]
            scenario = TEMPLATE_SCENARIOS[(idx * 7 + 3) % len(TEMPLATE_SCENARIOS)]
            patient = TEMPLATE_PATIENTS[(idx * 11 + 5) % len(TEMPLATE_PATIENTS)]
            setting = TEMPLATE_SETTINGS[(idx * 13 + 7) % len(TEMPLATE_SETTINGS)]
            cue = TEMPLATE_CUES[(idx * 17 + 9) % len(TEMPLATE_CUES)]
            prompt_core = f"{topic}: {patient} {setting} {cue}. {scenario} {stem}"
            norm = _normalize_prompt(prompt_core)
            fp = _question_fingerprint(prompt_core)
            if norm in used_prompts or (fp and fp in used_fingerprints) or (fp and fp in used_core_keys):
                idx += 1
                continue
            choices = [
                ("Perform focused reassessment and prioritize airway, breathing, and circulation.", True),
                ("Delay intervention until all non-urgent tasks are complete.", False),
                ("Document only and reassess at the next scheduled round.", False),
                ("Delegate critical assessment without direct supervision.", False),
            ]
            prompt = prompt_core
            rationale = f"Rationale: Prioritize immediate safety and unstable cues first for {topic.lower()}."
            _insert_question(category, prompt, topic, rationale, choices)
            used_prompts.add(norm)
            if fp:
                used_fingerprints.add(fp)
                used_core_keys.add(fp)
            current_count += 1
            idx += 1


def _dedupe_questions_global():
    rows = Question.query.order_by(Question.id.asc()).all()
    seen: dict[str, int] = {}
    removed = 0
    for q in rows:
        key = _question_fingerprint(q.prompt)
        if not key:
            continue
        if key in seen:
            db.session.delete(q)
            removed += 1
        else:
            seen[key] = q.id
    if removed:
        db.session.commit()


def _trim_category_to_max(categories_by_code: dict[str, NLCategory]):
    for code, category in categories_by_code.items():
        rows = Question.query.filter_by(nl_category_id=category.id).order_by(Question.id.asc()).all()
        if len(rows) <= MAX_QUESTIONS_PER_CATEGORY:
            continue
        # Keep older seeded variety and curated/palmer records first.
        keep = []
        rest = []
        for q in rows:
            p = (q.prompt or "").lower()
            e = (q.explanation or "").lower()
            if "source: curated np bank" in e or "source: palmer-style nursing review" in e:
                keep.append(q)
            else:
                rest.append(q)
        ordered = keep + rest
        remove_count = len(rows) - MAX_QUESTIONS_PER_CATEGORY
        to_remove = ordered[-remove_count:]
        for q in to_remove:
            db.session.delete(q)
    db.session.commit()


def ensure_seed_data():
    fast_mode = os.getenv("NPE_SEED_FAST", "1") == "1"
    force_reseed = os.getenv("NPE_FORCE_RESEED", "0") == "1"
    quick_reseed = os.getenv("NPE_QUICK_RESEED", "0") == "1"
    fast_min = int(os.getenv("NPE_FAST_MIN_QUESTIONS", "80"))
    if quick_reseed:
        target_min = max(20, min(fast_min, MIN_QUESTIONS_PER_CATEGORY))
    else:
        target_min = MIN_QUESTIONS_PER_CATEGORY if (force_reseed or not fast_mode) else max(20, min(fast_min, MIN_QUESTIONS_PER_CATEGORY))
    _upsert_categories()
    categories_by_code = {c.code: c for c in NLCategory.query.order_by(NLCategory.id.asc()).all()}
    counts_by_code = {
        code: Question.query.filter_by(nl_category_id=cat.id).count() for code, cat in categories_by_code.items()
    }
    needs_fill = any(v < target_min for v in counts_by_code.values())
    needs_trim = any(v > MAX_QUESTIONS_PER_CATEGORY for v in counts_by_code.values())

    # Fast startup path: keep seeded bank stable, only top-up PALMER coverage if missing.
    if fast_mode and not force_reseed and not needs_fill and not needs_trim:
        used_prompts = {
            _normalize_prompt(prompt) for (prompt,) in db.session.query(Question.prompt).all() if prompt
        }
        used_fingerprints = {
            _question_fingerprint(prompt) for (prompt,) in db.session.query(Question.prompt).all() if prompt
        }
        _seed_palmer_per_topic(categories_by_code, used_prompts, used_fingerprints)
        db.session.commit()
        return

    _rewrite_stale_template_rows(categories_by_code)

    used_prompts = {
        _normalize_prompt(prompt) for (prompt,) in db.session.query(Question.prompt).all() if prompt
    }
    used_fingerprints = {
        _question_fingerprint(prompt) for (prompt,) in db.session.query(Question.prompt).all() if prompt
    }

    _seed_curated_questions(categories_by_code, used_prompts, used_fingerprints)
    _seed_palmer_per_topic(categories_by_code, used_prompts, used_fingerprints)
    if force_reseed or needs_fill or not fast_mode or quick_reseed:
        _seed_external_nursing_questions(categories_by_code, used_prompts, used_fingerprints)
        _fill_with_templates(categories_by_code, used_prompts, used_fingerprints, target_min)
    db.session.commit()
    if force_reseed or quick_reseed or not fast_mode:
        _dedupe_questions_global()
    if (force_reseed and not quick_reseed) or needs_trim or not fast_mode:
        _trim_category_to_max(categories_by_code)
