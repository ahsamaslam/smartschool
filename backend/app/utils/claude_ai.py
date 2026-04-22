"""
Claude AI integration for Q&A and quiz grading
"""
from anthropic import AsyncAnthropic
from typing import List, Dict, Optional
import logging
import json

from app.config import settings
from app.utils.cache import get_cached_answer, cache_answer

logger = logging.getLogger(__name__)

# Initialize Claude client
client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


# ============================================
# Q&A BOT
# ============================================

async def answer_student_question(
    question: str,
    topic_title: str,
    subject_name: str,
    topic_id: str = None,
    use_cache: bool = True
) -> dict:
    """
    Answer student question using Claude AI with caching
    
    Args:
        question: Student's question
        topic_title: Current topic title
        subject_name: Subject name
        topic_id: Topic ID for cache context
        use_cache: Whether to use cached answers
    
    Returns:
        dict with answer and metadata
    """
    
    # Check cache first
    if use_cache:
        cached = await get_cached_answer(question, topic_id)
        if cached:
            return {
                "answer": cached["answer"],
                "from_cache": True,
                "question": question
            }
    
    # If not cached, ask Claude
    try:
        system_prompt = f"""You are a helpful educational assistant for students learning {subject_name}.
The current topic is: {topic_title}

Your role:
- Answer student questions clearly and concisely
- Use simple language appropriate for students
- Provide examples when helpful
- Encourage learning and curiosity
- If the question is off-topic, politely redirect to the current topic
- Keep answers focused and not too long (2-4 paragraphs max)

Remember: You're helping students understand the material better."""

        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            temperature=0.7,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": question
                }
            ]
        )
        
        answer = message.content[0].text
        
        # Cache the answer
        if use_cache:
            await cache_answer(question, answer, topic_id)
        
        return {
            "answer": answer,
            "from_cache": False,
            "question": question,
            "model": "claude-sonnet-4-20250514"
        }
        
    except Exception as e:
        logger.error(f"Error calling Claude API: {str(e)}")
        return {
            "answer": "I apologize, but I'm having trouble answering your question right now. Please try again in a moment or ask your teacher for help.",
            "from_cache": False,
            "error": str(e)
        }


# ============================================
# QUIZ GRADING
# ============================================

async def grade_short_answer(
    question: str,
    student_answer: str,
    correct_answer: str,
    max_points: int = 5
) -> dict:
    """
    Grade a short answer question using Claude
    
    Args:
        question: Question text
        student_answer: Student's answer
        correct_answer: Model answer
        max_points: Maximum points for this question
    
    Returns:
        dict with points_earned and feedback
    """
    
    try:
        system_prompt = """You are an educational assessment assistant. Grade student answers fairly and constructively.

Your grading should:
- Compare student's answer to the model answer
- Award partial credit for partially correct answers
- Provide constructive feedback
- Be encouraging while honest

Return your response as JSON with this exact structure:
{
    "points_earned": <number between 0 and max_points>,
    "feedback": "<constructive feedback explaining the score>",
    "is_correct": <true if points_earned >= 80% of max_points, false otherwise>
}"""

        user_prompt = f"""Grade this answer:

Question: {question}

Model Answer: {correct_answer}

Student's Answer: {student_answer}

Maximum Points: {max_points}

Provide your grading as JSON."""

        message = await client.messages.create(
            model="claude-haiku-4-20250514",  # Using Haiku for cost optimization
            max_tokens=500,
            temperature=0.3,  # Lower temperature for consistent grading
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": user_prompt
                }
            ]
        )
        
        # Parse JSON response
        response_text = message.content[0].text
        
        # Extract JSON if wrapped in markdown
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        result = json.loads(response_text.strip())
        
        return {
            "points_earned": float(result["points_earned"]),
            "feedback": result["feedback"],
            "is_correct": result.get("is_correct", result["points_earned"] >= max_points * 0.8),
            "max_points": max_points
        }
        
    except Exception as e:
        logger.error(f"Error grading answer: {str(e)}")
        # Fallback: simple string matching
        student_lower = student_answer.lower().strip()
        correct_lower = correct_answer.lower().strip()
        
        if student_lower == correct_lower:
            points = max_points
            feedback = "Excellent! Your answer matches the expected response."
        elif student_lower in correct_lower or correct_lower in student_lower:
            points = max_points * 0.7
            feedback = "Good effort! Your answer is partially correct."
        else:
            points = 0
            feedback = "Your answer doesn't match the expected response. Please review the topic."
        
        return {
            "points_earned": points,
            "feedback": feedback,
            "is_correct": points >= max_points * 0.8,
            "max_points": max_points,
            "fallback": True
        }


