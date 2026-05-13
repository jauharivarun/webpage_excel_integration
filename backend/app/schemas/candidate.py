from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class CandidateBase(BaseModel):
    """
    Early-stage applicant: contact + role basics only.

    Fields such as match score, pipeline status, and offer details are omitted
    until interviews/contact happen.
    """

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    name: str
    email: str = ""
    contact: str = ""
    linkedin: str = ""
    experience: int = 0
    skills: list[str] = Field(default_factory=list)
    # Accept camelCase from the browser / OpenAPI JSON and snake_case from internal dicts.
    current_role: str = Field(
        default="",
        validation_alias=AliasChoices("currentRole", "current_role"),
        serialization_alias="currentRole",
    )
    current_company: str = Field(
        default="",
        validation_alias=AliasChoices("currentCompany", "current_company"),
        serialization_alias="currentCompany",
    )


class BulkCommitRequest(BaseModel):
    """Body for ``POST /api/candidates/commit`` — upsert reviewed rows."""

    candidates: list[CandidateBase]
