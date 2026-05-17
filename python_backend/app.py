from __future__ import annotations

from dataclasses import dataclass
import os
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="JPFitness Python Engine", version="1.0.0")


def _get_allowed_origins() -> list[str]:
    # Em producao, defina ALLOWED_ORIGINS com os dominios exatos do frontend.
    raw = os.getenv("ALLOWED_ORIGINS", "https://jp-fitness-alpha.vercel.app/")
    parsed = [origin.strip() for origin in raw.split(",") if origin.strip()]
    if parsed:
        return parsed

    # Fallback seguro para desenvolvimento local.
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_origin_regex=os.getenv("ALLOWED_ORIGIN_REGEX") or None,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]

class WorkoutGenerateRequest(BaseModel):
    level: str = "Intermediário"
    goal: str = "Ganho de massa muscular"
    days: int = Field(default=3, ge=1, le=7)
    equipment: str = "Academia completa"


@dataclass
class Exercise:
    name: str
    sets: int
    reps: str


BEGINNER_TEMPLATE = [
    Exercise("Agachamento com Peso Corporal", 3, "12-15"),
    Exercise("Flexão de Braço", 3, "8-12"),
    Exercise("Remada com Elástico", 3, "12-15"),
    Exercise("Prancha", 3, "30-45s"),
]

INTERMEDIATE_TEMPLATE = [
    Exercise("Supino Reto", 4, "8-10"),
    Exercise("Remada Curvada", 4, "8-10"),
    Exercise("Agachamento Livre", 4, "8-10"),
    Exercise("Desenvolvimento com Halteres", 3, "10-12"),
    Exercise("Prancha", 3, "45-60s"),
]

ADVANCED_TEMPLATE = [
    Exercise("Levantamento Terra", 5, "5-6"),
    Exercise("Supino Inclinado", 4, "6-8"),
    Exercise("Barra Fixa", 4, "6-10"),
    Exercise("Agachamento Frontal", 4, "6-8"),
    Exercise("Ab Wheel", 4, "10-12"),
]


def _workout_template(level: str) -> list[Exercise]:
    lv = level.lower()
    if "inic" in lv:
        return BEGINNER_TEMPLATE
    if "avan" in lv:
        return ADVANCED_TEMPLATE
    return INTERMEDIATE_TEMPLATE


def _split_names(days: int) -> list[str]:
    splits = {
        1: ["Treino Corpo Inteiro"],
        2: ["Treino A - Superior", "Treino B - Inferior"],
        3: ["Dia 1 - Push", "Dia 2 - Pull", "Dia 3 - Legs"],
        4: ["Dia 1 - Peito/Tríceps", "Dia 2 - Costas/Bíceps", "Dia 3 - Pernas", "Dia 4 - Ombros/Core"],
        5: ["Dia 1 - Push", "Dia 2 - Pull", "Dia 3 - Legs", "Dia 4 - Upper", "Dia 5 - Lower"],
    }
    if days in splits:
        return splits[days]
    base = splits[5]
    for i in range(6, days + 1):
        base.append(f"Dia {i} - Técnico/Leve")
    return base


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "engine": "python"}


@app.post("/api/chat/reply")
def chat_reply(payload: ChatRequest) -> dict:
    last_user = ""
    for msg in reversed(payload.messages):
        if msg.role == "user":
            last_user = msg.content.lower()
            break

    if not last_user:
        return {"reply": "Posso te ajudar com treino e organização da rotina. Me diga seu objetivo atual."}

    if any(k in last_user for k in ["treino", "hipertrof", "força", "ficha"]):
        return {
            "reply": (
                "Comece com 3 a 5 treinos semanais, progressão de carga e execução controlada. "
                "Posso sugerir uma divisão semanal com séries e repetições para seu nível."
            )
        }

    return {
        "reply": (
            "Foco no básico que gera resultado: consistência, progressão gradual e sono adequado. "
            "Se quiser, te passo um plano prático para os próximos 7 dias."
        )
    }


@app.get("/api/motivation/quote")
def motivation_quote() -> dict:
    return {"quote": "Consistência vence intensidade esporádica: faça o básico muito bem, todos os dias."}


@app.post("/api/workouts/generate")
def workouts_generate(payload: WorkoutGenerateRequest) -> dict:
    exercises = _workout_template(payload.level)
    split = _split_names(payload.days)

    lines = [
        f"## Plano de Treino ({payload.goal})",
        f"Nível: {payload.level}",
        f"Equipamento: {payload.equipment}",
        "",
    ]

    for idx, day_name in enumerate(split, start=1):
        lines.append(f"### Dia {idx}: {day_name}")
        for ex in exercises:
            lines.append(f"- {ex.name}: {ex.sets} séries de {ex.reps} repetições")
        lines.append("")

    lines.append("Progressão sugerida: quando completar todas as séries com boa técnica, aumente 2,5% a 5% da carga.")

    return {"plan": "\n".join(lines)}
