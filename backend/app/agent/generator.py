from __future__ import annotations

import hashlib

from app.agent.followup import follow_up_hints
from app.agent.ollama_client import ollama_chat
from app.agent.personas import PanelPersona, persona_prompt_block
from app.config import get_settings


def _hash_pick(seed: str, items: list[str]) -> str:
    if not items:
        return ""
    h = int(hashlib.sha256(seed.encode("utf-8")).hexdigest(), 16)
    return items[h % len(items)]


def _fallback_follow_up(
    profile: dict,
    turns: list[dict],
    persona: PanelPersona,
    last_answer: str,
) -> str:
    name = profile.get("name") or "Candidate"
    hints = follow_up_hints(last_answer)
    snippet = " ".join(last_answer.split()[:22])
    if len(last_answer.split()) > 22:
        snippet = snippet.rstrip(",.") + "…"
    seed = f"{name}|fu|{persona.id}|{snippet[:40]}"

    skeptic_bank = [
        (
            f"Alright {name}, forgive me — I am going to be a little difficult. "
            f"You said, roughly, \"{snippet}\". A popular officer might do the opposite. "
            f"In one clear reason, why are they wrong?"
        ),
        (
            f"Hmm. That was neat. Too neat. Suppose your collector smiles and says, "
            f"'Nice theory — do the opposite tomorrow.' What do you say without sulking?"
        ),
        (
            f"I hear you. Now the arrogant question: if your approach hurts someone you claim to protect, "
            f"do you still hold it — yes or no, then why?"
        ),
        (
            f"Let me tease this a bit. You sounded confident about \"{snippet}\". "
            f"Where does that break on a chaotic Monday in the district — one concrete failure mode?"
        ),
    ]
    press_bank = [
        (
            f"Thank you. Stay with that for a moment. You mentioned \"{snippet}\". "
            f"What exactly would you do in the first hour, and who is helped or hurt?"
        ),
        (
            f"Good, but that stayed general. Give us one decision — not a speech — "
            f"and who lives with the consequences."
        ),
        (
            f"I noticed some hedging there. Pick a side cleanly: what is your call, and what do you trade away?"
        ),
        (
            f"Connect that answer to something already on your DAF — hometown, optional, work, or a hobby. "
            f"Don't leave it floating."
        ),
    ]
    short_bank = [
        (
            f"That was very brief, {name}. Take thirty seconds more — one example from your own background, please."
        ),
        (
            "We need a little more than a line. Walk us through your reasoning as if we were new to the file."
        ),
    ]
    chair_bridge = [
        (
            f"Thank you. Just so we are clear — when you say \"{snippet}\", "
            f"what is the first practical step you would actually take?"
        ),
    ]
    if persona.domain == "skeptic":
        bank = skeptic_bank
    elif persona.domain == "chair-daf":
        bank = chair_bridge + press_bank
    else:
        bank = press_bank
    if "answer_was_very_short" in hints:
        bank = short_bank + bank
    return _hash_pick(seed, bank)


def _fallback_question(
    profile: dict,
    turns: list[dict],
    grounding: str | None,
    persona: PanelPersona,
    category: str,
) -> str:
    name = profile.get("name") or "Candidate"
    state = profile.get("homeState") or "your state"
    hobbies = profile.get("hobbies") or []
    optional = profile.get("optionalSubject") or ""
    branch = profile.get("engineeringBranch") or ""
    work = profile.get("workExperience") or ""
    track = profile.get("track") or "upsc-cse"
    edu = profile.get("education") or {}
    degree = edu.get("degree") or "your degree"
    board_n = sum(1 for t in turns if t.get("role") == "board")
    seed = f"{name}|{state}|{board_n}|{persona.id}|{category}"

    if category == "welcome" or board_n == 0:
        return _hash_pick(
            seed,
            [
                (
                    f"Good morning, {name}. Please, make yourself comfortable. "
                    f"To begin, introduce yourself in about two minutes — your education, "
                    f"your hometown in {state}, and what brings you to this board today."
                ),
                (
                    f"Welcome, {name}. We will keep this conversational. "
                    f"Start with a short introduction: studies, any work, and why public service."
                ),
            ],
        )

    if persona.domain == "skeptic":
        return _hash_pick(
            seed,
            [
                (
                    f"Permit me a slightly rude question, {name}. "
                    f"With your CV, why civil service — and not a job where success is measured every quarter?"
                ),
                (
                    f"I will play devil's advocate. Suppose the policy you like hurts a group you say you care about. "
                    f"Do you still support it? Say yes or no, then defend it in plain words."
                ),
                (
                    f"Someone on another board once joked that candidates from {state} oversell 'ground reality'. "
                    f"Smile if you like — then give one decision you took that actually cost you something."
                ),
            ],
        )

    if persona.domain == "subject" or category in ("optional-subject", "technical"):
        bank: list[str] = []
        if optional:
            bank.extend(
                [
                    (
                        f"Thank you. I look after the subject side. You chose {optional}. "
                        f"Tell us one field situation where that knowledge would stop a popular but wrong order."
                    ),
                    (
                        f"About {optional} — if a collector shrugs and says it is only bookish, "
                        f"how do you explain its use in under a minute, without jargon?"
                    ),
                ]
            )
        if branch or track == "psu-technical":
            bank.extend(
                [
                    (
                        f"From {branch or degree}: it is 2 a.m., an alarm trips, and the shift wants to bypass interlocks. "
                        f"What is your call, step by step?"
                    ),
                    (
                        "Vendor is pushing, management wants speed. How do you say no on paper so you are not "
                        "made the scapegoat later?"
                    ),
                ]
            )
        if bank:
            return _hash_pick(seed, bank)

    if persona.domain == "affairs-ethics" or category in ("current-affairs", "ethics"):
        bank = [
            (
                f"Picture this: tension in a district of {state}, and your SDM freezes. "
                f"What are your first three orders — simply, in order?"
            ),
            (
                "A minister's office wants a file cleared today. The rule says no. "
                "Walk us through the next hour without drama — what do you actually do?"
            ),
            (
                "A junior is being pressured to falsify a report. You sit in the middle of the hierarchy. "
                "What do you do by evening?"
            ),
        ]
        if grounding:
            bank.insert(
                0,
                (
                    "We have a recent public issue on the table. Don't give a lecture — "
                    "who loses if you pick the popular side, and will you still pick it?"
                ),
            )
        return _hash_pick(seed, bank)

    if persona.domain == "quiet" or category == "personality":
        return _hash_pick(
            seed,
            [
                (
                    f"I have been quiet, {name}, so one personal question. "
                    f"What opinion on your DAF might this board dislike — and would you still defend it?"
                ),
                (
                    f"Softly asked: if money were the only scoreboard, why not the private sector? "
                    f"Give a real reason, not a slogan."
                ),
                (
                    "Tell us one failure that was genuinely your fault. No 'team' cushion — we will not laugh."
                ),
            ],
        )

    # Chair / DAF — calm, clear, flowing
    soft = [
        (
            f"Thank you, that was helpful. You mentioned {state}. "
            f"Growing up there — what shaped how you think about administration? One concrete memory is enough."
        ),
        (
            f"Your degree is {degree}. How has that training prepared you for an officer's day-to-day responsibilities?"
        ),
    ]
    if hobbies:
        soft.append(
            (
                f"I see {hobbies[0]} on your DAF. Boards sometimes wonder if hobbies are decoration. "
                f"In a few sentences, how do you actually pursue it, and what has it taught you?"
            )
        )
    if optional:
        soft.append(
            (
                f"You took {optional} as optional. What drew you to it, and how do you see it helping in the field?"
            )
        )
    if work and str(work).lower() not in {"none", "n/a", "na", "nil"}:
        soft.append(
            (
                "About your work experience — summarise the role briefly, and one lesson you would carry into service."
            )
        )
    return _hash_pick(seed, soft)


