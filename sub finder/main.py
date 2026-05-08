"""
CLI entry point.
Usage:
  python3 main.py --url "https://sub-scene.com/subscene/108349"
  python3 main.py "Inception"
"""
import sys
import asyncio
import json
import os

def log(*args):
    print(*args, file=sys.stderr, flush=True)

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "Usage: main.py --url <url> OR main.py <movie_name>"}))
        return

    script_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, script_dir)

    # --url mode: skip searcher, go straight to downloader
    if sys.argv[1] == "--url":
        if len(sys.argv) < 3:
            print(json.dumps({"status": "error", "message": "Missing URL argument"}))
            return
        target_url = sys.argv[2]
        log(f"Direct URL mode: {target_url}")
        import downloader
        result = await downloader.download_and_extract(target_url)
        if result and len(result) > 0:
            log(f"Found {len(result)} subtitles")
            print(json.dumps({"status": "success", "data": result}))
        else:
            print(json.dumps({"status": "error", "message": "لم يتم العثور على ترجمات عربية"}))
        return

    # movie name mode: searcher → downloader
    movie_name = sys.argv[1]
    log(f"Movie name mode: {movie_name}")
    try:
        import searcher
        import downloader

        log("Getting movie URL from Subscene...")
        target_url = await searcher.get_movie_url(movie_name)

        if not target_url:
            print(json.dumps({"status": "error", "message": "لم يتم العثور على الفيلم في Subscene"}))
            return

        log(f"Found URL: {target_url}")
        result = await downloader.download_and_extract(target_url)

        if result and len(result) > 0:
            log(f"Found {len(result)} subtitles")
            print(json.dumps({"status": "success", "data": result}))
        else:
            print(json.dumps({"status": "error", "message": "لم يتم العثور على ترجمات عربية"}))

    except Exception as e:
        log(f"Error: {e}")
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"status": "error", "message": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
