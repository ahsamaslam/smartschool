"""
Q&A Bot Routes  
"""
from fastapi import APIRouter
from pydantic import BaseModel
from app.utils.claude_ai import answer_student_question
from app.utils.database import execute_one

router = APIRouter()

class QuestionRequest(BaseModel):
    student_id: str
    video_id: str
    question: str

@router.post("/ask")
async def ask_question(req: QuestionRequest):
    """Ask question to AI bot"""
    # Get context
    context = await execute_one(
        "SELECT t.title, s.name FROM published_videos pv JOIN video_templates vt ON pv.video_template_id = vt.id JOIN topics t ON vt.topic_id = t.id JOIN subjects s ON t.subject_id = s.id WHERE pv.id = $1",
        req.video_id
    )
    
    result = await answer_student_question(
        question=req.question,
        topic_title=context["title"] if context else "",
        subject_name=context["name"] if context else ""
    )
    
    return result
