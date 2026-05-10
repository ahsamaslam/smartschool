"""
Curriculum Library Routes - Hierarchical content management
Simple structure: Books directly link to class + subject
"""
import os
import uuid
import json as json_std
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Header, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict

from app.utils.database import execute_query, execute_one, execute_write
from app.routers.auth import get_user_from_token

router = APIRouter()


def _form_float_relaxed(value: Optional[str], default: float = 0.0) -> float:
    """Parse multipart form numbers without Pydantic rejecting odd client strings."""
    if value is None or (isinstance(value, str) and value.strip() == ""):
        return default
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return default


def _form_bool_relaxed(value: Optional[str]) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in ("1", "true", "yes", "on")


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
    lecture_video_url = d.get("lecture_video_url")
    lecture_metadata_json = d.get("lecture_metadata_json")
    has_slides = False
    if sj is not None:
        if isinstance(sj, str):
            t = sj.strip()
            if t and t not in ("null", "[]", "{}", ""):
                has_slides = True
        elif isinstance(sj, (list, dict)):
            has_slides = bool(sj)
    has_lecture = False
    if lecture_video_url:
        has_lecture = True
    elif lecture_metadata_json:
        if isinstance(lecture_metadata_json, str):
            t = lecture_metadata_json.strip()
            has_lecture = bool(t and t not in ("null", "[]", "{}", ""))
        elif isinstance(lecture_metadata_json, (list, dict)):
            has_lecture = bool(lecture_metadata_json)
    d["has_slides"] = has_slides
    d["has_lecture"] = has_lecture
    return d


def _remove_local_static_file(file_url: Optional[str]) -> None:
    """Best effort cleanup for /static/... files stored on local disk."""
    if not file_url or not isinstance(file_url, str):
        return
    try:
        if not file_url.startswith("/static/"):
            return
        rel = file_url.lstrip("/").replace("/", os.sep)
        file_path = os.path.abspath(rel)
        if os.path.isfile(file_path):
            os.remove(file_path)
    except Exception:
        return


# ============================================
# REQUEST MODELS
# ============================================

class CreateClassRequest(BaseModel):
    name: str
    display_order: Optional[int] = None


class CreateSubjectRequest(BaseModel):
    name: str
    description: Optional[str] = None


class CreateBoardRequest(BaseModel):
    name: str
    description: Optional[str] = None


class LinkSectionSubjectsRequest(BaseModel):
    board_id: str
    subject_ids: List[str]


class SetSectionBooksRequest(BaseModel):
    book_ids: List[str]


class BulkAssignSectionsRequest(BaseModel):
    class_ids: List[str]
    board_id: str
    subject_ids: List[str]
    book_ids: List[str]


class SetSubjectsRequest(BaseModel):
    subject_ids: List[str]


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
    clear_slides: bool = False  # set true to explicitly wipe slides_json
    lecture_metadata: Optional[Dict] = None
    clear_lecture: bool = False


