import re
from typing import List, Optional
from pydantic import BaseModel
from app.rag.extractor import ExtractedPage
from app.rag.cleaner import ClinicalTextCleaner


class ChunkItem(BaseModel):
    content: str
    clean_content: str
    page_number: int
    chunk_index: int
    char_count: int


class ClinicalChunker:
    """Splits clinical text into semantically cohesive chunks while preserving page numbers and order."""

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 80):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_pages(self, pages: List[ExtractedPage]) -> List[ChunkItem]:
        """Chunk a list of extracted pages, preserving the page_number on every generated chunk."""
        all_chunks: List[ChunkItem] = []
        global_chunk_index = 0

        for page in pages:
            raw_text = page.text or ""
            cleaned_text = ClinicalTextCleaner.clean(raw_text)

            if not cleaned_text:
                continue

            page_chunks = self._chunk_text(cleaned_text, raw_text)
            for chunk_text in page_chunks:
                clean_chunk = ClinicalTextCleaner.clean(chunk_text)
                if not clean_chunk:
                    continue

                all_chunks.append(
                    ChunkItem(
                        content=chunk_text,
                        clean_content=clean_chunk,
                        page_number=page.page_number,
                        chunk_index=global_chunk_index,
                        char_count=len(chunk_text),
                    )
                )
                global_chunk_index += 1

        # If all pages were empty but at least one page existed, provide an empty chunk fallback
        if not all_chunks and pages:
            all_chunks.append(
                ChunkItem(
                    content="",
                    clean_content="",
                    page_number=pages[0].page_number,
                    chunk_index=0,
                    char_count=0,
                )
            )

        return all_chunks

    def _chunk_text(self, clean_text: str, original_text: str) -> List[str]:
        """Split text into segments respecting sentence boundaries."""
        if len(clean_text) <= self.chunk_size:
            return [clean_text]

        # Split into sentences using punctuation boundaries
        sentence_delimiters = re.compile(r"(?<=[.!?])\s+")
        sentences = [s.strip() for s in sentence_delimiters.split(clean_text) if s.strip()]

        chunks: List[str] = []
        current_chunk: List[str] = []
        current_length = 0

        for sentence in sentences:
            sentence_len = len(sentence)
            if current_length + sentence_len > self.chunk_size and current_chunk:
                chunk_str = " ".join(current_chunk)
                chunks.append(chunk_str)

                # Overlap logic: keep last sentence if reasonable
                if len(current_chunk) > 1 and len(current_chunk[-1]) <= self.chunk_overlap:
                    current_chunk = [current_chunk[-1], sentence]
                    current_length = len(current_chunk[0]) + 1 + sentence_len
                else:
                    current_chunk = [sentence]
                    current_length = sentence_len
            else:
                current_chunk.append(sentence)
                current_length += sentence_len + 1

        if current_chunk:
            chunks.append(" ".join(current_chunk))

        return chunks
