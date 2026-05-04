from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Language = Literal["en", "ru", "mixed"]


class FeatureFlagExtras(BaseModel):
    flag_key: str
    flag_status: str
    traffic_percentage: int = Field(ge=0, le=100)
    rollout_strategy: str
    targeted_segments: list[str]


class Metadata(BaseModel):
    source_file: str
    file_path: str
    title: str
    parent_headings: list[str]
    keywords: list[str] = Field(min_length=3, max_length=10)
    summary: str = Field(max_length=200)
    language: Language
    token_count: int = Field(ge=0)
    chunk_index: int = Field(ge=0)
    chunk_total: int = Field(ge=1)
    group: str

    flag_key: str | None = None
    flag_status: str | None = None
    traffic_percentage: int | None = None
    rollout_strategy: str | None = None
    targeted_segments: list[str] | None = None

    @field_validator("keywords")
    @classmethod
    def _keywords_lowercase(cls, v: list[str]) -> list[str]:
        for kw in v:
            if not kw:
                raise ValueError("keyword must not be empty")
            if kw != kw.lower():
                raise ValueError(f"keyword must be lowercase: {kw!r}")
            if " " in kw or "\t" in kw or "\n" in kw:
                raise ValueError(f"keyword must not contain whitespace: {kw!r}")
            if len(kw) > 30:
                raise ValueError(f"keyword too long: {kw!r}")
        return v

    @field_validator("summary")
    @classmethod
    def _summary_terminator(cls, v: str) -> str:
        if not v:
            raise ValueError("summary must not be empty")
        if v[-1] not in ".!?":
            raise ValueError("summary must end with terminal punctuation (.!?)")
        return v

    @model_validator(mode="after")
    def _index_lt_total(self) -> "Metadata":
        if self.chunk_index >= self.chunk_total:
            raise ValueError("chunk_index must be < chunk_total")
        return self


class Chunk(BaseModel):
    id: str
    text: str
    metadata: Metadata
