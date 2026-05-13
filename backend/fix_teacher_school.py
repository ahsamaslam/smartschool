import asyncio
import sys
sys.path.insert(0, '.')

from app.config import settings
import asyncpg

async def fix():
    try:
        pool = await asyncpg.create_pool(settings.DATABASE_URL)

        # Update teacher's school_id to Allied school
        result = await pool.execute(
            'UPDATE users SET school_id = $1 WHERE email = $2',
            '4da7e9bd-a97a-4406-9293-aff3e71fd8b8',
            'kashankhanpak265@gmail.com'
        )
        print(f"Updated {result} teacher(s)")

        # Verify
        teacher = await pool.fetchrow('SELECT id, email, school_id FROM users WHERE email = $1', 'kashankhanpak265@gmail.com')
        print(f"Teacher now has school_id: {teacher['school_id']}")

        await pool.close()
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(fix())
