import io
from typing import List, Optional
from pydantic import BaseModel
import pypdf


class ExtractedPage(BaseModel):
    page_number: int
    text: str
    metadata: dict = {}


class DocumentExtractor:
    """Extracts raw text and per-page structures from documents (PDF, TXT, MD, etc.)."""

    @staticmethod
    def extract_from_pdf(content_bytes: bytes, filename: str = "") -> List[ExtractedPage]:
        """Extract text page-by-page from a PDF byte stream."""
        pages: List[ExtractedPage] = []
        try:
            reader = pypdf.PdfReader(io.BytesIO(content_bytes))
            for idx, page in enumerate(reader.pages):
                extracted = page.extract_text() or ""
                pages.append(
                    ExtractedPage(
                        page_number=idx + 1,
                        text=extracted,
                        metadata={"filename": filename, "total_pages": len(reader.pages)},
                    )
                )
        except Exception as e:
            # If PDF parsing fails, return at least one page with error or partial text
            raise ValueError(f"Failed to parse PDF document '{filename}': {str(e)}")

        if not pages:
            pages.append(ExtractedPage(page_number=1, text="", metadata={"filename": filename}))
        return pages

    @staticmethod
    def extract_from_text(content_text: str, filename: str = "") -> List[ExtractedPage]:
        """Extract text from plain text/markdown documents. Splits into logical pages if form feeds present."""
        raw_pages = content_text.split("\x0c")  # Standard form feed page break
        if len(raw_pages) <= 1:
            return [ExtractedPage(page_number=1, text=content_text, metadata={"filename": filename})]

        pages: List[ExtractedPage] = []
        for idx, p in enumerate(raw_pages):
            pages.append(
                ExtractedPage(
                    page_number=idx + 1,
                    text=p,
                    metadata={"filename": filename, "total_pages": len(raw_pages)},
                )
            )
        return pages

    @classmethod
    def extract(cls, content: bytes, filename: str) -> List[ExtractedPage]:
        """Auto-detect format by extension or header and extract pages."""
        lower_name = filename.lower()
        if lower_name.endswith(".pdf") or content.startswith(b"%PDF"):
            return cls.extract_from_pdf(content, filename=filename)
        
        # Text/Markdown fallback
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("latin-1", errors="replace")
        return cls.extract_from_text(text, filename=filename)
