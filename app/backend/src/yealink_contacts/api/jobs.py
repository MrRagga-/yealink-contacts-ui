from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from yealink_contacts.api.deps import db_session
from yealink_contacts.models.job import SyncJob
from yealink_contacts.schemas.job import SyncJobResponse

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[SyncJobResponse])
def jobs(db: Session = Depends(db_session)) -> list[SyncJobResponse]:
    items = (
        db.execute(select(SyncJob).options(joinedload(SyncJob.events)).order_by(SyncJob.created_at.desc()))
        .unique()
        .scalars()
        .all()
    )
    return [SyncJobResponse.model_validate(item) for item in items]


@router.get("/{job_id}", response_model=SyncJobResponse)
def job_detail(job_id: str, db: Session = Depends(db_session)) -> SyncJobResponse:
    job = (
        db.execute(select(SyncJob).where(SyncJob.id == job_id).options(joinedload(SyncJob.events)))
        .unique()
        .scalar_one_or_none()
    )
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return SyncJobResponse.model_validate(job)
