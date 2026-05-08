"""
Curriculum Library Routes - Hierarchical content management
Simple structure: Books directly link to class + subject
"""
import os
import uuid
import json as json_std
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Header, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict

from app.utils.database import execute_query, execute_one, execute_write
from app.routers.auth import get_user_from_token

router = APIRouter()


def _library_topic_row_json(row: dict) -> dict:
    """Normalize asyncpg Record → JSON-safe dict (UUIDs/strings, datetimes ISO)."""
    out = dict(row)
    for key, val in list(out.items()):
        if isinstance(val, uuid.UUID):
            out[key] = str(val)
        elif hasattr(val, "isoformat"):
            try:
                out[key] = val.isoformat()
            except Exception:
                out[key] = str(val)
    return out


def _library_topic_for_book_detail(row: dict) -> dict:
    """Nested topics under GET book: omit heavy slides_json; expose has_slides."""
    d = _library_topic_row_json(dict(row))
    sj = d.pop("slides_json", None)
    has_slides = False
    if sj is not None:
        if isinstance(sj, str):
            t = sj.strip()
            if t and t not in ("null", "[]", "{}", ""):
                has_slides = True
        elif isinstance(sj, (list, dict)):
            has_slides = bool(sj)
    d["has_slides"] = has_slides
    return d


# ============================================
# REQUEST MODELS
# ============================================

class CreateClassRequest(BaseModel):
    name: str
    display_order: Optional[int] = None


class CreateSubjectRequest(BaseModel):
    name: str
    description: Optional[str] = None


class CreateBookRequest(BaseModel):
    class_id: str
    subject_id: str
    title: str
    author: Optional[str] = None
    board_name: Optional[str] = None
    edition_year: Optional[int] = None
    pdf_url: Optional[str] = None


class ParsedChapter(BaseModel):
    chapter_number: int
    title: str
    topics: List[Dict[str, str]]


class CreateLibraryTopicRequest(BaseModel):
    title: str
    content_body: Optional[str] = ""
    slides: Optional[List[Dict]] = None
    slide_theme: Optional[str] = None


class UpdateLibraryTopicRequest(BaseModel):
    title: Optional[str] = None
    content_body: Optional[str] = None
    slides: Optional[List[Dict]] = None
    slide_theme: Optional[str] = None


class SaveParsedBookRequest(BaseModel):
    class_id: str
    subject_id: str
    title: str
    author: Optional[str] = None
    board_name: Optional[str] = None
    edition_year: Optional[int] = None
    pdf_url: Optional[str] = None
    chapters: List[ParsedChapter]


# ============================================
# SCHEMA INITIALIZATION
# ============================================