class SaveParsedBookRequest(BaseModel):
    class_id: Optional[str] = None
    board_id: Optional[str] = None
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
    
    # Persistent seed flags so defaults are inserted only once ever.
    await execute_write("""
        CREATE TABLE IF NOT EXISTS library_seed_flags (
            key VARCHAR(100) PRIMARY KEY,
            value BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

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
    
    classes_seeded = await execute_one(
        "SELECT value FROM library_seed_flags WHERE key = 'default_library_classes_seeded'"
    )
    if not classes_seeded:
        for class_name, order in default_classes:
            await execute_write("""
                INSERT INTO library_classes (name, display_order)
                VALUES ($1, $2)
                ON CONFLICT (name) DO NOTHING
            """, class_name, order)
        await execute_write(
            """
            INSERT INTO library_seed_flags (key, value)
            VALUES ('default_library_classes_seeded', true)
            ON CONFLICT (key) DO NOTHING
            """
        )
    
    # Subjects (global list)
    await execute_write("""
        CREATE TABLE IF NOT EXISTS library_subjects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

    # Boards (Punjab board, KPK board, Oxford, O/A Levels, etc.)
    await execute_write("""
        CREATE TABLE IF NOT EXISTS library_boards (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

    default_boards = [
        ("Punjab Board", "Punjab textbook board"),
        ("KPK Board", "Khyber Pakhtunkhwa textbook board"),
        ("Oxford", "Oxford curriculum"),
        ("O-Level", "Cambridge O-Level stream"),
        ("A-Level", "Cambridge A-Level stream"),
    ]
    boards_seeded = await execute_one(
        "SELECT value FROM library_seed_flags WHERE key = 'default_library_boards_seeded'"
    )
    if not boards_seeded:
        for board_name, board_desc in default_boards:
            await execute_write(
                """
                INSERT INTO library_boards (name, description)
                VALUES ($1, $2)
                ON CONFLICT (name) DO NOTHING
                """,
                board_name,
                board_desc,
            )
        await execute_write(
            """
            INSERT INTO library_seed_flags (key, value)
            VALUES ('default_library_boards_seeded', true)
            ON CONFLICT (key) DO NOTHING
            """
        )

    # Subject availability per board
    await execute_write("""
        CREATE TABLE IF NOT EXISTS library_board_subjects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            board_id UUID REFERENCES library_boards(id) ON DELETE CASCADE,
            subject_id UUID REFERENCES library_subjects(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(board_id, subject_id)
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

    # Section-level subject assignment (class row in classes table acts as section)
    await execute_write("""
        CREATE TABLE IF NOT EXISTS section_subjects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
            board_id UUID REFERENCES library_boards(id) ON DELETE CASCADE,
            subject_id UUID REFERENCES library_subjects(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(class_id, board_id, subject_id)
        )
    """)

    # Section-level book assignment
    await execute_write("""
        CREATE TABLE IF NOT EXISTS section_books (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
            book_id UUID REFERENCES library_books(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(class_id, book_id)
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
    await execute_write("CREATE INDEX IF NOT EXISTS idx_library_board_subjects_board ON library_board_subjects(board_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_library_board_subjects_subject ON library_board_subjects(subject_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_library_books_class ON library_books(class_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_library_books_subject ON library_books(subject_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_library_chapters_book ON library_chapters(book_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_library_topics_chapter ON library_topics(chapter_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_section_subjects_class ON section_subjects(class_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_section_subjects_board ON section_subjects(board_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_section_subjects_subject ON section_subjects(subject_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_section_books_class ON section_books(class_id)")
    await execute_write("CREATE INDEX IF NOT EXISTS idx_section_books_book ON section_books(book_id)")
    await execute_write(
        "ALTER TABLE library_topics ADD COLUMN IF NOT EXISTS slides_json TEXT"
    )
    await execute_write(
        "ALTER TABLE library_topics ADD COLUMN IF NOT EXISTS slide_theme VARCHAR(160)"
    )
    await execute_write(
        "ALTER TABLE library_topics ADD COLUMN IF NOT EXISTS lecture_video_url TEXT"
    )
    await execute_write(
        "ALTER TABLE library_topics ADD COLUMN IF NOT EXISTS lecture_metadata_json TEXT"
    )
    await execute_write(
        "ALTER TABLE library_topics ADD COLUMN IF NOT EXISTS lecture_saved_at TIMESTAMP"
    )
    await execute_write(
        "ALTER TABLE library_topics ADD COLUMN IF NOT EXISTS lecture_duration_seconds DOUBLE PRECISION"
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


# ============================================
# BOARDS
# ============================================

@router.get("/boards")
async def get_all_boards():
    """Get all boards with subject count."""
    await ensure_library_tables()
    boards = await execute_query(
        """
        SELECT
            b.id,
            b.name,
            b.description,
            b.created_at,
            COUNT(bs.subject_id) AS subject_count
        FROM library_boards b
        LEFT JOIN library_board_subjects bs ON bs.board_id = b.id
        GROUP BY b.id
        ORDER BY b.name
        """
    )
    return {"data": [dict(b) for b in boards]}


@router.post("/boards")
async def create_board(req: CreateBoardRequest, current_user: dict = Depends(get_user_from_token)):
    """Create a new board."""
    await ensure_library_tables()
    existing = await execute_one("SELECT id FROM library_boards WHERE LOWER(name) = LOWER($1)", req.name)
    if existing:
        raise HTTPException(status_code=400, detail="Board already exists")
    row = await execute_one(
        "INSERT INTO library_boards (name, description) VALUES ($1, $2) RETURNING *",
        req.name.strip(),
        req.description,
    )
    return {"data": dict(row)}


@router.delete("/boards/{board_id}")
async def delete_board(board_id: str, current_user: dict = Depends(get_user_from_token)):
    """Delete board and linked assignments."""
    await ensure_library_tables()
    await execute_write("DELETE FROM library_boards WHERE id = $1::uuid", board_id)
    return {"message": "Board deleted"}


@router.get("/boards/{board_id}/subjects")
async def get_board_subjects(board_id: str):
    """Get board subject list."""
    await ensure_library_tables()
    rows = await execute_query(
        """
        SELECT s.id, s.name, s.description
        FROM library_board_subjects bs
        JOIN library_subjects s ON s.id = bs.subject_id
        WHERE bs.board_id = $1::uuid
        ORDER BY s.name
        """,
        board_id,
    )
    return {"data": [dict(r) for r in rows]}


@router.put("/boards/{board_id}/subjects")
async def set_board_subjects(
    board_id: str,
    req: SetSubjectsRequest,
    current_user: dict = Depends(get_user_from_token),
):
    """Replace board subject mapping."""
    await ensure_library_tables()
    subject_ids = list(dict.fromkeys(req.subject_ids or []))
    await execute_write("DELETE FROM library_board_subjects WHERE board_id = $1::uuid", board_id)
    for sid in subject_ids:
        await execute_write(
            """
            INSERT INTO library_board_subjects (board_id, subject_id)
            VALUES ($1::uuid, $2::uuid)
            ON CONFLICT (board_id, subject_id) DO NOTHING
            """,
            board_id,
            sid,
        )
    return {"message": "Board subjects updated", "count": len(subject_ids)}


# ============================================
# SECTION SUBJECT LINKING
# ============================================

def _extract_grade_number(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    return int(digits) if digits else None


@router.get("/sections/{class_id}/subjects/catalog")
async def get_section_subject_catalog(class_id: str):
    """
    Get section's currently linked board/subjects and matching library catalog.
    """
    await ensure_library_tables()
    section = await execute_one(
        """
        SELECT id, name, grade_level, section
        FROM classes
        WHERE id = $1::uuid
        """,
        class_id,
    )
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    grade_num = _extract_grade_number(section.get("grade_level"))
    candidate_names = []
    if grade_num:
        candidate_names.extend([f"Class {grade_num}", str(grade_num)])

    library_class = None
    if candidate_names:
        library_class = await execute_one(
            """
            SELECT id, name
            FROM library_classes
            WHERE LOWER(name) = ANY($1::text[])
            ORDER BY display_order
            LIMIT 1
            """,
            [n.lower() for n in candidate_names],
        )

    boards = await execute_query(
        """
        SELECT
            b.id,
            b.name,
            b.description,
            COALESCE(
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', s.id,
                            'name', s.name,
                            'description', s.description
                        ) ORDER BY s.name
                    )
                    FROM library_board_subjects bs
                    JOIN library_subjects s ON s.id = bs.subject_id
                    WHERE bs.board_id = b.id
                ),
                '[]'::json
            ) AS subjects
        FROM library_boards b
        ORDER BY b.name
        """
    )

    # fallback subjects from matched library class if board-specific mapping is empty
    fallback_subjects = []
    if library_class:
        fallback_subjects_rows = await execute_query(
            """
            SELECT s.id, s.name, s.description
            FROM library_class_subjects lcs
            JOIN library_subjects s ON s.id = lcs.subject_id
            WHERE lcs.class_id = $1::uuid
            ORDER BY s.name
            """,
            library_class["id"],
        )
        fallback_subjects = [dict(r) for r in fallback_subjects_rows]

    linked = await execute_query(
        """
        SELECT ss.board_id, ss.subject_id, b.name AS board_name, s.name AS subject_name
        FROM section_subjects ss
        JOIN library_boards b ON b.id = ss.board_id
        JOIN library_subjects s ON s.id = ss.subject_id
        WHERE ss.class_id = $1::uuid
        ORDER BY b.name, s.name
        """,
        class_id,
    )
    linked_by_board: Dict[str, List[str]] = {}
    for row in linked:
        bid = str(row["board_id"])
        linked_by_board.setdefault(bid, []).append(str(row["subject_id"]))

    board_rows = []
    for b in boards:
        board_item = dict(b)
        subjects = board_item.get("subjects") or []
        if isinstance(subjects, str):
            try:
                subjects = json_std.loads(subjects)
            except Exception:
                subjects = []
        if not isinstance(subjects, list):
            subjects = []
        if not subjects:
            subjects = fallback_subjects
        # Ensure each subject dict has string UUIDs
        clean_subjects = []
        for s in subjects:
            if isinstance(s, dict):
                clean_subjects.append({k: str(v) if isinstance(v, uuid.UUID) else v for k, v in s.items()})
        board_item["subjects"] = clean_subjects
        # Stringify board UUID
        if isinstance(board_item.get("id"), uuid.UUID):
            board_item["id"] = str(board_item["id"])
        board_rows.append(board_item)

    return {
        "data": {
            "section": dict(section),
            "library_class": dict(library_class) if library_class else None,
            "boards": board_rows,
            "linked_subjects_by_board": linked_by_board,
        }
    }


@router.put("/sections/{class_id}/subjects")
async def set_section_subjects(
    class_id: str,
    req: LinkSectionSubjectsRequest,
    current_user: dict = Depends(get_user_from_token),
):
    """Replace subject links for one board inside a section."""
    await ensure_library_tables()
    section_exists = await execute_one("SELECT id FROM classes WHERE id = $1::uuid", class_id)
    if not section_exists:
        raise HTTPException(status_code=404, detail="Section not found")

    board_exists = await execute_one("SELECT id FROM library_boards WHERE id = $1::uuid", req.board_id)
    if not board_exists:
        raise HTTPException(status_code=404, detail="Board not found")

    subject_ids = list(dict.fromkeys(req.subject_ids or []))
    await execute_write(
        "DELETE FROM section_subjects WHERE class_id = $1::uuid AND board_id = $2::uuid",
        class_id,
        req.board_id,
    )
    for sid in subject_ids:
        await execute_write(
            """
            INSERT INTO section_subjects (class_id, board_id, subject_id)
            VALUES ($1::uuid, $2::uuid, $3::uuid)
            ON CONFLICT (class_id, board_id, subject_id) DO NOTHING
            """,
            class_id,
            req.board_id,
            sid,
        )

    return {"message": "Section subjects updated", "count": len(subject_ids)}


@router.get("/sections/{class_id}/curriculum")
async def get_section_curriculum(class_id: str):
    """Get a section's full curriculum: board, subjects, and assigned books."""
    await ensure_library_tables()

    # Get linked subjects + board
    linked = await execute_query(
        """
        SELECT ss.board_id, lb.name as board_name, ss.subject_id, ls.name as subject_name
        FROM section_subjects ss
        JOIN library_boards lb ON lb.id = ss.board_id
        JOIN library_subjects ls ON ls.id = ss.subject_id
        WHERE ss.class_id = $1::uuid
        ORDER BY ls.name
        """,
        class_id,
    )

    # Get assigned books
    books = await execute_query(
        """
        SELECT sb.book_id, lbk.title, lbk.subject_id, lbk.author
        FROM section_books sb
        JOIN library_books lbk ON lbk.id = sb.book_id
        WHERE sb.class_id = $1::uuid
        ORDER BY lbk.title
        """,
        class_id,
    )

    board_id = str(linked[0]["board_id"]) if linked else None
    board_name = linked[0]["board_name"] if linked else None
    subjects = []
    seen = set()
    for row in linked:
        sid = str(row["subject_id"])
        if sid not in seen:
            seen.add(sid)
            subjects.append({"id": sid, "name": row["subject_name"]})

    # Get section name
    section_row = await execute_one(
        "SELECT name, grade_level, section FROM classes WHERE id = $1::uuid", class_id
    )
    section_name = ""
    if section_row:
        sec = section_row.get("section") or ""
        section_name = f"Section {sec}" if sec else "Main Section"

    return {
        "data": {
            "board_id": board_id,
            "board_name": board_name,
            "section_name": section_name,
            "subjects": subjects,
            "books": [
                {
                    "id": str(b["book_id"]),
                    "title": b["title"],
                    "subject_id": str(b["subject_id"]),
                    "author": b["author"],
                }
                for b in books
            ],
        }
    }


@router.put("/sections/{class_id}/books")
async def set_section_books(
    class_id: str,
    req: SetSectionBooksRequest,
    current_user: dict = Depends(get_user_from_token),
):
    """Replace the book list assigned to a section."""
    await ensure_library_tables()
    section_exists = await execute_one("SELECT id FROM classes WHERE id = $1::uuid", class_id)
    if not section_exists:
        raise HTTPException(status_code=404, detail="Section not found")

    book_ids = list(dict.fromkeys(req.book_ids or []))
    await execute_write("DELETE FROM section_books WHERE class_id = $1::uuid", class_id)
    for bid in book_ids:
        await execute_write(
            """
            INSERT INTO section_books (class_id, book_id)
            VALUES ($1::uuid, $2::uuid)
            ON CONFLICT (class_id, book_id) DO NOTHING
            """,
            class_id,
            bid,
        )
    return {"message": "Section books updated", "count": len(book_ids)}


@router.post("/sections/bulk-assign")
async def bulk_assign_sections(
    req: BulkAssignSectionsRequest,
    current_user: dict = Depends(get_user_from_token),
):
    """Assign the same board + subjects + books to multiple sections at once."""
    await ensure_library_tables()
    subject_ids = list(dict.fromkeys(req.subject_ids or []))
    book_ids = list(dict.fromkeys(req.book_ids or []))

    for cid in req.class_ids:
        section_exists = await execute_one("SELECT id FROM classes WHERE id = $1::uuid", cid)
        if not section_exists:
            continue
        # Set subjects
        await execute_write(
            "DELETE FROM section_subjects WHERE class_id = $1::uuid AND board_id = $2::uuid",
            cid, req.board_id,
        )
        for sid in subject_ids:
            await execute_write(
                """
                INSERT INTO section_subjects (class_id, board_id, subject_id)
                VALUES ($1::uuid, $2::uuid, $3::uuid)
                ON CONFLICT (class_id, board_id, subject_id) DO NOTHING
                """,
                cid, req.board_id, sid,
            )
        # Set books
        await execute_write("DELETE FROM section_books WHERE class_id = $1::uuid", cid)
        for bid in book_ids:
            await execute_write(
                """
                INSERT INTO section_books (class_id, book_id)
                VALUES ($1::uuid, $2::uuid)
                ON CONFLICT (class_id, book_id) DO NOTHING
                """,
                cid, bid,
            )

    return {"message": "Bulk assignment complete", "sections": len(req.class_ids)}


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


@router.get("/boards/{board_id}/subjects/{subject_id}/books")
async def get_board_subject_books(board_id: str, subject_id: str):
    """Get books for a specific board + subject."""
    await ensure_library_tables()
    board = await execute_one("SELECT id, name FROM library_boards WHERE id = $1::uuid", board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    rows = await execute_query(
        """
        SELECT
            b.*,
            s.name AS subject_name,
            (
                SELECT COUNT(*)
                FROM library_chapters ch
                WHERE ch.book_id = b.id
            ) AS chapter_count,
            (
                SELECT COUNT(*)
                FROM library_topics t
                JOIN library_chapters ch2 ON ch2.id = t.chapter_id
                WHERE ch2.book_id = b.id
            ) AS topic_count
        FROM library_books b
        JOIN library_subjects s ON s.id = b.subject_id
        ORDER BY b.created_at DESC, b.title
        """
    )
    board_name = (board["name"] or "").strip().lower()
    sid = (subject_id or "").strip()
    books = []
    for r in rows:
        item = dict(r)
        if str(item.get("subject_id")) != sid:
            continue
        # Match board by name (case-insensitive, partial match)
        book_board = (item.get("board_name") or "").strip().lower()
        if book_board and board_name and book_board != board_name:
            if board_name not in book_board and book_board not in board_name:
                continue
        books.append(item)
    return {"data": books}


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
        LEFT JOIN library_classes lc ON b.class_id = lc.id
        LEFT JOIN library_subjects s ON b.subject_id = s.id
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
        if not req.subject_id:
            raise HTTPException(status_code=400, detail="subject_id is required")
        if not req.title or not req.title.strip():
            raise HTTPException(status_code=400, detail="title is required")
        if not req.chapters:
            raise HTTPException(status_code=400, detail="At least one chapter is required")

        if not req.class_id and not req.board_id:
            raise HTTPException(status_code=400, detail="Either class_id or board_id is required")

        board_name = req.board_name
        if req.board_id:
            board = await execute_one("SELECT id, name FROM library_boards WHERE id = $1::uuid", req.board_id)
            if not board:
                raise HTTPException(status_code=404, detail="Board not found")
            board_name = board_name or board["name"]

            board_subject_link = await execute_one(
                """
                SELECT id
                FROM library_board_subjects
                WHERE board_id = $1::uuid AND subject_id = $2::uuid
                """,
                req.board_id,
                req.subject_id,
            )
            if not board_subject_link:
                raise HTTPException(status_code=400, detail="Selected subject is not linked to selected board")

        if req.class_id:
            # Validate class-subject link for legacy class-based library path.
            link = await execute_one(
                """
                SELECT id FROM library_class_subjects
                WHERE class_id = $1::uuid AND subject_id = $2::uuid
                """,
                req.class_id,
                req.subject_id,
            )
            if not link:
                class_data = await execute_one("SELECT name FROM library_classes WHERE id = $1::uuid", req.class_id)
                subject_data = await execute_one("SELECT name FROM library_subjects WHERE id = $1::uuid", req.subject_id)
                class_name = class_data["name"] if class_data else "this class"
                subject_name = subject_data["name"] if subject_data else "this subject"
                raise HTTPException(
                    status_code=400,
                    detail=f"Please add '{subject_name}' to '{class_name}' first before uploading books.",
                )
        
        # Check duplicate
        existing = await execute_one(
            """
            SELECT id FROM library_books
            WHERE subject_id = $1::uuid
              AND LOWER(title) = LOWER($2)
              AND LOWER(COALESCE(author, '')) = LOWER($3)
              AND (
                ($4::text IS NOT NULL AND LOWER(COALESCE(board_name, '')) = LOWER($4))
                OR ($4::text IS NULL AND $5::uuid IS NOT NULL AND class_id = $5::uuid)
              )
            """,
            req.subject_id,
            req.title,
            req.author or "",
            board_name,
            req.class_id,
        )
        
        if existing:
            raise HTTPException(status_code=400, detail=f"Book '{req.title}' already exists for this class and subject")
        
        # Create book
        book = await execute_one(
            """
            INSERT INTO library_books (class_id, subject_id, title, author, board_name, edition_year, pdf_url)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)
            RETURNING id, title
            """,
            req.class_id,
            req.subject_id,
            req.title,
            req.author,
            board_name,
            req.edition_year,
            req.pdf_url,
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


def _parse_slides_json(slides_json: Optional[str]) -> List[Dict]:
    if not slides_json:
        return []
    try:
        parsed = json_std.loads(slides_json) if isinstance(slides_json, str) else slides_json
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict) and isinstance(parsed.get("slides"), list):
            return parsed.get("slides")
    except Exception:
        return []
    return []


def _safe_lecture_metadata_dict(raw) -> Optional[Dict]:
    if raw is None:
        return None
    try:
        if isinstance(raw, str):
            t = raw.strip()
            if not t or t in ("null", "{}", "[]"):
                return None
            parsed = json_std.loads(raw)
            return parsed if isinstance(parsed, dict) else None
        if isinstance(raw, dict):
            return raw
        return None
    except Exception:
        return None


def _normalize_recorded_lectures_row(rec: dict) -> dict:
    out = dict(rec)
    for key, val in list(out.items()):
        if isinstance(val, uuid.UUID):
            out[key] = str(val)
        elif hasattr(val, "isoformat"):
            try:
                out[key] = val.isoformat()
            except Exception:
                out[key] = str(val)
    md = _safe_lecture_metadata_dict(out.pop("lecture_metadata_json", None))
    out["lecture_metadata"] = md or {}
    return out


@router.get("/library/recorded-lectures")
async def list_library_recorded_lectures(
    q: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_user_from_token),
):
    """Paginated list of curriculum topics that have a saved lecture video (admin hub)."""
    await ensure_library_tables()
    lim = max(1, min(int(limit or 50), 100))
    off = max(0, int(offset or 0))
    search = (q or "").strip() or None

    sql = """
    WITH base AS (
      SELECT
        t.id AS topic_id,
        t.title AS topic_title,
        t.lecture_video_url,
        t.lecture_metadata_json,
        t.lecture_duration_seconds,
        t.lecture_saved_at,
        t.created_at AS topic_created_at,
        ch.id AS chapter_id,
        ch.chapter_number,
        ch.title AS chapter_title,
        b.id AS book_id,
        b.title AS book_title,
        b.board_name AS book_board_name,
        lc.id AS library_class_id,
        lc.name AS library_class_name,
        s.id AS subject_id,
        s.name AS subject_name,
        dep.schools_catalog,
        dep.branches_catalog,
        dep.sections_catalog
      FROM library_topics t
      LEFT JOIN library_chapters ch ON ch.id = t.chapter_id
      LEFT JOIN library_books b ON b.id = ch.book_id
      LEFT JOIN library_classes lc ON lc.id = b.class_id
      LEFT JOIN library_subjects s ON s.id = b.subject_id
      LEFT JOIN LATERAL (
        SELECT
          (
            SELECT string_agg(x.sn, ' · ' ORDER BY x.sn)
            FROM (
              SELECT DISTINCT trim(sch.name)::text AS sn
              FROM section_books sb
              JOIN classes sec ON sec.id = sb.class_id
              JOIN branches br ON br.id = sec.branch_id
              JOIN schools sch ON sch.id = br.school_id
              WHERE sb.book_id = b.id AND sch.name IS NOT NULL AND trim(sch.name) <> ''
            ) x
          ) AS schools_catalog,
          (
            SELECT string_agg(x.bn, ' · ' ORDER BY x.bn)
            FROM (
              SELECT DISTINCT trim(br.name)::text AS bn
              FROM section_books sb
              JOIN classes sec ON sec.id = sb.class_id
              JOIN branches br ON br.id = sec.branch_id
              WHERE sb.book_id = b.id AND br.name IS NOT NULL AND trim(br.name) <> ''
            ) x
          ) AS branches_catalog,
          (
            SELECT string_agg(raw.label, E' • ' ORDER BY raw.label)
            FROM (
              SELECT DISTINCT
                CASE
                  WHEN NULLIF(trim(COALESCE(sec.name::text, '')), '') IS NOT NULL
                    THEN trim(sec.name::text)
                  ELSE trim(
                    concat_ws(
                      ' · ',
                      NULLIF(trim(COALESCE(sec.grade_level::text, '')), ''),
                      CASE
                        WHEN NULLIF(trim(COALESCE(sec.section::text, '')), '') IS NOT NULL
                          THEN 'Sec ' || trim(sec.section::text)
                        ELSE NULL
                      END
                    )
                  )
                END AS label
              FROM section_books sb
              JOIN classes sec ON sec.id = sb.class_id
              WHERE sb.book_id = b.id
            ) raw
            WHERE trim(COALESCE(raw.label, '')) <> ''
          ) AS sections_catalog
      ) dep ON TRUE
      WHERE t.lecture_video_url IS NOT NULL
        AND trim(t.lecture_video_url) <> ''
        AND ($1::text IS NULL
             OR t.title ILIKE ('%' || $1 || '%')
             OR COALESCE(ch.title, '') ILIKE ('%' || $1 || '%')
             OR COALESCE(b.title, '') ILIKE ('%' || $1 || '%')
             OR COALESCE(b.board_name, '') ILIKE ('%' || $1 || '%')
             OR COALESCE(s.name, '') ILIKE ('%' || $1 || '%')
             OR COALESCE(lc.name, '') ILIKE ('%' || $1 || '%')
             OR COALESCE(dep.schools_catalog, '') ILIKE ('%' || $1 || '%')
             OR COALESCE(dep.branches_catalog, '') ILIKE ('%' || $1 || '%')
             OR COALESCE(dep.sections_catalog, '') ILIKE ('%' || $1 || '%')
             OR EXISTS (
                  SELECT 1
                  FROM section_books sb2
                  JOIN classes sec2 ON sec2.id = sb2.class_id
                  JOIN branches br2 ON br2.id = sec2.branch_id
                  JOIN schools sch2 ON sch2.id = br2.school_id
                  WHERE sb2.book_id = b.id
                    AND (
                      sch2.name ILIKE ('%' || $1 || '%')
                      OR br2.name ILIKE ('%' || $1 || '%')
                      OR COALESCE(sec2.name::text, '') ILIKE ('%' || $1 || '%')
                      OR COALESCE(sec2.grade_level::text, '') ILIKE ('%' || $1 || '%')
                      OR COALESCE(sec2.section::text, '') ILIKE ('%' || $1 || '%')
                    )
               )
               OR lower(regexp_replace(concat_ws(' ',
                       COALESCE(t.title::text, ''),
                       COALESCE(ch.title::text, ''),
                       COALESCE(b.title::text, ''),
                       COALESCE(lc.name::text, ''),
                       COALESCE(s.name::text, ''),
                       COALESCE(b.board_name::text, ''),
                       COALESCE(dep.schools_catalog::text, ''),
                       COALESCE(dep.branches_catalog::text, ''),
                       COALESCE(dep.sections_catalog::text, '')
                     ), E'\\s+', ' ', 'g'))
                  LIKE ('%' ||
                        regexp_replace(lower(trim($1::text)), E'\\s+', '%', 'g')
                        || '%')
               )
    ),
    counted AS (
      SELECT
        b.*,
        COALESCE((SELECT COUNT(*)::int FROM base), 0) AS total_count
      FROM base b
    )
    SELECT * FROM counted
    ORDER BY lecture_saved_at DESC NULLS LAST, topic_created_at DESC
    LIMIT $2 OFFSET $3
    """
    rows = await execute_query(sql, search, lim, off)
    items = []
    total = 0
    for raw in rows or []:
        row = dict(raw)
        total = int(row.pop("total_count", 0) or 0)
        items.append(_normalize_recorded_lectures_row(row))

    return {
        "data": {
            "items": items,
            "total": total,
            "limit": lim,
            "offset": off,
            "query": (q or "").strip(),
        }
    }


@router.get("/library/topics/{topic_id}")
async def get_library_topic(topic_id: str):
    """Single library topic (includes slides_json when present)."""
    await ensure_library_tables()
    topic_id = (topic_id or "").strip()
    try:
        row = await execute_one("SELECT * FROM library_topics WHERE id = $1::uuid", topic_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid topic id format: {topic_id!r} — {e}")
    if not row:
        raise HTTPException(status_code=404, detail=f"Topic not found (id={topic_id!r})")
    return {"data": _library_topic_row_json(dict(row))}


@router.put("/library/topics/{topic_id}")
async def update_library_topic(
    topic_id: str,
    body: UpdateLibraryTopicRequest,
    current_user: dict = Depends(get_user_from_token),
):
    await ensure_library_tables()
    topic_id = (topic_id or "").strip()
    existing = await execute_one(
        "SELECT id, lecture_video_url FROM library_topics WHERE id = $1::uuid",
        topic_id,
    )
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
    if body.clear_slides:
        fields.append(f"slides_json = ${n}")
        args.append(None)
        n += 1
        fields.append(f"slide_theme = ${n}")
        args.append(None)
        n += 1
        # Business rule: deleting slides must also remove lecture + metadata.
        if existing.get("lecture_video_url"):
            _remove_local_static_file(existing.get("lecture_video_url"))
        fields.append(f"lecture_video_url = ${n}")
        args.append(None)
        n += 1
        fields.append(f"lecture_metadata_json = ${n}")
        args.append(None)
        n += 1
        fields.append(f"lecture_saved_at = ${n}")
        args.append(None)
        n += 1
        fields.append(f"lecture_duration_seconds = ${n}")
        args.append(None)
        n += 1
    else:
        if body.slides is not None:
            fields.append(f"slides_json = ${n}")
            args.append(_serialize_slides(body.slides))
            n += 1
        if body.slide_theme is not None:
            fields.append(f"slide_theme = ${n}")
            args.append(body.slide_theme[:160] if body.slide_theme else None)
            n += 1

    if body.clear_lecture:
        if existing.get("lecture_video_url"):
            _remove_local_static_file(existing.get("lecture_video_url"))
        fields.append(f"lecture_video_url = ${n}")
        args.append(None)
        n += 1
        fields.append(f"lecture_metadata_json = ${n}")
        args.append(None)
        n += 1
        fields.append(f"lecture_saved_at = ${n}")
        args.append(None)
        n += 1
        fields.append(f"lecture_duration_seconds = ${n}")
        args.append(None)
        n += 1
    elif body.lecture_metadata is not None:
        fields.append(f"lecture_metadata_json = ${n}")
        args.append(json_std.dumps(body.lecture_metadata, ensure_ascii=False))
        n += 1

    if not fields:
        row = await execute_one("SELECT * FROM library_topics WHERE id = $1::uuid", topic_id)
        return {"data": _library_topic_row_json(dict(row))}

    args.append(topic_id)
    q = f"UPDATE library_topics SET {', '.join(fields)} WHERE id = ${n}::uuid RETURNING *"
    row = await execute_one(q, *args)
    return {"data": _library_topic_row_json(dict(row))}


@router.post("/library/topics/{topic_id}/lecture")
async def upload_library_topic_lecture(
    topic_id: str,
    video: UploadFile = File(...),
    quality: str = Form(default="720p"),
    duration_seconds: str = Form(default="0"),
    has_camera: str = Form(default="false"),
    has_microphone: str = Form(default="false"),
    slide_timestamps_json: Optional[str] = Form(default=None),
    transcript: Optional[str] = Form(default=None),
    captions_json: Optional[str] = Form(default=None),
    current_user: dict = Depends(get_user_from_token),
):
    """Upload/replace a topic lecture video and attach metadata to that topic."""
    await ensure_library_tables()
    topic_id = (topic_id or "").strip()
    row = await execute_one(
        "SELECT id, slides_json, lecture_video_url FROM library_topics WHERE id = $1::uuid",
        topic_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Business rule: lecture cannot exist without slides.
    slides = _parse_slides_json(row.get("slides_json"))
    if not slides:
        raise HTTPException(status_code=400, detail="Cannot save lecture: topic has no slides")

    filename = (video.filename or "").lower()
    if not filename.endswith((".webm", ".mp4", ".mov", ".mkv")):
        raise HTTPException(status_code=400, detail="Unsupported video format")

    content = await video.read()
    max_bytes = 800 * 1024 * 1024  # 800 MB
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail="Lecture file too large (max 800 MB)")
    if not content:
        raise HTTPException(status_code=400, detail="Empty video upload")

    lectures_dir = os.path.join("static", "lectures")
    os.makedirs(lectures_dir, exist_ok=True)
    ext = os.path.splitext(filename)[1] or ".webm"
    safe_name = f"{topic_id}_{uuid.uuid4().hex}{ext}"
    abs_path = os.path.join(lectures_dir, safe_name)
    with open(abs_path, "wb") as f:
        f.write(content)

    video_url = f"/static/lectures/{safe_name}"
    slide_timestamps = []
    if slide_timestamps_json:
        try:
            parsed = json_std.loads(slide_timestamps_json)
            if isinstance(parsed, list):
                slide_timestamps = parsed
        except Exception:
            slide_timestamps = []

    captions = []
    if captions_json:
        try:
            parsed = json_std.loads(captions_json)
            if isinstance(parsed, list):
                captions = parsed
        except Exception:
            captions = []

    dur_from_form = max(0.0, _form_float_relaxed(duration_seconds, 0.0))
    has_cam = _form_bool_relaxed(has_camera)
    has_mic = _form_bool_relaxed(has_microphone)
    dur_from_ts = 0.0
    for item in slide_timestamps or []:
        if isinstance(item, dict):
            try:
                dur_from_ts = max(dur_from_ts, float(item.get("time") or 0))
            except (TypeError, ValueError):
                pass
    stored_dur = max(dur_from_form, dur_from_ts)

    lecture_metadata = {
        "lectureId": uuid.uuid4().hex,
        "topicId": topic_id,
        "videoUrl": video_url,
        "duration": stored_dur,
        "quality": str(quality or "720p"),
        "hasCamera": has_cam,
        "hasMicrophone": has_mic,
        "slideTimestamps": slide_timestamps,
        "transcript": transcript or "",
        "captions": captions,
        "createdBy": str(current_user.get("id") or ""),
    }

    if row.get("lecture_video_url"):
        _remove_local_static_file(row.get("lecture_video_url"))

    dur_column = stored_dur if stored_dur > 0 else None

    updated = await execute_one(
        """
        UPDATE library_topics
        SET lecture_video_url = $1,
            lecture_metadata_json = $2,
            lecture_saved_at = NOW(),
            lecture_duration_seconds = $4
        WHERE id = $3::uuid
        RETURNING *
        """,
        video_url,
        json_std.dumps(lecture_metadata, ensure_ascii=False),
        topic_id,
        dur_column,
    )
    return {"data": _library_topic_row_json(dict(updated))}


@router.delete("/library/topics/{topic_id}/lecture")
async def delete_library_topic_lecture(
    topic_id: str,
    current_user: dict = Depends(get_user_from_token),
):
    """Delete lecture video + metadata, keep slides intact."""
    await ensure_library_tables()
    topic_id = (topic_id or "").strip()
    row = await execute_one(
        "SELECT id, lecture_video_url FROM library_topics WHERE id = $1::uuid",
        topic_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Topic not found")

    if row.get("lecture_video_url"):
        _remove_local_static_file(row.get("lecture_video_url"))

    updated = await execute_one(
        """
        UPDATE library_topics
        SET lecture_video_url = NULL,
            lecture_metadata_json = NULL,
            lecture_saved_at = NULL,
            lecture_duration_seconds = NULL
        WHERE id = $1::uuid
        RETURNING *
        """,
        topic_id,
    )
    return {"data": _library_topic_row_json(dict(updated))}


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
