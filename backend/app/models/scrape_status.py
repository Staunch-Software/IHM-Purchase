import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ScrapeRunStatus(str, enum.Enum):
    RUNNING = "running"
    SUCCESS = "success"
    PARTIAL_FAILURE = "partial_failure"
    FAILED = "failed"


class ScrapeRunType(str, enum.Enum):
    FULL = "full"
    LIST_ONLY = "list_only"
    DETAIL_ONLY = "detail_only"
    RESUME = "resume"
    INCREMENTAL = "incremental"  # Skip POs already in DB; only scrape new ones


class ScrapeRun(Base):
    __tablename__ = "scrape_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_type: Mapped[ScrapeRunType] = mapped_column(Enum(ScrapeRunType, name="scrape_run_type"), default=ScrapeRunType.FULL)
    status: Mapped[ScrapeRunStatus] = mapped_column(Enum(ScrapeRunStatus, name="scrape_run_status"), default=ScrapeRunStatus.RUNNING)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    total_pos_found: Mapped[int | None] = mapped_column(Integer)
    pos_succeeded: Mapped[int | None] = mapped_column(Integer, default=0)
    pos_failed: Mapped[int | None] = mapped_column(Integer, default=0)
    error_summary: Mapped[str | None] = mapped_column(Text)

    row_errors: Mapped[list["ScrapeRowError"]] = relationship(back_populates="scrape_run", cascade="all, delete-orphan")


class ScrapeRowError(Base):
    __tablename__ = "scrape_row_errors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scrape_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scrape_runs.id", ondelete="CASCADE"))
    po_number: Mapped[str] = mapped_column(String(64), index=True)
    stage: Mapped[str] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    resolved: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    scrape_run = relationship("ScrapeRun", back_populates="row_errors")