async def ensure_library_tables():
    """Create library tables if they don't exist"""
    
    # Library Classes (separate from school classes)
    await execute_write("""
        CREATE TABLE IF NOT EXISTS library_classes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL UNIQUE,
            display_order INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    # Seed default library classes
    default_classes = [
        ("Class 1", 1), ("Class 2", 2), ("Class 3", 3), ("Class 4", 4),
        ("Class 5", 5), ("Class 6", 6), ("Class 7", 7), ("Class 8", 8),
        ("Class 9", 9), ("Class 10", 10), ("Class 11", 11), ("Class 12", 12),
        ("O-Level 1st Year", 13), ("O-Level 2nd Year", 14),
        ("A-Level 1st Year", 15), ("A-Level 2nd Year", 16)
    ]
    
    for class_name, order in default_classes:
        await execute_write("""
            INSERT INTO library_classes (name, display_order)
            VALUES ($1, $2)
            ON CONFLICT (name) DO NOTHING
        """, class_name, order)
    
    # Subjects (global list)
    await execute_write("""
        CREATE TABLE IF NOT EXISTS library_subjects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    # Link subjects to classes (a subject can be added to multiple classes)
    await execute_write("""
        CREATE TABLE IF NOT EXISTS library_class_subjects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            class_id UUID REFERENCES library_classes(id) ON DELETE CASCADE,
            subject_id UUID REFERENCES library_subjects(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(class_id, subject_id)
        )
    """)
    
    # Books (linked to library_class + subject)
    await execute_write("""
        CREATE TABLE IF NOT EXISTS library_books (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            class_id UUID REFERENCES library_classes(id) ON DELETE CASCADE,
            subject_id UUID REFERENCES library_subjects(id) ON DELETE CASCADE,
            title VARCHAR(500) NOT NULL,
            author VARCHAR(255),
            board_name VARCHAR(255),
            edition_year INTEGER,
            pdf_url TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    # Chapters
    await execute_write("""
        CREATE TABLE IF NOT EXISTS library_chapters (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            book_id UUID REFERENCES library_books(id) ON DELETE CASCADE,
            chapter_number INTEGER NOT NULL,
            title VARCHAR(500) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(book_id, chapter_number)
        )
    """)
    
    # Topics
    await execute_write("""
        CREATE TABLE IF NOT EXISTS library_topics (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            chapter_id UUID REFERENCES library_chapters(id) ON DELETE CASCADE,
            title VARCHAR(500) NOT NULL,
            content_body TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    # ── FK migration: fix any tables created with class_id → classes instead of library_classes ──
    # Drop the wrong constraints if they exist, then add correct ones
    await execute_write("""
        DO $$
        BEGIN
            -- Fix library_books.class_id FK
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'library_books_class_id_fkey'
                  AND table_name = 'library_books'
            ) THEN
                ALTER TABLE library_books DROP CONSTRAINT library_books_class_id_fkey;
            END IF;
            ALTER TABLE library_books
                ADD CONSTRAINT library_books_class_id_fkey
                FOREIGN KEY (class_id) REFERENCES library_classes(id) ON DELETE CASCADE;

            -- Fix library_class_subjects.class_id FK
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'library_class_subjects_class_id_fkey'
                  AND table_name = 'library_class_subjects'
            ) THEN
                ALTER TABLE library_class_subjects DROP CONSTRAINT library_class_subjects_class_id_fkey;
            END IF;
            ALTER TABLE library_class_subjects
                ADD CONSTRAINT library_class_subjects_class_id_fkey
                FOREIGN KEY (class_id) REFERENCES library_classes(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN
            NULL; -- constraint already correct, ignore
        END
        $$;
    """)

    # Indexes
    await execute_write("CREATE INDEX IF NOT EXISTS idx_library_class_subjects_class ON library_class_subjects(class_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_library_class_subjects_subject ON library_class_subjects(subject_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_library_books_class ON library_books(class_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_library_books_subject ON library_books(subject_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_library_chapters_book ON library_chapters(book_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_library_topics_chapter ON library_topics(chapter_id)")
    await execute_write(
        "ALTER TABLE library_topics ADD COLUMN IF NOT EXISTS slides_json TEXT"
    )
    await execute_write(
        "ALTER TABLE library_topics ADD COLUMN IF NOT EXISTS slide_theme VARCHAR(160)"
    )


# ============================================
# LIBRARY CLASSES
# ============================================

@router.post("/classes")
async def create_library_class(req: CreateClassRequest, current_user: dict = Depends(get_user_from_token)):
    """Create a new library class"""
    await ensure_library_tables()
    existing = await execute_one(
        "SELECT id FROM library_classes WHERE LOWER(name) = LOWER($1)", req.name
    )
    if existing:
        raise HTTPException(status_code=400, detail="Class already exists")
    max_order = await execute_one("SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM library_classes")
    order = req.display_order if req.display_order is not None else max_order["next_order"]
    result = await execute_one(
        "INSERT INTO library_classes (name, display_order) VALUES ($1, $2) RETURNING *",
        req.name, order
    )
    return {"data": dict(result)}


@router.get("/classes")
async def get_library_classes():
    """Get all library classes (Class 1-12, O-Level, A-Level)"""
    await ensure_library_tables()
    classes = await execute_query("""
        SELECT 
            lc.id, lc.name, lc.display_order,
            COUNT(DISTINCT lcs.subject_id) as subject_count,
            COUNT(DISTINCT lb.id) as book_count
        FROM library_classes lc
        LEFT JOIN library_class_subjects lcs ON lcs.class_id = lc.id
        LEFT JOIN library_books lb ON lb.class_id = lc.id
        GROUP BY lc.id
        ORDER BY lc.display_order
    """)
    return {"data": [dict(c) for c in classes]}


@router.delete("/classes/{class_id}")
async def delete_library_class(class_id: str, current_user: dict = Depends(get_user_from_token)):
    """Delete a library class and all its subjects/books"""
    await execute_write("DELETE FROM library_classes WHERE id = $1", class_id)
    return {"message": "Class deleted"}


# ============================================
# SUBJECTS (Global list)
# ============================================

@router.get("/subjects")
async def get_all_subjects():
    """Get all subjects (global list)"""
    await ensure_library_tables()
    subjects = await execute_query("SELECT * FROM library_subjects ORDER BY name")
    return {"data": [dict(s) for s in subjects]}


@router.post("/subjects")
async def create_subject(req: CreateSubjectRequest, current_user: dict = Depends(get_user_from_token)):
    """Create a new subject"""
    await ensure_library_tables()
    
    existing = await execute_one("SELECT id FROM library_subjects WHERE LOWER(name) = LOWER($1)", req.name)
    if existing:
        raise HTTPException(status_code=400, detail="Subject already exists")
    
    result = await execute_one(
        "INSERT INTO library_subjects (name, description) VALUES ($1, $2) RETURNING *",
        req.name, req.description
    )
    return {"data": result}


@router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str, current_user: dict = Depends(get_user_from_token)):
    """Delete a subject"""
    await execute_write("DELETE FROM library_subjects WHERE id = $1", subject_id)
    return {"message": "Subject deleted"}


# ============================================
# CLASS-SUBJECT LINKING
# ============================================

@router.get("/classes/{class_id}/subjects")
async def get_class_subjects(class_id: str):
    """Get subjects available for a specific library class"""
    await ensure_library_tables()
    
    subjects = await execute_query("""
        SELECT s.id, s.name, s.description, 
               COUNT(DISTINCT b.id) as book_count
        FROM library_subjects s
        JOIN library_class_subjects lcs ON lcs.subject_id = s.id
        LEFT JOIN library_books b ON b.subject_id = s.id AND b.class_id = $1
        WHERE lcs.class_id = $1
        GROUP BY s.id, s.name, s.description
        ORDER BY s.name
    """, class_id)
    
    return {"data": [dict(s) for s in subjects]}


@router.post("/classes/{class_id}/subjects")
async def add_subject_to_class(class_id: str, req: CreateSubjectRequest, current_user: dict = Depends(get_user_from_token)):
    """Add a subject to a library class (create subject if doesn't exist, then link)"""
    await ensure_library_tables()
    
    # Check if subject exists, if not create it
    subject = await execute_one(
        "SELECT id FROM library_subjects WHERE LOWER(name) = LOWER($1)",
        req.name
    )
    
    if not subject:
        subject = await execute_one(
            """
            INSERT INTO library_subjects (name, description)
            VALUES ($1, $2)
            RETURNING id
            """,
            req.name, req.description
        )
    
    subject_id = subject["id"]
    
    # Link subject to class (ignore if already linked)
    await execute_write("""
        INSERT INTO library_class_subjects (class_id, subject_id)
        VALUES ($1, $2)
        ON CONFLICT (class_id, subject_id) DO NOTHING
    """, class_id, subject_id)
    
    return {
        "message": "Subject added to class",
        "subject_id": subject_id
    }


@router.delete("/classes/{class_id}/subjects/{subject_id}")
async def remove_subject_from_class(class_id: str, subject_id: str, current_user: dict = Depends(get_user_from_token)):
    """Remove a subject from a class (unlinks it; also deletes books for this class+subject)"""
    await execute_write(
        "DELETE FROM library_books WHERE class_id = $1 AND subject_id = $2",
        class_id, subject_id
    )
    await execute_write(
        "DELETE FROM library_class_subjects WHERE class_id = $1 AND subject_id = $2",
        class_id, subject_id
    )
    return {"message": "Subject removed from class"}


# ============================================
# BOOKS
# ============================================

@router.get("/library/{class_id}/{subject_id}/books")
async def get_books(class_id: str, subject_id: str):
    """Get books for class + subject"""
    await ensure_library_tables()
    
    books = await execute_query(
        """
        SELECT b.*, lc.name as class_name, s.name as subject_name
        FROM library_books b
        JOIN library_classes lc ON b.class_id = lc.id
        JOIN library_subjects s ON b.subject_id = s.id
        WHERE b.class_id = $1 AND b.subject_id = $2
        ORDER BY b.title
        """,
        class_id, subject_id
    )
    return {"data": [dict(b) for b in books]}


@router.post("/library/books")
async def create_book(req: CreateBookRequest, current_user: dict = Depends(get_user_from_token)):
    """Create a book (validates subject is linked to class first)"""
    if not req.title or not req.title.strip():
        raise HTTPException(status_code=400, detail="Book title is required")
    await ensure_library_tables()

    # Validate that this subject is linked to this class
    link = await execute_one("""
        SELECT id FROM library_class_subjects 
        WHERE class_id = $1 AND subject_id = $2
    """, req.class_id, req.subject_id)
    
    if not link:
        # Get class and subject names for better error message
        class_data = await execute_one("SELECT name FROM library_classes WHERE id = $1", req.class_id)
        subject_data = await execute_one("SELECT name FROM library_subjects WHERE id = $1", req.subject_id)
        
        class_name = class_data["name"] if class_data else "this class"
        subject_name = subject_data["name"] if subject_data else "this subject"
        
        raise HTTPException(
            status_code=400, 
            detail=f"Please add '{subject_name}' to '{class_name}' first before uploading books."
        )
    
    # Check if book already exists
    existing = await execute_one(
        """
        SELECT id FROM library_books 
        WHERE class_id = $1 AND subject_id = $2 
        AND LOWER(title) = LOWER($3) AND LOWER(COALESCE(author, '')) = LOWER($4)
        """,
        req.class_id, req.subject_id, req.title, req.author or ""
    )
    
    if existing:
        raise HTTPException(status_code=400, detail="Book with same title and author already exists for this class and subject")
    
    result = await execute_one(
        """
        INSERT INTO library_books (class_id, subject_id, title, author, board_name, edition_year, pdf_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        """,
        req.class_id, req.subject_id, req.title, req.author, req.board_name, req.edition_year, req.pdf_url
    )
    return {"data": dict(result)}


@router.get("/library/books/{book_id}")
async def get_book_details(book_id: str):
    """Get book with chapters and topics"""
    book = await execute_one(
        """
        SELECT b.*, lc.name as class_name, s.name as subject_name
        FROM library_books b
        JOIN library_classes lc ON b.class_id = lc.id
        JOIN library_subjects s ON b.subject_id = s.id
        WHERE b.id = $1
        """,
        book_id
    )
    
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    chapters_raw = await execute_query(
        "SELECT * FROM library_chapters WHERE book_id = $1 ORDER BY chapter_number",
        book_id
    )

    chapters = []
    for chapter in chapters_raw:
        chapter_dict = dict(chapter)
        topics_raw = await execute_query(
            "SELECT * FROM library_topics WHERE chapter_id = $1 ORDER BY created_at",
            chapter_dict["id"]
        )
        chapter_dict["topics"] = [_library_topic_for_book_detail(dict(t)) for t in topics_raw]
        chapters.append(chapter_dict)

    book_dict = dict(book)
    book_dict["chapters"] = chapters
    return {"data": book_dict}


@router.delete("/library/books/{book_id}")
async def delete_book(book_id: str, current_user: dict = Depends(get_user_from_token)):
    """Delete a book"""
    await execute_write("DELETE FROM library_books WHERE id = $1", book_id)
    return {"message": "Book deleted"}


@router.post("/upload-pdf")
async def upload_book_pdf(file: UploadFile = File(...), current_user: dict = Depends(get_user_from_token)):
    """Upload a PDF file and return its static URL"""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    max_bytes = 100 * 1024 * 1024  # 100 MB
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail="File too large (max 100 MB)")

    upload_dir = "static/books"
    os.makedirs(upload_dir, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join(upload_dir, safe_name)
    with open(file_path, "wb") as f:
        f.write(content)

    return {"url": f"/static/books/{safe_name}", "filename": file.filename}


# ============================================
# AI PARSER - SAVE PARSED BOOK
# ============================================

@router.post("/library/parse-and-save")
async def save_parsed_book(req: SaveParsedBookRequest, current_user: dict = Depends(get_user_from_token)):
    """Save AI-parsed book with chapters and topics"""
    await ensure_library_tables()
    
    try:
        # Validate that this subject is linked to this class
        link = await execute_one("""
            SELECT id FROM library_class_subjects 
            WHERE class_id = $1 AND subject_id = $2
        """, req.class_id, req.subject_id)
        
        if not link:
            class_data = await execute_one("SELECT name FROM library_classes WHERE id = $1", req.class_id)
            subject_data = await execute_one("SELECT name FROM library_subjects WHERE id = $1", req.subject_id)
            
            class_name = class_data["name"] if class_data else "this class"
            subject_name = subject_data["name"] if subject_data else "this subject"
            
            raise HTTPException(
                status_code=400, 
                detail=f"Please add '{subject_name}' to '{class_name}' first before uploading books."
            )
        
        # Check duplicate
        existing = await execute_one(
            """
            SELECT id FROM library_books 
            WHERE class_id = $1 AND subject_id = $2 
            AND LOWER(title) = LOWER($3) AND LOWER(COALESCE(author, '')) = LOWER($4)
            """,
            req.class_id, req.subject_id, req.title, req.author or ""
        )
        
        if existing:
            raise HTTPException(status_code=400, detail=f"Book '{req.title}' already exists for this class and subject")
        
        # Create book
        book = await execute_one(
            """
            INSERT INTO library_books (class_id, subject_id, title, author, board_name, edition_year, pdf_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, title
            """,
            req.class_id, req.subject_id, req.title, req.author, req.board_name, req.edition_year, req.pdf_url
        )
        
        chapters_created = 0
        topics_created = 0
        
        # Create chapters and topics
        for chapter_data in req.chapters:
            chapter = await execute_one(
                "INSERT INTO library_chapters (book_id, chapter_number, title) VALUES ($1, $2, $3) RETURNING id",
                book["id"], chapter_data.chapter_number, chapter_data.title
            )
            chapters_created += 1
            
            for topic_data in chapter_data.topics:
                await execute_write(
                    "INSERT INTO library_topics (chapter_id, title, content_body) VALUES ($1, $2, $3)",
                    chapter["id"], topic_data.get("title", "Untitled"), topic_data.get("content_body", "")
                )
                topics_created += 1
        
        return {
            "message": "Book saved successfully",
            "data": {
                "book_id": book["id"],
                "book_title": book["title"],
                "chapters_created": chapters_created,
                "topics_created": topics_created
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save book: {str(e)}")


# ============================================
# LIBRARY TOPICS (slides + metadata for AI slide studio)
# ============================================


def _serialize_slides(slides: Optional[List[Dict]]) -> Optional[str]:
    if slides is None:
        return None
    try:
        return json_std.dumps(slides, ensure_ascii=False)
    except Exception:
        return "[]"


@router.get("/library/topics/{topic_id}")
async def get_library_topic(topic_id: str):
    """Single library topic (includes slides_json when present)."""
    await ensure_library_tables()
    topic_id = (topic_id or "").strip()
    row = await execute_one("SELECT * FROM library_topics WHERE id = $1::uuid", topic_id)
    if not row:
        raise HTTPException(status_code=404, detail="Topic not found")
    return {"data": _library_topic_row_json(dict(row))}


@router.put("/library/topics/{topic_id}")
async def update_library_topic(
    topic_id: str,
    body: UpdateLibraryTopicRequest,
    current_user: dict = Depends(get_user_from_token),
):
    await ensure_library_tables()
    topic_id = (topic_id or "").strip()
    existing = await execute_one("SELECT id FROM library_topics WHERE id = $1::uuid", topic_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Topic not found")

    fields = []
    args = []
    n = 1

    if body.title is not None:
        fields.append(f"title = ${n}")
        args.append(body.title.strip()[:500])
        n += 1
    if body.content_body is not None:
        fields.append(f"content_body = ${n}")
        args.append(body.content_body)
        n += 1
    if body.slides is not None:
        fields.append(f"slides_json = ${n}")
        args.append(_serialize_slides(body.slides))
        n += 1
    if body.slide_theme is not None:
        fields.append(f"slide_theme = ${n}")
        args.append(body.slide_theme[:160] if body.slide_theme else None)
        n += 1

    if not fields:
        row = await execute_one("SELECT * FROM library_topics WHERE id = $1::uuid", topic_id)
        return {"data": _library_topic_row_json(dict(row))}

    args.append(topic_id)
    q = f"UPDATE library_topics SET {', '.join(fields)} WHERE id = ${n}::uuid RETURNING *"
    row = await execute_one(q, *args)
    return {"data": _library_topic_row_json(dict(row))}


@router.post("/library/chapters/{chapter_id}/topics")
async def create_library_topic(
    chapter_id: str,
    body: CreateLibraryTopicRequest,
    current_user: dict = Depends(get_user_from_token),
):
    """Create a topic under a chapter (for saving AI slide decks into the library hierarchy)."""
    await ensure_library_tables()
    if not body.title or not body.title.strip():
        raise HTTPException(status_code=400, detail="Topic title is required")

    ch = await execute_one(
        "SELECT id, book_id FROM library_chapters WHERE id = $1::uuid",
        chapter_id,
    )
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")

    slides_str = _serialize_slides(body.slides) if body.slides is not None else None
    theme = (body.slide_theme or "")[:160] or None

    row = await execute_one(
        """
        INSERT INTO library_topics (chapter_id, title, content_body, slides_json, slide_theme)
        VALUES ($1::uuid, $2, $3, $4, $5)
        RETURNING *
        """,
        chapter_id,
        body.title.strip()[:500],
        body.content_body or "",
        slides_str,
        theme,
    )
    return {"data": _library_topic_row_json(dict(row))}