STYLE_RULES = (
    "You are generating GENUINE spoken board questions — not bank templates. "
    "Write like a real panelist in a flowing conversation: calm chair OR witty-arrogant skeptic as assigned. "
    "Clear English. No cryptic one-liners. 1–3 sentences. End with a direct ask. "
    "May be firm, arrogant, or lightly funny — never abusive, never vague. "
    "Tie to the candidate's DAF when possible. Never repeat prior board questions."
)


async def generate(
    profile: dict,
    turns: list[dict],
    grounding: str | None,
    *,
    persona: PanelPersona,
    category: str,
    is_follow_up: bool = False,
    last_answer: str | None = None,
) -> str:
    settings = get_settings()
    prior = [t.get("text") for t in turns if t.get("role") == "board"]
    board_n = len(prior)

    # Fast path: no LLM wait — conversational fallbacks (real-time interview feel)
    if settings.board_fast_mode:
        if is_follow_up and last_answer:
            return _fallback_follow_up(profile, turns, persona, last_answer)
        return _fallback_question(profile, turns, grounding, persona, category)

    if is_follow_up and last_answer:
        system = (
            persona_prompt_block(persona)
            + "\n\nCROSS-QUESTION the last answer. Do not change topic. "
            + STYLE_RULES
        )
        user = (
            f"PROMPT_VERSION={settings.prompt_version}\n"
            f"MODE=follow_up\n"
            f"CATEGORY={category}\n"
            f"HINTS={follow_up_hints(last_answer)}\n"
            f"LAST_ANSWER:\n{last_answer}\n\n"
            f"RECENT_DIALOGUE:\n{turns[-8:]}\n\n"
            f"PROFILE:\n{profile}\n"
        )
        text = (await ollama_chat(system, user, temperature=0.5)).strip()
        if not text:
            return _fallback_follow_up(profile, turns, persona, last_answer)
        first = text.split("\n")[0].strip().strip('"')
        return first or _fallback_follow_up(profile, turns, persona, last_answer)

    phase = (
        "warm_welcome_intro"
        if board_n == 0
        else "polite_daf_probe"
        if board_n <= 2
        else "pressing_board"
    )
    system = persona_prompt_block(persona) + "\n\n" + STYLE_RULES
    user = (
        f"PROMPT_VERSION={settings.prompt_version}\n"
        f"BOARD_TURN_INDEX={board_n}\n"
        f"PHASE={phase}\n"
        f"CATEGORY={category}\n"
        f"PROFILE:\n{profile}\n\n"
        f"PRIOR_BOARD_QUESTIONS:\n{prior[-8:]}\n\n"
        f"RECENT_DIALOGUE:\n{turns[-10:]}\n\n"
        f"CURRENT_AFFAIRS_CONTEXT:\n{grounding or '(none)'}\n\n"
        "Speak the next board turn for this PHASE and CATEGORY."
    )
    text = (await ollama_chat(system, user, temperature=0.55)).strip()
    if not text:
        return _fallback_question(profile, turns, grounding, persona, category)
    first_line = text.split("\n")[0].strip().strip('"')
    for p in prior:
        if p and first_line.lower()[:40] == p.lower()[:40]:
            return _fallback_question(profile, turns, grounding, persona, category)
    return first_line or _fallback_question(
        profile, turns, grounding, persona, category
    )
