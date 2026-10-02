import re
from typing import Optional


class ClinicalTextCleaner:
    """Cleans clinical document text while preserving critical medical terminology, dosages, and values."""

    # Common recurring artifacts in clinical reports & PDFs
    PAGE_NUMBER_PATTERN = re.compile(r"(?i)\bpage\s+\d+(\s+of\s+\d+)?\b")
    HEADER_FOOTER_DIVIDER = re.compile(r"^\s*[-=_*~]{3,}\s*$", re.MULTILINE)
    MULTIPLE_SPACES = re.compile(r"[ \t]+")
    MULTIPLE_NEWLINES = re.compile(r"\n{3,}")

    @classmethod
    def clean(cls, text: str) -> str:
        """Clean and normalize raw extracted clinical text."""
        if not text:
            return ""

        # Normalize unicode dashes, quotes, bullets
        cleaned = text.replace("\r\n", "\n").replace("\r", "\n")
        cleaned = cleaned.replace("“", '"').replace("”", '"').replace("’", "'").replace("‘", "'")
        cleaned = cleaned.replace("–", "-").replace("—", "-")
        cleaned = cleaned.replace("\u2022", "*").replace("\u25cf", "*")  # bullet points

        # Remove page number stamps like "Page 1 of 4"
        cleaned = cls.PAGE_NUMBER_PATTERN.sub("", cleaned)

        # Remove horizontal divider lines
        cleaned = cls.HEADER_FOOTER_DIVIDER.sub("", cleaned)

        # Normalize whitespace while preserving paragraphs
        lines = [line.strip() for line in cleaned.split("\n")]
        cleaned = "\n".join(lines)

        # Collapse excess empty lines and multiple spaces
        cleaned = cls.MULTIPLE_SPACES.sub(" ", cleaned)
        cleaned = cls.MULTIPLE_NEWLINES.sub("\n\n", cleaned)

        return cleaned.strip()
