import json
import os

import requests


def _build_prompt(data: dict) -> str:
    return (
        "Analyze NPE exam performance.\n\n"
        f"User Results:\n{json.dumps(data, indent=2)}\n\n"
        "Generate:\n"
        "- Weakness Summary\n"
        "- Study Recommendations\n"
        "- Priority NP Subjects\n"
        "- Encouraging Feedback\n"
        "Return concise JSON with keys: weakness_summary, study_recommendations, priority_nl_subjects, encouraging_feedback."
    )


def _local_fallback(payload: dict, reason: str | None = None):
    nl_rows = payload.get("nl_breakdown", []) or []
    missed_rows = payload.get("missed_topics", []) or []
    elapsed = payload.get("elapsed_seconds")

    weakest = None
    if nl_rows:
        sorted_nl = sorted(nl_rows, key=lambda x: x.get("score", 0))
        weakest = sorted_nl[0].get("nl_code")

    top_topics = [x.get("topic") for x in missed_rows[:3] if x.get("topic")]
    priority = [x.get("nl_code") for x in sorted(nl_rows, key=lambda x: x.get("score", 0))[:3] if x.get("nl_code")]
    time_note = (
        f"Elapsed time: {int(elapsed // 60)}m {int(elapsed % 60)}s."
        if isinstance(elapsed, (int, float)) and elapsed >= 0
        else "Time data is limited for this attempt."
    )
    # Keep fallback transparent in server logs, but do not surface noisy
    # fallback reason text to end users.
    if reason:
        pass

    weakness_summary = (
        f"Weakest area this attempt: {weakest}. "
        f"Most missed topics: {', '.join(top_topics) if top_topics else 'none recorded'}."
    )
    return {
        "weakness_summary": weakness_summary,
        "study_recommendations": [
            f"Prioritize {weakest or 'your lowest NP category'} for your next focused practice.",
            f"Reinforce topics: {', '.join(top_topics) if top_topics else 'review recent incorrect items'} using active recall.",
            "Do timed sets daily and one mixed simulation weekly.",
        ],
        "priority_nl_subjects": priority,
        "encouraging_feedback": f"{time_note} Keep consistency and your trend will improve.",
    }


def generate_suggestions(payload: dict):
    groq_api_key = os.getenv("GROQ_API_KEY", "")
    model = os.getenv("GROQ_MODEL", "llama3-70b-8192")

    if not groq_api_key:
        return _local_fallback(payload, reason="no GROQ_API_KEY")

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You are an expert nursing exam coach. Output valid JSON only.",
            },
            {"role": "user", "content": _build_prompt(payload)},
        ],
        "temperature": 0.2,
    }
    try:
        res = requests.post(url, headers=headers, json=body, timeout=45)
        res.raise_for_status()
        content = res.json()["choices"][0]["message"]["content"]
    except requests.RequestException as e:
        return _local_fallback(payload, reason=f"Groq request failed ({e.__class__.__name__})")

    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
        return _local_fallback(payload, reason="Groq returned non-object JSON")
    except json.JSONDecodeError:
        return _local_fallback(payload, reason="Groq returned invalid JSON")