async def grade_long_answer(
    question: str,
    student_answer: str,
    rubric: str,
    max_points: int = 10
) -> dict:
    """
    Grade a long answer/essay question using Claude
    
    Args:
        question: Question text
        student_answer: Student's answer
        rubric: Grading rubric or key points
        max_points: Maximum points
    
    Returns:
        dict with points_earned and detailed feedback
    """
    
    try:
        system_prompt = """You are an experienced teacher grading essay-style answers. Be fair, constructive, and encouraging.

Evaluate based on:
- Accuracy and completeness
- Understanding of concepts
- Clarity of explanation
- Organization and structure

Return JSON:
{
    "points_earned": <number>,
    "feedback": "<detailed constructive feedback>",
    "strengths": ["<strength1>", "<strength2>"],
    "improvements": ["<area1>", "<area2>"],
    "is_correct": <boolean>
}"""

        user_prompt = f"""Grade this essay answer:

Question: {question}

Grading Rubric:
{rubric}

Student's Answer:
{student_answer}

Maximum Points: {max_points}"""

        message = await client.messages.create(
            model="claude-sonnet-4-20250514",  # Using Sonnet for complex grading
            max_tokens=1000,
            temperature=0.3,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": user_prompt
                }
            ]
        )
        
        response_text = message.content[0].text
        
        # Extract JSON
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        result = json.loads(response_text.strip())
        
        return {
            "points_earned": float(result["points_earned"]),
            "feedback": result["feedback"],
            "strengths": result.get("strengths", []),
            "improvements": result.get("improvements", []),
            "is_correct": result.get("is_correct", result["points_earned"] >= max_points * 0.8),
            "max_points": max_points
        }
        
    except Exception as e:
        logger.error(f"Error grading long answer: {str(e)}")
        return {
            "points_earned": 0,
            "feedback": "Unable to grade automatically. Please contact your teacher.",
            "strengths": [],
            "improvements": [],
            "is_correct": False,
            "max_points": max_points,
            "error": str(e)
        }


# ============================================
# QUIZ GENERATION
# ============================================

async def generate_quiz_questions(
    topic_title: str,
    subject_name: str,
    difficulty: str = "medium",
    question_types: Dict[str, int] = None
) -> List[dict]:
    """
    Generate quiz questions for a topic
    
    Args:
        topic_title: Topic name
        subject_name: Subject name
        difficulty: easy, medium, or hard
        question_types: {"mcq": 5, "short_answer": 3, "long_answer": 2}
    
    Returns:
        List of question dictionaries
    """
    
    if question_types is None:
        question_types = {"mcq": 5, "short_answer": 2}
    
    try:
        system_prompt = f"""You are an expert educational content creator for {subject_name}.
Create high-quality quiz questions for the topic: {topic_title}

Difficulty level: {difficulty}

Guidelines:
- MCQ questions should have 4 options (A, B, C, D)
- Questions should test understanding, not just memorization
- Provide clear, unambiguous correct answers
- Short answers should require 1-3 sentence responses
- Long answers should require detailed explanations

Return questions as JSON array with this structure:
[
    {{
        "question_text": "...",
        "question_type": "mcq" | "short_answer" | "long_answer",
        "difficulty": "{difficulty}",
        "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},  // Only for MCQ
        "correct_answer": "...",
        "points": <number>
    }}
]"""

        # Build request based on question types
        request_parts = []
        for qtype, count in question_types.items():
            request_parts.append(f"- {count} {qtype.replace('_', ' ')} questions")
        
        user_prompt = f"""Generate questions for: {topic_title}

Create:
{chr(10).join(request_parts)}

Return as JSON array."""

        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=3000,
            temperature=0.7,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": user_prompt
                }
            ]
        )
        
        response_text = message.content[0].text
        
        # Extract JSON
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        questions = json.loads(response_text.strip())
        
        return questions
        
    except Exception as e:
        logger.error(f"Error generating questions: {str(e)}")
        return []


