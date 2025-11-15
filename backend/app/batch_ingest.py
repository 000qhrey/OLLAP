# app/batch_ingest.py
"""
Batch ingestion utilities for processing documents from the documents folder using LlamaIndex.
"""
from pathlib import Path
from typing import Optional
import anyio
import pdfplumber
import PyPDF2

def _extract_text_from_pdf_blocking(pdf_path: Path) -> str:
    """Blocking PDF text extraction - runs in threadpool."""
    text = ""
    try:
        # Try pdfplumber first (better for complex PDFs)
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception:
        # Fallback to PyPDF2
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        except Exception as e:
            raise Exception(f"Failed to extract text from PDF: {e}")
    return text

async def extract_text_from_pdf(pdf_path: Path, show_progress: bool = True) -> str:
    """Extract text from PDF file - runs blocking extraction in threadpool."""
    # show_progress is kept for API compatibility but not used (no progress bars in HTTP handlers)
    return await anyio.to_thread.run_sync(_extract_text_from_pdf_blocking, pdf_path)

def _extract_text_from_txt_blocking(txt_path: Path) -> str:
    """Blocking text file read - runs in threadpool."""
    with open(txt_path, 'r', encoding='utf-8') as f:
        return f.read()

def extract_text_from_txt(txt_path: Path) -> str:
    """Extract text from plain text file - synchronous version for backward compatibility."""
    return _extract_text_from_txt_blocking(txt_path)

async def extract_text_from_txt_async(txt_path: Path) -> str:
    """Extract text from plain text file - async version."""
    return await anyio.to_thread.run_sync(_extract_text_from_txt_blocking, txt_path)

async def process_document_file(file_path: Path, show_progress: bool = True) -> Optional[str]:
    """Process a document file and return its text content using LlamaIndex loaders."""
    # show_progress is kept for API compatibility but not used (no progress bars in HTTP handlers)
    suffix = file_path.suffix.lower()
    
    if suffix == '.pdf':
        return await extract_text_from_pdf(file_path, show_progress=False)
    elif suffix in ['.txt', '.md']:
        return await extract_text_from_txt_async(file_path)
    else:
        return None

async def scan_documents_folder(documents_path: Optional[Path] = None) -> dict:
    """
    Scan documents folder and return structure of subjects and files.
    
    Returns:
        {
            "maths": [{"name": "file1.pdf", "path": "...", "size": 1234}, ...],
            "physics": [{"name": "file3.pdf", "path": "...", "size": 5678}, ...],
            ...
        }
    """
    if documents_path is None:
        documents_path = Path("documents")
    
    structure = {}
    
    if not documents_path.exists():
        return structure
    
    # Scan for subject subfolders
    for item in documents_path.iterdir():
        if item.is_dir():
            subject = item.name.lower()
            structure[subject] = []
            
            # Scan files in subject folder
            for file_item in item.iterdir():
                if file_item.is_file():
                    structure[subject].append({
                        "name": file_item.name,
                        "path": str(file_item),
                        "size": file_item.stat().st_size
                    })
    
    return structure
