import io
import os
import re
import uuid
import zipfile
from pathlib import Path

import fitz
from flask import Flask, jsonify, render_template, request, send_file
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB
MAX_PAGES = 100
ALLOWED_EXTENSIONS = {"pdf"}


@app.after_request
def security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.errorhandler(413)
def too_large(_error):
    return jsonify(error="File is too large. Maximum upload size is 50 MB."), 413


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/convert")
def convert_pdf():
    uploaded = request.files.get("pdf")
    if not uploaded or not uploaded.filename:
        return jsonify(error="Please choose a PDF file."), 400

    safe_name = secure_filename(uploaded.filename)
    if Path(safe_name).suffix.lower().lstrip(".") not in ALLOWED_EXTENSIONS:
        return jsonify(error="Only PDF files are supported."), 400

    try:
        pdf_bytes = uploaded.read()
        if not pdf_bytes:
            return jsonify(error="The selected file is empty."), 400

        document = fitz.open(stream=pdf_bytes, filetype="pdf")
        if document.needs_pass:
            document.close()
            return jsonify(error="This PDF is password-protected. Please upload an unlocked PDF."), 400

        page_count = len(document)
        if page_count == 0:
            document.close()
            return jsonify(error="This PDF does not contain any pages."), 400
        if page_count > MAX_PAGES:
            document.close()
            return jsonify(error=f"Maximum {MAX_PAGES} pages are allowed per conversion."), 400

        dpi = request.form.get("dpi", "150")
        quality = request.form.get("quality", "90")
        pages_raw = request.form.get("pages", "all").strip()

        if dpi not in {"96", "150", "200", "300"}:
            dpi = "150"
        if quality not in {"60", "75", "90", "100"}:
            quality = "90"

        if pages_raw.lower() == "all" or not pages_raw:
            selected_pages = list(range(page_count))
        else:
            selected_pages = parse_page_selection(pages_raw, page_count)
            if not selected_pages:
                raise ValueError("No valid pages were selected.")

        scale = int(dpi) / 72
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            for page_index in selected_pages:
                page = document.load_page(page_index)
                pixmap = page.get_pixmap(
                    matrix=fitz.Matrix(scale, scale),
                    colorspace=fitz.csRGB,
                    alpha=False,
                )
                jpg_bytes = pixmap.tobytes("jpg", jpg_quality=int(quality))
                archive.writestr(f"page-{page_index + 1:03d}.jpg", jpg_bytes)

        document.close()
        zip_buffer.seek(0)

        download_name = f"{Path(safe_name).stem or 'converted'}-jpg-images.zip"
        return send_file(
            zip_buffer,
            mimetype="application/zip",
            as_attachment=True,
            download_name=download_name,
        )
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    except (fitz.FileDataError, RuntimeError):
        return jsonify(error="The PDF could not be read. It may be damaged or unsupported."), 400
    except Exception:
        app.logger.exception("PDF conversion failed")
        return jsonify(error="Conversion failed. Please try another PDF file."), 500


def parse_page_selection(value: str, page_count: int) -> list[int]:
    """Parse selections such as 1,3,5-8 into zero-based page indexes."""
    selected = set()
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if re.fullmatch(r"\d+", part):
            start = end = int(part)
        elif re.fullmatch(r"\d+\s*-\s*\d+", part):
            left, right = re.split(r"\s*-\s*", part)
            start, end = int(left), int(right)
        else:
            raise ValueError("Use page numbers like 1,3,5-8.")

        if start < 1 or end < start or end > page_count:
            raise ValueError(f"Page numbers must be between 1 and {page_count}.")
        selected.update(range(start - 1, end))

    return sorted(selected)


if __name__ == "__main__":
    app.run(debug=True)