# ============================================
# EXAM GENERATION (for teachers)
# ============================================

async def generate_teacher_exam(
    topics: List[str],
    subject_name: str,
    difficulty: str,
    exam_format: Dict[str, int],
    class_name: str
) -> str:
    """
    Generate a complete printable exam for teachers
    
    Args:
        topics: List of topic titles
        subject_name: Subject name
        difficulty: Complexity level
        exam_format: {"mcq": 10, "short": 5, "long": 3}
        class_name: Class name for the exam header
    
    Returns:
        Formatted exam text ready to print
    """
    
    try:
        system_prompt = """You are an expert exam creator. Create professional, well-formatted exams for teachers to print.

Your exam should:
- Have a clear header with subject, topics, and instructions
- Be professionally formatted
- Include diverse questions testing different aspects
- Have clear point values
- Include an answer key at the end (on separate page)

Format as a printable document with proper spacing and sections."""

        topics_text = "\n".join([f"- {topic}" for topic in topics])
        format_text = "\n".join([f"- {count} {qtype} questions" for qtype, count in exam_format.items()])
        
        user_prompt = f"""Create a complete exam:

Subject: {subject_name}
Class: {class_name}
Difficulty: {difficulty}

Topics covered:
{topics_text}

Format:
{format_text}

Create a professional exam document with:
1. Header (school name, subject, class, date fields)
2. Instructions for students
3. All questions with point values
4. Answer key on separate page

Make it ready to print."""

        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            temperature=0.7,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": user_prompt
                }
            ]
        )
        
        exam_content = message.content[0].text
        
        return exam_content
        
    except Exception as e:
        logger.error(f"Error generating exam: {str(e)}")
        return f"Error generating exam: {str(e)}"


# ============================================
# CURRICULUM PARSING
# ============================================

