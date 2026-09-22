from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Config:
    port: int
    database_url: str
    web_origin: str
