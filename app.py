import os
import requests
import mimetypes
from flask import Flask, render_template, request, Response, stream_with_context, redirect, url_for, jsonify, abort
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Config
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)
BUCKET_NAME = "audio_files"
ENABLE_WRITE = os.environ.get("ENABLE_WRITE_OPERATIONS", "False").lower() in ('true', '1', 't', 'yes')
CHUNK_SIZE = int(os.environ.get("STREAM_CHUNK_SIZE", 2048))

@app.context_processor
def inject_permissions():
    return dict(can_write=ENABLE_WRITE)

# Handle Errors
@app.errorhandler(405)
def method_not_allowed(e):
    return render_template('error.html', error_code=405, error_message="Method Not Allowed."), 405

@app.errorhandler(404)
def page_not_found(e):
    return render_template('error.html', error_code=404, error_message="We couldn't find the track or page you were looking for."), 404

@app.errorhandler(403)
def forbidden(e):
    # We use e.description to pass custom messages from abort()
    msg = e.description if e.description != "Forbidden" else "You don't have permission to access this resource."
    return render_template('error.html', error_code=403, error_message=msg), 403

@app.errorhandler(500)
def internal_server_error(e):
    return render_template('error.html', error_code=500, error_message="Something went wrong on our end. Please try again later."), 500

# Routes
@app.route('/')
def index():
    response = supabase.table('audio_files').select("*").order('created_at', desc=True).execute()
    songs = response.data
    return render_template('index.html', songs=songs)

@app.route('/upload', methods=['GET', 'POST'])
def upload():
    if not ENABLE_WRITE:
        abort(403, description="Uploads have been disabled by the administrator.")

    if request.method == 'POST':
        file = request.files['file']
        cover = request.files['cover']
        title = request.form['title']
        artist = request.form['artist']

        filename = file.filename
        content_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        
        safe_title = "".join([c for c in title if c.isalnum() or c in (' ','-','_')]).strip().replace(" ", "_")
        safe_artist = "".join([c for c in artist if c.isalnum() or c in (' ','-','_')]).strip().replace(" ", "_")
        
        file_path = f"{safe_artist}_{safe_title}_{filename}"
        file_bytes = file.read()
        supabase.storage.from_(BUCKET_NAME).upload(
            path=file_path, 
            file=file_bytes, 
            file_options={"content-type": content_type}
        )

        cover_filename = cover.filename
        cover_path = f"covers/{safe_artist}_{safe_title}_{cover_filename}"
        cover_bytes = cover.read()
        supabase.storage.from_(BUCKET_NAME).upload(
            path=cover_path,
            file=cover_bytes,
            file_options={"content-type": "image/jpeg"}
        )
        cover_url = supabase.storage.from_(BUCKET_NAME).get_public_url(cover_path)

        supabase.table('audio_files').insert({
            "title": title,
            "artist": artist,
            "file_path": file_path,
            "album_art_url": cover_url
        }).execute()

        return redirect(url_for('index'))
    return render_template('upload.html')

@app.route('/delete/<int:audio_id>', methods=['DELETE'])
def delete_song(audio_id):
    if not ENABLE_WRITE:
        return jsonify({"error": "Deletions are disabled"}), 403

    data = supabase.table('audio_files').select("*").eq("id", audio_id).execute()
    if not data.data:
        return jsonify({"error": "Song not found"}), 404
    
    song = data.data[0]
    audio_path = song['file_path']
    
    try:
        cover_path = "covers/" + song['album_art_url'].split('/covers/')[1]
    except IndexError:
        cover_path = None

    supabase.storage.from_(BUCKET_NAME).remove([audio_path])
    if cover_path:
        supabase.storage.from_(BUCKET_NAME).remove([cover_path])

    supabase.table('audio_files').delete().eq("id", audio_id).execute()

    return jsonify({"success": True})

@app.route('/stream/<int:audio_id>')
def stream_audio(audio_id):
    # Check referer
    referer = request.headers.get("Referer")
    if referer is None or not referer.startswith(request.host_url):
        abort(403, description="Direct access to audio streams is forbidden.")

    data = supabase.table('audio_files').select("file_path").eq("id", audio_id).execute()
    
    if not data.data:
        abort(404)
    
    file_path = data.data[0]['file_path']
    source_url = supabase.storage.from_(BUCKET_NAME).get_public_url(file_path)

    range_header = request.headers.get('Range', None)
    headers = {'Range': range_header} if range_header else {}
    
    upstream_response = requests.get(source_url, headers=headers, stream=True)

    def generate():
        for chunk in upstream_response.iter_content(chunk_size=CHUNK_SIZE):
            yield chunk

    response = Response(stream_with_context(generate()), 
                        status=upstream_response.status_code,
                        content_type=upstream_response.headers['Content-Type'])
    
    response.headers['Content-Range'] = upstream_response.headers.get('Content-Range')
    response.headers['Accept-Ranges'] = 'bytes'
    response.headers['Content-Length'] = upstream_response.headers.get('Content-Length')
    
    return response

if __name__ == '__main__':
    app.run(debug=True, port=5000)