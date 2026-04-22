import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__))

async def main():
    from app.utils.database import execute_query
    
    # Status breakdown
    rows = await execute_query(
        "SELECT status, COUNT(*) as cnt FROM video_templates GROUP BY status ORDER BY cnt DESC"
    )
    print("=== Video Template Status ===")
    for r in rows:
        print(f"  {r['status']}: {r['cnt']}")

    # Check audio/whiteboard/avatar presence
    rows2 = await execute_query(
        """
        SELECT
          COUNT(*) FILTER (WHERE audio_url IS NOT NULL) as has_audio,
          COUNT(*) FILTER (WHERE whiteboard_url IS NOT NULL) as has_whiteboard,
          COUNT(*) FILTER (WHERE avatar_url IS NOT NULL) as has_avatar,
          COUNT(*) FILTER (WHERE final_video_url IS NOT NULL) as has_final,
          COUNT(*) as total
        FROM video_templates
        """
    )
    r = rows2[0]
    print(f"\n=== Asset Progress ===")
    print(f"  Total templates : {r['total']}")
    print(f"  Has audio       : {r['has_audio']}")
    print(f"  Has whiteboard  : {r['has_whiteboard']}")
    print(f"  Has avatar      : {r['has_avatar']}")
    print(f"  Has final video : {r['has_final']}")

asyncio.run(main())
