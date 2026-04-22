"""
Quiz System Routes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime

from app.utils.database import execute_query, execute_one, execute_write
from app.utils.claude_ai import grade_short_answer, grade_long_answer, generate_quiz_questions

router = APIRouter()


# ============================================
# REQUEST MODELS
# ============================================

class GenerateQuizRequest(BaseModel):
    topic_id: str
    difficulty: str = "medium"
    question_types: Dict[str, int]  # {"mcq": 5, "short_answer": 2}


class SubmitQuizRequest(BaseModel):
    student_id: str
    quiz_instance_id: str
    answers: List[Dict]  # [{"question_id": "...", "answer": "..."}]


# ============================================
# QUIZ GENERATION
# ============================================

@router.post("/generate")
async def generate_quiz(quiz_request: GenerateQuizRequest):
    """
    Generate quiz questions using Claude AI
    """
    
    # Get topic and subject info
    topic_query = """
        SELECT t.title, s.name as subject_name
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        WHERE t.id = $1
    """
    
    topic = await execute_one(topic_query, quiz_request.topic_id)
    
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Generate questions using Claude
    questions = await generate_quiz_questions(
        topic_title=topic["title"],
        subject_name=topic["subject_name"],
        difficulty=quiz_request.difficulty,
        question_types=quiz_request.question_types
    )
    
    # Save to quiz bank
    saved_questions = []
    for q in questions:
        query = """
            INSERT INTO quiz_banks (
                topic_id, question_text, question_type, difficulty,
                correct_answer, options, points
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        """
        
        import json
        
        question_id = await execute_one(
            query,
            quiz_request.topic_id,
            q["question_text"],
            q["question_type"],
            q["difficulty"],
            q["correct_answer"],
            json.dumps(q.get("options")) if q.get("options") else None,
            q.get("points", 1)
        )
        
        saved_questions.append({
            "id": str(question_id["id"]),
            **q
        })
    
    return {
        "message": f"Generated {len(saved_questions)} questions",
        "questions": saved_questions
    }


@router.get("/questions/{topic_id}")
async def get_topic_questions(topic_id: str, limit: int = 10):
    """
    Get questions from quiz bank for a topic
    """
    
    query = """
        SELECT id, question_text, question_type, difficulty, options, points
        FROM quiz_banks
        WHERE topic_id = $1
        ORDER BY RANDOM()
        LIMIT $2
    """
    
    questions = await execute_query(query, topic_id, limit)
    return [dict(q) for q in questions]


# ============================================
# QUIZ INSTANCE CREATION
# ============================================

@router.post("/instances/create")
async def create_quiz_instance(
    published_video_id: str,
    question_ids: List[str],
    time_limit_minutes: int = 30,
    is_mandatory: bool = True
):
    """
    Create a quiz instance from selected questions
    """
    
    # Create quiz instance
    query = """
        INSERT INTO quiz_instances (
            published_video_id, quiz_type, time_limit_minutes, is_mandatory, total_points
        )
        VALUES ($1, 'mixed', $2, $3, 0)
        RETURNING id
    """
    
    quiz_instance = await execute_one(
        query,
        published_video_id,
        time_limit_minutes,
        is_mandatory
    )
    
    # Add questions to instance
    total_points = 0
    for index, question_id in enumerate(question_ids):
        # Get question points
        question = await execute_one(
            "SELECT points FROM quiz_banks WHERE id = $1",
            question_id
        )
        
        total_points += question["points"]
        
        question_query = """
            INSERT INTO quiz_questions (quiz_instance_id, question_bank_id, order_index, points)
            VALUES ($1, $2, $3, $4)
        """
        
        await execute_write(
            question_query,
            quiz_instance["id"],
            question_id,
            index,
            question["points"]
        )
    
    # Update total points
    await execute_write(
        "UPDATE quiz_instances SET total_points = $1 WHERE id = $2",
        total_points,
        quiz_instance["id"]
    )
    
    return {
        "quiz_instance_id": str(quiz_instance["id"]),
        "total_questions": len(question_ids),
        "total_points": total_points
    }


# ============================================
# QUIZ TAKING
# ============================================

@router.get("/instances/{quiz_instance_id}")
async def get_quiz_instance(quiz_instance_id: str):
    """
    Get quiz instance with questions for student
    """
    
    # Get quiz info
    quiz_query = """
        SELECT qi.*, pv.id as video_id
        FROM quiz_instances qi
        JOIN published_videos pv ON qi.published_video_id = pv.id
        WHERE qi.id = $1
    """
    
    quiz = await execute_one(quiz_query, quiz_instance_id)
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Get questions
    questions_query = """
        SELECT 
            qq.id as quiz_question_id,
            qb.question_text,
            qb.question_type,
            qb.options,
            qq.points
        FROM quiz_questions qq
        JOIN quiz_banks qb ON qq.question_bank_id = qb.id
        WHERE qq.quiz_instance_id = $1
        ORDER BY qq.order_index
    """
    
    questions = await execute_query(questions_query, quiz_instance_id)
    
    return {
        "quiz": dict(quiz),
        "questions": [dict(q) for q in questions]
    }


@router.post("/attempts/start")
async def start_quiz_attempt(student_id: str, quiz_instance_id: str):
    """
    Start a new quiz attempt
    """
    
    # Get attempt number
    attempt_query = """
        SELECT COUNT(*) as attempt_count
        FROM quiz_attempts
        WHERE student_id = $1 AND quiz_instance_id = $2
    """
    
    attempts = await execute_one(attempt_query, student_id, quiz_instance_id)
    attempt_number = (attempts["attempt_count"] or 0) + 1
    
    # Create attempt
    query = """
        INSERT INTO quiz_attempts (student_id, quiz_instance_id, attempt_number)
        VALUES ($1, $2, $3)
        RETURNING id, started_at
    """
    
    attempt = await execute_one(query, student_id, quiz_instance_id, attempt_number)
    
    return {
        "attempt_id": str(attempt["id"]),
        "started_at": attempt["started_at"].isoformat(),
        "attempt_number": attempt_number
    }


# ============================================
# QUIZ SUBMISSION & GRADING
# ============================================

@router.post("/attempts/submit")
async def submit_quiz(submission: SubmitQuizRequest):
    """
    Submit quiz answers and get automatic grading
    """
    
    total_score = 0
    total_points = 0
    
    for answer_data in submission.answers:
        # Get question details
        question_query = """
            SELECT 
                qb.question_type,
                qb.correct_answer,
                qq.points
            FROM quiz_questions qq
            JOIN quiz_banks qb ON qq.question_bank_id = qb.id
            WHERE qq.id = $1
        """
        
        question = await execute_one(question_query, answer_data["question_id"])
        
        if not question:
            continue
        
        total_points += question["points"]
        
        # Grade based on question type
        if question["question_type"] == "mcq":
            # Simple MCQ grading
            is_correct = answer_data["answer"].upper() == question["correct_answer"].upper()
            points_earned = question["points"] if is_correct else 0
            feedback = "Correct!" if is_correct else f"Incorrect. The correct answer is {question['correct_answer']}."
            
        elif question["question_type"] == "short_answer":
            # AI grading for short answers
            grading_result = await grade_short_answer(
                question="",  # Question text not needed for grading
                student_answer=answer_data["answer"],
                correct_answer=question["correct_answer"],
                max_points=question["points"]
            )
            points_earned = grading_result["points_earned"]
            feedback = grading_result["feedback"]
            is_correct = grading_result["is_correct"]
            
        elif question["question_type"] == "long_answer":
            # AI grading for long answers
            grading_result = await grade_long_answer(
                question="",
                student_answer=answer_data["answer"],
                rubric=question["correct_answer"],
                max_points=question["points"]
            )
            points_earned = grading_result["points_earned"]
            feedback = grading_result["feedback"]
            is_correct = grading_result["is_correct"]
        
        else:
            points_earned = 0
            feedback = "Unable to grade"
            is_correct = False
        
        total_score += points_earned
        
        # Save answer
        answer_query = """
            INSERT INTO quiz_answers (
                attempt_id, question_id, student_answer, points_earned, is_correct, feedback
            )
            VALUES ($1, $2, $3, $4, $5, $6)
        """
        
        await execute_write(
            answer_query,
            submission.quiz_instance_id,  # This should be attempt_id in production
            answer_data["question_id"],
            answer_data["answer"],
            points_earned,
            is_correct,
            feedback
        )
    
    # Update attempt with final score
    percentage_score = (total_score / total_points * 100) if total_points > 0 else 0
    
    update_query = """
        UPDATE quiz_attempts
        SET submitted_at = NOW(),
            score = $1,
            total_points = $2,
            is_completed = true
        WHERE student_id = $3 AND quiz_instance_id = $4
        RETURNING id
    """
    
    await execute_one(
        update_query,
        percentage_score,
        total_points,
        submission.student_id,
        submission.quiz_instance_id
    )
    
    return {
        "message": "Quiz submitted successfully",
        "score": round(percentage_score, 2),
        "total_score": total_score,
        "total_points": total_points
    }


# ============================================
# QUIZ RESULTS
# ============================================

@router.get("/attempts/{attempt_id}/results")
async def get_quiz_results(attempt_id: str):
    """
    Get detailed results for a quiz attempt
    """
    
    # Get attempt details
    attempt_query = """
        SELECT qa.*, qi.total_points
        FROM quiz_attempts qa
        JOIN quiz_instances qi ON qa.quiz_instance_id = qi.id
        WHERE qa.id = $1
    """
    
    attempt = await execute_one(attempt_query, attempt_id)
    
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    
    # Get answers with feedback
    answers_query = """
        SELECT 
            qans.student_answer,
            qans.points_earned,
            qans.is_correct,
            qans.feedback,
            qb.question_text,
            qb.question_type,
            qb.correct_answer,
            qq.points as max_points
        FROM quiz_answers qans
        JOIN quiz_questions qq ON qans.question_id = qq.id
        JOIN quiz_banks qb ON qq.question_bank_id = qb.id
        WHERE qans.attempt_id = $1
        ORDER BY qq.order_index
    """
    
    answers = await execute_query(answers_query, attempt_id)
    
    return {
        "attempt": dict(attempt),
        "answers": [dict(ans) for ans in answers]
    }


@router.get("/student/{student_id}/history")
async def get_student_quiz_history(student_id: str, limit: int = 20):
    """
    Get quiz attempt history for a student
    """
    
    query = """
        SELECT 
            qa.id as attempt_id,
            qa.score,
            qa.total_points,
            qa.started_at,
            qa.submitted_at,
            qa.attempt_number,
            t.title as topic_title,
            s.name as subject_name
        FROM quiz_attempts qa
        JOIN quiz_instances qi ON qa.quiz_instance_id = qi.id
        JOIN published_videos pv ON qi.published_video_id = pv.id
        JOIN video_templates vt ON pv.video_template_id = vt.id
        JOIN topics t ON vt.topic_id = t.id
        JOIN subjects s ON t.subject_id = s.id
        WHERE qa.student_id = $1 AND qa.is_completed = true
        ORDER BY qa.submitted_at DESC
        LIMIT $2
    """
    
    history = await execute_query(query, student_id, limit)
    return [dict(h) for h in history]
