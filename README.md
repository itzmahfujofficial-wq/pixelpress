# PixelPress - PDF to JPG Converter

A responsive Flask application that converts PDF pages into JPG images and downloads them as a ZIP archive.

## Features
- PDF upload with drag-and-drop
- 50 MB upload limit and 100-page conversion limit
- Convert all pages or selected pages (examples: `1,3,5-8`)
- Choose 96, 150, 200, or 300 DPI
- Choose JPG quality from 60% to 100%
- ZIP download containing individually named JPG files
- Responsive interface for desktop and mobile
- PDF processing happens in memory; this app does not save uploaded PDFs to disk

## Requirements
- Python 3.10+
- pip

## Run locally

### Windows
```bash
py -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
python app.py
```

### macOS / Linux
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000 in your browser.

## Page selection examples
- `all` (default): every page
- `1,3,5`: pages 1, 3 and 5
- `2-6`: pages 2 through 6
- `1,4-7,10`: a combination of individual pages and ranges

## Production notes
- Set `debug=False` and run behind a production WSGI server such as Waitress or Gunicorn.
- Configure HTTPS, request timeouts, rate limiting and suitable resource limits.
- The app rejects encrypted PDFs and limits conversions to 100 pages.
- Consider adding malware scanning and stricter per-user quotas before exposing a public service.
- For large files or high traffic, move conversion work to a background job queue.