async def parse_curriculum_document(
    file_content: bytes,
    file_name: str,
    media_type: str = "application/pdf"
) -> dict:
    """
    Parse a curriculum book (PDF or text) and extract structured hierarchy.
    Returns: { book_title, grade_level, subjects: [{ name, description, chapters: [{ number, name, topics: [{ title, description }] }] }] }
    """
    system_prompt = """You are a curriculum analysis expert. Parse educational curriculum books and extract a complete structured hierarchy.

ALWAYS return valid JSON with this EXACT structure — no extra text outside the JSON:
{
  "book_title": "string",
  "grade_level": "string (e.g. Grade 9)",
  "subjects": [
    {
      "name": "string (e.g. Mathematics, Physics, Biology)",
      "description": "string (1-2 sentence overview)",
      "chapters": [
        {
          "number": 1,
          "name": "string (chapter title)",
          "topics": [
            {
              "title": "string (concise topic name)",
              "description": "string (2-3 sentence educational description of what students will learn)"
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Extract ALL subjects, ALL chapters, and ALL topics — be exhaustive
- If grade level is not explicit, infer it from context
- Topic titles should be concise and searchable
- Topic descriptions should clearly explain the learning objective"""

    MAX_CHARS = 80_000  # ~20k tokens — stays well under Claude's context limit

    try:
        if media_type == "application/pdf" or file_name.lower().endswith(".pdf"):
            import io
            text = ""

            # Try pdfplumber first — best for complex layouts, tables, multi-column
            try:
                import pdfplumber
                with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                    pages_text = []
                    for page in pdf.pages:
                        page_text = page.extract_text(x_tolerance=2, y_tolerance=2) or ""
                        pages_text.append(page_text)
                    text = "\n".join(pages_text)
                logger.info(f"pdfplumber extracted {len(text)} chars from {len(pages_text)} pages")
            except Exception as e:
                logger.warning(f"pdfplumber failed ({e}), falling back to pypdf")

            # Fallback to pypdf
            if not text.strip():
                try:
                    from pypdf import PdfReader
                    reader = PdfReader(io.BytesIO(file_content))
                    pages_text = []
                    for page in reader.pages:
                        page_text = page.extract_text() or ""
                        pages_text.append(page_text)
                    text = "\n".join(pages_text)
                    logger.info(f"pypdf extracted {len(text)} chars")
                except Exception as e:
                    logger.warning(f"pypdf also failed: {e}")

            # Log a sample so we can diagnose extraction quality
            if text.strip():
                logger.info(f"PDF text sample (first 500 chars): {repr(text[:500])}")

            # Detect watermarked / DRM-protected PDFs (very low text density)
            num_pages = len(pages_text)
            chars_per_page = len(text.strip()) / max(num_pages, 1) if num_pages else 0
            is_scanned = chars_per_page < 80

            if is_scanned:
                # Scanned/image-based PDF — use Claude vision on rendered page images
                logger.info(f"Scanned PDF detected ({int(chars_per_page)} chars/page). Using Claude vision OCR on first 20 pages.")
                try:
                    import fitz  # PyMuPDF
                    import base64
                    doc = fitz.open(stream=file_content, filetype="pdf")
                    # Render up to 20 pages (covers TOC + opening chapters for most textbooks)
                    MAX_VISION_PAGES = 20
                    mat = fitz.Matrix(1.5, 1.5)  # 1.5x zoom for readable resolution
                    image_blocks = []
                    image_blocks.append({
                        "type": "text",
                        "text": (
                            "These are pages from a scanned curriculum textbook. "
                            "Extract the complete structured JSON hierarchy as specified. "
                            "Focus on the table of contents, chapter headings, and topic lists.\n"
                            "Look for: chapter numbers, chapter titles, unit titles, topic/lesson names."
                        )
                    })
                    total = min(len(doc), MAX_VISION_PAGES)
                    for i in range(total):
                        pix = doc[i].get_pixmap(matrix=mat)
                        img_bytes = pix.tobytes("jpeg", jpg_quality=75)
                        b64 = base64.standard_b64encode(img_bytes).decode()
                        image_blocks.append({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": b64,
                            }
                        })
                    image_blocks.append({
                        "type": "text",
                        "text": f"The full book has {len(doc)} pages. Return the complete JSON now."
                    })
                    doc.close()
                    content = image_blocks
                    logger.info(f"Sending {total} page images to Claude vision")
                except Exception as e:
                    raise ValueError(
                        f"PDF appears to be scanned/image-based (no selectable text, {int(chars_per_page)} chars/page). "
                        f"OCR via vision also failed: {e}. "
                        "Please use a PDF with selectable/copyable text."
                    )
            else:
                if len(text) > MAX_CHARS:
                    text = text[:MAX_CHARS] + "\n\n[... remainder truncated due to length ...]"

                content = [
                    {
                        "type": "text",
                        "text": (
                            "Parse the following curriculum book content and return the complete structured JSON as specified.\n\n"
                            "IMPORTANT NOTES:\n"
                            "- The text may contain mixed English/Urdu or other languages — focus on English chapter/topic names\n"
                            "- Text may be partially garbled due to PDF encoding — use context clues to infer subject names and chapter titles\n"
                            "- Look for patterns like 'Chapter 1', 'Unit 1', numbered lists, headings in ALL CAPS\n"
                            "- Even if text quality is poor, extract whatever structure you can identify\n"
                            "- Do NOT return empty subjects — always extract at least the chapters/units you can identify\n\n"
                            f"{text}"
                        ),
                    }
                ]
        else:
            text = file_content.decode("utf-8", errors="replace")
            if len(text) > MAX_CHARS:
                text = text[:MAX_CHARS] + "\n\n[... remainder truncated due to length ...]"
            content = [
                {
                    "type": "text",
                    "text": f"Parse the following curriculum content and return the complete structured JSON as specified.\n\n{text}",
                }
            ]

        message = await client.messages.create(
            model="claude-opus-4-5",
            max_tokens=8000,
            system=system_prompt,
            messages=[{"role": "user", "content": content}],
        )

        response_text = message.content[0].text
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]

        return json.loads(response_text.strip())

    except Exception as e:
        logger.error(f"Error parsing curriculum document: {e}")
        raise


