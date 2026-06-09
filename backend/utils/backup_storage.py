import json
import os
from datetime import datetime
from supabase import create_client, Client

BUCKET_NAME = os.environ.get("SUPABASE_STORAGE_BUCKET", "backups")

_supabase_storage_client = None


def _get_client() -> Client:
    global _supabase_storage_client
    if _supabase_storage_client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY required for backup storage")
        _supabase_storage_client = create_client(url, key)
    return _supabase_storage_client


def _ensure_bucket():
    client = _get_client()
    try:
        client.storage.create_bucket(BUCKET_NAME, options={"public": False})
    except Exception as e:
        print(f"[backup_storage] Warning: Could not create bucket '{BUCKET_NAME}': {e}")


def create_backup(data: dict) -> dict:
    _ensure_bucket()
    client = _get_client()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.json"
    content = json.dumps(data, indent=2)
    try:
        client.storage.from_(BUCKET_NAME).upload(
            path=filename,
            file=content.encode("utf-8"),
            file_options={"content-type": "application/json"},
        )
    except Exception as e:
        raise RuntimeError(f"Failed to upload backup to bucket '{BUCKET_NAME}': {e}")
    size = len(content.encode("utf-8"))
    return {"filename": filename, "size": size}


def list_backups():
    _ensure_bucket()
    client = _get_client()
    try:
        files = client.storage.from_(BUCKET_NAME).list()
    except Exception:
        return []
    if files is None:
        return []
    result = []
    for f in files:
        if f["name"].endswith(".json"):
            result.append({
                "filename": f["name"],
                "size": f.get("metadata", {}).get("size", 0),
                "created_at": f.get("created_at", ""),
            })
    return result


def download_backup(filename: str) -> bytes:
    client = _get_client()
    data = client.storage.from_(BUCKET_NAME).download(filename)
    return data


def download_backup_json(filename: str) -> dict:
    raw = download_backup(filename)
    return json.loads(raw.decode("utf-8"))


def delete_backup(filename: str):
    client = _get_client()
    client.storage.from_(BUCKET_NAME).remove([filename])


def backup_count():
    return len(list_backups())
