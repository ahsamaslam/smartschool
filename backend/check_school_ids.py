import asyncio
import sys
sys.path.insert(0, '.')

from app.config import settings
import asyncpg

async def check():
    try:
        pool = await asyncpg.create_pool(settings.DATABASE_URL)

        # Get all managers
        managers = await pool.fetch('SELECT id, email, full_name, school_id FROM users WHERE role = $1', 'manager')
        print("=== MANAGERS ===")
        for m in managers:
            print(f"Manager: {m['email']} - school_id: {m['school_id']}")

        print("\n=== TEACHERS ===")
        # Get all teachers
        teachers = await pool.fetch('SELECT id, email, full_name, school_id FROM users WHERE role = $1', 'teacher')
        for t in teachers:
            print(f"Teacher: {t['email']} - school_id: {t['school_id']}")

        print("\n=== SCHOOLS ===")
        schools = await pool.fetch('SELECT id, name FROM schools')
        for s in schools:
            print(f"School: {s['name']} - id: {s['id']}")

        await pool.close()
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(check())