# ============================================
# HELPERS
# ============================================

def _extract_json_safe(text: str) -> dict:
    """
    Robustly extract JSON from Claude's response.
    Handles: markdown code fences, truncated responses, unescaped characters.
    """
    import re

    # 1. Strip markdown fences
    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0]
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0]
    text = text.strip()

    # 2. Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 3. Find the outermost { ... } block and attempt partial parse
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = text[start:end + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # 4. Manual field extraction as last resort
    logger.warning("JSON parse failed, extracting fields manually")
    result = {}

    for field in ("title", "script", "duration_estimate"):
        m = re.search(rf'"{field}"\s*:\s*"(.*?)"(?=\s*[,}}])', text, re.DOTALL)
        if m:
            result[field] = m.group(1).replace('\\"', '"')

    # duration_estimate as number
    m = re.search(r'"duration_estimate"\s*:\s*(\d+)', text)
    if m:
        result["duration_estimate"] = int(m.group(1))

    for arr_field in ("key_points", "visual_elements"):
        m = re.search(rf'"{arr_field}"\s*:\s*\[(.*?)\]', text, re.DOTALL)
        if m:
            items = re.findall(r'"(.*?)"', m.group(1))
            result[arr_field] = items

    if "title" not in result:
        raise ValueError(f"Could not extract JSON from Claude response. Raw: {text[:300]}")

    result.setdefault("script", "")
    result.setdefault("key_points", [])
    result.setdefault("visual_elements", [])
    result.setdefault("duration_estimate", 300)
    return result


# ============================================
# TOPIC VIDEO SCRIPT GENERATION
# ============================================

async def generate_topic_explainer_script(
    topic_title: str,
    subject_name: str,
    chapter_name: str,
    grade_level: str,
    topic_description: str = "",
) -> dict:
    """
    Generate a world-class explainer video script for a curriculum topic.
    Returns: { title, script, key_points, visual_elements, duration_estimate }
    """
    system_prompt = f"""You are a master educational video scriptwriter — the person behind the world's most-watched Khan Academy and 3Blue1Brown-style explainer videos. Your scripts feel like a brilliant friend personally explaining something, not a textbook being read aloud.

Your scripts must follow this exact quality standard:
1. HOOK (30-45 sec): Open with a surprising fact, real-world problem, or a question students actually care about. Make them NEED to know the answer.
2. CONTEXT (45-60 sec): Briefly connect this topic to something the student already knows. Build the bridge.
3. CORE CONCEPT (90-120 sec): Explain the main idea using the simplest possible language. Use a powerful analogy. Break it into 2-3 crystal-clear steps. Never use jargon without immediately explaining it.
4. WORKED EXAMPLE (60-90 sec): Walk through one complete, well-chosen example step by step. Narrate each step as if thinking aloud.
5. COMMON MISTAKES (30-45 sec): Call out the #1 mistake students make and explain WHY it's wrong. This builds trust.
6. DEEPER INSIGHT (45-60 sec): Give one "wow" insight — a pattern, a shortcut, or a deeper "why" that makes the concept click.
7. SUMMARY (30-45 sec): Recap in 3 short punchy sentences. End with a forward-looking hook to the next topic.

Insert [VISUAL: description] markers throughout. Each visual should be specific and actionable:
- [VISUAL: number line showing -3 to +3 with arrows]
- [VISUAL: quadratic parabola drawn step by step on grid]
- [VISUAL: side-by-side comparison table of formula parts]

Tone rules:
- Use "you" and "we" — make it personal
- Short sentences. Active voice. No passive voice.
- Enthusiasm is real, not fake. Avoid "Amazing!" as filler.
- Use ellipses (...) for natural pauses in delivery
- Numbers and formulas are spoken out (e.g. "x squared" not "x²")

Return ONLY valid JSON — no markdown fences, no extra text:
{{
  "title": "string (compelling, specific title — NOT just the topic name)",
  "script": "string (full narration script using the 7-section structure above, with [VISUAL: ...] markers, sections labeled HOOK:, CONTEXT:, CORE CONCEPT:, WORKED EXAMPLE:, COMMON MISTAKES:, DEEPER INSIGHT:, SUMMARY:)",
  "key_points": ["string (3-5 concrete takeaways a student should remember)"],
  "visual_elements": ["string (each [VISUAL: ...] description listed separately)"],
  "duration_estimate": number (estimated narration seconds, typically 300-480)
}}"""

    user_prompt = f"""Write the explainer video script for this curriculum topic:

Subject: {subject_name}
Grade Level: {grade_level}
{f"Chapter: {chapter_name}" if chapter_name else ""}
Topic: {topic_title}
{f"Context: {topic_description}" if topic_description else ""}

Requirements:
- The student audience is {grade_level} level — calibrate vocabulary and examples accordingly
- Include at least 4 [VISUAL: ...] markers with specific, renderable descriptions
- The worked example must use actual numbers/values relevant to this topic
- The hook must be something genuinely surprising or relatable for a {grade_level} student
- Total script should be 4-6 minutes of narration when read at a natural pace

Write the absolute best possible script for this topic."""

    try:
        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

        response_text = message.content[0].text
        return _extract_json_safe(response_text)

    except Exception as e:
        logger.error(f"Error generating topic script for '{topic_title}': {e}")
        raise


# ============================================
# AUDIO GENERATION (Microsoft Edge TTS — free)
# ============================================

async def generate_audio_edge_tts(
    script: str,
    topic_id: str,
    voice: str = "en-US-AriaNeural",
) -> str:
    """
    Convert an AI-generated explainer script to MP3 audio using Microsoft Edge TTS.
    Strips [VISUAL: ...] cues and section headers before synthesis.
    Returns the URL path of the saved file, e.g. /static/audio/topic_xxx.mp3
    """
    import re
    import os
    import edge_tts

    # Remove [VISUAL: ...] markers and ALL section headers — not meant to be read aloud
    clean = re.sub(r'\[VISUAL:[^\]]*\]', '', script)
    clean = re.sub(r'\[KP:[^\]]*\]', '', clean)
    # Strip all 7-section headers (new prompt) and legacy headers
    clean = re.sub(
        r'\b(HOOK|CONTEXT|CORE CONCEPT|WORKED EXAMPLE|COMMON MISTAKES|DEEPER INSIGHT|SUMMARY'
        r'|INTRODUCTION|KEY CONCEPTS|EXAMPLES|EXAMPLES & PRACTICE|DEEP DIVE)\s*[:\-]\s*',
        '',
        clean,
        flags=re.IGNORECASE,
    )
    clean = re.sub(r'\s+', ' ', clean).strip()

    if not clean:
        raise ValueError("Script is empty after cleaning visual cues")

    os.makedirs("static/audio", exist_ok=True)
    filename = f"topic_{topic_id}.mp3"
    output_path = f"static/audio/{filename}"

    communicate = edge_tts.Communicate(clean, voice)
    await communicate.save(output_path)

    logger.info(f"Audio saved: {output_path}")
    return f"/static/audio/{filename}"
